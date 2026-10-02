import { publicSocialWorld, publicSocialActor, type SocialWorldSetup } from './socialSetup'
import { buildPublicRelationshipContext, type PublicRelationshipContext } from './socialRelations'
import { buildPublicLanguageContext, type PublicLanguageContext } from './socialLanguage'
import { DEFAULT_SOCIAL_CONTEXT, DEFAULT_SOCIAL_RESPONSE, getSocialLimits, initializeSocialLimits, type SocialLimits } from './socialLimits'
import { preflightSocialPublication, preflightSocialContexts } from './socialTokenBudget'
import { assertPublicFinalText, SocialGenerationError } from './socialErrors'

/** Public social data is deliberately separate from character chats and memory. */
export const MAX_CAST = 4
export const MAX_POST_LENGTH = 2000
export const MAX_PROFILE_LENGTH = 1200

export interface SocialActor {
    characterId: string
    name: string
    image?: string
    publicProfile: string
    /** Explicit public starting facts, never imported private memories. */
    startingFacts?: string
}

export interface SocialAuthor {
    id: string
    name: string
    image?: string
    characterId?: string
}

/** Resolve current/explicit persona choices to the same stable identity, preserving public display. */
export function socialPersonaAuthor(
    personas: { id?: string; name: string; icon?: string }[], selectedIndex: number, choiceIndex: number,
    currentDisplay: { name: string; image?: string },
): SocialAuthor {
    const index = choiceIndex === -1 ? selectedIndex : choiceIndex
    const persona = personas[index]
    return {
        id: persona?.id ?? `persona:${index}`,
        name: choiceIndex === -1 ? currentDisplay.name : persona?.name ?? currentDisplay.name,
        image: choiceIndex === -1 ? currentDisplay.image : persona?.icon ?? currentDisplay.image,
    }
}

export type SocialReactionKind = 'like' | 'love' | 'curious' | 'none'

export interface SocialResponse {
    id: string
    actor: SocialActor
    reaction: SocialReactionKind
    comment: string
    createdAt: number
}

export interface SocialPost {
    id: string
    author: SocialAuthor
    text: string
    createdAt: number
    liked: boolean
    responses: SocialResponse[]
    /** Actors that explicitly declined; no fabricated public response. */
    consideredActorIds?: string[]
}

export interface SocialFeedState {
    version: 1
    enabled: boolean
    publicWorld: string
    cast: SocialActor[]
    posts: SocialPost[]
    draft: string
    setup?: SocialWorldSetup
    maxContext?: number
    maxResponse?: number
}

export function createSocialFeed(): SocialFeedState {
    return {
        version: 1,
        enabled: false,
        publicWorld: '',
        cast: [],
        posts: [],
        draft: '',
        maxContext: DEFAULT_SOCIAL_CONTEXT,
        maxResponse: DEFAULT_SOCIAL_RESPONSE,
    }
}

export function createSocialPost(
    author: SocialAuthor,
    text: string,
): SocialPost {
    const content = text.trim()
    if (!content || content.length > MAX_POST_LENGTH)
        throw new Error('Invalid post length')
    return {
        id: crypto.randomUUID(),
        author: { id: author.id, name: author.name, image: author.image, ...(author.characterId ? { characterId: author.characterId } : {}) },
        text: content,
        createdAt: Date.now(),
        liked: false,
        responses: [],
    }
}

export interface PublicReactionContext {
    actor: SocialActor
    publicWorld: string
    post: { author: string; text: string }
    comments: { author: string; comment: string }[]
    language?: PublicLanguageContext
    relationships?: PublicRelationshipContext[]
}

export function buildPublicContext(
    state: SocialFeedState,
    post: SocialPost,
    actor: SocialActor,
    interfaceLanguage = 'en',
): PublicReactionContext {
    // Project an allowlist, never spread cards, personas, chats or database fields.
    return {
        actor: publicSocialActor(actor),
        publicWorld: publicSocialWorld(state),
        language: buildPublicLanguageContext(state, interfaceLanguage),
        relationships: buildPublicRelationshipContext(state, actor, post.author),
        post: { author: post.author.name, text: post.text },
        comments: post.responses.map((response) => ({
            author: response.actor.name,
            comment: response.comment,
        })),
    }
}

