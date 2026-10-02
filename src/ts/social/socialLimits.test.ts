import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSocialLimits, initializeSocialLimits, SOCIAL_CONTEXT_MAX, SOCIAL_RESPONSE_MAX } from './socialLimits'
import { preflightSocialContexts, preflightSocialPublication, countSocialTokens } from './socialTokenBudget'
import { socialMessages } from './socialPrompt'
import { buildPublicPublicationContext, buildPublicContext, createSocialFeed, createSocialPost, eligibleSocialActors, SocialGeneration } from './socialFeed'
const mocks = vi.hoisted(() => ({ encode: vi.fn(async (text: string) => Array(Math.ceil(text.length / 4)).fill(0)) }))
vi.mock('../tokenizer', () => ({ encodeWithTokenizer: mocks.encode }))
const response = '{"reaction":"like","comment":"Final reply"}'
function fixture() {
    const state = createSocialFeed()
    state.enabled = true
    state.cast = [{ characterId: 'jun', name: 'Jun', publicProfile: 'Public gardener' }]
    state.posts = [createSocialPost({ id: 'mara', name: 'Mara' }, 'Public post')]
    return state
}
beforeEach(() => vi.clearAllMocks())
describe('common social limits', () => {
    it('starts with visible independent defaults and migrates missing old fields without changing posts', () => {
        expect(getSocialLimits(createSocialFeed())).toEqual({ maxContext: 4000, maxResponse: 320 })
        const old = fixture()
        delete old.maxContext; delete old.maxResponse
        const posts = JSON.stringify(old.posts)
        initializeSocialLimits(old)
        expect(getSocialLimits(old)).toEqual({ maxContext: 4000, maxResponse: 320 })
        expect(JSON.stringify(old.posts)).toBe(posts)
    })
    it('persists explicit choices through the existing database serialization and never changes chat limits', () => {
        const db = { maxContext: 8000, maxResponse: 1200, socialFeed: fixture() }
        db.socialFeed.maxContext = 16000; db.socialFeed.maxResponse = 2048
        const restored = JSON.parse(JSON.stringify(db))
        initializeSocialLimits(restored.socialFeed)
        expect(getSocialLimits(restored.socialFeed)).toEqual({ maxContext: 16000, maxResponse: 2048 })
        expect(restored.maxContext).toBe(8000); expect(restored.maxResponse).toBe(1200)
    })
    it.each([0, -1, 1.5, NaN, Infinity, undefined, null, '1200', SOCIAL_RESPONSE_MAX + 1])('rejects invalid response %s without repairing it', value => {
        const state = { maxContext: 16000, maxResponse: value } as any
        initializeSocialLimits(state)
        expect(() => getSocialLimits(state)).toThrow('invalid_limits')
        expect(state.maxResponse).toBe(value)
    })
    it.each([0, 511, 1024.5, Infinity, null, SOCIAL_CONTEXT_MAX + 1])('rejects invalid context %s', value => {
        expect(() => getSocialLimits({ maxContext: value as number, maxResponse: 320 })).toThrow('invalid_limits')
    })
    it('validates boundaries and reserves positive public prompt space', () => {
        expect(getSocialLimits({ maxContext: 512, maxResponse: 64 })).toEqual({ maxContext: 512, maxResponse: 64 })
        expect(getSocialLimits({ maxContext: SOCIAL_CONTEXT_MAX, maxResponse: SOCIAL_RESPONSE_MAX }).maxResponse).toBe(SOCIAL_RESPONSE_MAX)
        expect(() => getSocialLimits({ maxContext: 512, maxResponse: 512 })).toThrow()
    })
    it('calls only the explicitly bundled tokenizer with public text', async () => {
        await countSocialTokens('Public fixture')
        expect(mocks.encode).toHaveBeenCalledExactlyOnceWith('Public fixture', 'tik')
    })
    it('counts only the same public messages sent by the adapter, with full output reservation', async () => {
        const state = fixture()
        Object.assign(state.cast[0], { desc: 'PRIVATE', chats: 'PRIVATE', memory: 'PRIVATE' })
        Object.assign(state.posts[0].author, { personaPrompt: 'PRIVATE' })
        const context = buildPublicContext(state, state.posts[0], state.cast[0])
        Object.assign(context, { privateHistory: 'PRIVATE' })
        const count = vi.fn(async (_text: string) => 100)
        await expect(preflightSocialContexts([context], { maxContext: 539, maxResponse: 320 }, count)).resolves.toBeUndefined()
        await expect(preflightSocialContexts([context], { maxContext: 538, maxResponse: 320 }, count)).rejects.toThrow('context_limit')
        expect(count.mock.calls.slice(0,2).map(([text]) => text)).toEqual(socialMessages(context).map(message => message.content))
        expect(JSON.stringify(count.mock.calls)).not.toContain('PRIVATE')
    })
    it('preflights the entire casting before any request or publication, including a later oversized actor', async () => {
        const state = fixture()
        state.maxContext = 512
        state.cast.push({ characterId: 'sol', name: 'Sol', publicProfile: 'OVERSIZE' })
        const count = async (text: string) => text.includes('OVERSIZE') ? 500 : 1
        const generate = vi.fn(async () => response)
        await expect(new SocialGeneration().generate(state, state.posts[0].id, generate, undefined,
            (contexts, limits) => preflightSocialContexts(contexts, limits, count))).rejects.toThrow('context_limit')
        expect(generate).not.toHaveBeenCalled()
        expect(state.posts[0].responses).toEqual([])
    })
    it('uses one shared snapshot for every eligible actor and computes the actual batch ceiling', async () => {
        const state = fixture()
        state.maxContext = 8000
        state.maxResponse = 4000
        state.cast = Array.from({ length: 6 }, (_, index) => ({ characterId: String(index), name: String(index), publicProfile: 'Public' }))
        expect(eligibleSocialActors(state, state.posts[0])).toHaveLength(4)
        expect(eligibleSocialActors(state, state.posts[0]).length * getSocialLimits(state).maxResponse).toBe(16000)
        const generate = vi.fn(async () => response)
        await new SocialGeneration().generate(state, state.posts[0].id, generate)
        expect(generate).toHaveBeenCalledTimes(4)
        expect(generate.mock.calls.map(call => (call as any)[2])).toEqual(Array.from({ length: 4 }, () => ({ maxContext: 8000, maxResponse: 4000 })))
        expect(eligibleSocialActors(state, state.posts[0])).toHaveLength(0)
    })
    it('discards late results and stops remaining requests when the common limits change', async () => {
        const state = fixture()
        state.cast.push({ characterId: 'sol', name: 'Sol', publicProfile: 'Public' })
        let resolve!: (value: string) => void
        const pending = new Promise<string>(done => resolve = done)
        const generate = vi.fn(() => pending)
        const batch = new SocialGeneration().generate(state, state.posts[0].id, generate)
        await vi.waitFor(() => expect(generate).toHaveBeenCalledOnce())
        state.maxResponse = 1024
        resolve(response)
        expect(await batch).toBe('cancelled')
        expect(generate).toHaveBeenCalledOnce()
        expect(state.posts[0].responses).toEqual([])
    })
})

