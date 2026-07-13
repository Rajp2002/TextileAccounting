'use server'

/**
 * F1 Auth & Onboarding — Server Actions
 *
 * All operations use the service_role client (admin) to bypass RLS.
 * Profile/org creation can NEVER be done from the client — this prevents
 * users from forging their own org_id or role.
 *
 * JWT hook injects: org_id, user_role, onboarding_complete on every sign-in.
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { CreateOrgSchema, JoinOrgSchema, PasswordResetRequestSchema, SignInSchema, safeParse } from '@/lib/schemas'
import { hasExplicitProductionMode } from '@/lib/production-mode'
import { getOrgTier } from '@/lib/subscription'
import { checkJoinCodeRateLimit, getClientIpFromHeaders } from '@/lib/rate-limit'

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generates an 8-character uppercase alphanumeric join code.
 * Uses an unambiguous character set (no O/0/I/1 confusion).
 */
function generateJoinCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return Array.from({ length: 8 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
    ).join('')
}

async function getRequestOrigin(): Promise<string> {
    const requestHeaders = await headers()
    const forwardedHost = requestHeaders.get('x-forwarded-host')

    if (forwardedHost) {
        const forwardedProto = requestHeaders.get('x-forwarded-proto') ?? 'https'
        return `${forwardedProto}://${forwardedHost}`
    }

    const host = requestHeaders.get('host')
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
    if (host) return `${protocol}://${host}`

    return requestHeaders.get('origin') ?? ''
}

// ─── requestPasswordReset ─────────────────────────────────────────────────────

/**
 * Sends Supabase's built-in password reset email.
 * The return value is deliberately generic so account existence is never exposed.
 */
export async function requestPasswordReset(input: { email: string }) {
    const parsed = safeParse(PasswordResetRequestSchema, input)
    if ('error' in parsed) return { error: parsed.error }

    const supabase = await createClient()
    const origin = await getRequestOrigin()
    const redirectTo = `${origin}/auth/callback?next=/reset-password`

    await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo })

    return { success: true }
}

// ─── createOrganization ────────────────────────────────────────────────────────

/**
 * Owner signup: atomically creates auth user → organization → profile.
 * Uses service_role throughout. Rolls back on any step failure.
 *
 * On success: signs the owner in and redirects to /onboarding.
 */
export async function createOrganization(input: {
    ownerName: string
    email: string
    password: string
    factoryName: string
    phone: string
    referralCode?: string
}) {
    const parsed = safeParse(CreateOrgSchema, input)
    if ('error' in parsed) return { error: parsed.error }

    const adminClient = createAdminClient()

    // ── Step 1: Create Supabase auth user ────────────────────────────────────
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: parsed.data.email,
        password: parsed.data.password,
        email_confirm: true, // Skip email verification — owner is ready to use immediately
    })

    if (authError) {
        // Supabase returns a specific code for duplicate email
        if (authError.message?.toLowerCase().includes('already registered') ||
            authError.message?.toLowerCase().includes('already been registered') ||
            authError.code === 'email_address_invalid' ||
            authError.status === 422) {
            return { error: 'An account with this email already exists. Log in instead.' }
        }
        return { error: 'Unable to create account. Please try again.' }
    }

    const userId = authData.user.id

    // ── Step 2: Generate join code + create organization ─────────────────────
    let joinCode = generateJoinCode()

    const { data: org, error: orgError } = await adminClient
        .from('organizations')
        .insert({
            name: parsed.data.factoryName,
            join_code: joinCode,
            join_code_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            owner_id: userId,
            onboarding_complete: false,
        })
        .select('id')
        .single()

    if (orgError) {
        // Handle the rare join_code collision — retry once
        if (orgError.code === '23505' && orgError.message?.includes('join_code')) {
            joinCode = generateJoinCode()
            const { data: org2, error: orgError2 } = await adminClient
                .from('organizations')
                .insert({
                    name: parsed.data.factoryName,
                    join_code: joinCode,
                    join_code_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    owner_id: userId,
                    onboarding_complete: false,
                })
                .select('id')
                .single()

            if (orgError2) {
                await adminClient.auth.admin.deleteUser(userId)
                return { error: 'Failed to create organization. Please try again.' }
            }

            // Continue with org2
            return await _createOwnerProfile(adminClient, userId, org2!.id, parsed.data.ownerName, parsed.data.email, parsed.data.password, parsed.data.phone)
        }

        await adminClient.auth.admin.deleteUser(userId)
        return { error: 'Failed to create organization. Please try again.' }
    }

    const result = await _createOwnerProfile(adminClient, userId, org.id, parsed.data.ownerName, parsed.data.email, parsed.data.password, parsed.data.phone)
    
    if (result.success && parsed.data.referralCode) {
        try {
            const { applyReferralCode } = await import('@/lib/referral')
            await applyReferralCode(parsed.data.referralCode, org.id)
        } catch (e) {
            console.error('Failed to apply referral code during signup:', e)
            // we don't block signup if referral fails
        }
    }
    
    return result
}

