/**
 * Batch 1 — Auth Waterfall Elimination
 *
 * These tests verify that:
 * 1. auth.ts still anchors server authorization to the profiles DB row
 *    (required by p0-authz-boundary.test.ts — preserved after refactor).
 * 2. getCachedSession() is exported and uses React.cache() for deduplication.
 * 3. getCachedOrgTier() is exported from subscription.ts.
 * 4. AccessGate no longer independently calls getUser + profiles.
 * 5. The middleware file exists with the correct safe structure.
 * 6. Call count analysis: documents before/after for the dispatches route.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')

// ─── auth.ts ─────────────────────────────────────────────────────────────────

describe('Batch 1 — auth.ts cached session helper', () => {
    const authLib = read('lib/auth.ts')

    it('exports getCachedSession using React.cache()', () => {
        expect(authLib).toContain('export const getCachedSession = cache(')
        // Must import cache from react
        expect(authLib).toMatch(/import\s+\{[^}]*\bcache\b[^}]*\}\s+from\s+['"]react['"]/)
    })

    it('still anchors authorization to the profiles DB row (not user metadata)', () => {
        // p0-authz-boundary.test.ts requires these exact strings to be present
        expect(authLib).toContain(".from('profiles')")
        expect(authLib).toContain(".select('role, org_id, full_name, access_revoked_at')")
        expect(authLib).toContain('if (dbProfile?.access_revoked_at) return null')
        expect(authLib).toContain('const admin = createAdminClient()')
        expect(authLib).not.toContain('user.user_metadata?.role')
    })

    it('requireRole() delegates to getCachedSession() instead of calling getUser() directly', () => {
        // requireRole should call getCachedSession, not create its own supabase client
        expect(authLib).toContain('const session = await getCachedSession()')
        // It should NOT have a raw getUser() call directly inside requireRole body
        // (the raw call should only be inside getCachedSession)
        const requireRoleBody = authLib.slice(
            authLib.indexOf('export async function requireRole'),
            authLib.indexOf('export const ORG_LOCKED_WRITE_MESSAGE')
        )
        expect(requireRoleBody).not.toContain('supabase.auth.getUser()')
        expect(requireRoleBody).not.toContain("from('profiles')")
    })

    it('getAuthenticatedUser() delegates to getCachedSession() instead of calling getUser() directly', () => {
        const funcBody = authLib.slice(
            authLib.indexOf('export async function getAuthenticatedUser'),
        )
        expect(funcBody).toContain('getCachedSession()')
        expect(funcBody).not.toContain('supabase.auth.getUser()')
    })

    it('has server-only import at the top', () => {
        expect(authLib).toContain("import 'server-only'")
    })
})

// ─── subscription.ts ─────────────────────────────────────────────────────────

describe('Batch 1 — subscription.ts cached tier helper', () => {
    const subLib = read('lib/subscription.ts')

    it('exports getCachedOrgTier using React.cache()', () => {
        expect(subLib).toContain('export const getCachedOrgTier = cache(')
        expect(subLib).toMatch(/import\s+\{[^}]*\bcache\b[^}]*\}\s+from\s+['"]react['"]/)
    })

    it('getOrgTier() still exists for standalone calls', () => {
        expect(subLib).toContain('export async function getOrgTier(')
    })
})

// ─── AccessGate.tsx ───────────────────────────────────────────────────────────

describe('Batch 1 — AccessGate uses cached helpers', () => {
    const gate = read('components/billing/AccessGate.tsx')

    it('imports getCachedSession from auth, not createClient from supabase/server', () => {
        expect(gate).toContain("getCachedSession")
        // Should no longer independently call supabase.auth.getUser()
        expect(gate).not.toContain('supabase.auth.getUser()')
    })

    it('imports getCachedOrgTier instead of getOrgTier', () => {
        expect(gate).toContain('getCachedOrgTier')
        // Should not import the uncached getOrgTier
        expect(gate).not.toMatch(/import[^;]*\bgetOrgTier\b[^;]*from/)
    })

    it('does not independently query profiles table', () => {
        // The old AccessGate queried profiles directly — should not anymore
        expect(gate).not.toContain(".from('profiles')")
    })
})

// ─── proxy.ts (Active Middleware) ─────────────────────────────────────────────

describe('Batch 1 — proxy.ts (Active Middleware) safety', () => {
    const mw = read('proxy.ts')

    it('exists and refreshes session cookies', () => {
        expect(mw).toContain('supabase.auth.getUser()')
        expect(mw).toContain('createServerClient')
    })

    it('does NOT import requireRole', () => {
        const lines = mw.split('\n')
        const importLines = lines.filter(l => l.trimStart().startsWith('import'))
        expect(importLines.join('\n')).not.toContain('requireRole')
    })

    it('redirects unauthenticated users to /login for protected routes', () => {
        expect(mw).toContain("'/login'")
        expect(mw).toContain('/owner')
        expect(mw).toContain('/supervisor')
    })

    it('exports config with matcher', () => {
        expect(mw).toContain('export const config')
        expect(mw).toContain('matcher')
    })
})

// ─── owner/layout.tsx ─────────────────────────────────────────────────────────

describe('Batch 1 — owner layout uses requireRole (backed by cache)', () => {
    const layout = read('app/(dashboard)/owner/layout.tsx')

    it('calls requireRole (which uses getCachedSession internally)', () => {
        expect(layout).toContain("requireRole(['owner'])")
    })

    it('no longer has redundant supabase.auth.getUser() call', () => {
        expect(layout).not.toContain('supabase.auth.getUser()')
    })
})

// ─── Call count documentation ─────────────────────────────────────────────────

describe('Batch 1 — call count analysis for /owner/dispatches', () => {
    it('documents the before/after Supabase call reduction', () => {
        /**
         * BEFORE (per navigation to /owner/dispatches):
         *   1. OwnerLayout:  requireRole → getUser()              [Supabase Auth call 1]
         *   2. OwnerLayout:  requireRole → admin.profiles query   [DB call 1]
         *   3. OwnerLayout:  organizations query                  [DB call 2]
         *   4. AccessGate:   supabase.auth.getUser()              [Supabase Auth call 2 — DUPLICATE]
         *   5. AccessGate:   supabase.from('profiles')            [DB call 3 — DUPLICATE]
         *   6. AccessGate:   org_subscriptions query              [DB call 4]
         *   7. dispatches/page.tsx → actions call requireRole:
         *      - getUser()                                        [Supabase Auth call 3 — TRIPLICATE]
         *      - admin.profiles query                             [DB call 5 — TRIPLICATE]
         *   = 3× auth.getUser() + 3× profiles + 1× orgs + 1× subscriptions = 8 round-trips
         *
         * AFTER (with React.cache() deduplication):
         *   1. getCachedSession() (first call, from OwnerLayout via requireRole):
         *      - getUser()                                        [Supabase Auth call 1 — ONLY ONCE]
         *      - admin.profiles query                             [DB call 1 — ONLY ONCE]
         *   2. OwnerLayout:  organizations query                  [DB call 2]
         *   3. getCachedOrgTier() (first call, from AccessGate):
         *      - org_subscriptions query                          [DB call 3 — ONLY ONCE]
         *   4. AccessGate:   getCachedSession() → cache hit       [0 extra calls]
         *   5. dispatches page → requireRole → getCachedSession() → cache hit [0 extra calls]
         *   = 1× auth.getUser() + 1× profiles + 1× orgs + 1× subscriptions = 4 round-trips
         *
         * Net reduction: 8 → 4 Supabase round-trips per navigation (-50%)
         * Estimated latency saved: 4 × ~80ms = ~320ms per navigation
         */
        expect(true).toBe(true) // Documentation test — always passes
    })
})
