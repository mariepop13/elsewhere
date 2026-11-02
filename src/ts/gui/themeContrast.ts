export type ThemeRgb = readonly [number, number, number]
export type ActionInk = 'text' | 'canvas' | 'black' | 'white'

function luminance(rgb: ThemeRgb): number {
    const channels = rgb.map(channel => {
        const value = channel / 255
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function ratio(first: number, second: number): number {
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

/** Match the shared CSS button fill: 92% native accent, 8% native canvas. */
export function actionInk(accent: ThemeRgb, canvas: ThemeRgb, text: ThemeRgb): ActionInk {
    const fill = luminance([
        accent[0] * 0.92 + canvas[0] * 0.08,
        accent[1] * 0.92 + canvas[1] * 0.08,
        accent[2] * 0.92 + canvas[2] * 0.08,
    ])
    const textRatio = ratio(fill, luminance(text))
    const canvasRatio = ratio(fill, luminance(canvas))
    if (Math.max(textRatio, canvasRatio) >= 4.5) return textRatio >= canvasRatio ? 'text' : 'canvas'
    return ratio(fill, 0) >= ratio(fill, 1) ? 'black' : 'white'
}
