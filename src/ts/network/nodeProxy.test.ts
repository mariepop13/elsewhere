import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindResponseCleanup, fetchNodeProxy, nodeProxyUnavailableMessage, openNodeProviderSocket } from './nodeProxy'
import { redactRequestHeaders, redactRequestUrl } from './requestPrivacy'

afterEach(() => vi.unstubAllGlobals())

describe('authenticated Node provider transport', () => {
    it('uses only the same-origin route and preserves the provider error response', async () => {
        const providerError = new Response('{"error":"fake provider error"}', {
            status: 429, headers: { 'x-elsewhere-proxy': '1', 'retry-after': '3' },
        })
        const fetchMock = vi.fn().mockResolvedValue(providerError)
        vi.stubGlobal('fetch', fetchMock)
        const signal = new AbortController().signal
        const response = await fetchNodeProxy('https://fake-provider.example/chat?key=fake-key', {
            method: 'POST', body: 'fake-prompt', headers: { Authorization: 'Bearer fake-key' },
            signal, timeoutMs: 1234, auth: 'fake-node-token',
        })
        expect(response).toBe(providerError)
        expect(fetchMock).toHaveBeenCalledOnce()
        const [route, request] = fetchMock.mock.calls[0]
        expect(route).toBe('/proxy2')
        expect(request.redirect).toBe('error')
        expect(request.signal).toBe(signal)
        expect(request.body).toBe('fake-prompt')
        expect(request.headers['risu-auth']).toBe('fake-node-token')
        expect(request.headers['risu-timeout-ms']).toBe('1234')
        expect(JSON.parse(decodeURIComponent(request.headers['risu-header']))).toEqual({ Authorization: 'Bearer fake-key' })
    })

    it('reports an absent route without a browser or hub fallback', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response('<html>missing route</html>', { status: 404 }))
        vi.stubGlobal('fetch', fetchMock)
        const response = await fetchNodeProxy('https://fake-provider.example/chat', { method: 'GET', auth: 'fake-token' })
        expect(response.status).toBe(503)
        expect(await response.json()).toEqual({ error: nodeProxyUnavailableMessage })
        expect(fetchMock).toHaveBeenCalledOnce()
    })

    it('translates a proxy connection failure without leaking its URL or retrying', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('fake-private-prompt fake-key'))
        vi.stubGlobal('fetch', fetchMock)
        await expect(fetchNodeProxy('https://fake-provider.example/chat', { method: 'GET', auth: 'fake-token' }))
            .rejects.toThrow(nodeProxyUnavailableMessage)
        expect(fetchMock).toHaveBeenCalledOnce()
    })

    it('preserves cancellation instead of converting it to a proxy failure', async () => {
        const controller = new AbortController()
        controller.abort(new DOMException('Fake cancellation', 'AbortError'))
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(controller.signal.reason))
        await expect(fetchNodeProxy('https://fake-provider.example/chat', {
            method: 'GET', signal: controller.signal, auth: 'fake-token',
        })).rejects.toMatchObject({ name: 'AbortError' })
    })
})

describe('response lifetime', () => {
    it('retains cleanup until the stream ends', async () => {
        const cleanup = vi.fn()
        const response = bindResponseCleanup(new Response('fake-stream'), cleanup)
        expect(cleanup).not.toHaveBeenCalled()
        expect(await response.text()).toBe('fake-stream')
        expect(cleanup).toHaveBeenCalledOnce()
    })

    it('cancels the source stream and releases timeout listeners', async () => {
        const cancel = vi.fn()
        const cleanup = vi.fn()
        const response = bindResponseCleanup(new Response(new ReadableStream({ cancel })), cleanup)
        await response.body!.cancel('fake cancellation')
        expect(cancel).toHaveBeenCalledWith('fake cancellation')
        expect(cleanup).toHaveBeenCalledOnce()
    })

    it('releases timeout listeners when a source stream errors', async () => {
        const cleanup = vi.fn()
        const response = bindResponseCleanup(new Response(new ReadableStream({
            start(controller) { controller.error(new Error('fake stream interruption')) },
        })), cleanup)
        await expect(response.text()).rejects.toThrow('fake stream interruption')
        expect(cleanup).toHaveBeenCalledOnce()
    })
})

describe('request log privacy', () => {
    it('redacts credentials regardless of provider header spelling', () => {
        const log = redactRequestHeaders({ Authorization: 'fake-key', 'X-Api-Key': 'fake-key',
            apikey: 'fake-key', 'xi-api-key': 'fake-key', 'risu-auth': 'fake-token', 'Content-Type': 'application/json' })
        expect(JSON.stringify(log)).not.toContain('fake-key')
        expect(JSON.stringify(log)).not.toContain('fake-token')
        expect(log['Content-Type']).toBe('application/json')
    })

    it('removes URL credentials, queries and fragments', () => {
        const log = redactRequestUrl('https://user:fake-password@fake-provider.example/chat?key=fake-key&text=fake-prompt#fake-fragment')
        expect(log).toBe('https://fake-provider.example/chat?[redacted]')
    })
})


class FakeProviderSocket extends EventTarget {
    static instances: FakeProviderSocket[] = []
    sent: string[] = []
    closed = false
    onopen: ((event: Event) => void) | null = null
    onmessage: ((event: MessageEvent) => void) | null = null
    onerror: ((event: Event) => void) | null = null
    constructor(readonly url: string) { super(); FakeProviderSocket.instances.push(this) }
    send(data: string) { this.sent.push(data) }
    close() { this.closed = true; this.dispatchEvent(new Event('close')) }
    open() { this.onopen?.(new Event('open')) }
    message(value: unknown) { this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(value) })) }
}

describe('same-origin legacy provider sockets', () => {
    it('authenticates in the first frame and keeps cancellation active after opening', async () => {
        FakeProviderSocket.instances = []
        vi.stubGlobal('WebSocket', FakeProviderSocket)
        const controller = new AbortController()
        const pending = openNodeProviderSocket('ws://fake-lan-provider:1234/stream', {
            auth: 'fake-node-token', signal: controller.signal,
        })
        const socket = FakeProviderSocket.instances[0]
        expect(socket.url).toBe(`ws://${location.host}/proxy-websocket`)
        expect(socket.url).not.toContain('fake-node-token')
        socket.open()
        expect(JSON.parse(socket.sent[0])).toEqual({ url: 'ws://fake-lan-provider:1234/stream', auth: 'fake-node-token' })
        socket.message({ type: 'provider_open' })
        await pending
        controller.abort()
        expect(socket.closed).toBe(true)
    })

    it('reports proxy socket errors without creating a direct provider connection', async () => {
        FakeProviderSocket.instances = []
        vi.stubGlobal('WebSocket', FakeProviderSocket)
        const pending = openNodeProviderSocket('ws://fake-lan-provider:1234/stream', { auth: 'fake-token' })
        const socket = FakeProviderSocket.instances[0]
        socket.open()
        socket.message({ type: 'proxy_error', message: 'Fake proxy authentication failed' })
        await expect(pending).rejects.toThrow('Fake proxy authentication failed')
        expect(FakeProviderSocket.instances).toHaveLength(1)
        expect(socket.closed).toBe(true)
    })
})
