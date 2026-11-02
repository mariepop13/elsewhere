import { afterEach, expect, it, vi } from 'vitest'
import { createRawSnippet, flushSync, mount, unmount } from 'svelte'
import Shell from './WorldShell.svelte'
vi.mock('src/ts/characters', () => ({ getCharImage: vi.fn(async () => '') }))
let component: ReturnType<typeof mount> | undefined
afterEach(async () => { if (component) await unmount(component); component = undefined; document.body.innerHTML = ''; vi.restoreAllMocks() })
it('removes the global relationship destination and keeps world setup distinct from own profile', () => {
    const onSetup = vi.fn(), onProfile = vi.fn(), onNavigate = vi.fn()
    component = mount(Shell, { target: document.body, props: { page: 'Feed', worldName: 'Fixture world', you: { id: 'player', name: 'Fixture player' }, appearance: 'Dark', onSetup, onProfile, onNavigate, onTheme: vi.fn(), children: createRawSnippet(() => ({ render: () => '<p>Fixture feed</p>' })) } }); flushSync()
    expect([...document.querySelectorAll('nav button')].some(button => button.textContent === 'Relationships')).toBe(false)
    const setup = document.querySelector<HTMLButtonElement>('.world-shell-mobile-setup')!
    expect(setup.textContent).toBe('World'); expect(setup.getAttribute('aria-label')).toBe('Edit world setup'); setup.click()
    document.querySelector<HTMLButtonElement>('.world-shell-mobile-action[aria-label="View profile for Fixture player"]')!.click()
    expect(onSetup).toHaveBeenCalledOnce(); expect(onProfile).toHaveBeenCalledOnce(); expect(onNavigate).not.toHaveBeenCalled()
})
