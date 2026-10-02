import { beforeEach, describe, expect, it, vi } from 'vitest';
import { payloadTokenError, estimatePayloadInput } from './tokenBudget';
import { LLMProvider, LLMTokenizer } from '../../model/types';
const mocks = vi.hoisted(() => ({ load: vi.fn(), encode: vi.fn(async (text: string) => Array.from(text)) }));
vi.mock('../../model/tokenCapabilities.svelte', () => ({ loadTokenCapabilities: mocks.load }));
vi.mock('../../tokenizer', () => ({ encodeWithTokenizer: mocks.encode }));
const cap = { requestedId: 'fixture/model', context: 8192, output: 2048, contextKind: 'total', routeCoverage: 'endpoints' };
const arg = (extra = {}) => ({ aiModel: 'openrouter', modelInfo: { provider: LLMProvider.AsIs, id: 'openrouter', tokenizer: LLMTokenizer.Unknown }, tokenCapabilities: cap, tokenSelection: { provider: 'openrouter', modelId: 'fixture/model', routing: undefined }, ...extra }) as any;
beforeEach(() => { mocks.load.mockReset(); mocks.encode.mockClear(); });
describe('final transport budget contract', () => {
    it('counts oversized auxiliary inputs without a caller-supplied estimate', async () => {
        const error = await payloadTokenError(arg(), { model: 'fixture/model', messages: [{ role: 'user', content: 'x'.repeat(9000) }], max_tokens: 10 });
        expect(error).toContain('estimated request');
    });
    it('counts full tool history on every subsequent call', async () => {
        const body = { model: 'fixture/model', messages: [{ role: 'user', content: 'small' }], max_tokens: 10 };
        expect(await payloadTokenError(arg(), body)).toBeUndefined();
        body.messages.push({ role: 'tool', content: 'x'.repeat(9000) });
        expect(await payloadTokenError(arg(), body)).toContain('estimated request');
    });
    it('re-resolves actual provider routing overrides', async () => {
        mocks.load.mockResolvedValue({ ...cap, output: 1024 });
        const error = await payloadTokenError(arg(), { model: 'fixture/model', provider: { only: ['b'] }, messages: [], max_tokens: 1500 });
        expect(mocks.load.mock.calls[0][0]).toMatchObject({ routing: { only: ['b'] } });
        expect(error).toContain('1024');
    });
    it('re-resolves model overrides instead of applying stale UI capacities', async () => {
        mocks.load.mockResolvedValue({ ...cap, requestedId: 'fixture/other', output: 100 });
        expect(await payloadTokenError(arg(), { model: 'fixture/other', messages: [], max_tokens: 200 })).toContain('100');
    });
    it('passes native headers for the documented Claude interleaved exception', async () => {
        expect(await payloadTokenError(arg(), { max_tokens: 2048, thinking: { type: 'enabled', budget_tokens: 4096 }, messages: [] }, { 'anthropic-beta': 'interleaved-thinking-2025-05-14' })).toBeUndefined();
    });
});


describe('remaining review regressions', () => {
    it.each([
        { messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,' + 'A'.repeat(100000) } }] }] },
        { messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', data: 'A'.repeat(100000), media_type: 'image/png' } }] }] },
        { contents: [{ parts: [{ text: 'Hello' }, { inlineData: { mimeType: 'audio/wav', data: 'A'.repeat(100000) } }] }] },
    ])('excludes binary media from text tokenization: %j', async body => {
        expect(await estimatePayloadInput(body)).toBeLessThan(500);
        expect(mocks.encode.mock.calls[0][0]).not.toContain('A'.repeat(100));
    });
    it('checks final reduced context against estimated input', async () => {
        expect(await payloadTokenError(arg(), { messages: [{ role: 'user', content: 'x'.repeat(6000) }], options: { num_ctx: 1000, num_predict: 100 } })).toContain('context budget (1000)');
    });
    it.each([undefined, null])('re-resolves deleted/null provider routing %s', async provider => {
        mocks.load.mockResolvedValue({ ...cap, output: 4096 });
        const original = arg({ tokenSelection: { provider: 'openrouter', modelId: 'fixture/model', routing: { only: ['a'] } } });
        expect(await payloadTokenError(original, { provider, model: 'fixture/model', messages: [], max_tokens: 3000 })).toBeUndefined();
        expect(mocks.load.mock.calls[0][0].routing).toBeUndefined();
    });
});
