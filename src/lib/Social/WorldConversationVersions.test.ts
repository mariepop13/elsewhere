import { afterEach, expect, it, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import type { Database } from '../../ts/storage/database.svelte'
import Versions from './WorldConversationVersions.svelte'

vi.mock('src/ts/process/index.svelte', async () => {
    const { writable } = await import('svelte/store')
    return { doingChat: writable(false) }
})
vi.mock('src/ts/stores.svelte', () => ({ DBState: { db: { personas: [
    { id: 'persona-main', name: 'Fixture player' },
    { id: 'persona-alt', name: 'Fixture alternate persona' },
] } } }))
import { doingChat } from 'src/ts/process/index.svelte'

let component: ReturnType<typeof mount> | undefined
afterEach(async () => { if (component) await unmount(component); component = undefined; document.body.innerHTML = ''; doingChat.set(false); vi.restoreAllMocks() })
function render() {
    const character = { chaId: 'fixture-jun', name: 'Fixture Jun', chatPage: 0, chats: [
        { id: 'main', name: 'Main conversation', bindedPersona: 'persona-main', message: [{ role: 'user', data: 'Fixture retained private message' }], note: 'Fixture retained note' },
        { id: 'alternate', name: 'Other path', bindedPersona: 'missing-persona', message: [], note: 'Fixture alternate note' },
    ] } as Database['characters'][number]
    const onOpen = vi.fn(), onNew = vi.fn()
    component = mount(Versions, { target: document.body, props: { character, onOpen, onNew } }); flushSync()
    return { character, onOpen, onNew }
}
it('opens the selected existing version without altering its history, notes or persona', () => {
    const { character, onOpen } = render(), before = JSON.stringify(character)
    document.querySelectorAll<HTMLButtonElement>('.conversation-version button')[1].click(); flushSync()
    expect(onOpen).toHaveBeenCalledExactlyOnceWith('alternate'); expect(JSON.stringify(character)).toBe(before)
})
it('updates only the chosen version persona and preserves missing bound personas', () => {
    const { character } = render(), select = document.querySelectorAll<HTMLSelectElement>('select')[1]
    expect(select.value).toBe('missing-persona'); expect(select.textContent).toContain('Unavailable bound persona')
    // Happy DOM only implements :checked for INPUT; Svelte selects use OPTION.
    const querySelector = select.querySelector.bind(select)
    const checkedOption = vi.spyOn(select, 'querySelector').mockImplementation(selector =>
        selector === ':checked' ? [...select.options].find(option => option.selected) ?? null : querySelector(selector))
    select.value = 'persona-alt'; select.dispatchEvent(new Event('change', { bubbles: true })); flushSync()
    checkedOption.mockRestore()
    expect(character.chats[1].bindedPersona).toBe('persona-alt'); expect(character.chats[0].bindedPersona).toBe('persona-main')
    expect(character.chats[0].message[0].data).toBe('Fixture retained private message')
})
it('blocks version switches, creation and persona changes during a request, then restores them', () => {
    const { onOpen, onNew } = render(); doingChat.set(true); flushSync()
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('button')]
    expect(buttons.every(button => button.disabled)).toBe(true)
    expect([...document.querySelectorAll<HTMLSelectElement>('select')].every(select => select.disabled)).toBe(true)
    buttons.forEach(button => button.click()); expect(onOpen).not.toHaveBeenCalled(); expect(onNew).not.toHaveBeenCalled()
    doingChat.set(false); flushSync(); document.querySelector<HTMLButtonElement>('.conversation-new-version')!.click()
    expect(onNew).toHaveBeenCalledOnce()
})
