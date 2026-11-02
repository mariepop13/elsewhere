import { describe, expect, it, vi } from 'vitest'
vi.mock('./socialTokenBudget', () => ({ preflightSocialContexts: async () => {}, preflightSocialPublication: async () => {} }))
import {
    buildPublicContext,
    createSocialFeed,
    createSocialPost,
    MAX_POST_LENGTH,
    parseSocialResponse,
    SocialGeneration,
    type SocialFeedState,
} from './socialFeed'

const response = JSON.stringify({
    reaction: 'curious',
    comment: 'Tell me more about the lanterns.',
})
function fixture(): SocialFeedState {
    const state = createSocialFeed()
    state.enabled = true
    state.publicWorld = 'A city of floating gardens.'
    state.cast = [
        {
            characterId: 'gardener',
            name: 'Jun',
            publicProfile: 'A gentle gardener who speaks about plants.',
        },
    ]
    state.posts = [
        createSocialPost(
            { id: 'persona-1', name: 'Mara' },
            'The lanterns bloom tonight.',
        ),
    ]
    return state
}
function deferred() {
    let resolve!: (value: string) => void
    const promise = new Promise<string>((done) => (resolve = done))
    return { promise, resolve }
}

describe('public social feed', () => {
    it('starts disabled and has no fabricated cast or posts', () => {
        expect(createSocialFeed()).toMatchObject({
            enabled: false,
            cast: [],
            posts: [],
        })
    })
    it('validates posts and snapshots only author display fields', () => {
        expect(() => createSocialPost({ id: 'a', name: 'A' }, '  ')).toThrow()
        expect(() =>
            createSocialPost(
                { id: 'a', name: 'A' },
                'x'.repeat(MAX_POST_LENGTH + 1),
            ),
        ).toThrow()
        const author = {
            id: 'a',
            name: 'A',
            personaPrompt: 'PRIVATE',
            note: 'PRIVATE',
        }
        const post = createSocialPost(author, '  Public  ')
        author.name = 'Changed'
        expect(post.text).toBe('Public')
        expect(post.author.name).toBe('A')
        expect(JSON.stringify(post)).not.toContain('PRIVATE')
    })
    it('projects public allowlists even when inputs carry private fields', () => {
        const state = fixture()
        Object.assign(state, {
            chats: 'PRIVATE_CHAT',
            memory: 'PRIVATE_MEMORY',
        })
        Object.assign(state.cast[0], {
            desc: 'PRIVATE_DESC',
            chats: 'PRIVATE_CHAT',
            systemPrompt: 'PRIVATE_PROMPT',
        })
        Object.assign(state.posts[0].author, {
            personaPrompt: 'PRIVATE_PERSONA',
        })
        const context = buildPublicContext(state, state.posts[0], state.cast[0])
        expect(JSON.stringify(context)).not.toContain('PRIVATE')
        expect(context).toEqual({
            actor: {
                characterId: 'gardener',
                name: 'Jun',
                publicProfile: state.cast[0].publicProfile,
            },
            publicWorld: state.publicWorld,
            post: { author: 'Mara', text: state.posts[0].text },
            comments: [],
            language: { recentUserPosts: [state.posts[0].text], publicProfiles: [state.cast[0].publicProfile], interfaceLanguage: 'English' },
            relationships: [],
        })
    })
    it('validates provider responses and never renders raw malformed content', () => {
        expect(
            parseSocialResponse('```json\n' + response + '\n```'),
        ).toMatchObject({ reaction: 'curious' })
        for (const raw of [
            'not json',
            '{}',
            '{"reaction":"evil","comment":"x"}',
            JSON.stringify({ reaction: 'like', comment: 'x'.repeat(601) }),
        ]) {
            expect(() => parseSocialResponse(raw)).toThrow()
        }
    })
    it('makes one call per actor, persists reactions and prevents repeats', async () => {
        const state = fixture()
        const generate = vi.fn(async () => response)
        const batch = new SocialGeneration()
        expect(await batch.generate(state, state.posts[0].id, generate)).toBe(
            'saved',
        )
        expect(await batch.generate(state, state.posts[0].id, generate)).toBe(
            'empty',
        )
        expect(generate).toHaveBeenCalledTimes(1)
        const restored = JSON.parse(JSON.stringify(state)) as SocialFeedState
        expect(restored.posts[0].responses[0].comment).toContain('lanterns')
        expect(
            await batch.generate(restored, restored.posts[0].id, generate),
        ).toBe('empty')
    })
    it('does not generate for a disabled feed or blank profile', async () => {
        const state = fixture()
        const generate = vi.fn(async () => response)
        state.enabled = false
        await new SocialGeneration().generate(
            state,
            state.posts[0].id,
            generate,
        )
        state.enabled = true
        state.cast[0].publicProfile = ''
        await new SocialGeneration().generate(
            state,
            state.posts[0].id,
            generate,
        )
        expect(generate).not.toHaveBeenCalled()
    })
    it('caps a batch at four actors', async () => {
        const state = fixture()
        state.cast = Array.from({ length: 6 }, (_, index) => ({
            characterId: String(index),
            name: String(index),
            publicProfile: 'Public',
        }))
        const generate = vi.fn(async () => response)
        await new SocialGeneration().generate(
            state,
            state.posts[0].id,
            generate,
        )
        expect(generate).toHaveBeenCalledTimes(4)
    })
    it('blocks concurrent clicks and discards late cancelled results', async () => {
        const state = fixture()
        const pending = deferred()
        const batch = new SocialGeneration()
        const generate = vi.fn(() => pending.promise)
        const first = batch.generate(state, state.posts[0].id, generate)
        expect(await batch.generate(state, state.posts[0].id, generate)).toBe(
            'busy',
        )
        batch.cancel()
        expect(generate.mock.calls[0]?.length).toBe(3)
        pending.resolve(response)
        expect(await first).toBe('cancelled')
        expect(state.posts[0].responses).toEqual([])
    })
    it.each(['navigation', 'deletion', 'profile', 'pause'] as const)(
        'discards results after %s',
        async (cause) => {
            const state = fixture()
            const post = state.posts[0]
            const pending = deferred()
            let current = true
            const task = new SocialGeneration().generate(
                state,
                post.id,
                () => pending.promise,
                () => current,
            )
            if (cause === 'navigation') current = false
            if (cause === 'deletion') state.posts = []
            if (cause === 'profile') state.cast[0].publicProfile = 'Changed'
            if (cause === 'pause') state.enabled = false
            pending.resolve(response)
            expect(await task).toBe('cancelled')
            expect(post.responses).toHaveLength(0)
        },
    )
    it('does not let an old cancelled request clear a newer batch', async () => {
        const state = fixture()
        const old = deferred()
        const newer = deferred()
        const batch = new SocialGeneration()
        const first = batch.generate(
            state,
            state.posts[0].id,
            () => old.promise,
        )
        batch.cancel()
        const second = batch.generate(
            state,
            state.posts[0].id,
            () => newer.promise,
        )
        old.resolve(response)
        expect(await first).toBe('cancelled')
        expect(
            await batch.generate(
                state,
                state.posts[0].id,
                async () => response,
            ),
        ).toBe('busy')
        newer.resolve(response)
        expect(await second).toBe('saved')
        expect(state.posts[0].responses).toHaveLength(1)
    })
    it('keeps batches atomic on errors and retries only explicitly', async () => {
        const state = fixture()
        state.cast.push({
            characterId: 'archivist',
            name: 'Sol',
            publicProfile: 'A skeptical archivist.',
        })
        const generate = vi
            .fn()
            .mockResolvedValueOnce(response)
            .mockRejectedValueOnce(new Error('Network'))
        const batch = new SocialGeneration()
        await expect(
            batch.generate(state, state.posts[0].id, generate),
        ).rejects.toThrow('Network')
        expect(state.posts[0].responses).toHaveLength(0)
        expect(generate).toHaveBeenCalledTimes(2)
        expect(
            await batch.generate(
                state,
                state.posts[0].id,
                async () => response,
            ),
        ).toBe('saved')
        expect(state.posts[0].responses).toHaveLength(2)
    })
})

