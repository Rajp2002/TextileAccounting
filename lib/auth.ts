import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
export function parseJWT(token: string): Record<string, any> {
    try {
        let payload = token.split('.')[1]
        payload = payload.replace(/-/g, '+').replace(/_/g, '/')
        const parsed = JSON.parse(atob(payload))
        
        const customClaims = parsed.app_metadata?.custom_claims || parsed
        
        return {
            ...parsed,
            ...customClaims,
            user_role: customClaims.user_role ?? parsed.user_metadata?.role,
            org_id: customClaims.org_id ?? parsed.user_metadata?.org_id,
            onboarding_complete: customClaims.onboarding_complete ?? false
        }
    } catch {
        return {}
    }
}

/**
 * requireRole — shared auth utility (ARCH-001 / F1 Auth Hardening)
 *
 * Enforces role-level authorization using JWT claims (O(1) fast path)
 * with a DB fallback for the stale-JWT window that occurs immediately
 * after new account creation (custom_access_token_hook race condition).
 *
 * @param allowedRoles - array of roles permitted to call this action
 * @returns { user, profile: { role, org_id } } on success
 * @throws redirect to /login if user is not authenticated or unauthorized
 */
export async function requireRole(allowedRoles: string[]) {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        redirect('/login')
    }

    // Fast path: JWT already has claims
    let role: string | undefined = session.user.app_metadata?.role
    let org_id: string | undefined = session.user.app_metadata?.org_id
    let full_name: string | undefined = session.user.app_metadata?.full_name

    // Slow path: JWT is stale (race condition on new signup).
    // The custom_access_token_hook fired before the profile row was committed.
    // Fall back to a direct DB lookup via admin client (bypasses RLS).
    if (!role || !org_id) {
        const admin = createAdminClient()
        const { data: profile } = await admin
            .from('profiles')
            .select('role, org_id, full_name')
            .eq('id', session.user.id)
            .maybeSingle()
        role = profile?.role ?? undefined
        org_id = profile?.org_id ?? undefined
        full_name = profile?.full_name ?? undefined
    }

    // If still missing after DB check, the account is genuinely broken
    if (!role || !org_id) {
        redirect('/login')
    }

    if (!allowedRoles.includes(role)) {
        redirect(getRoleHomePath(role))
    }

    return {
        user: session.user,
        profile: { role, org_id, full_name }
    }
}

/**
 * getAuthenticatedUser — lightweight check for any authenticated user.
 * Uses JWT claims to avoid database queries, with DB fallback for stale JWTs.
 * Use when you just need org_id + user.id without a role restriction.
 */
export async function getAuthenticatedUser() {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) redirect('/login')

    let role: string | undefined = session.user.app_metadata?.role
    let org_id: string | undefined = session.user.app_metadata?.org_id

    if (!role || !org_id) {
        const admin = createAdminClient()
        const { data: profile } = await admin
            .from('profiles')
            .select('role, org_id')
            .eq('id', session.user.id)
            .maybeSingle()
        role = profile?.role ?? undefined
        org_id = profile?.org_id ?? undefined
    }

    if (!role || !org_id) redirect('/login')

    return {
        user: session.user,
        profile: { role, org_id },
        supabase
    }
}
