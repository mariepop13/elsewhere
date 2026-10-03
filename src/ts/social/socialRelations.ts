import type { SocialActor, SocialAuthor, SocialFeedState, SocialReactionKind } from './socialFeed'

export type PublicFamiliarity = 'first_contact' | 'acquainted' | 'familiar'
export interface PublicParticipant { id: string; name: string; kind: 'character' | 'persona' }
export interface PublicInteraction {
    id: string
    postId: string
    createdAt: number
    from: PublicParticipant
    to: PublicParticipant
    post: string
    reaction: SocialReactionKind
    comment: string
}
export interface PublicRelationship {
    id: string
    participants: [PublicParticipant, PublicParticipant]
    familiarity: PublicFamiliarity
    publicThreadCount: number
    interactions: PublicInteraction[]
}
export interface PublicRelationshipContext {
    partner: { id: string; name: string }
    familiarity: PublicFamiliarity
    publicThreadCount: number
    recentInteractions: { from: string; post: string; reaction: SocialReactionKind; comment: string }[]
}

export const MAX_RELATION_CONTACTS = 3
export const MAX_RELATION_INTERACTIONS = 2
export const MAX_RELATION_EXCERPT = 240
const reactionKinds: SocialReactionKind[] = ['like', 'love', 'curious', 'none']
export const characterParticipantId = (id: string) => `character:${id}`
const authorParticipant = (author: SocialAuthor): PublicParticipant => ({
    id: author.characterId ? characterParticipantId(author.characterId) : `persona:${author.id}`,
    name: author.name,
    kind: author.characterId ? 'character' : 'persona',
})
const familiarity = (threads: number): PublicFamiliarity => threads >= 4 ? 'familiar' : threads >= 2 ? 'acquainted' : 'first_contact'

/** Saved public comments and responses are evidence, never an invented affinity ledger. */
export function derivePublicRelationships(state: SocialFeedState): PublicRelationship[] {
    const pairs = new Map<string, PublicRelationship>()
    const seen = new Set<string>()
    for (const post of state.posts) {
        if (!post.author?.id) continue
        const to = authorParticipant(post.author)
        const events: { id: string; createdAt: number; from: PublicParticipant; to: PublicParticipant; reaction: SocialReactionKind; comment: string }[] = post.responses.filter(response => response.actor?.characterId && reactionKinds.includes(response.reaction) && typeof response.comment === 'string' && (response.reaction !== 'none' || response.comment.trim()))
            .map(response => ({ id: response.id, createdAt: response.createdAt, from: { id: characterParticipantId(response.actor.characterId), name: response.actor.name, kind: 'character' as const }, to, reaction: response.reaction, comment: response.comment }))
        for (const comment of post.comments ?? []) {
            const parent = post.comments?.find(value => value.id === comment.parentId)
            const response = post.responses.find(value => value.id === comment.parentId)
            const target = parent ? authorParticipant(parent.author) : response ? { id: characterParticipantId(response.actor.characterId), name: response.actor.name, kind: 'character' as const } : to
            events.push({ id: comment.id, createdAt: comment.createdAt, from: authorParticipant(comment.author), to: target, reaction: 'none', comment: comment.text })
        }
        for (const event of events) {
            const { from, to } = event
            if (from.id === to.id) continue
            const eventId = JSON.stringify([post.id, event.id])
            if (seen.has(eventId)) continue
            seen.add(eventId)
            const participants = [from, to].sort((a, b) => a.id.localeCompare(b.id)) as [PublicParticipant, PublicParticipant]
            const pairId = JSON.stringify(participants.map(participant => participant.id))
            let pair = pairs.get(pairId)
            if (!pair) {
                pair = { id: pairId, participants, familiarity: 'first_contact', publicThreadCount: 0, interactions: [] }
                pairs.set(pairId, pair)
            }
            pair.interactions.push({ id: eventId, postId: post.id, createdAt: event.createdAt, from, to,
                post: post.text, reaction: event.reaction, comment: event.comment })
        }
    }
    for (const pair of pairs.values()) {
        pair.interactions.sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
        // Names come from the newest public evidence, never a private persona/card lookup.
        const latest = pair.interactions[0]
        pair.participants = [latest.from, latest.to].sort((a, b) => a.id.localeCompare(b.id)) as [PublicParticipant, PublicParticipant]
        pair.publicThreadCount = new Set(pair.interactions.map(event => event.postId)).size
        pair.familiarity = familiarity(pair.publicThreadCount)
    }
    return [...pairs.values()].sort((a, b) => b.interactions[0].createdAt - a.interactions[0].createdAt || a.id.localeCompare(b.id))
}

/** Reproject and bound even injected contexts; only public display facts enter the model. */
export function projectPublicRelationships(relations: PublicRelationshipContext[] = []): PublicRelationshipContext[] {
    return relations.filter(relation => Number.isInteger(relation.publicThreadCount) && relation.publicThreadCount > 0).slice(0, MAX_RELATION_CONTACTS).map(relation => ({
        partner: { id: relation.partner.id.slice(0, 200), name: relation.partner.name.slice(0, 120) },
        familiarity: familiarity(relation.publicThreadCount),
        publicThreadCount: relation.publicThreadCount,
        recentInteractions: relation.recentInteractions.slice(0, MAX_RELATION_INTERACTIONS).map(event => ({
            from: event.from.slice(0, 120), post: event.post.slice(0, MAX_RELATION_EXCERPT),
            reaction: reactionKinds.includes(event.reaction) ? event.reaction : 'none', comment: event.comment.slice(0, MAX_RELATION_EXCERPT),
        })),
    }))
}

export function buildPublicRelationshipContext(state: SocialFeedState, actor: SocialActor, targetAuthor?: SocialAuthor): PublicRelationshipContext[] {
    const actorId = characterParticipantId(actor.characterId)
    const targetId = targetAuthor?.id ? authorParticipant(targetAuthor).id : undefined
    return projectPublicRelationships(derivePublicRelationships(state)
        .filter(pair => pair.participants.some(participant => participant.id === actorId))
        // Keep the target author’s public history even when other contacts are more recent.
        .sort((a, b) => Number(b.participants.some(participant => participant.id === targetId)) - Number(a.participants.some(participant => participant.id === targetId)))
        .slice(0, MAX_RELATION_CONTACTS)
        .map(pair => ({
            partner: pair.participants.find(participant => participant.id !== actorId),
            familiarity: pair.familiarity,
            publicThreadCount: pair.publicThreadCount,
            recentInteractions: pair.interactions.slice(0, MAX_RELATION_INTERACTIONS).map(event => ({
                from: event.from.name, post: event.post, reaction: event.reaction, comment: event.comment,
            })),
        })))
}

export const publicRelationshipPolicy = 'Use the supplied relationships only as public evidence of prior contact. Familiarity counts distinct public threads; it is not affection, trust, hostility or romance. A like or heart does not create romantic attachment, and no response does not imply hostility. Preserve the actor public personality and consider the actual public dialogue, including disagreement. Never invent a shared private past or hidden relationship facts. If no relationship evidence is supplied, do not assume an established bond.'
