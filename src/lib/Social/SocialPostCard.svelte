<script lang="ts">
    import { tick } from 'svelte'
    import { Heart, MessageCircle, Repeat2, MoreHorizontal, ArrowUpRight, Sparkles, X, Reply } from '@lucide/svelte'
    import type { SocialAuthor, SocialPost } from 'src/ts/social/socialFeed'
    import { type SocialRepost, type SocialTarget, type SocialCommentDraft, MAX_SOCIAL_COMMENT_LENGTH } from 'src/ts/social/socialInteractions'
    import SocialAvatar from './SocialAvatar.svelte'
    import SocialText from './SocialText.svelte'
    import SocialMentionInput from './SocialMentionInput.svelte'
    let { post, repost, targets, you, reposted, repostCount, draft, busy, canGenerate, eligible, maxResponse, onprofile, onrepost, onquote, oncomment, onreact, oncancel, ondelete }: {
        post: SocialPost; repost?: SocialRepost; targets: SocialTarget[]; you: SocialAuthor; reposted: boolean; repostCount: number; draft: SocialCommentDraft;
        busy: boolean; canGenerate: boolean; eligible: number; maxResponse?: number;
        onprofile: (target: SocialTarget) => void; onrepost: () => void; onquote: () => void; oncomment: (text: string, parentId?: string) => boolean;
        onreact: () => void; oncancel: () => void; ondelete: () => void;
    } = $props()
    let commentsOpen = $state(false)
    let deleteOpen = $state(false)
    let commentInput = $state<HTMLTextAreaElement>()
    let handle = $derived(targets.find(target => target.id === post.author.id)?.handle ?? '')
    let comments = $derived([
        ...post.responses.filter(response => response.comment.trim()).map(response => ({ id: response.id, author: { id: `character:${response.actor.characterId}`, characterId: response.actor.characterId, name: response.actor.name, image: response.actor.image }, text: response.comment, createdAt: response.createdAt, parentId: undefined as string | undefined })),
        ...(post.comments ?? [])].sort((a, b) => a.createdAt - b.createdAt))
    let thread = $derived.by(() => {
        const result: { comment: typeof comments[number]; depth: number }[] = [], seen = new Set<string>()
        const visit = (id: string | undefined, depth: number) => { for (const comment of comments.filter(value => value.parentId === id)) { if (seen.has(comment.id)) continue; seen.add(comment.id); result.push({ comment, depth }); visit(comment.id, Math.min(depth + 1, 3)) } }
        visit(undefined, 0)
        for (const comment of comments) if (!seen.has(comment.id)) result.push({ comment, depth: 0 })
        return result
    })
    const profile = (author: SocialAuthor) => { const target = targets.find(target => target.id === author.id); if (target) onprofile(target) }
    async function reply(id: string, author: SocialAuthor) {
        commentsOpen = true; draft.parentId = id
        const handle = targets.find(target => target.id === author.id)?.handle
        if (handle && !draft.text.includes(`@${handle}`)) draft.text = `@${handle} ${draft.text}`
        await tick(); commentInput?.focus()
    }
