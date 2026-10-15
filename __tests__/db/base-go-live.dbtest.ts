import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { calculateBaseWorkerPayables, type BasePayrollSettlement, type BaseProductionWorker } from '../../lib/base-production-core'
import { basePayrollReview } from '../../lib/base-payroll-review'
import { asServiceRole, asSuperuser, asSupervisor, asUser, freshDatabase, pgError, seedOwnerOrg, seedSupervisor, type Db } from './helpers'

let db: Db
let today: string
const plusDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)

async function goLiveOf(orgId: string) {
    await asSuperuser(db)
    return (await db.query('SELECT base_go_live_date::text AS go_live, base_go_live_set_by AS set_by FROM public.organizations WHERE id = $1', [orgId])).rows[0]
}
async function schedule(orgId: string, goLive: string, actor: string) {
    await asServiceRole(db)
    return (await db.query('SELECT public.schedule_base_go_live($1, $2, $3)::text AS go_live', [orgId, goLive, actor])).rows[0].go_live
}
/** Raw rows with triggers and foreign keys off, as a migration backfill would find them. */
async function raw(sql: string, params: unknown[]) {
    await asSuperuser(db)
    await db.query("SET session_replication_role = 'replica'")
    try { await db.query(sql, params) } finally { await db.query("SET session_replication_role = 'origin'") }
}

beforeAll(async () => {
    db = await freshDatabase()
    today = (await db.query("SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS today")).rows[0].today
})
afterAll(async () => { await db?.end() })

describe('schedule_base_go_live', () => {
    it('schedules a future boundary and moves the cycle start', async () => {
        const owner = await seedOwnerOrg(db, { goLive: null })
        await asSuperuser(db)
        await db.query("INSERT INTO public.base_payroll_cycle_configs(org_id, cycle_type, rule, effective_from) VALUES ($1, 'monthly', '{\"type\":\"monthly\",\"anchorDay\":1}', $2)", [owner.orgId, today])
        const goLive = plusDays(today, 10)
        expect(await schedule(owner.orgId, goLive, owner.userId)).toBe(goLive)
        expect(await goLiveOf(owner.orgId)).toEqual({ go_live: goLive, set_by: owner.userId })
        await asSuperuser(db)
        const config = (await db.query('SELECT effective_from::text AS start FROM public.base_payroll_cycle_configs WHERE org_id = $1 AND effective_until IS NULL', [owner.orgId])).rows[0]
        expect(config.start).toBe(goLive)
    })
    it('reschedules while go-live is still ahead', async () => {
        const owner = await seedOwnerOrg(db, { goLive: plusDays(today, 5) })
        expect(await schedule(owner.orgId, plusDays(today, 35), owner.userId)).toBe(plusDays(today, 35))
    })
    it('refuses a past date', async () => {
        const owner = await seedOwnerOrg(db, { goLive: null })
        expect((await pgError(schedule(owner.orgId, plusDays(today, -1), owner.userId))).code).toBe('22023')
    })
    it('refuses once go-live has passed', async () => {
        const owner = await seedOwnerOrg(db, { goLive: today })
        expect((await pgError(schedule(owner.orgId, plusDays(today, 30), owner.userId))).code).toBe('55000')
    })
    it('refuses when production exists', async () => {
        const goLive = plusDays(today, 10)
        const owner = await seedOwnerOrg(db, { goLive })
        await asSuperuser(db)
        await db.query('INSERT INTO public.base_production_batches(org_id, production_date, client_request_id) VALUES ($1, $2, $3)', [owner.orgId, goLive, randomUUID()])
        expect((await pgError(schedule(owner.orgId, plusDays(today, 40), owner.userId))).code).toBe('55000')
    })
    it('refuses authenticated callers', async () => {
        const owner = await seedOwnerOrg(db, { goLive: null })
        await asUser(db, owner.userId, owner.orgId)
        const error = await pgError(db.query('SELECT public.schedule_base_go_live($1, $2, $3)', [owner.orgId, plusDays(today, 10), owner.userId]))
        expect(error.code).toBe('42501')
    })
})

