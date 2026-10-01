import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { calculateBaseWorkerPayables, type BaseProductionWorker } from '../../lib/base-production-core'
import { asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

let db: Db
let today: string
let monthStart: string
let yesterday: string
type Fixture = Awaited<ReturnType<typeof fixture>>

async function fixture(approved = true, jobRate = 2, start = monthStart) {
    const owner = await seedOwnerOrg(db)
    const ids = { owner, fixed: randomUUID(), piece: randomUUID(), job: randomUUID(), costing: randomUUID(), machines: [randomUUID(), randomUUID(), randomUUID()] }
    await asSuperuser(db)
    await db.query(`INSERT INTO public.estimator_quotes(id, org_id, record_kind, quality_label, yarn_denier, meters, yarn_rate_per_kg,
        landed_cost_per_meter, quote_price_per_meter, intended_margin_percent, worker_rate_per_m)
        VALUES ($1, $2, 'costing', 'Cotton', 100, 1000, 100, 20, 40, 50, $3)`, [ids.costing, owner.orgId, jobRate])
    await db.query("INSERT INTO public.base_production_jobs(id, org_id, costing_id, quality_label, target_meters, start_date, status, worker_rate_per_meter) VALUES ($1, $2, $3, 'Cotton', 10000, $4, 'active', $5)", [ids.job, owner.orgId, ids.costing, start, jobRate])
    for (const machine of ids.machines) {
        await db.query("INSERT INTO public.base_production_machines(id, org_id, name, machine_type) VALUES ($1, $2, $3, 'air_jet')", [machine, owner.orgId, machine])
        await db.query('INSERT INTO public.base_machine_job_contexts(org_id, machine_id, job_id, effective_from) VALUES ($1, $2, $3, $4)', [owner.orgId, machine, ids.job, start])
    }
    await db.query("INSERT INTO public.base_production_workers(id, org_id, name, rate_per_meter, shift_availability) VALUES ($1, $2, $3, 9, 'both')", [ids.piece, owner.orgId, ids.piece])
    await asUser(db, owner.userId, owner.orgId)
    await db.query(`INSERT INTO public.base_production_workers(id, org_id, name, rate_per_meter, pay_type, monthly_salary, start_date, shift_availability, operator_eligible)
        VALUES ($1, $2, $3, 0, 'fixed_monthly', 18000, $4, 'day', $5)`, [ids.fixed, owner.orgId, ids.fixed, start, approved])
    return ids
}

async function assign(f: Fixture, worker: string, machine: string, shift = 'day', date = today) {
    await asUser(db, f.owner.userId, f.owner.orgId)
    await db.query('SELECT public.upsert_base_worker_machine_assignment($1, $2, $3, $4, false)', [worker, machine, shift, date])
}

function payload(f: Fixture) {
    return [
        { worker_id: f.fixed, entry_status: 'entered', meters: 300, allocations: [
            { machine_id: f.machines[0], job_id: f.job, meters: 100 },
            { machine_id: f.machines[1], job_id: f.job, meters: 200 },
        ], machine_records: f.machines.slice(0, 2).map(machine_id => ({ machine_id, state: 'entered' })) },
        { worker_id: f.piece, entry_status: 'entered', meters: 50, allocations: [{ machine_id: f.machines[2], job_id: f.job, meters: 50 }],
            machine_records: [{ machine_id: f.machines[2], state: 'entered' }] },
    ]
}

async function record(f: Fixture, request = randomUUID(), date = today, shift = 'day') {
    await asUser(db, f.owner.userId, f.owner.orgId)
    const { rows: [row] } = await db.query('SELECT public.save_base_daily_production_reviewed($1, $2, $3, $4, NULL, NULL) AS result', [date, shift, request, JSON.stringify(payload(f))])
    return row.result as { batch_id: string; total_meters: number; idempotent: boolean }
}

async function prepare(f: Fixture) {
    await assign(f, f.fixed, f.machines[0])
    await assign(f, f.fixed, f.machines[1])
    await assign(f, f.piece, f.machines[2])
}

async function salaryExpected(f: Fixture) {
    await asSuperuser(db)
    const { rows: [worker] } = await db.query('SELECT * FROM public.base_production_workers WHERE id = $1', [f.fixed])
    const typed: BaseProductionWorker = { ...worker, monthly_salary: Number(worker.monthly_salary), rate_per_meter: Number(worker.rate_per_meter),
        salary_history: worker.salary_history.map((line: { effective_from: string; monthly_salary: number }) => ({ ...line, monthly_salary: Number(line.monthly_salary) })) }
    const payable = calculateBaseWorkerPayables({ workers: [typed], entries: [], advances: [], settlements: [], periodEnd: today })[0]
    return { client_request_id: randomUUID(), period_start: payable.period_start, gross_pay: payable.gross_pay,
        advance_deducted: 0, net_payout: payable.net_payout, advance_balance_before: 0 }
}

async function settle(f: Fixture, expected: object) {
    await asUser(db, f.owner.userId, f.owner.orgId)
    const { rows: [row] } = await db.query("SELECT public.settle_base_worker_payroll_reviewed($1, $2, 'cash', $3, NULL) AS result", [f.fixed, today, JSON.stringify(expected)])
    return row.result as { settlement_id: string; gross_pay: number; idempotent: boolean }
}

beforeAll(async () => {
    db = await freshDatabase()
    const { rows: [dates] } = await db.query(`SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS today,
        date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata')::date::text AS start,
        ((now() AT TIME ZONE 'Asia/Kolkata')::date - 1)::text AS yesterday`)
    today = dates.today; monthStart = dates.start; yesterday = dates.yesterday
})
afterAll(async () => { await db?.end() })

describe('Base fixed operator production', () => {
    it('records two fixed machines and one piece machine without changing the shared job rate; retries once', async () => {
        const f = await fixture()
        await prepare(f)
        const request = randomUUID()
        const saved = await record(f, request)
        expect(saved.total_meters).toBe(350)
        expect(await record(f, request)).toMatchObject({ batch_id: saved.batch_id, idempotent: true })
        await asSuperuser(db)
        const { rows } = await db.query(`SELECT worker_id, meters::float8 AS meters, worker_rate_snapshot::float8 AS rate,
            pay_basis_snapshot AS basis, piece_earning_state AS state FROM public.base_daily_production_allocations
            WHERE org_id = $1 ORDER BY meters`, [f.owner.orgId])
        expect(rows.filter((row: { worker_id: string }) => row.worker_id === f.fixed)).toEqual([
            { worker_id: f.fixed, meters: 100, rate: 0, basis: 'fixed_monthly', state: 'inapplicable' },
            { worker_id: f.fixed, meters: 200, rate: 0, basis: 'fixed_monthly', state: 'inapplicable' },
        ])
        expect(rows.find((row: { worker_id: string }) => row.worker_id === f.piece)).toMatchObject({ rate: 2, state: 'applicable' })
        expect((await db.query('SELECT worker_rate_per_meter::float8 AS rate FROM public.base_production_jobs WHERE id = $1', [f.job])).rows[0].rate).toBe(2)
        expect((await db.query('SELECT count(*)::int AS count FROM public.base_daily_production_entries WHERE org_id = $1', [f.owner.orgId])).rows[0].count).toBe(2)
    })
    it('settles one salary across multiple machines, with monthly receipt units and retry protection', async () => {
        const f = await fixture()
        await prepare(f); await record(f)
        const expected = await salaryExpected(f)
        const first = await settle(f, expected)
        expect(first.gross_pay).toBe(expected.gross_pay)
        expect(await settle(f, expected)).toMatchObject({ settlement_id: first.settlement_id, idempotent: true })
        await asSuperuser(db)
        const { rows } = await db.query(`SELECT source_kind, meters::float8 AS meters, worker_rate_snapshot::float8 AS salary,
            gross_pay::float8 AS gross FROM public.base_payroll_settlement_lines WHERE settlement_id = $1`, [first.settlement_id])
        expect(rows).toEqual([{ source_kind: 'fixed_salary', meters: 0, salary: 18000, gross: expected.gross_pay }])
    })
    it('keeps support salary payable without any operator approval or production', async () => {
        const f = await fixture(false)
        const expected = await salaryExpected(f)
        expect((await settle(f, expected)).gross_pay).toBe(expected.gross_pay)
        expect(expected.gross_pay).toBeGreaterThan(0)
    })
    it('requires explicit fixed approval and records the owner and prospective business date', async () => {
        const f = await fixture(false)
        expect((await pgError(assign(f, f.fixed, f.machines[0]))).code).toBe('22023')
        await asUser(db, f.owner.userId, f.owner.orgId)
        await db.query("UPDATE public.base_production_workers SET operator_eligible = true, role = 'Supervisor' WHERE id = $1", [f.fixed])
        const { rows: [worker] } = await db.query('SELECT operator_approved_by, operator_effective_from::text AS date, operator_approved_at IS NOT NULL AS stamped FROM public.base_production_workers WHERE id = $1', [f.fixed])
        expect(worker).toEqual({ operator_approved_by: f.owner.userId, date: today, stamped: true })
        await assign(f, f.fixed, f.machines[0])
    })
    it('enforces fixed shifts and prospective approval dates in the assignment RPC', async () => {
        // On the 1st, yesterday precedes monthStart, so the RPC would refuse it
        // first for having no active job (23503). Start the fixture a day early so
        // only the approval date can refuse the backdated assignment.
        const f = await fixture(true, 2, yesterday)
        expect((await pgError(assign(f, f.fixed, f.machines[0], 'night'))).code).toBe('22023')
        expect((await pgError(assign(f, f.fixed, f.machines[0], 'day', yesterday))).code).toBe('22023')
    })
    it('requires ending assignments before revoking approval and retains prior production snapshots', async () => {
        const f = await fixture()
        await prepare(f); await record(f)
        await asUser(db, f.owner.userId, f.owner.orgId)
        expect((await pgError(db.query('UPDATE public.base_production_workers SET operator_eligible = false WHERE id = $1', [f.fixed]))).code).toBe('22023')
        const { rows } = await db.query('SELECT id FROM public.base_worker_machine_assignments WHERE worker_id = $1 AND active', [f.fixed])
        for (const row of rows) await db.query('SELECT public.delete_base_worker_machine_assignment($1)', [row.id])
        await db.query('UPDATE public.base_production_workers SET operator_eligible = false WHERE id = $1', [f.fixed])
        const { rows: [snapshot] } = await db.query("SELECT sum(meters)::float8 AS meters, sum(meters * worker_rate_snapshot)::float8 AS piece FROM public.base_daily_production_allocations WHERE worker_id = $1", [f.fixed])
        expect(snapshot).toEqual({ meters: 300, piece: 0 })
    })
    it('keeps an explicit zero job wage instead of substituting a nonzero legacy worker wage', async () => {
        const f = await fixture(true, 0)
        await prepare(f); await record(f)
        await asSuperuser(db)
        expect((await db.query('SELECT worker_rate_snapshot::float8 AS rate FROM public.base_daily_production_allocations WHERE worker_id = $1', [f.piece])).rows[0].rate).toBe(0)
    })
    it('blocks cross-tenant assignments and keeps pay-type immutability', async () => {
        const f = await fixture()
        const other = await seedOwnerOrg(db)
        await asUser(db, other.userId, other.orgId)
        expect((await pgError(db.query("SELECT public.upsert_base_worker_machine_assignment($1, $2, 'day', $3, false)", [f.fixed, f.machines[0], today]))).code).toBe('23503')
        await asUser(db, f.owner.userId, f.owner.orgId)
        expect((await pgError(db.query("UPDATE public.base_production_workers SET pay_type = 'piece_rate' WHERE id = $1", [f.fixed]))).code).toBe('22023')
    })
})
