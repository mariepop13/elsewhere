import type { SocialFeedState } from './socialFeed'
import type { NativeWorldTool } from './worldNavigation.svelte'

export type WorldKnowledgeScope = 'public' | 'private'
export type OpenNativeKnowledgeTool = (kind: NativeWorldTool, characterId: string, chatId?: string) => void
export type KnowledgeVisibility = 'public' | 'private' | 'paused'
export interface PublicKnowledgeActor {
    characterId: string
    name: string
    profile: string
    facts: string
    visibility: KnowledgeVisibility
}

export interface PublicWorldKnowledge {
    title: string
    world: string
    era: string
    places: string
    mood: string
    startingSituation: string
    you?: { name: string; profile: string }
    actors: PublicKnowledgeActor[]
}

/** Explicit social fields only: never accept native cards, chats or memory as input. */
export function projectPublicWorldKnowledge(feed?: SocialFeedState): PublicWorldKnowledge {
    return {
        title: feed?.setup?.title ?? '',
        world: feed?.publicWorld ?? '',
        era: feed?.setup?.era ?? '',
        places: feed?.setup?.places ?? '',
        mood: feed?.setup?.mood ?? '',
        startingSituation: feed?.setup?.startingSituation ?? '',
        you: feed?.setup?.you ? { name: feed.setup.you.name, profile: feed.setup.you.publicProfile } : undefined,
        actors: (feed?.cast ?? []).map((actor): PublicKnowledgeActor => {
            const visibility = actor.startingFactsVisibility ?? 'public'
            return { characterId: actor.characterId, name: actor.name, profile: actor.publicProfile,
                facts: visibility === 'public' ? actor.startingFacts ?? '' : '', visibility }
        }),
    }
}

export interface NativeKnowledgeChat {
    id?: string
    name: string
    localLore?: readonly unknown[]
    supaMemoryData?: string
    hypaV2Data?: { mainChunks: readonly unknown[] }
    hypaV3Data?: { summaries: readonly unknown[] }
}
export interface NativeKnowledgeCharacter {
    chaId: string
    name: string
    type?: string
    chats: readonly NativeKnowledgeChat[]
    chatPage: number
    globalLore?: readonly unknown[]
    supaMemory?: boolean
}
export interface NativeKnowledgeDatabase {
    characters: readonly NativeKnowledgeCharacter[]
    hypaV3?: boolean
    hypav2?: boolean
    hanuraiEnable?: boolean
    supaModelType?: string
}
export type WorldMemoryEngine = 'Hypa V3' | 'Hypa V2' | 'Hanurai' | 'Supa' | 'None'

export function worldMemoryEngine(db: Omit<NativeKnowledgeDatabase, 'characters'>): WorldMemoryEngine {
    // Match the native process/index memory dispatch order.
    if (db.hanuraiEnable) return 'Hanurai'
    if (db.hypav2) return 'Hypa V2'
    if (db.hypaV3) return 'Hypa V3'
    if (db.supaModelType && db.supaModelType !== 'none') return 'Supa'
    return 'None'
}

/** Resolve exactly; an explicit missing ID must never select another private chat. */
export function resolveNativeKnowledge(db: NativeKnowledgeDatabase, characterId?: string, chatId?: string) {
    const character = characterId ? db.characters.find(card => card.chaId === characterId) : undefined
    if (!character) return undefined
    const chat = chatId !== undefined ? character.chats.find(value => value.id === chatId) : character.chats[character.chatPage]
    return {
        characterId: character.chaId,
        characterName: character.name,
        chatId: chat?.id,
        chatName: chat?.name,
        hasChat: !!chat,
        engine: worldMemoryEngine(db),
        enabledForCharacter: !!character.supaMemory,
        characterLoreCount: character.globalLore?.length ?? 0,
        chatLoreCount: chat?.localLore?.length ?? 0,
        hypaV2SummaryCount: chat?.hypaV2Data?.mainChunks.length ?? 0,
        hypaV3SummaryCount: chat?.hypaV3Data?.summaries.length ?? 0,
        hasSupaSummary: !!chat?.supaMemoryData?.trim(),
    }
}
