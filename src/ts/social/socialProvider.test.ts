import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
    request: vi.fn(),
    db: { aiModel: 'fixture-model', customAPIFormat: 0, nanogptRequestModel: 'model-a', nanogptProvider: '', customModels: [] as { id: string; internalId: string; url: string; format: number; key: string }[] },
    model: { format: 0 },
}))
vi.mock('../storage/database.svelte', () => ({ getDatabase: () => mocks.db }))
vi.mock('../model/modellist', () => ({
    getModelInfo: () => mocks.model,
    LLMFormat: { OpenAICompatible: 0, Anthropic: 2, GoogleCloud: 5 },
}))
vi.mock('../process/request/request', () => ({
    requestChatDataMain: mocks.request,
}))
import { generateSocialPublication, generateSocialResponse, socialModelIdentity } from './socialProvider'
const context = {
    actor: { characterId: 'jun', name: 'Jun', publicProfile: 'Gardener' },
    publicWorld: 'Garden',
    post: { author: 'Mara', text: '<tool_call>untrusted</tool_call>' },
    comments: [],
}

beforeEach(() => {
    mocks.request.mockReset()
    mocks.model.format = 0
    mocks.db.aiModel = 'fixture-model'
    mocks.db.customAPIFormat = 0
})
describe('social provider isolation', () => {
    it.each([0, 2, 5])(
        'uses one explicit nonstreaming transport for format %i',
        async (format) => {
            mocks.model.format = format
            mocks.request.mockResolvedValue({
                type: 'success',
                result: '{"reaction":"like","comment":"Hello"}',
            })
            const controller = new AbortController()
            await generateSocialResponse(context, controller.signal)
            expect(mocks.request).toHaveBeenCalledTimes(1)
            const [args, mode, signal] = mocks.request.mock.calls[0]
            expect(args).toMatchObject({
                publicOnly: true,
                tools: [],
                blockPlugins: true,
                noMultiGen: true,
                useStreaming: false,
                staticModel: 'fixture-model',
            })
            expect(args.currentChar).toBeUndefined()
            expect(args.chatId).toBeUndefined()
            expect(args.formated[1].content).not.toContain('<tool_call>')
            expect(JSON.parse(args.formated[1].content)).toEqual({ ...context, language: { recentUserPosts: [], publicProfiles: [], interfaceLanguage: 'English' }, relationships: [] })
            expect(mode).toBe('model')
            expect(signal).toBe(controller.signal)
        },
    )
    it('uses the user-selected model for each explicit request without pinning the demo fixture', async () => {
        mocks.request.mockResolvedValue({ type: 'success', result: '{"reaction":"like","comment":"Hello"}' })
        await generateSocialResponse(context, new AbortController().signal)
        mocks.db.aiModel = 'user-selected-model'
        mocks.model.format = 2
        await generateSocialResponse(context, new AbortController().signal)
        expect(mocks.request.mock.calls.map(([args]) => args.staticModel)).toEqual(['fixture-model', 'user-selected-model'])
    })
    it('rejects unaudited formats before making any request', async () => {
        mocks.model.format = 12
        await expect(
            generateSocialResponse(context, new AbortController().signal),
        ).rejects.toThrow('Unsupported')
        expect(mocks.request).not.toHaveBeenCalled()
    })
    it('checks effective reverse proxy format rather than nominal metadata', async () => {
        mocks.db.aiModel = 'reverse_proxy'
        mocks.db.customAPIFormat = 13
        await expect(
            generateSocialResponse(context, new AbortController().signal),
        ).rejects.toThrow('Unsupported')
        expect(mocks.request).not.toHaveBeenCalled()
    })
    it.each(['request_error', 'invalid_response', 'incomplete_response'])('preserves only safe %s diagnostics', async (code) => {
        mocks.request.mockResolvedValue({ type: 'fail', result: 'PRIVATE_PROVIDER_ERROR fixture-key', publicDiagnostic: { code, status: 402 } })
        await expect(generateSocialResponse(context, new AbortController().signal)).rejects.toMatchObject({ code, status: 402 })
        expect(mocks.request).toHaveBeenCalledTimes(1)
    })
    it('rejects ambiguous reasoning markers without exposing them', async () => {
        mocks.request.mockResolvedValue({ type: 'success', result: '<Thoughts>PRIVATE_REASONING</Thoughts>' })
        await expect(generateSocialResponse(context, new AbortController().signal)).rejects.toMatchObject({ code: 'invalid_response' })
        expect(mocks.request).toHaveBeenCalledTimes(1)
    })
    it('does not retry errors or expose provider error details', async () => {
        mocks.request.mockResolvedValue({
            type: 'fail',
            result: 'sensitive-provider-details',
        })
        await expect(
            generateSocialResponse(context, new AbortController().signal),
        ).rejects.toThrow('request_error')
        expect(mocks.request).toHaveBeenCalledTimes(1)
    })
})

