import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
 * rather than querying the database.
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

    const jwt = parseJWT(session.access_token)
    const role = jwt.user_role
    const org_id = jwt.org_id

    if (!role || !org_id) {
        redirect('/login')
    }

    if (!allowedRoles.includes(role)) {
        // Redirect to their natural home rather than /login for better UX
        redirect(role === 'supervisor' ? '/supervisor/production' : '/login')
    }

    return {
        user: session.user,
        profile: { role, org_id }
    }
}

/**
 * getAuthenticatedUser — lightweight check for any authenticated user.
 * Uses JWT claims to avoid database queries.
 * Use when you just need org_id + user.id without a role restriction.
 */
export async function getAuthenticatedUser() {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) redirect('/login')

    const jwt = parseJWT(session.access_token)
    const role = jwt.user_role
    const org_id = jwt.org_id

    if (!role || !org_id) redirect('/login')

    return {
        user: session.user,
        profile: { role, org_id },
        supabase
    }
}
