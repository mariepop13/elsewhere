/** Only allowlisted diagnostics may reach the feed, never raw provider details. */
export type SocialErrorCode = 'request_error' | 'invalid_response' | 'incomplete_response' | 'empty_response' | 'invalid_limits' | 'context_limit'

export type SocialInvalidReason = 'invalid_json' | 'invalid_shape' | 'invalid_reaction' | 'invalid_comment' | 'comment_too_long' | 'empty_comment' | 'thinking_content' | 'invalid_post' | 'duplicate_post'

export class SocialGenerationError extends Error {
    readonly status?: number
    constructor(readonly code: SocialErrorCode, status?: number, readonly reason?: SocialInvalidReason) {
        super(code)
        this.name = 'SocialGenerationError'
        if (Number.isInteger(status) && status >= 200 && status <= 599) this.status = status
    }
}

/** Reject ambiguous thinking content rather than repairing or mining it for JSON. */
export function assertPublicFinalText(text: string): void {
    if (/<\/?\s*(?:think|thoughts|thinking|analysis|reasoning)\b/i.test(text)) {
        throw new SocialGenerationError('invalid_response', undefined, 'thinking_content')
    }
}
