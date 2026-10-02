/** Public replies must never use the private-chat thinking formatter. */
export function publicOpenAIText(choice: { text?: unknown; message?: { content?: unknown } }): string {
    const content = choice.message ? choice.message.content : choice.text
    return typeof content === 'string' ? content : ''
}

export function publicAnthropicText(blocks: { type?: string; text?: unknown }[]): string {
    return blocks.filter((block) => block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text as string).join('')
}

export function publicGoogleText(parts: { thought?: boolean; text?: unknown }[]): string {
    return parts.filter((part) => !part.thought && typeof part.text === 'string')
        .map((part) => part.text as string).join('\n\n')
}
