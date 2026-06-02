import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

/**
 * requireRole — shared auth utility (ARCH-001 / F1 Auth Hardening)
 *
 * Enforces role-level authorization by validating the Supabase-authenticated
 * user against the server-side profile row before any org-scoped data access.
 *
 * @param allowedRoles - array of roles permitted to call this action
 * @returns { user, profile: { role, org_id } } on success
 * @throws redirect to /login if user is not authenticated or unauthorized
 */
export async function requireRole(allowedRoles: string[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Always validate authorization-critical claims against the profile row.
    // JWT app_metadata is useful for routing, but server actions/data loaders must
    // not trust user_metadata or stale client-controlled claims for org scoping.
    const admin = createAdminClient()
    const { data: dbProfile } = await admin
        .from('profiles')
        .select('role, org_id, full_name')
        .eq('id', user.id)
        .maybeSingle()

    const role = dbProfile?.role ?? undefined
    const org_id = dbProfile?.org_id ?? undefined
    const full_name = dbProfile?.full_name ?? undefined

    // If still missing after DB check, the account is genuinely broken
    if (!role || !org_id) {
        redirect('/login')
    }

    if (!allowedRoles.includes(role)) {
        redirect(getRoleHomePath(role))
    }

    return {
        user,
        profile: { role, org_id, full_name }
    }
}

/**
 * getAuthenticatedUser — lightweight check for any authenticated user.
 * Use when you need org_id + user.id without a role restriction.
 */
export async function getAuthenticatedUser() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const admin = createAdminClient()
    const { data: dbProfile } = await admin
        .from('profiles')
        .select('role, org_id')
        .eq('id', user.id)
        .maybeSingle()

    const role = dbProfile?.role ?? undefined
    const org_id = dbProfile?.org_id ?? undefined

    if (!role || !org_id) redirect('/login')

    return {
        user,
        profile: { role, org_id },
        supabase
    }
}
