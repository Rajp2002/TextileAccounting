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
import { cookies, headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { parseJWT, requireRole } from '@/lib/auth'
import { canEnrollFree, finishFreeProvisioning } from '@/lib/free-account'
import { CreateOrgSchema, JoinOrgSchema, PasswordResetRequestSchema, SignInSchema, safeParse } from '@/lib/schemas'
import { hasExplicitProductionMode } from '@/lib/production-mode'
import { getOrgTier } from '@/lib/subscription'
import { checkJoinCodeRateLimit, getClientIpFromHeaders } from '@/lib/rate-limit'
import { createSignInServerTimer, persistSignInTraceCookie } from '@/lib/sign-in-telemetry.server'
import { isValidIndianPhone, normalizeIndianPhone } from '@/lib/phone'
import { LEGAL_DOCUMENTS } from '@/lib/legal-documents'
import { LEGAL_OPERATOR } from '@/lib/legal-operator'

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

type CreateOrganizationInput = {
    ownerName: string
    email: string
    password: string
    confirmPassword: string
    factoryName: string
    phone: string
    referralCode?: string
    selectedPlan?: 'free' | 'lite' | 'base'
    legalAcceptance: {
        accepted: boolean
        termsVersion: string
        privacyVersion: string
    }
}

async function recordSignupLegalAcceptances(
    adminClient: ReturnType<typeof createAdminClient>,
    userId: string,
    orgId: string,
    userAgent: string | null,
) {
    return adminClient
        .from('legal_document_acceptances')
        .insert([
            {
                org_id: orgId,
                actor_user_id: userId,
                document_type: LEGAL_DOCUMENTS.terms.type,
                document_version: LEGAL_DOCUMENTS.terms.version,
                document_identifier: LEGAL_DOCUMENTS.terms.identifier,
                document_path: LEGAL_DOCUMENTS.terms.path,
                acceptance_method: 'signup_checkbox',
                language_code: 'en',
                user_agent: userAgent,
            },
            {
                org_id: orgId,
                actor_user_id: userId,
                document_type: LEGAL_DOCUMENTS.privacy.type,
                document_version: LEGAL_DOCUMENTS.privacy.version,
                document_identifier: LEGAL_DOCUMENTS.privacy.identifier,
                document_path: LEGAL_DOCUMENTS.privacy.path,
                acceptance_method: 'signup_checkbox',
                language_code: 'en',
                user_agent: userAgent,
            },
        ])
}

/**
 * Owner signup: atomically creates auth user → organization → profile.
 * Uses service_role throughout. Rolls back on any step failure.
 *
 * On success: signs the owner in and redirects to /onboarding.
 */
export async function createOrganization(input: CreateOrganizationInput) {
    if (!isValidIndianPhone(input.phone)) {
        return { error: 'Enter a valid 10-digit Indian mobile number, for example 9876543210.' }
    }
    const parsed = safeParse(CreateOrgSchema, {
        ...input,
        phone: normalizeIndianPhone(input.phone),
    })
    if ('error' in parsed) return { error: parsed.error }

    const freeSignup = input.selectedPlan === 'free'
    if (freeSignup && !await canEnrollFree(parsed.data.email)) return { error: 'Free enrollment is not available for this account yet.' }
    const requestHeaders = await headers()
    const userAgent = requestHeaders.get('user-agent')?.trim().slice(0, 512) || null

    const adminClient = createAdminClient()

    const applySignupReferral = async (orgId: string) => {
        if (!parsed.data.referralCode) return
        try {
            const { applyReferralCode } = await import('@/lib/referral')
            await applyReferralCode(parsed.data.referralCode, orgId)
        } catch (error) {
            // Referral is optional; a bad or retired code must not leave the
            // newly-created account unusable. The reward is still gated by the
            // paid Base Plan activation path.
            console.error('Failed to apply referral code during signup:', error)
        }
    }

    // ── Step 1: Create Supabase auth user ────────────────────────────────────
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: parsed.data.email,
        password: parsed.data.password,
        app_metadata: freeSignup ? { free_signup: true } : {},
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

    const finishOrganizationCreation = async (orgId: string) => {
        const { error: acceptanceError } = await recordSignupLegalAcceptances(
            adminClient,
            userId,
            orgId,
            userAgent,
        )

        if (acceptanceError) {
            await adminClient.from('organizations').delete().eq('id', orgId)
            await adminClient.auth.admin.deleteUser(userId)
            return { error: 'Unable to record legal acceptance. Your account was not created.' }
        }

        const result = await _createOwnerProfile(
            adminClient,
            userId,
            orgId,
            parsed.data.ownerName,
            parsed.data.email,
            parsed.data.password,
            parsed.data.phone,
        )
        if (result.success) await applySignupReferral(orgId)
        if (result.success && freeSignup) {
            try { await finishFreeProvisioning(authData.user, orgId) }
            catch { return { error: 'Account created. Log in to retry Free activation.' } }
        }
        return result
    }

    // ── Step 2: Generate join code + create organization ─────────────────────
    let joinCode = generateJoinCode()

    const { data: org, error: orgError } = await adminClient
        .from('organizations')
        .insert({
            name: parsed.data.factoryName,
            join_code: joinCode,
            join_code_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            owner_id: userId,
            product_experience: 'base',
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
                    product_experience: 'base',
                    onboarding_complete: false,
                })
                .select('id')
                .single()

            if (orgError2) {
                await adminClient.auth.admin.deleteUser(userId)
                return { error: 'Failed to create organization. Please try again.' }
            }

            return finishOrganizationCreation(org2!.id)
        }

        await adminClient.auth.admin.deleteUser(userId)
        return { error: 'Failed to create organization. Please try again.' }
    }

    return finishOrganizationCreation(org.id)
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

