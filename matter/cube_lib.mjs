// Yeelight Cube（Matter，4 塊 5x5 點陣直疊）共用模組：繪圖、方向對應、Matter 連線。
//
// 協定（2026-11-24 拆 Android 版＋實測）：Matter 端點 2、cluster 0x1312FC03；
//   setEffect(0x13120000) {0:{0:36,1:0},1:true} → 切到塗鴉燈效 36；
//   setData(0x13120007) {0: octstr} → 4 塊×25 顆×[A,R,G,B]。
// 實體排列：第 0 塊接底座；每塊從右下角編號 0，沿最下排往左，再往上一排。
import "@matter/nodejs";
import { Environment, Bytes } from "@matter/general";
import { ServerNode, ControllerBehavior, NetworkClient } from "@matter/node";
import { Invoke, Read } from "@matter/protocol";
import { NodeId, TlvAny } from "@matter/types";

export const W = 5, H = 20, MODULES = 4; // 實體座標：燈直放時寬 5、高 20
export const ORIENTS = ["up", "left", "right", "down"];
const CLUSTER = 0x1312fc03, CMD_SET_EFFECT = 0x13120000, CMD_SET_DATA = 0x13120007, ENDPOINT = 2;
const LAMP_NODE = 4242n;

const FONT = {
    "0": ["01110", "10001", "10001", "10001", "01110"], "1": ["00100", "01100", "00100", "00100", "01110"],
    "2": ["11110", "00001", "01110", "10000", "11111"], "3": ["11110", "00001", "00110", "00001", "11110"],
    "4": ["10010", "10010", "11111", "00010", "00010"], "5": ["11111", "10000", "11110", "00001", "11110"],
    "6": ["01110", "10000", "11110", "10001", "01110"], "7": ["11111", "00001", "00010", "00100", "00100"],
    "8": ["01110", "10001", "01110", "10001", "01110"], "9": ["01110", "10001", "01111", "00001", "01110"],
    A: ["01110", "10001", "11111", "10001", "10001"], B: ["11110", "10001", "11110", "10001", "11110"],
    C: ["01111", "10000", "10000", "10000", "01111"], D: ["11110", "10001", "10001", "10001", "11110"],
    E: ["11111", "10000", "11110", "10000", "11111"], F: ["11111", "10000", "11110", "10000", "10000"],
    G: ["01111", "10000", "10011", "10001", "01111"], H: ["10001", "10001", "11111", "10001", "10001"],
    I: ["01110", "00100", "00100", "00100", "01110"], J: ["00111", "00010", "00010", "10010", "01100"],
    K: ["10010", "10100", "11000", "10100", "10010"], L: ["10000", "10000", "10000", "10000", "11111"],
    M: ["10001", "11011", "10101", "10001", "10001"], N: ["10001", "11001", "10101", "10011", "10001"],
    O: ["01110", "10001", "10001", "10001", "01110"], P: ["11110", "10001", "11110", "10000", "10000"],
    Q: ["01110", "10001", "10101", "10010", "01101"], R: ["11110", "10001", "11110", "10100", "10010"],
    S: ["01111", "10000", "01110", "00001", "11110"], T: ["11111", "00100", "00100", "00100", "00100"],
    U: ["10001", "10001", "10001", "10001", "01110"], V: ["10001", "10001", "10001", "01010", "00100"],
    W: ["10001", "10001", "10101", "11011", "10001"], X: ["10001", "01010", "00100", "01010", "10001"],
    Y: ["10001", "01010", "00100", "00100", "00100"], Z: ["11111", "00010", "00100", "01000", "11111"],
    " ": ["00000", "00000", "00000", "00000", "00000"], "!": ["00100", "00100", "00100", "00000", "00100"],
    "?": ["01110", "00001", "00110", "00000", "00100"], "-": ["00000", "00000", "01110", "00000", "00000"],
    ".": ["00000", "00000", "00000", "00000", "00100"], ":": ["00000", "00100", "00000", "00100", "00000"],
    "+": ["00000", "00100", "01110", "00100", "00000"], "<": ["00010", "00100", "01000", "00100", "00010"],
    ">": ["01000", "00100", "00010", "00100", "01000"], "/": ["00001", "00010", "00100", "01000", "10000"],
    "♥": ["01010", "11111", "11111", "01110", "00100"],
};
// 天氣圖示（5x5）與顏色
export const WEATHER_ICONS = {
    sun: { rows: ["10101", "01110", "11111", "01110", "10101"], color: [255, 200, 0] },
    moon: { rows: ["01110", "11100", "11000", "11100", "01110"], color: [255, 230, 140] },
    partly: { rows: ["10100", "01110", "01110", "11111", "00000"], color: [255, 210, 90] },
    cloud: { rows: ["00000", "01100", "11110", "11111", "00000"], color: [200, 200, 210] },
    fog: { rows: ["11111", "00000", "11111", "00000", "11111"], color: [150, 150, 160] },
    rain: { rows: ["01100", "11110", "11111", "01010", "10100"], color: [40, 120, 255] },
    snow: { rows: ["10101", "01010", "10101", "01010", "10101"], color: [220, 240, 255] },
    thunder: { rows: ["01110", "11111", "00100", "01000", "10000"], color: [255, 220, 0] },
};
export const SUPPORTED_CHARS = Object.keys(FONT).join("");
const glyph = ch => FONT[ch.toUpperCase()] ?? FONT["?"];
/** 色相 h（0–1，飽和、全亮）→ [r,g,b] */
export const hsv = h => { const f = n => { const k = (n + h * 6) % 6; return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1)))); }; return [f(5), f(3), f(1)]; };
/** 色溫 K → 近似 [r,g,b]（Tanner Helland 近似式） */
export function kelvinToRgb(k) {
    const t = Math.min(6500, Math.max(1700, k)) / 100;
    const clamp = v => Math.round(Math.min(255, Math.max(0, v)));
    const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
    const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
    const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    return [clamp(r), clamp(g), clamp(b)];
}
/** 顏色乘上亮度（0–1） */
export const dim = ([r, g, b], f) => [Math.round(r * f), Math.round(g * f), Math.round(b * f)];

