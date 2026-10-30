import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    createPrincipalCacheScope,
    getQueryPersistenceKey,
    isPrincipalCacheScope,
} from '../lib/auth-cache-scope'
import {
    clearUserCacheFromStorage,
    REACT_QUERY_PERSISTENCE_KEY,
} from '../lib/client-storage-cleanup'
import {
    isRecentPwaLoginRedirect,
    PWA_LOGIN_RECOVERY_WINDOW_MS,
} from '../lib/pwa-auth-recovery'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

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

describe('Sprint 22 auth boundary', () => {
    it('creates stable opaque scopes from verified principals', () => {
        const accountA = createPrincipalCacheScope({ userId: 'user-a', organizationId: 'org-a' })
        const accountB = createPrincipalCacheScope({ userId: 'user-b', organizationId: 'org-b' })
        const accountAAgain = createPrincipalCacheScope({ userId: 'user-a', organizationId: 'org-a' })
        const onboarding = createPrincipalCacheScope({ userId: 'user-a', organizationId: null })

        expect(accountA).toBe(accountAAgain)
        expect(accountA).not.toBe(accountB)
        expect(accountA).not.toContain('user-a')
        expect(accountA).not.toContain('org-a')
        expect(onboarding).not.toBe(accountA)
        expect(isPrincipalCacheScope(accountA)).toBe(true)
        expect(isPrincipalCacheScope(undefined)).toBe(false)
    })

    it('deletes only the retired principal cache and legacy data', () => {
        const accountA = createPrincipalCacheScope({ userId: 'user-a', organizationId: 'org-a' })!
        const accountB = createPrincipalCacheScope({ userId: 'user-b', organizationId: 'org-b' })!
        const storage = createMemoryStorage({
            [getQueryPersistenceKey(accountA)]: 'account-a',
            [getQueryPersistenceKey(accountB)]: 'account-b',
            [REACT_QUERY_PERSISTENCE_KEY]: 'legacy',
            'weavly-language': 'hi',
        })

        const removed = clearUserCacheFromStorage(storage, {
            scope: accountA,
            includeLegacy: true,
        })

        expect(removed).toContain(getQueryPersistenceKey(accountA))
        expect(removed).toContain(REACT_QUERY_PERSISTENCE_KEY)
        expect(storage.getItem(getQueryPersistenceKey(accountA))).toBeNull()
        expect(storage.getItem(REACT_QUERY_PERSISTENCE_KEY)).toBeNull()
        expect(storage.getItem(getQueryPersistenceKey(accountB))).toBe('account-b')
        expect(storage.getItem('weavly-language')).toBe('hi')
    })

    it('keeps unknown identity memory-only and scopes every queue operation', () => {
        const provider = read('components/query-provider.tsx')
        const database = read('lib/db.ts')
        const cleanup = read('lib/client-storage-cleanup.ts')
        const settingsLayout = read('app/(dashboard)/owner/settings/layout.tsx')

        expect(provider).toContain('MemoryQueryProvider')
        expect(provider).toContain('isPrincipalCacheScope(scope)')
        expect(provider).toContain('getQueryPersistenceKey(scope)')
        expect(database).toContain('scope: string')
        expect(database).toContain('toCollection()')
        expect(database).toContain('LEGACY_MUTATION_SCOPE')
        // Phase 3D: offline writes are retired, so the database exposes no
        // queue or replay helpers; only scoped cleanup touches it.
        for (const helper of ['queueMutation', 'getPendingMutations', 'discardPendingMutations', 'deleteMutationsForScope']) {
            expect(database).not.toContain(`function ${helper}`)
        }
        expect(cleanup).toContain('.filter((mutation) => mutation.scope === scope)')
        expect(cleanup).toContain('.filter((mutation) => mutation.scope === LEGACY_MUTATION_SCOPE)')
        expect(settingsLayout).toContain('createPrincipalCacheScope')
        expect(settingsLayout).toContain('<QueryProvider scope={cacheScope}>')
    })

    it('makes service-worker protected responses network-only and purges legacy caches', () => {
        const nextConfig = read('next.config.ts')
        const worker = read('worker/index.ts')
        const offline = read('app/offline/page.tsx')

        expect(nextConfig).toContain('runtimeCaching: authBoundaryRuntimeCaching')
        expect(nextConfig).toContain("handler: 'NetworkOnly'")
        expect(nextConfig).not.toContain("handler: 'NetworkFirst'")
        expect(nextConfig).toContain('cacheStartUrl: false')
        expect(nextConfig).toContain('dynamicStartUrl: false')
        expect(nextConfig).toContain("document: '/_offline'")
        // Preloading only starts the same network request while the worker boots.
        expect(nextConfig).toContain('navigationPreload: true')
        expect(nextConfig).toContain("private, no-store, max-age=0, must-revalidate")
        expect(worker).toContain("'pages-rsc'")
        expect(worker).toContain("'pages-rsc-prefetch'")
        expect(worker).toContain("caches.delete(cacheName)")
        expect(offline).toContain('<OfflineRecovery />')
        expect(read('lib/i18n/locales/en.ts')).toContain('protected account pages are not available offline')
    })

    it('never signs out a valid session from a standalone PWA storage heuristic', () => {
        const providers = read('components/providers.tsx')
        const login = read('app/(auth)/login/login-form.tsx')

        expect(providers).not.toContain('PwaSessionGuard')
        expect(login).toContain('window.location.replace(result.redirectTo)')
    })

    it('breaks a stale PWA login redirect loop and upgrades at the auth boundary', () => {
        const proxy = read('proxy.ts')
        const loginPage = read('app/(auth)/login/page.tsx')
        const loginForm = read('app/(auth)/login/login-form.tsx')
        const updateNotice = read('components/pwa-update-notice.tsx')
        const now = 1_000_000

        expect(isRecentPwaLoginRedirect(String(now), now)).toBe(true)
        expect(isRecentPwaLoginRedirect(String(now - PWA_LOGIN_RECOVERY_WINDOW_MS), now)).toBe(true)
        expect(isRecentPwaLoginRedirect(String(now - PWA_LOGIN_RECOVERY_WINDOW_MS - 1), now)).toBe(false)
        expect(isRecentPwaLoginRedirect(String(now + 1), now)).toBe(false)
        expect(isRecentPwaLoginRedirect('not-a-timestamp', now)).toBe(false)

        expect(proxy).toContain('isRecentPwaLoginRedirect(previousRedirect, now)')
        expect(proxy).toContain('forwardedHeaders.delete(PWA_LOGIN_RECOVERY_HEADER)')
        expect(proxy).toContain('forwardedHeaders.set(PWA_LOGIN_RECOVERY_HEADER, roleDestination)')
        expect(loginPage).toContain('requestHeaders.get(PWA_LOGIN_RECOVERY_HEADER)')
        expect(loginForm).toContain('Your session is already active.')
        expect(loginForm).toContain('href={recoveryDestination}')
        expect(loginForm).not.toContain('activateWaitingPwaWorker()')
        expect(loginForm).not.toContain('window.location.replace(recoveryDestination)')
        expect(updateNotice).toContain("window.location.pathname === '/login'")
        expect(updateNotice).not.toContain('isLoginRefreshBoundary')
        expect(updateNotice).not.toContain("querySelectorAll('input, textarea, select')")
    })

    it('never routes a verified owner back to login when the tenant read is unavailable', () => {
        const ownerLayout = read('app/(dashboard)/owner/layout.tsx')
        const ownerOrganization = read('lib/owner-organization.ts')
        const subscription = read('lib/subscription.ts')

        expect(ownerLayout).not.toContain("redirect('/login?reason=session_incomplete')")
        expect(ownerLayout).toContain("throw new Error('Verified owner organization is unavailable.')")
        expect(ownerLayout).toContain('getCachedOwnerOrganization(user.id, profile.org_id)')
        expect(ownerOrganization).toContain('createAdminClient()')
        expect(ownerOrganization).toContain(".eq('id', organizationId)")
        expect(ownerOrganization).toContain(".eq('owner_id', ownerId)")
        expect(subscription).toContain('const admin = createAdminClient()')
        expect(subscription).toContain('Unable to resolve organization plan access')
    })

    it('starts native sign-out after synchronous detachment and records transition phases', () => {
        const logout = read('components/auth/logout-button.tsx')
        const trace = read('lib/logout-trace.ts')
        const reporter = read('components/telemetry/logout-timing-reporter.tsx')
        const endpoint = read('app/api/telemetry/logout/route.ts')
        const route = read('app/auth/signout/route.ts')

        expect(logout).toContain('setIsLoggingOut(true)')
        expect(logout).toContain('detachActiveQueryNamespace()')
        expect(logout).toContain('scheduleClientSessionCleanup({')
        expect(logout).toContain('formRef.current?.submit()')
        expect(logout).not.toContain('requestSubmit()')
        expect(logout).not.toContain('await clearClientSessionState()')
        for (const stage of [
            'logout_clicked',
            'cache_namespace_rotated',
            'signout_navigation_started',
            'login_painted',
            'login_primary_ready',
            'legacy_cleanup_completed',
        ]) {
            expect(trace).toContain(`'${stage}'`)
            expect(reporter + endpoint).toContain(stage)
        }
        expect(route).toContain("createSignInServerTimer('auth_logout', traceId)")
        expect(route).toContain('claims_validation')
        expect(route).toContain('supabase_signout')
    })
})
