import type { RequestDataArgumentExtended } from './request';
import { resolveNativeCapabilities, validateTokenPayload, type TokenCapabilities, type TokenSelection } from '../../model/tokenCapabilities';
import { loadTokenCapabilities } from '../../model/tokenCapabilities.svelte';
import { encodeWithTokenizer } from '../../tokenizer';
import { LLMTokenizer } from '../../model/types';

function textualPayload(value: any): any {
    if (typeof value === 'string') return value.startsWith('data:') ? '[media]' : value;
    if (Array.isArray(value)) return value.map(textualPayload);
    if (!value || typeof value !== 'object') return value;
    if (['image', 'input_image', 'audio', 'input_audio'].includes(value.type) || value.type === 'base64') return '[media]';
    const result: Record<string, any> = {};
    for (const [key, child] of Object.entries(value)) {
        if (['image_url', 'audio_url', 'video_url', 'inlineData', 'inline_data', 'input_audio', 'file_data', 'base64', 'b64_json'].includes(key)) result[key] = '[media]';
        else result[key] = textualPayload(child);
    }
    return result;
}

/** Local text/schema/tool estimate excludes binary media. Provider counts remain authoritative. */
export async function estimatePayloadInput(body: any, tokenizer?: number): Promise<number> {
    const input = body.messages ?? body.contents ?? body.prompt ?? body.input ?? body.text ?? body.message;
    const text = JSON.stringify(textualPayload({ input, system: body.system ?? body.systemInstruction, tools: body.tools, history: body.chat_history }));
    const encoded = await encodeWithTokenizer(text, tokenizer === LLMTokenizer.tiktokenO200Base ? 'tik-o200' : 'tik');
    return encoded.length;
}

/** Re-resolve final model/routing overrides before any transport. */
export async function payloadTokenError(arg: RequestDataArgumentExtended, body: any, headers: Record<string, string> = {}): Promise<string | undefined> {
    let cap: TokenCapabilities = arg.tokenCapabilities ?? resolveNativeCapabilities({ provider: arg.modelInfo.provider, modelId: arg.modelInfo.internalID || arg.modelInfo.id, customEndpoint: !!arg.customURL });
    if (arg.tokenSelection) {
        const selection: TokenSelection = { ...arg.tokenSelection, modelId: typeof body.model === 'string' ? body.model : arg.tokenSelection.modelId };
        if (selection.provider === 'openrouter') selection.routing = body.provider ? { only: body.provider.only, ignore: body.provider.ignore, order: body.provider.order } : undefined;
        if (JSON.stringify(selection) !== JSON.stringify(arg.tokenSelection)) cap = await loadTokenCapabilities(selection);
    }
    const hasFinalContext = body.options?.num_ctx !== undefined || body.params?.max_context_length !== undefined || body.max_context_length !== undefined || body.truncation_length !== undefined;
    const input = cap.context || arg.tokenContext || hasFinalContext ? Math.max(arg.inputTokenEstimate ?? 0, await estimatePayloadInput(body, arg.modelInfo.tokenizer)) : arg.inputTokenEstimate;
    const errors = validateTokenPayload(cap, body, { context: arg.tokenContext, input }, headers);
    return errors.length ? errors.join('\n') : undefined;
}
