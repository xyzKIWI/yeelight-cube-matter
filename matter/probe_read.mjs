// 除錯用：讀燈的標準屬性（開關、亮度、色彩模式、色相、飽和度、色溫）。常駐程式要先停掉才能跑。
import { connectLamp } from "./cube_lib.mjs";
const lamp = await connectLamp();
let code = 0;
try {
    const v = await lamp.read([[1, 6, 0], [1, 8, 0], [1, 0x300, 8], [1, 0x300, 0], [1, 0x300, 1], [1, 0x300, 7]]);
    console.log("READ", JSON.stringify(v, (k, x) => (typeof x === "bigint" ? Number(x) : x)));
} catch (e) { console.log("ERROR", e?.message ?? e); code = 1; }
await lamp.close();
process.exit(code);
