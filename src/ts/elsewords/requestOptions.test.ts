import { expect, test } from 'vitest'
import { cardRequestOptions } from './requestOptions'
test('card requests pass only explicit text with isolated single-output provider settings', () => {
    const options = cardRequestOptions('Only the staged card')
    expect(options.formated).toEqual([{ role: 'user', content: 'Only the staged card' }])
    expect(options).toMatchObject({ isolatedContext: true, blockPlugins: true, noMultiGen: true, useStreaming: false, tools: [], extractJson: '' })
    expect(options.currentChar).toBeUndefined()
    expect(options.chatId).toBeUndefined()
})
