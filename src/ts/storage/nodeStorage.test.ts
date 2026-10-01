import { afterEach, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { Buffer } from 'node:buffer'

const { input, error, wait } = vi.hoisted(() => ({
    input: vi.fn(async () => 'fictional-password'),
    error: vi.fn(),
    wait: vi.fn(),
}))
vi.mock('src/lang', () => ({
    language: { setNodePassword: 'set password', inputNodePassword: 'sign in' },
}))
vi.mock('../alert', () => ({
    alertInput: input,
    alertError: error,
    waitAlert: wait,
}))
vi.mock('../util', () => ({
    base64url: (data: Uint8Array) => Buffer.from(data).toString('base64url'),
    getKeypairStore: vi.fn(),
    saveKeypairStore: vi.fn(),
}))
import { NodeStorage } from './nodeStorage'

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    input.mockClear()
    error.mockClear()
    wait.mockClear()
})

async function storageFixture(setupStatus = 200, loginStatus = 200) {
    vi.stubGlobal('crypto', webcrypto)
    vi.stubGlobal('Buffer', Buffer)
    const storage = new NodeStorage()
    const key = await webcrypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign', 'verify'],
    )
    vi.spyOn(storage, 'getKeyPair').mockResolvedValue(key)
    let registered = false
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
        if (url === '/api/test_auth') return Response.json({ status: 'unset' })
        if (url === '/api/crypto')
            return new Response('fictional-password-digest')
        if (url === '/api/set_password')
            return new Response('{}', { status: setupStatus })
        if (url === '/api/login') {
            const body = JSON.parse(options.body as string)
            expect(body.password).toBe('fictional-password-digest')
            expect(body.publicKey.kty).toBe('EC')
            registered = loginStatus === 200
            return Response.json(
                { error: registered ? undefined : 'Password incorrect' },
                { status: loginStatus },
            )
        }
        if (url === '/api/read')
            return new Response('', { status: registered ? 200 : 401 })
        throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    return { storage, fetchMock }
}

describe('Node first password', () => {
    it('registers the browser key before reading a fresh save', async () => {
        const { storage, fetchMock } = await storageFixture()
        expect(await storage.getItem('database/database.bin')).toBeNull()
        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
            '/api/test_auth',
            '/api/crypto',
            '/api/set_password',
            '/api/login',
            '/api/read',
        ])
        expect(input).toHaveBeenCalledTimes(1)
        expect(storage.authChecked).toBe(true)
    })
    it('does not read or register after password setup fails', async () => {
        const { storage, fetchMock } = await storageFixture(400)
        await expect(
            storage.getItem('database/database.bin'),
        ).rejects.toContain('Password setup failed (400)')
        expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain(
            '/api/read',
        )
        expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain(
            '/api/login',
        )
        expect(storage.authChecked).toBe(false)
    })
    it('does not read when browser key registration fails', async () => {
        const { storage, fetchMock } = await storageFixture(200, 400)
        await expect(storage.getItem('database/database.bin')).rejects.toBe(
            'Password incorrect',
        )
        expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain(
            '/api/read',
        )
        expect(storage.authChecked).toBe(false)
    })
})
