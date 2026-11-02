import { describe, expect, it, vi } from 'vitest'
vi.mock('./socialTokenBudget', () => ({ preflightSocialContexts: async () => {}, preflightSocialPublication: async () => {} }))
import { buildPublicPublicationContext, createSocialFeed, createSocialPost, eligibleSocialActors, parseSocialPublication, SocialGeneration } from './socialFeed'
import { socialPublicationMessages } from './socialPrompt'

const publication = '{"text":"The moonflowers opened this morning."}'
function fixture() {
    const state = createSocialFeed()
    state.enabled = true
    state.maxContext = 8000; state.maxResponse = 4000
    state.cast = [{ characterId: 'jun', name: 'Jun', publicProfile: 'Public gardener' }, { characterId: 'sol', name: 'Sol', publicProfile: 'Public archivist' }]
    state.posts = [createSocialPost({ id: 'mara', name: 'Mara' }, 'Public lanterns')]
    return state
}
function deferred() {
    let resolve!: (value: string) => void
    const promise = new Promise<string>(done => { resolve = done })
    return { promise, resolve }
}

describe('manual character publications', () => {
    it('sends only bounded public facts, with a second allowlist at the prompt boundary', () => {
        const state = fixture()
        Object.assign(state.cast[0], { desc: 'PRIVATE', chats: 'PRIVATE', memory: 'PRIVATE' })
        state.posts = Array.from({ length: 10 }, (_, i) => createSocialPost({ id: 'm', name: 'M' }, `Public ${i}`))
        Object.assign(state.posts[0], { secret: 'PRIVATE' })
        const context = buildPublicPublicationContext(state, state.cast[0])
        Object.assign(context, { privateChat: 'PRIVATE' })
        Object.assign(context.recentPosts[0], { privateMemory: 'PRIVATE' })
        const messages = socialPublicationMessages(context)
        expect(JSON.stringify(messages)).not.toContain('PRIVATE')
        expect(JSON.parse(messages[1].content).recentPosts).toHaveLength(8)
    })
    it('publishes exactly one attributed post, with full shared budget and no automatic reactions', async () => {
        const state = fixture()
        const generator = vi.fn(async () => publication)
        expect(await new SocialGeneration().publish(state, 'jun', generator)).toBe('saved')
        expect(generator).toHaveBeenCalledExactlyOnceWith(buildPublicPublicationContext({ ...state, posts: state.posts.slice(1) }, state.cast[0]), expect.any(AbortSignal), { maxContext: 8000, maxResponse: 4000 })
        expect(state.posts[0]).toMatchObject({ author: { id: 'character:jun', characterId: 'jun', name: 'Jun' }, text: 'The moonflowers opened this morning.', responses: [] })
        expect(eligibleSocialActors(state, state.posts[0]).map(actor => actor.characterId)).toEqual(['sol'])
        const restored = JSON.parse(JSON.stringify(state))
        expect(eligibleSocialActors(restored, restored.posts[0]).map(actor => actor.characterId)).toEqual(['sol'])
    })
    it('rejects blank, malformed, oversized and thinking-tagged publications', () => {
        for (const raw of ['{}', '[]', 'not JSON', '{"text":" "}', '{"text":null}', JSON.stringify({ text: 'x'.repeat(2001) }), '{"text":"<think>PRIVATE</think>"}', '<think>PRIVATE</think>' + publication]) {
            expect(() => parseSocialPublication(raw)).toThrow()
        }
        expect(parseSocialPublication('```json\n' + publication + '\n```')).toContain('moonflowers')
        expect(parseSocialPublication(JSON.stringify({ text: 'x'.repeat(2000) }))).toHaveLength(2000)
    })
    it('rejects normalized duplicate posts without retrying', async () => {
        const state = fixture()
        const generate = vi.fn(async () => '{"text":" PUBLIC   LANTERNS "}')
        await expect(new SocialGeneration().publish(state, 'jun', generate)).rejects.toMatchObject({ reason: 'duplicate_post' })
        expect(state.posts).toHaveLength(1)
        expect(generate).toHaveBeenCalledOnce()
    })
    it.each(['pause', 'cast', 'world', 'post', 'budget', 'navigation', 'cancel'] as const)('discards late publications after %s', async cause => {
        const state = fixture(), pending = deferred(), batch = new SocialGeneration()
        let current = true
        const task = batch.publish(state, 'jun', () => pending.promise, () => current)
        await Promise.resolve()
        if (cause === 'pause') state.enabled = false
        if (cause === 'cast') state.cast = []
        if (cause === 'world') state.publicWorld = 'Changed'
        if (cause === 'post') state.posts[0].text = 'Changed'
        if (cause === 'budget') state.maxResponse = 320
        if (cause === 'navigation') current = false
        if (cause === 'cancel') batch.cancel()
        pending.resolve(publication)
        expect(await task).toBe('cancelled')
        expect(state.posts).toHaveLength(1)
    })
    it('allows one operation at a time across publication and reaction actions', async () => {
        const state = fixture(), pending = deferred(), batch = new SocialGeneration()
        const first = batch.publish(state, 'jun', () => pending.promise)
        expect(await batch.publish(state, 'sol', async () => publication)).toBe('busy')
        expect(await batch.generate(state, state.posts[0].id, async () => '{"reaction":"like","comment":""}')).toBe('busy')
        pending.resolve(publication)
        expect(await first).toBe('saved')
    })
    it('preflights before spending and leaves existing posts intact on errors', async () => {
        const state = fixture(), generator = vi.fn(async () => publication)
        await expect(new SocialGeneration().publish(state, 'jun', generator, undefined, async () => { throw new Error('context_limit') })).rejects.toThrow('context_limit')
        expect(generator).not.toHaveBeenCalled()
        expect(state.posts).toHaveLength(1)
        await expect(new SocialGeneration().publish(state, 'jun', async () => { throw new Error('Network') })).rejects.toThrow('Network')
        expect(state.posts).toHaveLength(1)
    })
    it('does not generate for disabled feeds, missing actors or blank profiles', async () => {
        const state = fixture(), generator = vi.fn(async () => publication), batch = new SocialGeneration()
        state.enabled = false
        expect(await batch.publish(state, 'jun', generator)).toBe('empty')
        state.enabled = true; state.cast[0].publicProfile = ''
        expect(await batch.publish(state, 'jun', generator)).toBe('empty')
        expect(await batch.publish(state, 'missing', generator)).toBe('empty')
        expect(generator).not.toHaveBeenCalled()
    })
})

