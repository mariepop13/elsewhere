<script lang="ts">
    import { X, MessageCircle, Users } from '@lucide/svelte'
    import type { SocialTarget } from 'src/ts/social/socialInteractions'
    import type { SocialFeedState } from 'src/ts/social/socialFeed'
    import { derivePublicRelationships } from 'src/ts/social/socialRelations'
    import SocialAvatar from './SocialAvatar.svelte'
    let { target, feed, onclose, onmessage, onrelationships }: { target?: SocialTarget; feed: SocialFeedState; onclose: () => void; onmessage: (id: string) => void; onrelationships: () => void } = $props()
    let dialog = $state<HTMLDialogElement>()
    let posts = $derived(feed.posts.filter(post => post.author.id === target?.id).length)
    let relationships = $derived(derivePublicRelationships(feed).filter(pair => pair.participants.some(person => person.id === (target?.characterId ? `character:${target.characterId}` : `persona:${target?.id}`))).length)
    $effect(() => { if (target) { if (!dialog?.open) dialog?.showModal() } else if (dialog?.open) dialog.close() })
</script>
<dialog bind:this={dialog} class="ew-profile-dialog" aria-labelledby="social-profile-heading" oncancel={onclose} onclose={onclose} onkeydown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onclose() } }}>
    {#if target}
        <div class="ew-profile-cover"><span>YOUR WORLD, YOUR PEOPLE</span><button class="ew-icon" aria-label="Close profile" onclick={onclose}><X size={20} /></button></div>
        <div class="ew-profile-content"><SocialAvatar name={target.name} image={target.image} size={80} /><h2 id="social-profile-heading">{target.name}</h2><p class="ew-muted">@{target.handle}</p><p class="ew-profile-bio">{target.publicProfile || 'No public profile added yet.'}</p>
            <div class="ew-profile-stats"><span><strong>{posts}</strong> public posts</span><span><strong>{relationships}</strong> public connections</span></div>
            <div class="ew-actions">{#if target.characterId}<button class="ew-button ew-primary" onclick={() => target?.characterId && onmessage(target.characterId)}><MessageCircle size={16} />Message</button>{/if}<button class="ew-button" onclick={onrelationships}><Users size={16} />Relationships</button></div>
        </div>
    {/if}
</dialog>
