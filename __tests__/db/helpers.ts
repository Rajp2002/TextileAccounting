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

type SeedOptions = { tier?: 'lite' | 'base' | null; locked?: boolean; name?: string }

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
    const tier = options.tier === undefined ? 'base' : options.tier
    if (tier) {
        await db.query(
            "INSERT INTO public.org_subscriptions(org_id, plan_tier, status, current_start, current_end) VALUES ($1, $2, 'active', now() - interval '1 day', now() + interval '30 days')",
            [orgId, tier],
        )
    }
    return { userId, orgId }
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
