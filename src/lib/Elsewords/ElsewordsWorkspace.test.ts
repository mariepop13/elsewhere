import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushSync, mount, tick, unmount } from 'svelte'
import Workspace from './ElsewordsWorkspace.svelte'
import { ElsewordsSession } from '../../ts/elsewords/session.svelte'
import { createOutputReview } from '../../ts/elsewords/cardCore.js'

const fixtureState = vi.hoisted(() => ({ session: null as any }))
vi.mock('../../ts/elsewords/entry', async () => {
    const { writable } = await import('svelte/store')
    return { elsewordsOpen: writable(true), takeElsewordsSession: () => fixtureState.session, suspendElsewordsSession: vi.fn() }
})
vi.mock('../../ts/elsewords/host', () => ({ elsewordsHost: {} }))
vi.mock('../../ts/stores.svelte', async () => {
    const { writable } = await import('svelte/store')
    return { SettingsMenuIndex: writable(0), settingsOpen: writable(false), alertStore: writable({ type: 'none' }) }
})
let component: ReturnType<typeof mount> | undefined
let host: { request: ReturnType<typeof vi.fn>; setCharacter: ReturnType<typeof vi.fn> }
let frames: Map<number, FrameRequestCallback>
const rect = (height: number, width = 400) => ({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, height, width, toJSON() {} }) as DOMRect
function runFrames() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(0)) }
const original = { spec: 'chara_card_v3', spec_version: '3.0', data: { name: 'Synthetic librarian', description: 'A fictional library.', personality: 'Patient.', scenario: 'A garden.', first_mes: 'Hello {{user}}.', mes_example: '<START>\n{{char}} greets {{user}}.\n'+ 'Synthetic dialogue without private content.\n'.repeat(35), creator_notes: '' } }
function populate() {
    const output = structuredClone(original); output.data.mes_example = '<START>\n{{char}} greets {{user}}.\nTranslated dialogue.'
    const session = fixtureState.session as ElsewordsSession
    session.output = output; session.reviewBase = output; session.card = original; session.origin = 'imported'; session.resultKind = 'translation'; session.review = createOutputReview(output, original)
}
beforeEach(() => {
    frames = new Map(); let serial = 0
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++serial, callback); return serial })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id) })
    vi.stubGlobal('innerWidth', 1200); vi.stubGlobal('innerHeight', 900)
    document.documentElement.style.fontSize = '16px'
    host = { request: vi.fn(), setCharacter: vi.fn() }
    fixtureState.session = new ElsewordsSession(host as any, localStorage)
    populate()
})
afterEach(async () => { if (component) await unmount(component); component = undefined; document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function render() {
    component = mount(Workspace, { target: document.body }); flushSync(); await tick()
    for (const row of document.querySelectorAll<HTMLElement>('.comparison')) {
        const node = row.querySelector<HTMLTextAreaElement>('textarea')!, source = row.querySelector<HTMLElement>('[data-review-original]')!
        const example = node.getAttribute('aria-label') === 'Edit Example messages'
        node.style.minHeight = node.classList.contains('compact') ? '56px' : '128px'; node.style.border = '1px solid'; node.style.boxSizing = 'border-box'
        vi.spyOn(row, 'getBoundingClientRect').mockImplementation(() => rect(600, 820))
        vi.spyOn(source, 'getBoundingClientRect').mockImplementation(() => rect(example ? 512 : 100))
        vi.spyOn(node, 'getBoundingClientRect').mockImplementation(() => rect(Math.max(parseFloat(node.style.minHeight), parseFloat(node.style.height) || 110)))
        Object.defineProperty(node, 'scrollHeight', { configurable: true, get: () => 110 })
    }
    runFrames()
}
function editor() { return document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Edit Example messages"]')! }
describe('native comparative editor wiring', () => {
    it('sizes every comparative textarea and matches the long original example', async () => {
        await render(); expect(editor().style.height).toBe('512px')
        for (const node of document.querySelectorAll<HTMLTextAreaElement>('.comparison textarea')) expect(parseFloat(node.style.height)).toBeGreaterThanOrEqual(node.classList.contains('compact') ? 56 : 128)
    })
    it('keeps the bound draft, selection and focus while resizing and cancelling edits', async () => {
        await render(); const node = editor(), session = fixtureState.session as ElsewordsSession
        const untouched = JSON.stringify(original); node.focus()
        const value = '<START>\n{{char}}: Edited message for {{user}}.'
        flushSync(() => { node.value = value; node.setSelectionRange(8, 16); node.dispatchEvent(new Event('input', { bubbles: true })) }); runFrames()
        expect(session.review.find(field => field.path[0] === 'mes_example')?.draft).toBe(value)
        expect(node.value).toBe(value); expect(document.activeElement).toBe(node); expect([node.selectionStart, node.selectionEnd]).toEqual([8, 16]); expect(JSON.stringify(original)).toBe(untouched)
        flushSync(() => session.cancelEdits()); runFrames(); expect(editor()).toBe(node); expect(node.value).toContain('Translated dialogue')
        expect(host.request).not.toHaveBeenCalled(); expect(host.setCharacter).not.toHaveBeenCalled()
    })
    it('reuses the focused editor when review is reloaded, then bounds it on mobile', async () => {
        await render(); const node = editor(); node.focus()
        flushSync(populate); runFrames(); expect(editor()).toBe(node); expect(document.activeElement).toBe(node)
        vi.stubGlobal('innerWidth', 390); vi.stubGlobal('innerHeight', 700); window.dispatchEvent(new Event('resize')); runFrames(); expect(node.style.height).toBe('420px')
    })
})
