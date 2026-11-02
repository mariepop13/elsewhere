import type { WorldMessageReadState } from './worldMessages'

export type WorldPage = 'Feed' | 'Messages' | 'Library' | 'Settings'
export interface WorldConversation { characterId: string; chatId?: string }
export interface WorldConversationHeading { characterId: string; name: string; image?: string }
export type NativeWorldTool = 'memory' | 'lorebook' | 'character' | 'settings'

/** UI position only; private messages remain in the native database. */
export const worldNavigation = $state<{ page: WorldPage; conversation?: WorldConversation; conversationOpen: boolean; conversationObscured?: boolean }>({ page: 'Feed', conversationOpen: false })

export interface WorldChatDraft {
    text: string
    translatedText: string
    attachments: string[]
    scrollAnchor?: { messageId: string; offset: number }
    scrollTop?: number
    loadPages?: number
}
export interface WorldWorkspacePreferences {
    /** Private versioned relationship slot, preserved opaquely when unavailable. */
    relationshipWorkspace?: unknown
    defaultHome?: 'world' | 'classic'
    messageReadState?: WorldMessageReadState
    drafts?: Record<string, WorldChatDraft>
}
export function worldConversationKey(characterId: string, chatId: string): string {
    return JSON.stringify([characterId, chatId])
}
