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
import { cookies, headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { parseJWT } from '@/lib/auth'
import { canEnrollFree, finishFreeProvisioning } from '@/lib/free-account'
import { CreateOrgSchema, PasswordResetRequestSchema, SignInSchema, safeParse } from '@/lib/schemas'
import { getOrgTier } from '@/lib/subscription'
import { createSignInServerTimer, persistSignInTraceCookie } from '@/lib/sign-in-telemetry.server'
import { isValidIndianPhone, normalizeIndianPhone } from '@/lib/phone'
import { LEGAL_DOCUMENTS } from '@/lib/legal-documents'
import { LEGAL_OPERATOR } from '@/lib/legal-operator'
import { freeWorkspaceHintValue, WORKSPACE_HINT_COOKIE, WORKSPACE_HINT_COOKIE_OPTIONS } from '@/lib/workspace-hint'
import { founderEmailAllowed, FOUNDER_ONLY_LOGIN_MESSAGE } from '@/lib/admin/founder-email'

// ─── Helpers ───────────────────────────────────────────────────────────────────

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
    if (founderEmailAllowed(parsed.data.email)) return { error: FOUNDER_ONLY_LOGIN_MESSAGE }
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
        app_metadata: { plan_selection_pending: true, free_signup: true },
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

    const { data: org, error: orgError } = await adminClient
        .from('organizations')
        .insert({
            name: parsed.data.factoryName,
            owner_id: userId,
            onboarding_complete: false,
        })
        .select('id')
        .single()

    if (orgError || !org) {
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
    // All new owner registrations go to initial plan selection
    redirect('/plans?from=onboarding')
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
    const succeed = async (redirectTo: string, freeWorkspaceUserId?: string) => {
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
        // Routing hint for the next app launch, written from the tier this
        // action just resolved. Proxy only guesses with it (lib/workspace-hint.ts).
        if (freeWorkspaceUserId) {
            cookieStore.set(WORKSPACE_HINT_COOKIE, freeWorkspaceHintValue(freeWorkspaceUserId), WORKSPACE_HINT_COOKIE_OPTIONS)
        } else {
            cookieStore.delete(WORKSPACE_HINT_COOKIE)
        }
        await persistSignInTraceCookie(input.traceId)
        telemetry.log('success', { destination: redirectTo })
        return { redirectTo }
    }

    const parsed = safeParse(SignInSchema, input)
    if ('error' in parsed) return fail(parsed.error, 'invalid_input')
    if (founderEmailAllowed(parsed.data.email)) return fail(FOUNDER_ONLY_LOGIN_MESSAGE, 'founder_only_identity')

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
    if (founderEmailAllowed(data.session.user.email)) {
        await supabase.auth.signOut({ scope: 'local' })
        return fail(FOUNDER_ONLY_LOGIN_MESSAGE, 'founder_only_identity')
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

        if (data.session.user.app_metadata?.plan_selection_pending === true) return succeed('/plans?from=onboarding')
        const tier = await telemetry.measure('tier_lookup', () => getOrgTier(orgId))
        if (tier === 'free' || data.session.user.app_metadata.free_signup === true && tier === 'none') return succeed('/free', data.session.user.id)

        if (!onboardingComplete) {
            if (tier === 'lite' || tier === 'base') return succeed('/owner/estimator')
            if (tier === 'none') return succeed('/owner/billing')
            return succeed('/onboarding')
        }

        if (tier === 'lite' || tier === 'base') return succeed('/owner/estimator')
        return succeed('/owner/estimator')
    } else if (userRole === 'supervisor') {
        return succeed('/feature-archived')
    } else if (userRole === 'admin') {
        await supabase.auth.signOut({ scope: 'local' })
        return fail(FOUNDER_ONLY_LOGIN_MESSAGE, 'founder_only_identity')
    } else {
        // Role still absent after DB fallback — profile genuinely missing
        return fail(`Account setup incomplete. Contact ${LEGAL_OPERATOR.contactEmail}.`, 'missing_role')
    }
}
