import type { Database } from './storage/database.svelte'

/** Greeting rows use index -1 and have no saved Message to mutate. */
export function captureMessageActionTarget(db: Database, characterIndex: number, messageIndex: number) {
    if (!Number.isInteger(messageIndex) || messageIndex < 0) return
    const character = db.characters[characterIndex]
    const chat = character?.chats[character.chatPage]
    const message = chat?.message[messageIndex]
    if (!character || !chat || !message) return
    return { db, character, chat, message, messageIndex }
}

export type MessageActionTarget = ReturnType<typeof captureMessageActionTarget>

/** Do not redirect a delayed click or confirmation to a different save/story. */
export function isMessageActionTargetCurrent(target: MessageActionTarget, db: Database, characterIndex: number): boolean {
    if (!target || db !== target.db) return false
    const character = db.characters[characterIndex]
    return character === target.character && character.chats[character.chatPage] === target.chat &&
        target.chat.message[target.messageIndex] === target.message
}
