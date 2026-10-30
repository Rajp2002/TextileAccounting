import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asServiceRole, asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

// Release 2 (spec 2026-10-30 section C2): the founder extends unpaid trials before
// go-live, and goes live once; both are audited in the same transaction.

let db: Db, founder: string, session: string
const DAY = 86_400_000
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString()

async function trialOrg(endsInDays: number, paid = false): Promise<{ orgId: string; userId: string; trialId: string }> {
    const org = await seedOwnerOrg(db, { tier: null })
    await asSuperuser(db)
    const trial = await db.query("INSERT INTO public.org_subscriptions(org_id,plan_tier,status,current_start,current_end,is_trial) VALUES($1,'lite','active',now()-interval '40 days',$2,true) RETURNING id", [org.orgId, inDays(endsInDays)])
    if (paid) await db.query("INSERT INTO public.org_subscriptions(org_id,plan_tier,status,current_start,current_end,is_trial,razorpay_payment_id) VALUES($1,'lite','active',now(),now()+interval '365 days',false,$2)", [org.orgId, `pay_${randomUUID()}`])
    return { ...org, trialId: trial.rows[0].id }
}
async function endOf(trialId: string): Promise<number> {
    await asSuperuser(db)
    return new Date((await db.query('SELECT current_end FROM public.org_subscriptions WHERE id=$1', [trialId])).rows[0].current_end).getTime()
}
async function extend(newEnd: string, dryRun: boolean) {
    await asServiceRole(db)
    return (await db.query('SELECT public.admin_extend_trials($1,$2,$3,$4,$5) AS value', [founder, session, newEnd, dryRun, randomUUID()])).rows[0].value
}
async function goLive() {
    await asServiceRole(db)
    return (await db.query('SELECT public.admin_go_live($1,$2,$3) AS value', [founder, session, randomUUID()])).rows[0].value
}
async function summary() {
    await asServiceRole(db)
    return (await db.query('SELECT public.admin_paid_plans_summary($1,$2) AS value', [founder, session])).rows[0].value
}
async function auditCount(action: string): Promise<number> {
    await asSuperuser(db)
    return Number((await db.query('SELECT count(*) FROM private.admin_audit_events WHERE action=$1', [action])).rows[0].count)
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
})
afterAll(async () => { await db?.end() })

describe('paid plans controls', () => {
    let ended: Awaited<ReturnType<typeof trialOrg>>, endingSoon: Awaited<ReturnType<typeof trialOrg>>
    let paidTrial: Awaited<ReturnType<typeof trialOrg>>, endingLater: Awaited<ReturnType<typeof trialOrg>>

    beforeAll(async () => {
        ended = await trialOrg(-1)
        endingSoon = await trialOrg(10)
        endingLater = await trialOrg(50)
        paidTrial = await trialOrg(-5, true)
    })

    it('summary counts unpaid trials ending soon and already ended', async () => {
        expect(await summary()).toEqual({ goLiveAt: null, endingIn14Days: 1, endingIn30Days: 1, alreadyEnded: 1 })
    })

    it('extends only unpaid trials, including ones that already ended; the dry run writes nothing', async () => {
        const before = await endOf(ended.trialId)
        const target = inDays(60)
        expect(await extend(target, true)).toMatchObject({ total: 3, alreadyEnded: 1 })
        expect(await endOf(ended.trialId)).toBe(before)
        expect(await auditCount('paid_plans.trials.extend')).toBe(0)

        expect(await extend(target, false)).toMatchObject({ total: 3, alreadyEnded: 1 })
        expect(await endOf(ended.trialId)).toBe(new Date(target).getTime())
        expect(await endOf(endingSoon.trialId)).toBe(new Date(target).getTime())
        expect(await endOf(endingLater.trialId)).toBe(new Date(target).getTime())
        expect(await endOf(paidTrial.trialId)).toBeLessThan(Date.now())
        expect(await auditCount('paid_plans.trials.extend')).toBe(1)
        await asSuperuser(db)
        expect((await db.query("SELECT status FROM public.org_subscriptions WHERE id=$1", [ended.trialId])).rows[0].status).toBe('active')
    })

    it('refuses past dates, dates more than a year ahead, and non-founders', async () => {
        expect((await pgError(extend(inDays(-1), false))).code).toBe('22023')
        expect((await pgError(extend(inDays(400), false))).code).toBe('22023')
        await asUser(db, ended.userId, ended.orgId)
        expect((await pgError(db.query('SELECT public.admin_extend_trials($1,$2,$3,true,$4)', [founder, session, inDays(30), randomUUID()]))).code).toBe('42501')
    })

    it('go-live moves only unpaid trials ending within 30 days, then refuses a second go-live and further extensions', async () => {
        const soon = await trialOrg(10)
        const later = await trialOrg(50)
        const past = await trialOrg(-7)
        const laterEnd = await endOf(later.trialId), pastEnd = await endOf(past.trialId)
        const result = await goLive()
        expect(result.movedTrials).toBe(1)
        expect(Math.abs(await endOf(soon.trialId) - (new Date(result.goLiveAt).getTime() + 30 * DAY))).toBeLessThan(1000)
        expect(await endOf(later.trialId)).toBe(laterEnd)
        expect(await endOf(past.trialId)).toBe(pastEnd)
        expect(await auditCount('paid_plans.go_live')).toBe(1)
        expect((await summary()).goLiveAt).toBe(result.goLiveAt)
        expect((await pgError(goLive())).code).toBe('55000')
        expect((await pgError(extend(inDays(90), false))).code).toBe('55000')
    })
})
