// CubeLight 像素顯示（指令列版）：時鐘、跑馬燈。常駐版見 cube_daemon.mjs。
//
// 用法：
//   MATTER_STORAGE_PATH=~/.matter-yeelight node cube_pixels.mjs clock
//   MATTER_STORAGE_PATH=~/.matter-yeelight node cube_pixels.mjs text "HELLO WORLD" [每格毫秒,預設150]
//   node cube_pixels.mjs selftest        # 不連線：檢查四種方向對應並印出時鐘畫面
//   擺放方向用環境變數 CUBE_ORIENT：up（直放，預設）、left（底座在左）、right（底座在右）、down（倒放）。
import { renderer, connectLamp, ORIENTS, W, H, MODULES } from "./cube_lib.mjs";

const sleep = ms => new Promise(r => setTimeout(r, ms));
const [mode = "clock", arg, stepArg] = process.argv.slice(2);

if (mode === "selftest") {
    for (const o of process.env.CUBE_ORIENT ? [process.env.CUBE_ORIENT] : ORIENTS) {
        const r = renderer(o);
        const seen = new Set();
        for (let ly = 0; ly < r.LH; ly++) for (let lx = 0; lx < r.LW; lx++) {
            const [px, py] = r.toPhysical(lx, ly);
            if (px < 0 || px >= W || py < 0 || py >= H) throw new Error(`${o}: 超出範圍 ${lx},${ly}`);
            seen.add(`${px},${py}`);
        }
        if (seen.size !== W * H) throw new Error(`${o}: 對應不是一對一 ${seen.size}/${W * H}`);
        const frame = r.clock(new Date("2026-11-24T12:52:00Z"));
        if (r.encode(frame).length !== MODULES * 25 * 4) throw new Error(`${o}: 位元組長度錯誤`);
        console.log(`orient=${o} canvas=${r.LW}x${r.LH} OK`);
        console.log(frame.map(row => row.map(([a, b, c]) => (a || b || c ? "#" : ".")).join("")).join("\n") + "\n");
    }
    process.exit(0);
}

const r = renderer(process.env.CUBE_ORIENT ?? "up");
const lamp = await connectLamp();
let stop = false;
process.on("SIGINT", () => { stop = true; });
process.on("SIGTERM", () => { stop = true; });
let exitCode = 0;
try {
    await lamp.enterGraffiti();
    if (mode === "clock") {
        let last = "";
        while (!stop) {
            const key = new Date().toISOString().slice(0, 16);
            if (key !== last) {
                await lamp.show(r.encode(r.clock()));
                last = key;
                console.log("clock", new Date().toLocaleTimeString("zh-TW", { timeZone: "Asia/Taipei" }));
            }
            await sleep(1000);
        }
    } else if (mode === "text") {
        const frames = r.marquee(arg ?? "HELLO");
        const step = Number(stepArg ?? 150);
        while (!stop) {
            for (const f of frames) {
                if (stop) break;
                const t0 = Date.now();
                await lamp.show(r.encode(f));
                await sleep(Math.max(0, step - (Date.now() - t0)));
            }
        }
    } else {
        throw new Error(`未知模式 ${mode}（可用 clock、text、selftest）`);
    }
} catch (e) {
    console.error("ERROR", e?.message ?? e);
    exitCode = 1;
}
await lamp.close();
process.exit(exitCode);
