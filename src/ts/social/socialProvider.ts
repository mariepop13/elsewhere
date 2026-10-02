import { getDatabase } from '../storage/database.svelte'
import { getModelInfo, LLMFormat } from '../model/modellist'
import { requestChatDataMain } from '../process/request/request'
import { assertPublicFinalText, SocialGenerationError } from './socialErrors'
import type { PublicPublicationContext, PublicReactionContext } from './socialFeed'

import { getSocialLimits, type SocialLimits } from './socialLimits'
import { socialMessages, socialPublicationMessages } from './socialPrompt'

const supportedFormats: LLMFormat[] = [
    LLMFormat.OpenAICompatible,
    LLMFormat.Anthropic,
    LLMFormat.GoogleCloud,
]

export function socialModelSupported(): boolean {
    const db = getDatabase()
    const format =
        db.aiModel === 'reverse_proxy'
            ? db.customAPIFormat
            : getModelInfo(db.aiModel).format
    return supportedFormats.includes(format)
}

/** Local cancellation identity only; never includes keys or enters a public prompt. */
export function socialModelIdentity(): string {
    const db = getDatabase()
    const model = getModelInfo(db.aiModel)
    const custom = db.customModels?.find(item => item.id === db.aiModel)
    return JSON.stringify({
        id: db.aiModel, internalID: model.internalID, format: model.format, flags: model.flags,
        openrouter: db.aiModel === 'openrouter' ? { model: db.openrouterRequestModel, routing: db.openrouterProvider } : undefined,
        nanogpt: db.aiModel === 'nanogpt' ? { model: db.nanogptRequestModel, provider: db.nanogptProvider } : undefined,
        reverseProxy: db.aiModel === 'reverse_proxy' ? { model: db.customProxyRequestModel, format: db.customAPIFormat, url: db.forceReplaceUrl } : undefined,
        custom: custom ? { model: custom.internalId, format: custom.format, url: custom.url } : undefined,
    })
}

export async function generateSocialResponse(
    context: PublicReactionContext,
    signal: AbortSignal,
    limits: SocialLimits = getSocialLimits(getDatabase().socialFeed),
): Promise<string> {
    return requestPublicMessages(socialMessages(context), signal, limits)
}

export async function generateSocialPublication(context: PublicPublicationContext, signal: AbortSignal, limits: SocialLimits): Promise<string> {
    return requestPublicMessages(socialPublicationMessages(context), signal, limits)
}

async function requestPublicMessages(messages: { role: 'system' | 'user'; content: string }[], signal: AbortSignal, limits: SocialLimits): Promise<string> {
    if (!socialModelSupported()) throw new Error('Unsupported social model')
    // Direct transport: no chat triggers, plugin replacers, fallback or automatic retries.
    const result = await requestChatDataMain(
        {
            formated: messages,
            staticModel: getDatabase().aiModel,
            bias: {},
            maxTokens: getSocialLimits(limits).maxResponse,
            tokenContext: getSocialLimits(limits).maxContext,
            useStreaming: false,
            noMultiGen: true,
            tools: [],
            blockPlugins: true,
            publicOnly: true,
            extractJson: '',
        },
        'model',
        signal,
    )
    if (result.type !== 'success') {
        const diagnostic = result.type === 'fail' ? result.publicDiagnostic : undefined
        throw new SocialGenerationError(diagnostic?.code ?? 'request_error', diagnostic?.status)
    }
    const text = result.result.trim()
    assertPublicFinalText(text)
    if (!text) throw new SocialGenerationError('empty_response')
    return text
}
