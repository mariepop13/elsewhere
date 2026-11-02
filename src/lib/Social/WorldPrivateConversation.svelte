<script lang="ts">
    import './worldChatPresentation.css'
    import { untrack } from 'svelte'
    import { DBState, selectedCharID } from 'src/ts/stores.svelte'
    import ChatScreen from '../ChatScreens/ChatScreen.svelte'
    import WorldDialog from './WorldDialog.svelte'
    import WorldConversationVersions from './WorldConversationVersions.svelte'
    import type { WorldMessageReadState } from 'src/ts/social/worldMessages'
    let detailsOpen = $state(false)
    let versionsOpen = $state(false)
    import SocialAvatar from './SocialAvatar.svelte'
    import { ArrowLeft, LockKeyhole, BookOpen, Users } from '@lucide/svelte'
    import { worldConversationKey, type WorldConversation, type WorldChatDraft } from 'src/ts/social/worldNavigation.svelte'
    let { conversation, visible = true, onBack, onProfile, onKnowledge, onGroup, onOpenVariant, onNewVariant, readState }: {
        visible?: boolean
        conversation: WorldConversation
        onBack: () => void
        onProfile?: () => void
        onKnowledge: () => void
        onGroup?: () => void
        onOpenVariant: (chatId: string) => void
        onNewVariant: () => void
        readState?: WorldMessageReadState
    } = $props()
    // This instance must never bind an old local composer to a replacement save.
    const instanceDatabase = untrack(() => DBState.db)
    const character = $derived(DBState.db.characters[$selectedCharID])
    const chat = $derived(character?.chats[character.chatPage])
    const matches = $derived(DBState.db === instanceDatabase && character?.chaId === conversation.characterId && (!conversation.chatId || chat?.id === conversation.chatId))
    const personaName = $derived(chat?.bindedPersona ? DBState.db.personas.find(persona => persona.id === chat.bindedPersona)?.name ?? DBState.db.username : DBState.db.username)
    function currentDraft(): WorldChatDraft | undefined {
        if (!matches || !chat?.id || !character) return
        DBState.db.worldWorkspace ??= {}
        DBState.db.worldWorkspace.drafts ??= {}
        const key = worldConversationKey(character.chaId, chat.id)
        DBState.db.worldWorkspace.drafts[key] ??= { text: '', translatedText: '', attachments: [] }
        return DBState.db.worldWorkspace.drafts[key]
    }
    $effect(() => { if (matches && chat?.id) untrack(currentDraft) })
    const workspace = $derived(matches && chat?.id && character ? DBState.db.worldWorkspace?.drafts?.[worldConversationKey(character.chaId, chat.id)] : undefined)
</script>
<section class="world-private" aria-label="Private conversation">
    {#if matches && character && chat && workspace}
        <header class="world-conversation-heading">
            <button class="world-chat-icon" aria-label="Back to messages" onclick={onBack}><ArrowLeft size={18}/></button>
            {#if onProfile}<button class="world-chat-avatar" aria-label={`View profile for ${character.name}`} onclick={onProfile}><SocialAvatar name={character.name} image={character.image} size={40}/></button>{:else}<SocialAvatar name={character.name} image={character.image} size={40}/>{/if}
            <div class="world-chat-identity">{#if onProfile}<button class="world-chat-name" aria-label={`View profile for ${character.name}`} onclick={onProfile}><strong>{character.name}</strong></button>{:else}<strong>{character.name}</strong>{/if}<span><LockKeyhole size={12}/> Private {character.type === 'group' ? 'group' : 'conversation'}</span></div>
            <button type="button" class="world-chat-icon" aria-label={`Conversation details for ${character.name}`} aria-haspopup="dialog" aria-expanded={detailsOpen} onclick={() => detailsOpen = true}>Details</button>
        </header>
        <WorldDialog bind:open={detailsOpen} title="Conversation details" active={visible && matches} resetKey={chat} closeOnAction>
            <div class="world-conversation-details">
                <p>Speaking as {personaName}</p>
                <button onclick={() => { detailsOpen = false; versionsOpen = true }}>Conversation versions</button>
                {#if onProfile}<button onclick={onProfile}>Character profile</button>{/if}
                <button onclick={onKnowledge}><BookOpen size={14}/> Memory & knowledge</button>
                {#if character.type === 'group' && onGroup}<button onclick={onGroup}><Users size={18}/> Group details</button>{/if}
            </div>
        </WorldDialog>
        <WorldDialog bind:open={versionsOpen} title="Conversation versions" active={visible && matches} resetKey={chat}>
            <WorldConversationVersions {character} {readState}
                onOpen={chatId => { versionsOpen = false; onOpenVariant(chatId) }}
                onNew={() => { versionsOpen = false; onNewVariant() }} />
        </WorldDialog>
        <div class="world-conversation-engine"><ChatScreen presentation="world" {workspace} workspaceVisible={visible && matches}/></div>
    {:else}<div class="world-chat-empty"><p>This conversation is no longer available.</p><button onclick={onBack}>Back to messages</button></div>{/if}
</section>
<style>
    .world-private{height:100%;min-height:0;display:flex;flex-direction:column;background:var(--world-canvas,#102218);color:var(--world-text,#e0ebd5)}
    .world-conversation-heading{display:flex;align-items:center;gap:12px;padding:16px 24px;border-bottom:1px solid var(--world-line,#344a37);background:var(--world-panel,#172e21);flex:none;min-width:0}
    .world-chat-identity{text-align:left;min-height:44px;display:flex;flex-direction:column;gap:5px;flex:1;min-width:0}.world-chat-identity strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:17px}.world-chat-identity span{display:flex;gap:5px;align-items:center;font-size:12px;color:var(--world-muted,#a2b8a1)}
    .world-chat-avatar{flex:none;min-width:44px;min-height:44px}.world-chat-name{min-width:0;text-align:left;min-height:28px}.world-chat-icon{border:1px solid var(--world-line,#344a37);border-radius:8px;padding:8px;flex:none}.world-conversation-engine{min-height:0;flex:1;display:flex;overflow:hidden}.world-chat-empty{padding:24px}.world-chat-empty button{margin-top:12px}button:focus-visible{outline:2px solid var(--world-mint,#aed7b2);outline-offset:3px}
    .world-conversation-details{display:flex;flex-direction:column;gap:8px}.world-conversation-details button{display:flex;align-items:center;gap:8px}
    @media(max-width:700px){.world-conversation-heading{gap:8px;padding:12px}.world-chat-identity strong{font-size:15px}}
</style>
