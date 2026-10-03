import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sizeReviewEditor, type ReviewEditorSizing } from './reviewEditorSizing'

// happy-dom has no layout engine. These measured geometry fixtures exercise the
// action with browser-like resize notifications; they do not certify pixels.
let frames: Map<number, FrameRequestCallback>
let observers: SyntheticResizeObserver[]
let actions: ReturnType<typeof sizeReviewEditor>[]
class SyntheticResizeObserver {
    targets = new Set<Element>()
    disconnected = false
    constructor(private callback: ResizeObserverCallback) { observers.push(this) }
    observe(target: Element) { this.targets.add(target) }
    unobserve(target: Element) { this.targets.delete(target) }
    disconnect() { this.targets.clear(); this.disconnected = true }
    emit() { this.callback([], this as unknown as ResizeObserver) }
}
const rectangle = (width: number, height: number) => ({ x: 0, y: 0, top: 0, left: 0, bottom: height, right: width, width, height, toJSON() {} }) as DOMRect
function flush() { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(0)) }
beforeEach(() => {
    frames = new Map(); observers = []; actions = []; let serial = 0
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++serial, callback); return serial })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id) })
    vi.stubGlobal('ResizeObserver', SyntheticResizeObserver)
    vi.stubGlobal('innerWidth', 1200); vi.stubGlobal('innerHeight', 900)
    document.documentElement.style.fontSize = '16px'
})
afterEach(() => { actions.forEach(action => action.destroy()); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function fixture(sourceHeight = 512, contentHeight = 110, compact = false, outputOnly = false) {
    const row = document.createElement('div'); row.className = 'comparison'
    const source = document.createElement('pre'); source.dataset.reviewOriginal = ''; source.textContent = 'Synthetic original {{char}} and {{user}}.'
    const label = document.createElement('label'); const node = document.createElement('textarea'); label.append(node)
    if (!outputOnly) row.append(source); row.append(label); document.body.append(row)
    node.style.boxSizing = 'border-box'; node.style.minHeight = compact ? '56px' : '128px'; node.style.border = '1px solid'
    node.value = '{{char}}: Hello {{user}}.\nSecond line.'
    let width = 800, sourceSize = sourceHeight, textSize = contentHeight
    vi.spyOn(row, 'getBoundingClientRect').mockImplementation(() => rectangle(width, 600))
    vi.spyOn(source, 'getBoundingClientRect').mockImplementation(() => rectangle(width / 2, sourceSize))
    vi.spyOn(node, 'getBoundingClientRect').mockImplementation(() => rectangle(width / 2, Math.max(compact ? 56 : 128, parseFloat(node.style.height) || 110)))
    Object.defineProperty(node, 'scrollHeight', { configurable: true, get: () => textSize })
    let options: ReviewEditorSizing = { value: node.value, original: outputOnly ? null : source.textContent, compact, identity: {} }
    const action = sizeReviewEditor(node, options); actions.push(action)
    return { row, source, node, action, height: () => parseFloat(node.style.height), measure: (source: number, content: number, nextWidth = width) => { sourceSize = source; textSize = content; width = nextWidth }, update: (next = {}) => { options = { ...options, ...next }; action.update(options) }, notify: () => observers.forEach(observer => observer.emit()) }
}
describe('comparative review editor viewport', () => {
    it('aligns a short translation to the512px original from the reported layout', () => {
        const f = fixture(); flush(); expect(f.height()).toBe(512)
    })
    it('grows to its own longer content and caps very long dialogue without horizontal resizing', () => {
        const f = fixture(180, 340); flush(); expect(f.height()).toBe(342)
        f.measure(180, 9000); f.node.dispatchEvent(new Event('input')); flush(); expect(f.height()).toBe(512)
        expect(f.node.value).toContain('{{char}}'); expect(f.node.value).toContain('{{user}}')
    })
    it('keeps empty prose useful and short names compact', () => {
        const prose = fixture(35, 24); prose.node.value = ''; flush(); expect(prose.height()).toBe(128)
        const name = fixture(35, 24, true); flush(); expect(name.height()).toBe(56)
    })
    it('sizes new generated output without an original', () => {
        const f = fixture(512, 260, false, true); flush(); expect(f.height()).toBe(262)
    })
    it('does not change text, focus, selected macros or scroll position when remeasuring', () => {
        const f = fixture(); f.node.focus(); f.node.setSelectionRange(0, 8, 'forward'); f.node.scrollTop = 37
        const text = f.node.value; flush(); f.measure(350, 300); f.notify(); flush()
        expect(f.node.value).toBe(text); expect(document.activeElement).toBe(f.node)
        expect([f.node.selectionStart, f.node.selectionEnd, f.node.selectionDirection]).toEqual([0, 8, 'forward']); expect(f.node.scrollTop).toBe(37)
    })
    it('preserves a manual resize during editing and resets it for a newly loaded result', () => {
        const f = fixture(); flush(); f.node.style.height = '240px'; f.notify()
        f.node.value += '\nEdited'; f.update({ value: f.node.value }); flush(); expect(f.height()).toBe(240)
        f.update({ identity: {} }); flush(); expect(f.height()).toBe(512)
    })
    it('retains manual sizing at the next input without ResizeObserver, but resets for another result', () => {
        vi.stubGlobal('ResizeObserver', undefined)
        const f = fixture(); flush(); f.node.style.height = '240px'; f.node.dispatchEvent(new Event('input')); flush(); expect(f.height()).toBe(240)
        f.node.style.height = '320px'; f.node.dispatchEvent(new Event('input')); flush(); expect(f.height()).toBe(320)
        f.update({ identity: {} }); flush(); expect(f.height()).toBe(512)
    })
    it('reacts to narrower columns and changed original content', () => {
        const f = fixture(160, 140); flush(); f.measure(420, 200, 500); f.notify(); flush(); expect(f.height()).toBe(420)
        f.measure(220, 180, 500); f.notify(); flush(); expect(f.height()).toBe(220)
    })
    it('bounds mobile automatic sizing and manual sizing to viewport height', () => {
        vi.stubGlobal('innerWidth', 390); vi.stubGlobal('innerHeight', 700)
        const f = fixture(512, 600); flush(); expect(f.height()).toBe(420)
        f.node.style.height = '900px'; f.notify(); f.update(); flush(); expect(f.height()).toBe(595)
        vi.stubGlobal('innerHeight', 400); window.dispatchEvent(new Event('resize')); flush(); expect(f.height()).toBe(340)
    })
    it('handles small landscape viewports without shrinking below the usable minimum', () => {
        vi.stubGlobal('innerWidth', 500); vi.stubGlobal('innerHeight', 150)
        const f = fixture(); flush(); expect(f.height()).toBe(128)
    })
    it('tracks removal of the original when switching to output-only review', () => {
        const f = fixture(512, 210); flush(); f.source.remove(); f.update({ original: null, identity: {} }); flush()
        expect(f.height()).toBe(212); expect(observers[0].targets.has(f.source)).toBe(false)
    })
    it('cleans pending frames and listeners on close; repeated edits coalesce', () => {
        const f = fixture(); f.update(); f.node.dispatchEvent(new Event('input')); expect(frames.size).toBe(1)
        f.action.destroy(); expect(frames.size).toBe(0); expect(observers[0].disconnected).toBe(true)
        f.node.dispatchEvent(new Event('input')); window.dispatchEvent(new Event('resize')); expect(frames.size).toBe(0)
    })
})
