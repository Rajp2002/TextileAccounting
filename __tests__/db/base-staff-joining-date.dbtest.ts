import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { calculateBaseWorkerPayables, type BaseProductionWorker, type BasePayrollSettlement } from '../../lib/base-production-core'
import { basePayrollReview } from '../../lib/base-payroll-review'
import { asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

let db: Db
let today: string, yesterday: string, start: string, earlier: string, later: string
type Fixture = { owner: { userId: string; orgId: string }; worker: string }
async function fixture(): Promise<Fixture> {
    const owner = await seedOwnerOrg(db)
    const worker = randomUUID()
    await asSuperuser(db)
    await db.query(`INSERT INTO public.base_production_workers(id,org_id,name,pay_type,monthly_salary,start_date,rate_per_meter)
        VALUES($1,$2,'Mahesh','fixed_monthly',30000,$3,0)`, [worker, owner.orgId, start])
    return { owner, worker }
}
async function setStart(f: Fixture, day: string) {
    await asUser(db, f.owner.userId, f.owner.orgId)
    return db.query('UPDATE public.base_production_workers SET start_date = $2 WHERE id = $1', [f.worker, day])
}
async function row(f: Fixture) {
    await asSuperuser(db)
    return (await db.query(`SELECT start_date::text AS start, salary_effective_from::text AS effective, salary_history AS history
        FROM public.base_production_workers WHERE id = $1`, [f.worker])).rows[0]
}
async function settle(f: Fixture, end: string) {
    await asSuperuser(db)
    const worker = (await db.query('SELECT to_jsonb(w) AS data FROM public.base_production_workers w WHERE id = $1', [f.worker])).rows[0].data as BaseProductionWorker
    const settlements = (await db.query('SELECT to_jsonb(s) AS data FROM public.base_payroll_settlements s WHERE worker_id = $1', [f.worker])).rows.map((r: { data: BasePayrollSettlement }) => r.data)
    const payable = calculateBaseWorkerPayables({ workers: [{ ...worker, days_off: [] }], entries: [], advances: [], settlements, periodEnd: end })[0]
    await asUser(db, f.owner.userId, f.owner.orgId)
    return (await db.query("SELECT public.settle_base_worker_payroll_reviewed($1,$2,'cash',$3,NULL) AS result", [f.worker, end, JSON.stringify(basePayrollReview(payable, randomUUID()))])).rows[0].result
}
beforeAll(async () => {
    db = await freshDatabase()
    const dates = (await db.query(`SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS today,
        ((now() AT TIME ZONE 'Asia/Kolkata')::date - 1)::text AS yesterday,
        ((now() AT TIME ZONE 'Asia/Kolkata')::date - 20)::text AS start,
        ((now() AT TIME ZONE 'Asia/Kolkata')::date - 40)::text AS earlier,
        ((now() AT TIME ZONE 'Asia/Kolkata')::date - 10)::text AS later`)).rows[0]
    today = dates.today; yesterday = dates.yesterday; start = dates.start; earlier = dates.earlier; later = dates.later
})
afterAll(async () => { await db?.end() })

describe('Fixed-salary joining date', () => {
    it('moves the joining date with its first salary rate', async () => {
        const f = await fixture()
        await setStart(f, earlier)
        expect(await row(f)).toEqual({ start: earlier, effective: earlier, history: [{ effective_from: earlier, monthly_salary: 30000 }] })
        await setStart(f, later)
        expect(await row(f)).toEqual({ start: later, effective: later, history: [{ effective_from: later, monthly_salary: 30000 }] })
    })
    it('keeps a later salary change and refuses a joining date on or after it', async () => {
        const f = await fixture()
        await asUser(db, f.owner.userId, f.owner.orgId)
        await db.query('UPDATE public.base_production_workers SET monthly_salary = 32000, salary_effective_from = $2 WHERE id = $1', [f.worker, today])
        await setStart(f, earlier)
        expect(await row(f)).toEqual({ start: earlier, effective: today, history: [{ effective_from: earlier, monthly_salary: 30000 }, { effective_from: today, monthly_salary: 32000 }] })
        expect((await pgError(setStart(f, today))).code).toBe('22023')
    })
    it('refuses a change after salary is paid, until the payment is reversed', async () => {
        const f = await fixture()
        const paid = await settle(f, yesterday)
        expect((await pgError(setStart(f, earlier))).code).toBe('22023')
        await asUser(db, f.owner.userId, f.owner.orgId)
        await db.query("SELECT public.reverse_base_payroll_settlement($1,'Payment was not made',true)", [paid.settlement_id])
        await setStart(f, earlier)
        expect((await row(f)).start).toBe(earlier)
    })
    it('refuses a later joining date that would leave a day off before employment', async () => {
        const f = await fixture()
        await asUser(db, f.owner.userId, f.owner.orgId)
        await db.query('SELECT public.set_base_staff_day_off($1,$2,true)', [f.worker, start])
        expect((await pgError(setStart(f, later))).code).toBe('22023')
        await setStart(f, earlier)
        expect((await row(f)).start).toBe(earlier)
    })
})
