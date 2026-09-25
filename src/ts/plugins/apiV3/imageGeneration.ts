import type { OpenRouterImageConfig } from 'src/ts/storage/database.svelte'

export interface GenerateImageOptions {
    prompt: string
    referenceImageDataUrl?: string
}

export interface OpenRouterImageModel {
    id: string
    name: string
    supportsReferences: boolean
    capabilities: {
        aspectRatio?: string[]
        resolution?: string[]
        quality?: string[]
        outputFormat?: string[]
        seed?: { min: number, max?: number }
    }
}

type ImageGenerationDependencies = {
    apiKey: string
    modelId: string
    imageOptions?: OpenRouterImageConfig
    requestPermission: () => Promise<boolean>
    fetcher?: typeof fetch
}

type OpenRouterImageDependencies = Omit<ImageGenerationDependencies, 'requestPermission'>

const imageModelsUrl = 'https://openrouter.ai/api/v1/images/models'
const imagesUrl = 'https://openrouter.ai/api/v1/images'
const imageDataUrl = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/
const maxReferenceBytes = 10 * 1024 * 1024
const maxReferenceDataUrlLength = 'data:image/jpeg;base64,'.length + Math.ceil(maxReferenceBytes / 3) * 4
const rasterFormats = new Set(['png', 'jpeg', 'webp'])
let pendingImagePermission: Promise<void> = Promise.resolve()

function requestImagePermission(requestPermission: () => Promise<boolean>): Promise<boolean> {
    const result = pendingImagePermission.then(requestPermission)
    pendingImagePermission = result.then(() => undefined, () => undefined)
    return result
}

function enumValues(value: unknown): string[] | undefined {
    if (!value || typeof value !== 'object') return undefined
    const descriptor = value as Record<string, unknown>
    if (descriptor.type !== 'enum' || !Array.isArray(descriptor.values)) return undefined
    const values = descriptor.values.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 100)
    return values.length ? values : undefined
}

function integerRange(value: unknown): { min: number, max: number } | undefined {
    if (!value || typeof value !== 'object') return undefined
    const descriptor = value as Record<string, unknown>
    if (descriptor.type !== 'range' || !Number.isSafeInteger(descriptor.min) ||
        !Number.isSafeInteger(descriptor.max) || (descriptor.min as number) > (descriptor.max as number)) return undefined
    return { min: descriptor.min as number, max: descriptor.max as number }
}

function seedCapability(value: unknown): { min: number, max?: number } | undefined {
    const range = integerRange(value)
    if (range) return range
    if (value && typeof value === 'object' && (value as Record<string, unknown>).type === 'boolean') {
        return { min: 0 }
    }
    return undefined
}

function referenceSupported(value: unknown): boolean {
    const range = integerRange(value)
    if (range) return range.max >= 1
    return !!value && typeof value === 'object' && (value as Record<string, unknown>).type === 'boolean'
}

function rasterMime(base64: string): string | undefined {
    if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return undefined
    const header = atob(base64.slice(0, 32))
    if (header.startsWith('\x89PNG\r\n\x1a\n')) return 'image/png'
    if (header.startsWith('\xff\xd8\xff')) return 'image/jpeg'
    if (header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP') return 'image/webp'
    return undefined
}

function validateOptions(value: unknown): GenerateImageOptions {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Image generation requires an options object.')
    }
    const options = value as Record<string, unknown>
    if (typeof options.prompt !== 'string' || !options.prompt.trim() || options.prompt.length > 10000) {
        throw new Error('Image prompt must be a nonempty string of at most 10000 characters.')
    }
    if (options.negativePrompt !== undefined) {
        throw new Error('OpenRouter image generation does not support negative prompts.')
    }
    const reference = options.referenceImageDataUrl
    const referenceMatch = typeof reference === 'string' && reference.length <= maxReferenceDataUrlLength
        ? imageDataUrl.exec(reference) : null
    const detectedMime = referenceMatch ? rasterMime(referenceMatch[2]) : undefined
    if (reference !== undefined &&
        (!referenceMatch || (referenceMatch[2].length / 4 * 3 - (referenceMatch[2].endsWith('==') ? 2 : referenceMatch[2].endsWith('=') ? 1 : 0)) > maxReferenceBytes ||
            !detectedMime)) {
        throw new Error('Reference image must be a PNG, JPEG, or WebP base64 data URL under 10 MB.')
    }
    return {
        prompt: options.prompt as string,
        referenceImageDataUrl: referenceMatch && detectedMime ? `data:${detectedMime};base64,${referenceMatch[2]}` : undefined,
    }
}

