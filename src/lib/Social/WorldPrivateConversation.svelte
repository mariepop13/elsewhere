<script lang="ts">
    import { untrack } from 'svelte'
    import { DBState, selectedCharID } from 'src/ts/stores.svelte'
    import ChatScreen from '../ChatScreens/ChatScreen.svelte'
    import SocialAvatar from './SocialAvatar.svelte'
    import { ArrowLeft, LockKeyhole, BookOpen, Users } from '@lucide/svelte'
    import { worldConversationKey, type WorldConversation, type WorldChatDraft } from 'src/ts/social/worldNavigation.svelte'
    let { conversation, visible = true, onBack, onProfile, onKnowledge, onGroup }: {
        visible?: boolean
        conversation: WorldConversation
        onBack: () => void
        onProfile?: () => void
        onKnowledge: () => void
        onGroup?: () => void
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
            <SocialAvatar name={character.name} image={character.image} size={40}/>
            <div class="world-chat-identity"><strong>{character.name}</strong><span><LockKeyhole size={12}/> Private {character.type === 'group' ? 'group' : 'conversation'}</span></div>
            {#if onProfile}<button class="world-chat-action" onclick={onProfile}>Public profile</button>{/if}
            {#if character.type === 'group' && onGroup}<button class="world-chat-icon" aria-label="Group details" onclick={onGroup}><Users size={18}/></button>{/if}
        </header>
        <div class="world-conversation-context"><span>Story: {chat.name || 'Untitled conversation'}</span><span>Speaking as {personaName}</span><button onclick={onKnowledge}><BookOpen size={14}/> Memory & knowledge</button></div>
        <div class="world-conversation-engine"><ChatScreen presentation="world" {workspace} workspaceVisible={visible && matches}/></div>
    {:else}<div class="world-chat-empty"><p>This conversation is no longer available.</p><button onclick={onBack}>Back to messages</button></div>{/if}
</section>
<style>
    .world-private{height:100%;min-height:0;display:flex;flex-direction:column;background:var(--world-canvas,#102218);color:var(--world-text,#e0ebd5)}
    .world-conversation-heading{display:flex;align-items:center;gap:12px;padding:16px 24px;border-bottom:1px solid var(--world-line,#344a37);background:var(--world-panel,#172e21);flex:none;min-width:0}
    .world-chat-identity{display:flex;flex-direction:column;gap:5px;flex:1;min-width:0}.world-chat-identity strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:17px}.world-chat-identity span{display:flex;gap:5px;align-items:center;font-size:12px;color:var(--world-muted,#a2b8a1)}
    .world-chat-icon,.world-chat-action{border:1px solid var(--world-line,#344a37);border-radius:8px;padding:8px;flex:none}.world-chat-action{font-size:12px}.world-conversation-context{display:flex;align-items:center;flex-wrap:wrap;gap:14px;padding:10px 24px;background:var(--world-panel,#172e21);border-bottom:1px solid var(--world-line,#344a37);font-size:12px;color:var(--world-muted,#a2b8a1);flex:none}.world-conversation-context button{display:flex;align-items:center;gap:6px;margin-left:auto;color:var(--world-mint,#aed7b2)}.world-conversation-engine{min-height:0;flex:1;display:flex;overflow:hidden}.world-chat-empty{padding:24px}.world-chat-empty button{margin-top:12px}button:focus-visible{outline:2px solid var(--world-mint,#aed7b2);outline-offset:3px}
    @media(max-width:700px){.world-conversation-heading{gap:8px;padding:12px}.world-chat-action{max-width:80px}.world-conversation-context{padding:8px 12px;gap:8px;font-size:11px}.world-chat-identity strong{font-size:15px}}
</style>
