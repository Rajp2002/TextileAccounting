import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asSuperuser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

// Release 2 (spec 2026-10-30 section C): every new payment row carries the
// live/test mode of the checkout attempt that created its provider order.

let db: Db
let org: { userId: string; orgId: string }

/** One org per attempt: an org may hold only one active checkout intent. */
async function attempt(orderId: string, mode: 'live' | 'test') {
    const buyer = await seedOwnerOrg(db, { tier: null })
    await db.query(`INSERT INTO public.billing_checkout_attempts(org_id,client_request_id,plan_tier,purchase_type,billing_model,base_amount_paise,gst_amount_paise,total_amount_paise,status,provider_order_id,provider_mode)
        VALUES($1,$2,'lite','initial_purchase','upfront_first_year_plus_annual_renewal',254153,45747,299900,'created',$3,$4)`, [buyer.orgId, randomUUID(), orderId, mode])
}
async function payment(orderId: string, mode: string | null = null): Promise<string | null> {
    const { rows } = await db.query(`INSERT INTO public.subscription_payments(org_id,razorpay_payment_id,razorpay_order_id,amount_paise,status,captured_at,provider_mode)
        VALUES($1,$2,$3,299900,'captured',now(),$4) RETURNING provider_mode`, [org.orgId, `pay_${randomUUID()}`, orderId, mode])
    return rows[0].provider_mode
}

beforeAll(async () => {
    db = await freshDatabase()
    org = await seedOwnerOrg(db, { tier: null })
    await asSuperuser(db)
})
afterAll(async () => { await db?.end() })

describe('payment provider mode', () => {
    it('copies the mode from the matching checkout attempt', async () => {
        await attempt('order_live_1', 'live')
        await attempt('order_test_1', 'test')
        expect(await payment('order_live_1')).toBe('live')
        expect(await payment('order_test_1')).toBe('test')
    })

    it('leaves the mode empty when no attempt matches, and keeps an explicit value', async () => {
        expect(await payment('order_unknown')).toBeNull()
        await attempt('order_live_2', 'live')
        expect(await payment('order_live_2', 'test')).toBe('test')
    })

    it('rejects other values', async () => {
        expect((await pgError(payment('order_x', 'sandbox'))).code).toBe('23514')
        expect((await pgError(attempt('order_y', 'sandbox' as 'live')))).toMatchObject({ code: '23514' })
    })
})
