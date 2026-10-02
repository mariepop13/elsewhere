import { describe, expect, it } from 'vitest';
import { LLMProvider } from './types';
import { contextSettingMaximum, parseOpenRouterCapabilities, positiveTokenLimit, resolveNativeCapabilities, validateTokenBudget, validateTokenPayload, type TokenCapabilities } from './tokenCapabilities';

const known: TokenCapabilities = { requestedId: 'fixture/model', context: 8192, output: 2048, contextKind: 'total', routeCoverage: 'native' };
const unknown = resolveNativeCapabilities({ provider: LLMProvider.AsIs, modelId: 'custom-model' });
const model = { id: 'fixture/model', alias_target: 'fixture/resolved', context_length: 8192, top_provider: { context_length: 8192, max_completion_tokens: 4096 } };
const selection = { provider: 'openrouter' as const, modelId: '~fixture/latest' };
const endpoints = { data: { endpoints: [{ tag: 'a', context_length: 8192, max_completion_tokens: 2048 }, { tag: 'b', context_length: 4096, max_completion_tokens: 1024 }] } };

describe('detached model capability contract', () => {
    it.each([0, -1, 1.5, NaN, Infinity, null, '8192', Number.MAX_SAFE_INTEGER + 1])('keeps invalid metadata %s unknown', value => expect(positiveTokenLimit(value)).toBeUndefined());
    it('resolves exact documented native IDs without extrapolating families', () => {
        expect(resolveNativeCapabilities({ provider: LLMProvider.OpenAI, modelId: 'gpt-5' })).toMatchObject({ context: 400000, output: 128000, contextKind: 'total' });
        expect(resolveNativeCapabilities({ provider: LLMProvider.OpenAI, modelId: 'gpt-5-unknown' }).output).toBeUndefined();
        expect(resolveNativeCapabilities({ provider: LLMProvider.OpenAI, modelId: 'gpt-5', customEndpoint: true }).output).toBeUndefined();
        expect(resolveNativeCapabilities({ provider: LLMProvider.AsIs, modelId: 'gpt-5' }).output).toBeUndefined();
    });
    it('does not mistake top_provider for every route', () => {
        const result = parseOpenRouterCapabilities(selection, model);
        expect(result).toMatchObject({ requestedId: '~fixture/latest', resolvedId: 'fixture/resolved', context: 8192, topProvider: { output: 4096 }, routeCoverage: 'catalog' });
        expect(result.output).toBeUndefined();
    });
    it('distinguishes ceilings and route minima, and applies only/ignore filters', () => {
        expect(parseOpenRouterCapabilities(selection, model, endpoints)).toMatchObject({ context: 8192, output: 2048, routeMinimum: { context: 4096, output: 1024 } });
        expect(parseOpenRouterCapabilities({ ...selection, routing: { only: ['b'] } }, model, endpoints)).toMatchObject({ context: 4096, output: 1024 });
        expect(parseOpenRouterCapabilities({ ...selection, routing: { ignore: ['a'] } }, model, endpoints).output).toBe(1024);
        expect(parseOpenRouterCapabilities({ ...selection, routing: { only: ['missing'] } }, model, endpoints).output).toBeUndefined();
    });
    it('leaves incomplete route output metadata unknown', () => {
        expect(parseOpenRouterCapabilities(selection, model, { data: { endpoints: [...endpoints.data.endpoints, { tag: 'c' }] } }).output).toBeUndefined();
    });
});

