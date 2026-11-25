// Yeelight Cube 常駐程式：保持 Matter 連線，控制整燈（開關／亮度／顏色／色溫）與點陣畫面
// （時鐘、跑馬燈、呼吸、動畫），並接受行事曆插播。
//
// 環境變數：
//   MATTER_STORAGE_PATH  燈的 Matter 憑證目錄（必填）
//   CUBE_PORT            API 埠，預設 8766（只綁 127.0.0.1，由網頁控制台轉送）
//   CUBE_STATE           設定檔，預設 $MATTER_STORAGE_PATH/cube_state.json
// API：
//   GET  /status
//   POST /mode   {"mode":"clock"|"text"|"breathe"|"effect"|"off", "text", "orient", "speed", "color", "effect"}
//                off＝點陣不更新（燈維持家庭 App 或標準指令設的樣子）
//   POST /light  {"on":true|false} | {"level":1-100} | {"color":"#rrggbb"} | {"ct":1700-6500}
//                走 Matter 標準指令，家庭 App 會同步顯示；設顏色或色溫時點陣自動停（mode→off）
//   POST /alert  {"text":"NEXT 14:30","until":"<ISO>"} 或 {"text":"WASH DONE","seconds":300,"color":"#00ff80"}
//                | {"clear":true}  插播跑馬燈（行事曆、HA 通知；mode 為 off 時不插播）
//   POST /history {"remove":"BUSY"}  刪除用過的文字紀錄（套用文字模式時自動記下，最多 12 筆）
//   POST /timer  {"minutes":5,"flash":"#ff0000"} | {"seconds":90} | {"pause":true} | {"resume":true} | {"add":60} | {"cancel":true}
//                倒數 MMSS（最多 99:59），時間到整面用 flash 顏色閃 8 秒後回原畫面；插播會暫時蓋過，倒數照算
//   POST /rest   {"minutes":240} | {"until":"14:30"} | {"stop":true}
//                補眠：亮度降到 5%、暖橘時鐘；期間的通知先存著，結束後恢復亮度並逐則補播 1 分鐘（已過期的行事曆提醒跳過）
//   mode 另有 "weather"（Open-Meteo，WEATHER_LAT/WEATHER_LON，需設定天氣座標）與 "image"（{"image":{w,h,pixels}}）
//   排程：{"schedule":{"enabled":true,"slots":[{"at":"07:00","mode":"clock"},{"at":"21:00","mode":"effect","effect":"candle"}]}}
//         到了每個時段的開始時間才切換；中途手動改的設定會維持到下一個時段。
// 讓步：點陣模式中若偵測到燈被關、或顏色被別處（家庭 App、HA）改掉 → 暫停或停止點陣，不搶回來。
import http from "node:http";
import {PIXEL_FACES, FACE_CATALOG, faceImage} from "./pixel_faces.mjs";
import {clockCanvas, clockPixelAccent} from "./clock_colors.mjs";
import {DEFAULT_COLOR_SPEED, normalizeColorSpeed, colorPhase} from "./color_speed.mjs";
import {ScenesStore,sceneSettings} from "./scenes_store.mjs";
import fs from "node:fs";
import path from "node:path";
import { renderer, connectLamp, ORIENTS, SUPPORTED_CHARS, TEXT_SHORTCUTS, TEXT_FACE_GROUPS, hsv, kelvinToRgb, dim } from "./cube_lib.mjs";

const STORAGE = process.env.MATTER_STORAGE_PATH;
if (!STORAGE) { console.error("ERROR 需要設定 MATTER_STORAGE_PATH"); process.exit(1); }
const PORT = Number(process.env.CUBE_PORT ?? 8766);
const STATE_FILE = process.env.CUBE_STATE ?? path.join(STORAGE, "cube_state.json");
const MAX_FAILS = 5;
const ANIM_MS = 300; // 動畫每格最快 300 毫秒（約每秒 3 次指令）
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }), ...a);

export const EFFECTS = {
    rainbow: "彩虹", party: "派對", candle: "燭光", ocean: "海洋",
    aurora: "極光", fire: "火焰", stars: "星空", rain: "雨滴", sakura: "櫻花飄落", heartbeat: "心跳",
    sunrise: "日出（3 分鐘）", alert: "警示閃爍", sleep: "10 分鐘漸暗後關燈",
};
const MODES = ["clock", "text", "breathe", "effect", "weather", "image", "face", "off"];
export const COLOR_FX = { fixed: "固定", flow: "彩虹流動", diagonal: "斜向彩虹", sunset: "夕陽漸層", ocean: "海洋漸層",
    pulse: "呼吸", sparkle: "閃亮", honey: "蜜糖暖光", nord: "北歐冰川", dracula: "德古拉霓虹", catppuccin: "奶霜粉彩", synthwave: "復古電光" };
export const TEXT_FX = { scroll: "捲動", still: "靜止", blink: "閃爍", scrollblink: "捲動＋閃爍" };
const DEFAULT = { face: "cat", font: "classic", mode: "clock", text: "HELLO", textFx: "scroll", orient: "up", speed: 250, color: "", color2: "", colorFx: "fixed", colorSpeed: DEFAULT_COLOR_SPEED, effect: "rainbow",
    history: ["WASH DONE", "BUSY", "♥"], timer: null,
    image: null, schedule: { enabled: false, slots: [] }, rest: null };
