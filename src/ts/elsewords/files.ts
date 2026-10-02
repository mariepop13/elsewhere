import { embedCardInPng, extractPngCard } from './cardCore.js'
export const maxFileBytes = 10 * 1024 * 1024
export function toBase64(bytes: Uint8Array): string {
    let binary = ''
    for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
    return btoa(binary)
}
export function fromBase64(base64: string): Uint8Array { return Uint8Array.from(atob(base64), c => c.charCodeAt(0)) }
export async function imageFromBytes(bytes: Uint8Array) {
    if (!bytes?.length || bytes.length > maxFileBytes) throw new Error('Choose an image smaller than 10 MiB.')
    const bitmap = await createImageBitmap(new Blob([bytes.slice().buffer]))
    try {
        if (!bitmap.width || !bitmap.height || bitmap.width > 8192 || bitmap.height > 8192 || bitmap.width * bitmap.height > 16 * 1024 * 1024) throw new Error('The portrait dimensions are too large.')
        const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height
        const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Could not prepare the portrait.')
        ctx.drawImage(bitmap, 0, 0)
        const png = canvas.toDataURL('image/png').split(',')[1]
        if (fromBase64(png).length > maxFileBytes) throw new Error('The converted PNG exceeds 10 MiB.')
        return { base64: png, url: `data:image/png;base64,${png}` }
    } finally { bitmap.close() }
}
export async function imageFromDataUrl(url: string) {
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(url)
    if (!match || match[2].length > Math.ceil(maxFileBytes / 3) * 4) throw new Error('The image model returned invalid or oversized image data.')
    return imageFromBytes(fromBase64(match[2]))
}
export function parseCardFile(name: string, bytes: Uint8Array) {
    if (!bytes?.length || bytes.length > maxFileBytes) throw new Error('Choose a card smaller than 10 MiB.')
    if (name.toLowerCase().endsWith('.png')) return { ...extractPngCard(toBase64(bytes)), format: 'png' as const }
    if (!name.toLowerCase().endsWith('.json')) throw new Error('Choose a JSON or PNG character card.')
    return { card: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), png: null, format: 'json' as const }
}
export { embedCardInPng }
