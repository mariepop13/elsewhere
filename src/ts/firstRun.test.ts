import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('location', { hostname: 'localhost' })
const { isPrivateLocalMode } = await import('./firstRun')

describe('private source mode', () => {
    it('requires an explicit mode and a loopback origin', () => {
        for (const host of ['localhost', '127.0.0.1', '[::1]', '::1']) {
            expect(isPrivateLocalMode('private-local', host)).toBe(true)
        }
        for (const mode of [undefined, '', 'TRUE', 'true', 'hosted']) {
            expect(isPrivateLocalMode(mode, 'localhost')).toBe(false)
        }
        for (const host of [
            'example.com',
            'localhost.example.com',
            '192.168.1.2',
            '0.0.0.0',
        ]) {
            expect(isPrivateLocalMode('private-local', host)).toBe(false)
        }
    })
})
