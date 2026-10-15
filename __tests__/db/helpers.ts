import { randomUUID } from 'node:crypto'
import { inject } from 'vitest'
import { connect } from '../../scripts/test-db/cluster.mjs'

export type Db = ReturnType<typeof connect>

/** A private copy of the migrated template database for one test file. */
export async function freshDatabase(): Promise<Db> {
    const { host, port, template } = inject('weavlyDb')
    const name = `test_${randomUUID().replaceAll('-', '')}`
    const admin = connect({ host, port })
    await admin.connect()
    await admin.query(`CREATE DATABASE ${name} TEMPLATE ${template}`)
    await admin.end()
    const db = connect({ host, port, database: name })
    await db.connect()
    return db
}

/** Back to the superuser used for seeding (bypasses grants and RLS). */
export async function asSuperuser(db: Db) {
    await db.query("RESET ROLE; SELECT set_config('request.jwt.claims', '', false), set_config('request.jwt.claim.sub', '', false)")
}

/** Act as a signed-in user, with the claims custom_access_token_hook mints. */
export async function asUser(db: Db, userId: string, orgId: string, userRole = 'owner') {
    await db.query('RESET ROLE')
    await db.query("SELECT set_config('request.jwt.claims', $1, false), set_config('request.jwt.claim.sub', $2, false)", [
        JSON.stringify({ sub: userId, role: 'authenticated', user_role: userRole, org_id: orgId }),
        userId,
    ])
    await db.query('SET ROLE authenticated')
}

/** Act as the server-side service-role client. */
export async function asServiceRole(db: Db) {
    await db.query('RESET ROLE')
    await db.query("SELECT set_config('request.jwt.claims', $1, false), set_config('request.jwt.claim.sub', '', false)", [
        JSON.stringify({ role: 'service_role' }),
    ])
    await db.query('SET ROLE service_role')
}

// goLive: the org's Base go-live date. The default sits far in the past so tests that record
// production, assignments or payroll behave as a live factory; pass null for one still in setup.
type SeedOptions = { tier?: 'lite' | 'base' | null; locked?: boolean; name?: string; goLive?: string | null }

/** Seed an organization with one owner (as superuser). */
export async function seedOwnerOrg(db: Db, options: SeedOptions = {}) {
    const userId = randomUUID()
    const orgId = randomUUID()
    await asSuperuser(db)
    await db.query('INSERT INTO auth.users(id, email, created_at) VALUES ($1, $2, now())', [userId, `${userId}@example.test`])
    await db.query('INSERT INTO public.organizations(id, name, owner_id, is_locked_down) VALUES ($1, $2, $3, $4)', [
        orgId, options.name ?? 'Test Weaving Works', userId, options.locked ?? false,
    ])
    await db.query("INSERT INTO public.profiles(id, org_id, role, full_name) VALUES ($1, $2, 'owner', 'Test Owner')", [userId, orgId])
    const goLive = options.goLive === undefined ? '2000-01-01' : options.goLive
    if (goLive !== null) await db.query('UPDATE public.organizations SET base_go_live_date = $2 WHERE id = $1', [orgId, goLive])
    const tier = options.tier === undefined ? 'base' : options.tier
    if (tier) {
        await db.query(
            "INSERT INTO public.org_subscriptions(org_id, plan_tier, status, current_start, current_end) VALUES ($1, $2, 'active', now() - interval '1 day', now() + interval '30 days')",
            [orgId, tier],
        )
    }
    return { userId, orgId }
}

/** Act as a signed-in supervisor: the token hook mints a role but no org claim. */
export async function asSupervisor(db: Db, userId: string) {
    await db.query('RESET ROLE')
    await db.query("SELECT set_config('request.jwt.claims', $1, false), set_config('request.jwt.claim.sub', $2, false)", [
        JSON.stringify({ sub: userId, role: 'authenticated', user_role: 'supervisor' }),
        userId,
    ])
    await db.query('SET ROLE authenticated')
}

export type SupervisorStatus = 'pending' | 'approved' | 'removed'

/** Seed a supervisor linked to an organization (as superuser). Supervisors have no profile org. */
export async function seedSupervisor(db: Db, orgId: string, status: SupervisorStatus = 'approved', name = 'Test Supervisor') {
    const userId = randomUUID()
    await asSuperuser(db)
    await db.query('INSERT INTO auth.users(id, email, created_at) VALUES ($1, $2, now())', [userId, `${userId}@example.test`])
    await db.query(
        "INSERT INTO public.profiles(id, org_id, role, full_name, email, access_revoked_at) VALUES ($1, NULL, 'supervisor', $2, $3, CASE WHEN $4 THEN now() END)",
        [userId, name, `${userId}@example.test`, status === 'removed'],
    )
    await db.query(
        "INSERT INTO public.factory_supervisors(user_id, org_id, status, decided_at) VALUES ($1, $2, $3, CASE WHEN $3 = 'pending' THEN NULL ELSE now() END)",
        [userId, orgId, status],
    )
    return { userId }
}

/** Resolve with the Postgres error (code and message) a statement raises. */
export async function pgError(promise: Promise<unknown>): Promise<{ code?: string; message: string }> {
    try {
        await promise
    } catch (error) {
        const { code, message } = error as { code?: string; message: string }
        return { code, message }
    }
    throw new Error('Expected the statement to fail, but it succeeded')
}
