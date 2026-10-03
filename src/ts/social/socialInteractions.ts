import { createSocialPost, MAX_POST_LENGTH, type SocialAuthor, type SocialFeedState, type SocialPost } from './socialFeed'

export const MAX_SOCIAL_COMMENT_LENGTH = 1000
export const MAX_SOCIAL_COMMENTS = 200
export interface SocialComment { id: string; author: SocialAuthor; text: string; createdAt: number; parentId?: string }
export interface SocialQuote { postId: string; author: SocialAuthor; text: string; createdAt: number }
export interface SocialRepost { id: string; postId: string; author: SocialAuthor; createdAt: number }
export interface SocialTarget extends SocialAuthor { handle: string; publicProfile: string }
export interface SocialCommentDraft { text: string; parentId?: string }
export interface SocialPreferences { appearance?: 'Dark' | 'Light' | 'System'; compact?: boolean }

const projectAuthor = (author: SocialAuthor): SocialAuthor => ({ id: author.id, name: author.name, image: author.image,
    ...(author.characterId ? { characterId: author.characterId } : {}) })

/** Fictional audience scope applies to model context, not network authentication. */
export function canActorSeeSocialPost(post: SocialPost, actorId: string): boolean {
    return post.visibleToActorIds === undefined || post.visibleToActorIds.includes(actorId)
}
export function publicSocialPostText(post: SocialPost): string {
    return post.quote ? `${post.text}\n\nQuoted post by ${post.quote.author.name}: ${post.quote.text}` : post.text
}
export function socialPublicComments(post: SocialPost): { author: string; comment: string }[] {
    return [...post.responses.map(response => ({ author: response.actor.name, comment: response.comment, time: response.createdAt })),
        ...(post.comments ?? []).map(comment => ({ author: comment.author.name, comment: comment.text, time: comment.createdAt }))]
        .sort((a, b) => a.time - b.time).slice(-12).map(({ author, comment }) => ({ author, comment }))
}
export function addSocialComment(post: SocialPost, author: SocialAuthor, text: string, parentId?: string): SocialComment {
    const content = text.trim()
    if (!content || content.length > MAX_SOCIAL_COMMENT_LENGTH || (post.comments?.length ?? 0) >= MAX_SOCIAL_COMMENTS) throw new Error('Invalid comment')
    if (parentId && !(post.comments?.some(comment => comment.id === parentId) || post.responses.some(response => response.id === parentId && response.comment.trim()))) throw new Error('Reply target no longer exists')
    const comment: SocialComment = { id: crypto.randomUUID(), author: projectAuthor(author), text: content, createdAt: Date.now(), ...(parentId ? { parentId } : {}) }
    post.comments ??= []
    post.comments.push(comment)
    return comment
}
export function createSocialQuote(author: SocialAuthor, text: string, source: SocialPost, circle?: string[]): SocialPost {
    const post = createSocialPost(author, text)
    // One level only, with a public allowlist: no recursive copies, responses or private card data.
    post.quote = { postId: source.id, author: projectAuthor(source.author), text: source.text.slice(0, MAX_POST_LENGTH), createdAt: source.createdAt }
    const audience = source.visibleToActorIds ? (circle ? source.visibleToActorIds.filter(id => circle.includes(id)) : [...source.visibleToActorIds]) : circle
    if (audience !== undefined) {
        if (!audience.length) throw new Error('Choose at least one character in your circle')
        post.visibleToActorIds = [...new Set(audience)]
    }
    return post
}
export function toggleSocialRepost(feed: SocialFeedState, postId: string, author: SocialAuthor): boolean {
    if (!feed.posts.some(post => post.id === postId)) throw new Error('Original post no longer exists')
    const existing = feed.reposts?.find(repost => repost.postId === postId && repost.author.id === author.id)
    if (existing) { feed.reposts = feed.reposts!.filter(repost => repost.id !== existing.id); return false }
    feed.reposts ??= []
    feed.reposts.unshift({ id: crypto.randomUUID(), postId, author: projectAuthor(author), createdAt: Date.now() })
    return true
}
export function socialTimeline(feed: SocialFeedState, currentCastOnly = false): { id: string; post?: SocialPost; repost?: SocialRepost; createdAt: number }[] {
    const visible = (post: SocialPost) => !currentCastOnly || !post.author.characterId || feed.cast.some(actor => actor.characterId === post.author.characterId)
    const posts = feed.posts.filter(visible).map(post => ({ id: post.id, post, createdAt: post.createdAt }))
    const reposts = (feed.reposts ?? []).flatMap(repost => {
        const post = feed.posts.find(post => post.id === repost.postId)
        return post && !visible(post) ? [] : [{ id: repost.id, repost, post, createdAt: repost.createdAt }]
    })
    return [...posts, ...reposts].sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
}

/** Allocate once per stable native identity. Renaming never invalidates existing mention links. */
export function ensureSocialHandles(feed: SocialFeedState, authors: SocialAuthor[]): void {
    feed.handles ??= {}
    const handles = feed.handles
    const used = new Set(Object.values(handles))
    for (const author of authors) {
        if (Object.hasOwn(handles, author.id) && handles[author.id]) continue
        const base = author.name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 22) || 'neighbor'
        let handle = base, suffix = 2
        while (used.has(handle)) handle = `${base}_${suffix++}`
        Object.defineProperty(handles, author.id, { value: handle, enumerable: true, configurable: true, writable: true }); used.add(handle)
    }
}
export function socialTargets(feed: SocialFeedState, you: SocialAuthor): SocialTarget[] {
    const targets = new Map<string, SocialTarget>()
    const add = (author: SocialAuthor, publicProfile = '') => targets.set(author.id, { ...projectAuthor(author), handle: feed.handles?.[author.id] ?? '', publicProfile })
    for (const post of [...feed.posts].reverse()) {
        add(post.author)
        for (const comment of post.comments ?? []) add(comment.author)
        if (post.quote) add(post.quote.author)
        for (const response of post.responses) add({ id: `character:${response.actor.characterId}`, characterId: response.actor.characterId, name: response.actor.name, image: response.actor.image }, response.actor.publicProfile)
    }
    for (const repost of feed.reposts ?? []) add(repost.author)
    for (const actor of feed.cast) add({ id: `character:${actor.characterId}`, characterId: actor.characterId, name: actor.name, image: actor.image }, actor.publicProfile)
    add(you, feed.setup?.you.id === you.id ? feed.setup.you.publicProfile : '')
    return [...targets.values()]
}
export function splitSocialMentions(text: string, targets: SocialTarget[]): { text: string; target?: SocialTarget }[] {
    return text.split(/(@[a-zA-Z0-9_]+)/g).filter(Boolean).map(part => ({ text: part,
        ...(part.startsWith('@') ? { target: targets.find(target => target.handle && target.handle.toLowerCase() === part.slice(1).toLowerCase()) } : {}) }))
}
