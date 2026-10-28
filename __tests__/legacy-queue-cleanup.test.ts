import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    loaded: vi.fn(),
    deleteRows: vi.fn(async () => 0),
    count: vi.fn(async () => 0),
    deleteDatabase: vi.fn(async () => undefined),
    filters: [] as Array<(mutation: { scope: string }) => boolean>,
}))

// Vitest builds a mocked module once per file, so count reads of `db` (one per
// dynamic import in the cleanup) instead of factory runs.
vi.mock('../lib/db', () => ({
    get db() {
        mocks.loaded()
        return {
            mutations: {
                toCollection: () => ({
                    filter: (predicate: (mutation: { scope: string }) => boolean) => {
                        mocks.filters.push(predicate)
                        return { delete: mocks.deleteRows }
                    },
                }),
                count: mocks.count,
            },
            delete: mocks.deleteDatabase,
        }
    },
}))

function installBrowser(databases?: () => Promise<Array<{ name?: string }>>) {
    vi.stubGlobal('window', { indexedDB: databases ? { databases } : {} })
}

describe('retired offline-queue cleanup on page load', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.clearAllMocks()
        mocks.filters.length = 0
    })
    afterEach(() => vi.unstubAllGlobals())

    it('does not load Dexie or open IndexedDB when the database is gone', async () => {
        installBrowser(async () => [{ name: 'weavly-other' }])
        const { clearLegacyOfflineMutationQueue } = await import('../lib/client-storage-cleanup')
        await expect(clearLegacyOfflineMutationQueue()).resolves.toBe(true)
        expect(mocks.loaded).not.toHaveBeenCalled()
        expect(mocks.deleteRows).not.toHaveBeenCalled()
    })

    it('clears legacy rows and removes the database once it is empty', async () => {
        installBrowser(async () => [{ name: 'TextileDB' }])
        mocks.count.mockResolvedValue(0)
        const { clearLegacyOfflineMutationQueue } = await import('../lib/client-storage-cleanup')
        await expect(clearLegacyOfflineMutationQueue()).resolves.toBe(true)
        expect(mocks.deleteRows).toHaveBeenCalledOnce()
        expect(mocks.filters[0]({ scope: 'legacy-unscoped' })).toBe(true)
        expect(mocks.deleteDatabase).toHaveBeenCalledOnce()
    })

    it('keeps the database while other rows remain', async () => {
        installBrowser(async () => [{ name: 'TextileDB' }])
        mocks.count.mockResolvedValue(2)
        const { clearLegacyOfflineMutationQueue } = await import('../lib/client-storage-cleanup')
        await clearLegacyOfflineMutationQueue()
        expect(mocks.deleteRows).toHaveBeenCalledOnce()
        expect(mocks.deleteDatabase).not.toHaveBeenCalled()
    })

    it('keeps the previous behaviour in browsers without indexedDB.databases()', async () => {
        installBrowser()
        const { clearLegacyOfflineMutationQueue } = await import('../lib/client-storage-cleanup')
        await clearLegacyOfflineMutationQueue()
        expect(mocks.loaded).toHaveBeenCalled()
        expect(mocks.deleteRows).toHaveBeenCalledOnce()
    })
})
