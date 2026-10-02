import { describe, expect, it, vi } from 'vitest'
vi.mock('./socialTokenBudget', () => ({ preflightSocialContexts: async () => {}, preflightSocialPublication: async () => {} }))
import { createSocialFeed, createSocialPost, buildPublicContext, buildPublicPublicationContext } from './socialFeed'
import { applySocialSetup, createSocialSetupDraft } from './socialSetup'
import { socialMessages } from './socialPrompt'

const author = { id: 'persona-stable', name: 'You', image: 'assets/original.png', personaPrompt: 'PRIVATE_PERSONA' }
const fixture = () => {
    const feed = createSocialFeed()
    feed.cast = [{ characterId: 'native-card-id', name: 'Jun', image: 'assets/card.png', publicProfile: 'Public gardener.' }]
    feed.posts = [createSocialPost(author, 'A public post')]
    feed.draft = 'Unfinished post'
    feed.maxContext = 8000
    return feed
}

describe('persistent social world setup', () => {
    it('opens old saves without importing cards/private persona data or changing the feed', () => {
        const feed = fixture(), before = JSON.stringify(feed)
        const draft = createSocialSetupDraft(feed, author)
        draft.cast[0].publicProfile = 'Unsaved'
        draft.you.name = 'Unsaved name'
        expect(JSON.stringify(feed)).toBe(before)
        expect(JSON.stringify(draft)).not.toContain('PRIVATE_PERSONA')
        expect(createSocialSetupDraft(feed, author).cast[0].publicProfile).toBe('Public gardener.')
    })
    it('saves and reloads profile photo, stable native IDs and public facts, preserving posts/drafts/budgets', () => {
        const feed = fixture(), posts = feed.posts
        const draft = createSocialSetupDraft(feed, author)
        Object.assign(draft, { title: 'Garden city', startingSituation: 'Lantern festival tonight.' })
        Object.assign(draft.you, { name: 'Mara', image: 'assets/new-photo.png', publicProfile: 'A public visitor.' })
        draft.cast[0].startingFacts = 'Jun knows Mara from the public garden.'
        applySocialSetup(feed, draft)
        expect(feed.posts).toBe(posts)
        expect(feed.draft).toBe('Unfinished post')
        expect(feed.maxContext).toBe(8000)
        expect(feed.cast[0].characterId).toBe('native-card-id')
        const reloaded = JSON.parse(JSON.stringify(feed))
        expect(createSocialSetupDraft(reloaded, author)).toEqual(draft)
        expect(author.name).toBe('You')
        expect(author.image).toBe('assets/original.png')
    })
    it('rejects invalid setup atomically, including duplicates and excessive fields', () => {
        for (const mutate of [
            (d: ReturnType<typeof createSocialSetupDraft>) => { d.title = '' },
            (d: ReturnType<typeof createSocialSetupDraft>) => { d.cast.push({ ...d.cast[0] }) },
            (d: ReturnType<typeof createSocialSetupDraft>) => { d.cast[0].publicProfile = ' ' },
            (d: ReturnType<typeof createSocialSetupDraft>) => { d.startingSituation = 'x'.repeat(1201) },
        ]) {
            const feed = fixture(), before = JSON.stringify(feed), draft = createSocialSetupDraft(feed, author)
            draft.title = 'Valid world'
            mutate(draft)
            expect(() => applySocialSetup(feed, draft)).toThrow()
            expect(JSON.stringify(feed)).toBe(before)
        }
    })
    it('includes only explicitly public starting facts in existing prompts and context preflight', () => {
        const feed = fixture(), draft = createSocialSetupDraft(feed, author)
        draft.title = 'City'
        draft.you.publicProfile = 'Public visitor'
        draft.startingSituation = 'Opening night'
        draft.cast[0].startingFacts = 'Public acquaintances'
        applySocialSetup(feed, draft)
        Object.assign(feed.setup!.you, { personaPrompt: 'PRIVATE_PROMPT' })
        Object.assign(feed.cast[0], { desc: 'PRIVATE_CARD', chats: 'PRIVATE_CHAT' })
        const reaction = buildPublicContext(feed, feed.posts[0], feed.cast[0])
        const publication = buildPublicPublicationContext(feed, feed.cast[0])
        for (const context of [reaction, publication]) {
            expect(context.publicWorld).toContain('Opening night')
            expect(context.publicWorld).toContain('Public visitor')
            expect(context.actor.publicProfile).toContain('Public acquaintances')
            expect(JSON.stringify(context)).not.toContain('PRIVATE')
            expect(JSON.stringify(context)).not.toContain('assets/')
        }
        expect(JSON.stringify(socialMessages(reaction))).not.toContain('PRIVATE')
    })
})
