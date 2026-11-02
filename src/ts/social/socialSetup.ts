import { MAX_CAST, MAX_PROFILE_LENGTH, type SocialActor, type SocialAuthor, type SocialFeedState } from './socialFeed'

export interface SocialWorldSetup {
    version: 1
    title: string
    you: SocialAuthor & { publicProfile: string }
    era?: string
    places?: string
    mood?: string
    startingSituation: string
}

export interface SocialSetupDraft {
    title: string
    publicWorld: string
    you: SocialAuthor & { publicProfile: string }
    cast: SocialActor[]
    era?: string
    places?: string
    mood?: string
    startingSituation: string
}

/** Only explicit public facts are copied. Native cards/personas stay untouched. */
export function createSocialSetupDraft(feed: SocialFeedState, author: SocialAuthor): SocialSetupDraft {
    const you = feed.setup?.you ?? author
    return {
        title: feed.setup?.title ?? '',
        publicWorld: feed.publicWorld,
        you: { id: you.id, name: you.name, image: you.image, publicProfile: feed.setup?.you.publicProfile ?? '' },
        cast: feed.cast.map(actor => ({ characterId: actor.characterId, name: actor.name, image: actor.image,
            publicProfile: actor.publicProfile, startingFacts: actor.startingFacts ?? '', startingFactsVisibility: actor.startingFactsVisibility })),
        era: feed.setup?.era ?? '', places: feed.setup?.places ?? '', mood: feed.setup?.mood ?? '',
        startingSituation: feed.setup?.startingSituation ?? '',
    }
}

export function validateSocialSetup(draft: SocialSetupDraft): boolean {
    return !!draft.title.trim() && draft.title.trim().length <= 80 &&
        !!draft.you.id && !!draft.you.name.trim() && draft.you.name.trim().length <= 80 &&
        [draft.publicWorld, draft.you.publicProfile, draft.startingSituation].every(text => text.length <= MAX_PROFILE_LENGTH) &&
        [draft.era, draft.places, draft.mood].every(text => text === undefined || text.length <= 400) &&
        draft.cast.length <= MAX_CAST && new Set(draft.cast.map(actor => actor.characterId)).size === draft.cast.length &&
        draft.cast.every(actor => !!actor.characterId && !!actor.name.trim() && !!actor.publicProfile.trim() &&
            actor.publicProfile.length <= MAX_PROFILE_LENGTH && (actor.startingFacts ?? '').length <= MAX_PROFILE_LENGTH)
}

/** Commit only known fields after all validation, retaining posts, drafts, budgets and future metadata. */
export function applySocialSetup(feed: SocialFeedState, draft: SocialSetupDraft): void {
    if (!validateSocialSetup(draft)) throw new Error('Invalid social world setup')
    const setup: SocialWorldSetup = { version: 1, title: draft.title.trim(),
        you: { id: draft.you.id, name: draft.you.name.trim(), image: draft.you.image, publicProfile: draft.you.publicProfile.trim() },
        era: draft.era?.trim() ?? '', places: draft.places?.trim() ?? '', mood: draft.mood?.trim() ?? '',
        startingSituation: draft.startingSituation.trim() }
    const cast = draft.cast.map(actor => ({ characterId: actor.characterId, name: actor.name, image: actor.image,
        publicProfile: actor.publicProfile.trim(), startingFacts: actor.startingFacts?.trim() || undefined, startingFactsVisibility: actor.startingFactsVisibility }))
    feed.setup = setup
    feed.publicWorld = draft.publicWorld.trim()
    feed.cast = cast
    feed.enabled = true
}

export function publicSocialWorld(feed: SocialFeedState): string {
    return [feed.publicWorld, feed.setup?.era ? `Time and era: ${feed.setup.era}` : '', feed.setup?.places ? `Key places: ${feed.setup.places}` : '', feed.setup?.mood ? `Overall mood: ${feed.setup.mood}` : '', feed.setup?.you.publicProfile ? `Public profile of ${feed.setup.you.name}: ${feed.setup.you.publicProfile}` : '',
        feed.setup?.startingSituation ? `Starting situation: ${feed.setup.startingSituation}` : ''].filter(Boolean).join('\n\n')
}

export function publicSocialActor(actor: SocialActor): SocialActor {
    return { characterId: actor.characterId, name: actor.name,
        publicProfile: [actor.publicProfile, actor.startingFacts && (!actor.startingFactsVisibility || actor.startingFactsVisibility === 'public') ? `Public starting relationships and knowledge: ${actor.startingFacts}` : ''].filter(Boolean).join('\n\n') }
}

/** Keep social-only and historical portraits in normal saves, backups and asset cleanup. */
export function socialAssetReferences(feed?: SocialFeedState): string[] {
    if (!feed) return []
    return [...new Set([feed.setup?.you.image, ...feed.cast.map(actor => actor.image),
        ...feed.posts.flatMap(post => [post.author.image, ...post.responses.map(response => response.actor.image), ...(post.comments ?? []).map(comment => comment.author.image), post.quote?.author.image]),
        ...(feed.reposts ?? []).map(repost => repost.author.image)]
        .filter((path): path is string => !!path))]
}
