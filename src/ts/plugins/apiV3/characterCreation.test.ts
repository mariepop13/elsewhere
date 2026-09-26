import { describe, expect, it, vi } from 'vitest'
import { writable } from 'svelte/store'
import type { character } from 'src/ts/storage/database.svelte'
import { confirmUninterrupted, createCharacterFromCard } from './characterCreation'

const card = {
    spec: 'chara_card_v2', spec_version: '2.0',
    data: {
        name: 'New character', description: 'Description', personality: '', scenario: '',
        first_mes: 'Hello', mes_example: '', creator_notes: '', system_prompt: '',
        post_history_instructions: '', alternate_greetings: [], tags: [], creator: '',
        character_version: '', extensions: {},
        character_book: { extensions: {}, entries: [] },
    },
} as const

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg=='

function setup(consent = true) {
    const open = { chaId: 'open', name: 'Open character', type: 'character' } as unknown as character
    const group = { chaId: 'group', name: 'Group', type: 'group' } as unknown as character
    const characters = [open, group]
    const created = { chaId: 'new', name: card.data.name } as character
    const confirm = vi.fn().mockResolvedValue(consent)
    const importCard = vi.fn().mockResolvedValue(created)
    const savePortrait = vi.fn().mockResolvedValue('assets/portrait.png')
    const decodeImage = vi.fn().mockResolvedValue(undefined)
    const characterOrder = ['open', 'group']
    const updateCharacterOrder = vi.fn(() => characterOrder.push(characters.at(-1)!.chaId))
    return { characters, characterOrder, open, group, created, confirm, importCard, savePortrait, decodeImage,
        dependencies: { pluginName: 'Elsewords', getCharacters: () => characters, confirm, importCard,
            savePortrait, decodeImage, updateCharacterOrder } }
}