async function _createOwnerProfile(
    adminClient: ReturnType<typeof createAdminClient>,
    userId: string,
    orgId: string,
    ownerName: string,
    email: string,
    password: string,
    phone: string
) {
    // ── Step 3: Create owner profile ─────────────────────────────────────────
    const { error: profileError } = await adminClient
        .from('profiles')
        .insert({
            id: userId,
            org_id: orgId,
            role: 'owner',
            full_name: ownerName,
            email: email,
            phone: phone,
        })

    if (profileError) {
        // Rollback: delete org + auth user
        await adminClient.from('organizations').delete().eq('id', orgId)
        await adminClient.auth.admin.deleteUser(userId)
        return { error: 'Failed to create profile. Please try again.' }
    }

    // ── Step 4: Sign the owner in so they get a cookie session ───────────────
    const supabase = await createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
        return { error: 'Account created but sign-in failed. Please log in.' }
    }

    // ── Step 5: Wait for JWT hook to inject org_id/role ──────────────────────
    // The custom_access_token_hook fires during sign-in, but the profile row
    // may not be visible to the hook yet on first invocation (PG lag).
    // Strategy: wait 500ms flat (covers 99% of DB commit lag), then retry
    // once more at 1s. Total max wait: 1.5s. Well within Vercel limits.
    await new Promise(resolve => setTimeout(resolve, 500))
    {
        const { data: { session: s1 } } = await supabase.auth.refreshSession()
        const hasClaims = !!s1?.user.app_metadata?.role || !!s1?.user.app_metadata?.org_id
        if (!hasClaims) {
            // One more try after 1s
            await new Promise(resolve => setTimeout(resolve, 1000))
            await supabase.auth.refreshSession()
        }
    }
    // Even if claims still absent, the onboarding page has a DB fallback.

    // Redirect happens outside this helper — caller must redirect
    return { success: true }
}

export async function createOrganizationAndRedirect(input: {
    ownerName: string
    email: string
    password: string
    factoryName: string
    phone: string
    referralCode?: string
}) {
    const result = await createOrganization(input)
    if (result && 'error' in result) return result
    // Plan selection comes before factory onboarding. Estimator-only owners do
    // not need machines, workers, payroll, or production-mode setup.
    redirect('/owner/billing')
}

// ─── validateJoinCode ──────────────────────────────────────────────────────────

/**
 * Called on blur of the join code input field on /join page.
 * Returns the factory name as confirmation (or an error).
 * Uses admin client to bypass RLS — the organizations table SELECT policy
 * requires a session, but this is called before the supervisor has one.
 */
