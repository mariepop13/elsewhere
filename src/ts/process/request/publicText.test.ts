import { describe, expect, it } from 'vitest'
import { publicOpenAIText, publicAnthropicText, publicGoogleText } from './publicText'

const final = '{"reaction":"like","comment":"Final"}'
const forbidden = () => { throw new Error('Reasoning must never be read') }
describe('public final text boundary', () => {
    it('reads only OpenAI content, excluding every structured reasoning field', () => {
        const message = { content: final, get reasoning() { return forbidden() }, get reasoning_content() { return forbidden() }, get reasoning_details() { return forbidden() } }
        expect(publicOpenAIText({ message })).toBe(final)
        expect(publicOpenAIText({ message: { content: null } })).toBe('')
        expect(publicOpenAIText({ text: final })).toBe(final)
    })
    it('ignores Anthropic thinking, redacted thinking and signatures', () => {
        expect(publicAnthropicText([
            { type: 'thinking', get text() { return forbidden() } },
            { type: 'text', text: final },
            { type: 'redacted_thinking', get text() { return forbidden() } },
        ])).toBe(final)
        expect(publicAnthropicText([{ type: 'thinking', text: 'SENTINEL' }])).toBe('')
    })
    it('ignores Google thought parts without reading their text', () => {
        expect(publicGoogleText([{ thought: true, get text() { return forbidden() } }, { text: final }])).toBe(final)
        expect(publicGoogleText([{ thought: true, text: 'SENTINEL' }])).toBe('')
    })
})
