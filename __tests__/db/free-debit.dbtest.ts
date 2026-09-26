import { createHash, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asServiceRole, asSuperuser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

// Refactor Package 1B-1: the Free allowance debit (E11 A-INV-19) executed in
// PostgreSQL. The server calls complete_free_saved_costing with the service
// role after verifying the signed request token.

let db: Db
let free: { userId: string; orgId: string }

const binding = (seed: string) => createHash('sha256').update(seed).digest('hex')
const ENGINE = 'estimator_v3_2026_08'

async function complete(requestId: string, inputBinding: string, issuedAt: string) {
    await asServiceRole(db)
    const { rows } = await db.query(
        `SELECT public.complete_free_saved_costing($1, $2, $3, $4, $5, $6, 'Test costing', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb) AS quota`,
        [free.userId, free.orgId, requestId, inputBinding, ENGINE, issuedAt],
    )
    return rows[0].quota as { used: number; limit?: number; remaining?: number; savedCostingId: string } & Record<string, unknown>
}

async function savedCount() {
    await asSuperuser(db)
    const { rows } = await db.query('SELECT count(*)::int AS n FROM public.free_saved_costings WHERE subject_id = $1', [free.userId])
    return rows[0].n as number
}

beforeAll(async () => {
    db = await freshDatabase()
    free = await seedOwnerOrg(db, { tier: null, name: 'Free Weaver' })
    await asSuperuser(db)
    await db.query('INSERT INTO public.free_account_subjects(id, verified_at, beta_allowed) VALUES ($1, now(), true)', [free.userId])
    await db.query('INSERT INTO public.free_account_grants(org_id, subject_id) VALUES ($1, $2)', [free.orgId, free.userId])
    await db.query('UPDATE public.free_rollout SET estimation_enabled = true')
})
afterAll(async () => { await db?.end() })

describe('Free allowance debit in the database', () => {
    const issuedAt = new Date(Date.now() - 60_000).toISOString()

    it('CHARACTERIZATION: the migrated policy allows 2 calculations per calendar month in Asia/Kolkata', async () => {
        await asSuperuser(db)
        const { rows } = await db.query(
            'SELECT p.monthly_limit, p.time_zone FROM public.free_rollout r JOIN public.free_quota_policies p ON p.version = r.policy_version',
        )
        expect(rows).toEqual([{ monthly_limit: 2, time_zone: 'Asia/Kolkata' }])
    })

    it('INVARIANT A-INV-19: a new request debits once and saves the costing', async () => {
        const quota = await complete(randomUUID(), binding('first'), issuedAt)
        expect(quota.used).toBe(1)
        expect(await savedCount()).toBe(1)
    })

    it('INVARIANT A-INV-19: replaying a request returns the same result without a second debit', async () => {
        const requestId = randomUUID()
        const first = await complete(requestId, binding('second'), issuedAt)
        const replay = await complete(requestId, binding('second'), issuedAt)
        expect(first.used).toBe(2)
        expect(replay.used).toBe(2)
        expect(replay.savedCostingId).toBe(requestId)
        expect(await savedCount()).toBe(2)

        // The same request id with different inputs is a conflict, not a replay.
        const conflict = await pgError(complete(requestId, binding('changed inputs'), issuedAt))
        expect(conflict.message).toBe('FREE_REQUEST_CONFLICT')
        expect(await savedCount()).toBe(2)
    })

    it('INVARIANT A-INV-19: once the allowance is used, a new request is refused and nothing is saved', async () => {
        const error = await pgError(complete(randomUUID(), binding('third'), issuedAt))
        expect(error.message).toBe('FREE_QUOTA_EXHAUSTED')
        expect(await savedCount()).toBe(2)
    })

    it('INVARIANT A-INV-19: a locked organization is refused access', async () => {
        await asSuperuser(db)
        await db.query('UPDATE public.organizations SET is_locked_down = true WHERE id = $1', [free.orgId])
        const error = await pgError(complete(randomUUID(), binding('locked'), issuedAt))
        expect(error.message).toBe('FREE_ACCESS_DENIED')
        await asSuperuser(db)
        await db.query('UPDATE public.organizations SET is_locked_down = false WHERE id = $1', [free.orgId])
    })

    it('INVARIANT A-INV-19: authenticated users cannot call the debit directly', async () => {
        await asSuperuser(db)
        await db.query('RESET ROLE')
        await db.query("SELECT set_config('request.jwt.claims', $1, false), set_config('request.jwt.claim.sub', $2, false)", [
            JSON.stringify({ sub: free.userId, role: 'authenticated' }), free.userId,
        ])
        await db.query('SET ROLE authenticated')
        const error = await pgError(db.query(
            "SELECT public.complete_free_saved_costing($1, $2, $3, $4, $5, $6, 'x', '{}', '{}', '{}')",
            [free.userId, free.orgId, randomUUID(), binding('direct'), ENGINE, issuedAt],
        ))
        expect(error.code).toBe('42501')
    })
})