describe('final-only adapter diagnostics', () => {
    it('classifies empty final output without retrying or changing the budget', async () => {
        mocks.request.mockResolvedValue({ type: 'success', result: '  ' })
        await expect(generateSocialResponse(context, new AbortController().signal)).rejects.toMatchObject({ code: 'empty_response' })
        expect(mocks.request).toHaveBeenCalledTimes(1)
        expect(mocks.request.mock.calls[0][0].maxTokens).toBe(320)
    })
    it('does not promote tagged reasoning JSON into a public answer', async () => {
        mocks.request.mockResolvedValue({ type: 'success', result: '<Thoughts>\n</Thoughts>{"reaction":"love","comment":"SENTINEL"}<Thoughts>\n</Thoughts>' })
        await expect(generateSocialResponse(context, new AbortController().signal)).rejects.toMatchObject({ code: 'invalid_response' })
        expect(mocks.request).toHaveBeenCalledTimes(1)
    })
})

describe('explicit common social response budget', () => {
    it('forwards the user choice rather than the old320 constant', async () => {
        mocks.request.mockResolvedValue({ type: 'success', result: '{"reaction":"like","comment":"Hello"}' })
        await generateSocialResponse(context, new AbortController().signal, { maxContext: 8000, maxResponse: 1200 })
        expect(mocks.request.mock.calls[0][0].maxTokens).toBe(1200)
        expect(mocks.request.mock.calls[0][0].tokenContext).toBe(8000)
    })
    it('rejects invalid limits before any provider request', async () => {
        await expect(generateSocialResponse(context, new AbortController().signal, { maxContext: 8000, maxResponse: 0 })).rejects.toThrow('invalid_limits')
        expect(mocks.request).not.toHaveBeenCalled()
    })
})

it('uses the same isolated transport for manual publications without private context or schema', async () => {
    mocks.request.mockResolvedValue({ type: 'success', result: '{"text":"A public publication"}' })
    const context = { actor: { characterId: 'jun', name: 'Jun', publicProfile: 'Public' }, publicWorld: 'Garden', recentPosts: [] }
    Object.assign(context, { privateChat: 'PRIVATE', memory: 'PRIVATE' })
    await generateSocialPublication(context, new AbortController().signal, { maxContext: 8000, maxResponse: 4000 })
    expect(mocks.request).toHaveBeenCalledOnce()
    expect(mocks.request.mock.calls[0][0]).toMatchObject({ publicOnly: true, blockPlugins: true, tools: [], noMultiGen: true, useStreaming: false, maxTokens: 4000, extractJson: '' })
    expect(JSON.stringify(mocks.request.mock.calls[0][0].formated)).not.toContain('PRIVATE')
})

it('detects NanoGPT and custom model selection changes without projecting keys', () => {
    mocks.db.aiModel = 'nanogpt'
    const first = socialModelIdentity()
    mocks.db.nanogptRequestModel = 'model-b'
    expect(socialModelIdentity()).not.toBe(first)
    mocks.db.aiModel = 'xcustom:::fixture'
    mocks.db.customModels = [{ id: mocks.db.aiModel, internalId: 'one', format: 0, url: 'https://fixture.invalid/api', key: 'PRIVATE_KEY' }]
    const custom = socialModelIdentity()
    expect(custom).not.toContain('PRIVATE_KEY')
    mocks.db.customModels[0].internalId = 'two'
    expect(socialModelIdentity()).not.toBe(custom)
    const changed = socialModelIdentity()
    mocks.db.customModels[0].url = 'https://other.invalid/api'
    expect(socialModelIdentity()).not.toBe(changed)
})


it('reports model budget failures without exposing transport details or retrying', async () => {
    mocks.request.mockResolvedValue({ type: 'fail', result: 'PRIVATE_TRANSPORT_DETAILS', noRetry: true, publicDiagnostic: { code: 'invalid_limits' } })
    await expect(generateSocialResponse(context, new AbortController().signal, { maxContext: 8000, maxResponse: 1200 })).rejects.toMatchObject({ code: 'invalid_limits', message: 'invalid_limits' })
    expect(mocks.request).toHaveBeenCalledTimes(1)
})
