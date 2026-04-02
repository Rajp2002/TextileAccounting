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
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { CreateOrgSchema, JoinOrgSchema, SignInSchema, safeParse } from '@/lib/schemas'

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

/**
 * Decodes a JWT without verification (safe — we only use it for claims
 * that Supabase Auth already validated server-side).
 */
function parseJWT(token: string): Record<string, any> {
    try {
        const payload = token.split('.')[1]
        return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
    } catch {
        return {}
    }
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

    return await _createOwnerProfile(adminClient, userId, org.id, parsed.data.ownerName, parsed.data.email, parsed.data.password, parsed.data.phone)
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

    // Redirect happens outside this helper — caller must redirect
    return { success: true }
}

export async function createOrganizationAndRedirect(input: {
    ownerName: string
    email: string
    password: string
    factoryName: string
    phone: string
}) {
    const result = await createOrganization(input)
    if (result && 'error' in result) return result
    redirect('/onboarding')
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

    // Parse role from the JWT access token (injected by custom_access_token_hook)
    const jwt = parseJWT(data.session.access_token)
    const userRole = jwt.user_role
    const onboardingComplete = jwt.onboarding_complete

    if (userRole === 'owner') {
        if (!onboardingComplete) {
            redirect('/onboarding')
        }
        redirect('/owner/analytics')
    } else if (userRole === 'supervisor') {
        redirect('/supervisor/production')
    } else {
        // No org_id in JWT — profile doesn't exist yet (race condition)
        return { error: 'Session error. Please try again.' }
    }
}

// ─── regenerateJoinCode ────────────────────────────────────────────────────────

/**
 * Owner-only. Generates a new join code, immediately invalidating the old one.
 * Called from Owner Settings page.
 */
export async function regenerateJoinCode() {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) return { error: 'Not authenticated' }

    const jwt = parseJWT(session.access_token)

    if (jwt.user_role !== 'owner') return { error: 'Unauthorized' }
    if (!jwt.org_id) return { error: 'Organization not found' }

    const newCode = generateJoinCode()
    const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    // Use admin client to bypass the "only owner can update own org" RLS check
    // (which reads auth.jwt() ->> 'user_role' — safe since we verified above)
    const { error } = await supabase
        .from('organizations')
        .update({
            join_code: newCode,
            join_code_expires_at: newExpiry,
        })
        .eq('id', jwt.org_id)

    if (error) return { error: 'Failed to regenerate code. Please try again.' }

    revalidatePath('/owner/settings')
    return { joinCode: newCode, expiresAt: newExpiry }
}

// ─── getOnboardingStatus ───────────────────────────────────────────────────────

/**
 * Checks whether the org has at least 1 machine, 1 quality, and 1 worker.
 * When all three are present, flips onboarding_complete = true in the DB
 * so the next JWT refresh picks it up and middleware stops redirecting.
 */
export async function getOnboardingStatus(): Promise<{
    hasMachine: boolean
    hasQuality: boolean
    hasWorker: boolean
    isComplete: boolean
}> {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) redirect('/login')

    const jwt = parseJWT(session.access_token)
    const orgId = jwt.org_id

    if (!orgId) redirect('/login')

    const [machines, qualities, workers] = await Promise.all([
        supabase.from('machines').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
        supabase.from('qualities').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
        supabase.from('workers').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    ])

    const hasMachine = (machines.count ?? 0) > 0
    const hasQuality = (qualities.count ?? 0) > 0
    const hasWorker  = (workers.count  ?? 0) > 0
    const isComplete = hasMachine && hasQuality && hasWorker

    if (isComplete) {
        // Flip the flag so future middleware checks use JWT cache, not DB
        await supabase
            .from('organizations')
            .update({ onboarding_complete: true })
            .eq('id', orgId)
    }

    return { hasMachine, hasQuality, hasWorker, isComplete }
}
