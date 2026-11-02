import { describe, expect, it, vi } from 'vitest'
vi.mock('./socialTokenBudget', () => ({ preflightSocialContexts: async () => {}, preflightSocialPublication: async () => {} }))
import { createSocialFeed, createSocialPost, buildPublicContext, buildPublicPublicationContext, SocialGeneration } from './socialFeed'
import { addSocialComment, createSocialQuote, toggleSocialRepost, socialTimeline, ensureSocialHandles, socialTargets, splitSocialMentions, MAX_SOCIAL_COMMENTS } from './socialInteractions'
import { publicSocialActor, socialAssetReferences, createSocialSetupDraft, applySocialSetup } from './socialSetup'
import { derivePublicRelationships } from './socialRelations'
const you = { id: 'native-persona', name: 'Mara', image: 'assets/you.png', privatePrompt: 'PRIVATE' }
const actor = { characterId: 'jun', name: 'Jun', publicProfile: 'Public gardener', image: 'assets/jun.png' }
const fixture = () => { const feed = createSocialFeed(); feed.enabled = true; feed.cast = [{ ...actor }]; feed.posts = [createSocialPost(you, 'Lantern festival')]; return feed }

describe('persistent social interactions', () => {
    it('keeps old saves usable and roundtrips shared canonical comments, reposts and drafts', () => {
        const feed = fixture(), post = feed.posts[0]
        expect(socialTimeline(feed)).toHaveLength(1)
        addSocialComment(post, you, 'Hello')
        toggleSocialRepost(feed, post.id, you)
        feed.commentDrafts = { [post.id]: { text: 'Unfinished', parentId: post.comments![0].id } }
        const saved = JSON.parse(JSON.stringify(feed)), timeline = socialTimeline(saved)
        expect(timeline).toHaveLength(2)
        expect(timeline[0].post).toBe(timeline[1].post)
        expect(saved.commentDrafts[post.id].text).toBe('Unfinished')
        expect(JSON.stringify(saved)).not.toContain('PRIVATE')
        expect(toggleSocialRepost(saved, post.id, you)).toBe(false)
        expect(socialTimeline(saved)).toHaveLength(1)
    })
    it('does not fabricate a deleted original or double relation evidence via reposts', () => {
        const feed = fixture(), post = feed.posts[0]
        post.responses.push({ id: 'reply', actor, reaction: 'curious', comment: 'What time?', createdAt: 10 })
        toggleSocialRepost(feed, post.id, you)
        addSocialComment(post, you, 'At dusk', 'reply')
        const pair = derivePublicRelationships(feed)[0]
        expect(pair.interactions).toHaveLength(2)
        expect(pair.publicThreadCount).toBe(1)
        expect(pair.interactions.find(event => event.comment === 'At dusk')?.to.id).toBe('character:jun')
        feed.posts = []
        expect(socialTimeline(feed)[0].post).toBeUndefined()
        expect(derivePublicRelationships(feed)).toEqual([])
        expect(() => toggleSocialRepost(feed, post.id, you)).toThrow()
    })
    it('validates reply parents and bounds without discarding a draft', () => {
        const post = fixture().posts[0]
        expect(() => addSocialComment(post, you, 'Reply', 'missing')).toThrow()
        expect(() => addSocialComment(post, you, ' ')).toThrow()
        expect(() => addSocialComment(post, you, 'x'.repeat(1001))).toThrow()
        const first = addSocialComment(post, you, 'Hello')
        expect(addSocialComment(post, { id: 'another', name: 'Visitor' }, 'Reply', first.id).parentId).toBe(first.id)
        post.comments = Array.from({ length: MAX_SOCIAL_COMMENTS }, () => first)
        expect(() => addSocialComment(post, you, 'Over limit')).toThrow()
    })
    it('quotes one public level, snapshots original display and cannot widen a circle', () => {
        const feed = fixture(), source = feed.posts[0]
        source.visibleToActorIds = ['jun', 'other']
        Object.assign(source.author, { hidden: 'PRIVATE' })
        const quote = createSocialQuote(you, 'A new moment', source, ['jun', 'outsider'])
        source.text = 'Changed later'
        expect(quote.quote?.text).toBe('Lantern festival')
        expect(quote.visibleToActorIds).toEqual(['jun'])
        expect(createSocialQuote(you, 'Another quote', quote).quote?.text).toBe('A new moment')
        expect(JSON.stringify(quote)).not.toContain('PRIVATE')
        expect(() => createSocialQuote(you, 'No access', source, ['outsider'])).toThrow()
    })
    it('allocates persistent handles for native identities, collision, rename and unsafe dictionary keys', () => {
        const feed = fixture()
        ensureSocialHandles(feed, [you, { id: 'another', name: 'Mára' }, { id: '__proto__', name: 'Constructor' }])
        expect(feed.handles?.['another']).toBe('mara_2')
        expect(feed.handles?.['__proto__']).toBe('constructor')
        ensureSocialHandles(feed, [{ ...you, name: 'Renamed' }])
        expect(feed.handles?.[you.id]).toBe('mara')
        const targets = socialTargets(feed, you)
        expect(splitSocialMentions('Hi @MARA!', targets)[1].target?.id).toBe(you.id)
        expect(splitSocialMentions('<script> @unknown', targets).every(part => !part.target)).toBe(true)
    })
    it('keeps restricted posts and comments out of outsiders publication and relation context', () => {
        const feed = fixture(), source = feed.posts[0]
        source.text = 'CIRCLE_SECRET'; source.visibleToActorIds = ['other']
        addSocialComment(source, you, 'CIRCLE_COMMENT')
        expect(() => buildPublicContext(feed, source, actor)).toThrow()
        expect(JSON.stringify(buildPublicPublicationContext(feed, actor))).not.toContain('CIRCLE')
        source.visibleToActorIds = ['jun']
        expect(buildPublicContext(feed, source, actor).comments[0].comment).toBe('CIRCLE_COMMENT')
    })
    it('uses only public starting facts and retains all saved portrait references', () => {
        expect(publicSocialActor({ ...actor, startingFacts: 'PRIVATE', startingFactsVisibility: 'private' }).publicProfile).not.toContain('PRIVATE')
        expect(publicSocialActor({ ...actor, startingFacts: 'PAUSED', startingFactsVisibility: 'paused' }).publicProfile).not.toContain('PAUSED')
        const feed = fixture(), post = feed.posts[0]
        addSocialComment(post, { id: 'past', name: 'Past', image: 'assets/comment.png' }, 'Saved comment')
        post.quote = { postId: 'gone', author: { id: 'old', name: 'Old', image: 'assets/quote.png' }, text: 'Snapshot', createdAt: 0 }
        toggleSocialRepost(feed, post.id, { id: 'rep', name: 'Rep', image: 'assets/repost.png' })
        expect(socialAssetReferences(feed)).toEqual(expect.arrayContaining(['assets/comment.png', 'assets/quote.png', 'assets/repost.png']))
    })
    it('roundtrips optional world fields and adds explicit public context only', () => {
        const feed = fixture(), draft = createSocialSetupDraft(feed, you)
        Object.assign(draft, { title: 'Garden City', era: 'Future', places: 'Lantern market', mood: 'Cozy & playful' })
        applySocialSetup(feed, draft)
        expect(createSocialSetupDraft(JSON.parse(JSON.stringify(feed)), you)).toEqual(draft)
        expect(buildPublicPublicationContext(feed, actor).publicWorld).toContain('Lantern market')
    })
    for (const phase of ['preflight', 'provider']) for (const audience of [[], ['jun', 'outsider']]) it(`cancels audience changes during ${phase}: ${audience.length}`, async () => {
        const feed = fixture(), post = feed.posts[0]; post.visibleToActorIds = ['jun']
        let release!: () => void, started!: () => void
        const wait = new Promise<void>(resolve => release = resolve), ready = new Promise<void>(resolve => started = resolve)
        const pause = async () => { started(); await wait }
        const generate = vi.fn(async () => { if (phase === 'provider') await pause(); return JSON.stringify({ reaction: 'like', comment: 'Hello' }) })
        const pending = new SocialGeneration().generate(feed, post.id, generate, () => true, phase === 'preflight' ? pause : async () => {})
        await ready; post.visibleToActorIds = audience; release()
        expect(await pending).toBe('cancelled')
        expect(post.responses).toEqual([])
        if (phase === 'preflight') expect(generate).not.toHaveBeenCalled()
    })
})
