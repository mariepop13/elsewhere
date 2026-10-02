<script lang="ts">
    import { Users, ChevronDown } from '@lucide/svelte'
    import { language } from 'src/lang'
    import { derivePublicRelationships, type PublicFamiliarity } from 'src/ts/social/socialRelations'
    import type { SocialFeedState, SocialReactionKind } from 'src/ts/social/socialFeed'
    import SocialAvatar from './SocialAvatar.svelte'

    let { feed }: { feed: SocialFeedState } = $props()
    let copy = $derived(language.social)
    let relationships = $derived(derivePublicRelationships(feed))
    let expanded = $state(false)
    let visiblePairs = $state(6)
    let visibleEvents = $state<Record<string, number>>({})
    const stageLabel = (stage: PublicFamiliarity) => ({ first_contact: copy.firstContact, acquainted: copy.acquainted, familiar: copy.familiar })[stage]
    const reactionLabel = (reaction: SocialReactionKind) => ({ like: copy.likeReaction, love: copy.loveReaction, curious: copy.curiousReaction, none: copy.noneReaction })[reaction]
</script>

<details class="mb-5 rounded-xl border border-textcolor/10 bg-textcolor/5" bind:open={expanded}>
    <summary class="flex cursor-pointer list-none items-center gap-3 p-4">
        <Users size={22} />
        <span class="min-w-0 grow font-semibold">{copy.relationships} <span class="text-xs font-normal text-textcolor2">({relationships.length})</span></span>
        <ChevronDown size={18} class={expanded ? 'rotate-180' : ''} />
    </summary>
    {#if expanded}
        <div class="space-y-4 border-t border-textcolor/10 p-4">
            <p class="text-sm text-textcolor2">{copy.relationshipHint}</p>
            <p class="text-xs text-textcolor2">{copy.relationshipEvidence}</p>
            {#if !relationships.length}<p class="text-sm">{copy.relationshipEmpty}</p>{/if}
            {#each relationships.slice(0, visiblePairs) as pair (pair.id)}
                <details class="rounded-lg border border-textcolor/10">
                    <summary class="cursor-pointer p-3">
                        <span class="font-medium break-words">{pair.participants.map(participant => participant.name).join(' ↔ ')}</span>
                        <span class="mt-1 block text-xs text-textcolor2">{stageLabel(pair.familiarity)} · {pair.publicThreadCount} {copy.publicThreads}</span>
                    </summary>
                    <ol class="space-y-4 border-t border-textcolor/10 p-3" aria-label={copy.relationshipHistory}>
                        {#each pair.interactions.slice(0, visibleEvents[pair.id] ?? 5) as event (event.id)}
                            <li class="flex gap-2">
                                <SocialAvatar name={event.from.name} size={30} />
                                <div class="min-w-0 grow">
                                    <p class="break-words text-sm"><span class="font-semibold">{event.from.name}</span> → {event.to.name} · {reactionLabel(event.reaction)}</p>
                                    <time class="text-xs text-textcolor2" datetime={new Date(event.createdAt).toISOString()}>{new Date(event.createdAt).toLocaleString()}</time>
                                    <p class="mt-1 whitespace-pre-wrap break-words text-xs text-textcolor2">{event.post.slice(0, 240)}{event.post.length > 240 ? '…' : ''}</p>
                                    {#if event.comment}<p class="mt-1 whitespace-pre-wrap break-words text-sm">{event.comment}</p>{/if}
                                    <button class="mt-2 text-left text-xs underline underline-offset-4" onclick={() => document.getElementById(`social-post-${event.postId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>{copy.sourcePost}</button>
                                </div>
                            </li>
                        {/each}
                    </ol>
                    {#if pair.interactions.length > (visibleEvents[pair.id] ?? 5)}<button class="m-3 rounded-lg bg-textcolor/5 px-3 py-2 text-sm" onclick={() => visibleEvents[pair.id] = (visibleEvents[pair.id] ?? 5) + 5}>{copy.showMoreHistory}</button>{/if}
                </details>
            {/each}
            {#if relationships.length > visiblePairs}<button class="rounded-lg bg-textcolor/5 px-3 py-2 text-sm" onclick={() => visiblePairs += 6}>{copy.showMoreRelationships}</button>{/if}
        </div>
    {/if}
</details>
