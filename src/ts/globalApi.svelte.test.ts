import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    platform: { isNodeServer: true, isTauri: false },
    db: { usePlainFetch: true, requestLocation: 'fake-location' },
    auth: vi.fn().mockResolvedValue('fake-node-token'),
    tauriFetch: vi.fn(),
}))

vi.mock('./platform', () => mocks.platform)
vi.mock('./storage/database.svelte', () => ({ getDatabase: () => mocks.db }))
vi.mock('./storage/nodeStorage', () => ({ getNodeServerProxyAuth: mocks.auth }))
vi.mock('./storage/autoStorage', () => ({ AutoStorage: class {} }))
vi.mock('./stores.svelte', () => ({ DBState: { db: mocks.db }, bodyIntercepterStore: [] }))
vi.mock('./characterCards', () => ({ hubFetchURL: 'https://sv.risuai.xyz' }))
vi.mock('streamsaver', () => ({ default: {} }))
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: mocks.tauriFetch }))
vi.mock('@tauri-apps/api/webviewWindow', () => ({ getCurrentWebviewWindow: () => null }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}) }))
vi.mock('./util', () => ({ sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)) }))
vi.mock('./plugins/plugins.svelte', () => ({}))
vi.mock('./alert', () => ({}))
vi.mock('./drive/drive', () => ({}))
vi.mock('./parser/parser.svelte', () => ({}))
vi.mock('./storage/defaultPrompts', () => ({}))
vi.mock('./storage/risuSave', () => ({}))
vi.mock('./gui/animation', () => ({}))
vi.mock('./gui/colorscheme', () => ({}))
vi.mock('src/lang', () => ({}))
vi.mock('./observer.svelte', () => ({}))
vi.mock('./gui/guisize', () => ({}))
vi.mock('./characters', () => ({}))
vi.mock('./hotkey', () => ({}))
vi.mock('./process/modules', () => ({}))
vi.mock('./process/coldstorage.svelte', () => ({}))

import { fetchNative, getFetchLogs, globalFetch, providerFetch } from './globalApi.svelte'

beforeEach(() => {
    mocks.platform.isNodeServer = true
    mocks.platform.isTauri = false
    mocks.db.usePlainFetch = true
    mocks.tauriFetch.mockReset()
    mocks.auth.mockClear()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response('{"ok":true}', {
        headers: { 'x-elsewhere-proxy': '1', 'content-type': 'application/json' },
    }))))
})
afterEach(() => {
    vi.unstubAllGlobals()
    delete window.userScriptFetch
})

