import { describe, expect, it } from 'vitest'
import { socialAssetReferences } from './socialSetup'
import type { SocialFeedState } from './socialFeed'

describe('social photo asset references', () => {
    it('retains social-only, cast and historical portraits without relying on current cards/personas', () => {
        const feed = { setup: { you: { image: 'assets/you.png' } },
            cast: [{ image: 'assets/cast.png' }],
            posts: [{ author: { image: 'assets/old-user.png' }, responses: [{ actor: { image: 'assets/removed-card.png' } }, { actor: { image: 'assets/cast.png' } }] }] } as SocialFeedState
        expect(socialAssetReferences(feed)).toEqual(['assets/you.png', 'assets/cast.png', 'assets/old-user.png', 'assets/removed-card.png'])
        expect(socialAssetReferences()).toEqual([])
    })
})
