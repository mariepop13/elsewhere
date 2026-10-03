import { describe, expect, it, vi, beforeEach } from 'vitest'
const mocks = vi.hoisted(() => ({ character: vi.fn(), user: vi.fn(), db: { instructChatTemplate: 'jinja', JinjaTemplate: '{{ risu_char }}|{{ risu_user }}|{% for message in messages %}{{ message.content }}{% endfor %}', ooba: { formating: { userPrefix: 'User', seperator: '\n' } }, username: 'Private user sentinel', NAIsettings: { seperator: '\n', starter: 'Start' }, NAIappendName: true, NAIadventure: false } }))
vi.mock('src/ts/storage/database.svelte', () => ({ getDatabase: () => mocks.db, getCurrentCharacter: mocks.character }))
vi.mock('src/ts/util', () => ({ getUserName: mocks.user }))
import { applyChatTemplate } from './chatTemplate'
import { stringlizeNAIChat } from '../models/nai'
import { stringlizeAINChat, getStopStrings } from '../stringlize'
beforeEach(() => {
    vi.clearAllMocks(); mocks.character.mockImplementation(() => { throw new Error('Implicit character read') }); mocks.user.mockImplementation(() => { throw new Error('Implicit user read') })
    vi.stubGlobal('safeStructuredClone', structuredClone)
})
describe('isolated card text with existing model formats', () => {
    it('renders custom templates without reading active character/persona, including no selected character', () => {
        expect(applyChatTemplate([{ role: 'user', content: 'Explicit card' }], { isolatedContext: true })).toBe('||Explicit card')
        expect(mocks.character).not.toHaveBeenCalled(); expect(mocks.user).not.toHaveBeenCalled()
    })
    it('keeps ordinary chat template context unchanged', () => {
        mocks.character.mockReturnValue({ name: 'Active' }); mocks.user.mockReturnValue('Persona')
        expect(applyChatTemplate([{ role: 'user', content: 'Chat' }])).toBe('Active|Persona|Chat')
    })
    it('uses neutral names without prompt logging for NovelAI and NovelList', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {})
        try {
            expect(stringlizeNAIChat([{ role: 'user', content: 'Explicit card' }], '', false, true)).toContain('Explicit card')
            expect(stringlizeAINChat([{ role: 'user', content: 'Explicit card' }], '', false, true)).toContain('Explicit card')
            expect(log).not.toHaveBeenCalled(); expect(mocks.user).not.toHaveBeenCalled()
        } finally { log.mockRestore() }
    })
    it('excludes private user names from isolated Ooba stopping criteria', () => {
        expect(getStopStrings(false, true)).not.toContain('Private user sentinel:')
        expect(getStopStrings()).toContain('Private user sentinel:')
    })
})