describe('provider routing in globalApi', () => {
    it('Node ordinary calls ignore browser-direct overrides and userscript transports', async () => {
        const userscript = vi.fn()
        window.userScriptFetch = userscript
        const result = await globalFetch('http://localhost:1234/chat', {
            plainFetchForce: true, body: { prompt: 'fake-private-prompt' },
            headers: { Authorization: 'Bearer fake-key' },
        })
        expect(result.ok).toBe(true)
        expect(fetch).toHaveBeenCalledOnce()
        expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/proxy2')
        expect(userscript).not.toHaveBeenCalled()
        expect(mocks.auth).toHaveBeenCalledOnce()
    })

    it.each(['auto', 'local_network'] as const)('Node native/streaming calls use the proxy for %s routes', async networkRoute => {
        window.userScriptFetch = vi.fn()
        const result = await fetchNative('http://localhost:1234/chat', {
            body: '{"prompt":"fake-private-prompt"}', method: 'POST', networkRoute,
            headers: { Authorization: 'Bearer fake-key' }, interceptor: 'openai_streaming',
        })
        expect(result.status).toBe(200)
        await result.text()
        expect(fetch).toHaveBeenCalledOnce()
        expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/proxy2')
        expect(window.userScriptFetch).not.toHaveBeenCalled()
    })

    it('Tauri ordinary calls use native HTTP despite direct-fetch flags or userscripts', async () => {
        mocks.platform.isTauri = true
        mocks.platform.isNodeServer = false
        window.userScriptFetch = vi.fn()
        mocks.tauriFetch.mockResolvedValue(new Response('{"ok":true}'))
        const result = await globalFetch('https://fake-provider.example/chat', { plainFetchForce: true, body: {} })
        expect(result.ok).toBe(true)
        expect(mocks.tauriFetch).toHaveBeenCalledOnce()
        expect(fetch).not.toHaveBeenCalled()
        expect(window.userScriptFetch).not.toHaveBeenCalled()
    })

    it('Tauri streaming uses the native plugin with cancellation and redirects disabled', async () => {
        mocks.platform.isTauri = true
        mocks.platform.isNodeServer = false
        const cancel = vi.fn()
        mocks.tauriFetch.mockResolvedValue(new Response(new ReadableStream({ cancel })))
        const response = await fetchNative('http://localhost:1234/chat', { method: 'POST', body: 'fake-prompt' })
        const [, request] = mocks.tauriFetch.mock.calls[0]
        expect(request.maxRedirections).toBe(0)
        expect(request.signal.aborted).toBe(false)
        expect(fetch).not.toHaveBeenCalled()
        await response.body!.cancel()
        expect(cancel).toHaveBeenCalledOnce()
        expect(request.signal.aborted).toBe(true)
    })

    it('Node timeouts remain active after stream headers arrive', async () => {
        vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, request: RequestInit) => Promise.resolve(
            new Response(new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode('fake-first-chunk'))
                    request.signal!.addEventListener('abort', () => controller.error(request.signal!.reason))
                },
            }), { headers: { 'x-elsewhere-proxy': '1' } })
        )))
        const response = await fetchNative('http://localhost:1234/chat', { method: 'POST', body: 'fake-prompt', requestTimeoutMs: 50 })
        const reader = response.body!.getReader()
        expect(new TextDecoder().decode((await reader.read()).value)).toBe('fake-first-chunk')
        await expect(reader.read()).rejects.toMatchObject({ name: 'TimeoutError' })
    })

    it('Node provider reads and multipart requests use the same authenticated route', async () => {
        const form = new FormData()
        form.append('prompt', 'fake-private-prompt')
        await (await providerFetch('https://fake-provider.example/image', { method: 'POST', body: form })).text()
        const first = vi.mocked(fetch).mock.calls[0][1]!
        const encoded = new Headers(first.headers).get('risu-header')!
        expect(JSON.parse(decodeURIComponent(encoded))['Content-Type']).toMatch(/^multipart\/form-data; boundary=/)
        expect(await new Response(first.body).text()).toContain('fake-private-prompt')
        await (await providerFetch('https://fake-provider.example/models')).text()
        expect(vi.mocked(fetch).mock.calls[1][0]).toBe('/proxy2')
        expect(vi.mocked(fetch).mock.calls[1][1]?.method).toBe('GET')
    })

    it('streaming diagnostics record a provider failure without retaining its body', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"fake-private-prompt"}', {
            status: 429, headers: { 'x-elsewhere-proxy': '1' },
        })))
        const response = await fetchNative('https://fake-provider.example/chat', { method: 'POST', body: 'fake-private-prompt' })
        await response.text()
        expect(getFetchLogs()[0]).toMatchObject({ success: false, status: 429, response: '[Response content omitted]' })
    })

    it('Node request logs omit conversation content, provider credentials, and query values', async () => {
        await globalFetch('https://fake-provider.example/chat?key=fake-key', {
            body: { prompt: 'fake-private-prompt' }, headers: { Authorization: 'Bearer fake-key' },
        })
        const log = JSON.stringify(getFetchLogs()[0])
        expect(log).not.toContain('fake-private-prompt')
        expect(log).not.toContain('fake-key')
        expect(log).toContain('Request content omitted')
        expect(log).toContain('Response content omitted')
    })
})
