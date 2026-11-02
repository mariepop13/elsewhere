import { describe, expect, it } from 'vitest'
import type { Database } from './storage/database.svelte'
import { captureMessageActionTarget, isMessageActionTargetCurrent } from './messageActions'
import { captureCharacterActionTarget, currentCharacterActionIndex } from './characterActions'
function fixture() {
    return { characters: [{ chaId: 'jun', chatPage: 0, chats: [
        { id: 'first', message: [{ role: 'char', data: 'Legacy reply without chatId or disabled' }, { role: 'user', data: 'Second message', chatId: 'second' }] },
        { id: 'other', message: [{ role: 'char', data: 'Different story' }] },
    ] }, { chaId: 'nell', chatPage: 0, chats: [{ id: 'nell-story', message: [{ role: 'char', data: 'Nell reply' }] }] }] } as unknown as Database
}
describe('native message action ownership', () => {
    it.each([-1, -2, 2, 1.5, NaN])('has no mutation target for greeting or invalid index %s', index => {
        const db = fixture(), before = JSON.stringify(db)
        expect(captureMessageActionTarget(db, 0, index)).toBeUndefined()
        expect(JSON.stringify(db)).toBe(before)
    })
    it('does not need or invent legacy optional fields', () => {
        const db = fixture(), before = JSON.stringify(db), target = captureMessageActionTarget(db, 0, 0)
        expect(target?.message.data).toContain('Legacy')
        expect(isMessageActionTargetCurrent(target, db, 0)).toBe(true)
        expect(JSON.stringify(db)).toBe(before)
    })
    it('rejects missing or deselected character', () => {
        const db = fixture()
        expect(captureMessageActionTarget(db, -1, 0)).toBeUndefined()
        expect(captureMessageActionTarget(db, 99, 0)).toBeUndefined()
        expect(isMessageActionTargetCurrent(captureMessageActionTarget(db, 0, 0), db, -1)).toBe(false)
    })
    it('does not redirect a delayed action to a switched character', () => {
        const db = fixture(), target = captureMessageActionTarget(db, 0, 0)
        expect(isMessageActionTargetCurrent(target, db, 1)).toBe(false)
    })
    it('does not redirect a delayed action to another story', () => {
        const db = fixture(), target = captureMessageActionTarget(db, 0, 0)
        db.characters[0].chatPage = 1
        expect(isMessageActionTargetCurrent(target, db, 0)).toBe(false)
    })
    it('rejects replacement saves and same-id replacement owners', () => {
        const db = fixture(), target = captureMessageActionTarget(db, 0, 0)
        expect(isMessageActionTargetCurrent(target, fixture(), 0)).toBe(false)
        db.characters[0].chats[0] = structuredClone(db.characters[0].chats[0])
        expect(isMessageActionTargetCurrent(target, db, 0)).toBe(false)
    })
    it('does not act on a new message shifted into the clicked index', () => {
        const db = fixture(), target = captureMessageActionTarget(db, 0, 0)
        db.characters[0].chats[0].message.splice(0, 1)
        expect(isMessageActionTargetCurrent(target, db, 0)).toBe(false)
    })
    it('rejects a deleted character or same-id replacement', () => {
        const db = fixture(), target = captureMessageActionTarget(db, 0, 0)
        db.characters[0] = structuredClone(db.characters[0])
        expect(isMessageActionTargetCurrent(target, db, 0)).toBe(false)
        db.characters.splice(0, 1)
        expect(isMessageActionTargetCurrent(target, db, 0)).toBe(false)
    })
})
describe('character confirmation ownership', () => {
    it('captures only an existing character', () => {
        const db = fixture()
        expect(captureCharacterActionTarget(db, -1)).toBeUndefined()
        expect(captureCharacterActionTarget(db, 'missing')).toBeUndefined()
    })
    it('resolves the clicked card after indices shift', () => {
        const db = fixture(), target = captureCharacterActionTarget(db, 1)
        db.characters.splice(0, 1)
        expect(currentCharacterActionIndex(target, db)).toBe(0)
    })
    it('rejects removed objects and identical-id replacements', () => {
        const db = fixture(), target = captureCharacterActionTarget(db, 'jun')
        db.characters[0] = structuredClone(db.characters[0])
        expect(currentCharacterActionIndex(target, db)).toBe(-1)
    })
    it('does not restore an old save after a confirmation', () => {
        const db = fixture(), target = captureCharacterActionTarget(db, 0)
        expect(currentCharacterActionIndex(target, fixture())).toBe(-1)
    })
})