describe('private.backfill_base_go_live', () => {
    it('backfills from the earliest Base record of any kind', async () => {
        const production = await seedOwnerOrg(db, { goLive: null })
        await raw('INSERT INTO public.base_production_batches(org_id, production_date, client_request_id) VALUES ($1, $2, $3)', [production.orgId, '2026-09-10', randomUUID()])
        // An assignment older than the first production (Undo re-inserts such rows).
        await raw("INSERT INTO public.base_worker_machine_assignments(org_id, worker_id, machine_id, shift, active, effective_from) VALUES ($1, $2, $3, 'day', true, '2026-09-02')", [production.orgId, randomUUID(), randomUUID()])
        const fixedOnly = await seedOwnerOrg(db, { goLive: null })
        await raw("INSERT INTO public.base_payroll_settlements(org_id, worker_id, worker_name_snapshot, advance_balance_before, remaining_advance_balance, period_start, period_end, gross_pay, payment_mode) VALUES ($1, $2, 'Mahesh', 0, 0, '2026-08-01', '2026-08-31', 30000, 'cash')", [fixedOnly.orgId, randomUUID()])
        const daysOff = await seedOwnerOrg(db, { goLive: null })
        await raw("INSERT INTO public.base_staff_days_off(org_id, worker_id, off_date, created_by) VALUES ($1, $2, '2026-09-05', $3)", [daysOff.orgId, randomUUID(), daysOff.userId])
        const empty = await seedOwnerOrg(db, { goLive: null })
        const kept = await seedOwnerOrg(db, { goLive: '2026-07-01' })
        await raw('INSERT INTO public.base_production_batches(org_id, production_date, client_request_id) VALUES ($1, $2, $3)', [kept.orgId, '2026-09-10', randomUUID()])

        await asSuperuser(db)
        await db.query('SELECT private.backfill_base_go_live()')
        expect((await goLiveOf(production.orgId)).go_live).toBe('2026-09-02')
        expect((await goLiveOf(fixedOnly.orgId)).go_live).toBe('2026-08-01')
        expect((await goLiveOf(daysOff.orgId)).go_live).toBe('2026-09-05')
        expect((await goLiveOf(empty.orgId)).go_live).toBeNull()
        expect((await goLiveOf(kept.orgId)).go_live).toBe('2026-07-01')
    })
})

describe('get_supervisor_go_live', () => {
    it('tells an approved supervisor the go-live date', async () => {
        const owner = await seedOwnerOrg(db, { goLive: plusDays(today, 12) })
        const supervisor = await seedSupervisor(db, owner.orgId)
        await asSupervisor(db, supervisor.userId)
        const result = (await db.query('SELECT public.get_supervisor_go_live()::text AS go_live')).rows[0]
        expect(result.go_live).toBe(plusDays(today, 12))
    })
})

type Factory = { owner: { userId: string; orgId: string }; job: string; worker: string; fixed: string; machine: string }

/** A set-up factory: rows are written while unscheduled, then go-live is set, as the setup phase does. */
async function factory(goLive: string | null): Promise<Factory> {
    const owner = await seedOwnerOrg(db, { goLive: null })
    const ids = { costing: randomUUID(), job: randomUUID(), worker: randomUUID(), fixed: randomUUID(), machine: randomUUID() }
    await asSuperuser(db)
    await db.query(
        `INSERT INTO public.estimator_quotes(id, org_id, record_kind, quality_label, yarn_denier, meters, yarn_rate_per_kg,
            landed_cost_per_meter, quote_price_per_meter, intended_margin_percent, worker_rate_per_m)
         VALUES ($1, $2, 'costing', 'Cotton', 100, 1000, 100, 20, 40, 50, 2)`, [ids.costing, owner.orgId])
    await db.query("INSERT INTO public.base_production_jobs(id, org_id, costing_id, quality_label, target_meters, start_date, status, worker_rate_per_meter) VALUES ($1, $2, $3, 'Cotton', 10000, '2026-08-01', 'active', 2)", [ids.job, owner.orgId, ids.costing])
    await db.query("INSERT INTO public.base_production_workers(id, org_id, name, rate_per_meter, shift_availability) VALUES ($1, $2, 'Weaver One', 2, 'both')", [ids.worker, owner.orgId])
    await db.query("INSERT INTO public.base_production_workers(id, org_id, name, pay_type, monthly_salary, start_date, rate_per_meter) VALUES ($1, $2, 'Mahesh', 'fixed_monthly', 30000, '2026-08-01', 0)", [ids.fixed, owner.orgId])
    await db.query("INSERT INTO public.base_production_machines(id, org_id, name, machine_type) VALUES ($1, $2, 'Loom 1', 'power_loom')", [ids.machine, owner.orgId])
    await db.query("INSERT INTO public.base_worker_machine_assignments(org_id, worker_id, machine_id, shift, effective_from) VALUES ($1, $2, $3, 'day', '2026-08-01')", [owner.orgId, ids.worker, ids.machine])
    await db.query("INSERT INTO public.base_machine_job_contexts(org_id, machine_id, job_id, effective_from) VALUES ($1, $2, $3, '2026-08-01')", [owner.orgId, ids.machine, ids.job])
    if (goLive) await db.query('UPDATE public.organizations SET base_go_live_date = $2 WHERE id = $1', [owner.orgId, goLive])
    return { owner, ...ids }
}
async function ownerSave(f: Factory, date: string) {
    await asUser(db, f.owner.userId, f.owner.orgId)
    const entries = [{ worker_id: f.worker, entry_status: 'entered', meters: 40, allocations: [{ machine_id: f.machine, job_id: f.job, meters: 40 }], machine_records: [{ machine_id: f.machine, state: 'entered' }] }]
    return (await db.query("SELECT public.save_base_daily_production_reviewed($1, 'day', $2, $3, NULL, NULL) AS result", [date, randomUUID(), JSON.stringify(entries)])).rows[0].result
}
async function asOwner(f: Factory, sql: string, params: unknown[]) {
    await asUser(db, f.owner.userId, f.owner.orgId)
    return db.query(sql, params)
}

