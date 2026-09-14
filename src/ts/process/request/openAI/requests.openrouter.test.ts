import { beforeEach, describe, expect, it, vi } from 'vitest'

import { requestOpenAI } from './requests'

const mocks = vi.hoisted(() => ({
    db: {
        OaiCompAPIKeys: {},
        additionalParams: [],
        autofillRequestUrl: false,
        cipherChat: false,
        customProxyRequestModel: '',
        deepseekThinkingType: 'disabled',
        generationSeed: 0,
        jsonSchemaEnabled: false,
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
        reverseProxyOobaMode: false,
        useInstructPrompt: false,
    },
    globalFetch: vi.fn(),
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
    LLMFlags: {},
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
    strongBan: vi.fn(),
    tokenizeNum: vi.fn(),
}))

vi.mock('src/ts/model/openrouter', () => ({
    getFreeOpenRouterModels: vi.fn(),
    openRouterGatewayReasoningEfforts: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
}))

vi.mock('src/ts/util', () => ({
    simplifySchema: (schema: unknown) => schema,
}))

vi.mock('../../files/inlays', () => ({
    supportsInlayImage: () => false,
}))

vi.mock('../../mcp/mcp', () => ({
    callTool: vi.fn(),
    decodeToolCall: vi.fn(),
    encodeToolCall: vi.fn(),
}))

vi.mock('../../templates/chatTemplate', () => ({
    applyChatTemplate: vi.fn(),
}))

vi.mock('../../templates/jsonSchema', () => ({
    extractJSON: (data: string) => data,
    getOpenAIJSONSchema: vi.fn(),
}))

vi.mock('../shared', () => ({
    applyAdditionalParameters: (body: unknown) => body,
    applyParameters: (body: unknown) => body,
    getAdditionalParameters: () => [],
}))

vi.mock('./shared', () => ({
    getLocalNetworkRequestOptions: () => ({}),
}))

const baseArg = (overrides: Record<string, unknown> = {}) => ({
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

async function requestBody() {
    mocks.globalFetch.mockResolvedValueOnce({
        ok: true,
        data: { choices: [{ message: { content: 'ok' } }] },
    })

    const result = await requestOpenAI(baseArg())

    expect(result).toEqual({ type: 'success', result: 'ok' })
    return mocks.globalFetch.mock.calls[0][1].body
}

describe('OpenRouter reasoning request serialization', () => {
    beforeEach(() => {
        mocks.globalFetch.mockReset()
        mocks.db.openrouterReasoning = undefined
    })

    it('serializes disabled reasoning as an effort none object', async () => {
        mocks.db.openrouterReasoning = { enabled: false }

        const body = await requestBody()

        expect(body.reasoning).toEqual({ effort: 'none' })
    })

    it('serializes enabled reasoning with the selected effort', async () => {
        mocks.db.openrouterReasoning = {
            enabled: true,
            effort: 'high',
        }

        const body = await requestBody()

        expect(body.reasoning).toEqual({ effort: 'high' })
    })

    it('serializes enabled reasoning with a positive reasoning-token budget', async () => {
        mocks.db.openrouterReasoning = {
            enabled: true,
            maxTokens: 2048,
        }

        const body = await requestBody()

        expect(body.reasoning).toEqual({ max_tokens: 2048 })
    })

    it('omits reasoning for an unset configuration while retaining routing fields', async () => {
        const body = await requestBody()

        expect(body).not.toHaveProperty('reasoning')
        expect(body).toMatchObject({
            model: 'openai/gpt-4o',
            route: 'fallback',
            transforms: ['middle-out'],
            provider: { order: ['provider-a'] },
        })
    })
})
