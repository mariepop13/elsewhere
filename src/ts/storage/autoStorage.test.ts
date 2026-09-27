import { beforeEach, describe, expect, it, vi } from 'vitest'

const storageData = vi.hoisted(() => ({
    legacy: new Map<string, Uint8Array | boolean>(),
    opfs: new Map<string, Uint8Array>(),
    failOpfsKey: null as string | null,
}))

vi.mock('localforage', () => ({
    default: {
        createInstance: () => ({
            getItem: async (key: string) => storageData.legacy.get(key) ?? null,
            setItem: async (key: string, value: Uint8Array | boolean) => storageData.legacy.set(key, value),
            keys: async () => [...storageData.legacy.keys()],
        }),
    },
}))

vi.mock('src/ts/platform', () => ({ isNodeServer: false }))
vi.mock('./nodeStorage', () => ({ NodeStorage: class {} }))
vi.mock('../alert', () => ({ alertStore: { set: vi.fn() } }))
vi.mock('./opfsStorage', () => ({
    OpfsStorage: class {
        getItem = async (key: string) => storageData.opfs.get(key) ?? null
        setItem = async (key: string, value: Uint8Array) => {
            if (key === storageData.failOpfsKey) throw new Error('Interrupted OPFS copy')
            storageData.opfs.set(key, value)
        }
        keys = async () => [...storageData.opfs.keys()]
    },
}))

import { AutoStorage } from './autoStorage'

describe('AutoStorage local startup', () => {
    beforeEach(() => {
        storageData.legacy.clear()
        storageData.opfs.clear()
        storageData.failOpfsKey = null
        localStorage.clear()
        localStorage.setItem('opfs_flag!', 'able')
        vi.stubGlobal('FileSystemFileHandle', class { createWritable() {} })
        Object.defineProperty(navigator, 'storage', {
            configurable: true,
            value: { getDirectory: vi.fn() },
        })
    })

    it('preserves an existing OPFS profile when a legacy account marker and localforage database are present', async () => {
        const oldDatabase = new Uint8Array([1])
        const currentDatabase = new Uint8Array([2])
        storageData.legacy.set('database/database.bin', oldDatabase)
        storageData.opfs.set('database/database.bin', currentDatabase)
        localStorage.setItem('accountst', 'able')

        const storage = new AutoStorage()
        await storage.Init()

        expect(await storage.getItem('database/database.bin')).toBe(currentDatabase)
        expect(storageData.legacy.get('database/database.bin')).toBe(oldDatabase)
        expect(storageData.legacy.has('migrated')).toBe(false)
    })

    it('does not overwrite an OPFS directory that contains other local data', async () => {
        const oldDatabase = new Uint8Array([1])
        const existingAsset = new Uint8Array([2])
        storageData.legacy.set('database/database.bin', oldDatabase)
        storageData.opfs.set('assets/existing.png', existingAsset)

        const storage = new AutoStorage()
        await storage.Init()

        expect(await storage.getItem('database/database.bin')).toBe(oldDatabase)
        expect(storageData.opfs.get('assets/existing.png')).toBe(existingAsset)
        expect(storageData.opfs.has('database/database.bin')).toBe(false)
    })

    it('uses the intact legacy profile after an OPFS copy is interrupted after the database', async () => {
        const oldDatabase = new Uint8Array([1])
        const oldAsset = new Uint8Array([2])
        storageData.legacy.set('database/database.bin', oldDatabase)
        storageData.legacy.set('assets/character.png', oldAsset)
        storageData.failOpfsKey = 'assets/character.png'

        await expect(new AutoStorage().Init()).rejects.toThrow('Interrupted OPFS copy')
        expect(storageData.opfs.get('database/database.bin')).toBe(oldDatabase)
        expect(storageData.opfs.has('assets/character.png')).toBe(false)
        expect(storageData.legacy.has('migrated')).toBe(false)

        storageData.failOpfsKey = null
        const restarted = new AutoStorage()
        await restarted.Init()

        expect(await restarted.getItem('database/database.bin')).toBe(oldDatabase)
        expect(await restarted.getItem('assets/character.png')).toBe(oldAsset)
        expect(storageData.opfs.has('assets/character.png')).toBe(false)
    })

    it('adopts and marks a fully copied OPFS profile after an interrupted completion marker', async () => {
        const oldDatabase = new Uint8Array([1])
        const oldAsset = new Uint8Array([2])
        storageData.legacy.set('database/database.bin', oldDatabase)
        storageData.legacy.set('assets/character.png', oldAsset)
        storageData.opfs.set('database/database.bin', oldDatabase)
        storageData.opfs.set('assets/character.png', oldAsset)

        const storage = new AutoStorage()
        await storage.Init()

        expect(await storage.getItem('assets/character.png')).toBe(oldAsset)
        expect(storageData.legacy.get('migrated')).toBe(true)
    })

    it('migrates legacy local data only when OPFS is empty', async () => {
        const oldDatabase = new Uint8Array([1])
        storageData.legacy.set('database/database.bin', oldDatabase)

        const storage = new AutoStorage()
        await storage.Init()

        expect(storageData.opfs.get('database/database.bin')).toBe(oldDatabase)
        expect(storageData.legacy.get('migrated')).toBe(true)
    })
})
