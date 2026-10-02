import { describe, expect, it, vi } from 'vitest'
vi.mock('./socialTokenBudget', () => ({ preflightSocialContexts: async () => {}, preflightSocialPublication: async () => {} }))
import { buildPublicContext, buildPublicPublicationContext, createSocialFeed, createSocialPost, SocialGeneration, type PublicPublicationContext } from './socialFeed'
import type { SocialLimits } from './socialLimits'
import { automaticSocialLanguagePolicy, buildPublicLanguageContext, projectPublicLanguage } from './socialLanguage'
import { socialMessages, socialPublicationMessages } from './socialPrompt'

function fixture() {
    const state = createSocialFeed()
    state.enabled = true
    state.publicWorld = 'An English-described public garden.'
    state.cast = [{ characterId: 'jun', name: 'Jun', publicProfile: 'An English-written public gardener.' }]
    state.posts = [createSocialPost({ id: 'mara', name: 'Mara' }, 'Les fleurs sont magnifiques ce matin.')]
    return state
}

describe('automatic public language policy', () => {
    it('prioritizes a French target or user discussion over English public profiles without extra calls', () => {
        const state = fixture()
        const reaction = socialMessages(buildPublicContext(state, state.posts[0], state.cast[0], 'en'))
        const publication = socialPublicationMessages(buildPublicPublicationContext(state, state.cast[0], 'en'))
        for (const messages of [reaction, publication]) {
            expect(messages[0].content).toContain(automaticSocialLanguagePolicy)
            const data = JSON.parse(messages[1].content)
            expect(data.language.recentUserPosts).toEqual(['Les fleurs sont magnifiques ce matin.'])
            expect(data.language.publicProfiles).toEqual(['An English-written public gardener.'])
            expect(data.language?.interfaceLanguage).toBe('English')
            expect(messages[0].content).toContain('must not override a clearly French target post or French user discussion')
        }
        expect(JSON.parse(reaction[1].content).post.text).toContain('Les fleurs')
        expect(JSON.parse(publication[1].content).post).toBeUndefined()
    })
    it('specifies short/mixed/empty-context fallbacks without claiming detected language', () => {
        const context = projectPublicLanguage()
        expect(context).toEqual({ recentUserPosts: [], publicProfiles: [], interfaceLanguage: 'English' })
        expect(automaticSocialLanguagePolicy).toContain('Very short text, names, numbers, emoji, quotations and borrowed words')
        expect(automaticSocialLanguagePolicy).toContain('when a tier is ambiguous, use the next tier')
        expect(automaticSocialLanguagePolicy).toContain('For mixed-language text')
        expect(automaticSocialLanguagePolicy).toContain('only as a last resort')
        expect(automaticSocialLanguagePolicy).toContain('Keep JSON keys and reaction identifiers exactly as specified')
    })
    it('includes at most five400-character user posts and four400-character public profiles, excluding character posts and private fields', () => {
        const state = fixture()
        Object.assign(state, { chats: 'PRIVATE_CHAT', memory: 'PRIVATE_MEMORY', lore: 'PRIVATE_LORE' })
        state.posts = Array.from({ length: 10 }, (_, i) => createSocialPost({ id: `persona${i}`, name: 'Mara' }, `${i}:` + 'f'.repeat(600)))
        state.posts.unshift(createSocialPost({ id: 'character:jun', characterId: 'jun', name: 'Jun' }, 'CHARACTER_LANGUAGE_MUST_NOT_DOMINATE'))
        state.cast = Array.from({ length: 6 }, (_, i) => ({ characterId: String(i), name: String(i), publicProfile: 'p'.repeat(600), desc: 'PRIVATE_DESCRIPTION' }))
        const cues = buildPublicLanguageContext(state, 'de')
        expect(cues.recentUserPosts).toHaveLength(5)
        expect(cues.recentUserPosts[0]).toMatch(/^0:/)
        expect(cues.recentUserPosts.every(text => text.length <= 400)).toBe(true)
        expect(cues.publicProfiles).toHaveLength(4)
        expect(cues.publicProfiles.every(text => text.length <= 400)).toBe(true)
        expect(cues.interfaceLanguage).toBe('German')
        expect(JSON.stringify(cues)).not.toMatch(/PRIVATE|CHARACTER_LANGUAGE/)
        expect(buildPublicLanguageContext(state, 'unknown').interfaceLanguage).toBe('English')
    })
    it('reprojects and bounds injected language cues at the transport boundary', () => {
        const state = fixture(), context = buildPublicContext(state, state.posts[0], state.cast[0])
        context.language = { recentUserPosts: Array(8).fill('<tool_call>' + 'x'.repeat(600)), publicProfiles: Array(7).fill('p'.repeat(600)), interfaceLanguage: 'PRIVATE_PROMPT' }
        Object.assign(context.language, { privateMemory: 'PRIVATE_MEMORY' })
        const text = socialMessages(context)[1].content
        const data = JSON.parse(text)
        expect(text).not.toContain('PRIVATE')
        expect(text).not.toContain('<tool_call>')
        expect(data.language.recentUserPosts).toHaveLength(5)
        expect(data.language.publicProfiles).toHaveLength(4)
        expect(data.language?.interfaceLanguage).toBe('English')
    })
    it('invalidates a pending reaction when its recent user-language cues change', async () => {
        const state = fixture()
        let resolve!: (value: string) => void
        const pending = new Promise<string>(done => { resolve = done })
        const generator = vi.fn(() => pending)
        const task = new SocialGeneration().generate(state, state.posts[0].id, generator)
        await Promise.resolve()
        state.posts.unshift(createSocialPost({ id: 'mara', name: 'Mara' }, 'Otro mensaje público.'))
        resolve('{"reaction":"like","comment":"Une réponse"}')
        expect(await task).toBe('cancelled')
        expect(state.posts[1].responses).toEqual([])
        expect(generator).toHaveBeenCalledOnce()
    })
    it('uses one generator call and passes the same snapshotted cues to preflight', async () => {
        const state = fixture(), generator = vi.fn(async (_context: PublicPublicationContext) => '{"text":"Un nouveau message public."}'), preflight = vi.fn(async (_context: PublicPublicationContext, _limits: SocialLimits) => {})
        await new SocialGeneration().publish(state, 'jun', generator, undefined, preflight, 'es')
        expect(generator).toHaveBeenCalledOnce()
        expect(generator.mock.calls[0][0]).toEqual(preflight.mock.calls[0][0])
        expect(generator.mock.calls[0][0].language?.interfaceLanguage).toBe('Spanish')
    })
})
