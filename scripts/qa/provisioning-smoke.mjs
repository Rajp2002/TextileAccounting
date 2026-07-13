import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

function readArgument(name) {
    const prefix = `--${name}=`
    return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
}

function requireValue(value, name) {
    if (!value) throw new Error(`Missing required ${name}`)
    return value
}

function sanitizeId(value) {
    return value ? `${value.slice(0, 8)}…` : null
}

const supabaseUrl = requireValue(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')
const anonKey = requireValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
const serviceRoleKey = requireValue(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY')
const expectedProjectRef = requireValue(readArgument('expected-project-ref'), '--expected-project-ref')
const actualProjectRef = new URL(supabaseUrl).hostname.split('.')[0]

if (actualProjectRef !== expectedProjectRef) {
    throw new Error(`SAFETY ABORT: expected isolated QA ref ${expectedProjectRef}, got ${actualProjectRef}`)
}

const runSuffix = `${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${crypto.randomBytes(3).toString('hex')}`
const email = `runtimeqa.provisioning.${runSuffix}@example.com`
const factoryName = `RUNTIMEQA-PROVISIONING-${runSuffix}`
const ownerName = `Runtime QA Owner ${runSuffix}`
const password = `Qa!${crypto.randomBytes(18).toString('base64url')}`
const phone = `9${crypto.randomInt(1_000_000_000).toString().padStart(9, '0')}`
const joinCode = crypto.randomBytes(4).toString('hex').toUpperCase()

const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
})
const appClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
})

let userId = null
let orgId = null
let proof = null
let primaryError = null
const cleanupErrors = []

try {
    const authResult = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    })
    if (authResult.error || !authResult.data.user) {
        throw new Error(`auth user creation failed: ${authResult.error?.code ?? 'missing_user'} ${authResult.error?.message ?? ''}`.trim())
    }
    userId = authResult.data.user.id

    const orgResult = await admin
        .from('organizations')
        .insert({
            name: factoryName,
            join_code: joinCode,
            join_code_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            owner_id: userId,
            onboarding_complete: false,
        })
        .select('id, name, owner_id')
        .single()
    if (orgResult.error || !orgResult.data) {
        throw new Error(`organization creation failed: ${orgResult.error?.code ?? 'missing_org'} ${orgResult.error?.message ?? ''}`.trim())
    }
    orgId = orgResult.data.id

    const profileResult = await admin
        .from('profiles')
        .insert({
            id: userId,
            org_id: orgId,
            role: 'owner',
            full_name: ownerName,
            email,
            phone,
        })
        .select('id, org_id, role')
        .single()
    if (profileResult.error || !profileResult.data) {
        throw new Error(`owner profile creation failed: ${profileResult.error?.code ?? 'missing_profile'} ${profileResult.error?.message ?? ''}`.trim())
    }

    const authRead = await admin.auth.admin.getUserById(userId)
    const adminRead = await admin
        .from('profiles')
        .select('id, org_id, role, organizations(id, name, owner_id)')
        .eq('id', userId)
        .single()

    if (authRead.error || authRead.data.user?.id !== userId) {
        throw new Error('provisioning invariant failed: auth user cannot be read after creation')
    }
    if (adminRead.error || !adminRead.data) {
        throw new Error(`provisioning invariant failed: profile/org join cannot be read (${adminRead.error?.message ?? 'missing data'})`)
    }
    if (adminRead.data.org_id !== orgId || adminRead.data.role !== 'owner') {
        throw new Error('provisioning invariant failed: owner profile has invalid organization linkage')
    }
    if (!adminRead.data.organizations || Array.isArray(adminRead.data.organizations) || adminRead.data.organizations.id !== orgId) {
        throw new Error('provisioning invariant failed: linked organization is missing or invalid')
    }

    const signInResult = await appClient.auth.signInWithPassword({ email, password })
    if (signInResult.error || signInResult.data.user?.id !== userId) {
        throw new Error(`app sign-in path failed: ${signInResult.error?.message ?? 'missing authenticated user'}`)
    }

    const appRead = await appClient
        .from('profiles')
        .select('id, org_id, role, organizations(id, name, onboarding_complete)')
        .eq('id', userId)
        .single()
    if (appRead.error || !appRead.data) {
        throw new Error(`authenticated app read path failed: ${appRead.error?.message ?? 'missing profile/org'}`)
    }
    if (appRead.data.org_id !== orgId || appRead.data.role !== 'owner') {
        throw new Error('authenticated app read path returned invalid owner/org linkage')
    }
    if (!appRead.data.organizations || Array.isArray(appRead.data.organizations) || appRead.data.organizations.id !== orgId) {
        throw new Error('authenticated app read path returned no linked organization')
    }

    proof = {
        result: 'pass',
        qaProjectRef: actualProjectRef,
        accountEmail: email,
        factoryName,
        role: appRead.data.role,
        authUserId: sanitizeId(userId),
        profileId: sanitizeId(appRead.data.id),
        organizationId: sanitizeId(orgId),
        appReadPathVerified: true,
        organizationOnboardingComplete: appRead.data.organizations.onboarding_complete,
    }
} catch (error) {
    primaryError = error
} finally {
    const signOut = await appClient.auth.signOut()
    if (signOut.error) cleanupErrors.push(`sign out: ${signOut.error.message}`)

    if (userId) {
        const profileDelete = await admin.from('profiles').delete().eq('id', userId)
        if (profileDelete.error) cleanupErrors.push(`profile: ${profileDelete.error.message}`)

        const userDelete = await admin.auth.admin.deleteUser(userId)
        if (userDelete.error && userDelete.error.code !== 'user_not_found') cleanupErrors.push(`auth user: ${userDelete.error.message}`)
    }

    if (orgId) {
        const orgDelete = await admin.from('organizations').delete().eq('id', orgId)
        if (orgDelete.error) cleanupErrors.push(`organization: ${orgDelete.error.message}`)

        const auditDelete = await admin
            .from('audit_log')
            .delete()
            .eq('table_name', 'organizations')
            .eq('record_id', orgId)
        if (auditDelete.error) cleanupErrors.push(`audit log: ${auditDelete.error.message}`)
    }
}

