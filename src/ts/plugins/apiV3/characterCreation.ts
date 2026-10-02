import { CCardLib, type CharacterCardV3 } from '@risuai/ccardlib'
import { Buffer } from 'buffer'
import crc32 from 'crc/crc32'
import { get, type Readable } from 'svelte/store'
import type { CharacterCardV2Risu } from 'src/ts/characterCards'
import type { character, groupChat } from 'src/ts/storage/database.svelte'

export interface CreateCharacterFromCardOptions {
    card: CharacterCardV2Risu | CharacterCardV3
    portraitDataUrl?: string
}

type Dependencies = {
    pluginName: string
    confirm: (message: string) => Promise<boolean>
    importCard: (card: CharacterCardV2Risu | CharacterCardV3) => Promise<character | false>
    savePortrait: (bytes: Uint8Array) => Promise<string>
    decodeImage: (bytes: Uint8Array) => Promise<void>
    getCharacters: () => Array<character | groupChat>
    updateCharacterOrder: () => void
}

const maxCardBytes = 10 * 1024 * 1024
const maxPortraitBytes = 10 * 1024 * 1024
const pngPrefix = 'data:image/png;base64,'
let pendingCharacterCreation: Promise<void> = Promise.resolve()

export async function confirmUninterrupted<T extends { type: string, msg: string }>(
    message: string,
    showConfirm: (message: string) => Promise<boolean>,
    alertStore: Readable<T>,
): Promise<boolean> {
    const confirmation = showConfirm(message)
    const expectedPrompt = get(alertStore)
    let replaced = expectedPrompt.type !== 'ask' || expectedPrompt.msg !== message
    const unsubscribe = alertStore.subscribe(state => {
        if (state.type !== 'none' && state !== expectedPrompt) replaced = true
    })
    try {
        return await confirmation && !replaced
    } finally {
        unsubscribe()
    }
}

function runCharacterCreation<T>(operation: () => Promise<T>): Promise<T> {
    const result = pendingCharacterCreation.then(operation)
    pendingCharacterCreation = result.then(() => undefined, () => undefined)
    return result
}

function validPngChunks(bytes: Uint8Array): boolean {
    if (bytes.length < 45 || !bytes.slice(0, 8).every((byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index])) return false
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    let offset = 8
    let hasImageData = false
    let firstChunk = true
    while (offset + 12 <= bytes.length) {
        const length = view.getUint32(offset)
        if (length > bytes.length - offset - 12) return false
        const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8))
        const expectedCrc = view.getUint32(offset + 8 + length)
        if ((crc32(Buffer.from(bytes.subarray(offset + 4, offset + 8 + length))) >>> 0) !== expectedCrc) return false
        if (firstChunk) {
            const width = view.getUint32(offset + 8)
            const height = view.getUint32(offset + 12)
            if (type !== 'IHDR' || length !== 13 || !width || !height ||
                width > 8192 || height > 8192 || width * height > 16 * 1024 * 1024) return false
        }
        if (type === 'IDAT') hasImageData = true
        offset += length + 12
        if (type === 'IEND') return length === 0 && hasImageData && offset === bytes.length
        firstChunk = false
    }
    return false
}

function decodePortrait(value: unknown): Uint8Array | undefined {
    if (value === undefined) return undefined
    if (typeof value !== 'string' || !value.startsWith(pngPrefix) ||
        value.length > pngPrefix.length + Math.ceil(maxPortraitBytes / 3) * 4) {
        throw new Error('Portrait must be a PNG data URL of at most 10 MiB.')
    }
    const base64 = value.slice(pngPrefix.length)
    if (!base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
        throw new Error('Portrait must be a valid PNG data URL.')
    }
    const binary = atob(base64)
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
    if (bytes.length > maxPortraitBytes || !validPngChunks(bytes)) {
        throw new Error('Portrait must contain PNG image data of at most 10 MiB.')
    }
    return bytes
}

function validateCard(value: unknown): CharacterCardV2Risu | CharacterCardV3 {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('A character card is required.')
    }
    let serialized: string
    try {
        serialized = JSON.stringify(value)
    } catch {
        throw new Error('Character card must be serializable.')
    }
    if (!serialized || new TextEncoder().encode(serialized).length > maxCardBytes) {
        throw new Error('Character card must be at most 10 MiB.')
    }
    const card = JSON.parse(serialized)
    const version = card.spec === 'chara_card_v2' ? 'v2' : card.spec === 'chara_card_v3' ? 'v3' : undefined
    const validationCopy = structuredClone(card)
    const entries = validationCopy.data?.character_book?.entries
    if (Array.isArray(entries)) {
        for (const entry of entries) {
            if (!entry || typeof entry !== 'object') continue
            if ((entry.mode !== undefined && typeof entry.mode !== 'string') ||
                (entry.folder !== undefined && typeof entry.folder !== 'string')) {
                throw new Error('Character card lorebook mode and folder must be strings.')
            }
            delete entry.mode
            delete entry.folder
        }
    }
    if (!version || CCardLib.character.check(validationCopy) !== version || typeof card.data?.name !== 'string' ||
        !card.data.name.trim()) {
        throw new Error('Character card must be a valid V2 or V3 card with a name.')
    }
    return card
}

export async function createCharacterFromCard(
    value: unknown,
    dependencies: Dependencies,
): Promise<{ chaId: string, name: string }> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Character creation requires an options object.')
    }
    const options = value as Record<string, unknown>
    const card = validateCard(options.card)
    const portrait = decodePortrait(options.portraitDataUrl)
    if (portrait) {
        try {
            await dependencies.decodeImage(portrait)
        } catch {
            throw new Error('Portrait must contain a decodable PNG image.')
        }
    }
    const name = card.data.name.trim()
    const displayName = name.replace(/\s+/g, ' ')
    return runCharacterCreation(async () => {
        const consent = await dependencies.confirm(
            `Allow plugin "${dependencies.pluginName}" to create a new character named "${displayName}"?`,
        )
        if (!consent) throw new Error('Character creation was denied.')

        const created = await dependencies.importCard(card)
        if (!created) throw new Error('Character card import was cancelled.')
        if (portrait) created.image = await dependencies.savePortrait(portrait)
        const characters = dependencies.getCharacters()
        if (characters.some(existing => existing.chaId === created.chaId)) {
            throw new Error('Character card import produced an existing character ID.')
        }
        characters.push(created)
        dependencies.updateCharacterOrder()
        return { chaId: created.chaId, name: created.name }
    })
}
