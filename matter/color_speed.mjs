// 調整相位速度，不增加 Matter 指令頻率。
export const DEFAULT_COLOR_SPEED = 0.35;
export function normalizeColorSpeed(value = DEFAULT_COLOR_SPEED) {
    const speed = Number(value);
    if (!Number.isFinite(speed)) throw new Error("顏色速度需為數字");
    return Math.max(0.1, Math.min(1.5, speed));
}
export const colorPhase = (ticks, speed) => ticks * normalizeColorSpeed(speed);
