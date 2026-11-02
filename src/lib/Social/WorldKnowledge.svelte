<script lang="ts">
    import { DBState } from 'src/ts/stores.svelte'
    import { projectPublicWorldKnowledge, resolveNativeKnowledge, type OpenNativeKnowledgeTool, type WorldKnowledgeScope } from 'src/ts/social/worldKnowledge'
    import SocialRelationships from './SocialRelationships.svelte'

    let { scope, characterId, chatId, onOpenNativeTool, onOpenModelSettings, onOpenPost }: {
        scope: WorldKnowledgeScope
        characterId?: string
        chatId?: string
        onOpenNativeTool?: OpenNativeKnowledgeTool
        onOpenModelSettings?: () => void
        onOpenPost?: (postId: string) => void
    } = $props()
    let publicKnowledge = $derived(scope === 'public' ? projectPublicWorldKnowledge(DBState.db.socialFeed) : undefined)
    let native = $derived(scope === 'private' ? resolveNativeKnowledge(DBState.db, characterId, chatId) : undefined)
    const buttonClass = 'rounded-lg border border-textcolor/15 bg-textcolor/5 px-4 py-2 text-left text-sm hover:bg-textcolor/10 disabled:opacity-50'
</script>

<section class="space-y-5 text-textcolor" aria-label={scope === 'public' ? 'Public knowledge and relationships' : 'Private memory and knowledge'}>
    <div>
        <h2 class="text-xl font-semibold">{scope === 'public' ? 'World knowledge' : 'Memory & knowledge'}</h2>
        <p class="mt-2 text-sm text-textcolor2">{scope === 'public' ? 'Public · Only profiles and facts explicitly added to this social world appear here.' : 'Private · Native conversation memory and lorebooks stay separate from the public feed.'}</p>
    </div>
    {#if scope === 'public' && publicKnowledge}
        <div class="space-y-3 rounded-xl border border-textcolor/10 p-4">
            <h3 class="font-semibold">{publicKnowledge.title || 'Your world'} <span class="text-xs font-normal text-textcolor2">Public</span></h3>
            {#if publicKnowledge.world}<p class="whitespace-pre-wrap break-words text-sm">{publicKnowledge.world}</p>{:else}<p class="text-sm text-textcolor2">No public world description added yet.</p>{/if}
            {#each [{ label: 'Time and era', value: publicKnowledge.era }, { label: 'Places', value: publicKnowledge.places }, { label: 'Mood', value: publicKnowledge.mood }, { label: 'Starting situation', value: publicKnowledge.startingSituation }] as entry}
                {#if entry.value}<div><h4 class="text-sm font-medium">{entry.label}</h4><p class="whitespace-pre-wrap break-words text-sm text-textcolor2">{entry.value}</p></div>{/if}
            {/each}
            {#if publicKnowledge.you}<div><h4 class="text-sm font-medium">{publicKnowledge.you.name} · Public profile</h4><p class="whitespace-pre-wrap break-words text-sm text-textcolor2">{publicKnowledge.you.profile || 'No public profile added yet.'}</p></div>{/if}
        </div>
        {#each publicKnowledge.actors as actor (actor.characterId)}
            <div class="space-y-3 rounded-xl border border-textcolor/10 p-4">
                <h3 class="font-semibold">{actor.name}</h3>
                <div><h4 class="text-sm font-medium">Public profile</h4><p class="whitespace-pre-wrap break-words text-sm text-textcolor2">{actor.profile || 'No public profile added yet.'}</p></div>
                <div><h4 class="text-sm font-medium">Starting facts · {actor.visibility === 'public' ? 'Public' : actor.visibility === 'private' ? 'Private note' : 'Paused'}</h4>
                    <p class="whitespace-pre-wrap break-words text-sm text-textcolor2">{actor.visibility === 'public' ? actor.facts || 'No public starting facts added yet.' : actor.visibility === 'private' ? 'Private note content is hidden here and excluded from public generation.' : 'Paused facts are hidden here and excluded from public generation.'}</p>
                </div>
            </div>
        {/each}
        {#if DBState.db.socialFeed}
            <SocialRelationships feed={DBState.db.socialFeed} initialExpanded={true} onpost={onOpenPost} />
        {/if}
    {:else if scope === 'private'}
        {#if native}
            <div class="space-y-4 rounded-xl border border-textcolor/10 p-4">
                <h3 class="font-semibold">{native.characterName} <span class="text-xs font-normal text-textcolor2">Private</span></h3>
                {#if native.hasChat}
                    <p class="text-sm text-textcolor2">{native.chatName || 'Untitled conversation'}</p>
                    <div><h4 class="text-sm font-medium">Conversation memory</h4>
                        <p class="mt-1 text-sm text-textcolor2">Configured engine: {native.engine}. Character memory: {native.enabledForCharacter ? 'enabled' : 'disabled'}.</p>
                        <p class="mt-1 text-sm text-textcolor2">Saved data: {native.hypaV3SummaryCount} Hypa V3 summaries, {native.hypaV2SummaryCount} Hypa V2 chunks; Supa summary {native.hasSupaSummary ? 'present' : 'empty'}.</p>
                        <button class={buttonClass + ' mt-3'} disabled={!onOpenNativeTool} onclick={() => onOpenNativeTool?.('memory', native.characterId, native.chatId)}>Open native memory editor</button>
                    </div>
                    <div><h4 class="text-sm font-medium">Lorebooks</h4>
                        <p class="mt-1 text-sm text-textcolor2">{native.characterLoreCount} character entries · {native.chatLoreCount} conversation entries</p>
                        <button class={buttonClass + ' mt-3'} disabled={!onOpenNativeTool} onclick={() => onOpenNativeTool?.('lorebook', native.characterId, native.chatId)}>Open character & conversation lorebooks</button>
                    </div>
                {:else}
                    <p class="text-sm text-textcolor2">This conversation is unavailable. Choose an existing conversation to open its memory and lorebooks.</p>
                {/if}
                <details class="border-t border-textcolor/10 pt-3">
                    <summary class="cursor-pointer text-sm font-medium">Advanced native tools</summary>
                    <p class="my-3 text-sm text-textcolor2">Use the existing editors for global lorebooks, memory models and context settings. Hanurai uses native retrieval settings; saved summaries remain in their original editors.</p>
                    <div class="flex flex-wrap gap-2">
                        <button class={buttonClass} disabled={!onOpenNativeTool} onclick={() => onOpenNativeTool?.('character', native.characterId, native.chatId)}>Open character configuration</button>
                        <button class={buttonClass} disabled={!onOpenNativeTool} onclick={() => onOpenNativeTool?.('settings', native.characterId, native.chatId)}>Open global lorebooks & settings</button>
                        {#if onOpenModelSettings}<button class={buttonClass} onclick={onOpenModelSettings}>Open memory model settings</button>{/if}
                    </div>
                </details>
            </div>
        {:else}
            <p class="rounded-xl border border-textcolor/10 p-4 text-sm text-textcolor2">Choose an existing character conversation to inspect its private memory and knowledge.</p>
            {#if onOpenModelSettings}<button class={buttonClass} onclick={onOpenModelSettings}>Open memory model settings</button>{/if}
        {/if}
    {/if}
</section>