const authAfterCleanup = userId ? await admin.auth.admin.getUserById(userId) : null
const orgAfterCleanup = orgId
    ? await admin.from('organizations').select('id', { count: 'exact', head: true }).eq('id', orgId)
    : { count: 0, error: null }
const profileAfterCleanup = userId
    ? await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('id', userId)
    : { count: 0, error: null }
const auditAfterCleanup = orgId
    ? await admin.from('audit_log').select('id', { count: 'exact', head: true }).eq('table_name', 'organizations').eq('record_id', orgId)
    : { count: 0, error: null }

if (orgAfterCleanup.error) cleanupErrors.push(`organization reconciliation: ${orgAfterCleanup.error.message}`)
if (profileAfterCleanup.error) cleanupErrors.push(`profile reconciliation: ${profileAfterCleanup.error.message}`)
if (auditAfterCleanup.error) cleanupErrors.push(`audit reconciliation: ${auditAfterCleanup.error.message}`)

const cleanup = {
    authUserCount: authAfterCleanup?.data?.user ? 1 : 0,
    organizationCount: orgAfterCleanup.count ?? null,
    profileCount: profileAfterCleanup.count ?? null,
    auditLogCount: auditAfterCleanup.count ?? null,
    errors: cleanupErrors,
}
const cleanupPassed = cleanup.authUserCount === 0
    && cleanup.organizationCount === 0
    && cleanup.profileCount === 0
    && cleanup.auditLogCount === 0
    && cleanup.errors.length === 0

if (primaryError || !proof || !cleanupPassed) {
    console.error(JSON.stringify({
        result: 'fail',
        qaProjectRef: actualProjectRef,
        accountEmail: email,
        factoryName,
        failure: primaryError instanceof Error ? primaryError.message : primaryError ? String(primaryError) : 'cleanup reconciliation failed',
        cleanup,
    }, null, 2))
    process.exitCode = 1
} else {
    console.log(JSON.stringify({ ...proof, cleanup }, null, 2))
}
