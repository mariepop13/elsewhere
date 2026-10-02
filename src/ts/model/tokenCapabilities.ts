import { LLMProvider, type LLMModel } from './types';

export interface TokenCapabilities {
    requestedId: string;
    resolvedId?: string;
    context?: number;
    output?: number;
    contextKind: 'total' | 'input';
    source?: string;
    observedAt?: string;
    routeCoverage: 'native' | 'catalog' | 'endpoints' | 'unknown';
    topProvider?: { context?: number; output?: number };
    routeMinimum?: { context?: number; output?: number };
    thinking?: { min: number; max: number; dynamic?: boolean; disable?: boolean };
}

export interface TokenSelection {
    provider: number | 'openrouter';
    modelId: string;
    routing?: { only?: string[]; ignore?: string[]; order?: string[] };
    customEndpoint?: boolean;
}

export function positiveTokenLimit(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

// Exact IDs only. Never infer a capacity from a model family or a custom endpoint.
// Provider documentation checked 2026-10-02; sources travel with each result.
const native: Record<string, Omit<TokenCapabilities, 'requestedId' | 'routeCoverage'>> = {};
function add(provider: number, ids: string[], context: number, output: number, source: string, contextKind: 'total' | 'input' = 'total', thinking?: TokenCapabilities['thinking']) {
    for (const id of ids) native[`${provider}:${id}`] = { context, output, source, contextKind, thinking, observedAt: '2026-10-02' };
}
add(LLMProvider.OpenAI, ['gpt4o', 'gpt-4o', 'gpt-4o-2024-08-06', 'gpt-4o-2024-11-20'], 128000, 16384, 'https://developers.openai.com/api/docs/models/gpt-4o');
add(LLMProvider.OpenAI, ['gpt-5', 'gpt-5-2025-08-07'], 400000, 128000, 'https://developers.openai.com/api/docs/models/gpt-5');
add(LLMProvider.OpenAI, ['gpt-5.2'], 400000, 128000, 'https://developers.openai.com/api/docs/models/gpt-5.2');
add(LLMProvider.OpenAI, ['gpt-5.4', 'gpt-5.4-2026-03-05'], 1050000, 128000, 'https://developers.openai.com/api/docs/models/gpt-5.4');
add(LLMProvider.OpenAI, ['gpt-5.5', 'gpt-5.5-2026-04-23'], 1050000, 128000, 'https://developers.openai.com/api/docs/models/gpt-5.5');
add(LLMProvider.GoogleCloud, ['gemini-2.5-flash'], 1048576, 65536, 'https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash', 'input', { min: 0, max: 24576, dynamic: true, disable: true });
add(LLMProvider.Anthropic, ['claude-haiku-4-5', 'claude-haiku-4-5-20251001'], 200000, 64000, 'https://platform.claude.com/docs/en/models/overview');

export function resolveNativeCapabilities(selection: TokenSelection): TokenCapabilities {
    const known = !selection.customEndpoint && native[`${selection.provider}:${selection.modelId}`];
    return { requestedId: selection.modelId, contextKind: 'total', routeCoverage: 'unknown', ...(known || {}), ...(known ? { routeCoverage: 'native' as const } : {}) };
}

export function selectionForModel(model: LLMModel, openrouterModel: string, routing?: TokenSelection['routing']): TokenSelection {
    if (model.id === 'openrouter') return { provider: 'openrouter', modelId: openrouterModel, routing: structuredClone(routing) };
    return { provider: model.provider, modelId: model.internalID || model.id, customEndpoint: model.id === 'reverse_proxy' || model.id.startsWith('xcustom:::') || model.id.startsWith('pluginmodel:::') };
}

function record(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

export function parseOpenRouterCapabilities(selection: TokenSelection, raw: unknown, endpoints?: unknown, observedAt = new Date().toISOString()): TokenCapabilities {
    const model = record(raw);
    const top = record(model.top_provider);
    const cap: TokenCapabilities = {
        requestedId: selection.modelId,
        resolvedId: typeof model.alias_target === 'string' ? model.alias_target : typeof model.id === 'string' ? model.id : undefined,
        context: positiveTokenLimit(model.context_length),
        contextKind: 'total',
        topProvider: { context: positiveTokenLimit(top.context_length), output: positiveTokenLimit(top.max_completion_tokens) },
        source: 'https://openrouter.ai/api/v1/models', observedAt,
        routeCoverage: positiveTokenLimit(model.context_length) ? 'catalog' : 'unknown',
    };
    const rows = record(record(endpoints).data).endpoints;
    if (!Array.isArray(rows) || !rows.length) return cap;
    const eligible = rows.map(record).filter(e => {
        // Public endpoint tags are the routing identifiers, including variants.
        const tag = typeof e.tag === 'string' ? e.tag : '';
        const matches = (id: string) => tag === id || tag.startsWith(id + '/');
        return (!selection.routing?.only?.length || selection.routing.only.some(matches)) && !selection.routing?.ignore?.some(matches);
    });
    // Incomplete/unknown routing must not produce a fictitious universal provider cap.
    if (!eligible.length) return cap;
    cap.routeCoverage = 'endpoints';
    for (const [field, key] of [['context', 'context_length'], ['output', 'max_completion_tokens']] as const) {
        const values = eligible.map(e => positiveTokenLimit(e[key]));
        if (values.every(v => v !== undefined)) {
            const maximum = Math.max(...values as number[]);
            cap[field] = field === 'context' && cap.context ? Math.min(cap.context, maximum) : maximum;
            cap.routeMinimum ??= {};
            cap.routeMinimum[field] = Math.min(...values as number[]);
        }
    }
    return cap;
}

export interface TokenBudget {
    context?: number; // Application budget: input + reserved completion, for every provider.
    output: number;
    input?: number; // Local estimate, not an authoritative provider token count.
    reasoning?: number;
    reasoningKind?: 'claude' | 'google' | 'openrouter';
    interleaved?: boolean;
}

export function contextSettingMaximum(cap: TokenCapabilities, output: number): number | undefined {
    return cap.context === undefined ? undefined : cap.contextKind === 'input' ? cap.context + (positiveTokenLimit(output) ?? 0) : cap.context;
}

export function validateTokenBudget(cap: TokenCapabilities, budget: TokenBudget): string[] {
    const errors: string[] = [];
    const label = cap.requestedId || 'Selected model';
    const invalid = (name: string) => errors.push(`${label}: ${name} must be a positive whole number of tokens. Saved values are unchanged.`);
    if (!positiveTokenLimit(budget.output)) invalid('Output budget');
    if (budget.context !== undefined && !positiveTokenLimit(budget.context)) invalid('Context budget');
    if (cap.output && budget.output > cap.output) errors.push(`${label}: output budget ${budget.output} exceeds the advertised maximum ${cap.output}. Reduce the output budget or choose another model/provider.`);
    const maximum = contextSettingMaximum(cap, budget.output);
    if (maximum && budget.context !== undefined && budget.context > maximum) errors.push(`${label}: context budget ${budget.context} exceeds the advertised maximum ${maximum}. Reduce the context budget or choose another model/provider.`);
    if (budget.context !== undefined && budget.output >= budget.context) errors.push(`${label}: output budget must leave room for input within the context budget (${budget.context}).`);
    if (budget.input !== undefined) {
        if (!Number.isSafeInteger(budget.input) || budget.input < 0) errors.push(`${label}: invalid input token estimate.`);
        if (budget.context !== undefined && budget.input + budget.output > budget.context) errors.push(`${label}: estimated input (${budget.input}) plus reserved output (${budget.output}) exceeds the context budget (${budget.context}).`);
        if (cap.context && (cap.contextKind === 'input' ? budget.input : budget.input + budget.output) > cap.context) errors.push(`${label}: estimated request exceeds the advertised ${cap.contextKind === 'input' ? 'input limit' : 'context window'} (${cap.context}).`);
    }
    const thinking = budget.reasoning;
    if (thinking !== undefined) {
        if (!Number.isSafeInteger(thinking)) errors.push(`${label}: reasoning budget must be a whole number.`);
        if (budget.reasoningKind === 'claude' && (thinking < 1024 || (!budget.interleaved && thinking >= budget.output))) errors.push(`${label}: Claude thinking requires at least 1024 tokens and a budget smaller than the shared output budget (${budget.output}).`);
        if (budget.reasoningKind === 'openrouter' && (thinking < 1 || thinking >= budget.output)) errors.push(`${label}: reasoning budget must be positive and leave room for visible output within the shared output budget (${budget.output}).`);
        if (budget.reasoningKind === 'google') {
            const limits = cap.thinking;
            if (thinking < -1 || (thinking === -1 && limits && !limits.dynamic) || (thinking === 0 && limits && !limits.disable) || (thinking > 0 && limits && (thinking < limits.min || thinking > limits.max))) errors.push(`${label}: reasoning budget is outside this model's supported range.`);
        }
    }
    return errors;
}

/** Validate the final provider payload, after custom parameters, without changing it. */
export function validateTokenPayload(cap: TokenCapabilities, body: any, budget: Omit<TokenBudget, 'output'> = {}, headers: Record<string, string> = {}): string[] {
    const config = body.generation_config ?? body.generationConfig;
    const output = config?.maxOutputTokens ?? body.max_completion_tokens ?? body.max_output_tokens ?? body.max_tokens ?? body.max_new_tokens ?? body.max_length ?? body.length ?? body.options?.num_predict ?? body.parameters?.max_length ?? body.params?.max_length;
    const reasoning = body.thinking?.budget_tokens ?? (body.reasoning?.enabled !== false ? body.reasoning?.max_tokens : undefined);
    const beta = Object.entries(headers).find(([key]) => key.toLowerCase() === 'anthropic-beta')?.[1] ?? body.anthropic_beta;
    const interleaved = typeof beta === 'string' ? beta.includes('interleaved-thinking') : Array.isArray(beta) && beta.some(v => typeof v === 'string' && v.includes('interleaved-thinking'));
    const errors = validateTokenBudget(cap, { ...budget, output, reasoning: reasoning ?? config?.thinkingConfig?.thinkingBudget, reasoningKind: body.thinking?.budget_tokens !== undefined ? 'claude' : config ? 'google' : 'openrouter', interleaved });
    for (const context of [body.options?.num_ctx, body.params?.max_context_length, body.max_context_length, body.truncation_length]) {
        if (context !== undefined) errors.push(...validateTokenBudget(cap, { output, context, input: budget.input }));
    }
    return [...new Set(errors)];
}
