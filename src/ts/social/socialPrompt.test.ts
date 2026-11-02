import { expect, it } from 'vitest'
import { socialMessages } from './socialPrompt'
it('supplies a valid example separately from the allowed reaction values, without private schemas', () => {
    const context = { actor: { characterId: 'jun', name: 'Jun', publicProfile: 'Gardener' }, publicWorld: 'Garden', post: { author: 'Mara', text: 'Public chocolate post' }, comments: [] }
    Object.assign(context, { privateChat: 'PRIVATE', jsonSchema: 'PRIVATE' })
    const messages = socialMessages(context)
    const example = messages[0].content.slice(messages[0].content.lastIndexOf('{'))
    expect(JSON.parse(example)).toEqual({ reaction: 'like', comment: 'A brief public reply.' })
    expect(messages[0].content).toContain('exactly one of "like", "love", "curious", "none"')
    expect(messages[0].content).toContain('at most 600 characters')
    expect(messages[0].content).toContain('non-empty comment')
    expect(JSON.stringify(messages)).not.toContain('PRIVATE')
})
