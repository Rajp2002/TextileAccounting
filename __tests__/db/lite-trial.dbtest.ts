import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connect } from '../../scripts/test-db/cluster.mjs'
import { asServiceRole, asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

// Base suppression and the one-month Lite trial: the trial schema, the
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

    it('start_lite_trial inserts one 30-day Lite trial row and clears eligibility', async () => {
        const owner = await seedFreeOwner()
        const { rows: [started] } = await startTrial(owner.orgId)
        await asSuperuser(db)
        const { rows } = await db.query(
            `SELECT id, plan_tier, status, is_trial, razorpay_subscription_id, razorpay_payment_id,
                    (current_end - current_start) = interval '30 days' AS thirty_days
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
            thirty_days: true,
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
        await second.connect()
        try {
            await asServiceRole(second)
            const results = await Promise.allSettled([
                startTrial(owner.orgId),
                second.query('SELECT public.start_lite_trial($1) AS id', [owner.orgId]),
            ])
            const fulfilled = results.filter(result => result.status === 'fulfilled')
            const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
            expect(fulfilled).toHaveLength(1)
            expect(rejected.map(result => result.reason.message)).toEqual(['LITE_TRIAL_INELIGIBLE'])
            await asSuperuser(db)
            const { rows } = await db.query('SELECT count(*)::int AS trials FROM public.org_subscriptions WHERE org_id = $1 AND is_trial', [owner.orgId])
            expect(rows).toEqual([{ trials: 1 }])
        } finally {
            await second.end()
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

    it('a row with a razorpay_payment_id or a status of active/authenticated/paused/halted/cancelled/completed/expired blocks it', async () => {
        const blockers: { status: string; paymentId: string | null }[] = [
            { status: 'created', paymentId: 'pay_synthetic_created' },
            ...['active', 'authenticated', 'paused', 'halted', 'cancelled', 'completed', 'expired'].map(status => ({ status, paymentId: null })),
        ]
        for (const { status, paymentId } of blockers) {
            const owner = await seedFreeOwner()
            await asSuperuser(db)
            await db.query(
                "INSERT INTO public.org_subscriptions(org_id, plan_tier, status, razorpay_payment_id) VALUES ($1, 'lite', $2, $3)",
                [owner.orgId, status, paymentId],
            )
            expect(await pgError(startTrial(owner.orgId)), `status ${status}, payment id ${paymentId}`).toEqual({
                code: 'P0001',
                message: 'LITE_TRIAL_INELIGIBLE',
            })
        }
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
        const owner = await seedFreeOwner()
        await startTrial(owner.orgId)
        await asSuperuser(db)
        const { rows } = await db.query(
            "SELECT count(*)::int AS events FROM public.free_funnel_events WHERE subject_id = $1 AND event_name = 'paid_activation'",
            [owner.userId],
        )
        expect(rows).toEqual([{ events: 0 }])
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
