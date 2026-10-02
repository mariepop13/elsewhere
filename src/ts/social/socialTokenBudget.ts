import type { PublicPublicationContext, PublicReactionContext } from './socialFeed'
import type { SocialLimits } from './socialLimits'
import { socialMessages, socialPublicationMessages } from './socialPrompt'
import { SocialGenerationError } from './socialErrors'

export type SocialTokenCounter = (text: string) => Promise<number>
export async function countSocialTokens(text: string): Promise<number> {
    // Explicit bundled local tokenizer; never encode(), plugins or provider countTokens.
    const { encodeWithTokenizer } = await import('../tokenizer')
    return (await encodeWithTokenizer(text, 'tik')).length
}

/** Estimate both public messages + framing, reserving the full shared output limit. */
export async function preflightSocialContexts(contexts: PublicReactionContext[], limits: SocialLimits,
    count: SocialTokenCounter = countSocialTokens): Promise<void> {
    for (const context of contexts) {
        await preflightMessages(socialMessages(context), limits, count)
    }
}

async function preflightMessages(messages: { content: string }[], limits: SocialLimits, count: SocialTokenCounter) {
    let input = 3
    for (const message of messages) {
        const tokens = await count(message.content)
        if (!Number.isInteger(tokens) || tokens < 0) throw new SocialGenerationError('invalid_limits')
        input += tokens + 8 // local estimate with role/framing allowance
    }
    if (input + limits.maxResponse > limits.maxContext) throw new SocialGenerationError('context_limit')
}

export async function preflightSocialPublication(context: PublicPublicationContext, limits: SocialLimits,
    count: SocialTokenCounter = countSocialTokens): Promise<void> {
    await preflightMessages(socialPublicationMessages(context), limits, count)
}
