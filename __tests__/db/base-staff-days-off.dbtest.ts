import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { calculateBaseWorkerPayables, type BaseProductionWorker, type BasePayrollSettlement } from '../../lib/base-production-core'
import { basePayrollReview } from '../../lib/base-payroll-review'
import { asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

let db: Db
let today: string, yesterday: string, twoDaysAgo: string, tomorrow: string, employmentStart: string, beforeEmployment: string
type Fixture = { owner: { userId: string; orgId: string }; worker: string }
async function fixture(payType = 'fixed_monthly', locked = false): Promise<Fixture> {
    const owner = await seedOwnerOrg(db, { locked })
    const worker = randomUUID()
    await asSuperuser(db)
    await db.query(`INSERT INTO public.base_production_workers(id,org_id,name,pay_type,monthly_salary,start_date,rate_per_meter)
        VALUES($1,$2,'Mahesh',$3,$4,$5,$6)`, [worker, owner.orgId, payType, payType === 'fixed_monthly' ? 30000 : 0, employmentStart, payType === 'fixed_monthly' ? 0 : 2])
    return { owner, worker }
}
async function setOff(f: Fixture, day: string, off = true, worker = f.worker) {
    await asUser(db, f.owner.userId, f.owner.orgId)
    return (await db.query('SELECT public.set_base_staff_day_off($1,$2,$3) AS result', [worker, day, off])).rows[0].result
}
async function offDates(f: Fixture) {
    await asSuperuser(db)
    return (await db.query('SELECT off_date::text AS day FROM public.base_staff_days_off WHERE worker_id = $1 ORDER BY off_date', [f.worker])).rows.map((r: { day: string }) => r.day)
}
async function preview(f: Fixture, end = today) {
    await asSuperuser(db)
    const worker = (await db.query('SELECT to_jsonb(w) AS data FROM public.base_production_workers w WHERE id = $1', [f.worker])).rows[0].data as BaseProductionWorker
    const settlements = (await db.query('SELECT to_jsonb(s) AS data FROM public.base_payroll_settlements s WHERE worker_id = $1', [f.worker])).rows.map((r: { data: BasePayrollSettlement }) => r.data)
    const payable = calculateBaseWorkerPayables({ workers: [{ ...worker, days_off: await offDates(f) }], entries: [], advances: [], settlements, periodEnd: end })[0]
    return { payable, expected: basePayrollReview(payable, randomUUID()) }
}
async function settle(f: Fixture, expected: object, end = today) {
    await asUser(db, f.owner.userId, f.owner.orgId)
    return (await db.query("SELECT public.settle_base_worker_payroll_reviewed($1,$2,'cash',$3,NULL) AS result", [f.worker, end, JSON.stringify(expected)])).rows[0].result
}
beforeAll(async () => {
    db = await freshDatabase()
    const dates = (await db.query(`SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS today,
        ((now() AT TIME ZONE 'Asia/Kolkata')::date - 1)::text AS yesterday,
        ((now() AT TIME ZONE 'Asia/Kolkata')::date - 2)::text AS two_days_ago,
        ((now() AT TIME ZONE 'Asia/Kolkata')::date + 1)::text AS tomorrow,
        (date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata') - interval '1 month')::date::text AS start,
        ((date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata') - interval '1 month')::date - 1)::text AS before_start`)).rows[0]
    today = dates.today; yesterday = dates.yesterday; twoDaysAgo = dates.two_days_ago; tomorrow = dates.tomorrow
    employmentStart = dates.start; beforeEmployment = dates.before_start
})
afterAll(async () => { await db?.end() })

describe('Fixed-salary days off', () => {
    it('marks a past day off and back on, idempotently', async () => {
        const f = await fixture()
        expect(await setOff(f, yesterday)).toEqual({ worker_id: f.worker, off_date: yesterday, off: true })
        await setOff(f, yesterday)
        expect(await offDates(f)).toEqual([yesterday])
        expect(await setOff(f, yesterday, false)).toEqual({ worker_id: f.worker, off_date: yesterday, off: false })
        await setOff(f, yesterday, false)
        expect(await offDates(f)).toEqual([])
    })
    it('refuses future days, days outside employment and piece-rate workers', async () => {
        const f = await fixture()
        expect((await pgError(setOff(f, tomorrow))).code).toBe('22023')
        expect((await pgError(setOff(f, beforeEmployment))).code).toBe('22023')
        const piece = await fixture('piece_rate')
        expect((await pgError(setOff(piece, yesterday))).code).toBe('22023')
        await asSuperuser(db)
        await db.query('UPDATE public.base_production_workers SET end_date = $2 WHERE id = $1', [f.worker, yesterday])
        expect((await pgError(setOff(f, today))).code).toBe('22023')
        expect(await offDates(f)).toEqual([])
    })
    it('locks paid days until the payment is reversed', async () => {
        const f = await fixture()
        const first = await settle(f, (await preview(f, yesterday)).expected, yesterday)
        expect((await pgError(setOff(f, twoDaysAgo))).code).toBe('22023')
        expect(await setOff(f, today)).toMatchObject({ off: true })
        await asUser(db, f.owner.userId, f.owner.orgId)
        await db.query("SELECT public.reverse_base_payroll_settlement($1,'Payment was not made',true)", [first.settlement_id])
        expect(await setOff(f, twoDaysAgo)).toMatchObject({ off: true })
    })
    it('locks days inside a completed payroll period', async () => {
        const f = await fixture()
        await asSuperuser(db)
        await db.query("INSERT INTO public.base_payroll_periods(org_id,period_start,period_end,status) VALUES($1,$2,$2,'settled')", [f.owner.orgId, twoDaysAgo])
        expect((await pgError(setOff(f, twoDaysAgo))).code).toBe('22023')
        expect(await setOff(f, yesterday)).toMatchObject({ off: true })
    })
    it('enforces tenancy, Base access, organization locks and no direct writes', async () => {
        const f = await fixture()
        await setOff(f, yesterday)
        const other = await fixture()
        await asUser(db, other.owner.userId, other.owner.orgId)
        expect((await db.query('SELECT * FROM public.base_staff_days_off WHERE worker_id = $1', [f.worker])).rows).toEqual([])
        expect((await pgError(setOff(other, twoDaysAgo, true, f.worker))).code).toBe('23503')
        expect((await pgError(setOff(await fixture('fixed_monthly', true), yesterday))).code).toBe('42501')
        await asUser(db, f.owner.userId, f.owner.orgId)
        expect((await pgError(db.query('INSERT INTO public.base_staff_days_off(org_id,worker_id,off_date,created_by) VALUES($1,$2,$3,$4)', [f.owner.orgId, f.worker, twoDaysAgo, f.owner.userId]))).code).toBe('42501')
        expect((await pgError(db.query('DELETE FROM public.base_staff_days_off WHERE worker_id = $1', [f.worker]))).code).toBe('42501')
        await asSuperuser(db)
        await db.query("UPDATE public.profiles SET role = 'admin' WHERE id = $1", [f.owner.userId])
        expect((await pgError(setOff(f, twoDaysAgo))).code).toBe('42501')
    })
})

describe('Fixed-salary settlement with days off', () => {
    it('pays the reviewed salary minus days off and records the off count on the snapshot line', async () => {
        const f = await fixture()
        const full = (await preview(f)).payable.gross_pay
        await setOff(f, yesterday)
        await setOff(f, twoDaysAgo)
        // Ignored on both sides: before employment, so never paid in the first place.
        await asSuperuser(db)
        await db.query('INSERT INTO public.base_staff_days_off(org_id,worker_id,off_date,created_by) VALUES($1,$2,$3,$4)', [f.owner.orgId, f.worker, beforeEmployment, f.owner.userId])
        const { payable, expected } = await preview(f)
        expect(payable.gross_pay).toBeLessThan(full)
        const result = await settle(f, expected)
        expect(result).toMatchObject({ gross_pay: payable.gross_pay, net_payout: payable.net_payout })
        await asSuperuser(db)
        const lines = (await db.query("SELECT costing_label, gross_pay::float8 AS gross FROM public.base_payroll_settlement_lines WHERE settlement_id = $1 AND source_kind = 'fixed_salary' ORDER BY production_date", [result.settlement_id])).rows
        expect(lines.reduce((sum: number, line: { gross: number }) => sum + line.gross, 0)).toBeCloseTo(payable.gross_pay, 2)
        const offLabels = lines.map((line: { costing_label: string }) => line.costing_label).filter((label: string) => / off\)$/.test(label))
        expect(offLabels.join(' ')).toMatch(yesterday.slice(0, 7) === twoDaysAgo.slice(0, 7) ? /days, 2 off\)$/ : /days, 1 off\)/)
        expect(lines.map((line: { costing_label: string }) => line.costing_label).filter((label: string) => !/ off\)$/.test(label)).every((label: string) => / days\)$/.test(label))).toBe(true)
    })
})
