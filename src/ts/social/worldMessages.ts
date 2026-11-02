import type { Chat, Database, Message } from '../storage/database.svelte'

export interface WorldMessageReadEntry {
    seenMessageIds: string[]
    unreadMessageIds: string[]
}
export interface WorldMessageReadState {
    version: 1
    conversations: Record<string, WorldMessageReadEntry>
}
export interface WorldMessageConversation { characterId: string; chatId?: string }
export interface WorldMessageReadUpdate { key: string; entry: WorldMessageReadEntry }
export type WorldMessagesDatabase = Pick<Database, 'characters'>

export function createWorldMessageReadState(): WorldMessageReadState {
    return { version: 1, conversations: {} }
}
export function worldConversationKey(characterId: string, chatId: string): string {
    return JSON.stringify([characterId, chatId])
}
function incoming(message: Message): boolean {
    return message.role === 'char' && !message.isComment && !message.disabled &&
        !(message as Message & { ownsend?: boolean }).ownsend
}
function sameEntry(a: WorldMessageReadEntry | undefined, b: WorldMessageReadEntry): boolean {
    return !!a && a.seenMessageIds.length === b.seenMessageIds.length &&
        a.unreadMessageIds.length === b.unreadMessageIds.length &&
        a.seenMessageIds.every((id, i) => id === b.seenMessageIds[i]) &&
        a.unreadMessageIds.every((id, i) => id === b.unreadMessageIds[i])
}

/** Native message IDs only. Never inspect private text or infer arrivals from dates/counts. */
export function reconcileWorldMessages(
    db: WorldMessagesDatabase,
    state: WorldMessageReadState = createWorldMessageReadState(),
    visibleConversation?: WorldMessageConversation,
): WorldMessageReadState {
    const conversations = { ...state.conversations }
    let changed = state.version !== 1
    const present = new Set<string>()
    for (const character of db.characters) {
        if (character.trashTime) continue
        for (const chat of character.chats) {
            if (!chat.id) continue
            const key = worldConversationKey(character.chaId, chat.id)
            present.add(key)
            const previous = state.conversations[key]
            const visible = visibleConversation?.characterId === character.chaId &&
                (visibleConversation.chatId === chat.id ||
                    (!visibleConversation.chatId && character.chats[character.chatPage] === chat))
            const currentIncoming = new Set(chat.message.filter(incoming).flatMap(m => m.chatId ? [m.chatId] : []))
            const seen = new Set(previous?.seenMessageIds ?? [])
            const unread = new Set(previous?.unreadMessageIds.filter(id => currentIncoming.has(id)) ?? [])
            for (const message of chat.message) {
                if (!message.chatId) continue
                // A streaming response becomes an arrival only once it is complete.
                if (previous && chat.isStreaming && incoming(message) && !seen.has(message.chatId)) continue
                if (previous && !visible && !seen.has(message.chatId) && incoming(message)) unread.add(message.chatId)
                seen.add(message.chatId)
            }
            if (visible) unread.clear()
            const entry = { seenMessageIds: [...seen], unreadMessageIds: [...unread] }
            if (!sameEntry(previous, entry)) { conversations[key] = entry; changed = true }
        }
    }
    // Retain seen tombstones, but removed histories must not contribute unread badges.
    for (const [key, entry] of Object.entries(conversations)) {
        if (!present.has(key) && entry.unreadMessageIds.length) {
            conversations[key] = { seenMessageIds: entry.seenMessageIds, unreadMessageIds: [] }
            changed = true
        }
    }
    return changed ? { version: 1, conversations } : state
}
export function diffWorldMessageReadState(previous: WorldMessageReadState, next: WorldMessageReadState): WorldMessageReadUpdate[] {
    return Object.entries(next.conversations).filter(([key, entry]) => !sameEntry(previous.conversations[key], entry))
        .map(([key, entry]) => ({ key, entry }))
}
export function worldUnreadCount(state: WorldMessageReadState, characterId: string, chatId?: string): number {
    return Object.entries(state.conversations).reduce((total, [key, entry]) => {
        let owner: string, history: string
        try { [owner, history] = JSON.parse(key) as [string, string] } catch { return total }
        return total + (owner === characterId && (!chatId || chatId === history) ? entry.unreadMessageIds.length : 0)
    }, 0)
}
export function worldHistoryLabel(chat: Chat, index: number): string {
    return chat.name?.trim() || `Story ${index + 1}`
}

/** The navigation badge counts stories with arrivals, never individual messages. */
export function worldUnreadConversationCount(state: WorldMessageReadState, characterId?: string): number {
    return Object.entries(state.conversations).reduce((total, [key, entry]) => {
        let owner: string
        try { [owner] = JSON.parse(key) as [string, string] } catch { return total }
        return total + (entry.unreadMessageIds.length && (!characterId || owner === characterId) ? 1 : 0)
    }, 0)
}
