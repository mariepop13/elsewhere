import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import Harness from '../../test/fixtures/openRouterKeyCheckHarness.svelte'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), node: true }))
vi.mock('src/ts/globalApi.svelte', () => ({ fetchNative: mocks.fetch }))
vi.mock('src/ts/platform', () => ({ get isNodeServer() { return mocks.node }, isTauri: false }))
vi.mock('src/lang', async () => ({ language: (await import('../../lang/en')).languageEnglish }))
let component: ReturnType<typeof mount>
beforeEach(() => { mocks.fetch.mockReset(); mocks.node = true })
afterEach(async () => { if (component) await unmount(component); document.body.innerHTML = '' })
function render() { component = mount(Harness, { target: document.body }); flushSync() }
function click(label: string) {
    const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === label)
    if (!button) throw new Error('Missing fixture button')
    button.click(); flushSync()
}
describe('explicit key verification UI', () => {
    it('does not auto-check and sends only after the explicit click', async () => {
        mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ data: { is_free_tier: false, label: 'fixture-private-metadata' } })))
        render()
        expect(mocks.fetch).not.toHaveBeenCalled()
        expect(document.querySelector('[role=status]')?.textContent).toContain('not verified')
        click('Verify OpenRouter key')
        await vi.waitFor(() => { flushSync(); expect(document.querySelector('[role=status]')?.textContent).toContain('authenticated this key') })
        expect(document.body.textContent).not.toContain('fixture-private-metadata')
        expect(document.body.textContent).not.toContain('fixture-key')
        expect(document.body.textContent).toContain('Quota and model access are not checked')
        click('Change key')
        expect(document.querySelector('[role=status]')?.textContent).toContain('not verified')
        expect(mocks.fetch).toHaveBeenCalledOnce()
    })
    it('invalidates an in-flight result when provider context changes', async () => {
        let resolve: (r: Response) => void = () => {}
        mocks.fetch.mockImplementation(() => new Promise<Response>(r => resolve = r))
        render(); click('Verify OpenRouter key')
        expect(document.querySelector('[role=status]')?.textContent).toContain('Checking')
        click('Change provider')
        expect(mocks.fetch.mock.calls[0][1].signal.aborted).toBe(true)
        resolve(new Response(JSON.stringify({ data: { is_free_tier: false } })))
        await vi.waitFor(() => { flushSync(); expect(document.querySelector('[role=status]')?.textContent).toContain('not verified') })
        expect(mocks.fetch).toHaveBeenCalledOnce()
    })
    it('disables checking for an absent key without sending', () => {
        render(); click('Clear key')
        expect(document.querySelector<HTMLButtonElement>('button')?.disabled).toBe(true)
        expect(document.querySelector('[role=status]')?.textContent).toContain('No key')
        expect(mocks.fetch).not.toHaveBeenCalled()
    })
    it('never falls back to browser fetch when secure transport is unavailable', () => {
        mocks.node = false
        render(); click('Verify OpenRouter key')
        expect(document.querySelector<HTMLButtonElement>('button')?.disabled).toBe(true)
        expect(document.body.textContent).toContain('requires the desktop app')
        expect(mocks.fetch).not.toHaveBeenCalled()
    })
})

describe('accessible verification colors', () => {
    it.each([
        [200, { data: { is_free_tier: false } }, 'bg-success-100', 'Accepted'],
        [401, {}, 'bg-danger-100', 'Refused'],
        [502, {}, 'bg-warning-100', 'Connection failed'],
        [429, {}, 'bg-warning-100', 'Inconclusive'],
    ])('uses icon and text alongside semantic color for HTTP%s', async (code, body, color, text) => {
        mocks.fetch.mockResolvedValue(new Response(JSON.stringify(body), { status: Number(code) }))
        render(); click('Verify OpenRouter key')
        await vi.waitFor(() => {
            flushSync()
            const status = document.querySelector('[role=status]')!
            expect(status.className).toContain(color)
            expect(status.textContent).toContain(text)
            expect(status.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
            expect(status.getAttribute('aria-atomic')).toBe('true')
        })
    })
    it('keeps absent and checking neutral rather than declaring rejection', () => {
        mocks.fetch.mockImplementation(() => new Promise(() => {}))
        render(); click('Verify OpenRouter key')
        const status = document.querySelector('[role=status]')!
        expect(status.className).toContain('text-textcolor')
        expect(status.className).not.toContain('bg-danger')
        click('Clear key')
        expect(status.textContent).toContain('No key')
        expect(status.className).toContain('text-textcolor')
    })
})
