import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { calculateBaseWorkerPayables, type BaseProductionWorker, type BaseWorkerAdvance, type BaseWorkerIncentive, type BasePayrollSettlement } from '../../lib/base-production-core'
import { basePayrollReview } from '../../lib/base-payroll-review'
import { asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

let db: Db
let today: string, yesterday: string, tomorrow: string, employmentStart: string, priorMonthStart: string
type Fixture = { owner: { userId: string; orgId: string }; worker: string }
async function fixture(payType = 'fixed_monthly', locked = false): Promise<Fixture> {
    const owner = await seedOwnerOrg(db, { locked })
    const worker = randomUUID()
    await asSuperuser(db)
    await db.query(`INSERT INTO public.base_production_workers(id,org_id,name,pay_type,monthly_salary,start_date,rate_per_meter)
        VALUES($1,$2,'Ramesh',$3,$4,$5,0)`, [worker, owner.orgId, payType, payType === 'fixed_monthly' ? 18000 : 0, employmentStart])
    return { owner, worker }
}
async function create(f: Fixture, amount = 250.25, reference = 'Worksheet 7', id = randomUUID(), start = yesterday, end = today) {
    await asUser(db, f.owner.userId, f.owner.orgId)
    const { rows } = await db.query('SELECT public.create_base_worker_incentive($1,$2,$3,$4,$5,$6) AS result', [f.worker,start,end,amount,reference,id])
    return rows[0].result as { incentive_id: string; idempotent: boolean }
}
async function row(id: string) {
    await asSuperuser(db)
    return (await db.query('SELECT to_jsonb(i) AS data FROM public.base_worker_incentives i WHERE id = $1', [id])).rows[0].data as BaseWorkerIncentive
}
async function review(f: Fixture, id: string, action = 'approve', reason: string | null = null, stamp?: string) {
    const current = await row(id)
    await asUser(db, f.owner.userId, f.owner.orgId)
    const { rows } = await db.query('SELECT public.review_base_worker_incentive($1,$2,$3,$4) AS result', [id,stamp ?? current.updated_at,action,reason])
    return rows[0].result
}
async function preview(f: Fixture, end = today) {
    await asSuperuser(db)
    const worker = (await db.query('SELECT to_jsonb(w) AS data FROM public.base_production_workers w WHERE id = $1', [f.worker])).rows[0].data as BaseProductionWorker
    const incentives = (await db.query('SELECT to_jsonb(i) AS data FROM private.base_payroll_open_incentives($1,$2) i', [f.owner.orgId,f.worker])).rows.map((r: { data: BaseWorkerIncentive }) => r.data)
    const advances = (await db.query('SELECT to_jsonb(a) AS data FROM public.base_worker_advances a WHERE worker_id = $1', [f.worker])).rows.map((r: { data: BaseWorkerAdvance }) => r.data)
    const settlements = (await db.query('SELECT to_jsonb(s) AS data FROM public.base_payroll_settlements s WHERE worker_id = $1', [f.worker])).rows.map((r: { data: BasePayrollSettlement }) => r.data)
    const payable = calculateBaseWorkerPayables({ workers: [worker], entries: [], incentives, advances, settlements, periodEnd: end })[0]
    return { payable, expected: basePayrollReview(payable, randomUUID()) }
}
async function settle(f: Fixture, expected: object, end = today) {
    await asUser(db,f.owner.userId,f.owner.orgId)
    return (await db.query("SELECT public.settle_base_worker_payroll_reviewed($1,$2,'cash',$3,NULL) AS result", [f.worker,end,JSON.stringify(expected)])).rows[0].result
}
async function receipt(settlement: string) {
    await asSuperuser(db)
    return (await db.query("SELECT earning_snapshot FROM public.base_payroll_settlement_lines WHERE settlement_id = $1 AND source_kind = 'manual_incentive'", [settlement])).rows.map((r: { earning_snapshot: object }) => r.earning_snapshot)
}
async function countPaid(f: Fixture) {
    await asSuperuser(db)
    return (await db.query("SELECT count(*)::int AS count FROM public.base_payroll_settlements WHERE worker_id = $1 AND status = 'paid'", [f.worker])).rows[0].count
}
beforeAll(async () => {
    db = await freshDatabase()
    const dates = (await db.query(`SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS today,
        ((now() AT TIME ZONE 'Asia/Kolkata')::date - 1)::text AS yesterday,
        ((now() AT TIME ZONE 'Asia/Kolkata')::date + 1)::text AS tomorrow,
        (date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata') - interval '1 month')::date::text AS start`)).rows[0]
    today = dates.today; yesterday = dates.yesterday; tomorrow = dates.tomorrow
    employmentStart = dates.start; priorMonthStart = dates.start
})
afterAll(async () => { await db?.end() })

describe('Manual incentive entitlements', () => {
    it('creates a draft idempotently, rejects reused requests and duplicate evidence, and stamps owner approval', async () => {
        const f = await fixture(), id = randomUUID()
        expect(await create(f,250.25,'Worksheet 7',id)).toMatchObject({ incentive_id: id, idempotent: false })
        expect(await create(f,250.25,'Worksheet 7',id)).toMatchObject({ incentive_id: id, idempotent: true })
        expect((await pgError(create(f,300,'Worksheet 7',id))).code).toBe('40001')
        expect((await pgError(create(f,250.25,' worksheet 7 '))).code).toBe('23505')
        expect(await row(id)).toMatchObject({ status: 'draft', approved_by: null })
        await review(f,id)
        expect(await row(id)).toMatchObject({ status: 'approved', approved_by: f.owner.userId })
        expect((await row(id)).approved_at).toBeTruthy()
        expect(await review(f,id)).toMatchObject({ idempotent: true })
    })
    it('rejects nonpositive, fractional-paisa, future and unsupported employment dates', async () => {
        const f = await fixture()
        for (const amount of [0,-1,0.001,10000001]) expect((await pgError(create(f,amount))).code).toBe('22023')
        expect((await pgError(create(f,1,'Worksheet',randomUUID(),today,tomorrow))).code).toBe('22023')
        expect((await pgError(create(f,1,'Worksheet',randomUUID(),'2000-01-01',today))).code).toBe('22023')
    })
    it('rejects stale approval and direct edits, even by an authenticated owner', async () => {
        const f = await fixture(), { incentive_id: id } = await create(f)
        expect((await pgError(review(f,id,'approve',null,'2000-01-01T00:00:00Z'))).code).toBe('40001')
        await review(f,id)
        await asUser(db,f.owner.userId,f.owner.orgId)
        expect((await pgError(db.query('UPDATE public.base_worker_incentives SET amount = 500 WHERE id = $1',[id]))).code).toBe('42501')
    })
    it('enforces tenancy, Base access, account role and organization locks', async () => {
        const f = await fixture(), { incentive_id: id } = await create(f)
        const other = await fixture()
        await asUser(db,other.owner.userId,other.owner.orgId)
        expect((await db.query('SELECT id FROM public.base_worker_incentives WHERE id = $1',[id])).rows).toEqual([])
        expect((await pgError(db.query("SELECT public.review_base_worker_incentive($1,now(),'approve',NULL)",[id]))).code).toBe('23503')
        expect((await pgError(create(await fixture('fixed_monthly',true)))).code).toBe('42501')
        await asSuperuser(db)
        await db.query("UPDATE public.profiles SET role = 'supervisor' WHERE id = $1",[f.owner.userId])
        expect((await pgError(create(f,100,'Another source'))).code).toBe('42501')
    })
})
describe('Incentive payroll settlement', () => {
    it('blocks unapproved or partly covered earnings and rolls back the payment', async () => {
        const f = await fixture(), { incentive_id: id } = await create(f)
        expect((await preview(f)).payable.incentive_review_ids).toEqual([id])
        expect((await pgError(settle(f,(await preview(f)).expected))).code).toBe('23514')
        await review(f,id)
        expect((await pgError(settle(f,(await preview(f,yesterday)).expected,yesterday))).code).toBe('23514')
        expect(await countPaid(f)).toBe(0)
    })
    it('matches preview, positive earnings and existing recovery, and freezes the complete receipt', async () => {
        const f = await fixture(), { incentive_id: id } = await create(f)
        await review(f,id)
        await asSuperuser(db)
        await db.query('INSERT INTO public.base_worker_advances(org_id,worker_id,amount,created_by) VALUES($1,$2,50000,$3)',[f.owner.orgId,f.worker,f.owner.userId])
        const { payable, expected } = await preview(f)
        expect(payable.incentive_pay).toBe(250.25)
        const result = await settle(f,expected)
        expect(result).toMatchObject({ gross_pay: payable.gross_pay, advance_deducted: payable.advance_recovery, net_payout: payable.net_payout })
        expect(await settle(f,expected)).toMatchObject({ settlement_id: result.settlement_id, idempotent: true })
        const snapshots = await receipt(result.settlement_id)
        expect(snapshots).toHaveLength(1)
        expect(snapshots[0]).toMatchObject({ id, amount: 250.25, evidence_reference: 'Worksheet 7', approved_by: f.owner.userId, calculation_version: 'manual-incentive-v1', unit: 'amount' })
        await asSuperuser(db)
        expect((await db.query('SELECT sum(gross_pay)::float8 AS gross, sum(meters)::float8 AS meters FROM public.base_payroll_settlement_lines WHERE settlement_id = $1',[result.settlement_id])).rows[0]).toEqual({ gross: payable.gross_pay, meters: 0 })
        expect((await pgError(create(f,100,'Late extra'))).code).toBe('22023')
        expect((await pgError(review(f,id,'void','Recording correction'))).code).toBe('22023')
        expect(await countPaid(f)).toBe(1)
    })
    it('supports piece workers and carries an earlier unpaid service period into the first settlement', async () => {
        const f = await fixture('piece_rate'), { incentive_id: id } = await create(f,35.57,'Prior service',randomUUID(),priorMonthStart,priorMonthStart)
        await review(f,id)
        const { payable, expected } = await preview(f)
        expect(payable).toMatchObject({ period_start: priorMonthStart, base_pay: 0, gross_pay: 35.57 })
        expect(await settle(f,expected)).toMatchObject({ gross_pay: 35.57 })
    })
    it('rejects stale source identity even when a replacement has the same amount', async () => {
        const f = await fixture(), { incentive_id: id } = await create(f)
        await review(f,id)
        const stale = (await preview(f)).expected
        await review(f,id,'void','Replace incorrect worksheet')
        const replacement = await create(f)
        await review(f,replacement.incentive_id)
        expect((await pgError(settle(f,stale))).code).toBe('40001')
        expect(await countPaid(f)).toBe(0)
        expect(await settle(f,(await preview(f)).expected)).toMatchObject({ gross_pay: stale.gross_pay })
    })
    it('restores earnings and recovery after controlled reversal while preserving the original receipt and request guard', async () => {
        const f = await fixture(), { incentive_id: id } = await create(f)
        await review(f,id)
        const expected = (await preview(f)).expected, first = await settle(f,expected), original = await receipt(first.settlement_id)
        await asUser(db,f.owner.userId,f.owner.orgId)
        await db.query("SELECT public.reverse_base_payroll_settlement($1,'Payment was not made',true)",[first.settlement_id])
        expect((await pgError(settle(f,expected))).code).toBe('40001')
        expect((await preview(f)).payable.incentive_pay).toBe(250.25)
        await review(f,id,'void','Correct approved amount')
        const replacement = await create(f,400)
        await review(f,replacement.incentive_id)
        const second = await settle(f,(await preview(f)).expected)
        expect(await receipt(first.settlement_id)).toEqual(original)
        expect(await receipt(second.settlement_id)).toHaveLength(1)
        expect((await receipt(second.settlement_id))[0]).toMatchObject({ id: replacement.incentive_id, amount: 400 })
    })
    it('prevents unresolved entitlements bypassing period completion through client resolution lists', async () => {
        const f = await fixture(), { incentive_id: id } = await create(f)
        await asUser(db,f.owner.userId,f.owner.orgId)
        expect((await pgError(db.query("SELECT public.complete_base_payroll_period($1,$2,$3,$4)",[employmentStart,today,JSON.stringify({ workers: [] }),[f.worker]]))).code).toBe('23514')
        await review(f,id); await settle(f,(await preview(f)).expected)
        await asUser(db,f.owner.userId,f.owner.orgId)
        const result = await db.query("SELECT public.complete_base_payroll_period($1,$2,$3,'{}') AS result",[employmentStart,today,JSON.stringify({ workers: [] })])
        expect(result.rows[0].result).toMatchObject({ success: true, status: 'settled' })
    })
})
