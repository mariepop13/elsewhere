import { describe, expect, it, vi } from 'vitest'

import { generatePluginImage, getOpenRouterImageModels } from './imageGeneration'

const model = {
    id: 'example/image-model',
    name: 'Image Model',
    architecture: { input_modalities: ['text', 'image'], output_modalities: ['image'] },
    supported_parameters: { input_references: { type: 'boolean' } },
}
const png = 'iVBORw0KGgo='
const jpeg = '/9j/4AAQSkZJRgABAQ=='

function setup(options: { model?: object, imageStatus?: number, permission?: boolean, image?: object } = {}) {
    const fetcher = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ data: [options.model ?? model] }), { status: 200 }))
        .mockResolvedValueOnce(new Response(
            options.imageStatus ? JSON.stringify({ error: 'secret prompt was echoed' }) : JSON.stringify({ data: [options.image ?? { b64_json: png, media_type: 'image/png' }] }),
            { status: options.imageStatus ?? 200 },
        ))
    const requestPermission = vi.fn().mockResolvedValue(options.permission ?? true)
    const dependencies = {
        apiKey: 'private-key',
        modelId: model.id,
        requestPermission,
        fetcher: fetcher as unknown as typeof fetch,
    }
    return { fetcher, requestPermission, dependencies }
}