/** 依擺放方向建立繪圖器。眼睛看到的畫布 canvas[ly][lx]，ly=0 最上、lx=0 最左。 */
export function renderer(orient = "up") {
    if (!ORIENTS.includes(orient)) throw new Error(`方向只能是 ${ORIENTS.join("/")}，收到 ${orient}`);
    const wide = orient === "left" || orient === "right";
    const LW = wide ? H : W, LH = wide ? W : H;
    const toPhysical = (lx, ly) => { // → 燈直放時的實體 (px, py)，py=0 是燈頂
        switch (orient) {
            case "left": return [ly, H - 1 - lx];  // 底座在左：燈頂朝右
            case "right": return [W - 1 - ly, lx]; // 底座在右：燈頂朝左
            case "down": return [W - 1 - lx, H - 1 - ly];
            default: return [lx, ly];
        }
    };
    const blank = () => Array.from({ length: LH }, () => Array.from({ length: LW }, () => [0, 0, 0]));
    const draw = (canvas, ch, left, top, color) => glyph(ch).forEach((row, dy) => {
        const y = top + dy;
        if (y < 0 || y >= LH) return;
        [...row].forEach((bit, dx) => { const x = left + dx; if (bit === "1" && x >= 0 && x < LW) canvas[y][x] = color; });
    });
    const encode = canvas => {
        const out = new Uint8Array(MODULES * 25 * 4);
        for (let ly = 0; ly < LH; ly++) for (let lx = 0; lx < LW; lx++) {
            const [px, py] = toPhysical(lx, ly);
            const fromBottom = H - 1 - py;
            const index = (fromBottom % 5) * 5 + (W - 1 - px);
            out.set([255, ...canvas[ly][lx]], (Math.floor(fromBottom / 5) * 25 + index) * 4);
        }
        return out;
    };
    // color：[r,g,b] 指定單色；不給就用預設（時鐘橘＋藍、跑馬燈彩虹）
    const clock = (now = new Date(), color = null, color2 = null) => { // color2：分鐘的顏色（雙色）
        const t = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", "");
        const c = blank();
        const m = color2 ?? color;
        const colors = color ? [color, color, m, m] : [[255, 140, 0], [255, 140, 0], [0, 170, 255], [0, 170, 255]]; // 預設 時：橘，分：藍
        [...t].forEach((d, i) => draw(c, d, wide ? i * 5 : 0, wide ? 0 : i * 5, colors[i]));
        return c;
    };
    // 四個字元直接排四格（倒數 MMSS 用）；colors＝每格一色
    const digits = (str, colors) => {
        const c = blank();
        [...str].slice(0, 4).forEach((d, i) => draw(c, d, wide ? i * 5 : 0, wide ? 0 : i * 5, colors[i]));
        return c;
    };
    const marquee = (text, color = null) => {
        const chars = [...text];
        const span = wide ? LW : LH;
        return Array.from({ length: chars.length * 6 + span }, (_, off) => { // 每字 5 格＋1 格間距，尾端留一屏空白
            const c = blank();
            chars.forEach((ch, i) => {
                const pos = span - off + i * 6; // 直放由下往上捲、橫放由右往左捲
                draw(c, ch, wide ? pos : 0, wide ? 0 : pos, color ?? hsv((i / Math.max(chars.length, 1)) % 1));
            });
            return c;
        });
    };
    /** 靜態文字：最多 4 個字，每塊方塊一個字（直放由上往下、橫放由左往右），回傳每 4 字一頁的畫面清單 */
    const staticPages = (text, color = null) => {
        const chars = [...text];
        const pages = [];
        for (let p = 0; p < Math.max(1, Math.ceil(chars.length / 4)); p++) {
            const c = blank();
            chars.slice(p * 4, p * 4 + 4).forEach((ch, i) =>
                draw(c, ch, wide ? i * 5 : 0, wide ? 0 : i * 5, color ?? hsv(((p * 4 + i) / Math.max(chars.length, 1)) % 1)));
            pages.push(c);
        }
        return pages;
    };
    /** 整面填色；fn(lx, ly) 回傳每點顏色 */
    const fill = fn => Array.from({ length: LH }, (_, ly) => Array.from({ length: LW }, (_, lx) => fn(lx, ly)));
    /** 天氣：圖示＋兩位數溫度＋「C」，直放由上往下、橫放由左往右 */
    const weather = (iconName, tempC) => {
        const c = blank();
        const icon = WEATHER_ICONS[iconName] ?? WEATHER_ICONS.cloud;
        const t = Math.round(tempC);
        const tc = t >= 30 ? [255, 70, 40] : t >= 25 ? [255, 150, 0] : t >= 18 ? [80, 220, 120] : [60, 160, 255];
        const digits = t < 0 ? ["-", String(Math.min(9, -t))] : String(Math.min(99, t)).padStart(2, " ").split("");
        const cells = [{ rows: icon.rows, color: icon.color }, ...digits.map(d => ({ rows: glyph(d), color: tc })), { rows: glyph("C"), color: [150, 150, 150] }];
        cells.forEach((cell, i) => cell.rows.forEach((row, dy) => [...row].forEach((bit, dx) => {
            if (bit !== "1") return;
            const x = (wide ? i * 5 : 0) + dx, y = (wide ? 0 : i * 5) + dy;
            if (x < LW && y < LH) c[y][x] = cell.color;
        })));
        return c;
    };
    /** 像素畫：image = {w, h, pixels:["#rrggbb", ...]}；方向不同時自動轉 90 度 */
    const picture = image => {
        const { w, h, pixels } = image;
        const at = (x, y) => { const hex = pixels[y * w + x] ?? "#000000"; return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); };
        if (w === LW && h === LH) return fill((x, y) => at(x, y));
        if (w === LH && h === LW) return fill((x, y) => at(y, h - 1 - x)); // 轉 90 度
        return fill(() => [0, 0, 0]);
    };
    return { orient, wide, LW, LH, toPhysical, blank, encode, clock, digits, marquee, staticPages, fill, weather, picture };
}