describe('selective reactions', () => {
    it('persists declines without public comments and prevents repeated requests after reload', async () => {
        const state = fixture(), batch = new SocialGeneration()
        const generator = vi.fn().mockResolvedValueOnce('{"reaction":"none","comment":" "}').mockResolvedValueOnce('{"reaction":"curious","comment":"Tell me more"}')
        expect(await batch.generate(state, state.posts[0].id, generator)).toBe('saved')
        expect(state.posts[0].responses).toHaveLength(1)
        expect(state.posts[0].responses[0].actor.characterId).toBe('sol')
        expect(state.posts[0].consideredActorIds).toEqual(['jun'])
        const restored = JSON.parse(JSON.stringify(state))
        expect(await batch.generate(restored, restored.posts[0].id, generator)).toBe('empty')
        expect(generator).toHaveBeenCalledTimes(2)
    })
    it('keeps declines atomic when a later actor fails', async () => {
        const state = fixture()
        const generator = vi.fn().mockResolvedValueOnce('{"reaction":"none","comment":""}').mockRejectedValueOnce(new Error('Network'))
        await expect(new SocialGeneration().generate(state, state.posts[0].id, generator)).rejects.toThrow('Network')
        expect(state.posts[0].consideredActorIds).toBeUndefined()
        expect(state.posts[0].responses).toEqual([])
    })
    it('keeps legacy comment-only responses and requests only newly added actors', async () => {
        const state = fixture()
        await new SocialGeneration().generate(state, state.posts[0].id, async () => '{"reaction":"none","comment":"A public comment"}')
        expect(state.posts[0].responses).toHaveLength(2)
        state.cast.push({ characterId: 'new', name: 'New', publicProfile: 'Public' })
        expect(eligibleSocialActors(state, state.posts[0]).map(actor => actor.characterId)).toEqual(['new'])
    })
})
