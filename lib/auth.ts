import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * requireRole — shared auth utility (ARCH-001)
 *
 * Call at the top of any Server Action or Server Component that requires
 * role-level authorization. This ensures that authorization is enforced
 * at the function level, independent of layout-level redirects.
 *
 * @param allowedRoles - array of roles permitted to call this action
 * @returns { user, profile } on success
 * @throws redirect to /login if user is not authenticated or unauthorized
 */
export async function requireRole(allowedRoles: string[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, org_id, full_name')
        .eq('id', user.id)
        .single()

    if (error || !profile) {
        redirect('/login')
    }

    if (!allowedRoles.includes(profile.role ?? '')) {
        // Redirect to their natural home rather than /login for better UX
        redirect(profile.role === 'supervisor' ? '/supervisor/production' : '/login')
    }

    return { user, profile }
}

/**
 * getAuthenticatedUser — lightweight check for any authenticated user.
 * Use when you just need org_id + user.id without a role restriction.
 */
export async function getAuthenticatedUser() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, org_id, full_name')
        .eq('id', user.id)
        .single()

    if (error || !profile) redirect('/login')

    return { user, profile, supabase }
}