describe('preflight public snapshot integrity', () => {
    it.each(['comment', 'author'])('cancels when public %s changes while preflight is pending', async (change) => {
        const state = fixture()
        let release!: () => void
        const pending = new Promise<void>(done => release = done)
        const generator = vi.fn(async () => response)
        const preflight = vi.fn(() => pending)
        const batch = new SocialGeneration().generate(state, state.posts[0].id, generator, undefined, preflight)
        await vi.waitFor(() => expect(preflight).toHaveBeenCalledOnce())
        if (change === 'author') state.posts[0].author.name = 'Changed public author'
        else state.posts[0].responses.push({ id: 'prior', actor: state.cast[0], reaction: 'like', comment: 'New public comment', createdAt: 0 })
        release()
        expect(await batch).toBe('cancelled')
        expect(generator).not.toHaveBeenCalled()
    })
})

it('applies the full context limit separately to each of four characters, never a summed pool', async () => {
    const state = fixture()
    const context = buildPublicContext(state, state.posts[0], state.cast[0])
    const count = vi.fn(async (_text: string) => 1000)
    // Each request uses an estimated2019 input +4000 response reserve, below8000.
    // Their combined24076 estimate exceeds8000, which is deliberately not a batch context pool.
    await expect(preflightSocialContexts([context, context, context, context], { maxContext: 8000, maxResponse: 4000 }, count)).resolves.toBeUndefined()
    expect(count).toHaveBeenCalledTimes(8)
})

it('reserves the full common response for publications using only their public prompt', async () => {
    const state = fixture()
    const context = buildPublicPublicationContext(state, state.cast[0])
    Object.assign(context, { privateChat: 'PRIVATE' })
    const count = vi.fn(async (_text: string) => 100)
    await expect(preflightSocialPublication(context, { maxContext: 539, maxResponse: 320 }, count)).resolves.toBeUndefined()
    await expect(preflightSocialPublication(context, { maxContext: 538, maxResponse: 320 }, count)).rejects.toThrow('context_limit')
    expect(JSON.stringify(count.mock.calls)).not.toContain('PRIVATE')
})
