import { SocialGenerationError } from './socialErrors'

export const DEFAULT_SOCIAL_CONTEXT = 4000
export const DEFAULT_SOCIAL_RESPONSE = 320
export const SOCIAL_CONTEXT_MIN = 512
export const SOCIAL_CONTEXT_MAX = 131072
export const SOCIAL_RESPONSE_MIN = 64
export const SOCIAL_RESPONSE_MAX = 8192
export interface SocialLimits { maxContext: number; maxResponse: number }
export interface StoredSocialLimits { maxContext?: number; maxResponse?: number }

/** Add missing fields only; never overwrite a saved choice or repair invalid values silently. */
export function initializeSocialLimits(state: StoredSocialLimits): void {
    if (!('maxContext' in state)) state.maxContext = DEFAULT_SOCIAL_CONTEXT
    if (!('maxResponse' in state)) state.maxResponse = DEFAULT_SOCIAL_RESPONSE
}

export function getSocialLimits(state: StoredSocialLimits = { maxContext: DEFAULT_SOCIAL_CONTEXT, maxResponse: DEFAULT_SOCIAL_RESPONSE }): SocialLimits {
    const maxContext = !('maxContext' in state) ? DEFAULT_SOCIAL_CONTEXT : state.maxContext
    const maxResponse = !('maxResponse' in state) ? DEFAULT_SOCIAL_RESPONSE : state.maxResponse
    if (typeof maxContext !== 'number' || !Number.isInteger(maxContext) || maxContext < SOCIAL_CONTEXT_MIN || maxContext > SOCIAL_CONTEXT_MAX ||
        typeof maxResponse !== 'number' || !Number.isInteger(maxResponse) || maxResponse < SOCIAL_RESPONSE_MIN || maxResponse > SOCIAL_RESPONSE_MAX || maxResponse >= maxContext) {
        throw new SocialGenerationError('invalid_limits')
    }
    return { maxContext, maxResponse }
}
