import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import TokenLimitDetails from './TokenLimitDetails.svelte'
import TokenBudgetInput from './TokenBudgetInput.svelte'
import type { TokenCapabilities } from '../../ts/model/tokenCapabilities'
import { languageEnglish as language } from '../../lang/en'

const fixtures = vi.hoisted(() => ({ cap: { requestedId: 'fixture/model', context: 1000, output: 100, contextKind: 'total', routeCoverage: 'native' } }))
vi.mock('src/lang', async () => ({ language: (await import('../../lang/en')).languageEnglish }))
vi.mock('src/ts/stores.svelte', () => ({ DBState: { db: { maxResponse: 40, openrouterRequestModel: 'fixture/model', openrouterProvider: {} } } }))
vi.mock('src/ts/model/modellist', () => ({ getModelInfo: (id: string) => ({ id, provider: 0, flags: [] }) }))
vi.mock('src/ts/model/tokenCapabilities.svelte', () => ({ cachedTokenCapabilities: () => fixtures.cap, loadTokenCapabilities: vi.fn().mockResolvedValue(undefined) }))
let component: ReturnType<typeof mount>
afterEach(async () => { if (component) await unmount(component); document.body.innerHTML = '' })
const cap: TokenCapabilities = {
    requestedId: 'fixture/model', context: 1048576, output: 65536, contextKind: 'input',
    routeCoverage: 'catalog', source: 'https://example.test/public-models', observedAt: '2026-10-02T00:00:00Z',
}
function render(props: { cap: TokenCapabilities; sharedCap?: TokenCapabilities }) {
    component = mount(TokenLimitDetails, { target: document.body, props }); flushSync()
}
describe('compact model limits', () => {
    it('keeps details closed with a compact summary and exact accessible values', () => {
        render({ cap })
        expect(document.querySelector<HTMLDetailsElement>('details')?.open).toBe(false)
        expect(document.querySelector('summary')?.textContent).toBe('Model limit details')
        expect(document.querySelector('summary')?.className).toContain('focus-visible')
        expect(document.querySelector('span[aria-hidden=true]')?.textContent).toBe('Context 1M')
        expect(document.querySelector('span[title="1,048,576 tokens"] .sr-only')?.textContent).toContain('1,048,576 tokens')
        expect(document.querySelector('span[title="65,536 tokens"] .sr-only')?.textContent).toContain('65,536 tokens')
        expect(document.querySelector('details')?.textContent).toContain('input only')
        expect(document.querySelector('details a')?.getAttribute('href')).toBe(cap.source)
        expect(document.querySelector('time')?.getAttribute('datetime')).toBe(cap.observedAt)
        expect(document.querySelector('details')?.textContent).toContain(language.tokenLimitsRouting)
    })
    it('deduplicates the same auxiliary capability while keeping the shared effect visible', () => {
        render({ cap, sharedCap: { source: cap.source, ...cap, observedAt: '2026-10-02T01:00:00Z' } })
        const summary = document.querySelector('div > div')!
        expect(summary.textContent).toContain('Shared with the auxiliary model')
        expect(document.querySelectorAll('a')).toHaveLength(1)
        expect(document.querySelector('details')?.textContent?.match(/fixture\/model/g)).toHaveLength(1)
    })
    it('keeps a differing shared output ceiling visible even with details closed', () => {
        const sharedCap: TokenCapabilities = { ...cap, requestedId: 'fixture/smaller', output: 4096, source: 'https://example.test/auxiliary' }
        render({ cap, sharedCap })
        const summary = document.querySelector('div > div')!
        expect(summary.textContent).toContain('fixture/smaller')
        expect(summary.textContent).toContain('4,096 tokens')
        expect(document.querySelector<HTMLDetailsElement>('details')?.open).toBe(false)
        expect(document.querySelectorAll('details a')).toHaveLength(2)
    })
    it('retains input-only context semantics for a differing auxiliary model', () => {
        render({ cap: { ...cap, contextKind: 'total' }, sharedCap: { ...cap, requestedId: 'fixture/input-only' } })
        const paragraphs = Array.from(document.querySelectorAll('details p'))
        const shared = paragraphs.find(p => p.textContent?.includes('fixture/input-only'))
        expect(shared?.textContent).toContain('input only')
    })
    it('does not invent an abbreviation or ceiling for unknown metadata', () => {
        render({ cap: { requestedId: 'custom', contextKind: 'total', routeCoverage: 'unknown' } })
        const summary = document.querySelector('div > div')!
        expect(summary.textContent).toContain('Context Unknown')
        expect(summary.textContent).toContain('Output Unknown')
        expect(summary.textContent).not.toContain('NaN')
        expect(document.querySelector('a')).toBeNull()
    })
    it('keeps critical validation errors outside disclosure when repeated details are omitted', () => {
        component = mount(TokenBudgetInput, { target: document.body, props: { modelId: 'fixture', value: 200, showModelDetails: false } })
        flushSync()
        expect(document.querySelector('details')).toBeNull()
        const errors = document.querySelectorAll('[role=alert]')
        expect(errors.length).toBeGreaterThan(0)
        expect(errors[0].closest('details')).toBeNull()
        expect(document.querySelector<HTMLInputElement>('input[type=number]')?.value).toBe('200')
    })
})
