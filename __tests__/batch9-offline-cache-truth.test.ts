import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    REACT_QUERY_PERSISTENCE_KEY,
    clearUserCacheFromStorage,
    isUserCacheKey,
} from '../lib/client-storage-cleanup'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('Batch 9 offline/cache truth cleanup', () => {
    function createMemoryStorage(initial: Record<string, string>): Storage {
        const store = new Map(Object.entries(initial))
        return {
            get length() {
                return store.size
            },
            clear() {
                store.clear()
            },
            getItem(key: string) {
                return store.get(key) ?? null
            },
            key(index: number) {
                return Array.from(store.keys())[index] ?? null
            },
            removeItem(key: string) {
                store.delete(key)
            },
            setItem(key: string, value: string) {
                store.set(key, value)
            },
        }
    }

    it('serves truthful public offline fallback routes instead of redirecting to login', () => {
        const proxy = readProjectFile('proxy.ts')
        const nextConfig = readProjectFile('next.config.ts')
        const offlinePage = readProjectFile('app/offline/page.tsx')

        expect(proxy).toContain("pathname.startsWith('/offline')")
        expect(proxy).toContain("pathname.startsWith('/_offline')")
        expect(nextConfig).toContain("source: '/_offline', destination: '/offline'")
        expect(offlinePage).toContain('You are offline')
        expect(offlinePage).toContain('new production, kharchi, payroll, sale, dispatch, and payment entries must wait')
        expect(offlinePage).not.toContain('sync pending changes')
    })

    it('clears user-specific browser cache keys and offline queues on auth boundaries', () => {
        const cleanup = readProjectFile('lib/client-storage-cleanup.ts')
        const logoutButton = readProjectFile('components/auth/logout-button.tsx')
        const loginForm = readProjectFile('app/(auth)/login/login-form.tsx')
        const pwaSessionGuard = readProjectFile('hooks/use-pwa-session-guard.ts')

        expect(REACT_QUERY_PERSISTENCE_KEY).toBe('REACT_QUERY_OFFLINE_CACHE')
        expect(isUserCacheKey('REACT_QUERY_OFFLINE_CACHE')).toBe(true)
        expect(isUserCacheKey('production_meters_2026-06-30_day')).toBe(true)
        expect(isUserCacheKey('weavly-estimator-draft-org-user')).toBe(true)
        expect(isUserCacheKey('weavly-uid')).toBe(true)
        expect(isUserCacheKey('weavly_skip_fixed_staff')).toBe(true)
        expect(isUserCacheKey('weavly-language')).toBe(false)
        expect(isUserCacheKey('weavly-estimator-width-unit')).toBe(false)

        expect(cleanup).toContain('clearOfflineMutationQueue')
        expect(cleanup).toContain('db.mutations.clear()')
        expect(cleanup).toContain('window.sessionStorage.clear()')
        expect(logoutButton).toContain('clearClientSessionState')
        expect(loginForm).toContain('await clearClientSessionState()')
        expect(pwaSessionGuard).toContain('await clearClientSessionState()')
    })

    it('awaits logout client cleanup before allowing the server logout submit to proceed', () => {
        const logoutButton = readProjectFile('components/auth/logout-button.tsx')
        const preventDefaultIndex = logoutButton.indexOf('event.preventDefault()')
        const awaitedCleanupIndex = logoutButton.indexOf('await clearClientSessionState()')
        const guardFlipIndex = logoutButton.indexOf('readyForServerLogoutRef.current = true')
        const resubmitIndex = logoutButton.indexOf('formRef.current?.requestSubmit()')

        expect(logoutButton).toContain('const formRef = useRef<HTMLFormElement>(null)')
        expect(logoutButton).toContain('const readyForServerLogoutRef = useRef(false)')
        expect(logoutButton).toContain('if (readyForServerLogoutRef.current) return')
        expect(logoutButton).toContain('event.preventDefault()')
        expect(logoutButton).toContain('await clearClientSessionState()')
        expect(logoutButton).not.toContain('void clearClientSessionState()')
        expect(logoutButton).toContain('formRef.current?.requestSubmit()')
        expect(logoutButton.match(/<form ref=\{formRef\} action=\{signOut\} onSubmit=\{handleLogout\}>/g)).toHaveLength(2)
        expect(preventDefaultIndex).toBeGreaterThan(-1)
        expect(awaitedCleanupIndex).toBeGreaterThan(preventDefaultIndex)
        expect(guardFlipIndex).toBeGreaterThan(awaitedCleanupIndex)
        expect(resubmitIndex).toBeGreaterThan(guardFlipIndex)
    })

    it('removes persisted user cache keys while preserving harmless local preferences', () => {
        const storage = createMemoryStorage({
            [REACT_QUERY_PERSISTENCE_KEY]: 'query-cache',
            'production_meters_2026-06-30_day': '{"loom":120}',
            'weavly-estimator-draft-org-user': '{"draft":true}',
            'weavly-uid': 'user-a',
            'weavly_skip_fixed_staff': 'true',
            'weavly-language': 'hi',
            'weavly-estimator-width-unit': 'inch',
        })

        const removed = clearUserCacheFromStorage(storage)

        expect(removed.sort()).toEqual([
            REACT_QUERY_PERSISTENCE_KEY,
            'production_meters_2026-06-30_day',
            'weavly-estimator-draft-org-user',
            'weavly-uid',
            'weavly_skip_fixed_staff',
        ].sort())
        expect(storage.getItem(REACT_QUERY_PERSISTENCE_KEY)).toBeNull()
        expect(storage.getItem('production_meters_2026-06-30_day')).toBeNull()
        expect(storage.getItem('weavly-estimator-draft-org-user')).toBeNull()
        expect(storage.getItem('weavly-uid')).toBeNull()
        expect(storage.getItem('weavly_skip_fixed_staff')).toBeNull()
        expect(storage.getItem('weavly-language')).toBe('hi')
        expect(storage.getItem('weavly-estimator-width-unit')).toBe('inch')
    })


    it('does not replay unsupported offline mutations or claim successful sync', () => {
        const offlineSync = readProjectFile('hooks/use-offline-sync.ts')
        const offlineBanner = readProjectFile('components/offline-sync-provider.tsx')

        expect(offlineSync).toContain("await db.mutations.where('synced').equals(0).delete()")
        expect(offlineSync).toContain('unsupported offline change')
        expect(offlineSync).not.toContain('supabase.from(table)')
        expect(offlineSync).not.toContain('Offline changes synced!')
        expect(offlineBanner).toContain('new factory changes are online-only')
        expect(offlineBanner).not.toContain('changes will sync when reconnected')
    })

    it('makes kharchi online-only instead of queuing to the missing kharchi_offline table', () => {
        const kharchi = readProjectFile('components/supervisor/KharchiDialog.tsx')

        expect(kharchi).toContain('Kharchi is online-only')
        expect(kharchi).toContain('Reconnect before giving cash')
        expect(kharchi).toContain('!isOnline')
        expect(kharchi).not.toContain('queueMutation')
        expect(kharchi).not.toContain('kharchi_offline')
        expect(kharchi).not.toContain('Kharchi queued for sync')
    })

    it('keeps PWA updates draft-aware and avoids forced service-worker refreshes', () => {
        const nextConfig = readProjectFile('next.config.ts')
        const updateNotice = readProjectFile('components/pwa-update-notice.tsx')
        const providers = readProjectFile('components/providers.tsx')

        expect(nextConfig).toContain('skipWaiting: false')
        expect(nextConfig).toContain('clientsClaim: false')
        expect(updateNotice).toContain('Save any drafts, then refresh')
        expect(updateNotice).toContain('navigator.serviceWorker.ready')
        expect(updateNotice).toContain('registration.update()')
        expect(updateNotice).toContain('controllerchange')
        expect(updateNotice).toContain("waitingWorker.postMessage({ type: 'SKIP_WAITING' })")
        expect(updateNotice).toContain("addEventListener('controllerchange', reloadWithNewController, { once: true })")
        expect(providers).toContain('<PwaUpdateNotice />')
    })

    it('aligns public and privacy copy with the online-only write model while leaving OFF-009 untouched', () => {
        const privacy = readProjectFile('app/privacy/page.tsx')
        const faq = readProjectFile('components/landing/faq.tsx')
        const matrix = readProjectFile('output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md')

        expect(privacy).toContain('Offline production, kharchi, payroll, sale, dispatch, and payment writes are not presented as reliable offline-sync features')
        expect(privacy).toContain('Logging out clears user-specific cached data and the local offline mutation queue')
        expect(privacy).not.toContain('automatically synced to our servers upon reconnection')
        expect(privacy).not.toContain('offline production entries')
        expect(faq).toContain('Saving production, kharchi, payroll, sale, dispatch, and payment entries requires an internet connection.')
        expect(faq).not.toContain('offline queueing is supported for expenses')
        expect(matrix).toContain('| OFF-009 |')
        expect(matrix).toContain('Mutation request timeout.')
    })
})
