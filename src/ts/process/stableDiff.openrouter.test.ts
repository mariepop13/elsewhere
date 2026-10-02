import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get, writable } from 'svelte/store'

const mocks = vi.hoisted(() => ({
    db: {
        sdProvider: 'openrouter',
        openrouterKey: 'private-key',
        openrouterImageModel: 'example/image-model',
        openrouterImageOptions: { aspectRatio: '1:1' },
    },
    generateOpenRouterImage: vi.fn(),
    alertError: vi.fn(),
}))

vi.mock('../storage/database.svelte', () => ({ getDatabase: () => mocks.db }))
vi.mock('../alert', () => ({ alertError: mocks.alertError }))
vi.mock('../globalApi.svelte', () => ({ globalFetch: vi.fn(), fetchNative: vi.fn(), readImage: vi.fn() }))
vi.mock('./request/request', () => ({ requestChatData: vi.fn() }))
vi.mock('./processzip', () => ({ processZip: vi.fn() }))
vi.mock('src/ts/plugins/apiV3/imageGeneration', () => ({ generateOpenRouterImage: mocks.generateOpenRouterImage }))
vi.mock('../stores.svelte', () => ({
    CharEmotion: writable({}),
    DBState: { db: { characters: [] } },
    selIdState: { selId: -1 },
}))

import { CharEmotion } from '../stores.svelte'
import { generateAIImage } from './stableDiff'

const image = 'data:image/png;base64,iVBORw0KGgo='
const character = { chaId: 'character-1' } as Parameters<typeof generateAIImage>[1]

describe('OpenRouter built-in image generation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        CharEmotion.set({})
        mocks.generateOpenRouterImage.mockResolvedValue(image)
    })

    it('returns a data URL for Playground and inlay generation', async () => {
        await expect(generateAIImage('A fox', character, 'text', 'inlay', 'data:image/png;base64,iVBORw0KGgo=')).resolves.toBe(image)
        expect(mocks.generateOpenRouterImage).toHaveBeenCalledWith(
            { prompt: 'A fox', referenceImageDataUrl: 'data:image/png;base64,iVBORw0KGgo=' },
            { apiKey: 'private-key', modelId: 'example/image-model', imageOptions: { aspectRatio: '1:1' } },
        )
        expect(get(CharEmotion)).toEqual({})
    })

    it('updates the character image for chat generation', async () => {
        await expect(generateAIImage('A fox', character, '', '')).resolves.toBe('')
        expect(get(CharEmotion)['character-1'][0].slice(0, 2)).toEqual([image, image])
    })

    it('reports a provider error without changing the character image', async () => {
        mocks.generateOpenRouterImage.mockRejectedValue(new Error('The image model is unavailable.'))
        await expect(generateAIImage('A fox', character, '', '')).resolves.toBe(false)
        expect(mocks.alertError).toHaveBeenCalledWith('The image model is unavailable.')
        expect(get(CharEmotion)).toEqual({})
    })
})