export async function createOrganizationAndRedirect(input: CreateOrganizationInput) {
    const result = await createOrganization(input)
    if (result && 'error' in result) return result
    // Plan selection comes before factory onboarding. Estimator-only owners do
    // not need machines, workers, payroll, or production-mode setup.
    if (input.selectedPlan === 'free') redirect('/free')
    const selectedPlan = input.selectedPlan === 'base' ? 'base' : 'lite'
    redirect(`/owner/billing?plan=${selectedPlan}`)
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
    confirmPassword: string
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

    if (!isValidIndianPhone(input.phone)) {
        return { error: 'Enter a valid 10-digit Indian mobile number, for example 9876543210.' }
    }
    const parsed = safeParse(JoinOrgSchema, {
        ...input,
        phone: normalizeIndianPhone(input.phone),
    })
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
 * Login: authenticates the user and returns a safe internal destination. The
 * client performs the navigation only after its user-scoped offline cache has
 * also been cleared.
 */
export async function signIn(input: { email: string; password: string; traceId?: string }) {
    const telemetry = createSignInServerTimer('sign_in_server_action', input.traceId)
    const fail = (error: string, outcome: string) => {
        telemetry.log(outcome)
        return { error }
    }
    const succeed = async (redirectTo: string) => {
        // A previous session can leave an old inactivity timestamp behind. The
        // newly-created Supabase session and this cookie are committed in the
        // same Server Action response so Proxy never mistakes a fresh login for
        // an hour-old idle session on the first dashboard request.
        const cookieStore = await cookies()
        cookieStore.set('last_activity', Date.now().toString(), {
            path: '/',
            maxAge: 7 * 24 * 60 * 60,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
        })
        await persistSignInTraceCookie(input.traceId)
        telemetry.log('success', { destination: redirectTo })
        return { redirectTo }
    }

    const parsed = safeParse(SignInSchema, input)
    if ('error' in parsed) return fail(parsed.error, 'invalid_input')

    const supabase = await telemetry.measure('create_client', () => createClient())
    const { data, error } = await telemetry.measure(
        'password_auth',
        () => supabase.auth.signInWithPassword({
            email: parsed.data.email,
            password: parsed.data.password,
        })
    )

    if (error) {
        // NEVER distinguish between wrong email vs wrong password — user enumeration attack vector
        return fail('Incorrect email or password.', 'invalid_credentials')
    }

    if (!data.session) {
        return fail('Session error. Please try again.', 'missing_session')
    }

    // Read the freshly minted access token first. Unlike the user object's raw
    // metadata, these values come from custom_access_token_hook for this login.
    let jwt = parseJWT(data.session.access_token)
    let userRole = jwt.user_role ?? data.session.user.app_metadata?.role
    let orgId = jwt.org_id ?? data.session.user.app_metadata?.org_id
    let onboardingComplete = jwt.onboarding_complete ?? data.session.user.app_metadata?.onboarding_complete

    const needsOrganization = userRole === 'owner' || userRole === 'supervisor'
    if (!userRole || (needsOrganization && !orgId)) {
        const { data: refreshed } = await telemetry.measure(
            'claims_refresh',
            () => supabase.auth.refreshSession()
        )
        if (refreshed.session) {
            jwt = parseJWT(refreshed.session.access_token)
            userRole = jwt.user_role ?? refreshed.session.user.app_metadata?.role
            orgId = jwt.org_id ?? refreshed.session.user.app_metadata?.org_id
            onboardingComplete = jwt.onboarding_complete ?? refreshed.session.user.app_metadata?.onboarding_complete
        }
    }

    // ── DB fallback: JWT claims still absent after refresh ────────────────────
    // This happens when the custom_access_token_hook can't find the profile
    // fast enough (PWA cold-open, network lag, or hook race condition).
    // Mirror the pattern used in getOnboardingStatus() — query DB directly.
    if (!userRole || ((userRole === 'owner' || userRole === 'supervisor') && !orgId)) {
        const { data: profile } = await telemetry.measure('profile_fallback', async () => {
            const admin = createAdminClient()
            // Use a single join query to fetch both profile role and org onboarding status
            return admin
                .from('profiles')
                .select('role, org_id, organizations(onboarding_complete)')
                .eq('id', data.session.user.id)
                .maybeSingle()
        })

        if (profile?.role) {
            userRole = profile.role
            orgId = profile.org_id ?? undefined

            if (profile.organizations && typeof profile.organizations === 'object' && !Array.isArray(profile.organizations)) {
                onboardingComplete = (profile.organizations as { onboarding_complete?: boolean | null }).onboarding_complete ?? false
            }
        }
    }

    if (userRole === 'owner') {
        if (!orgId) {
            return fail(`Account setup incomplete. Contact ${LEGAL_OPERATOR.contactEmail}.`, 'missing_organization')
        }

        // Resolve the effective workspace tier before choosing the landing
        // route. A Premium organization using the Base Plan experience has an
        // effective tier of `base`, so sending it to Factory Today would land
        // behind the Full Suite access wall.
        const tier = await telemetry.measure('tier_lookup', () => getOrgTier(orgId))
        if (tier === 'free' || data.session.user.app_metadata.free_signup === true && tier === 'none') return succeed('/free')

        if (!onboardingComplete) {
            if (tier === 'lite' || tier === 'base') return succeed('/owner/estimator')
            if (tier === 'none') return succeed('/owner/billing')
            return succeed('/onboarding')
        }

        if (tier === 'lite' || tier === 'base') return succeed('/owner/estimator')
        return succeed('/owner/today')
    } else if (userRole === 'supervisor') {
        return succeed('/supervisor/dashboard')
    } else if (userRole === 'admin') {
        return succeed('/admin')
    } else {
        // Role still absent after DB fallback — profile genuinely missing
        return fail(`Account setup incomplete. Contact ${LEGAL_OPERATOR.contactEmail}.`, 'missing_role')
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
 * Checks the minimum setup needed to enter the owner workspace.
 *
 * Factory master data is intentionally not part of this blocking gate. Looms,
 * workers, and payroll are collected contextually when the owner first opens
 * the workflow that needs them. This keeps first-session onboarding focused on
 * choosing the factory's production mode while preserving the status fields for
 * the in-app setup guidance and legacy callers.
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

    const isComplete = hasProductionMode && hasPlan

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
