import type { Database } from './storage/database.svelte'

export function captureCharacterActionTarget(db: Database, identifier: string | number) {
    const character = typeof identifier === 'string'
        ? db.characters.find(card => card.chaId === identifier)
        : db.characters[identifier]
    if (!character) return
    return { db, character }
}

export function currentCharacterActionIndex(target: ReturnType<typeof captureCharacterActionTarget>, db: Database): number {
    return target && target.db === db ? db.characters.indexOf(target.character) : -1
}
