import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareSocialPhoto } from './socialPhoto'

afterEach(() => vi.unstubAllGlobals())
describe('bounded local social profile photo', () => {
    it('rejects absent/unsupported/oversized files before decoding', async () => {
        const decode = vi.fn()
        vi.stubGlobal('createImageBitmap', decode)
        for (const file of [new File(['x'], 'x.svg', { type: 'image/svg+xml' }), new File([], 'x.png', { type: 'image/png' }), new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })])
            await expect(prepareSocialPhoto(file)).rejects.toThrow()
        expect(decode).not.toHaveBeenCalled()
    })
    it('bounds decoded dimensions and closes rejected bitmaps', async () => {
        const close = vi.fn()
        vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 12001, height: 1, close }))
        await expect(prepareSocialPhoto(new File(['x'], 'x.png', { type: 'image/png' }))).rejects.toThrow()
        expect(close).toHaveBeenCalledOnce()
    })
    it('crops/resizes and returns re-encoded PNG bytes, closing the bitmap', async () => {
        const close = vi.fn(), drawImage = vi.fn(), canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toBlob: (callback: (value: Blob) => void, mime: string) => { expect(mime).toBe('image/png'); callback(new Blob(['normalized'])) } }
        vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 1600, height: 800, close }))
        vi.spyOn(document, 'createElement').mockReturnValueOnce(canvas as unknown as HTMLCanvasElement)
        const bytes = await prepareSocialPhoto(new File(['source metadata'], 'x.jpg', { type: 'image/jpeg' }))
        expect(new TextDecoder().decode(bytes)).toBe('normalized')
        expect(canvas.width).toBe(512)
        expect(canvas.height).toBe(512)
        expect(drawImage.mock.calls[0].slice(1)).toEqual([400, 0, 800, 800, 0, 0, 512, 512])
        expect(close).toHaveBeenCalledOnce()
        vi.restoreAllMocks()
    })
})