export async function getOpenRouterImageModels(fetcher: typeof fetch = fetch): Promise<OpenRouterImageModel[]> {
    const response = await fetcher(imageModelsUrl)
    if (!response.ok) throw new Error(`OpenRouter image model lookup failed (HTTP ${response.status}).`)
    const result: unknown = await response.json()
    if (!result || typeof result !== 'object' || !Array.isArray((result as { data?: unknown }).data)) {
        throw new Error('OpenRouter returned an invalid image model list.')
    }
    return (result as { data: unknown[] }).data.flatMap((entry): OpenRouterImageModel[] => {
        if (!entry || typeof entry !== 'object') return []
        const model = entry as Record<string, unknown>
        const architecture = model.architecture as Record<string, unknown> | undefined
        const parameters = model.supported_parameters as Record<string, unknown> | undefined
        if (typeof model.id !== 'string' || typeof model.name !== 'string' ||
            !Array.isArray(architecture?.output_modalities) || !architecture.output_modalities.includes('image')) return []
        const advertisedFormats = enumValues(parameters?.output_format)
        const outputFormats = advertisedFormats?.filter((format) => rasterFormats.has(format))
        if (advertisedFormats && !outputFormats?.length) return []
        return [{
            id: model.id,
            name: model.name,
            supportsReferences: Array.isArray(architecture?.input_modalities) &&
                architecture.input_modalities.includes('image') &&
                referenceSupported(parameters?.input_references),
            capabilities: {
                aspectRatio: enumValues(parameters?.aspect_ratio),
                resolution: enumValues(parameters?.resolution),
                quality: enumValues(parameters?.quality),
                outputFormat: outputFormats?.length ? outputFormats : undefined,
                seed: seedCapability(parameters?.seed),
            },
        }]
    })
}

export async function generatePluginImage(
    input: unknown,
    dependencies: ImageGenerationDependencies,
): Promise<string> {
    const options = validateOptions(input)
    const apiKey = dependencies.apiKey?.trim()
    const modelId = dependencies.modelId?.trim()
    if (!apiKey) throw new Error('Configure an OpenRouter API key before generating images.')
    if (!modelId) throw new Error('Select an OpenRouter image model before generating images.')
    if (!await requestImagePermission(dependencies.requestPermission)) {
        throw new Error('Image generation permission was denied.')
    }

    return generateOpenRouterImage(options, dependencies)
}

export async function generateOpenRouterImage(
    input: unknown,
    dependencies: OpenRouterImageDependencies,
): Promise<string> {
    const options = validateOptions(input)
    const apiKey = dependencies.apiKey?.trim()
    const modelId = dependencies.modelId?.trim()
    if (!apiKey) throw new Error('Configure an OpenRouter API key before generating images.')
    if (!modelId) throw new Error('Select an OpenRouter image model before generating images.')

    const fetcher = dependencies.fetcher ?? fetch
    const models = await getOpenRouterImageModels(fetcher)
    const model = models.find((item) => item.id === modelId)
    if (!model) throw new Error('The selected OpenRouter model cannot generate images or is unavailable.')
    if (options.referenceImageDataUrl && !model.supportsReferences) {
        throw new Error('The selected OpenRouter image model does not support reference images.')
    }

    const body: Record<string, unknown> = { model: modelId, prompt: options.prompt.trim() }
    const configured = dependencies.imageOptions ?? {}
    for (const [configKey, requestKey] of [
        ['aspectRatio', 'aspect_ratio'],
        ['resolution', 'resolution'],
        ['quality', 'quality'],
        ['outputFormat', 'output_format'],
    ] as const) {
        const value = configured[configKey]
        if (!value) continue
        if (!model.capabilities[configKey]?.includes(value)) {
            throw new Error(`The selected OpenRouter image model does not support the configured ${requestKey}.`)
        }
        body[requestKey] = value
    }
    if (configured.seed !== undefined) {
        const range = model.capabilities.seed
        if (!range || !Number.isSafeInteger(configured.seed) ||
            configured.seed < range.min || (range.max !== undefined && configured.seed > range.max)) {
            throw new Error('The selected OpenRouter image model does not support the configured seed.')
        }
        body.seed = configured.seed
    }
    if (options.referenceImageDataUrl) {
        body.input_references = [{ type: 'image_url', image_url: { url: options.referenceImageDataUrl } }]
    }
    const response = await fetcher(imagesUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`OpenRouter image generation failed (HTTP ${response.status}).`)

    const result: unknown = await response.json()
    const data = result && typeof result === 'object' ? (result as { data?: unknown }).data : undefined
    const image = Array.isArray(data) ? data[0] as { b64_json?: unknown, media_type?: unknown } | undefined : undefined
    const detectedMime = typeof image?.b64_json === 'string' ? rasterMime(image.b64_json) : undefined
    const mime = image?.media_type ?? detectedMime
    if (!detectedMime || mime !== detectedMime) {
        throw new Error('OpenRouter returned no supported raster image.')
    }
    return `data:${mime};base64,${image.b64_json}`
}
