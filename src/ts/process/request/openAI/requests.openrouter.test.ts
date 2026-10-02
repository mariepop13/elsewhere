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
    fetchNative: vi.fn(),
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
    fetchNative: mocks.fetchNative,
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
    maxTokens: 4096,
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

describe('OpenRouter streaming failures', () => {
    beforeEach(() => {
        mocks.fetchNative.mockReset()
    })

    it.each(['AbortError', 'Error'])('propagates %s to the stream reader without an unhandled pipeline rejection', async (name) => {
        let source!: ReadableStreamDefaultController<Uint8Array>
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                source = controller
                controller.enqueue(new TextEncoder().encode('data: {"choices":[{"index":0,"delta":{"content":"Fake first chunk"}}]}\n\n'))
            },
        })
        mocks.fetchNative.mockResolvedValue({
            status: 200,
            headers: new Headers({ 'content-type': 'text/event-stream' }),
            body,
        })
        const result = await requestOpenAI(baseArg({ useStreaming: true }))
        expect(result.type).toBe('streaming')
        if (result.type !== 'streaming') throw new Error('Expected streaming result')
        const reader = result.result.getReader()
        expect((await reader.read()).value?.['0']).toBe('Fake first chunk')
        const failure = name === 'AbortError' ? new DOMException('Fake cancellation', name) : new Error('Fake broken stream')
        source.error(failure)
        await expect(reader.read()).rejects.toBe(failure)
        // Allow the runner to observe any unhandled fire-and-forget pipeTo rejection.
        await new Promise(resolve => setTimeout(resolve, 0))
    })
})


describe('token budget transport preflight', () => {
    beforeEach(() => { mocks.globalFetch.mockReset(); mocks.fetchNative.mockReset(); mocks.db.openrouterReasoning = undefined; });
    it('rejects an over-cap completion without HTTP or retry', async () => {
        const result = await requestOpenAI(baseArg({ tokenCapabilities: { requestedId: 'openai/gpt-4o', output: 1000, contextKind: 'total', routeCoverage: 'catalog' } }));
        expect(result).toMatchObject({ type: 'fail', noRetry: true });
        expect(mocks.globalFetch).not.toHaveBeenCalled();
        expect(mocks.fetchNative).not.toHaveBeenCalled();
    });
    it('rejects reasoning which consumes the entire output budget', async () => {
        mocks.db.openrouterReasoning = { enabled: true, maxTokens: 4096 };
        const result = await requestOpenAI(baseArg());
        expect(result).toMatchObject({ type: 'fail', noRetry: true });
        expect(mocks.globalFetch).not.toHaveBeenCalled();
    });
});
