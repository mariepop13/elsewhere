import { afterEach, describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import Fixture from './WorldDialogFixture.svelte'
let component: ReturnType<typeof mount>
afterEach(async () => { if (component) await unmount(component); document.body.innerHTML = '' })
function render() { component = mount(Fixture, { target: document.body }); flushSync() }
function open() { document.querySelector<HTMLButtonElement>('button')!.click(); flushSync() }
function dialog() { return document.querySelector<HTMLDialogElement>('dialog')! }
describe('World native action disclosure', () => {
    it('returns focus to the opener when closing', () => {
        render()
        const trigger = document.querySelector<HTMLButtonElement>('button')!
        Object.defineProperty(trigger, 'getClientRects', { value: () => [{ width: 44, height: 44 }] })
        trigger.focus(); open()
        dialog().querySelector<HTMLButtonElement>('button')!.focus()
        dialog().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); flushSync()
        expect(document.activeElement).toBe(trigger)
    })
    it('starts closed, executes the existing action once and closes on activation', () => {
        render(); expect(dialog().open).toBe(false); open(); expect(dialog().open).toBe(true)
        dialog().querySelector<HTMLButtonElement>('.world-dialog-content button')!.click(); flushSync()
        expect(document.querySelector('output')!.textContent).toBe('1'); expect(dialog().open).toBe(false)
        expect(document.querySelector('button')!.getAttribute('aria-expanded')).toBe('false')
    })
    it('closes on cancellation and supports repeated opening', () => {
        render()
        for (let i = 0; i < 5; i++) {
            open(); expect(dialog().open).toBe(true)
            dialog().dispatchEvent(new Event('cancel', { cancelable: true })); flushSync()
            expect(dialog().open).toBe(false)
        }
    })
    it('consumes Escape before the application hotkey handler', () => {
        render(); open()
        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
        dialog().dispatchEvent(event); flushSync()
        expect(event.defaultPrevented).toBe(true); expect(dialog().open).toBe(false)
    })
    it('closes on navigation and does not resurrect on owner replacement', () => {
        render(); open(); (component as { hide: () => void }).hide(); flushSync(); expect(dialog().open).toBe(false)
    })
    it('closes when the conversation/save owner changes', () => {
        render(); open(); (component as { replaceOwner: () => void }).replaceOwner(); flushSync(); expect(dialog().open).toBe(false)
    })
    it('ignores a queued close event after the panel is destroyed', async () => {
        render(); open(); const removedDialog = dialog()
        await unmount(component); component = undefined
        expect(() => removedDialog.dispatchEvent(new Event('close'))).not.toThrow()
    })
    it('does not let an old close event dismiss a new panel', () => {
        render(); open(); const removedDialog = dialog()
        ;(component as { replacePane: () => void }).replacePane(); flushSync(); open()
        expect(dialog().open).toBe(true)
        removedDialog.dispatchEvent(new Event('close')); flushSync()
        expect(dialog().open).toBe(true)
    })
    it('closes on outside click', () => {
        render(); open(); dialog().dispatchEvent(new MouseEvent('click', { clientX: -1, clientY: -1, bubbles: true })); flushSync()
        expect(dialog().open).toBe(false)
    })
})