describe('thinking markers cannot become public comments', () => {
    it.each(['think', 'Thoughts', 'thinking', 'analysis', 'reasoning', 'THINK'])('rejects %s markers even inside escaped JSON', (tag) => {
        for (const comment of [`<${tag}>SENTINEL</${tag}>`, `<${tag}>SENTINEL`, `</${tag}>SENTINEL`]) {
            const json = JSON.stringify({ reaction: 'like', comment })
            expect(() => parseSocialResponse(json)).toThrow('invalid_response')
            expect(() => parseSocialResponse(json.replace(/</g, '\\u003c').replace(/>/g, '\\u003e'))).toThrow('invalid_response')
        }
    })
    it('rejects thought text surrounding JSON rather than rescuing it', () => {
        expect(() => parseSocialResponse('<think>SENTINEL</think>' + response)).toThrow('invalid_response')
        expect(() => parseSocialResponse('SENTINEL ' + response)).toThrow('invalid_response')
    })
    it('never saves an ambiguous response or retries it', async () => {
        const state = fixture()
        const generator = vi.fn(async () => JSON.stringify({ reaction: 'love', comment: '<think>SENTINEL</think>' }))
        await expect(new SocialGeneration().generate(state, state.posts[0].id, generator)).rejects.toThrow('invalid_response')
        expect(generator).toHaveBeenCalledTimes(1)
        expect(state.posts[0].responses).toEqual([])
    })
})

