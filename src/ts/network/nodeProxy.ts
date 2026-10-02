export const nodeProxyUnavailableMessage = 'The self-hosted Node proxy is unavailable. Check that this page is served by the Elsewhere Node server and that /proxy2 is enabled. No alternate route was used.'

interface NodeProxyRequest {
    body?: BodyInit
    headers?: Record<string, string>
    method: string
    signal?: AbortSignal
    timeoutMs?: number
    auth: string
}

/** Provider credentials travel only inside the authenticated same-origin request. */
export async function fetchNodeProxy(url: string, request: NodeProxyRequest): Promise<Response> {
    let response: Response
    try {
        response = await fetch('/proxy2', {
            method: request.method,
            body: request.body,
            signal: request.signal,
            redirect: 'error',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/octet-stream',
                'risu-url': encodeURIComponent(url),
                'risu-header': encodeURIComponent(JSON.stringify(request.headers ?? {})),
                'risu-auth': request.auth,
                ...(request.timeoutMs && { 'risu-timeout-ms': String(Math.max(1, Math.floor(request.timeoutMs))) }),
            },
        })
    } catch {
        if (request.signal?.aborted) throw request.signal.reason ?? new DOMException('Aborted', 'AbortError')
        throw new Error(nodeProxyUnavailableMessage)
    }
    if (response.headers.get('x-elsewhere-proxy') !== '1') {
        await response.body?.cancel()
        return new Response(JSON.stringify({ error: nodeProxyUnavailableMessage }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        })
    }
    return response
}

/** Keep timeout/abort listeners until the response is consumed or cancelled. */
export function bindResponseCleanup(response: Response, cleanup: () => void, abort?: (reason?: unknown) => void): Response {
    if (!response.body) {
        cleanup()
        return response
    }
    const reader = response.body.getReader()
    const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
            try {
                const result = await reader.read()
                if (result.done) {
                    cleanup()
                    controller.close()
                } else {
                    controller.enqueue(result.value)
                }
            } catch (error) {
                cleanup()
                controller.error(error)
            }
        },
        async cancel(reason) {
            try {
                await reader.cancel(reason)
            } finally {
                abort?.(reason)
                cleanup()
            }
        },
    })
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers })
}

interface NodeProviderSocketRequest {
    auth: string
    signal?: AbortSignal
    timeoutMs?: number
}

/** Legacy provider sockets use the same server and authenticate before sending content. */
export function openNodeProviderSocket(url: string, request: NodeProviderSocketRequest): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
        const socket = new WebSocket(`${protocol}//${location.host}/proxy-websocket`)
        let connected = false
        let timer: ReturnType<typeof setTimeout>
        const abort = () => {
            if (!connected) reject(request.signal?.reason ?? new DOMException('Aborted', 'AbortError'))
            socket.close()
        }
        const cleanup = () => {
            clearTimeout(timer)
            request.signal?.removeEventListener('abort', abort)
        }
        const fail = (message: string) => {
            cleanup()
            reject(new Error(message))
            socket.close()
        }
        socket.onopen = () => socket.send(JSON.stringify({ url, auth: request.auth, timeoutMs: request.timeoutMs }))
        socket.onmessage = event => {
            let response: unknown
            try { response = JSON.parse(String(event.data)) }
            catch { fail(nodeProxyUnavailableMessage); return }
            if (!response || typeof response !== 'object' || !('type' in response)) {
                fail(nodeProxyUnavailableMessage)
            } else if (response.type === 'provider_open') {
                connected = true
                clearTimeout(timer)
                resolve(socket)
            } else if (response.type === 'proxy_error' && 'message' in response && typeof response.message === 'string') {
                fail(response.message)
            } else {
                fail(nodeProxyUnavailableMessage)
            }
        }
        socket.onerror = () => { if (!connected) fail(nodeProxyUnavailableMessage) }
        socket.addEventListener('close', () => {
            cleanup()
            if (!connected) reject(new Error(nodeProxyUnavailableMessage))
        }, { once: true })
        timer = setTimeout(() => { if (!connected) fail(nodeProxyUnavailableMessage) }, 15000)
        request.signal?.addEventListener('abort', abort, { once: true })
        if (request.signal?.aborted) abort()
    })
}