export function parseSocialResponse(
    raw: string,
): Pick<SocialResponse, 'reaction' | 'comment'> {
    assertPublicFinalText(raw)
    const text = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
    let value: unknown
    try { value = JSON.parse(text) } catch { throw new SocialGenerationError('invalid_response', undefined, 'invalid_json') }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new SocialGenerationError('invalid_response', undefined, 'invalid_shape')
    }
    const data = value as Record<string, unknown>
    if (!['like', 'love', 'curious', 'none'].includes(data.reaction as string)) {
        throw new SocialGenerationError('invalid_response', undefined, 'invalid_reaction')
    }
    if (typeof data.comment !== 'string') {
        throw new SocialGenerationError('invalid_response', undefined, 'invalid_comment')
    }
    if (data.comment.trim().length > 600) {
        throw new SocialGenerationError('invalid_response', undefined, 'comment_too_long')
    }
    assertPublicFinalText(data.comment)
    return {
        reaction: data.reaction as SocialReactionKind,
        comment: data.comment.trim(),
    }
}

export type SocialGenerator = (
    context: PublicReactionContext,
    signal: AbortSignal,
    limits: SocialLimits,
) => Promise<string>

export function eligibleSocialActors(state: SocialFeedState, post: SocialPost): SocialActor[] {
    return state.cast.slice(0, MAX_CAST).filter(actor => actor.publicProfile.trim() &&
        actor.characterId !== post.author.characterId &&
        !post.consideredActorIds?.includes(actor.characterId) &&
        !post.responses.some(response => response.actor.characterId === actor.characterId))
}

export interface PublicPublicationContext {
    actor: SocialActor
    publicWorld: string
    recentPosts: { author: string; text: string; comments: { author: string; comment: string }[] }[]
    language?: PublicLanguageContext
    relationships?: PublicRelationshipContext[]
}

export function buildPublicPublicationContext(state: SocialFeedState, actor: SocialActor, interfaceLanguage = 'en'): PublicPublicationContext {
    return {
        actor: publicSocialActor(actor),
        publicWorld: publicSocialWorld(state),
        language: buildPublicLanguageContext(state, interfaceLanguage),
        relationships: buildPublicRelationshipContext(state, actor),
        recentPosts: state.posts.slice(0, 8).map(post => ({
            author: post.author.name, text: post.text,
            comments: post.responses.map(response => ({ author: response.actor.name, comment: response.comment })),
        })),
    }
}

export function parseSocialPublication(raw: string): string {
    assertPublicFinalText(raw)
    let value: unknown
    try { value = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) }
    catch { throw new SocialGenerationError('invalid_response', undefined, 'invalid_json') }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SocialGenerationError('invalid_response', undefined, 'invalid_shape')
    const text = (value as Record<string, unknown>).text
    if (typeof text !== 'string' || !text.trim() || text.trim().length > MAX_POST_LENGTH) throw new SocialGenerationError('invalid_response', undefined, 'invalid_post')
    assertPublicFinalText(text)
    return text.trim()
}

export type SocialPublisher = (context: PublicPublicationContext, signal: AbortSignal, limits: SocialLimits) => Promise<string>
const normalizedPost = (text: string) => text.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()

/** One active batch; cancellation invalidates even a transport that ignores AbortSignal. */
export class SocialGeneration {
    private active: AbortController | undefined

    cancel() {
        this.active?.abort()
        this.active = undefined
    }

