import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUserRevoked } from '@/lib/rate-limit'
import type { User } from '@supabase/supabase-js'

type JsonRecord = Record<string, unknown>
type AuthClaims = {
    role?: string
    user_role?: string
    org_id?: string
    full_name?: string
    onboarding_complete?: boolean
}

export function getRoleHomePath(role?: string) {
    if (role === 'owner') return '/owner/today'
    if (role === 'supervisor') return '/supervisor/dashboard'
    if (role === 'admin') return '/admin'
    return '/login'
}

/**
 * Decodes a JWT without verification (safe — we only use it for claims
 * that Supabase Auth already validated server-side).
 * Uses `atob` instead of Buffer for cross-environment safety.
 */
function asRecord(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as JsonRecord
        : {}
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined
}

function asBoolean(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined
}

export function parseJWT(token: string): AuthClaims & JsonRecord {
    try {
        let payload = token.split('.')[1]
        payload = payload.replace(/-/g, '+').replace(/_/g, '/')
        const parsed = asRecord(JSON.parse(atob(payload)))
        
        const appMetadata = asRecord(parsed.app_metadata)
        const customClaims = Object.keys(asRecord(appMetadata.custom_claims)).length > 0
            ? asRecord(appMetadata.custom_claims)
            : parsed
        
        return {
            ...parsed,
            ...customClaims,
            user_role: asString(customClaims.user_role),
            org_id: asString(customClaims.org_id),
            onboarding_complete: asBoolean(customClaims.onboarding_complete) ?? false
        }
    } catch {
        return {}
    }
}

export function getUserClaims(user: User): AuthClaims {
    const appMetadata = asRecord(user.app_metadata)
    const userMetadata = asRecord(user.user_metadata)
    const customClaims = asRecord(appMetadata.custom_claims)
    const role = asString(appMetadata.role) ?? asString(customClaims.user_role)

    return {
        role,
        user_role: role,
        org_id: asString(appMetadata.org_id) ?? asString(customClaims.org_id),
        full_name: asString(appMetadata.full_name) ?? asString(customClaims.full_name) ?? asString(userMetadata.full_name),
        onboarding_complete: asBoolean(appMetadata.onboarding_complete) ?? asBoolean(customClaims.onboarding_complete) ?? false
    }
}

// ─── Request-scoped cached auth helpers ────────────────────────────────────────
//
// React.cache() creates a per-request memoization store during server rendering.
// The first call within a request executes the async function and stores the
// result. Every subsequent call within the same request returns the memoized
// result without any additional Supabase round-trips.
//
// This eliminates the duplicated getUser() + profiles queries that previously
// happened independently in: OwnerLayout → AccessGate → page server actions.
//
// SECURITY: React.cache() is scoped to a single server request (one render
// tree). There is no cross-user or cross-request data leakage.

/**
 * getCachedSession — request-scoped, deduplicated auth + profile lookup.
 *
 * Combines supabase.auth.getUser() and the admin profiles row into a single
 * cached result. Within one server request, no matter how many layouts,
 * components, or server actions call this, Supabase is contacted only once.
 *
 * Returns null if the user is unauthenticated or their profile row is missing.
 * Callers that require authentication MUST handle the null case.
 */
export const getCachedSession = cache(async (): Promise<{
    user: User
    profile: { role: string; org_id: string; full_name: string | undefined }
} | null> => {
    if (process.env.NODE_ENV === 'development') {
        // This log fires at most once per request — confirms deduplication is working.
        console.log('[auth] getCachedSession: executing DB lookup (first call this request)')
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    // Explicit revocation must invalidate every still-live browser/device JWT.
    // Supabase access tokens remain valid until expiry, so the server-owned
    // revocation marker is checked before loading any authorization state.
    if (await isUserRevoked(user.id)) return null

    // Always validate authorization-critical claims against the profile row.
    // JWT app_metadata is useful for routing, but server actions/data loaders must
    // not trust user_metadata or stale client-controlled claims for org scoping.
    const admin = createAdminClient()
    const { data: dbProfile } = await admin
        .from('profiles')
        .select('role, org_id, full_name, access_revoked_at')
        .eq('id', user.id)
        .maybeSingle()

    if (dbProfile?.access_revoked_at) return null

    const role = dbProfile?.role ?? undefined
    const org_id = dbProfile?.org_id ?? undefined
    const full_name = dbProfile?.full_name ?? undefined

    // Account exists in auth but profile is missing/broken — treat as unauthenticated
    if (!role || !org_id) return null

    return { user, profile: { role, org_id, full_name } }
})

/**
 * requireRole — shared auth utility (ARCH-001 / F1 Auth Hardening)
 *
 * Enforces role-level authorization by validating the Supabase-authenticated
 * user against the server-side profile row before any org-scoped data access.
 *
 * Uses getCachedSession() for request-level deduplication: if the layout,
 * AccessGate, and page action all call requireRole(), Supabase is only
 * contacted once per request (subsequent calls are cache hits).
 *
 * @param allowedRoles - array of roles permitted to call this action
 * @returns { user, profile: { role, org_id, full_name } } on success
 * @throws redirect to /login if user is not authenticated or unauthorized
 */
export async function requireRole(allowedRoles: string[]) {
    const session = await getCachedSession()

    if (!session) {
        redirect('/login')
    }

    const { user, profile } = session
    const { role, org_id, full_name } = profile

    if (!allowedRoles.includes(role)) {
        redirect(getRoleHomePath(role))
    }

    return {
        user,
        profile: { role, org_id, full_name }
    }
}

export const ORG_LOCKED_WRITE_MESSAGE = 'Organization is locked. Business writes are disabled until compliance unlock.'

export async function assertOrgWritable(orgId: string) {
    const admin = createAdminClient()
    const { data, error } = await admin
        .from('organizations')
        .select('is_locked_down')
        .eq('id', orgId)
        .maybeSingle()

    if (error) {
        throw new Error('Unable to verify organization lock state.')
    }

    if (data?.is_locked_down) {
        throw new Error(ORG_LOCKED_WRITE_MESSAGE)
    }
}

export async function requireWritableOrg(allowedRoles: string[]) {
    const result = await requireRole(allowedRoles)
    await assertOrgWritable(result.profile.org_id)
    return result
}

/**
 * getAuthenticatedUser — lightweight check for any authenticated user.
 * Use when you need org_id + user.id without a role restriction.
 *
 * Reuses getCachedSession() for request-level deduplication.
 */
export async function getAuthenticatedUser() {
    const session = await getCachedSession()

    if (!session) redirect('/login')

    const { user, profile } = session
    const { role, org_id } = profile

    // Return a supabase client scoped to this user's session for RLS queries
    const supabase = await createClient()

    return {
        user,
        profile: { role, org_id },
        supabase
    }
}
