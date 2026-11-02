import { describe, expect, it, vi } from 'vitest'
vi.mock('./socialTokenBudget', () => ({ preflightSocialContexts: async () => {}, preflightSocialPublication: async () => {} }))
import { buildPublicContext, createSocialFeed, createSocialPost, socialPersonaAuthor, SocialGeneration, type SocialFeedState } from './socialFeed'
import { buildPublicRelationshipContext, derivePublicRelationships, projectPublicRelationships, publicRelationshipPolicy } from './socialRelations'
import { socialMessages } from './socialPrompt'

function fixture(): SocialFeedState {
    const state = createSocialFeed()
    state.enabled = true
    state.cast = [{ characterId: 'jun', name: 'Jun', publicProfile: 'A reserved public gardener.' }, { characterId: 'sol', name: 'Sol', publicProfile: 'A skeptical public archivist.' }]
    state.posts = [createSocialPost({ id: 'mara', name: 'Mara' }, 'Un message public en français.')]
    return state
}
function addResponse(state: SocialFeedState, index = 0, actorIndex = 0, reaction: 'like' | 'love' | 'curious' | 'none' = 'curious', comment = 'A public question.') {
    state.posts[index].responses.push({ id: `response-${index}-${actorIndex}`, actor: { ...state.cast[actorIndex] }, reaction, comment, createdAt: 100 + index })
}

describe('public relationship evidence', () => {
    it('starts without invented relationships; declines and unattributed user likes are not affinity events', () => {
        const state = fixture()
        state.posts[0].liked = true
        state.posts[0].consideredActorIds = ['jun']
        addResponse(state, 0, 0, 'none', '')
        expect(derivePublicRelationships(state)).toEqual([])
    })
    it('groups stable persona/character identities, counts distinct threads and never derives romance from hearts', () => {
        const state = fixture()
        addResponse(state, 0, 0, 'love', '')
        let relations = derivePublicRelationships(state)
        expect(relations[0]).toMatchObject({ publicThreadCount: 1, familiarity: 'first_contact' })
        expect(relations[0].participants.map(p => p.id)).toEqual(['character:jun', 'persona:mara'])
        for (let index = 1; index < 4; index++) {
            state.posts.push(createSocialPost({ id: 'mara', name: 'Mara renamed' }, `Public thread ${index}`))
            addResponse(state, index)
            expect(derivePublicRelationships(state)[0].familiarity).toBe(index < 3 ? 'acquainted' : 'familiar')
        }
        relations = derivePublicRelationships(state)
        expect(relations).toHaveLength(1)
        expect(relations[0].publicThreadCount).toBe(4)
        expect(relations[0].participants.find(p => p.id === 'persona:mara')?.name).toBe('Mara renamed')
        expect(publicRelationshipPolicy).toContain('not affection, trust, hostility or romance')
    })
    it('supports reciprocal character contact while ignoring self replies', () => {
        const state = fixture()
        state.posts[0].author = { id: 'character:sol', characterId: 'sol', name: 'Sol' }
        addResponse(state)
        state.posts.push(createSocialPost({ id: 'character:jun', characterId: 'jun', name: 'Jun' }, 'Public Jun post'))
        addResponse(state, 1, 1)
        addResponse(state, 1, 0)
        const pair = derivePublicRelationships(state)[0]
        expect(pair.participants.map(p => p.id)).toEqual(['character:jun', 'character:sol'])
        expect(pair.publicThreadCount).toBe(2)
        expect(pair.interactions).toHaveLength(2)
    })
    it('distinguishes personas with identical display names and deduplicates actual event IDs on reload', () => {
        const state = fixture()
        addResponse(state)
        state.posts[0].responses.push({ ...state.posts[0].responses[0] })
        state.posts.push(createSocialPost({ id: 'other-persona', name: 'Mara' }, 'A different persona'))
        addResponse(state, 1)
        const before = derivePublicRelationships(state)
        expect(before).toHaveLength(2)
        expect(before.every(pair => pair.publicThreadCount === 1 && pair.interactions.length === 1)).toBe(true)
        expect(derivePublicRelationships(JSON.parse(JSON.stringify(state)))).toEqual(before)
        state.posts = state.posts.slice(1)
        expect(derivePublicRelationships(state)).toHaveLength(1)
    })
    it('does not inflate familiarity from multiple events in the same public thread', () => {
        const state = fixture()
        addResponse(state)
        state.posts[0].responses.push({ ...state.posts[0].responses[0], id: 'another-public-response' })
        expect(derivePublicRelationships(state)[0]).toMatchObject({ publicThreadCount: 1, familiarity: 'first_contact' })
    })
    it('bounds public relation context and reprojects fields without private card/persona memory', () => {
        const state = fixture()
        Object.assign(state, { memory: 'PRIVATE_MEMORY', chats: 'PRIVATE_CHAT' })
        Object.assign(state.cast[0], { desc: 'PRIVATE_CARD' })
        for (let i = 0; i < 5; i++) {
            const post = createSocialPost({ id: `persona${i}`, name: `Public ${i}` }, 'p'.repeat(700))
            Object.assign(post.author, { personaPrompt: 'PRIVATE_PERSONA' })
            state.posts.push(post)
            for (let j = 0; j < 4; j++) post.responses.push({ id: `${i}-${j}`, actor: state.cast[0], reaction: 'curious', comment: 'c'.repeat(500), createdAt: i * 10 + j })
        }
        const context = buildPublicRelationshipContext(state, state.cast[0])
        expect(context).toHaveLength(3)
        expect(context.every(pair => pair.recentInteractions.length === 2)).toBe(true)
        expect(context.flatMap(pair => pair.recentInteractions).every(event => event.post.length <= 240 && event.comment.length <= 240)).toBe(true)
        Object.assign(context[0], { privateMemory: 'PRIVATE' })
        Object.assign(context[0].partner, { privatePrompt: 'PRIVATE' })
        const messages = socialMessages({ ...buildPublicContext(state, state.posts[0], state.cast[0]), relationships: context })
        expect(JSON.stringify(messages)).not.toContain('PRIVATE')
        expect(messages[0].content).toContain(publicRelationshipPolicy)
        expect(projectPublicRelationships([{ ...context[0], publicThreadCount: 0 }])).toEqual([])
    })
    it('only derives changes after an atomic successful batch; failures and cancellation leave relations unchanged', async () => {
        const state = fixture(), batch = new SocialGeneration()
        const failed = vi.fn().mockResolvedValueOnce('{"reaction":"like","comment":""}').mockRejectedValueOnce(new Error('Network'))
        await expect(batch.generate(state, state.posts[0].id, failed)).rejects.toThrow('Network')
        expect(derivePublicRelationships(state)).toEqual([])
        await batch.generate(state, state.posts[0].id, async () => '{"reaction":"none","comment":""}')
        expect(derivePublicRelationships(state)).toEqual([])
        state.posts[0].consideredActorIds = []
        let resolve!: (value: string) => void
        const pending = new Promise<string>(done => { resolve = done })
        const task = batch.generate(state, state.posts[0].id, () => pending)
        await Promise.resolve(); batch.cancel();resolve('{"reaction":"like","comment":""}')
        expect(await task).toBe('cancelled')
        expect(derivePublicRelationships(state)).toEqual([])
        await batch.generate(state, state.posts[0].id, async () => '{"reaction":"curious","comment":"A public question"}')
        const relations = derivePublicRelationships(state)
        expect(relations).toHaveLength(2)
        await batch.generate(state, state.posts[0].id, async () => '{"reaction":"like","comment":""}')
        expect(derivePublicRelationships(state)).toEqual(relations)
    })
    it('discards a late result when relevant public relationship history changes elsewhere', async () => {
        const state = fixture()
        state.posts.push(createSocialPost({ id: 'mara', name: 'Mara' }, 'Another public thread'))
        let resolve!: (value: string) => void
        const pending = new Promise<string>(done => { resolve = done })
        const task = new SocialGeneration().generate(state, state.posts[0].id, () => pending)
        await Promise.resolve()
        addResponse(state, 1)
        resolve('{"reaction":"like","comment":""}')
        expect(await task).toBe('cancelled')
        expect(state.posts[0].responses).toEqual([])
    })
})