describe('plugin image generation', () => {
    it('reads supported options from model metadata and excludes vector output formats', async () => {
        const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{
            ...model,
            supported_parameters: {
                aspect_ratio: { type: 'enum', values: ['1:1', '16:9'] },
                output_format: { type: 'enum', values: ['png', 'svg'] },
                seed: { type: 'range', min: 0, max: 100 },
                input_references: { type: 'range', min: 0, max: 0 },
            },
        }] }), { status: 200 }))
        const [imageModel] = await getOpenRouterImageModels(fetcher as unknown as typeof fetch)
        expect(imageModel.supportsReferences).toBe(false)
        expect(imageModel.capabilities).toMatchObject({
            aspectRatio: ['1:1', '16:9'], outputFormat: ['png'], seed: { min: 0, max: 100 },
        })
    })

    it('omits models that advertise only vector output', async () => {
        const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{
            ...model,
            supported_parameters: { output_format: { type: 'enum', values: ['svg'] } },
        }] }), { status: 200 }))
        await expect(getOpenRouterImageModels(fetcher as unknown as typeof fetch)).resolves.toEqual([])
    })

    it('accepts an integer seed when the model advertises boolean seed support', async () => {
        const { fetcher, dependencies } = setup({ model: {
            ...model,
            supported_parameters: { seed: { type: 'boolean' } },
        } })
        const image = await generatePluginImage({ prompt: 'A fox' }, {
            ...dependencies,
            imageOptions: { seed: 42 },
        })
        expect(image).toBe(`data:image/png;base64,${png}`)
        expect(JSON.parse(fetcher.mock.calls[1][1].body).seed).toBe(42)
    })

    it('returns a raster data URL and sends only explicitly provided inputs', async () => {
        const { fetcher, dependencies } = setup()
        const image = await generatePluginImage({
            prompt: 'A fox', referenceImageDataUrl: `data:image/png;base64,${png}`,
        }, dependencies)

        expect(image).toBe(`data:image/png;base64,${png}`)
        const [url, init] = fetcher.mock.calls[1]
        expect(url).toBe('https://openrouter.ai/api/v1/images')
        expect(JSON.parse(init.body)).toEqual({
            model: model.id,
            prompt: 'A fox',
            input_references: [{ type: 'image_url', image_url: { url: `data:image/png;base64,${png}` } }],
        })
        expect(init.headers.Authorization).toBe('Bearer private-key')
    })

    it('uses the image bytes when the reference file is mislabeled', async () => {
        const { fetcher, dependencies } = setup()
        await generatePluginImage({
            prompt: 'A fox', referenceImageDataUrl: `data:image/png;base64,${jpeg}`,
        }, dependencies)

        expect(JSON.parse(fetcher.mock.calls[1][1].body).input_references).toEqual([
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${jpeg}` } },
        ])
    })

    it('rejects a reference the selected model does not support before generation', async () => {
        const { fetcher, dependencies } = setup({ model: {
            ...model, architecture: { input_modalities: ['text'], output_modalities: ['image'] },
        } })
        await expect(generatePluginImage({ prompt: 'A fox', referenceImageDataUrl: `data:image/png;base64,${png}` }, dependencies))
            .rejects.toThrow('does not support reference images')
        expect(fetcher).toHaveBeenCalledTimes(1)
    })

    it('sends only configured parameters supported by the selected image model', async () => {
        const { fetcher, dependencies } = setup({ model: {
            ...model,
            supported_parameters: {
                aspect_ratio: { type: 'enum', values: ['1:1', '16:9'] },
                resolution: { type: 'enum', values: ['1K', '2K'] },
                quality: { type: 'enum', values: ['medium', 'high'] },
                output_format: { type: 'enum', values: ['png', 'webp'] },
                seed: { type: 'range', min: 0, max: 100 },
            },
        } })
        await generatePluginImage({ prompt: 'A fox' }, {
            ...dependencies,
            imageOptions: { aspectRatio: '16:9', resolution: '2K', quality: 'high', outputFormat: 'png', seed: 42 },
        })
        expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
            model: model.id, prompt: 'A fox', aspect_ratio: '16:9', resolution: '2K',
            quality: 'high', output_format: 'png', seed: 42,
        })
    })

    it('rejects stale or unsupported saved settings before generation', async () => {
        const { fetcher, dependencies } = setup()
        await expect(generatePluginImage({ prompt: 'A fox' }, {
            ...dependencies, imageOptions: { aspectRatio: '16:9' },
        })).rejects.toThrow('configured aspect_ratio')
        expect(fetcher).toHaveBeenCalledTimes(1)
    })

    it.each([
        [{ prompt: '' }, 'Image prompt'],
        [{ prompt: 'A fox', negativePrompt: 'watermark' }, 'does not support negative prompts'],
        [{ prompt: 'A fox', referenceImageDataUrl: 'https://example.com/private.png' }, 'Reference image'],
        [{ prompt: 'A fox', referenceImageDataUrl: 'data:image/png;base64,AAAA' }, 'Reference image'],
        [{ prompt: 'A fox', referenceImageDataUrl: `data:image/png;base64,${png}${'A'.repeat(14_000_000)}` }, 'Reference image'],
    ])('rejects invalid input before prompting or fetching', async (input, message) => {
        const { fetcher, requestPermission, dependencies } = setup()
        await expect(generatePluginImage(input, dependencies)).rejects.toThrow(message)
        expect(requestPermission).not.toHaveBeenCalled()
        expect(fetcher).not.toHaveBeenCalled()
    })

    it('rejects missing key and missing image model without using the chat model', async () => {
        const { fetcher, dependencies } = setup()
        await expect(generatePluginImage({ prompt: 'A fox' }, { ...dependencies, apiKey: '' }))
            .rejects.toThrow('OpenRouter API key')
        await expect(generatePluginImage({ prompt: 'A fox' }, { ...dependencies, modelId: '' }))
            .rejects.toThrow('OpenRouter image model')
        expect(fetcher).not.toHaveBeenCalled()
    })

    it('rejects denied consent before any provider request', async () => {
        const { fetcher, dependencies } = setup({ permission: false })
        await expect(generatePluginImage({ prompt: 'A fox' }, dependencies)).rejects.toThrow('permission was denied')
        expect(fetcher).not.toHaveBeenCalled()
    })

    it('requires separate consent for concurrent image requests', async () => {
        let resolveFirstPermission: (approved: boolean) => void = () => {}
        const firstPermission = new Promise<boolean>((resolve) => {
            resolveFirstPermission = resolve
        })
        const { fetcher, dependencies } = setup()
        const requestPermission = vi.fn()
            .mockReturnValueOnce(firstPermission)
            .mockResolvedValueOnce(false)
        const first = generatePluginImage({ prompt: 'First image' }, { ...dependencies, requestPermission })
        const second = generatePluginImage({ prompt: 'Second image' }, { ...dependencies, requestPermission })

        await vi.waitFor(() => expect(requestPermission).toHaveBeenCalledTimes(1))
        resolveFirstPermission(true)
        await expect(first).resolves.toBe(`data:image/png;base64,${png}`)
        await expect(second).rejects.toThrow('permission was denied')
        expect(requestPermission).toHaveBeenCalledTimes(2)
        expect(fetcher).toHaveBeenCalledTimes(2)
    })

    it('reports provider failure without echoing provider content', async () => {
        const { dependencies } = setup({ imageStatus: 403 })
        await expect(generatePluginImage({ prompt: 'A fox' }, dependencies))
            .rejects.toThrow('OpenRouter image generation failed (HTTP 403)')
    })

    it('rejects output whose MIME type does not match its bytes', async () => {
        const { dependencies } = setup({ image: { b64_json: png, media_type: 'image/jpeg' } })
        await expect(generatePluginImage({ prompt: 'A fox' }, dependencies))
            .rejects.toThrow('no supported raster image')
    })

    it('detects a raster MIME type when OpenRouter omits it', async () => {
        const { dependencies } = setup({ image: { b64_json: png } })
        await expect(generatePluginImage({ prompt: 'A fox' }, dependencies))
            .resolves.toBe(`data:image/png;base64,${png}`)
    })

    it('does not mutate character or chat data', async () => {
        const { dependencies } = setup()
        const database = Object.freeze({
            characters: Object.freeze([{ name: 'Character', chats: Object.freeze([{ name: 'Chat' }]) }]),
            openrouterKey: dependencies.apiKey,
            openrouterImageModel: dependencies.modelId,
        })
        const before = JSON.stringify(database)
        await generatePluginImage({ prompt: 'A fox' }, {
            ...dependencies, apiKey: database.openrouterKey, modelId: database.openrouterImageModel,
        })
        expect(JSON.stringify(database)).toBe(before)
    })
})