// ---- Matter ----
function octetField(data) { // TLV {0: octstr}
    const len = data.length;
    const head = len < 256 ? "153000" + len.toString(16).padStart(2, "0")
        : "153100" + (len & 0xff).toString(16).padStart(2, "0") + (len >> 8).toString(16).padStart(2, "0");
    return head + Bytes.toHex(data) + "18";
}

/** 連到已配對的燈；憑證位置由 MATTER_STORAGE_PATH 決定（預設 ~/.matter-yeelight 由呼叫端設定）。 */
export async function connectLamp() {
    const env = new Environment("shell-0", Environment.default);
    const node = await ServerNode.create(ServerNode.RootEndpointWithoutGroupcast.with(ControllerBehavior), {
        environment: env, id: "shell-0",
        network: { ble: false, tcp: true, autoStartCommissionedPeers: false },
        basicInformation: { productName: "matter.js Shell" },
        controller: { adminFabricLabel: "matter.js Shell", ble: false },
        commissioning: { enabled: false }, subscriptions: { persistenceEnabled: false },
    });
    await node.start();
    const peer = node.peers.commissioned.find(p => p.peerAddress?.nodeId === NodeId(LAMP_NODE));
    if (!peer) throw new Error("燈（node 4242）尚未配對到這台機器");
    await peer.setStateOf(NetworkClient, { autoSubscribe: false });
    if (peer.stateOf(NetworkClient).isDisabled) await peer.enable(); else await peer.start();

    const invoke = async (commandId, fieldsHex, endpoint = ENDPOINT, clusterId = CLUSTER) => {
        const schema = { validate() {}, encodeTlv() { return TlvAny.decode(Bytes.fromHex(fieldsHex)); } };
        const command = { requestId: commandId, requestSchema: schema, responseId: commandId, responseSchema: TlvAny, timed: false };
        const req = Invoke({ endpoint, cluster: { id: clusterId, name: `cluster${clusterId}` }, command, skipValidation: true });
        let ok = false;
        for await (const chunk of peer.interaction.invoke(req)) {
            for (const entry of chunk) {
                if (entry.kind === "cmd-status" && entry.status !== 0) throw new Error(`燈回錯誤 status ${entry.status}`);
                ok = true;
            }
        }
        if (!ok) throw new Error("燈沒有回應");
    };
    return {
        enterGraffiti: () => invoke(CMD_SET_EFFECT, "153500240024240100182901" + "18"),
        show: bytes => invoke(CMD_SET_DATA, octetField(bytes)),
        // Matter 標準 OnOff（端點 1、cluster 6）：指令 0＝關、1＝開，無參數
        power: on => invoke(on ? 1 : 0, "1518", 1, 0x0006),
        invoke,
        /** 讀標準屬性：paths = [[endpoint, cluster, attribute], ...] → { "ep/cluster/attr": 值 } */
        read: async paths => {
            const req = Read({ attributes: paths.map(([endpointId, clusterId, attributeId]) => ({ endpointId, clusterId, attributeId })) });
            const out = {};
            for await (const chunk of peer.interaction.read(req)) {
                for (const e of chunk) {
                    if (e.kind !== "attr-value") continue;
                    const { endpointId, clusterId, attributeId } = e.path;
                    let v = e.value;
                    if (Array.isArray(v) && v.length === 1 && v[0]?.typeLength) v = v[0].value; // 原始 TLV 元素 → 值
                    out[`${endpointId}/${clusterId}/${attributeId}`] = typeof v === "bigint" ? Number(v) : v;
                }
            }
            return out;
        },
        close: () => node.close(),
    };
}