it('prioritizes the target author even when their public relationship is older than other contacts', () => {
    const state = fixture()
    for (let i = 0; i < 4; i++) {
        state.posts.push(createSocialPost({ id: `recent-${i}`, name: `Recent ${i}` }, 'Recent public thread'))
        addResponse(state, i + 1)
    }
    state.posts.push(createSocialPost({ id: 'mara', name: 'Mara' }, 'An older public exchange'))
    addResponse(state, 5)
    state.posts[5].responses[0].createdAt = 1
    expect(buildPublicRelationshipContext(state, state.cast[0]).some(pair => pair.partner.id === 'persona:mara')).toBe(false)
    const context = buildPublicContext(state, state.posts[0], state.cast[0])
    expect(context.relationships).toHaveLength(3)
    expect(context.relationships?.[0].partner.id).toBe('persona:mara')
})

it('uses one stable persona identity for current and explicit choices while retaining display and old snapshots', () => {
    const personas = [{ id: 'persona-uuid', name: 'Mara', icon: 'public.png', prompt: 'PRIVATE_PERSONA' }]
    const current = socialPersonaAuthor(personas, 0, -1, { name: 'Current public name', image: 'current.png' })
    const explicit = socialPersonaAuthor(personas, 0, 0, { name: 'Current public name', image: 'current.png' })
    expect(current.id).toBe(explicit.id)
    expect(current.name).toBe('Current public name')
    expect(explicit.name).toBe('Mara')
    expect(JSON.stringify([current, explicit])).not.toContain('PRIVATE')
    const state = fixture()
    state.posts = [createSocialPost(current, 'Current choice post'), createSocialPost(explicit, 'Explicit choice post')]
    addResponse(state, 0); addResponse(state, 1)
    expect(derivePublicRelationships(state)).toHaveLength(1)
    expect(derivePublicRelationships(state)[0].publicThreadCount).toBe(2)
    const legacy = createSocialPost({ id: 'persona:0', name: 'Mara' }, 'Legacy snapshot')
    const legacyBytes = JSON.stringify(legacy)
    state.posts.push(legacy)
    derivePublicRelationships(state)
    expect(JSON.stringify(legacy)).toBe(legacyBytes)
})