describe('budget validation without persistence mutation', () => {
    it('allows large user values for unknown models but validates numeric budgets', () => {
        expect(validateTokenBudget(unknown, { context: 1000000, output: 100000 })).toEqual([]);
        for (const output of [0, -1, 1.1, NaN, Infinity]) expect(validateTokenBudget(unknown, { output })).not.toEqual([]);
    });
    it('preserves a preset/import/migrated value when switching to a smaller model', () => {
        const saved = Object.freeze({ context: 16000, output: 4096 });
        expect(validateTokenBudget(unknown, saved)).toEqual([]);
        expect(validateTokenBudget(known, saved).length).toBe(2);
        expect(saved).toEqual({ context: 16000, output: 4096 });
    });
    it('reserves full completion inside total context', () => {
        expect(validateTokenBudget(known, { context: 8192, input: 7000, output: 2048 }).join(' ')).toContain('estimated');
        expect(validateTokenBudget(known, { context: 8192, input: 6144, output: 2048 })).toEqual([]);
        expect(validateTokenBudget(known, { context: 1000, output: 1000 })).not.toEqual([]);
    });
    it('keeps input-only model contracts separate from total application context', () => {
        const cap = { ...known, contextKind: 'input' as const };
        expect(contextSettingMaximum(cap, 2048)).toBe(10240);
        expect(validateTokenBudget(cap, { context: 10240, input: 8192, output: 2048 })).toEqual([]);
        expect(validateTokenBudget(cap, { input: 8193, output: 1 })).not.toEqual([]);
    });
    it('checks Claude reasoning inside output with its minimum and interleaved exception', () => {
        expect(validateTokenBudget(known, { output: 2048, reasoning: 1024, reasoningKind: 'claude' })).toEqual([]);
        expect(validateTokenBudget(known, { output: 2048, reasoning: 1023, reasoningKind: 'claude' })).not.toEqual([]);
        expect(validateTokenBudget(known, { output: 2048, reasoning: 2048, reasoningKind: 'claude' })).not.toEqual([]);
        expect(validateTokenBudget(known, { output: 2048, reasoning: 4096, reasoningKind: 'claude', interleaved: true })).toEqual([]);
    });
    it('validates explicit Gemini budgets and dynamic sentinel without counting reasoning twice', () => {
        const cap = resolveNativeCapabilities({ provider: LLMProvider.GoogleCloud, modelId: 'gemini-2.5-flash' });
        expect(validateTokenBudget(cap, { output: 4096, reasoning: -1, reasoningKind: 'google' })).toEqual([]);
        expect(validateTokenBudget(cap, { output: 4096, reasoning: 24577, reasoningKind: 'google' })).not.toEqual([]);
        expect(validateTokenBudget(cap, { output: 4096, reasoning: 4096, reasoningKind: 'openrouter' })).not.toEqual([]);
    });
    it.each([
        { max_tokens: 2049 }, { max_completion_tokens: 2049 }, { max_output_tokens: 2049 },
        { generation_config: { maxOutputTokens: 2049 } }, { generationConfig: { maxOutputTokens: 2049 } },
        { max_new_tokens: 2049 }, { parameters: { max_length: 2049 } }, { params: { max_length: 2049 } }, { options: { num_predict: 2049 } },
    ])('rejects final additional-parameter overrides before transport: %j', body => expect(validateTokenPayload(known, body)).not.toEqual([]));
    it('rejects invalid final reasoning budgets and deleted output limits', () => {
        expect(validateTokenPayload(known, { max_tokens: 2048, reasoning: { max_tokens: 2048 } })).not.toEqual([]);
        expect(validateTokenPayload(known, { max_tokens: 2048, thinking: { type: 'enabled', budget_tokens: 100 } })).not.toEqual([]);
        expect(validateTokenPayload(known, { generation_config: { maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: -2 } } })).not.toEqual([]);
        expect(validateTokenPayload(unknown, {})).not.toEqual([]);
    });
});


describe('review regressions', () => {
    it.each(['gpt-4o-2024-08-06', 'gpt-4o-2024-11-20'])('resolves actual native snapshot ID %s', modelId => {
        expect(resolveNativeCapabilities({ provider: LLMProvider.OpenAI, modelId })).toMatchObject({ context: 128000, output: 16384 });
    });
    it.each([{ options: { num_ctx: 0, num_predict: 1 } }, { options: { num_ctx: -1, num_predict: 1 } }, { params: { max_context_length: 0, max_length: 1 } }, { max_context_length: 9000, max_length: 1 }])('validates explicit final context %j', body => {
        expect(validateTokenPayload(known, body)).not.toEqual([]);
    });
    it('recognizes native Claude interleaved header and Bedrock beta array', () => {
        const body = { max_tokens: 2048, thinking: { type: 'enabled', budget_tokens: 4096 } };
        expect(validateTokenPayload(known, body)).not.toEqual([]);
        expect(validateTokenPayload(known, body, {}, { 'anthropic-beta': 'interleaved-thinking-2025-05-14' })).toEqual([]);
        expect(validateTokenPayload(known, { ...body, anthropic_beta: ['interleaved-thinking-2025-05-14'] })).toEqual([]);
    });
});
