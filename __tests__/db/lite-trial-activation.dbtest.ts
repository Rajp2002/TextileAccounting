import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveBillingPurchase, type BillingSubscriptionRow } from '../../lib/billing-lifecycle'
import { resolveEffectiveSubscription, resolveOrgAccessFromRows, type SubscriptionAccessRow } from '../../lib/subscription-access'
import { asServiceRole, asSuperuser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

// A Lite trial that converts to a paid first year, through the same activation
// RPC chain the payment verification path calls (wrapper -> retired body -> legacy body).

let db: Db

const LITE_FIRST_YEAR_PAISE = 299900
const LITE_RENEWAL_PAISE = 149900

beforeAll(async () => {
    db = await freshDatabase()
})
afterAll(async () => {
    await db?.end()
})

/** An owner holding a Free grant and no subscription rows, as the Free signup leaves them. */
async function seedFreeOwner() {
    const owner = await seedOwnerOrg(db, { tier: null })
    await asServiceRole(db)
    await db.query("SELECT public.provision_free_account($1, $2, now() - interval '1 minute')", [owner.userId, owner.orgId])
    return owner
}

async function startTrial(orgId: string) {
    await asServiceRole(db)
    await db.query('SELECT public.start_lite_trial($1)', [orgId])
}

/** The order row app/api/billing/create-order inserts before the customer pays. */
async function createOrderRow(orgId: string, purchaseType: 'initial_purchase' | 'renewal', amountPaise: number) {
    const orderId = `order_synthetic_${randomUUID()}`
    await asServiceRole(db)
    const { rows: [row] } = await db.query(
        `INSERT INTO public.org_subscriptions(org_id, plan_tier, status, billing_model, razorpay_order_id,
                                              checkout_purchase_type, checkout_amount_paise, checkout_currency)
         VALUES ($1, 'lite', 'created', 'upfront_first_year_plus_annual_renewal', $2, $3, $4, 'INR')
         RETURNING id`,
        [orgId, orderId, purchaseType, amountPaise],
    )
    return { orderId, subscriptionId: row.id as string }
}

/** Captures a payment for an order through the server-only activation wrapper. */
async function activate(orgId: string, orderId: string, purchaseType: 'initial_purchase' | 'renewal', amountPaise: number) {
    await asServiceRole(db)
    const paymentId = `pay_synthetic_${randomUUID()}`
    const { rows: [{ result }] } = await db.query(
        'SELECT public.activate_order_billing_purchase($1, $2, $3, $4, $5, $6, $7, $8) AS result',
        [orgId, orderId, paymentId, amountPaise, 'upi', 'lite', purchaseType, 'INR'],
    )
    return result as { success: boolean; subscription: { id: string }; payment: { razorpay_payment_id: string } }
}

type OrgSubscriptionRow = SubscriptionAccessRow & { id: string; checkout_purchase_type: string | null }

/** The organization's rows shaped as the TypeScript resolvers read them (timestamps as ISO text). */
async function subscriptionRows(orgId: string): Promise<OrgSubscriptionRow[]> {
    await asSuperuser(db)
    const { rows } = await db.query(
        `SELECT id::text AS id, status, plan_tier, is_trial, razorpay_payment_id, checkout_purchase_type,
                to_char(current_start AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS current_start,
                to_char(current_end AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS current_end,
                to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at
         FROM public.org_subscriptions
         WHERE org_id = $1
         ORDER BY created_at, id`,
        [orgId],
    )
    return rows as OrgSubscriptionRow[]
}

describe('a Lite trial converting to a paid first year', () => {
    it('starts a fresh 365-day paid term from the payment date, and the paid row takes over from the trial', async () => {
        const owner = await seedFreeOwner()
        await startTrial(owner.orgId)
        const order = await createOrderRow(owner.orgId, 'initial_purchase', LITE_FIRST_YEAR_PAISE)

        const result = await activate(owner.orgId, order.orderId, 'initial_purchase', LITE_FIRST_YEAR_PAISE)
        expect(result.success).toBe(true)
        expect(result.subscription.id).toBe(order.subscriptionId)

        await asSuperuser(db)
        const { rows: [paid] } = await db.query(
            `SELECT status, is_trial, checkout_purchase_type, razorpay_payment_id,
                    (current_start BETWEEN now() - interval '1 minute' AND now() + interval '1 minute') AS starts_now,
                    (current_end BETWEEN now() + interval '365 days' - interval '1 minute'
                                     AND now() + interval '365 days' + interval '1 minute') AS ends_in_a_year
               FROM public.org_subscriptions WHERE id = $1`,
            [order.subscriptionId],
        )
        expect(paid).toEqual({
            status: 'active',
            is_trial: false,
            checkout_purchase_type: 'initial_purchase',
            razorpay_payment_id: result.payment.razorpay_payment_id,
            starts_now: true,
            ends_in_a_year: true,
        })

        // Read the way the app reads it: the paid row wins and the trial banner has nothing to show.
        const rows = await subscriptionRows(owner.orgId)
        const nowMs = Date.now()
        const access = resolveOrgAccessFromRows({ rows, baseFlag: true, trialFlag: false, nowMs })
        expect(access).toMatchObject({ effectiveTier: 'lite', trialEndsAt: null })
        expect(resolveEffectiveSubscription(rows, nowMs).subscription?.id).toBe(order.subscriptionId)
    })

    it('never prices a trial-only organization as a renewal, and activation refuses renewal pricing for it', async () => {
        const owner = await seedFreeOwner()
        await startTrial(owner.orgId)

        // Lifecycle pricing reads the trial as entitlement, not as paid history.
        const rows = (await subscriptionRows(owner.orgId)) as unknown as BillingSubscriptionRow[]
        expect(resolveBillingPurchase(rows, [], 'lite').purchaseType).toBe('initial_purchase')

        // Even a renewal order cannot activate on the strength of the trial row alone.
        const order = await createOrderRow(owner.orgId, 'renewal', LITE_RENEWAL_PAISE)
        expect(await pgError(activate(owner.orgId, order.orderId, 'renewal', LITE_RENEWAL_PAISE))).toEqual({
            code: '22023',
            message: 'Renewal pricing requires prior paid history for this plan.',
        })
        await asSuperuser(db)
        const { rows: [unchanged] } = await db.query('SELECT status, razorpay_payment_id FROM public.org_subscriptions WHERE id = $1', [order.subscriptionId])
        expect(unchanged).toEqual({ status: 'created', razorpay_payment_id: null })
    })

    it('a real prior paid Lite term still renews from its end date, as before', async () => {
        const owner = await seedOwnerOrg(db, { tier: null })
        await asSuperuser(db)
        const { rows: [prior] } = await db.query(
            `INSERT INTO public.org_subscriptions(org_id, plan_tier, status, current_start, current_end, razorpay_payment_id)
             VALUES ($1, 'lite', 'active', now() - interval '345 days', now() + interval '20 days', $2)
             RETURNING id`,
            [owner.orgId, `pay_synthetic_prior_${randomUUID()}`],
        )
        const order = await createOrderRow(owner.orgId, 'renewal', LITE_RENEWAL_PAISE)

        const result = await activate(owner.orgId, order.orderId, 'renewal', LITE_RENEWAL_PAISE)
        expect(result.success).toBe(true)

        await asSuperuser(db)
        const { rows: [chain] } = await db.query(
            `SELECT (renewal.current_start = prior.current_end) AS chained,
                    (renewal.current_end = prior.current_end + interval '365 days') AS one_more_year,
                    renewal.checkout_purchase_type
               FROM public.org_subscriptions AS renewal, public.org_subscriptions AS prior
              WHERE renewal.id = $1 AND prior.id = $2`,
            [order.subscriptionId, prior.id],
        )
        expect(chain).toEqual({ chained: true, one_more_year: true, checkout_purchase_type: 'renewal' })
    })
})