describe('guards before go-live', () => {
    it('refuses production before go-live and without one', async () => {
        const setup = await factory(plusDays(today, 7))
        const before = await pgError(ownerSave(setup, today))
        expect(before.code).toBe('22023')
        expect(before.message).toContain('Daily recording starts on')
        const unscheduled = await factory(null)
        const none = await pgError(ownerSave(unscheduled, today))
        expect(none.code).toBe('22023')
        expect(none.message).toContain('Schedule daily recording')
    })
    it('accepts production on go-live day', async () => {
        const live = await factory(today)
        expect(await ownerSave(live, today)).toMatchObject({ batch_id: expect.any(String) })
    })
    it('refuses assignments, qualities and rotations before go-live', async () => {
        const goLive = plusDays(today, 7)
        const f = await factory(goLive)
        const machine = randomUUID()
        await asSuperuser(db)
        await db.query("INSERT INTO public.base_production_machines(id, org_id, name, machine_type) VALUES ($1, $2, 'Loom 2', 'power_loom')", [machine, f.owner.orgId])
        expect((await pgError(asOwner(f, 'SELECT public.set_base_machine_job_context($1, $2, $3)', [machine, f.job, today]))).code).toBe('22023')
        await asOwner(f, 'SELECT public.set_base_machine_job_context($1, $2, $3)', [machine, f.job, goLive])
        expect((await pgError(asOwner(f, "SELECT public.upsert_base_worker_machine_assignment($1, $2, 'night', $3, false)", [f.worker, f.machine, today]))).code).toBe('22023')
        await asOwner(f, "SELECT public.upsert_base_worker_machine_assignment($1, $2, 'night', $3, false)", [f.worker, machine, goLive])
        expect((await pgError(asOwner(f, 'SELECT public.rotate_base_worker_shifts($1, $2)', [[f.worker], today]))).code).toBe('22023')
    })
    it('refuses days off and incentives before go-live', async () => {
        const f = await factory(today)
        const yesterday = plusDays(today, -1)
        expect((await pgError(asOwner(f, 'SELECT public.set_base_staff_day_off($1, $2, true)', [f.fixed, yesterday]))).code).toBe('22023')
        expect((await pgError(asOwner(f, 'SELECT public.create_base_worker_incentive($1, $2, $3, 500, $4, $5)', [f.worker, yesterday, yesterday, 'Slip 12', randomUUID()]))).code).toBe('22023')
    })
    it('refuses a supervisor save before go-live', async () => {
        const f = await factory(plusDays(today, 7))
        const supervisor = await seedSupervisor(db, f.owner.orgId)
        await asSupervisor(db, supervisor.userId)
        const entries = [{ worker_id: f.worker, entry_status: 'entered', meters: 40, allocations: [{ machine_id: f.machine, job_id: f.job, meters: 40 }], machine_records: [{ machine_id: f.machine, state: 'entered' }] }]
        const error = await pgError(db.query("SELECT public.save_supervisor_daily_sheet($1, 'day', $2, $3, NULL, NULL)", [today, randomUUID(), JSON.stringify(entries)]))
        expect(error.code).toBe('22023')
    })
})

