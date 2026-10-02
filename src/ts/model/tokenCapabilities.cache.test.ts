import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadTokenCapabilities } from './tokenCapabilities.svelte';

afterEach(() => vi.unstubAllGlobals());
describe('public capability preflight', () => {
    it('fetches and deduplicates public catalog/endpoints without keys or request content', async () => {
        const fetch = vi.fn().mockImplementation(async (url: string) => ({ ok: true, json: async () => url.endsWith('/endpoints') ? { data: { endpoints: [{ tag: 'provider', context_length: 8192, max_completion_tokens: 1024 }] } } : { data: [{ id: '~test/latest', alias_target: 'test/resolved', context_length: 8192 }] } }));
        vi.stubGlobal('fetch', fetch);
        const selection = Object.freeze({ provider: 'openrouter' as const, modelId: '~test/latest' });
        const [first, second] = await Promise.all([loadTokenCapabilities(selection), loadTokenCapabilities(selection)]);
        expect(first).toEqual(second);
        expect(first).toMatchObject({ requestedId: '~test/latest', resolvedId: 'test/resolved', context: 8192, output: 1024 });
        expect(fetch).toHaveBeenCalledTimes(2);
        for (const [url, options] of fetch.mock.calls) {
            expect(url).toMatch(/^https:\/\/openrouter.ai\/api\/v1\/models/);
            expect(options).toMatchObject({ credentials: 'omit' });
            expect(options).not.toHaveProperty('headers');
            expect(options).not.toHaveProperty('body');
        }
    });
    it('keeps unknown metadata editable and does not issue paid generation requests', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
        const cap = await loadTokenCapabilities({ provider: 'openrouter', modelId: 'missing/model' });
        expect(cap.output).toBeUndefined();
        expect(cap.context).toBeUndefined();
    });
});