describe('createCharacterFromCard', () => {
    it('rejects consent when another plugin alert replaces the host prompt', async () => {
        const alerts = writable({ type: 'none', msg: '' })
        let answer!: (value: boolean) => void
        const showConfirm = vi.fn((message: string) => {
            alerts.set({ type: 'ask', msg: message })
            return new Promise<boolean>(resolve => { answer = resolve })
        })
        const consent = confirmUninterrupted('Create New character?', showConfirm, alerts)
        alerts.set({ type: 'ask', msg: 'Continue?' })
        alerts.set({ type: 'none', msg: 'yes' })
        answer(true)
        await expect(consent).resolves.toBe(false)
        expect(showConfirm).toHaveBeenCalledOnce()
    })

    it('accepts an uninterrupted host prompt', async () => {
        const alerts = writable({ type: 'none', msg: '' })
        let answer!: (value: boolean) => void
        const showConfirm = vi.fn((message: string) => {
            alerts.set({ type: 'ask', msg: message })
            return new Promise<boolean>(resolve => { answer = resolve })
        })
        const consent = confirmUninterrupted('Create New character?', showConfirm, alerts)
        alerts.set({ type: 'none', msg: 'yes' })
        answer(true)
        await expect(consent).resolves.toBe(true)
    })

    it('imports a new character and preserves existing characters and group', async () => {
        const context = setup()
        await expect(createCharacterFromCard({ card }, context.dependencies))
            .resolves.toEqual({ chaId: 'new', name: 'New character' })
        expect(context.confirm).toHaveBeenCalledWith(expect.stringContaining('Elsewords'))
        expect(context.confirm).toHaveBeenCalledWith(expect.stringContaining('New character'))
        expect(context.characters).toEqual([context.open, context.group, context.created])
        expect(context.characterOrder).toEqual(['open', 'group', 'new'])
        expect(context.importCard).toHaveBeenCalledOnce()
    })

    it('asks for host consent on every call', async () => {
        const context = setup()
        context.importCard.mockResolvedValueOnce({ chaId: 'first', name: card.data.name })
            .mockResolvedValueOnce({ chaId: 'second', name: card.data.name })
        await createCharacterFromCard({ card }, context.dependencies)
        await createCharacterFromCard({ card }, context.dependencies)
        expect(context.confirm).toHaveBeenCalledTimes(2)
    })

    it('serializes overlapping consent prompts for different characters', async () => {
        const context = setup()
        let grantFirst!: (value: boolean) => void
        context.confirm.mockImplementationOnce(() => new Promise<boolean>(resolve => { grantFirst = resolve }))
            .mockResolvedValueOnce(false)
        const secondCard = { ...card, data: { ...card.data, name: 'Other character' } }
        const first = createCharacterFromCard({ card }, context.dependencies)
        const second = createCharacterFromCard({ card: secondCard }, context.dependencies)
        await vi.waitFor(() => expect(context.confirm).toHaveBeenCalledTimes(1))
        expect(context.confirm.mock.calls[0][0]).toContain('New character')
        grantFirst(true)
        await expect(first).resolves.toEqual({ chaId: 'new', name: 'New character' })
        await expect(second).rejects.toThrow('denied')
        expect(context.confirm.mock.calls[1][0]).toContain('Other character')
        expect(context.importCard).toHaveBeenCalledTimes(1)
        expect(context.characters).toHaveLength(3)
    })

    it('waits for an import with a second host prompt before starting another creation', async () => {
        const context = setup()
        let finishImport!: (created: character) => void
        context.importCard.mockImplementationOnce(() => new Promise<character>(resolve => {
            finishImport = resolve
        })).mockResolvedValueOnce({ chaId: 'second', name: 'Other character' })

        const first = createCharacterFromCard({ card }, context.dependencies)
        const secondCard = { ...card, data: { ...card.data, name: 'Other character' } }
        const second = createCharacterFromCard({ card: secondCard }, context.dependencies)

        await vi.waitFor(() => expect(context.importCard).toHaveBeenCalledTimes(1))
        expect(context.confirm).toHaveBeenCalledTimes(1)
        finishImport(context.created)
        await expect(first).resolves.toEqual({ chaId: 'new', name: 'New character' })
        await expect(second).resolves.toEqual({ chaId: 'second', name: 'Other character' })
        expect(context.confirm).toHaveBeenCalledTimes(2)
    })

    it('does not add a character when a secondary import prompt is replaced', async () => {
        const context = setup()
        const alerts = writable({ type: 'none', msg: '' })
        let answer!: (value: boolean) => void
        const showLowLevelPrompt = vi.fn((message: string) => {
            alerts.set({ type: 'ask', msg: message })
            return new Promise<boolean>(resolve => { answer = resolve })
        })
        context.importCard.mockImplementation(async () => {
            const approved = await confirmUninterrupted('Allow low-level access?', showLowLevelPrompt, alerts)
            return approved ? context.created : false
        })

        const creation = createCharacterFromCard({ card }, context.dependencies)
        await vi.waitFor(() => expect(showLowLevelPrompt).toHaveBeenCalledOnce())
        alerts.set({ type: 'ask', msg: 'Allow an unrelated action?' })
        alerts.set({ type: 'none', msg: 'yes' })
        answer(true)

        await expect(creation).rejects.toThrow('cancelled')
        expect(context.characters).toHaveLength(2)
    })

    it('accepts RisuAI lorebook fields without removing them from the imported card', async () => {
        const context = setup()
        const risuCard = {
            ...card,
            data: { ...card.data, character_book: { extensions: {}, entries: [{
                keys: ['forest'], content: 'A forest', extensions: {}, enabled: true,
                insertion_order: 100, mode: 'normal', folder: 'Places',
            }] } },
        }
        await createCharacterFromCard({ card: risuCard }, context.dependencies)
        expect(context.importCard.mock.calls[0][0].data.character_book.entries[0])
            .toMatchObject({ mode: 'normal', folder: 'Places' })
    })

    it('rejects malformed RisuAI lorebook fields before consent', async () => {
        const context = setup()
        const invalid = { ...card, data: { ...card.data, character_book: { extensions: {}, entries: [{
            keys: ['forest'], content: 'A forest', extensions: {}, enabled: true,
            insertion_order: 100, mode: {}, folder: 'Places',
        }] } } }
        await expect(createCharacterFromCard({ card: invalid }, context.dependencies)).rejects.toThrow('lorebook')
        expect(context.confirm).not.toHaveBeenCalled()
        expect(context.importCard).not.toHaveBeenCalled()
    })

    it('accepts a V3 card and passes its lorebook to the import path', async () => {
        const context = setup()
        const v3 = {
            spec: 'chara_card_v3', spec_version: '3.0',
            data: {
                ...card.data,
                character_book: { extensions: {}, entries: [{
                    keys: ['forest'], content: 'A forest', extensions: {}, enabled: true,
                    insertion_order: 100, use_regex: false,
                }] },
                group_only_greetings: [], assets: [],
            },
        }
        await createCharacterFromCard({ card: v3 }, context.dependencies)
        expect(context.importCard.mock.calls[0][0].data.character_book.entries[0].content).toBe('A forest')
        expect(context.characters).toHaveLength(3)
    })

    it('rejects a V3 lorebook entry without use_regex before consent', async () => {
        const context = setup()
        const v3 = {
            spec: 'chara_card_v3', spec_version: '3.0',
            data: {
                ...card.data,
                character_book: { extensions: {}, entries: [{
                    keys: ['forest'], content: 'A forest', extensions: {}, enabled: true,
                    insertion_order: 100,
                }] },
                group_only_greetings: [], assets: [],
            },
        }
        await expect(createCharacterFromCard({ card: v3 }, context.dependencies)).rejects.toThrow('valid V2 or V3')
        expect(context.confirm).not.toHaveBeenCalled()
    })

    it('rejects invalid and oversized cards before consent or writing', async () => {
        const context = setup()
        for (const invalid of [null, { ...card, spec: 'invalid' },
            { ...card, data: { ...card.data, name: '' } },
            { ...card, data: { ...card.data, description: 'x'.repeat(11 * 1024 * 1024) } }]) {
            await expect(createCharacterFromCard({ card: invalid }, context.dependencies)).rejects.toThrow()
        }
        expect(context.confirm).not.toHaveBeenCalled()
        expect(context.importCard).not.toHaveBeenCalled()
        expect(context.characters).toHaveLength(2)
    })

    it('rejects denied consent without importing', async () => {
        const context = setup(false)
        await expect(createCharacterFromCard({ card }, context.dependencies)).rejects.toThrow('denied')
        expect(context.importCard).not.toHaveBeenCalled()
        expect(context.characters).toHaveLength(2)
    })

    it('saves PNG portrait and attaches it to the new character', async () => {
        const context = setup()
        await createCharacterFromCard({ card, portraitDataUrl: `data:image/png;base64,${png}` }, context.dependencies)
        expect(context.savePortrait).toHaveBeenCalledWith(expect.any(Uint8Array))
        expect(context.decodeImage).toHaveBeenCalledWith(expect.any(Uint8Array))
        expect(context.created.image).toBe('assets/portrait.png')
    })

    it('rejects a truncated PNG before consent or writing', async () => {
        const context = setup()
        await expect(createCharacterFromCard({ card, portraitDataUrl: `data:image/png;base64,${png.slice(0, 60)}` }, context.dependencies))
            .rejects.toThrow('PNG')
        expect(context.confirm).not.toHaveBeenCalled()
        expect(context.savePortrait).not.toHaveBeenCalled()
    })

    it('rejects a PNG that the image decoder cannot open', async () => {
        const context = setup()
        context.decodeImage.mockRejectedValue(new Error('decode failed'))
        await expect(createCharacterFromCard({ card, portraitDataUrl: `data:image/png;base64,${png}` }, context.dependencies))
            .rejects.toThrow('decodable PNG')
        expect(context.confirm).not.toHaveBeenCalled()
        expect(context.savePortrait).not.toHaveBeenCalled()
    })

    it('rejects invalid portrait and duplicate ID before appending', async () => {
        const context = setup()
        await expect(createCharacterFromCard({ card, portraitDataUrl: 'data:image/png;base64,abcd' }, context.dependencies))
            .rejects.toThrow('PNG')
        expect(context.confirm).not.toHaveBeenCalled()
        context.importCard.mockResolvedValue({ chaId: 'open', name: 'Duplicate' })
        await expect(createCharacterFromCard({ card }, context.dependencies)).rejects.toThrow('existing character ID')
        expect(context.characters).toHaveLength(2)
    })
})
