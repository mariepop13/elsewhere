type ImageTransportArgs = { method: 'GET' | 'POST'; body?: unknown; headers: Record<string, string>; rawResponse: true; abortSignal?: AbortSignal }

type TransportResult = { ok: boolean; status: number; data: unknown; headers: Record<string, string> }
type Transport = (url: string, args: ImageTransportArgs) => Promise<TransportResult>
const modelsUrl = 'https://openrouter.ai/api/v1/images/models'
const generateUrl = 'https://openrouter.ai/api/v1/images'

// Expose fixed diagnostic categories, never provider text that may echo keys or card prose.
export function imageFailureHint(data: unknown): string {
    let value = data
    if (data instanceof Uint8Array) {
        try { value = JSON.parse(new TextDecoder().decode(data)) } catch { return 'Review the selected image model and its options in Settings.' }
    }
    if (!value || typeof value !== 'object') return 'Review the selected image model and its options in Settings.'
    const error = (value as { error?: unknown }).error
    const message = typeof error === 'object' && error !== null
        ? (error as { message?: unknown }).message : error
    if (typeof message !== 'string') return 'Review the selected image model and its options in Settings.'
    if (/credit|balance|payment/i.test(message)) return 'The provider reported an account or credit problem.'
    if (/api.?key|authenticat|unauthoriz/i.test(message)) return 'The provider reported an authentication problem. Check the OpenRouter key in Settings.'
    if (/reference|input_references/i.test(message)) return 'The provider rejected the reference image. Check that the selected model supports references.'
    if (/aspect_ratio|resolution|quality|output_format|seed|parameter/i.test(message)) return 'The provider rejected an image option. Review the selected model and its configured options.'
    if (/no.*endpoint|provider.*unavailable|model.*unavailable|not.*support/i.test(message)) return 'No compatible image provider was available for this model and options.'
    return 'Review the selected image model and its options in Settings.'
}

// Use Elsewhere's authenticated/native transport, with no browser-direct retry.
export function createImageFetcher(transport: Transport): typeof fetch {
    return async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : ''
        const method = init.method ?? 'GET'
        if (!(url === modelsUrl && method === 'GET' || url === generateUrl && method === 'POST')) throw new Error('Unsupported native image request.')
        if (init.body !== undefined && typeof init.body !== 'string') throw new Error('Unsupported native image request body.')
        const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
        const result = await transport(url, {
            method, body, headers: Object.fromEntries(new Headers(init.headers)),
            rawResponse: true, abortSignal: init.signal ?? undefined,
        })
        if (!result.ok) {
            const stage = url === modelsUrl ? 'model lookup' : 'generation'
            throw new Error(`OpenRouter image ${stage} failed (HTTP ${result.status}). ${imageFailureHint(result.data)} No automatic retry was made.`)
        }
        const bytes = result.data instanceof Uint8Array ? result.data.slice().buffer
            : result.data instanceof ArrayBuffer ? result.data : JSON.stringify(result.data)
        return new Response(bytes, { status: result.status, headers: result.headers })
    }
}
