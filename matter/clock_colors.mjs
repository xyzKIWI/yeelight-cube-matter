// 呼吸與閃亮保留小時／分鐘的原始雙色，漸層效果才使用白色遮罩。
const rgb = hex => hex ? [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) : null;
export const keepsClockPalette = fx => [undefined, 'fixed', 'pulse', 'sparkle'].includes(fx);
export function clockCanvas(r, settings, date = new Date()) {
    return keepsClockPalette(settings.colorFx)
        ? r.clock(date, rgb(settings.color), rgb(settings.color2))
        : r.clock(date, [255, 255, 255], [255, 255, 255]);
}
export function clockPixelAccent(pixel, effect, phase, sparkles = false) {
    if (!pixel.some(Boolean)) return pixel;
    if (effect === 'pulse') {
        const brightness = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(phase * 0.5));
        return pixel.map(c => Math.round(c * brightness));
    }
    return effect === 'sparkle' && sparkles ? [255, 255, 255] : pixel;
}