const REST_LEVEL = 5, REST_COLOR = "#ff5a00", REPLAY_SECONDS = 60;
const rgbOf = hex => hex ? [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) : null;
const checkHex = (c, field) => { if (c && !/^#[0-9a-f]{6}$/.test(c)) throw new Error(`${field} 要是 #rrggbb`); return c; };

function sanitize(s) {
    if (!MODES.includes(s.mode)) throw new Error(`mode 只能是 ${MODES.join("/")}`);
    if (!ORIENTS.includes(s.orient)) throw new Error(`orient 只能是 ${ORIENTS.join("/")}`);
    if (!(s.effect in EFFECTS)) throw new Error(`effect 只能是 ${Object.keys(EFFECTS).join("/")}`);
    const face = s.face ?? "cat";
    if (typeof face !== "string" || !Object.hasOwn(PIXEL_FACES, face)) throw new Error("不支援的像素表情");
    const font = s.font ?? "classic";
    if (!["classic", "compact"].includes(font)) throw new Error("font 只能是 classic/compact");
    const text = String(s.text ?? "").toUpperCase().slice(0, 60);
    const bad = [...text].filter(ch => !SUPPORTED_CHARS.includes(ch));
    if (bad.length) throw new Error(`不支援的字：${[...new Set(bad)].join("")}（請使用英文、數字或控制台列出的符號）`);
    // 最快 200 毫秒／格：11-24 用 90 毫秒（約每秒 11 次 Matter 指令）後燈離線
    const speed = Math.min(1000, Math.max(200, Number(s.speed) || DEFAULT.speed));
    const color = checkHex(String(s.color ?? "").toLowerCase(), "color");
    const color2 = color ? checkHex(String(s.color2 ?? "").toLowerCase(), "color2") : ""; // 時鐘分鐘色；沒有主色就用預設雙色
    const history = (Array.isArray(s.history) ? s.history : DEFAULT.history).map(t => String(t).toUpperCase().slice(0, 60))
        .filter((t, i, a) => t && a.indexOf(t) === i && [...t].every(ch => SUPPORTED_CHARS.includes(ch))).slice(0, 12);
    const image = s.image ? checkImage(s.image) : null;
    if (s.mode === "image" && !image) throw new Error("image 模式需要先上傳圖片");
    const colorFx = s.colorFx ?? DEFAULT.colorFx;
    if (!(colorFx in COLOR_FX)) throw new Error(`colorFx 只能是 ${Object.keys(COLOR_FX).join("/")}`);
    const colorSpeed = normalizeColorSpeed(s.colorSpeed ?? DEFAULT.colorSpeed);
    const textFx = s.textFx ?? DEFAULT.textFx;
    if (!(textFx in TEXT_FX)) throw new Error(`textFx 只能是 ${Object.keys(TEXT_FX).join("/")}`);
    return { face, font, mode: s.mode, text: text || DEFAULT.text, textFx, orient: s.orient, speed, color, color2, colorFx, colorSpeed, history, effect: s.effect,
        image, schedule: checkSchedule(s.schedule ?? DEFAULT.schedule), rest: checkRest(s.rest), timer: checkTimer(s.timer) };
}
/** 倒數：{until(ms), total(秒), paused, remaining(暫停時剩幾毫秒)} */
function checkTimer(t) {
    if (!t || !Number.isFinite(t.total)) return null;
    const flash = /^#[0-9a-f]{6}$/.test(t.flash ?? "") ? t.flash : "#00ff80"; // 時間到閃燈的顏色
    if (t.paused) return Number.isFinite(t.remaining) ? { until: null, total: t.total, paused: true, remaining: t.remaining, flash } : null;
    return Number.isFinite(t.until) ? { until: t.until, total: t.total, paused: false, remaining: null, flash } : null;
}
/** 補眠：{until(ms), prevLevel(%|null), missed:[{text,color,at,until}]} */
function checkRest(r) {
    if (!r || !Number.isFinite(r.until)) return null;
    return { until: r.until, prevLevel: Number.isFinite(r.prevLevel) ? r.prevLevel : null,
        missed: Array.isArray(r.missed) ? r.missed.slice(-20) : [] };
}
function checkImage(img) {
    const { w, h, pixels } = img;
    if (!((w === 5 && h === 20) || (w === 20 && h === 5))) throw new Error("image 要是 5x20 或 20x5");
    if (!Array.isArray(pixels) || pixels.length !== 100 || pixels.some(p => !/^#[0-9a-f]{6}$/i.test(p))) throw new Error("image.pixels 要是 100 個 #rrggbb");
    return { w, h, pixels: pixels.map(p => p.toLowerCase()) };
}
function checkSchedule(sc) {
    const slots = (sc.slots ?? []).slice(0, 6).map(sl => {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(sl.at)) throw new Error(`排程時間格式要是 HH:MM，收到 ${sl.at}`);
        if (!MODES.includes(sl.mode)) throw new Error(`排程模式不支援 ${sl.mode}`);
        if (sl.mode === "effect" && !(sl.effect in EFFECTS)) throw new Error(`排程動畫不支援 ${sl.effect}`);
        return { at: sl.at, mode: sl.mode, ...(sl.mode === "effect" ? { effect: sl.effect } : {}) };
    }).sort((a, b) => a.at.localeCompare(b.at));
    return { enabled: !!sc.enabled, slots };
}
function loadState() {
    try { return sanitize({ ...DEFAULT, ...JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) }); }
    catch { return { ...DEFAULT }; }
}

let state = loadState();
const scenes = new ScenesStore(path.join(STORAGE, "cube_scenes.json"), data => {
    // 只留收藏時真的有存的欄位；沒存的（例如字型、配色）套用時維持燈上現況，不被預設值蓋掉
    const saved = sceneSettings(data && typeof data === "object" ? data : {});
    if (!saved.mode) throw new Error("收藏內容缺少模式");
    const full = sanitize({ ...DEFAULT, ...saved });
    const settings = Object.fromEntries(Object.keys(saved).map(k => [k, full[k]]));
    if (settings.mode !== "image") delete settings.image;
    return settings;
}, msg => log("WARN", msg));
let notificationMuteUntil=0;
const recentAlerts=new Map();
function manualTakeover(){alert=null;notificationMuteUntil=Date.now()+60000;version++;}

let version = 0;          // 設定或插播改變就 +1，讓畫面迴圈立刻換內容
let alert = null;         // {text, until}
let paused = false;       // 燈被關掉時暫停送畫面
let colorBaseline = null; // 進入點陣模式時記下的顏色屬性，用來偵測別處改色
const status = { lastOkAt: null, lastError: null, fails: 0, startedAt: new Date().toISOString(), yieldReason: null };
const ALERT_COLOR = "#ff3030";
const alertActive = () => alert !== null && Date.now() < alert.until;
const restActive = () => state.rest !== null;
let replayQueue = []; // 等著播的通知：補眠結束後補播、或手動操作後 1 分鐘內進來的。{text,color,until(過期時間或 null),dur(播多久 ms)}
let timerDoneUntil = 0, timerDoneColor = "#00ff80"; // 倒數結束後整面閃燈到這個時間、用這個顏色
const timerLeft = tm => tm.paused ? tm.remaining : tm.until - Date.now();
const timerView = tm => tm && { left: Math.max(0, Math.ceil(timerLeft(tm) / 1000)), total: tm.total, paused: tm.paused, flash: tm.flash };
function effective() {
    if (Date.now() < timerDoneUntil) return { ...state, mode: "timerdone" };
    if (alertActive() && state.mode !== "off") return { ...state, mode: "text", text: alert.text, color: alert.color ?? ALERT_COLOR,
        speed: Math.max(state.speed, 250), colorFx: "fixed", isAlert: true };
    if (state.timer) return { ...state, mode: "timer" }; // 倒數優先於補眠與一般畫面（插播會暫時蓋過，倒數照算）
    if (restActive()) return { ...state, mode: "clock", color: REST_COLOR, color2: "", colorFx: "fixed" }; // 補眠：暖色時鐘，亮度另外調到 5%
    return state;
}

// ---- 天氣（Open-Meteo，免金鑰；只送城市等級座標） ----
const WEATHER_LAT = process.env.WEATHER_LAT, WEATHER_LON = process.env.WEATHER_LON;
let weatherNow = null; // {icon, temp, at}
function weatherIcon(code, isDay) {
    if (code === 0) return isDay ? "sun" : "moon";
    if (code <= 2) return isDay ? "partly" : "moon";
    if (code === 3) return "cloud";
    if (code === 45 || code === 48) return "fog";
    if (code >= 95) return "thunder";
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
    if (code >= 51) return "rain";
    return "cloud";
}
async function refreshWeather() {
    if (!WEATHER_LAT || !WEATHER_LON) return; // 未設定時不查詢位置
    try {
        const u = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&current=temperature_2m,weather_code,is_day&timezone=Asia%2FTaipei`;
        const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
        const j = await r.json();
        const cur = j.current;
        const next = { icon: weatherIcon(cur.weather_code, cur.is_day === 1), temp: cur.temperature_2m, at: new Date().toISOString() };
        const changed = !weatherNow || weatherNow.icon !== next.icon || Math.round(weatherNow.temp) !== Math.round(next.temp);
        weatherNow = next;
        if (changed && state.mode === "weather") version++;
    } catch (e) { log("天氣讀取失敗", e?.message ?? e); }
}
refreshWeather();
setInterval(refreshWeather, 15 * 60e3);

// ---- 時段排程：跨過某個時段的開始時間才切換 ----
const nowHHMM = () => new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false });
function currentSlot(sc) {
    if (!sc.enabled || !sc.slots.length) return null;
    const now = nowHHMM();
    const past = sc.slots.filter(s => s.at <= now);
    return past.length ? past[past.length - 1] : sc.slots[sc.slots.length - 1]; // 凌晨還沒到第一個時段 → 沿用前一天最後一個
}
/** 下一個會切換的時段（給控制頁顯示「下次 21:00 切換燭光」） */
function nextSlot(sc) {
    if (!sc.enabled || !sc.slots.length) return null;
    const now = nowHHMM();
    return sc.slots.find(s => s.at > now) ?? sc.slots[0];
}
let lastSlotKey = JSON.stringify(currentSlot(state.schedule)); // 啟動時不套用，避免蓋掉手動設定
setInterval(() => {
    const slot = currentSlot(state.schedule);
    const key = JSON.stringify(slot);
    if (key === lastSlotKey) return;
    lastSlotKey = key;
    if (!slot) return;
    if (slot.mode === "image" && !state.image) return;
    state = { ...state, mode: slot.mode, ...(slot.effect ? { effect: slot.effect } : {}) };
    status.yieldReason = null;
    saveState(`排程切換（${slot.at}）`);
}, 20000);
const persist = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); // 不重畫，只存檔
function saveState(reason) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    version++;
    log(reason, JSON.stringify({ ...state, image: state.image ? "(已上傳)" : null })); // 像素畫太長，不寫進 log
}

// ---- Matter 連線 ----
const lamp = await connectLamp();
log("已載入配對資料，開始嘗試連線（燈真的有回應要看 lastOkAt）");
async function attempt(fn) {
    try { const r = await fn(); status.lastOkAt = new Date().toISOString(); status.lastError = null; status.fails = 0; return r ?? true; }
    catch (e) {
        status.fails++; status.lastError = e?.message ?? String(e);
        log("ERROR", status.lastError, `(連續 ${status.fails} 次)`);
        if (status.fails >= MAX_FAILS) { log("連續失敗過多，結束讓 launchd 重啟"); process.exit(1); }
        await sleep(5000);
        return false;
    }
}
const COLOR_ATTRS = [[1, 0x300, 0], [1, 0x300, 1], [1, 0x300, 7], [1, 0x300, 8]];
const colorKey = v => COLOR_ATTRS.map(([e, c, a]) => v[`${e}/${c}/${a}`]).join(",");
/** 切到塗鴉燈效，等 1.5 秒讓燈的屬性穩定，再記下顏色基準（之後不一樣＝別處改了色） */
async function enterPixels() {
    colorBaseline = null;
    await lamp.enterGraffiti();
    await sleep(1500);
    colorBaseline = colorKey(await lamp.read(COLOR_ATTRS));
}

// ---- 標準 Matter 指令（TLV 手刻） ----
const u8 = (tag, v) => "24" + tag.toString(16).padStart(2, "0") + (v & 0xff).toString(16).padStart(2, "0");
const u16 = (tag, v) => "25" + tag.toString(16).padStart(2, "0") + (v & 0xff).toString(16).padStart(2, "0") + ((v >> 8) & 0xff).toString(16).padStart(2, "0");
const struct = (...f) => "15" + f.join("") + "18";
function rgbToHueSat([r, g, b]) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [Math.round(((h * 60 + 360) % 360) / 360 * 254), max ? Math.round(d / max * 254) : 0];
}
async function light(cmd) {
    if ("on" in cmd) {
        await lamp.power(!!cmd.on);
        paused = !cmd.on;
        if (cmd.on) version++; // 開燈後重畫點陣
        return;
    }
    if ("level" in cmd) {
        const lvl = Math.round(Math.min(100, Math.max(1, Number(cmd.level))) / 100 * 254);
        // LevelControl moveToLevelWithOnOff：level, transitionTime(0.1s), optionsMask, optionsOverride
        return lamp.invoke(0x04, struct(u8(0, lvl), u16(1, 3), u8(2, 0), u8(3, 0)), 1, 0x0008);
    }
    if ("color" in cmd) {
        const [hue, sat] = rgbToHueSat(rgbOf(checkHex(String(cmd.color).toLowerCase(), "color")));
        state = { ...state, mode: "off" }; saveState("改純色，點陣停止");
        await lamp.power(true); paused = false;
        // ColorControl moveToHueAndSaturation：hue, saturation, transitionTime, optionsMask, optionsOverride
        return lamp.invoke(0x06, struct(u8(0, hue), u8(1, sat), u16(2, 3), u8(3, 0), u8(4, 0)), 1, 0x0300);
    }
    if ("ct" in cmd) {
        const mireds = Math.round(1e6 / Math.min(6500, Math.max(1700, Number(cmd.ct))));
        state = { ...state, mode: "off" }; saveState("改色溫，點陣停止");
        await lamp.power(true); paused = false;
        // ColorControl moveToColorTemperature：mireds, transitionTime, optionsMask, optionsOverride
        return lamp.invoke(0x0a, struct(u16(0, mireds), u16(1, 3), u8(2, 0), u8(3, 0)), 1, 0x0300);
    }
    throw new Error("需要 on、level、color 或 ct 其中一個");
}

// ---- API ----
function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", d => { body += d; if (body.length > 10000) { req.destroy(); reject(new Error("內容太大")); } });
        req.on("end", () => { try { resolve(JSON.parse(body || "{}")); } catch { reject(new Error("JSON 格式錯誤")); } });
    });
}
const hhmm = ms => new Date(ms).toLocaleTimeString("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false });
const restView = r => r && { until: new Date(r.until).toISOString(), missed: r.missed.map(m => ({ text: m.text, at: m.at })) };
/** {minutes} 或 {until:"HH:MM"}（今天已過就算明天） */
async function startRest(b) {
    let until;
    if (b.minutes !== undefined) until = Date.now() + Number(b.minutes) * 60e3;
    else if (/^([01]\d|2[0-3]):[0-5]\d$/.test(b.until ?? "")) {
        const [h, m] = b.until.split(":").map(Number);
        const now = new Date(), tw = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
        let diff = ((h * 60 + m) - (tw.getHours() * 60 + tw.getMinutes())) * 60e3 - tw.getSeconds() * 1000;
        if (diff <= 0) diff += 24 * 3600e3;
        until = Date.now() + diff;
    } else throw new Error("要給 minutes 或 until（HH:MM）");
    if (!Number.isFinite(until) || until - Date.now() < 60e3 || until - Date.now() > 16 * 3600e3) throw new Error("補眠時間要在 1 分鐘到 16 小時之間");
    const prevLevel = state.rest?.prevLevel ?? status.light?.level ?? null; // 已在補眠中就沿用原本亮度
    const missed = state.rest?.missed ?? [];
    if (alertActive()) missed.push({ text: alert.text, color: alert.color, at: new Date().toISOString(), until: null });
    alert = null;
    state = { ...state, rest: { until, prevLevel, missed } };
    saveState(`補眠開始，到 ${hhmm(until)}`);
    await attempt(() => light({ level: REST_LEVEL }));
    return state.rest;
}
async function endRest(reason) {
    if (!state.rest) return;
    const { prevLevel, missed } = state.rest;
    state = { ...state, rest: null };
    saveState(`補眠結束（${reason}），錯過 ${missed.length} 則`);
    if (prevLevel) await attempt(() => light({ level: prevLevel }));
    const now = Date.now(); // 行事曆那種「到某時刻為止」的通知，過期就不補播
    replayQueue = [...replayQueue, ...missed.filter(m => !m.until || m.until > now)
        .map(m => ({ text: m.text, color: m.color, until: m.until ?? null, dur: REPLAY_SECONDS * 1000 }))].slice(-20);
}
setInterval(() => { if (state.rest && Date.now() >= state.rest.until) endRest("時間到").catch(e => log("ERROR", e?.message)); }, 5000);
const server = http.createServer(async (req, res) => {
    const send = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(obj)); };
    try {
        if (req.method === "GET" && req.url === "/status") {
            const { image, ...rest } = state; // 像素畫內容太長，狀態只回有沒有
            return send(200, { ...rest, rest: restView(state.rest), timer: timerView(state.timer), timerDone: Date.now() < timerDoneUntil, hasImage: !!image, weather: weatherNow, ...status, paused, effects: EFFECTS, textEffects: TEXT_FX, colorEffects: COLOR_FX,
                scenes: scenes.list(), pixelFaces: FACE_CATALOG, notificationMuteUntil, supportedChars: SUPPORTED_CHARS, textShortcuts: TEXT_SHORTCUTS, textFaceGroups: TEXT_FACE_GROUPS, nextSlot: nextSlot(state.schedule),
                alert: alertActive() ? { text: alert.text, until: new Date(alert.until).toISOString() } : null });
        }
        if (req.method === "GET" && req.url === "/frame") return send(200, lastFrame ?? { w: 0, h: 0, pixels: [] });
        if (req.method === "POST" && req.url === "/preview") {
            const s = sanitize({ ...state, ...(await readBody(req)) });
            return send(200, previewSteps(s));
        }
        if(req.method==="POST" && req.url==="/scenes"){
            const b=await readBody(req);
            if(b.action==="apply" && (restActive()||state.timer))throw Error("請先結束補眠或取消倒數，再套用收藏");
            const settings=scenes.change(b);
            if(settings){state=sanitize({...state,...settings});manualTakeover();status.yieldReason=null;saveState("套用收藏");}
            return send(200,{ok:true,scenes:scenes.list()});
        }
        if (req.method === "POST" && req.url === "/timer") {
            const b = await readBody(req), tm = state.timer;
            if (b.cancel) { state = { ...state, timer: null }; timerDoneUntil = 0; saveState("倒數取消"); }
            else if (b.pause) { if (!tm || tm.paused) throw new Error("沒有進行中的倒數");
                state = { ...state, timer: { ...tm, paused: true, remaining: tm.until - Date.now(), until: null } }; saveState("倒數暫停"); }
            else if (b.resume) { if (!tm?.paused) throw new Error("沒有暫停中的倒數");
                state = { ...state, timer: { ...tm, paused: false, until: Date.now() + tm.remaining, remaining: null } }; saveState("倒數繼續"); }
            else if (b.add !== undefined) { if (!tm) throw new Error("沒有倒數可以加時間");
                const add = Number(b.add) * 1000, cap = ms => Math.min(ms, 5999e3);
                state = { ...state, timer: tm.paused ? { ...tm, remaining: cap(tm.remaining + add) }
                    : { ...tm, until: Date.now() + cap(tm.until - Date.now() + add) } };
                state.timer.total = Math.max(state.timer.total, Math.ceil(timerLeft(state.timer) / 1000));
                saveState(`倒數加 ${b.add} 秒`); }
            else {
                const sec = Math.round(b.seconds !== undefined ? Number(b.seconds) : Number(b.minutes) * 60);
                if (!Number.isFinite(sec) || sec < 5 || sec > 5999) throw new Error("倒數要在 5 秒到 99 分 59 秒之間");
                timerDoneUntil = 0;
                const flash = b.flash ? checkHex(String(b.flash).toLowerCase(), "flash") : (tm?.flash ?? "#00ff80");
                state = { ...state, timer: { until: Date.now() + sec * 1000, total: sec, paused: false, remaining: null, flash } };
                saveState(`倒數開始 ${Math.floor(sec / 60)} 分 ${sec % 60} 秒`);
            }
            return send(200, { ok: true, timer: timerView(state.timer) });
        }
        if (req.method === "POST" && req.url === "/rest") {
            const b = await readBody(req);
            if (b.stop) { await endRest("手動結束"); return send(200, { ok: true, rest: null }); }
            return send(200, { ok: true, rest: restView(await startRest(b)) });
        }
        if (req.method === "POST" && req.url === "/history") { // {"remove":"BUSY"}
            const { remove } = await readBody(req);
            state.history = state.history.filter(t => t !== String(remove ?? "").toUpperCase());
            persist(); log("刪除文字紀錄", remove);
            return send(200, { ok: true, history: state.history });
        }
        if (req.method === "POST" && req.url === "/mode") {
            const { rest: _ignore, timer: _ignore2, interrupt, ...body } = await readBody(req);
            state = sanitize({ ...state, ...body });
            if(interrupt)manualTakeover();
            if (body.mode === "text" && body.text) state.history = [state.text, ...state.history.filter(t => t !== state.text)].slice(0, 12); // 記下用過的文字
            status.yieldReason = null;
            saveState("設定更新");
            return send(200, { ok: true, ...state });
        }
        if (req.method === "POST" && req.url === "/light") {
            const cmd = await readBody(req);
            await light(cmd);
            status.lastOkAt = new Date().toISOString();
            log("整燈", JSON.stringify(cmd));
            return send(200, { ok: true, ...state, paused });
        }
        if (req.method === "POST" && req.url === "/alert") {
            const a = await readBody(req);
            if (a.clear) { manualTakeover(); log("插播取消"); return send(200, { ok: true, alert: null }); }
            const until = a.seconds !== undefined ? Date.now() + Number(a.seconds) * 1000 : Date.parse(a.until);
            if (!Number.isFinite(until) || until <= Date.now() || until - Date.now() > 2 * 3600e3) throw new Error("until／seconds 要是未來 2 小時內");
            const { text } = sanitize({ ...state, text: a.text });
            const color=a.color?checkHex(String(a.color).toLowerCase(),"color"):null;
            for(const [k,at] of recentAlerts)if(Date.now()-at>=300000)recentAlerts.delete(k);
            const key=JSON.stringify([text,color]);
            if(recentAlerts.has(key))return send(200,{ok:true,deduplicated:true});
            if(recentAlerts.size>=100)recentAlerts.delete(recentAlerts.keys().next().value);
            recentAlerts.set(key,Date.now());
            if (restActive()) { // 補眠中：先存著，醒來再播
                state.rest.missed = [...state.rest.missed, { text, color: a.color ? checkHex(String(a.color).toLowerCase(), "color") : null, at: new Date().toISOString(),
                    until: a.seconds === undefined ? until : null }].slice(-20);
                persist(); log("補眠中，通知先存著：", text);
                return send(200, { ok: true, deferred: true });
            }
            if (Date.now() < notificationMuteUntil) { // 剛手動操作過：不立刻插播，排隊等 1 分鐘到了再播
                replayQueue = [...replayQueue, { text, color, until: a.seconds === undefined ? until : null, dur: until - Date.now() }].slice(-20);
                log("剛手動操作，通知排隊稍後播：", text);
                return send(200, { ok: true, deferred: true });
            }
            alert = { text, until, color: a.color ? checkHex(String(a.color).toLowerCase(), "color") : null };
            version++;
            log("插播", text, "到", new Date(until).toLocaleTimeString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }));
            return send(200, { ok: true, alert: { text, until: new Date(until).toISOString() } });
        }
        send(404, { error: "not found" });
    } catch (e) { send(400, { ok: false, error: e?.message ?? String(e) }); }
});
server.listen(PORT, "127.0.0.1", () => log(`API http://127.0.0.1:${PORT}  設定`, JSON.stringify(state)));

// ---- 每 10 秒讀燈的開關、亮度、顏色：回報實際狀態，並在點陣模式中讓步 ----
status.light = null; // {on, level(%), ct(K), colorMode, at}
setInterval(async () => {
    try {
        const v = await lamp.read([[1, 6, 0], [1, 8, 0], ...COLOR_ATTRS]);
        const on = v["1/6/0"] === true;
        const mireds = v["1/768/7"];
        status.light = { on, level: Math.round((Number(v["1/8/0"]) || 0) / 254 * 100),
            ct: mireds ? Math.round(1e6 / mireds) : null, colorMode: v["1/768/8"], at: new Date().toISOString() };
        if (state.mode === "off") { paused = !on; return; } // 點陣停止時只同步開關，下次切回點陣才不會卡在暫停
        if (!on && !paused) { paused = true; status.yieldReason = "燈被關掉，點陣暫停"; log(status.yieldReason); }
        if (on && paused) { paused = false; status.yieldReason = null; version++; log("燈開了，點陣恢復"); }
        if (on && colorBaseline !== null && colorKey(v) !== colorBaseline) {
            state = { ...state, mode: "off" };
            status.yieldReason = "顏色在別處被改了（家庭 App 等），點陣停止";
            saveState(status.yieldReason);
        }
    } catch { /* 讀不到就下次再試；送畫面的失敗另有計數 */ }
}, 10000);
setInterval(() => {
    if (alert !== null && Date.now() >= alert.until) { alert = null; version++; log("插播結束"); }
    if (state.timer && !state.timer.paused && Date.now() >= state.timer.until) {
        const late = Date.now() - state.timer.until;
        timerDoneColor = state.timer.flash;
        state = { ...state, timer: null }; persist();
        if (late < 120e3) { timerDoneUntil = Date.now() + 8000; log("倒數結束，閃燈"); } else log("倒數早就過了（程式重啟前），不提示");
        version++;
    }
    if (timerDoneUntil && Date.now() >= timerDoneUntil) { timerDoneUntil = 0; version++; }
    if (alert === null && replayQueue.length && !restActive() && state.mode !== "off" && Date.now() >= notificationMuteUntil) {
        const now = Date.now();
        replayQueue = replayQueue.filter(m => !m.until || m.until > now); // 行事曆那種已經過時的就不播
        const m = replayQueue.shift();
        if (m) {
            alert = { text: m.text, color: m.color, until: now + Math.min(m.dur ?? REPLAY_SECONDS * 1000, m.until ? m.until - now : Infinity) };
            version++; log("補播", m.text);
        }
    }
}, 1000);

// ---- 畫面迴圈 ----
function effectFrame(r, name, t, startedAt) {
    const elapsed = (Date.now() - startedAt) / 1000;
    const rnd = (x, y, k) => { const s = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };
    switch (name) {
        case "rainbow": return r.fill((x, y) => hsv(((r.wide ? x : y) / (r.wide ? r.LW : r.LH) + t * 0.02) % 1));
        case "party": return r.fill((x, y) => hsv(((Math.floor((r.wide ? x : y) / 5) * 0.27) + t * 0.31) % 1));
        case "candle": return r.fill((x, y) => dim([255, 120, 20], 0.35 + 0.65 * rnd(x, y, Math.floor(t / 2))));
        case "ocean": return r.fill((x, y) => dim(hsv(0.5 + 0.07 * Math.sin((r.wide ? x : y) / 3 + t / 4)), 0.6 + 0.4 * Math.sin((x + y) / 2 + t / 3) ** 2));
        case "alert": return r.fill(() => (t % 2 ? [255, 0, 0] : [0, 0, 0]));
        case "aurora": return r.fill((x, y) => { // 綠紫波帶慢慢飄
            const w = Math.sin(x * 0.7 + t * 0.12 + Math.sin(y * 0.35 + t * 0.07) * 2);
            return dim(hsv(0.36 + 0.22 * (0.5 + 0.5 * w)), 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(y * 0.4 - t * 0.1 + x * 0.3)) ** 2);
        });
        case "fire": return r.fill((x, y) => { // 底部最亮往上變暗，紅→橘→黃
            const h = (r.LH - 1 - y) / Math.max(1, r.LH - 1);
            const i = Math.max(0, Math.min(1, 1.05 - h * 1.15 + (rnd(x, y, t) - 0.5) * 0.45));
            return dim([255, Math.round(30 + 190 * i * i), Math.round(20 * i * i * i)], i);
        });
        case "stars": return r.fill((x, y) => { // 深藍夜空＋閃爍的星
            const k = rnd(x, y, 0);
            if (k < 0.82) return [0, 0, 18];
            const tw = 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(t * 0.6 + k * 40));
            return dim(k > 0.95 ? [255, 220, 160] : [200, 220, 255], tw);
        });
        case "rain": case "sakura": { // 雨：藍色長水滴；櫻花：粉色花瓣慢慢落
            const rain = name === "rain", len = rain ? 3 : 1, step = rain ? t : Math.floor(t / 2), cycle = r.LH + 6;
            return r.fill((x, y) => {
                for (const k of [1, 2]) {
                    const head = (step + Math.floor(rnd(x, k, 7) * cycle * 2)) % cycle;
                    const d = head - y;
                    if (d >= 0 && d < len) return rain ? dim([60, 140, 255], 1 - d * 0.3) : (rnd(x, k, 3) > 0.5 ? [255, 110, 170] : [255, 180, 210]);
                }
                return rain ? [0, 0, 6] : [4, 0, 2];
            });
        }
        case "heartbeat": { // 愛心「撲通、撲通」
            const beat = [1, 0.35, 0.8, 0.2, 0.12, 0.12][t % 6];
            const heart = r.staticPages("♥", [255, 30, 70])[0];
            return heart.map(row => row.map(c => dim(c, beat)));
        }
        case "sunrise": { // 3 分鐘：暗紅 → 暖白
            const p = Math.min(1, elapsed / 180);
            return r.fill(() => dim(kelvinToRgb(1700 + 2300 * p), 0.05 + 0.95 * p));
        }
        case "sleep": { // 10 分鐘暖光漸暗；結束時關燈
            const p = Math.min(1, elapsed / 600);
            return r.fill(() => dim(kelvinToRgb(2700), Math.max(0, 1 - p)));
        }
    }
    return r.blank();
}
// 最近一次成功送到燈的畫面（給控制頁顯示「燈上現在的樣子」）
let lastFrame = null;
const toHex = canvas => canvas.flat().map(([r, g, b]) => "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join(""));
async function showFrame(r, canvas) {
    const ok = await attempt(() => lamp.show(r.encode(canvas)));
    if (ok) lastFrame = { w: r.LW, h: r.LH, pixels: toHex(canvas), at: new Date().toISOString() };
    return ok;
}
const dimCanvas = (canvas, f) => canvas.map(row => row.map(c => dim(c, f)));
// ---- 顏色變化：先用白色畫字，再依位置與時間上色（亮度沿用原本，捲動＋閃爍的暗格照樣暗） ----
const animated = s => s.colorFx && s.colorFx !== "fixed";
const noise = (x, y, k) => { const v = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
function cyc(stops, p) { // 循環漸層：stops 頭尾相接
    const n = stops.length, q = ((p % 1) + 1) % 1 * n, i = Math.floor(q), f = q - i, a = stops[i], b = stops[(i + 1) % n];
    return a.map((v, k) => Math.round(v + (b[k] - v) * f));
}
const SUNSET = [[255, 70, 0], [255, 0, 110], [150, 0, 255]], OCEAN = [[0, 255, 190], [0, 130, 255], [70, 30, 255]];
function paint(r, canvas, s, t) {
    if (!animated(s)) return canvas;
    t = colorPhase(t, s.colorSpeed);
    const base = rgbOf(s.color) ?? [255, 140, 0];
    return canvas.map((row, y) => row.map((c, x) => {
        const k = Math.max(...c) / 255;
        if (k <= 0) return c;
        if (s.mode === "clock" && ["pulse", "sparkle"].includes(s.colorFx))
            return clockPixelAccent(c, s.colorFx, t, noise(x, y, Math.floor(t)) > 0.88);
        const along = (r.wide ? x : y) / (r.wide ? r.LW : r.LH);   // 沿長邊
        const diag = (x + y) / (r.LW + r.LH);                       // 左上 → 右下
        let col;
        switch (s.colorFx) {
            case "flow": col = hsv((((along * 0.8 - t * 0.04) % 1) + 1) % 1); break;
            case "diagonal": col = hsv((((diag - t * 0.05) % 1) + 1) % 1); break; // 顏色一波波往右下流
            case "sunset": col = cyc(SUNSET, diag - t * 0.04); break;
            case "ocean": col = cyc(OCEAN, diag - t * 0.04); break;
            case "honey": col = cyc([[255,150,35],[255,220,90],[255,183,76]], diag * .6); break;
            case "nord": col = cyc([[143,188,187],[136,192,208],[129,161,193]], along-t*.015); break;
            case "dracula": col = cyc([[189,147,249],[255,121,198],[139,233,253]], along-t*.025); break;
            case "catppuccin": col = cyc([[203,166,247],[245,194,231],[250,179,135],[148,226,213]], along-t*.018); break;
            case "synthwave": col = cyc([[255,40,150],[130,70,255],[0,225,255]], diag-t*.03); break;
            case "pulse": col = dim(base, 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 0.5))); break;
            case "sparkle": col = noise(x, y, Math.floor(t)) > 0.88 ? [255, 255, 255] : base; break;
            default: col = c;
        }
        return dim(col, k);
    }));
}
const isBlank = canvas => canvas.every(row => row.every(c => !c[0] && !c[1] && !c[2]));
/** 把 [畫面, 毫秒] 展開成實際要送的格子：有顏色變化時，停留久的畫面每 300 毫秒重新上色一次 */
function expandSteps(r, s, steps, t0 = 0) {
    if (!animated(s)) return steps;
    const out = []; let t = t0;
    for (const [f, ms] of steps) {
        if (isBlank(f)) { out.push([f, ms]); t += ms / ANIM_MS; continue; }
        const n = Math.max(1, Math.round(ms / ANIM_MS));
        for (let i = 0; i < n; i++) {
            const duration = Math.max(200, ms / n);
            out.push([paint(r, f, s, t), duration]); t += duration / ANIM_MS;
        } // 捲動速度不變
    }
    return out;
}
/** 文字模式的每一格：[畫面, 毫秒]。插播一律捲動。 */
function textSteps(r, s) {
    const fx = s.isAlert ? "scroll" : s.textFx;
    const color = animated(s) ? [255, 255, 255] : rgbOf(s.color);
    const steps = [];
    if (fx === "still") { // 每 4 字一頁不動；只有一頁就一直停著（每 30 秒重送一次防燈重開）
        const pages = r.staticPages(s.text, color);
        for (const page of pages) steps.push([page, pages.length > 1 ? 2500 : 30000]);
    } else if (fx === "blink") { // 每 4 字一頁，亮 1.5 秒、暗 0.6 秒，閃 3 下
        for (const page of r.staticPages(s.text, color)) for (let k = 0; k < 3; k++) steps.push([page, 1500], [r.blank(), 600]);
    } else { // 捲動；捲動＋閃爍＝每 4 格有 1 格調暗（不插全黑，字不會跳格）
        r.marquee(s.text, color).forEach((f, i) => steps.push([fx === "scrollblink" && i % 4 === 3 ? dimCanvas(f, 0.2) : f, s.speed]));
    }
    return steps;
}
/** 預覽：不送燈，回傳前幾格畫面 */
function previewSteps(s) {
    const r = renderer(s.orient, s.font);
    let steps;
    if (s.mode === "clock") steps = animated(s) ? [[clockCanvas(r, s), 24 * ANIM_MS]]
        : [[clockCanvas(r, s), 1000]];
    else if (s.mode === "weather") steps = [[weatherNow ? r.weather(weatherNow.icon, weatherNow.temp) : r.blank(), 1000]];
    else if (s.mode === "image") steps = [[s.image ? r.picture(s.image) : r.blank(), 1000]];
    else if (s.mode === "face") steps = [[r.picture(faceImage(s.face, s.orient)), 1000]];
    else if (s.mode === "text") steps = textSteps(r, s);
    if (s.mode === "text" || s.mode === "clock") steps = expandSteps(r, s, steps.slice(0, 80));
    else if (s.mode === "breathe") { const base = rgbOf(s.color) ?? [255, 160, 60];
        steps = Array.from({ length: 14 }, (_, t) => [r.fill(() => dim(base, 0.08 + 0.92 * (0.5 - 0.5 * Math.cos(t * ANIM_MS / 4000 * 2 * Math.PI)))), ANIM_MS]); }
    else if (s.mode === "effect") { const st = Date.now(); steps = Array.from({ length: 24 }, (_, t) => [effectFrame(r, s.effect, t, st), ANIM_MS]); }
    else if (!steps) steps = [[r.blank(), 1000]];
    return { w: r.LW, h: r.LH, frames: steps.slice(0, 80).map(([c, ms]) => ({ pixels: toHex(c), ms })) };
}

let stopping = false;
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, async () => { stopping = true; server.close(); await lamp.close().catch(() => {}); process.exit(0); });

while (!stopping) {
    const v = version, s = effective();
    if (s.mode === "off" || paused) { await sleep(1000); continue; }
    const r = renderer(s.orient, s.font);
    if (!(await attempt(enterPixels))) continue;
    const same = () => !stopping && v === version && !paused;
    if (s.mode === "timer") { // 倒數 MMSS：分琥珀、秒青；最後 10 秒全紅；暫停時變暗
        while (same()) {
            const tm = state.timer;
            if (!tm) break;
            const left = Math.max(0, Math.ceil(timerLeft(tm) / 1000));
            const txt = String(Math.floor(left / 60)).padStart(2, "0") + String(left % 60).padStart(2, "0");
            const cols = left <= 10 ? Array(4).fill([255, 40, 40]) : [[255, 170, 0], [255, 170, 0], [0, 200, 255], [0, 200, 255]];
            const frame = r.digits(txt, cols);
            if (!(await showFrame(r, tm.paused ? dimCanvas(frame, 0.35) : frame))) continue;
            const next = Date.now() + (tm.paused ? 1000 : (timerLeft(tm) % 1000 || 1000));
            while (same() && Date.now() < next) await sleep(Math.min(200, next - Date.now()));
        }
    } else if (s.mode === "timerdone") { // 時間到：整面用選的顏色閃 8 秒（亮 0.6、暗 0.4）
        const on = r.fill(() => rgbOf(timerDoneColor));
        while (same() && Date.now() < timerDoneUntil - 300) {
            if (!(await showFrame(r, on))) break; await sleep(600);
            if (!(await showFrame(r, r.blank()))) break; await sleep(400);
        }
        while (same()) await sleep(200);
    } else if (s.mode === "clock" && animated(s)) { // 會變色的時鐘：每 300 毫秒重畫
        let lastMinute = ""; const colorStartedAt = Date.now();
        while (same()) {
            const t0 = Date.now(), minute = new Date().toISOString().slice(0, 16);
            if (lastMinute && minute !== lastMinute && !(await attempt(enterPixels))) continue;
            lastMinute = minute;
            if (!(await showFrame(r, paint(r, clockCanvas(r, s), s, (Date.now() - colorStartedAt) / ANIM_MS)))) continue;
            await sleep(Math.max(0, ANIM_MS - (Date.now() - t0)));
        }
    } else if (s.mode === "clock") {
        let lastMinute = "";
        while (same()) {
            const minute = new Date().toISOString().slice(0, 16);
            if (minute !== lastMinute) {
                if (lastMinute && !(await attempt(enterPixels))) continue; // 每分鐘重送塗鴉燈效（燈斷電重開後自動恢復）
                if (await showFrame(r, clockCanvas(r, s))) lastMinute = minute;
            }
            await sleep(1000);
        }
    } else if (s.mode === "weather" || s.mode === "image" || s.mode === "face") { // 靜態畫面：每分鐘重送一次（燈重開後自動恢復）
        let lastMinute = "";
        while (same()) {
            const minute = new Date().toISOString().slice(0, 16);
            if (minute !== lastMinute) {
                if (lastMinute && !(await attempt(enterPixels))) continue;
                const canvas = s.mode === "face" ? r.picture(faceImage(s.face, s.orient))
                    : s.mode === "image" ? r.picture(s.image)
                    : weatherNow ? r.weather(weatherNow.icon, weatherNow.temp) : r.marquee("...")[0];
                if (await showFrame(r, canvas)) lastMinute = minute;
            }
            await sleep(1000);
        }
    } else if (s.mode === "text") {
        const base = textSteps(r, s);
        let t = 0;
        while (same()) {
            const steps = expandSteps(r, s, base, t);
            t += steps.reduce((total, [,ms]) => total + ms / ANIM_MS, 0);
            for (const [f, ms] of steps) {
                if (!same()) break;
                const t0 = Date.now();
                if (!(await showFrame(r, f))) break;
                const until = t0 + Math.max(ms, 200); // 分段睡，設定一改就能馬上換（靜止一頁會停 30 秒）
                while (same() && Date.now() < until) await sleep(Math.min(250, until - Date.now()));
            }
            if (same()) await attempt(enterPixels);
        }
    } else { // breathe / effect
        const startedAt = Date.now();
        const base = rgbOf(s.color) ?? [255, 160, 60];
        for (let t = 0; same(); t++) {
            const t0 = Date.now();
            const canvas = s.mode === "breathe"
                ? r.fill(() => dim(base, 0.08 + 0.92 * (0.5 - 0.5 * Math.cos(t * ANIM_MS / 4000 * 2 * Math.PI))))
                : effectFrame(r, s.effect, t, startedAt);
            if (!(await showFrame(r, canvas))) break;
            if (s.mode === "effect" && s.effect === "sleep" && Date.now() - startedAt >= 600e3) {
                await attempt(() => lamp.power(false));
                state = { ...state, mode: "off" }; saveState("漸暗結束，關燈");
                break;
            }
            await sleep(Math.max(0, ANIM_MS - (Date.now() - t0)));
        }
    }
}
