import { afterEach, describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import Harness from '../../test/fixtures/tokenBudgetControlHarness.svelte'

let component: ReturnType<typeof mount>
afterEach(async () => { if (component) await unmount(component); document.body.innerHTML = '' })
function render(props = {}) {
    component = mount(Harness, { target: document.body, props })
    flushSync()
}
function input(type: string) { return document.querySelector<HTMLInputElement>(`input[type="${type}"]`)! }
function act(fn: () => void) { flushSync(fn) }
function saved() { return document.querySelector('output')!.textContent }

describe('precise token slider', () => {
    it('exposes a native step-one labelled range and exact numeric editing', () => {
        render()
        const range = input('range')
        expect(range.min).toBe('1'); expect(range.max).toBe('128000'); expect(range.step).toBe('1')
        expect(range.getAttribute('aria-label')).toBe('Token budget slider')
        act(() => { range.value = '8193'; range.dispatchEvent(new Event('input', { bubbles: true })) })
        expect(saved()).toBe('8193'); expect(input('number').value).toBe('8193')
        act(() => { input('number').value = '4097'; input('number').dispatchEvent(new Event('input', { bubbles: true })) })
        expect(range.value).toBe('4097'); expect(saved()).toBe('4097')
    })
    it('preserves an invalid saved budget across model changes and enables explicit correction', () => {
        render({ initial: 200000 })
        expect(input('range').disabled).toBe(true); expect(input('number').value).toBe('200000')
        act(() => { Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Smaller model')!.click() })
        expect(saved()).toBe('200000'); expect(input('range').max).toBe('1024')
        act(() => { input('number').value = '500'; input('number').dispatchEvent(new Event('input', { bubbles: true })) })
        expect(input('range').disabled).toBe(false); expect(saved()).toBe('500')
    })
    it('keeps an exact saved value and removes the slider for unknown metadata', () => {
        render({ initial: 8193 })
        act(() => { Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Unknown model')!.click() })
        expect(document.querySelector('input[type="range"]')).toBeNull()
        expect(input('number').value).toBe('8193'); expect(saved()).toBe('8193')
        expect(document.body.textContent).toContain('Unknown maximum')
    })
    it('distinguishes a valid single-value interval from an invalid saved value', () => {
        render({ initial: 1024, ceiling: 1024, minimum: 1024 })
        expect(document.querySelector('input[type="range"]')).toBeNull()
        expect(input('number').getAttribute('aria-invalid')).toBe('false')
        expect(document.body.textContent).toContain('Only one valid budget')
        act(() => { input('number').value = '4096'; input('number').dispatchEvent(new Event('input', { bubbles: true })) })
        expect(saved()).toBe('4096'); expect(input('number').getAttribute('aria-invalid')).toBe('true')
        expect(document.body.textContent).toContain('Saved value preserved')
    })
    it('marks numeric invalidity even when model metadata is unknown', () => {
        render({ initial: 3.5 })
        act(() => { Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Unknown model')!.click() })
        expect(input('number').getAttribute('aria-invalid')).toBe('true'); expect(saved()).toBe('3.5')
        act(() => { input('number').value = '0'; input('number').dispatchEvent(new Event('input', { bubbles: true })) })
        expect(input('number').getAttribute('aria-invalid')).toBe('true'); expect(saved()).toBe('0')
    })
    it('preserves disabled reasoning' , () => {
        render({ initial: -1000, ceiling: 24576, minimum: -1, disabled: true })
        expect(input('range').disabled).toBe(true); expect(input('number').disabled).toBe(true)
        expect(saved()).toBe('-1000')
    })
    it('accepts the reasoning sentinel and rejects fractions without rounding saved input', () => {
        render({ initial: -1, ceiling: 24576, minimum: -1 })
        expect(input('range').disabled).toBe(false)
        act(() => { input('number').value = '3.5'; input('number').dispatchEvent(new Event('input', { bubbles: true })) })
        expect(saved()).toBe('3.5'); expect(input('range').disabled).toBe(true)
    })
})
