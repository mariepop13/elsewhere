import type { SocialFeedState } from './socialFeed'
import { derivePublicRelationships } from './socialRelations'
import type { SocialTarget } from './socialInteractions'

interface ProfileCard {
    chaId: string; type?: string; name: string; image?: string; trashTime?: number
    chats: { id?: string; bindedPersona?: string }[]
}
export interface ProfilePersonaDatabase {
    selectedPersona: number
    personas: { id?: string; name: string; icon?: string }[]
    characters: ProfileCard[]
}
/** A missing bound persona must not silently become another person's viewpoint. */
export function resolveProfilePersona(db: ProfilePersonaDatabase, characterId?: string, chatId?: string) {
    if (chatId) {
        const cards = db.characters.filter(card => card.chaId === characterId && card.type !== 'group' && !card.trashTime)
        if (cards.length !== 1) return undefined
        const chats = cards[0].chats.filter(chat => chat.id === chatId)
        if (chats.length !== 1) return undefined
        const chat = chats[0]
        if (chat.bindedPersona) { const matches = db.personas.filter(persona => persona.id === chat.bindedPersona); return matches.length === 1 ? matches[0] : undefined }
    }
    const persona = db.personas[db.selectedPersona]
    return persona?.id && db.personas.filter(item => item.id === persona.id).length === 1 ? persona : undefined
}
/** Public profile fields only; native prompts, descriptions and histories never become a bio. */
export function resolveCharacterProfile(feed: SocialFeedState, cards: ProfileCard[], characterId: string): SocialTarget | undefined {
    const actor = feed.cast.find(actor => actor.characterId === characterId)
    const matches = cards.filter(card => card.chaId === characterId && card.type !== 'group' && !card.trashTime)
    if (matches.length > 1) return undefined
    const card = matches[0]
    if (!actor && !card) return undefined
    return { id: `character:${characterId}`, characterId, name: actor?.name ?? card!.name,
        image: actor?.image ?? card?.image, handle: feed.handles?.[`character:${characterId}`] ?? '', publicProfile: actor?.publicProfile ?? '' }
}

/** The character profile never receives a global or restricted interaction list. */
export function profilePublicInteractions(feed: SocialFeedState, characterId: string, personaId?: string) {
    if (!personaId) return []
    return derivePublicRelationships({ ...feed, posts: feed.posts.filter(post => post.visibleToActorIds === undefined) })
        .filter(pair => pair.participants.some(person => person.id === `character:${characterId}`) && pair.participants.some(person => person.id === `persona:${personaId}`))
}
