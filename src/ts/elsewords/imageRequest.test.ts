import { describe, expect, it, vi } from 'vitest'
import { createImageFetcher, imageFailureHint } from './imageRequest'

describe('native image transport', () => {
    it('uses the supplied host transport and serializes image payload once', async () => {
        const transport = vi.fn().mockResolvedValue({ ok: true, status: 200, data: new TextEncoder().encode('{"data":[]}'), headers: {} })
        const fetcher = createImageFetcher(transport)
        await fetcher('https://openrouter.ai/api/v1/images/models')
        await fetcher('https://openrouter.ai/api/v1/images', { method: 'POST', headers: { Authorization: 'Bearer fake-only-key' }, body: JSON.stringify({ model: 'fixture/image', prompt: 'Fictional portrait' }) })
        expect(transport.mock.calls[0][1]).toMatchObject({ method: 'GET', rawResponse: true })
        expect(transport.mock.calls[1][1]).toMatchObject({ method: 'POST', body: { model: 'fixture/image', prompt: 'Fictional portrait' } })
        expect(new Headers(transport.mock.calls[1][1].headers).get('authorization')).toBe('Bearer fake-only-key')
        await expect(fetcher('https://example.com')).rejects.toThrow('Unsupported')
        expect(transport).toHaveBeenCalledTimes(2)
    })
    it('categorizes a 400 without provider text, secrets or retries', async () => {
        const transport = vi.fn().mockResolvedValue({ ok: false, status: 400, data: new TextEncoder().encode(JSON.stringify({ error: { message: 'unsupported resolution; sk-fake-only-key; private fixture prompt' } })), headers: {} })
        await expect(createImageFetcher(transport)('https://openrouter.ai/api/v1/images', { method: 'POST', body: '{}' })).rejects.toThrow('image option')
        expect(transport).toHaveBeenCalledTimes(1)
        const hint = imageFailureHint({ error: { message: 'unsupported resolution; sk-fake-only-key; private fixture prompt' } })
        expect(hint).not.toContain('sk-fake'); expect(hint).not.toContain('private fixture')
    })
})
