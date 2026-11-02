<script lang="ts">
    import { X, MessageCircle } from '@lucide/svelte'
    import { untrack } from 'svelte'
    import type { SocialTarget } from 'src/ts/social/socialInteractions'
    import type { SocialFeedState } from 'src/ts/social/socialFeed'
    import { DBState } from 'src/ts/stores.svelte'
    import { loadNativeRelationships } from 'src/ts/social/nativeRelationships'
    import SocialAvatar from './SocialAvatar.svelte'
    import WorldRelationships from './WorldRelationships.svelte'
    import SocialRelationships from './SocialRelationships.svelte'
    let { target, feed, personaId, onclose, onmessage, onpost }: {
        target?: SocialTarget; feed: SocialFeedState; personaId?: string
        onclose: () => void; onmessage: (id: string) => void; onpost: (id: string) => void
    } = $props()
    let dialog = $state<HTMLDialogElement>()
    let returnFocus: HTMLElement | undefined
    let posts = $derived(feed.posts.filter(post => post.author.id === target?.id && post.visibleToActorIds === undefined).length)
    let publicFacts = $derived(feed.cast.find(actor => actor.characterId === target?.characterId && (!actor.startingFactsVisibility || actor.startingFactsVisibility === 'public'))?.startingFacts)
    let contextKey = $derived.by(() => {
        const loaded = loadNativeRelationships(DBState.db.worldWorkspace?.relationshipWorkspace)
        return JSON.stringify([target?.id, personaId, loaded.status === 'ready' ? loaded.workspace.binding : loaded.status])
    })
    $effect(() => {
        if (target && !dialog?.open) {
            returnFocus = untrack(() => document.activeElement instanceof HTMLElement ? document.activeElement : undefined)
            dialog?.showModal()
        } else if (!target && dialog?.open) dialog.close()
    })
    function closed() {
        if (dialog?.open) return
        onclose()
        if (returnFocus?.isConnected && returnFocus.getClientRects().length) returnFocus.focus()
    }
</script>
<dialog bind:this={dialog} class="ew-profile-dialog" class:character-profile={!!target?.characterId} aria-labelledby="social-profile-heading" oncancel={event => { event.preventDefault(); onclose() }} onclose={closed} onkeydown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onclose() } }}>
    {#if target}
        <div class="ew-profile-cover"><span>{target.characterId ? 'Character profile' : 'Your profile'}</span><button class="ew-icon" aria-label="Close profile" onclick={onclose}><X size={20} /></button></div>
        <div class="ew-profile-content"><SocialAvatar name={target.name} image={target.image} size={80} /><h2 id="social-profile-heading">{target.name}</h2>{#if target.handle}<p class="ew-muted">@{target.handle}</p>{/if}<p class="ew-profile-bio">{target.publicProfile || 'No public profile added yet.'}</p>
            <div class="ew-profile-stats"><span><strong>{posts}</strong> public posts</span></div>
            {#if target.characterId}<div class="ew-actions"><button class="ew-button ew-primary" onclick={() => target?.characterId && onmessage(target.characterId)}><MessageCircle size={16} />Message</button></div>
                {#if publicFacts}<section aria-label="Public starting facts"><h3>Known in this world</h3><p class="ew-profile-bio">{publicFacts}</p></section>{/if}
                {#key contextKey}<WorldRelationships {feed} characterId={target.characterId} {personaId} {onpost} /><SocialRelationships {feed} characterId={target.characterId} {personaId} {onpost} />{/key}
            {/if}
        </div>
    {/if}
</dialog>
<style>
    .character-profile{width:min(680px,calc(100vw - 24px))}
    .ew-profile-cover span{text-transform:none;letter-spacing:normal;font-size:13px}
    .ew-profile-content{min-width:0}.ew-actions{margin-bottom:20px}
</style>
