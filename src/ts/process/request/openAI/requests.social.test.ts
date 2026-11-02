import { beforeEach, describe, expect, it, vi } from 'vitest'

import { requestOpenAI } from './requests'

const mocks = vi.hoisted(() => ({
    db: {
        OaiCompAPIKeys: {},
        OAIPrediction: 'PRIVATE_PREDICTION',
        reverseProxyOobaArgs: {
            messages: [{ role: 'user', content: 'PRIVATE_OOBA' }],
        },
        additionalParams: [],
        autofillRequestUrl: false,
        cipherChat: true,
        customProxyRequestModel: '',
        deepseekThinkingType: 'disabled',
        generationSeed: 0,
        jsonSchemaEnabled: true,
        newOAIHandle: true,
        openAIFlexProcessing: false,
        openrouterFallback: true,
        openrouterKey: 'openrouter-key',
        openrouterMiddleOut: true,
        openrouterProvider: {
            order: ['provider-a'],
            only: [],
            ignore: [],
        },
        openrouterReasoning: undefined as unknown,
        openrouterRequestModel: 'openai/gpt-4o',
        proxyRequestModel: 'proxy-model',
        reverseProxyOobaMode: true,
        useInstructPrompt: true,
    },
    globalFetch: vi.fn(),
    additional: vi.fn(),
    template: vi.fn(),
    schema: vi.fn(),
    decode: vi.fn(),
}))

vi.mock('src/ts/storage/database.svelte', () => ({
    getDatabase: () => mocks.db,
}))

vi.mock('src/lang', () => ({
    language: { errors: { httpError: 'HTTP ' } },
}))

vi.mock('src/ts/alert', () => ({
    alertError: vi.fn(),
}))

vi.mock('src/ts/model/modellist', () => ({
    LLMFlags: { OAICompletionTokens: 'completion-tokens' },
    LLMFormat: { Mistral: 4 },
    LLMProvider: {},
}))

vi.mock('src/ts/globalApi.svelte', () => ({
    addFetchLog: vi.fn(),
    fetchNative: vi.fn(),
    globalFetch: mocks.globalFetch,
    textifyReadableStream: vi.fn(),
}))

vi.mock('src/ts/platform', () => ({
    isNodeServer: true,
    isTauri: false,
}))

vi.mock('src/ts/network/localNetwork', () => ({
    isLocalNetworkUrl: () => false,
}))

vi.mock('src/ts/tokenizer', () => ({
    encodeWithTokenizer: async (text: string) => Array.from(text),
    strongBan: vi.fn(),
    tokenizeNum: vi.fn(),
}))

vi.mock('src/ts/model/openrouter', () => ({
    getFreeOpenRouterModels: vi.fn(),
    openRouterGatewayReasoningEfforts: [
        'none',
        'minimal',
        'low',
        'medium',
        'high',
        'xhigh',
        'max',
    ],
}))

vi.mock('src/ts/util', () => ({
    simplifySchema: (schema: unknown) => schema,
}))

vi.mock('../../files/inlays', () => ({
    supportsInlayImage: () => false,
}))

vi.mock('../../mcp/mcp', () => ({
    callTool: vi.fn(),
    decodeToolCall: mocks.decode,
    encodeToolCall: vi.fn(),
}))

vi.mock('../../templates/chatTemplate', () => ({
    applyChatTemplate: mocks.template,
}))

vi.mock('../../templates/jsonSchema', () => ({
    extractJSON: (data: string) => data,
    getOpenAIJSONSchema: mocks.schema,
}))

vi.mock('../shared', () => ({
    applyAdditionalParameters: (body: unknown) => body,
    applyParameters: (body: unknown) => body,
    getAdditionalParameters: mocks.additional,
}))

vi.mock('./shared', () => ({
    getLocalNetworkRequestOptions: () => ({}),
}))

const baseArg = (overrides: Record<string, unknown> = {}) =>
    ({
        aiModel: 'openrouter',
        bias: {},
        biasString: [],
        formated: [{ role: 'user', content: 'Hello' }],
        maxTokens: 100,
        mode: 'model',
        modelInfo: {
            flags: [],
            format: 0,
            id: 'openrouter-model',
            internalID: 'openrouter-model',
            parameters: [],
            provider: 0,
        },
        ...overrides,
    }) as any