</script>
<article class="ew-post" id={repost ? `social-repost-${repost.id}` : `social-post-${post.id}`}>
    {#if repost}<p class="ew-repost-note"><Repeat2 size={14} />{repost.author.name} reposted</p>{/if}
    <div class="ew-post-heading">
        <button class="ew-avatar-button" aria-label={`View ${post.author.name}'s profile`} onclick={() => profile(post.author)}><SocialAvatar name={post.author.name} image={post.author.image} size={44} /></button>
        <div class="ew-grow"><button class="ew-post-name" onclick={() => profile(post.author)}>{post.author.name}</button><small>@{handle} · <time datetime={new Date(post.createdAt).toISOString()}>{new Date(post.createdAt).toLocaleString('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time> · {post.visibleToActorIds ? 'My circle' : 'Public'}</small></div>
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions (Escape bubbles from the native summary and menu buttons.) -->
        <details class="ew-menu" onkeydown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}><summary aria-label="Post options"><MoreHorizontal size={20} /></summary><div><button onclick={event => { deleteOpen = true; event.currentTarget.closest('details')?.removeAttribute('open') }}>Delete post</button></div></details>
    </div>
    <p class="ew-post-body"><SocialText text={post.text} {targets} {onprofile} /></p>
    {#if post.quote}<div class="ew-quote-card"><button class="ew-post-name" onclick={() => post.quote && profile(post.quote.author)}>{post.quote.author.name}</button><small>Quoted post</small><p><SocialText text={post.quote.text} {targets} {onprofile} /></p></div>{/if}
    {#if deleteOpen}<div class="ew-inline-confirm" role="group" aria-label="Delete this post?"><p>Delete this post and its thread? Reposts will show that the original is unavailable.</p><button class="ew-button" onclick={ondelete}>Delete</button><button class="ew-button" onclick={() => deleteOpen = false}>Keep post</button></div>{/if}
    <div class="ew-post-actions">
        <button aria-label={post.liked ? 'Unlike' : 'Like'} aria-pressed={post.liked} class:ew-accent={post.liked} onclick={() => post.liked = !post.liked}><Heart size={18} fill={post.liked ? 'currentColor' : 'none'} />{Number(post.liked) + post.responses.filter(response => response.reaction === 'like' || response.reaction === 'love').length}</button>
        <button aria-expanded={commentsOpen} onclick={() => commentsOpen = !commentsOpen}><MessageCircle size={18} />{comments.length}<span>Comment</span></button>
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions (Escape bubbles from the native summary and menu buttons.) -->
        <details class="ew-menu" onkeydown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}><summary aria-label="Repost or quote"><Repeat2 size={18} />{repostCount}</summary><div><button onclick={event => { onrepost(); event.currentTarget.closest('details')?.removeAttribute('open') }}>{reposted ? 'Undo repost' : 'Repost'}</button><button onclick={event => { onquote(); event.currentTarget.closest('details')?.removeAttribute('open') }}>Quote post</button></div></details>
        <button class="ew-action-end" aria-label="Open comments" onclick={() => commentsOpen = true}><ArrowUpRight size={17} /></button>
    </div>
    {#if post.responses.length}<div class="ew-reactions">{#each post.responses as response (response.id)}{#if response.reaction !== 'none'}<button onclick={() => profile({ id: `character:${response.actor.characterId}`, name: response.actor.name })}>{response.reaction === 'love' ? '♥' : response.reaction === 'curious' ? '✧' : '♡'} {response.actor.name}</button>{/if}{/each}</div>{/if}
    <div class="ew-generation-line">{#if busy}<span>Inviting reactions…</span><button onclick={oncancel}>Cancel</button>{:else if eligible}<button disabled={!canGenerate} onclick={onreact}><Sparkles size={14} />Invite character reactions</button><small>Up to {eligible} × {maxResponse ?? '—'} tokens</small>{:else}<small>No new reactions to invite</small>{/if}</div>
    {#if commentsOpen}
        <div class="ew-comment-thread">
            {#each thread as { comment, depth } (comment.id)}
                <div class="ew-comment" style:margin-left={`${depth * 12}px`}>
                    <button class="ew-avatar-button" aria-label={`View ${comment.author.name}'s profile`} onclick={() => profile(comment.author)}><SocialAvatar name={comment.author.name} image={comment.author.image} size={30} /></button>
                    <div class="ew-grow"><button class="ew-post-name" onclick={() => profile(comment.author)}>{comment.author.name}</button><p><SocialText text={comment.text} {targets} {onprofile} /></p><button class="ew-reply" onclick={() => reply(comment.id, comment.author)}><Reply size={13} />Reply</button></div>
                </div>
            {/each}
            {#if draft.parentId}<div class="ew-reply-target">Replying to {comments.find(comment => comment.id === draft.parentId)?.author.name ?? 'a comment'}<button aria-label="Cancel reply" onclick={() => draft.parentId = undefined}><X size={14} /></button></div>{/if}
            <form class="ew-comment-composer" onsubmit={event => { event.preventDefault(); if (oncomment(draft.text, draft.parentId)) { draft.text = ''; draft.parentId = undefined } }}>
                <SocialAvatar name={you.name} image={you.image} size={30} />
                <SocialMentionInput bind:value={draft.text} bind:input={commentInput} {targets} label="Write a comment" placeholder="Write a comment… Try @someone" maxlength={MAX_SOCIAL_COMMENT_LENGTH} rows={1} />
                <button class="ew-button ew-primary" type="submit" disabled={!draft.text.trim()} aria-label="Send comment"><ArrowUpRight size={17} /></button>
            </form>
        </div>
    {/if}
</article>
