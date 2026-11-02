import { describe, expect, it } from 'vitest'
import { actionInk, type ThemeRgb } from './themeContrast'

const rgb = (hex: string): ThemeRgb => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16)) as unknown as ThemeRgb

describe('native accent button foreground', () => {
    it('retains the light native text for the original violet fill', () => {
        expect(actionInk(rgb('#6D5DFB'), rgb('#0A0B1D'), rgb('#F5F7FF'))).toBe('text')
    })
    it.each([
        ['galaxy', '#8BE9FD', '#0F172A', '#F8F8F2'],
        ['ocean', '#38BDF8', '#0B1F2A', '#E6F6FB'],
        ['aurora', '#5EEAD4', '#10201C', '#ECFDF5'],
    ])('uses the native dark canvas on the light %s accent', (_name, accent, canvas, text) => {
        expect(actionInk(rgb(accent), rgb(canvas), rgb(text))).toBe('canvas')
    })
    it('uses the light canvas for a dark accent in a native light theme', () => {
        expect(actionInk(rgb('#0F172A'), rgb('#FFFFFF'), rgb('#0F172A'))).toBe('canvas')
    })
    it('falls back to black when both configured inks are unreadable on a light fill', () => {
        expect(actionInk(rgb('#EEEEEE'), rgb('#FFFFFF'), rgb('#DDDDDD'))).toBe('black')
    })
    it('falls back to white when both configured inks are unreadable on a dark fill', () => {
        expect(actionInk(rgb('#222222'), rgb('#111111'), rgb('#333333'))).toBe('white')
    })
})
