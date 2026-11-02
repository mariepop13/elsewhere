<script lang="ts">
    import { DBState } from 'src/ts/stores.svelte'
    import { worldUnreadConversationCount, type WorldMessageReadState, type WorldMessageConversation } from 'src/ts/social/worldMessages'
    import SocialAvatar from './SocialAvatar.svelte'
    let { onOpenConversation, activeConversation, readState }: {
        onOpenConversation: (characterId: string, chatId?: string) => void
        activeConversation?: WorldMessageConversation
        readState: WorldMessageReadState
    } = $props()
    let search = $state('')
    let filter: 'all' | 'direct' | 'groups' = $state('all')
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
    <p class="mt-1 text-sm text-textcolor2">Your private conversations, all in one place.</p>
    <input class="mt-5 w-full rounded-xl border border-borderc bg-bgcolor px-4 py-3" type="search" placeholder="Search conversations" aria-label="Search conversations" bind:value={search} />
    <div class="my-4 flex gap-2" aria-label="Conversation filters">
        {#each [['all', 'All'], ['direct', 'Direct'], ['groups', 'Groups']] as item}
            <button class="rounded-full border border-borderc px-4 py-2 text-sm" class:bg-selected={filter === item[0]} aria-pressed={filter === item[0]} onclick={() => filter = item[0] as typeof filter}>{item[1]}</button>
        {/each}
    </div>
    <div class="space-y-3">
        {#each characters as character (character.chaId)}
            {@const currentChat = character.chats[character.chatPage]}
            {@const lastMessage = currentChat?.message.at(-1)}
            {@const preview = typeof lastMessage?.data === 'string' ? lastMessage.data.replace(/\s+/g, ' ').trim() : ''}
            {@const unread = worldUnreadConversationCount(readState, character.chaId)}
            <article class="overflow-hidden rounded-xl border border-borderc bg-bgcolor" class:border-selected={activeConversation?.characterId === character.chaId}>
                <div class="flex items-center gap-3 p-4">
                    <button class="flex min-w-0 flex-1 items-center gap-3 text-left" onclick={() => open(character.chaId, currentChat?.id)}>
                        <SocialAvatar name={character.name || 'Unnamed conversation'} image={character.image} size={48} />
                        <span class="min-w-0 flex-1"><span class="block truncate font-semibold">{character.name || 'Unnamed conversation'}</span><span class="block text-sm text-textcolor2">{character.type === 'group' ? `${character.characters.length} participants` : 'Direct conversation'}</span>{#if preview}<span class="mt-1 block truncate text-sm text-textcolor2">{preview}</span>{/if}</span>
                        {#if unread}<span class="rounded-full bg-selected px-2 py-1 text-xs" aria-label={`${unread} unread conversations`}>{unread}</span>{/if}
                    </button>
                </div>
            </article>
        {:else}
            <p class="py-12 text-center text-textcolor2">{search ? 'No matching conversations.' : 'Your existing conversations will appear here.'}</p>
        {/each}
    </div>
</section>