    async generate(
        state: SocialFeedState,
        postId: string,
        generator: SocialGenerator,
        isCurrent: () => boolean = () => true,
        preflight: typeof preflightSocialContexts = preflightSocialContexts,
        interfaceLanguage = 'en',
    ): Promise<'saved' | 'cancelled' | 'empty' | 'busy'> {
        if (this.active) return 'busy'
        const post = state.posts.find((value) => value.id === postId)
        if (!state.enabled || !post) return 'empty'
        const actors = eligibleSocialActors(state, post)
        if (!actors.length) return 'empty'
        initializeSocialLimits(state)
        const limits = getSocialLimits(state)
        const controller = new AbortController()
        this.active = controller
        const contexts = actors.map(actor => buildPublicContext(state, post, actor, interfaceLanguage))
        const snapshot = JSON.stringify({
            world: state.publicWorld,
            actors: state.cast,
            text: post.text,
            authorCharacterId: post.author.characterId,
            consideredActorIds: post.consideredActorIds,
            maxContext: state.maxContext,
            maxResponse: state.maxResponse,
            publicContexts: contexts,
        })
        const valid = () =>
            this.active === controller &&
            !controller.signal.aborted &&
            isCurrent() &&
            state.enabled &&
            state.posts.includes(post) &&
            snapshot ===
                JSON.stringify({
                    world: state.publicWorld,
                    actors: state.cast,
                    text: post.text,
                    authorCharacterId: post.author.characterId,
                    consideredActorIds: post.consideredActorIds,
                    maxContext: state.maxContext,
                    maxResponse: state.maxResponse,
                    publicContexts: actors.map(actor => buildPublicContext(state, post, actor, interfaceLanguage)),
                })
        const responses: SocialResponse[] = []
        const declined: string[] = []
        try {
            await preflight(contexts, limits)
            if (!valid()) return 'cancelled'
            for (const [index, actor] of actors.entries()) {
                if (!valid()) return 'cancelled'
                const raw = await generator(
                    contexts[index],
                    controller.signal,
                    { ...limits },
                )
                if (!valid()) return 'cancelled'
                const parsed = parseSocialResponse(raw)
                if (parsed.reaction === 'none' && !parsed.comment) {
                    declined.push(actor.characterId)
                    continue
                }
                responses.push({
                    ...parsed,
                    id: crypto.randomUUID(),
                    actor: {
                        characterId: actor.characterId,
                        name: actor.name,
                        image: actor.image,
                        publicProfile: actor.publicProfile,
                    },
                    createdAt: Date.now(),
                })
            }
            if (!valid()) return 'cancelled'
            // Atomic batch: an error leaves the publication intact and retryable.
            post.responses.push(
                ...responses.filter(
                    (response) =>
                        !post.responses.some(
                            (existing) =>
                                existing.actor.characterId ===
                                response.actor.characterId,
                        ),
                ),
            )
            if (declined.length) post.consideredActorIds = [...new Set([...(post.consideredActorIds ?? []), ...declined])]
            return 'saved'
        } catch (error) {
            if (!valid()) return 'cancelled'
            throw error
        } finally {
            if (this.active === controller) this.active = undefined
        }
    }

    async publish(
        state: SocialFeedState, actorId: string, publisher: SocialPublisher,
        isCurrent: () => boolean = () => true,
        preflight: typeof preflightSocialPublication = preflightSocialPublication,
        interfaceLanguage = 'en',
    ): Promise<'saved' | 'cancelled' | 'empty' | 'busy'> {
        if (this.active) return 'busy'
        const actor = state.cast.slice(0, MAX_CAST).find(actor => actor.characterId === actorId && actor.publicProfile.trim())
        if (!state.enabled || !actor) return 'empty'
        initializeSocialLimits(state)
        const limits = getSocialLimits(state)
        const controller = new AbortController()
        this.active = controller
        const context = buildPublicPublicationContext(state, actor, interfaceLanguage)
        const snapshot = JSON.stringify({ context, cast: state.cast, limits })
        const valid = () => this.active === controller && !controller.signal.aborted && isCurrent() && state.enabled &&
            snapshot === JSON.stringify({ context: buildPublicPublicationContext(state, actor, interfaceLanguage), cast: state.cast,
                limits: { maxContext: state.maxContext, maxResponse: state.maxResponse } })
        try {
            await preflight(context, limits)
            if (!valid()) return 'cancelled'
            const raw = await publisher(context, controller.signal, { ...limits })
            if (!valid()) return 'cancelled'
            const text = parseSocialPublication(raw)
            if (state.posts.some(post => normalizedPost(post.text) === normalizedPost(text))) {
                throw new SocialGenerationError('invalid_response', undefined, 'duplicate_post')
            }
            state.posts.unshift(createSocialPost({ id: `character:${actor.characterId}`, characterId: actor.characterId,
                name: actor.name, image: actor.image }, text))
            return 'saved'
        } catch (error) {
            if (!valid()) return 'cancelled'
            throw error
        } finally {
            if (this.active === controller) this.active = undefined
        }
    }

}
