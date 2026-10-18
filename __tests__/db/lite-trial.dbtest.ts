import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connect } from '../../scripts/test-db/cluster.mjs'
import { asServiceRole, asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'
import { hasEstablishedPaidHistory } from '../../lib/subscription-access'

// Base suppression and the three-month (90-day) Lite trial: the trial schema, the
// start_lite_trial RPC and the plan-flag guard, against the replayed migrations.

let db: Db

type Owner = { userId: string; orgId: string }

/** An owner holding a Free grant and no subscription rows: the state start_lite_trial needs. */
async function seedFreeOwner(): Promise<Owner> {
    const owner = await seedOwnerOrg(db, { tier: null })
    await asServiceRole(db)
    await db.query("SELECT public.provision_free_account($1, $2, now() - interval '1 minute')", [owner.userId, owner.orgId])
    return owner
}

async function startTrial(orgId: string) {
    await asServiceRole(db)
    return db.query('SELECT public.start_lite_trial($1) AS id', [orgId])
}

type RowShape = { status: string; paymentId: string | null; start?: boolean; end?: boolean; isTrial?: boolean }

/** Paid-history rows as checkout, webhook and dismissal leave them; `start`/`end` set the period dates. */
const paidHistoryRows: RowShape[] = [
    { status: 'created', paymentId: 'pay_synthetic_created' },
    ...['active', 'authenticated', 'completed', 'expired'].map(status => ({ status, paymentId: null })),
    ...['paused', 'halted', 'cancelled'].map(status => ({ status, paymentId: null, start: true, end: true })),
]

function describeRow(row: RowShape) {
    return JSON.stringify(row)
}

async function insertSubscriptionRow(orgId: string, row: RowShape) {
    await asSuperuser(db)
    await db.query(
        `INSERT INTO public.org_subscriptions(org_id, plan_tier, status, razorpay_payment_id, current_start, current_end, is_trial)
         VALUES ($1, 'lite', $2, $3,
                 CASE WHEN $4::boolean THEN now() - interval '1 day' END,
                 CASE WHEN $5::boolean THEN now() + interval '30 days' END,
                 $6::boolean)`,
        [orgId, row.status, row.paymentId, row.start ?? false, row.end ?? false, row.isTrial ?? false],
    )
}

async function provisionFree(owner: Owner) {
    await asServiceRole(db)
    return db.query("SELECT public.provision_free_account($1, $2, now() - interval '1 minute')", [owner.userId, owner.orgId])
}

/** Resolves once the backend is blocked on a lock; fails if that does not happen within five seconds. */
async function waitUntilBlockedOnLock(monitor: Db, pid: number) {
    const deadline = Date.now() + 5_000
    for (;;) {
        const { rows } = await monitor.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1', [pid])
        if (rows[0]?.wait_event_type === 'Lock') return
        if (Date.now() > deadline) throw new Error(`backend ${pid} did not wait on a lock within five seconds`)
        await new Promise(resolve => setTimeout(resolve, 25))
    }
}

beforeAll(async () => {
    db = await freshDatabase()
})
afterAll(async () => {
    await db?.end()
})

describe('Base suppression and Lite trial schema', () => {
    it('risk gate: an org with a Free grant and an active Lite row reads and writes business tables as its owner', async () => {
        const owner = await seedFreeOwner()
        await asSuperuser(db)
        await db.query(
            "INSERT INTO public.org_subscriptions(org_id, plan_tier, status, current_start, current_end) VALUES ($1, 'lite', 'active', now() - interval '1 day', now() + interval '30 days')",
            [owner.orgId],
        )
        await asUser(db, owner.userId, owner.orgId)
        const inserted = await db.query(
            "INSERT INTO public.estimator_templates(org_id, name) VALUES ($1, 'Risk gate template') RETURNING name",
            [owner.orgId],
        )
        expect(inserted.rows).toEqual([{ name: 'Risk gate template' }])
        const read = await db.query("SELECT name FROM public.estimator_templates WHERE name = 'Risk gate template'")
        expect(read.rows).toEqual([{ name: 'Risk gate template' }])
    })

    it('start_lite_trial inserts one 90-day Lite trial row and clears eligibility', async () => {
        const owner = await seedFreeOwner()
        const { rows: [started] } = await startTrial(owner.orgId)
        await asSuperuser(db)
        const { rows } = await db.query(
            `SELECT id, plan_tier, status, is_trial, razorpay_subscription_id, razorpay_payment_id,
                    (current_end - current_start) = interval '90 days' AS ninety_days
               FROM public.org_subscriptions WHERE org_id = $1`,
            [owner.orgId],
        )
        expect(rows).toEqual([{
            id: started.id,
            plan_tier: 'lite',
            status: 'active',
            is_trial: true,
            razorpay_subscription_id: null,
            razorpay_payment_id: null,
            ninety_days: true,
        }])
        const { rows: [org] } = await db.query('SELECT lite_trial_eligible FROM public.organizations WHERE id = $1', [owner.orgId])
        expect(org).toEqual({ lite_trial_eligible: false })
    })

    it('a second start_lite_trial raises LITE_TRIAL_INELIGIBLE', async () => {
        const owner = await seedFreeOwner()
        await startTrial(owner.orgId)
        expect(await pgError(startTrial(owner.orgId))).toEqual({ code: 'P0001', message: 'LITE_TRIAL_INELIGIBLE' })
        // Even if eligibility were bypassed, the partial unique index allows only one trial row per org.
        await asSuperuser(db)
        const duplicate = await pgError(db.query(
            "INSERT INTO public.org_subscriptions(org_id, plan_tier, status, current_start, current_end, is_trial) VALUES ($1, 'lite', 'active', now(), now() + interval '30 days', true)",
            [owner.orgId],
        ))
        expect(duplicate.code).toBe('23505')
    })

    it('two concurrent start_lite_trial calls create exactly one trial row', async () => {
        const owner = await seedFreeOwner()
        const params = db.connectionParameters
        const second = connect({ host: params.host, port: params.port, database: params.database })
        const monitor = connect({ host: params.host, port: params.port, database: params.database })
        await second.connect()
        await monitor.connect()
        try {
            await asServiceRole(db)
            await asServiceRole(second)
            // Connection A starts the trial inside an open transaction and keeps the organization row lock until it commits.
            await db.query('BEGIN')
            const first = await db.query('SELECT public.start_lite_trial($1) AS id', [owner.orgId])
            // Connection B's start is sent only after A holds the lock, so it must block until A commits.
            const { rows: [{ pid }] } = await second.query('SELECT pg_backend_pid() AS pid')
            const secondStart = second.query('SELECT public.start_lite_trial($1) AS id', [owner.orgId])
            secondStart.catch(() => undefined)
            await waitUntilBlockedOnLock(monitor, pid)
            await db.query('COMMIT')
            expect(await pgError(secondStart)).toEqual({ code: 'P0001', message: 'LITE_TRIAL_INELIGIBLE' })
            await asSuperuser(db)
            const { rows } = await db.query('SELECT id FROM public.org_subscriptions WHERE org_id = $1 AND is_trial', [owner.orgId])
            expect(rows).toEqual([{ id: first.rows[0].id }])
        } finally {
            // Release the lock if the race failed part-way (ROLLBACK after COMMIT only warns), then close the extra connections.
            await db.query('ROLLBACK').catch(() => undefined)
            await second.end()
            await monitor.end()
        }
    })

    it('start_lite_trial without a Free grant raises LITE_TRIAL_FREE_GRANT_REQUIRED', async () => {
        const owner = await seedOwnerOrg(db, { tier: null })
        expect(await pgError(startTrial(owner.orgId))).toEqual({ code: 'P0001', message: 'LITE_TRIAL_FREE_GRANT_REQUIRED' })
    })

    it('an abandoned created checkout row does not block the trial', async () => {
        const owner = await seedFreeOwner()
        await asSuperuser(db)
        await db.query("INSERT INTO public.org_subscriptions(org_id, plan_tier, status) VALUES ($1, 'lite', 'created')", [owner.orgId])
        await expect(startTrial(owner.orgId)).resolves.toMatchObject({ rowCount: 1 })
    })

    it('a row with a razorpay_payment_id, an active/authenticated/completed/expired status, or a paused/halted/cancelled status with dates blocks it', async () => {
        for (const row of paidHistoryRows) {
            const owner = await seedFreeOwner()
            await insertSubscriptionRow(owner.orgId, row)
            expect(await pgError(startTrial(owner.orgId)), describeRow(row)).toEqual({ code: 'P0001', message: 'LITE_TRIAL_INELIGIBLE' })
        }
    })

    it('dismissed or abandoned checkouts without a payment id or dates do not block the trial', async () => {
        for (const status of ['created', 'paused', 'halted', 'cancelled']) {
            const owner = await seedFreeOwner()
            await insertSubscriptionRow(owner.orgId, { status, paymentId: null })
            await expect(startTrial(owner.orgId), `status ${status}`).resolves.toMatchObject({ rowCount: 1 })
        }
    })

    it('provision_free_account refuses an organization with established paid history', async () => {
        for (const row of paidHistoryRows) {
            const owner = await seedOwnerOrg(db, { tier: null })
            await insertSubscriptionRow(owner.orgId, row)
            expect(await pgError(provisionFree(owner)), describeRow(row)).toEqual({ code: 'P0001', message: 'FREE_EXISTING_ACCOUNT' })
        }
    })

    it('provision_free_account succeeds after a dismissed or abandoned checkout with no grant', async () => {
        for (const status of ['created', 'paused', 'halted', 'cancelled']) {
            const owner = await seedOwnerOrg(db, { tier: null })
            await insertSubscriptionRow(owner.orgId, { status, paymentId: null })
            await provisionFree(owner)
            await asSuperuser(db)
            const { rows } = await db.query('SELECT count(*)::int AS grants FROM public.free_account_grants WHERE org_id = $1', [owner.orgId])
            expect(rows, `status ${status}`).toEqual([{ grants: 1 }])
        }
    })

    it('the shared paid-history predicate matches hasEstablishedPaidHistory for every row shape', async () => {
        const statuses = ['created', 'pending', 'authenticated', 'active', 'paused', 'halted', 'cancelled', 'completed', 'expired', 'failed']
        const dateCombinations = [
            { start: false, end: false },
            { start: true, end: false },
            { start: false, end: true },
            { start: true, end: true },
        ]
        const shapes: RowShape[] = []
        for (const status of statuses) {
            for (const dates of dateCombinations) {
                for (const paymentId of [null, '', `pay_synthetic_${randomUUID()}`]) {
                    shapes.push({ status, paymentId, ...dates })
                }
                // Trial rows carry no Razorpay ids (database shape check), so only the null id applies to them.
                shapes.push({ status, paymentId: null, ...dates, isTrial: true })
            }
        }
        expect(shapes).toHaveLength(statuses.length * dateCombinations.length * 4)

        for (const shape of shapes) {
            const owner = await seedOwnerOrg(db, { tier: null })
            await insertSubscriptionRow(owner.orgId, shape)
            await asServiceRole(db)
            const { rows: [{ paid }] } = await db.query('SELECT public.org_has_established_paid_history($1) AS paid', [owner.orgId])
            const tsRow = {
                status: shape.status,
                plan_tier: 'lite',
                current_start: shape.start ? '2026-10-01T00:00:00.000Z' : null,
                current_end: shape.end ? '2026-11-01T00:00:00.000Z' : null,
                razorpay_payment_id: shape.paymentId,
                is_trial: shape.isTrial ?? false,
            }
            expect(paid, describeRow(shape)).toBe(hasEstablishedPaidHistory([tsRow]))
        }
    })

    it('authenticated users cannot call the shared paid-history predicate', async () => {
        const owner = await seedOwnerOrg(db, { tier: null })
        await asUser(db, owner.userId, owner.orgId)
        expect((await pgError(db.query('SELECT public.org_has_established_paid_history($1)', [owner.orgId]))).code).toBe('42501')
    })

    it('authenticated users cannot execute start_lite_trial or change the plan flags', async () => {
        const owner = await seedFreeOwner()
        await asUser(db, owner.userId, owner.orgId)
        expect((await pgError(db.query('SELECT public.start_lite_trial($1)', [owner.orgId]))).code).toBe('42501')
        // Positive control: the owner's own UPDATE succeeds, so the refusals below come from the flag guard.
        const renamed = await db.query("UPDATE public.organizations SET name = 'Renamed by owner' WHERE id = $1", [owner.orgId])
        expect(renamed.rowCount).toBe(1)
        expect((await pgError(db.query('UPDATE public.organizations SET base_plan_visible = true WHERE id = $1', [owner.orgId]))).code).toBe('42501')
        // Eligibility starts true, so setting it false is a real change (setting it true again would be a no-op).
        expect((await pgError(db.query('UPDATE public.organizations SET lite_trial_eligible = false WHERE id = $1', [owner.orgId]))).code).toBe('42501')
        await asServiceRole(db)
        await db.query('UPDATE public.organizations SET base_plan_visible = true WHERE id = $1', [owner.orgId])
        const { rows } = await db.query('SELECT base_plan_visible FROM public.organizations WHERE id = $1', [owner.orgId])
        expect(rows).toEqual([{ base_plan_visible: true }])
    })

    it('a trial row does not create a paid_activation funnel event', async () => {
        // The paid_activation trigger lives on subscription_payments, so this asserts that the trial row has no side effect.
        const owner = await seedFreeOwner()
        await startTrial(owner.orgId)
        await asSuperuser(db)
        const { rows } = await db.query(
            "SELECT count(*)::int AS events FROM public.free_funnel_events WHERE subject_id = $1 AND event_name = 'paid_activation'",
            [owner.userId],
        )
        expect(rows).toEqual([{ events: 0 }])

        // Positive control: a captured payment on a paid Lite row does create the event, so the query above can see one.
        const paid = await seedFreeOwner()
        await asSuperuser(db)
        const paymentId = `pay_control_${randomUUID()}`
        const { rows: [subscription] } = await db.query(
            "INSERT INTO public.org_subscriptions(org_id, plan_tier, status, current_start, current_end, razorpay_payment_id) VALUES ($1, 'lite', 'active', now() - interval '1 day', now() + interval '30 days', $2) RETURNING id",
            [paid.orgId, paymentId],
        )
        await db.query(
            "INSERT INTO public.subscription_payments(org_id, subscription_id, razorpay_payment_id, amount_paise, status) VALUES ($1, $2, $3, 299900, 'captured')",
            [paid.orgId, subscription.id, paymentId],
        )
        const control = await db.query(
            "SELECT count(*)::int AS events FROM public.free_funnel_events WHERE subject_id = $1 AND event_name = 'paid_activation'",
            [paid.userId],
        )
        expect(control.rows).toEqual([{ events: 1 }])
    })

    it('new organizations default to base_plan_visible false and lite_trial_eligible true', async () => {
        const owner = await seedOwnerOrg(db, { tier: null })
        await asSuperuser(db)
        const { rows } = await db.query('SELECT base_plan_visible, lite_trial_eligible FROM public.organizations WHERE id = $1', [owner.orgId])
        expect(rows).toEqual([{ base_plan_visible: false, lite_trial_eligible: true }])
    })

    it('is_trial rows must be Lite without Razorpay ids', async () => {
        const owner = await seedOwnerOrg(db, { tier: null })
        await asSuperuser(db)
        const insertTrial = (planTier: string, paymentId: string | null, subscriptionId: string | null) => db.query(
            `INSERT INTO public.org_subscriptions(org_id, plan_tier, status, current_start, current_end, is_trial, razorpay_payment_id, razorpay_subscription_id)
             VALUES ($1, $2, 'active', now(), now() + interval '30 days', true, $3, $4)`,
            [owner.orgId, planTier, paymentId, subscriptionId],
        )
        expect((await pgError(insertTrial('base', null, null))).code).toBe('23514')
        expect((await pgError(insertTrial('lite', `pay_${randomUUID()}`, null))).code).toBe('23514')
        expect((await pgError(insertTrial('lite', null, `sub_${randomUUID()}`))).code).toBe('23514')
    })
})