export async function validateJoinCode(code: string): Promise<{
    valid: boolean
    orgName?: string
    error?: string
}> {
    const requestHeaders = await headers()
    const clientIp = getClientIpFromHeaders(requestHeaders)
    try {
        const reset = await checkJoinCodeRateLimit(clientIp, 'validate')
        if (reset) return { valid: false, error: 'Too many join-code attempts. Try again later.' }
    } catch {
        return { valid: false, error: 'Join-code protection is temporarily unavailable. Try again later.' }
    }

    const normalized = code.trim().toUpperCase()

    if (!/^[A-Z0-9]{8}$/.test(normalized)) {
        return { valid: false, error: 'Code must be exactly 8 characters' }
    }

    const adminClient = createAdminClient()
    const { data } = await adminClient
        .from('organizations')
        .select('id, name, join_code_expires_at')
        .eq('join_code', normalized)
        .maybeSingle()

    if (!data) return { valid: false, error: 'Invalid join code. Check with your factory owner.' }

    if (new Date(data.join_code_expires_at) < new Date()) {
        return {
            valid: false,
            error: 'This join code has expired. Ask the factory owner to regenerate it.',
        }
    }

    return { valid: true, orgName: data.name }
}

// ─── joinOrganization ──────────────────────────────────────────────────────────

/**
 * Supervisor join: validates code (server-side, never trust client),
 * creates auth user + profile atomically. Rolls back on failure.
 */
export async function joinOrganization(input: {
    joinCode: string
    supervisorName: string
    email: string
    password: string
    phone: string
}) {
    const requestHeaders = await headers()
    const clientIp = getClientIpFromHeaders(requestHeaders)
    try {
        const reset = await checkJoinCodeRateLimit(clientIp, 'join')
        if (reset) return { error: 'Too many join-code attempts. Try again later.' }
    } catch {
        return { error: 'Join-code protection is temporarily unavailable. Try again later.' }
    }

    const parsed = safeParse(JoinOrgSchema, input)
    if ('error' in parsed) return { error: parsed.error }

    const adminClient = createAdminClient()
    const normalized = parsed.data.joinCode.trim().toUpperCase()

    // ── Re-validate code server-side (never trust client-side check) ─────────
    const { data: org } = await adminClient
        .from('organizations')
        .select('id, name, join_code_expires_at')
        .eq('join_code', normalized)
        .maybeSingle()

    if (!org) return { error: 'Invalid join code. Check with your factory owner.' }

    if (new Date(org.join_code_expires_at) < new Date()) {
        return { error: 'Join code has expired. Ask the factory owner to regenerate it.' }
    }

    // ── Create auth user ──────────────────────────────────────────────────────
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: parsed.data.email,
        password: parsed.data.password,
        email_confirm: true,
    })

    if (authError) {
        if (authError.message?.toLowerCase().includes('already registered') || authError.status === 422) {
            return { error: 'An account with this email already exists. Log in instead.' }
        }
        return { error: 'Unable to create account. Please try again.' }
    }

    // ── Create supervisor profile ─────────────────────────────────────────────
    const { error: profileError } = await adminClient
        .from('profiles')
        .insert({
            id: authData.user.id,
            org_id: org.id,
            role: 'supervisor',
            full_name: parsed.data.supervisorName,
            email: parsed.data.email,
            phone: parsed.data.phone,
        })

    if (profileError) {
        await adminClient.auth.admin.deleteUser(authData.user.id)
        return { error: 'Failed to create profile. Please try again.' }
    }

    // ── Sign in ───────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
    })

    if (signInError) {
        return { error: 'Account created but sign-in failed. Please log in.' }
    }

    // ── Wait for JWT hook to inject org_id/role ───────────────────────────────
    await new Promise(resolve => setTimeout(resolve, 500))
    {
        const { data: { session: s1 } } = await supabase.auth.refreshSession()
        const hasClaims = !!s1?.user.app_metadata?.role || !!s1?.user.app_metadata?.org_id
        if (!hasClaims) {
            await new Promise(resolve => setTimeout(resolve, 1000))
            await supabase.auth.refreshSession()
        }
    }

    redirect('/supervisor/production')
}

// ─── signIn ───────────────────────────────────────────────────────────────────

/**
 * Login: authenticates user and uses JWT claims (not a DB query) to
 * determine role and redirect destination.
 */
