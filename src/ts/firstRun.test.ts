import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('location', { hostname: 'localhost' })
const { isPrivateLocalMode, isPrivatePreviewMode, privatePreviewOrigin } = await import('./firstRun')

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


describe('temporary exact-origin private preview', () => {
    it('requires both explicit preview mode and the authorized configured origin', () => {
        expect(isPrivatePreviewMode('private-preview', privatePreviewOrigin, privatePreviewOrigin)).toBe(true)
        for (const mode of [undefined, '', 'private-local', 'hosted']) {
            expect(isPrivatePreviewMode(mode, privatePreviewOrigin, privatePreviewOrigin)).toBe(false)
        }
        for (const configured of [undefined, '', '*', 'https://example.com:8443', privatePreviewOrigin + '/']) {
            expect(isPrivatePreviewMode('private-preview', configured, privatePreviewOrigin)).toBe(false)
        }
    })
    it('rejects other protocols, ports, hosts and lookalike suffixes', () => {
        for (const origin of ['http://bella-felix.taila3974e.ts.net:8443', 'https://bella-felix.taila3974e.ts.net', 'https://bella-felix.taila3974e.ts.net:443', 'https://example.com:8443', 'https://bella-felix.taila3974e.ts.net.example.com:8443', 'http://localhost:6620']) {
            expect(isPrivatePreviewMode('private-preview', privatePreviewOrigin, origin)).toBe(false)
        }
        expect(isPrivateLocalMode('private-local', 'bella-felix.taila3974e.ts.net')).toBe(false)
    })
})
