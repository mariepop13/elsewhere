<script lang="ts">
    import { doingChat } from 'src/ts/process/index.svelte'
    import { v4 } from 'uuid'
    import { DBState } from 'src/ts/stores.svelte'
    import { worldUnreadConversationCount, worldUnreadCount, worldHistoryLabel, type WorldMessageReadState, type WorldMessageConversation } from 'src/ts/social/worldMessages'
    import SocialAvatar from './SocialAvatar.svelte'
    import WorldGroupDetails from './WorldGroupDetails.svelte'
    let { onOpenConversation, onNewStory, activeConversation, readState, onReadStateChange }: {
        onOpenConversation: (characterId: string, chatId?: string) => void
        onNewStory: (characterId: string) => void
        activeConversation?: WorldMessageConversation
        readState: WorldMessageReadState
        onReadStateChange: (next: WorldMessageReadState) => void
    } = $props()
    let search = $state('')
    let filter: 'all' | 'direct' | 'groups' = $state('all')
    let expanded = $state('')
    let groupsOpen = $state('')
    let characters = $derived(DBState.db.characters.filter(c => !c.trashTime &&
        (filter === 'all' || (filter === 'groups' ? c.type === 'group' : c.type !== 'group')) &&
        c.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())))
    // Parent owns arrival reconciliation even while this list is hidden.
    function open(characterId: string, chatId?: string) {
        onOpenConversation(characterId, chatId)
    }

</script>
<section class="mx-auto w-full max-w-4xl p-4 text-textcolor md:p-6" aria-label="Private messages">
    <h1 class="text-2xl font-semibold">Messages</h1>
    <p class="mt-1 text-sm text-textcolor2">Private conversations, groups and stories.</p>
    <input class="mt-5 w-full rounded-xl border border-borderc bg-bgcolor px-4 py-3" type="search" placeholder="Search conversations" aria-label="Search conversations" bind:value={search} />
    <div class="my-4 flex gap-2" aria-label="Conversation filters">
        {#each [['all', 'All'], ['direct', 'Direct'], ['groups', 'Groups']] as item}
            <button class="rounded-full border border-borderc px-4 py-2 text-sm" class:bg-selected={filter === item[0]} aria-pressed={filter === item[0]} onclick={() => filter = item[0] as typeof filter}>{item[1]}</button>
        {/each}
    </div>
    <div class="space-y-3">
        {#each characters as character (character.chaId)}
            {@const currentChat = character.chats[character.chatPage]}
            {@const unread = worldUnreadConversationCount(readState, character.chaId)}
            <article class="overflow-hidden rounded-xl border border-borderc bg-bgcolor" class:border-selected={activeConversation?.characterId === character.chaId}>
                <div class="flex items-center gap-3 p-4">
                    <button class="flex min-w-0 flex-1 items-center gap-3 text-left" onclick={() => open(character.chaId, currentChat?.id)}>
                        <SocialAvatar name={character.name || 'Unnamed conversation'} image={character.image} size={48} />
                        <span class="min-w-0 flex-1"><span class="block truncate font-semibold">{character.name || 'Unnamed conversation'}</span><span class="block text-sm text-textcolor2">{character.type === 'group' ? `${character.characters.length} participants` : 'Direct conversation'} · {character.chats.length} {character.chats.length === 1 ? 'story' : 'stories'}</span></span>
                        {#if unread}<span class="rounded-full bg-selected px-2 py-1 text-xs" aria-label={`${unread} unread conversations`}>{unread}</span>{/if}
                    </button>
                    <button class="rounded-lg border border-borderc p-2 text-sm" aria-expanded={expanded === character.chaId} onclick={() => expanded = expanded === character.chaId ? '' : character.chaId}>Stories</button>
                    {#if character.type === 'group'}<button class="rounded-lg border border-borderc p-2 text-sm" aria-expanded={groupsOpen === character.chaId} onclick={() => groupsOpen = groupsOpen === character.chaId ? '' : character.chaId}>Group</button>{/if}
                </div>
                {#if expanded === character.chaId}
                    <div class="space-y-2 border-t border-borderc p-4">
                        {#each character.chats as chat, index}
                            {@const persona = DBState.db.personas.find(p => p.id === chat.bindedPersona)}
                            {@const count = chat.id ? worldUnreadCount(readState, character.chaId, chat.id) : 0}
                            <div class="flex flex-wrap items-center gap-2">
                                <button class="min-w-0 flex-1 rounded-lg px-3 py-2 text-left hover:bg-selected" onclick={() => { if (!chat.id) chat.id = v4(); open(character.chaId, chat.id) }}>{worldHistoryLabel(chat, index)}{#if count}<span class="ml-2 text-xs">Unread</span>{/if}</button>
                                <select class="max-w-full rounded-lg border border-borderc bg-bgcolor p-2 text-sm" disabled={$doingChat} aria-label={`Persona for ${worldHistoryLabel(chat, index)}`} bind:value={chat.bindedPersona}>
                                    <option value="">Current persona</option>
                                    {#if chat.bindedPersona && !persona}<option value={chat.bindedPersona}>Unavailable bound persona</option>{/if}
                                    {#each DBState.db.personas.filter(p => p.id) as p}<option value={p.id}>{p.name}</option>{/each}
                                </select>
                            </div>
                        {/each}
                        <button class="rounded-lg border border-borderc px-3 py-2 text-sm" disabled={$doingChat} onclick={() => onNewStory(character.chaId)}>New empty story</button>
                    </div>
                {/if}
                {#if groupsOpen === character.chaId}<div class="p-4 pt-0"><WorldGroupDetails characterId={character.chaId} /></div>{/if}
            </article>
        {:else}
            <p class="py-12 text-center text-textcolor2">{search ? 'No matching conversations.' : 'Your existing conversations will appear here.'}</p>
        {/each}
    </div>
</section>
