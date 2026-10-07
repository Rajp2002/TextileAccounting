import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asSuperuser, asSupervisor, asUser, freshDatabase, pgError, seedOwnerOrg, seedSupervisor, type Db } from './helpers'

// Base supervisors are not tenant members: no profile org, no org claim. The
// factory link lives in factory_supervisors and only these helpers read it.

let db: Db

// Private helpers are not client-callable; evaluate them as their definer
// would, with the caller's claims in place.
async function activeSupervisorOrg(userId: string) {
    await asSupervisor(db, userId)
    await db.query('RESET ROLE')
    const { rows } = await db.query('SELECT private.active_supervisor_org() AS org')
    await asSuperuser(db)
    return rows[0].org as string | null
}

async function hookClaims(userId: string) {
    await asSuperuser(db)
    const { rows } = await db.query(
        "SELECT public.custom_access_token_hook(jsonb_build_object('user_id', $1::text, 'claims', jsonb_build_object('sub', $1::text, 'role', 'authenticated', 'org_id', 'stale', 'user_role', 'stale'))) -> 'claims' AS claims",
        [userId],
    )
    return rows[0].claims as Record<string, unknown>
}

beforeAll(async () => { db = await freshDatabase() })
afterAll(async () => { await db?.end() })

describe('supervisor membership', () => {
    it('an approved supervisor of an active Base factory resolves to that factory', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const supervisor = await seedSupervisor(db, owner.orgId, 'approved')
        expect(await activeSupervisorOrg(supervisor.userId)).toBe(owner.orgId)
    })

    it('pending and removed supervisors resolve to no factory', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const pending = await seedSupervisor(db, owner.orgId, 'pending')
        const removed = await seedSupervisor(db, owner.orgId, 'removed')
        expect(await activeSupervisorOrg(pending.userId)).toBeNull()
        expect(await activeSupervisorOrg(removed.userId)).toBeNull()
    })

    it('a supervisor of a Lite or lapsed factory resolves to no factory', async () => {
        const lite = await seedOwnerOrg(db, { tier: 'lite' })
        const liteSupervisor = await seedSupervisor(db, lite.orgId, 'approved')
        expect(await activeSupervisorOrg(liteSupervisor.userId)).toBeNull()

        const lapsed = await seedOwnerOrg(db, { tier: null })
        await db.query(
            "INSERT INTO public.org_subscriptions(org_id, plan_tier, status, current_start, current_end) VALUES ($1, 'base', 'active', now() - interval '40 days', now() - interval '2 days')",
            [lapsed.orgId],
        )
        const lapsedSupervisor = await seedSupervisor(db, lapsed.orgId, 'approved')
        expect(await activeSupervisorOrg(lapsedSupervisor.userId)).toBeNull()
    })

    it('an owner is never resolved as a supervisor', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        await asUser(db, owner.userId, owner.orgId)
        await db.query('RESET ROLE')
        const { rows } = await db.query('SELECT private.active_supervisor_org() AS org')
        expect(rows[0].org).toBeNull()
    })

    it('clients cannot call the private helpers directly', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const supervisor = await seedSupervisor(db, owner.orgId, 'approved')
        await asSupervisor(db, supervisor.userId)
        expect((await pgError(db.query('SELECT private.active_supervisor_org()'))).code).toBe('42501')
    })

    it('org_has_active_base answers exactly like the owner Base production predicate', async () => {
        const states: Array<[string, string, string, string | null]> = [
            ['base', 'active', "now() - interval '1 day'", "now() + interval '30 days'"],
            ['base', 'active', "now() - interval '40 days'", "now() - interval '12 hours'"],
            ['base', 'active', "now() - interval '40 days'", "now() - interval '2 days'"],
            ['base', 'active', "now() + interval '1 day'", "now() + interval '30 days'"],
            ['lite', 'active', "now() - interval '1 day'", "now() + interval '30 days'"],
            ['base', 'halted', "now() - interval '1 day'", "now() + interval '10 days'"],
            ['base', 'active', "now() - interval '1 day'", null],
            ['base', 'expired', "now() - interval '1 day'", "now() + interval '10 days'"],
        ]
        for (const [tier, status, start, end] of states) {
            const owner = await seedOwnerOrg(db, { tier: null })
            await db.query(
                `INSERT INTO public.org_subscriptions(org_id, plan_tier, status, current_start, current_end) VALUES ($1, $2, $3, ${start}, ${end ?? 'NULL'})`,
                [owner.orgId, tier, status],
            )
            await asUser(db, owner.userId, owner.orgId)
            const ownerView = await db.query("SELECT public.org_has_subscription_tier($1, 'base_production') AS ok", [owner.orgId])
            await asSuperuser(db)
            const membershipFree = await db.query('SELECT private.org_has_active_base($1) AS ok', [owner.orgId])
            expect({ tier, status, start, end, ok: membershipFree.rows[0].ok }).toEqual({ tier, status, start, end, ok: ownerView.rows[0].ok })
        }
    })

    it('supervisor_org_locked reads the factory lock directly', async () => {
        const open = await seedOwnerOrg(db, { tier: 'base' })
        const locked = await seedOwnerOrg(db, { tier: 'base', locked: true })
        const { rows } = await db.query('SELECT private.supervisor_org_locked($1) AS open, private.supervisor_org_locked($2) AS locked', [open.orgId, locked.orgId])
        expect(rows[0]).toEqual({ open: false, locked: true })
    })

    it('generated join codes use only the unambiguous alphabet', async () => {
        await asSuperuser(db)
        const { rows } = await db.query('SELECT private.generate_supervisor_join_code() AS code FROM generate_series(1, 50)')
        for (const { code } of rows) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
    })
})

describe('supervisor profiles and token claims', () => {
    it('an active supervisor profile can never carry an organization', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const userId = randomUUID()
        await asSuperuser(db)
        await db.query('INSERT INTO auth.users(id, email, created_at) VALUES ($1, $2, now())', [userId, `${userId}@example.test`])
        const error = await pgError(db.query("INSERT INTO public.profiles(id, org_id, role, full_name) VALUES ($1, $2, 'supervisor', 'Org Supervisor')", [userId, owner.orgId]))
        expect(error.code).toBe('23514')
    })

    it('a revoked legacy supervisor may keep its historical organization', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const userId = randomUUID()
        await asSuperuser(db)
        await db.query('INSERT INTO auth.users(id, email, created_at) VALUES ($1, $2, now())', [userId, `${userId}@example.test`])
        await db.query("INSERT INTO public.profiles(id, org_id, role, full_name, access_revoked_at) VALUES ($1, $2, 'supervisor', 'Legacy', now())", [userId, owner.orgId])
    })

    it('the owner token keeps its organization claims', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const claims = await hookClaims(owner.userId)
        expect(claims).toMatchObject({ user_role: 'owner', org_id: owner.orgId, full_name: 'Test Owner', onboarding_complete: false })
    })

    it('an active supervisor token carries the role and name but no organization', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const supervisor = await seedSupervisor(db, owner.orgId, 'pending', 'Ramesh')
        const claims = await hookClaims(supervisor.userId)
        expect(claims.user_role).toBe('supervisor')
        expect(claims.full_name).toBe('Ramesh')
        expect(claims).not.toHaveProperty('org_id')
        expect(claims).not.toHaveProperty('onboarding_complete')
    })

    it('a removed supervisor token carries no role', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const supervisor = await seedSupervisor(db, owner.orgId, 'removed')
        const claims = await hookClaims(supervisor.userId)
        expect(claims).not.toHaveProperty('user_role')
        expect(claims).not.toHaveProperty('org_id')
    })
})