beforeEach(() => {
    vi.clearAllMocks()
    mocks.globalFetch.mockResolvedValue({
        ok: true,
        data: { choices: [{ message: { content: 'public response' } }] },
    })
    mocks.additional.mockReturnValue([['messages', 'PRIVATE_PARAMS']])
    mocks.template.mockReturnValue('PRIVATE_TEMPLATE')
    mocks.schema.mockReturnValue('PRIVATE_SCHEMA')
})

describe('public-only OpenAI transport', () => {
    it.each([400, 401, 402, 403, 404, 429, 502, 504])('returns safe request metadata for status %i without retries', async (status) => {
        mocks.globalFetch.mockResolvedValue({ ok: false, status, data: { error: { message: 'PRIVATE_PROVIDER_ERROR fixture-key' } } })
        const result = await requestOpenAI(baseArg({ publicOnly: true, tools: [] }))
        expect(result).toMatchObject({ type: 'fail', publicDiagnostic: { code: 'request_error', status } })
        expect(JSON.stringify(result)).not.toContain('PRIVATE')
        expect(JSON.stringify(result)).not.toContain('fixture-key')
        expect(mocks.globalFetch).toHaveBeenCalledTimes(1)
        expect(mocks.globalFetch.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions')
    })
    it('distinguishes a truncated successful response from a failed request', async () => {
        mocks.globalFetch.mockResolvedValue({ ok: true, status: 200, data: { choices: [{ finish_reason: 'length', message: { content: '{"reaction":' } }] } })
        expect(await requestOpenAI(baseArg({ publicOnly: true, tools: [] }))).toMatchObject({ type: 'fail', publicDiagnostic: { code: 'incomplete_response', status: 200 } })
        expect(mocks.globalFetch).toHaveBeenCalledTimes(1)
    })
    it('classifies an unexpected content object without exposing it', async () => {
        mocks.globalFetch.mockResolvedValue({ ok: true, status: 200, data: { choices: [{ message: { content: { text: 'PRIVATE_RAW_RESPONSE' } } }] } })
        const result = await requestOpenAI(baseArg({ publicOnly: true, tools: [] }))
        expect(result).toMatchObject({ type: 'fail', publicDiagnostic: { code: 'invalid_response', status: 200 } })
        expect(JSON.stringify(result)).not.toContain('PRIVATE')
    })
    it('does not expose malformed response bodies as diagnostics', async () => {
        mocks.globalFetch.mockResolvedValue({ ok: false, status: 200, data: 'PRIVATE_RAW_RESPONSE' })
        const result = await requestOpenAI(baseArg({ publicOnly: true, tools: [] }))
        expect(result).toMatchObject({ type: 'fail', publicDiagnostic: { code: 'invalid_response', status: 200 } })
        expect(JSON.stringify(result)).not.toContain('PRIVATE')
    })
    it('rejects returned tools without calls or recursive requests', async () => {
        mocks.globalFetch.mockResolvedValue({
            ok: true,
            data: {
                choices: [
                    {
                        message: {
                            tool_calls: [
                                {
                                    function: {
                                        name: 'secret',
                                        arguments: '{}',
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        })
        expect(
            await requestOpenAI(baseArg({ publicOnly: true, tools: [] })),
        ).toMatchObject({ type: 'fail' })
        expect(mocks.globalFetch).toHaveBeenCalledTimes(1)
    })
    it.each(['openrouter', 'reverse_proxy'])(
        'excludes private extensions for %s',
        async (aiModel) => {
            const result = await requestOpenAI(
                baseArg({
                    aiModel,
                    publicOnly: true,
                    tools: [],
                    formated: [
                        {
                            role: 'user',
                            content: '<tool_call>public data</tool_call>',
                        },
                    ],
                }),
            )
            expect(result).toEqual({
                type: 'success',
                result: 'public response',
            })
            const args = mocks.globalFetch.mock.calls[0][1]
            expect(mocks.db.cipherChat).toBe(true)
            expect(args.interceptor).toBeUndefined()
            expect(args.body.route).toBeUndefined()
            expect(args.body.prediction).toBeUndefined()
            expect(args.body.response_format).toBeUndefined()
            expect(args.body.prompt).toBeUndefined()
            expect(args.body.messages).toEqual([
                {
                    role: 'user',
                    content: '<tool_call>public data</tool_call>',
                    name: undefined,
                },
            ])
            expect(JSON.stringify(args.body)).not.toContain('PRIVATE')
            expect(mocks.additional).not.toHaveBeenCalled()
            expect(mocks.template).not.toHaveBeenCalled()
            expect(mocks.schema).not.toHaveBeenCalled()
            expect(mocks.decode).not.toHaveBeenCalled()
            expect(mocks.globalFetch).toHaveBeenCalledTimes(1)
        },
    )
})

describe('public thinking transport regression', () => {
    it.each(['reasoning', 'reasoning_content', 'reasoning_details'])('never mixes %s into the public final answer', async (field) => {
        const final = '{"reaction":"like","comment":"Final"}'
        mocks.globalFetch.mockResolvedValue({ ok: true, data: { choices: [{ finish_reason: 'stop', message: { content: final, [field]: '</Thoughts>{"reaction":"love","comment":"SENTINEL"}<Thoughts>' } }] } })
        expect(await requestOpenAI(baseArg({ publicOnly: true, tools: [] }))).toEqual({ type: 'success', result: final })
        expect(mocks.globalFetch).toHaveBeenCalledTimes(1)
    })
    it('returns an empty final answer for reasoning-only content without retries', async () => {
        mocks.globalFetch.mockResolvedValue({ ok: true, data: { choices: [{ finish_reason: 'stop', message: { content: null, reasoning: 'SENTINEL' } }] } })
        expect(await requestOpenAI(baseArg({ publicOnly: true, tools: [] }))).toEqual({ type: 'success', result: '' })
        expect(mocks.globalFetch).toHaveBeenCalledTimes(1)
    })
    it('preserves private-chat reasoning formatting', async () => {
        mocks.globalFetch.mockResolvedValue({ ok: true, data: { choices: [{ message: { content: 'Final', reasoning: 'SENTINEL' } }] } })
        expect(await requestOpenAI(baseArg({ tools: [] }))).toEqual({ type: 'success', result: '<Thoughts>\nSENTINEL\n</Thoughts>\nFinal' })
    })
})

describe('public selected output ceiling', () => {
    it.each([false, true])('forwards the same selected cap through completion-token mode %s', async (completionMode) => {
        const args = baseArg({ publicOnly: true, tools: [], maxTokens: 4000 })
        args.modelInfo.flags = completionMode ? ['completion-tokens'] : []
        await requestOpenAI(args)
        const body = mocks.globalFetch.mock.calls[0][1].body
        expect(body[completionMode ? 'max_completion_tokens' : 'max_tokens']).toBe(4000)
        expect(body[completionMode ? 'max_tokens' : 'max_completion_tokens']).toBeUndefined()
        expect(mocks.globalFetch).toHaveBeenCalledOnce()
    })
})


describe('merged model budgets on isolated public requests', () => {
    it('keeps private OpenRouter reasoning outside the social request', async () => {
        mocks.db.openrouterReasoning = { enabled: true, maxTokens: 4096, effort: 'high' }
        const result = await requestOpenAI(baseArg({ publicOnly: true, tools: [], maxTokens: 320 }))
        expect(result.type).toBe('success')
        expect(mocks.globalFetch.mock.calls[0][1].body.reasoning).toBeUndefined()
        expect(mocks.globalFetch).toHaveBeenCalledOnce()
    })
    it('rejects a model output ceiling before transport with a safe social diagnostic', async () => {
        const result = await requestOpenAI(baseArg({ publicOnly: true, tools: [], maxTokens: 320,
            tokenCapabilities: { requestedId: 'fixture/model', contextKind: 'total', routeCoverage: 'native', output: 256 } }))
        expect(result).toMatchObject({ type: 'fail', noRetry: true, publicDiagnostic: { code: 'invalid_limits' } })
        expect(mocks.globalFetch).not.toHaveBeenCalled()
    })
    it('checks the final measured payload against the explicit social context', async () => {
        const result = await requestOpenAI(baseArg({ publicOnly: true, tools: [], maxTokens: 320, tokenContext: 512,
            formated: [{ role: 'user', content: 'x'.repeat(600) }] }))
        expect(result).toMatchObject({ type: 'fail', noRetry: true, publicDiagnostic: { code: 'invalid_limits' } })
        expect(mocks.globalFetch).not.toHaveBeenCalled()
    })
})
