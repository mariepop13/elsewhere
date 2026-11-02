import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createWorldChatViewport } from './worldChatViewport'
import type { WorldChatDraft } from './worldNavigation.svelte'

let frames: Map<number, FrameRequestCallback>
let sequence: number
beforeEach(() => {
    frames = new Map(); sequence = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++sequence, callback); return sequence })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
})
afterEach(() => vi.unstubAllGlobals())
function flush() {
    for (let round = 0; frames.size && round < 12; round++) {
        const current = [...frames.values()]; frames.clear()
        current.forEach(callback => callback(0))
    }
}
function fixture(draft: WorldChatDraft = { text: '', translatedText: '', attachments: [] }) {
    let owns = true, growth = 0
    const element = { isConnected: true, clientHeight: 500, clientWidth: 320, scrollTop: 0,
        getBoundingClientRect: () => ({ top: 0, bottom: 500 }),
        querySelectorAll: () => [message],
    }
    const message = { dataset: { worldMessageId: 'id:stable-message' },
        getBoundingClientRect: () => ({ top: -200 + growth - element.scrollTop, bottom: 300 + growth - element.scrollTop }),
    }
    const restored = vi.fn()
    const viewport = createWorldChatViewport(element as unknown as HTMLElement, draft, () => owns, restored)
    viewport.setVisible(true); flush()
    return { draft, element, viewport, restored, replaceSave: () => { owns = false }, addHiddenMessages: () => { growth += 120 } }
}
it('preserves negative position and ignores scroll clamped to zero while hidden', () => {
    const f = fixture(); f.element.scrollTop = -220; f.viewport.capture()
    f.viewport.setVisible(false); f.element.clientHeight = 0; f.element.scrollTop = 0; f.viewport.capture()
    expect(f.draft.scrollTop).toBe(-220)
    f.element.clientHeight = 500; f.viewport.setVisible(true); flush()
    expect(f.element.scrollTop).toBe(-220)
})
it('keeps the same message anchor when hidden incoming messages change layout', () => {
    const f = fixture(); f.element.scrollTop = -220; f.viewport.setVisible(false)
    const offset = f.draft.scrollAnchor?.offset
    f.addHiddenMessages(); f.element.scrollTop = 0; f.viewport.setVisible(true); flush()
    expect(f.element.scrollTop).toBe(-100)
    f.viewport.capture(); expect(f.draft.scrollAnchor?.offset).toBe(offset)
})
it('follows latest messages when saved at the bottom instead of pinning an old anchor', () => {
    const f = fixture(); f.viewport.setVisible(false); f.addHiddenMessages()
    expect(f.draft.scrollAnchor).toBeUndefined()
    f.viewport.setVisible(true); flush(); expect(f.element.scrollTop).toBe(0)
})
it('does not write or restore an old viewport after save identity changes, even with identical IDs', () => {
    const f = fixture(); f.element.scrollTop = -220; f.viewport.setVisible(false)
    f.restored.mockClear(); f.element.scrollTop = 0; f.viewport.setVisible(true); f.replaceSave(); flush()
    expect(f.restored).not.toHaveBeenCalled()
    expect(f.element.scrollTop).toBe(0); expect(f.draft.scrollTop).toBe(-220)
    f.element.scrollTop = -80; f.viewport.capture(); expect(f.draft.scrollTop).toBe(-220)
})
it('keeps story and group drafts separate and cancels a disposed delayed restoration', () => {
    const first = fixture(); first.element.scrollTop = -220; first.viewport.setVisible(false)
    first.viewport.setVisible(true); first.viewport.dispose()
    const second = fixture({ text: 'Group draft', translatedText: '', attachments: [], scrollTop: -60 })
    flush(); expect(second.element.scrollTop).toBe(-60); expect(first.draft.scrollTop).toBe(-220)
    expect(second.draft.text).toBe('Group draft')
})
it('rapid hide/show invalidates old restoration callbacks and cannot save their zero', () => {
    const f = fixture(); f.element.scrollTop = -220; f.viewport.setVisible(false)
    f.element.scrollTop = 0; f.viewport.setVisible(true); expect(f.viewport.capture()).toBe(false); f.viewport.setVisible(false)
    flush(); expect(f.draft.scrollTop).toBe(-220)
    f.viewport.setVisible(true); flush(); expect(f.element.scrollTop).toBe(-220)
})