export async function signIn(input: { email: string; password: string }) {
    const parsed = safeParse(SignInSchema, input)
    if ('error' in parsed) return { error: parsed.error }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
    })

    if (error) {
        // NEVER distinguish between wrong email vs wrong password — user enumeration attack vector
        return { error: 'Incorrect email or password.' }
    }

    if (!data.session) {
        return { error: 'Session error. Please try again.' }
    }

    // The custom_access_token_hook injects role/org_id at JWT mint time,
    // but signInWithPassword returns app_metadata from raw_app_meta_data
    // which may be stale (especially on re-login in PWA standalone mode).
    // Refreshing the session forces the hook to re-run and populate claims.
    let userRole = data.session.user.app_metadata?.role
    let onboardingComplete = data.session.user.app_metadata?.onboarding_complete

    if (!userRole) {
        const { data: refreshed } = await supabase.auth.refreshSession()
        userRole = refreshed.session?.user.app_metadata?.role
        onboardingComplete = refreshed.session?.user.app_metadata?.onboarding_complete
    }

    // ── DB fallback: JWT claims still absent after refresh ────────────────────
    // This happens when the custom_access_token_hook can't find the profile
    // fast enough (PWA cold-open, network lag, or hook race condition).
    // Mirror the pattern used in getOnboardingStatus() — query DB directly.
    if (!userRole) {
        const admin = createAdminClient()
        // Use a single join query to fetch both profile role and org onboarding status
        const { data: profile } = await admin
            .from('profiles')
            .select('role, org_id, organizations(onboarding_complete)')
            .eq('id', data.session.user.id)
            .maybeSingle()

        if (profile?.role) {
            userRole = profile.role

            if (profile.organizations && typeof profile.organizations === 'object' && !Array.isArray(profile.organizations)) {
                onboardingComplete = (profile.organizations as { onboarding_complete?: boolean | null }).onboarding_complete ?? false
            }
        }
    }

    if (userRole === 'owner') {
        const admin = createAdminClient()
        const { data: ownerProfile } = await admin
            .from('profiles')
            .select('org_id, organizations(onboarding_complete)')
            .eq('id', data.session.user.id)
            .maybeSingle()
        const orgId = ownerProfile?.org_id
        if (ownerProfile?.organizations && typeof ownerProfile.organizations === 'object' && !Array.isArray(ownerProfile.organizations)) {
            onboardingComplete = (ownerProfile.organizations as { onboarding_complete?: boolean | null }).onboarding_complete ?? onboardingComplete
        }

        const tier = orgId ? await getOrgTier(orgId) : 'none'
        if (tier === 'base') redirect('/owner/estimator')
        if (tier === 'none') redirect('/owner/billing')
        if (!onboardingComplete) {
            redirect('/onboarding')
        }
        redirect('/owner/today')
    } else if (userRole === 'supervisor') {
        redirect('/supervisor/dashboard')
    } else if (userRole === 'admin') {
        redirect('/admin')
    } else {
        // Role still absent after DB fallback — profile genuinely missing
        return { error: 'Account setup incomplete. Please contact support.' }
    }
}

// ─── regenerateJoinCode ────────────────────────────────────────────────────────

/**
 * Owner-only. Generates a new join code, immediately invalidating the old one.
 * Called from Owner Settings page.
 */
export async function regenerateJoinCode() {
    const { user, profile } = await requireRole(['owner'])
    const orgId = profile.org_id
    const supabase = await createClient()

    const newCode = generateJoinCode()
    const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    try {
        await supabase.rpc('set_actor_for_audit', { p_actor_id: user.id })
    } catch {
        // Non-fatal: authenticated writes still fall back to auth.uid() in the audit trigger.
    }

    const { error } = await supabase
        .from('organizations')
        .update({
            join_code: newCode,
            join_code_expires_at: newExpiry,
        })
        .eq('id', orgId)

    if (error) return { error: 'Failed to regenerate code. Please try again.' }

    revalidatePath('/owner/settings')
    return { joinCode: newCode, expiresAt: newExpiry }
}

// ─── getOnboardingStatus ───────────────────────────────────────────────────────

