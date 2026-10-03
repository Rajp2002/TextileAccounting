import { createHash, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asServiceRole, asSuperuser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

// FR06 / F15: reconcile the existing Free funnel events with receipts and
// saved snapshots, with no new collection. This characterizes current
// semantics; docs/free-tier/MEASUREMENT_INVENTORY.md explains each count.

let db: Db
let free: { userId: string; orgId: string }
const issuedAt = new Date(Date.now() - 60_000).toISOString()
const binding = (seed: string) => createHash('sha256').update(seed).digest('hex')

async function complete(requestId: string, seed: string) {
    await asServiceRole(db)
    await db.query(
        `SELECT public.complete_free_saved_costing($1, $2, $3, $4, 'estimator_v3_2026_08', $5, 'Synthetic', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)`,
        [free.userId, free.orgId, requestId, binding(seed), issuedAt],
    )
}

async function ledger() {
    await asSuperuser(db)
    const { rows } = await db.query(
        `SELECT
           (SELECT count(*)::int FROM public.free_calculation_receipts WHERE subject_id = $1) AS receipts,
           (SELECT count(*)::int FROM public.free_saved_costings WHERE subject_id = $1) AS snapshots,
           (SELECT count(*)::int FROM public.free_funnel_events WHERE subject_id = $1 AND event_name = 'calculation_completed') AS completed_events,
           (SELECT count(*)::int FROM public.free_funnel_events WHERE subject_id = $1 AND event_name = 'paid_activation') AS paid_events,
           (SELECT count(*)::int FROM public.free_funnel_events WHERE subject_id = $1) AS all_events`,
        [free.userId],
    )
    return rows[0] as Record<'receipts' | 'snapshots' | 'completed_events' | 'paid_events' | 'all_events', number>
}

beforeAll(async () => {
    db = await freshDatabase()
    free = await seedOwnerOrg(db, { tier: null, name: 'Synthetic Free' })
    await asSuperuser(db)
    await db.query('INSERT INTO public.free_account_subjects(id, verified_at, beta_allowed) VALUES ($1, now(), true)', [free.userId])
    await db.query('INSERT INTO public.free_account_grants(org_id, subject_id) VALUES ($1, $2)', [free.orgId, free.userId])
    await db.query('UPDATE public.free_rollout SET estimation_enabled = true')
})
afterAll(async () => { await db?.end() })

describe('F15 receipt-backed events reconcile with saved results', () => {
    const first = randomUUID(), second = randomUUID()

    it('each successful new costing records one receipt, one snapshot and one calculation_completed keyed by its request', async () => {
        await complete(first, 'first')
        await complete(second, 'second')
        expect(await ledger()).toMatchObject({ receipts: 2, snapshots: 2, completed_events: 2 })
        await asSuperuser(db)
        const { rows } = await db.query(
            "SELECT event_id FROM public.free_funnel_events WHERE subject_id = $1 AND event_name = 'calculation_completed' ORDER BY event_id",
            [free.userId],
        )
        expect(rows.map(row => row.event_id).sort()).toEqual([first, second].sort())
    })

    it('a replay of a saved request is not a second activation', async () => {
        await complete(first, 'first')
        expect(await ledger()).toMatchObject({ receipts: 2, snapshots: 2, completed_events: 2 })
    })

    it('a blocked attempt at zero records nothing: the funnel cannot show blocked need', async () => {
        const before = await ledger()
        const error = await pgError(complete(randomUUID(), 'third'))
        expect(error.message).toBe('FREE_QUOTA_EXHAUSTED')
        expect(await ledger()).toEqual(before)
    })
})

describe('F15 paid activation is the first verified captured payment, once per subject', () => {
    let subscriptionId: string

    it('a failed payment records no activation', async () => {
        await asSuperuser(db)
        const { rows } = await db.query(
            "INSERT INTO public.org_subscriptions(org_id, plan_tier, status, current_start, current_end, razorpay_payment_id) VALUES ($1, 'lite', 'active', now(), now() + interval '365 days', 'pay_synthetic_1') RETURNING id",
            [free.orgId],
        )
        subscriptionId = rows[0].id
        await db.query(
            "INSERT INTO public.subscription_payments(org_id, subscription_id, razorpay_payment_id, amount_paise, status) VALUES ($1, $2, 'pay_synthetic_failed', 100, 'failed')",
            [free.orgId, subscriptionId],
        )
        expect((await ledger()).paid_events).toBe(0)
    })

    it('a captured payment for the active subscription records one activation; a renewal does not add another', async () => {
        await asSuperuser(db)
        await db.query(
            "INSERT INTO public.subscription_payments(org_id, subscription_id, razorpay_payment_id, amount_paise, status, captured_at) VALUES ($1, $2, 'pay_synthetic_1', 100, 'captured', now())",
            [free.orgId, subscriptionId],
        )
        expect((await ledger()).paid_events).toBe(1)
        await db.query("UPDATE public.org_subscriptions SET razorpay_payment_id = 'pay_synthetic_2' WHERE id = $1", [subscriptionId])
        await db.query(
            "INSERT INTO public.subscription_payments(org_id, subscription_id, razorpay_payment_id, amount_paise, status, captured_at) VALUES ($1, $2, 'pay_synthetic_2', 100, 'captured', now())",
            [free.orgId, subscriptionId],
        )
        expect((await ledger()).paid_events).toBe(1)
    })
})

describe('F15 cohort admission is separate from collection', () => {
    it('events are collected for an account that is not analytics_eligible, but the cohort view excludes it', async () => {
        expect((await ledger()).all_events).toBeGreaterThan(0)
        await asServiceRole(db)
        const excluded = await db.query('SELECT coalesce(sum(eligible_signups), 0)::int AS n FROM public.free_cohort_metrics')
        expect(excluded.rows[0].n).toBe(0)

        await asSuperuser(db)
        await db.query('UPDATE public.free_account_subjects SET analytics_eligible = true WHERE id = $1', [free.userId])
        await asServiceRole(db)
        const { rows } = await db.query('SELECT sum(eligible_signups)::int AS eligible, sum(activated_accounts)::int AS activated, sum(quota_hit_accounts)::int AS quota_hits FROM public.free_cohort_metrics')
        // quota_reached comes only from the browser, so a server-only sequence shows none.
        expect(rows[0]).toEqual({ eligible: 1, activated: 1, quota_hits: 0 })
    })
})