describe('fixed salary from go-live', () => {
    it('settles fixed salary from go-live', async () => {
        const goLive = (await db.query("SELECT (date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') - interval '1 month')::date::text AS d")).rows[0].d as string
        const owner = await seedOwnerOrg(db, { goLive })
        const worker = randomUUID()
        await asSuperuser(db)
        await db.query("INSERT INTO public.base_production_workers(id, org_id, name, pay_type, monthly_salary, start_date, rate_per_meter) VALUES ($1, $2, 'Mahesh', 'fixed_monthly', 30000, '2019-04-01', 0)", [worker, owner.orgId])
        const row = (await db.query('SELECT to_jsonb(w) AS data FROM public.base_production_workers w WHERE id = $1', [worker])).rows[0].data as BaseProductionWorker
        const payable = calculateBaseWorkerPayables({ workers: [{ ...row, days_off: [] }], entries: [], advances: [], settlements: [] as BasePayrollSettlement[], periodEnd: today, goLiveDate: goLive })[0]
        expect(payable.period_start).toBe(goLive)
        await asUser(db, owner.userId, owner.orgId)
        const result = (await db.query("SELECT public.settle_base_worker_payroll_reviewed($1, $2, 'cash', $3, NULL) AS result", [worker, today, JSON.stringify(basePayrollReview(payable, randomUUID()))])).rows[0].result
        await asSuperuser(db)
        const settlement = (await db.query('SELECT period_start::text AS start, gross_pay::numeric AS gross FROM public.base_payroll_settlements WHERE id = $1', [result.settlement_id])).rows[0]
        expect(settlement.start).toBe(goLive)
        expect(Number(settlement.gross)).toBe(payable.gross_pay)
    })
})

describe('review fixes', () => {
    it('re-dates setup assignments and qualities when go-live moves earlier', async () => {
        const later = plusDays(today, 10)
        const f = await factory(later)
        await asSuperuser(db)
        // Setup rows are dated at the current go-live, as the board and quality dialog write them.
        await db.query("UPDATE public.base_worker_machine_assignments SET effective_from = $2 WHERE org_id = $1", [f.owner.orgId, later])
        await db.query("UPDATE public.base_machine_job_contexts SET effective_from = $2 WHERE org_id = $1", [f.owner.orgId, later])
        const earlier = plusDays(today, 3)
        expect(await schedule(f.owner.orgId, earlier, f.owner.userId)).toBe(earlier)
        await asSuperuser(db)
        const dates = async (table: string) => (await db.query(`SELECT effective_from::text AS d FROM public.${table} WHERE org_id = $1`, [f.owner.orgId])).rows.map((r: { d: string }) => r.d)
        expect(await dates('base_worker_machine_assignments')).toEqual([earlier])
        expect(await dates('base_machine_job_contexts')).toEqual([earlier])
    })
    it('lets only the service role change the go-live columns', async () => {
        const owner = await seedOwnerOrg(db, { goLive: plusDays(today, 10) })
        await asUser(db, owner.userId, owner.orgId)
        expect((await pgError(db.query("UPDATE public.organizations SET base_go_live_date = '2001-01-01' WHERE id = $1", [owner.orgId]))).code).toBe('42501')
        await db.query("UPDATE public.organizations SET name = 'Renamed Works' WHERE id = $1", [owner.orgId])
        expect((await goLiveOf(owner.orgId)).go_live).toBe(plusDays(today, 10))
    })
    it('backfills factories that only have challans, stock movements or fixed staff', async () => {
        const challans = await seedOwnerOrg(db, { goLive: null })
        await raw("INSERT INTO public.delivery_challans(id, org_id, quality_id, quality_label, document, lines, sent_meters, selling_rate, chargeable_meters, created_at) VALUES ($1, $2, $3, 'Cotton', '{}', '[]', 100, 40, 100, '2026-07-10T10:00:00+05:30')", [randomUUID(), challans.orgId, randomUUID()])
        const stock = await seedOwnerOrg(db, { goLive: null })
        await raw("INSERT INTO public.quality_stock_movements(org_id, quality_id, kind, meters_delta, balance_after, reason, created_at) VALUES ($1, $2, 'opening', 100, 100, 'Opening stock', '2026-06-05T23:30:00+05:30')", [stock.orgId, randomUUID()])
        const staff = await seedOwnerOrg(db, { goLive: null })
        // Through the worker triggers (they fill the salary history), not as a raw row.
        await asSuperuser(db)
        await db.query("INSERT INTO public.base_production_workers(id, org_id, name, pay_type, monthly_salary, start_date, rate_per_meter) VALUES ($1, $2, 'Mahesh', 'fixed_monthly', 30000, '2019-04-01', 0)", [randomUUID(), staff.orgId])
        await asSuperuser(db)
        await db.query('SELECT private.backfill_base_go_live()')
        expect((await goLiveOf(challans.orgId)).go_live).toBe('2026-07-10')
        expect((await goLiveOf(stock.orgId)).go_live).toBe('2026-06-05')
        expect((await goLiveOf(staff.orgId)).go_live).toBe('2019-04-01')
    })
})