describe('safe granular social validation diagnostics', () => {
    it.each([
        ['PRIVATE_FINAL prose', 'invalid_json'],
        ['{"reaction":"like",', 'invalid_json'],
        ['[]', 'invalid_shape'],
        ['null', 'invalid_shape'],
        ['"PRIVATE_FINAL"', 'invalid_shape'],
        ['{"reaction":"like|love|curious|none","comment":"PRIVATE_FINAL"}', 'invalid_reaction'],
        ['{"reaction":"LIKE","comment":"PRIVATE_FINAL"}', 'invalid_reaction'],
        ['{"reaction":"like"}', 'invalid_comment'],
        ['{"reaction":"like","comment":null}', 'invalid_comment'],
        [JSON.stringify({ reaction: 'like', comment: 'x'.repeat(601) }), 'comment_too_long'],
        ['{"reaction":"like","comment":"<think>PRIVATE_FINAL</think>"}', 'thinking_content'],
    ])('classifies a rejected response without exposing raw text', (raw, reason) => {
        let caught: unknown
        try { parseSocialResponse(raw) } catch (error) { caught = error }
        expect(caught).toMatchObject({ code: 'invalid_response', reason })
        expect(JSON.stringify(caught)).not.toContain('PRIVATE_FINAL')
        expect(String(caught)).not.toContain('PRIVATE_FINAL')
    })
    it('preserves valid fenced JSON and the strict600-character limit', () => {
        expect(parseSocialResponse('```JSON\n' + response + '\n```')).toMatchObject({ reaction: 'curious' })
        expect(parseSocialResponse(JSON.stringify({ reaction: 'love', comment: 'x'.repeat(600) })).comment).toHaveLength(600)
    })
    it('keeps granular errors atomic with no retry or raw response storage', async () => {
        const state = fixture()
        const generate = vi.fn(async () => '{"reaction":"like|love|curious|none","comment":"PRIVATE_FINAL"}')
        await expect(new SocialGeneration().generate(state, state.posts[0].id, generate)).rejects.toMatchObject({ reason: 'invalid_reaction' })
        expect(generate).toHaveBeenCalledOnce()
        expect(state.posts[0].responses).toEqual([])
        expect(JSON.stringify(state)).not.toContain('PRIVATE_FINAL')
    })
})
