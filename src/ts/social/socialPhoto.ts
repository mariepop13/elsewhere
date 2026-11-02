export const MAX_SOCIAL_PHOTO_BYTES = 5 * 1024 * 1024

/** Raster-only, bounded local decode; re-encode to strip metadata and store a small native asset. */
export async function prepareSocialPhoto(file: File): Promise<Uint8Array> {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || !file.size || file.size > MAX_SOCIAL_PHOTO_BYTES)
        throw new Error('Choose a PNG, JPEG or WebP image under 5 MB.')
    const bitmap = await createImageBitmap(file)
    try {
        if (!bitmap.width || !bitmap.height || bitmap.width > 12000 || bitmap.height > 12000 || bitmap.width * bitmap.height > 32_000_000)
            throw new Error('Choose an image with fewer than 32 million pixels.')
        const size = Math.min(bitmap.width, bitmap.height)
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = Math.min(512, size)
        const context = canvas.getContext('2d')
        if (!context) throw new Error('The image could not be prepared. Try another image.')
        context.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, canvas.width, canvas.height)
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('The image could not be prepared. Try another image.')), 'image/png'))
        return new Uint8Array(await blob.arrayBuffer())
    } finally { bitmap.close() }
}
