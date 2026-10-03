import type { RequestDataArgumentExtended } from '../process/request/request'
/** A standalone card request never enters chat orchestration or implicit context. */
export function cardRequestOptions(prompt: string): RequestDataArgumentExtended {
    return { formated: [{ role: 'user', content: prompt }], bias: {}, blockPlugins: true, noMultiGen: true, useStreaming: false, tools: [], extractJson: '', isolatedContext: true }
}
