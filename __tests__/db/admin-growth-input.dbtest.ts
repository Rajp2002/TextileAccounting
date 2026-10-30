import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asServiceRole, asSuperuser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'
import { growthInputSchema, type GrowthFactory } from '@/lib/admin/growth-input'

// Release 3 (spec 2026-10-30 section F): one founder-only read of raw per-factory facts.

let db: Db, founder: string, session: string
let plain: { userId: string; orgId: string }

async function read(sid = session) {
    await asServiceRole(db)
    const value = (await db.query('SELECT public.admin_growth_input($1,$2,now()) AS value', [founder, sid])).rows[0].value
    return growthInputSchema.parse(value)
}
async function factory(orgId: string): Promise<GrowthFactory | undefined> {
    return (await read()).factories.find(entry => entry.id === orgId)
}

beforeAll(async () => {
    db = await freshDatabase()
    await asSuperuser(db)
    founder = randomUUID(); session = randomUUID()
    await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,'founder-fixture@example.test',now())", [founder])
    await db.query("INSERT INTO public.profiles(id,role) VALUES($1,'admin')", [founder])
    await db.query("INSERT INTO private.platform_founder_grants(user_id,enabled,grant_reason,login_email) VALUES($1,true,'Synthetic isolated DB fixture','founder-fixture@example.test')", [founder])
    await db.query("INSERT INTO auth.sessions(id,user_id,aal) VALUES($1,$2,'aal2')", [session, founder])
    await asServiceRole(db)
    expect((await db.query("SELECT public.admin_founder_session($1,$2,'establish') value", [founder, session])).rows[0].value).toEqual({ allowed: true })
    plain = await seedOwnerOrg(db, { tier: null, name: 'Plain Weaving' })
})
afterAll(async () => { await db?.end() })

describe('admin_growth_input', () => {
    it('returns production factories only, with the documented shape', async () => {
        const marked = await seedOwnerOrg(db, { tier: null })
        const alias = await seedOwnerOrg(db, { tier: null })
        await asSuperuser(db)
        await db.query("INSERT INTO private.admin_org_reporting(org_id,cohort,classification_reason) VALUES($1,'test','Synthetic test account')", [marked.orgId])
        await db.query("UPDATE auth.users SET email='founder-fixture+demo@example.test' WHERE id=$1", [alias.userId])
        await db.query("UPDATE public.profiles SET full_name='Ramesh Patel', phone='+919800000001' WHERE id=$1", [plain.userId])
        const input = await read()
        expect(input.factories.map(entry => entry.id)).toEqual([plain.orgId])
        expect(input.goLiveAt).toBeNull()
        expect(input.factories[0]).toMatchObject({ name: 'Plain Weaving', owner: { name: 'Ramesh Patel', phone: '+919800000001' }, hasFreeGrant: false })
    })

    it('includes only live payments and issued refunds', async () => {
        await asSuperuser(db)
        const sub = (await db.query("INSERT INTO public.org_subscriptions(org_id,plan_tier,status,current_start,current_end,is_trial,razorpay_payment_id,checkout_purchase_type) VALUES($1,'lite','active',now(),now()+interval '365 days',false,'pay_live','initial_purchase') RETURNING id", [plain.orgId])).rows[0].id
        const pay = (mode: string | null, id: string) => db.query("INSERT INTO public.subscription_payments(org_id,subscription_id,razorpay_payment_id,amount_paise,status,captured_at,provider_mode) VALUES($1,$2,$3,299900,'captured',now(),$4) RETURNING id", [plain.orgId, sub, id, mode])
        const live = (await pay('live', 'pay_live')).rows[0].id
        await pay('test', 'pay_test'); await pay(null, 'pay_unknown')
        await db.query("INSERT INTO public.billing_payment_refunds(org_id,razorpay_payment_id,amount_paise,reason,status,idempotency_key) VALUES($1,'pay_live',50000,'Synthetic','issued','refund-1')", [plain.orgId])
        await db.query("INSERT INTO public.billing_payment_refunds(org_id,razorpay_payment_id,amount_paise,reason,status,idempotency_key) VALUES($1,'pay_test',1000,'Synthetic','pending','refund-2')", [plain.orgId])
        const row = await factory(plain.orgId)
        expect(row?.payments).toEqual([expect.objectContaining({ id: live, subscriptionId: sub, amountPaise: 299900, status: 'captured', planTier: 'lite', purchaseType: 'initial_purchase' })])
        expect(row?.refunds).toEqual([expect.objectContaining({ paymentId: live, amountPaise: 50000 })])
    })

    it('aggregates activity by India month and early days', async () => {
        await asSuperuser(db)
        const today = (await db.query("SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date AS day")).rows[0].day
        await db.query(`INSERT INTO private.account_activity_days(org_id,user_id,day,active_minutes,area_minutes,phone_minutes,installed_minutes,last_flush_at)
            VALUES($1,$2,(now() AT TIME ZONE 'Asia/Kolkata')::date,12,'{"estimator":10,"rate_book":2}',12,12,now()),
                  ($1,$2,(now() AT TIME ZONE 'Asia/Kolkata')::date - 1,8,'{"estimator":8}',0,0,now())`, [plain.orgId, plain.userId])
        const row = await factory(plain.orgId)
        expect(row?.activity.minutesLast30).toBe(20)
        expect(row?.activity.earlyDays).toHaveLength(2)
        expect(row?.activity.lastSeenAt).toBeTruthy()
        const months = row!.activity.months
        expect(months.reduce((sum, month) => sum + month.minutes, 0)).toBe(20)
        expect(months.reduce((sum, month) => sum + (month.areas.estimator ?? 0), 0)).toBe(18)
        expect(months.reduce((sum, month) => sum + month.phone, 0)).toBe(12)
        expect((await read()).trackingSince).toBeTruthy()
        expect(today).toBeTruthy()
    })

    it('maps Free funnel signals through shared grants to each factory', async () => {
        const free = await seedOwnerOrg(db, { tier: null })
        const second = await seedOwnerOrg(db, { tier: null })
        await asSuperuser(db)
        await db.query('INSERT INTO public.free_account_subjects(id,verified_at,beta_allowed) VALUES($1,now(),true)', [free.userId])
        await db.query('INSERT INTO public.free_account_grants(org_id,subject_id) VALUES($1,$3),($2,$3)', [free.orgId, second.orgId, free.userId])
        await db.query("INSERT INTO public.free_funnel_events(subject_id,event_id,event_name) VALUES($1,$2,'quota_reached')", [free.userId, randomUUID()])
        const input = await read()
        for (const orgId of [free.orgId, second.orgId]) {
            const row = input.factories.find(entry => entry.id === orgId)
            expect(row?.hasFreeGrant).toBe(true)
            expect(row?.freeSignals.map(signal => signal.event)).toEqual(['quota_reached'])
        }
    })

    it('refuses a non-founder session', async () => {
        expect((await pgError(read(randomUUID()))).code).toBe('42501')
    })
})
