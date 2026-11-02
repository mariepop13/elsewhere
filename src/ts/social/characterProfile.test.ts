import { describe, expect, it } from 'vitest'
import { resolveCharacterProfile, resolveProfilePersona, profilePublicInteractions, type ProfilePersonaDatabase } from './characterProfile'
import { createSocialFeed } from './socialFeed'

const database = (): ProfilePersonaDatabase => ({ selectedPersona: 0, personas: [{ id: 'alice', name: 'Alice' }, { id: 'bea', name: 'Bea' }], characters: [{ chaId: 'jun', type: 'character', name: 'Jun', chats: [{ id: 'main', bindedPersona: 'bea' }, { id: 'other' }] }] })
describe('character profile identity context', () => {
    it('uses the selected persona in the feed and the exact bound persona in a DM', () => {
        const db = database()
        expect(resolveProfilePersona(db)?.id).toBe('alice')
        expect(resolveProfilePersona(db, 'jun', 'main')?.id).toBe('bea')
        expect(resolveProfilePersona(db, 'jun', 'other')?.id).toBe('alice')
        expect(resolveProfilePersona(db, 'jun')?.id).toBe('alice')
    })
    it('fails closed for missing or ambiguous bound personas, missing chats and deleted cards', () => {
        const db = database(); db.characters[0].chats[0].bindedPersona = 'missing'
        expect(resolveProfilePersona(db, 'jun', 'main')).toBeUndefined()
        db.characters[0].chats[0].bindedPersona = 'bea'; db.personas.push({ id: 'bea', name: 'Duplicate' })
        expect(resolveProfilePersona(db, 'jun', 'main')).toBeUndefined()
        expect(resolveProfilePersona(db, 'jun', 'removed')).toBeUndefined()
        db.characters[0].trashTime = 1
        expect(resolveProfilePersona(db, 'jun', 'main')).toBeUndefined()
        db.personas[0].id = undefined
        expect(resolveProfilePersona(db)).toBeUndefined()
    })
    it('refuses ambiguous native card/chat identities', () => {
        const db = database(); db.characters[0].chats.push({ id: 'main', bindedPersona: 'alice' })
        expect(resolveProfilePersona(db, 'jun', 'main')).toBeUndefined()
        db.characters.push({ ...db.characters[0] })
        expect(resolveProfilePersona(db, 'jun', 'other')).toBeUndefined()
        expect(resolveCharacterProfile(createSocialFeed(), db.characters, 'jun')).toBeUndefined()
    })
    it('opens a native character outside the social cast without exposing its private fields or mutating data', () => {
        const db = database(), feed = createSocialFeed()
        Object.assign(db.characters[0], { desc: 'SECRET', notes: 'SECRET', globalLore: ['SECRET'] })
        const before = JSON.stringify({ db, feed }), profile = resolveCharacterProfile(feed, db.characters, 'jun')
        expect(profile).toMatchObject({ id: 'character:jun', characterId: 'jun', name: 'Jun', publicProfile: '' })
        expect(JSON.stringify(profile)).not.toContain('SECRET'); expect(JSON.stringify({ db, feed })).toBe(before)
        db.characters[0].type = 'group'; expect(resolveCharacterProfile(feed, db.characters, 'jun')).toBeUndefined()
    })
    it('uses only the current world public profile and retains public identity when the native card is missing', () => {
        const db = database(), first = createSocialFeed(), second = createSocialFeed()
        first.cast.push({ characterId: 'jun', name: 'World Jun', publicProfile: 'Public first world', startingFacts: 'PRIVATE', startingFactsVisibility: 'private' })
        second.cast.push({ characterId: 'jun', name: 'Other Jun', publicProfile: 'Public other world' })
        expect(resolveCharacterProfile(first, [], 'jun')?.publicProfile).toBe('Public first world')
        expect(resolveCharacterProfile(second, db.characters, 'jun')?.publicProfile).toBe('Public other world')
        expect(JSON.stringify(resolveCharacterProfile(first, db.characters, 'jun'))).not.toContain('PRIVATE')
    })
})

describe('public interactions stay inside the character/persona profile', () => {
    it('excludes other people and circle-only threads without altering the feed', () => {
        const feed = createSocialFeed()
        const post = (id: string, persona: string, character: string, restricted = false) => ({ id, author: { id: persona, name: persona }, text: id, createdAt: 1, liked: false, responses: [{ id: id + '-response', actor: { characterId: character, name: character, publicProfile: '' }, reaction: 'like' as const, comment: id + '-comment', createdAt: 1 }], ...(restricted ? { visibleToActorIds: [character] } : {}) })
        feed.posts = [post('allowed', 'alice', 'jun'), post('other-persona', 'bea', 'jun'), post('other-character', 'alice', 'nell'), post('restricted', 'alice', 'jun', true)]
        const before = JSON.stringify(feed), pairs = profilePublicInteractions(feed, 'jun', 'alice')
        expect(pairs).toHaveLength(1); expect(pairs[0].interactions.map(event => event.postId)).toEqual(['allowed'])
        expect(profilePublicInteractions(feed, 'jun')).toEqual([]); expect(JSON.stringify(feed)).toBe(before)
    })
})