/**
 * Checks whether the org has at least 1 machine and 1 worker.
 * When both are present, flips onboarding_complete = true in the DB
 * so the next JWT refresh picks it up and middleware stops redirecting.
 *
 * NOTE: Quality is no longer a mandatory onboarding gate (lean arch pivot).
 * Owners can define qualities anytime from settings/inventory.
 */
export async function getOnboardingStatus(): Promise<{
    hasProductionMode: boolean
    hasMachine: boolean
    hasWorker: boolean
    hasPayrollConfig: boolean
    hasPlan: boolean
    isComplete: boolean
}> {
    const { profile } = await requireRole(['owner'])
    const supabase = await createClient()
    const orgId = profile.org_id

    const [machines, workers, payrollConfig, subscription] = await Promise.all([
        supabase.from('machines').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
        supabase.from('workers').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
        supabase.from('payroll_configs').select('org_id').eq('org_id', orgId).maybeSingle(),
        supabase.from('org_subscriptions')
            .select('status, plan_tier, current_end')
            .eq('org_id', orgId)
            .in('status', ['active', 'authenticated'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
    ])

    const { data: orgSettings } = await supabase
        .from('organizations')
        .select('production_mode, onboarding_complete')
        .eq('id', orgId)
        .maybeSingle()

    // Existing onboarded orgs may predate production_mode. Keep them complete
    // and let app-level normalization treat NULL as market_run.
    const hasProductionMode = orgSettings?.onboarding_complete === true
        ? true
        : hasExplicitProductionMode(orgSettings?.production_mode)
    const hasMachine = (machines.count ?? 0) > 0
    const hasWorker  = (workers.count  ?? 0) > 0
    const hasPayrollConfig = !!payrollConfig.data

    // Check if subscription is valid (not expired)
    let hasPlan = false
    if (subscription.data) {
        const sub = subscription.data
        if (sub.current_end) {
            hasPlan = new Date(sub.current_end).getTime() > Date.now()
        } else {
            hasPlan = true // no end date = perpetual (shouldn't happen but safe)
        }
    }

    const isComplete = hasProductionMode && hasMachine && hasWorker && hasPayrollConfig && hasPlan

    if (isComplete) {
        // Flip the flag so future middleware checks use JWT cache, not DB.
        const adminForUpdate = createAdminClient()
        await adminForUpdate
            .from('organizations')
            .update({ onboarding_complete: true })
            .eq('id', orgId)
    }

    return { hasProductionMode, hasMachine, hasWorker, hasPayrollConfig, hasPlan, isComplete }
}

/**
 * Marks onboarding as complete in the DB so the next JWT refresh picks it up.
 * Call this BEFORE supabase.auth.refreshSession() in the client so the
 * custom_access_token_hook mints a JWT with onboarding_complete=true,
 * which unblocks the middleware gate on /owner/analytics.
 *
 * SAFETY: The entire body is wrapped in try/catch so this server action
 * never throws — it always returns { success } or { error: string }.
 * Unhandled throws from this action would propagate through the
 * server action boundary and crash the client-side call.
 */
export async function markOnboardingComplete(): Promise<{ success?: boolean; error?: string }> {
    const { profile } = await requireRole(['owner'])
    try {
        // Use admin client to bypass RLS for the org update.
        // The organizations UPDATE policy relies on auth.jwt() org_id claim which
        // may be absent on a fresh signup (stale JWT race condition).
        const admin = createAdminClient()
        const orgId = profile.org_id

        const { error } = await admin
            .from('organizations')
            .update({ onboarding_complete: true })
            .eq('id', orgId)

        if (error) {
            console.error('[markOnboardingComplete] DB update failed:', error)
            return { error: `DB error: ${error.message}` }
        }

        return { success: true }
    } catch (e) {
        // Catch ALL unhandled throws (e.g. missing env vars, network issues)
        // so this action never propagates an exception to the client.
        console.error('[markOnboardingComplete] Unexpected exception:', e)
        return { error: `Unexpected: ${e instanceof Error ? e.message : String(e)}` }
    }
}
