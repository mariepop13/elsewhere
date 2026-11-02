import { describe, expect, it } from 'vitest'
import { createWorldMessageReadState, reconcileWorldMessages, worldConversationKey, worldUnreadCount, diffWorldMessageReadState, worldUnreadConversationCount, type WorldMessagesDatabase } from './worldMessages'
function fixture(): WorldMessagesDatabase {
    return { characters: [{ chaId: 'a', name: 'A', chatPage: 0, chats: [{ id: 'story', message: [{ role: 'char', chatId: 'old', data: 'PRIVATE' }] }] }] } as WorldMessagesDatabase
}
describe('native private conversation read state', () => {
    it('baselines history and returns unchanged identity on repeated reconciliation', () => {
        const db = fixture(), state = reconcileWorldMessages(db, createWorldMessageReadState())
        expect(worldUnreadCount(state, 'a')).toBe(0)
        expect(reconcileWorldMessages(db, state)).toBe(state)
        expect(JSON.stringify(state)).not.toContain('PRIVATE')
    })
    it('counts stable arrivals once, excluding ownsend, users, comments and disabled messages', () => {
        const db = fixture(), state = reconcileWorldMessages(db, createWorldMessageReadState())
        db.characters[0].chats[0].message.push(
            { role: 'user', chatId: 'own', data: '' },
            { role: 'char', chatId: 'reply', data: '' },
            { role: 'char', chatId: 'reply', data: 'duplicate' },
            { role: 'char', chatId: 'comment', data: '', isComment: true },
            { role: 'char', chatId: 'disabled', data: '', disabled: true },
            { role: 'char', data: 'no stable id' },
        )
        db.characters[0].chats[0].message.push({ role: 'char', chatId: 'own-char', data: '', ownsend: true } as never)
        const next = reconcileWorldMessages(db, state)
        expect(worldUnreadCount(next, 'a', 'story')).toBe(1)
        expect(diffWorldMessageReadState(state, next)).toHaveLength(1)
        expect(reconcileWorldMessages(db, next)).toBe(next)
    })
    it('reads only the visible story and prunes deleted arrivals', () => {
        const db = fixture()
        db.characters[0].chats.push({ id: 'second', message: [], name: '', localLore: [], note: '' })
        const state = reconcileWorldMessages(db, createWorldMessageReadState())
        for (const chat of db.characters[0].chats) chat.message.push({ role: 'char', chatId: chat.id + '-new', data: '' })
        const next = reconcileWorldMessages(db, state, { characterId: 'a', chatId: 'story' })
        expect(worldUnreadCount(next, 'a', 'story')).toBe(0)
        expect(worldUnreadCount(next, 'a', 'second')).toBe(1)
        db.characters[0].chats[1].message = []
        expect(worldUnreadCount(reconcileWorldMessages(db, next), 'a')).toBe(0)
    })
    it('baselines new branches and preserves seen IDs across deletion/restoration and DB replacement', () => {
        const db = fixture(), state = reconcileWorldMessages(db, createWorldMessageReadState())
        db.characters[0].chats.push({ ...db.characters[0].chats[0], id: 'branch' })
        const branched = reconcileWorldMessages(db, state)
        expect(worldUnreadCount(branched, 'a')).toBe(0)
        const restored = JSON.parse(JSON.stringify(db)) as WorldMessagesDatabase
        restored.characters[0].chats[0].message = []
        const removed = reconcileWorldMessages(restored, branched)
        restored.characters[0].chats[0].message = db.characters[0].chats[0].message
        expect(worldUnreadCount(reconcileWorldMessages(restored, removed), 'a')).toBe(0)
        expect(worldConversationKey('a:b', 'c')).not.toBe(worldConversationKey('a', 'b:c'))
    })
    it('clears unread badges for removed stories while retaining tombstones', () => {
        const db = fixture(), state = reconcileWorldMessages(db, createWorldMessageReadState())
        db.characters[0].chats[0].message.push({ role: 'char', chatId: 'new', data: '' })
        const next = reconcileWorldMessages(db, state)
        const saved = db.characters[0].chats.pop()!
        const removed = reconcileWorldMessages(db, next)
        expect(worldUnreadCount(removed, 'a')).toBe(0)
        db.characters[0].chats.push(saved)
        expect(worldUnreadCount(reconcileWorldMessages(db, removed), 'a')).toBe(0)
    })
    it('waits for streamed responses to complete and never counts edits as arrivals', () => {
        const db = fixture(), state = reconcileWorldMessages(db, createWorldMessageReadState())
        const chat = db.characters[0].chats[0]
        chat.isStreaming = true
        chat.message.push({ role: 'char', chatId: 'stream', data: 'partial' })
        const streaming = reconcileWorldMessages(db, state)
        expect(worldUnreadCount(streaming, 'a')).toBe(0)
        chat.isStreaming = false
        const complete = reconcileWorldMessages(db, streaming)
        expect(worldUnreadCount(complete, 'a')).toBe(1)
        chat.message[0].data = 'edited'
        expect(reconcileWorldMessages(db, complete)).toBe(complete)
    })
    it('counts conversations rather than arrivals and keeps unrelated saves independent', () => {
        const db = fixture(), baseline = reconcileWorldMessages(db, createWorldMessageReadState())
        db.characters[0].chats[0].message.push({ role: 'char', chatId: 'one', data: '' }, { role: 'char', chatId: 'two', data: '' })
        const arrived = reconcileWorldMessages(db, baseline)
        expect(worldUnreadCount(arrived, 'a')).toBe(2)
        expect(worldUnreadConversationCount(arrived)).toBe(1)
        expect(worldUnreadConversationCount(reconcileWorldMessages(db, arrived, { characterId: 'a', chatId: 'story' }))).toBe(0)
        expect(worldUnreadConversationCount(reconcileWorldMessages(db, createWorldMessageReadState()))).toBe(0)
    })

})
