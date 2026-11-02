import { describe, expect, it } from 'vitest'
import type { SocialFeedState } from './socialFeed'
import { projectPublicWorldKnowledge, resolveNativeKnowledge, worldMemoryEngine, type NativeKnowledgeDatabase } from './worldKnowledge'

const database = (): NativeKnowledgeDatabase => ({
    hypaV3: true, supaModelType: 'none', characters: [{ chaId: 'felix', name: 'Felix', chatPage: 1,
        supaMemory: true, globalLore: [{}], chats: [
            { id: 'old', name: 'Old', localLore: [], supaMemoryData: 'private summary' },
            { id: 'current', name: 'Current', localLore: [{}, {}], hypaV3Data: { summaries: [{}] } },
        ] }],
})

describe('world knowledge boundary', () => {
    it('projects only explicit public fields and hides private and paused facts', () => {
        const feed = { publicWorld: 'Public world', setup: { title: 'World', you: { name: 'Marie', publicProfile: 'Public persona', privateMemory: 'secret persona' } },
            cast: [
                { characterId: 'a', name: 'A', publicProfile: 'Public A', startingFacts: 'Public legacy facts', privateMemory: 'secret card' },
                { characterId: 'b', name: 'B', publicProfile: 'Public B', startingFacts: 'secret private facts', startingFactsVisibility: 'private' },
                { characterId: 'c', name: 'C', publicProfile: 'Public C', startingFacts: 'secret paused facts', startingFactsVisibility: 'paused' },
            ], chats: [{ text: 'secret chat' }], draft: 'secret draft' } as unknown as SocialFeedState
        const before = JSON.stringify(feed)
        const result = projectPublicWorldKnowledge(feed)
        expect(result.actors.map(actor => actor.facts)).toEqual(['Public legacy facts', '', ''])
        expect(result.actors.map(actor => actor.visibility)).toEqual(['public', 'private', 'paused'])
        expect(JSON.stringify(result)).not.toContain('secret')
        expect(JSON.stringify(feed)).toBe(before)
    })
    it('handles an absent social world without a native fallback', () => {
        expect(projectPublicWorldKnowledge().actors).toEqual([])
        expect(projectPublicWorldKnowledge().world).toBe('')
    })
    it('resolves the requested chat and reports metadata without private text', () => {
        const db = database()
        const before = JSON.stringify(db)
        const result = resolveNativeKnowledge(db, 'felix', 'old')
        expect(result).toMatchObject({ chatId: 'old', hasSupaSummary: true, hypaV3SummaryCount: 0 })
        expect(JSON.stringify(result)).not.toContain('private summary')
        expect(JSON.stringify(db)).toBe(before)
    })
    it('never substitutes another character or chat for a stale explicit identifier', () => {
        const db = database()
        expect(resolveNativeKnowledge(db, 'missing')).toBeUndefined()
        expect(resolveNativeKnowledge(db)).toBeUndefined()
        expect(resolveNativeKnowledge(db, 'felix', 'deleted')).toMatchObject({ hasChat: false, chatId: undefined, hasSupaSummary: false })
        expect(resolveNativeKnowledge(db, 'felix', '')?.hasChat).toBe(false)
        expect(resolveNativeKnowledge(db, 'felix')).toMatchObject({ chatId: 'current', chatLoreCount: 2, hypaV3SummaryCount: 1 })
        db.characters[0].chatPage = 9
        expect(resolveNativeKnowledge(db, 'felix')?.hasChat).toBe(false)
    })
    it('reports the native configured engine without generating or changing it', () => {
        expect(worldMemoryEngine({ hypaV3: true, hypav2: true })).toBe('Hypa V2')
        expect(worldMemoryEngine({ hypaV3: true, hypav2: true, hanuraiEnable: true, supaModelType: 'distilbart' })).toBe('Hanurai')
        expect(worldMemoryEngine({ hypav2: true })).toBe('Hypa V2')
        expect(worldMemoryEngine({ supaModelType: 'distilbart' })).toBe('Supa')
        expect(worldMemoryEngine({ supaModelType: 'none', hanuraiEnable: true })).toBe('Hanurai')
        expect(worldMemoryEngine({ supaModelType: 'none' })).toBe('None')
    })
})
