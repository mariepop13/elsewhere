/** Explicit, inference-free OpenRouter key inspection. Never expose provider bodies. */
export type KeyVerificationStatus = 'absent' | 'unverified' | 'checking' | 'valid' | 'refused' | 'network' | 'unknown'
export type KeyVerificationSnapshot = { key: string; context: string }
export type KeyVerificationTransport = (url: string, options: {
    method: 'GET'; headers: Record<string, string>; signal: AbortSignal;
    logFetch: false; requestTimeoutMs: number
}) => Promise<Response>

export async function inspectOpenRouterKey(
    key: string, transport: KeyVerificationTransport, signal: AbortSignal
): Promise<KeyVerificationStatus> {
    if (!key.trim()) return 'absent'
    try {
        const response = await transport('https://openrouter.ai/api/v1/key', {
            method: 'GET', headers: { Authorization: `Bearer ${key.trim()}` },
            signal, logFetch: false, requestTimeoutMs: 20000,
        })
        if (response.status === 401 || response.status === 403) {
            await response.body?.cancel()
            return 'refused'
        }
        if (response.status !== 200) {
            await response.body?.cancel()
            return response.status === 502 || response.status === 504 ? 'network' : 'unknown'
        }
        let payload: unknown
        try { payload = await response.json() } catch { return 'unknown' }
        if (!payload || typeof payload !== 'object' || !('data' in payload)) return 'unknown'
        const data = payload.data
        // Reject successful HTML/proxy responses and malformed JSON, without retaining metadata.
        return data && typeof data === 'object' && !Array.isArray(data)
            && ('is_free_tier' in data && typeof data.is_free_tier === 'boolean')
            ? 'valid' : 'unknown'
    } catch {
        // Never render/log thrown errors: they can include credentials or response bodies.
        return signal.aborted ? 'unknown' : 'network'
    }
}

/** Revision is a non-secret, ephemeral status identity; no key/result is persisted. */
export function createKeyVerification(
    snapshot: () => KeyVerificationSnapshot,
    inspect: (key: string, signal: AbortSignal) => Promise<KeyVerificationStatus>,
    publish: (status: KeyVerificationStatus) => void
) {
    let revision = 0
    let pending: AbortController | undefined
    function invalidate() {
        revision++
        pending?.abort()
        pending = undefined
        publish(snapshot().key.trim() ? 'unverified' : 'absent')
    }
    async function verify() {
        pending?.abort()
        const current = snapshot()
        const identity = ++revision
        if (!current.key.trim()) { publish('absent'); return }
        const controller = new AbortController()
        pending = controller
        publish('checking')
        const timer = setTimeout(() => controller.abort(), 20000)
        try {
            const result = await inspect(current.key, controller.signal)
            const latest = snapshot()
            if (revision === identity && current.key === latest.key && current.context === latest.context) {
                publish(result)
            }
        } catch {
            if (revision === identity && current.key === snapshot().key && current.context === snapshot().context) {
                publish('unknown')
            }
        } finally {
            clearTimeout(timer)
            if (revision === identity) pending = undefined
        }
    }
    return { invalidate, verify, dispose: () => { revision++; pending?.abort(); pending = undefined } }
}
