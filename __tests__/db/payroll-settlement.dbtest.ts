import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

// Refactor Package 1B-2: Base piece-rate settlement through the real RPCs
// (E10 O-INV-14, O-INV-17, O-INV-18; suspected defect OS-4).

let db: Db
type Owner = { userId: string; orgId: string }
let dates: { production: string; today: string; periodStart: string }

/** A new Base org with one piece-rate worker (₹2/m) and 100 m of reviewed production yesterday. */
async function workerWithProduction() {
    const owner: Owner = await seedOwnerOrg(db, { tier: 'base' })
    const ids = { owner, costing: randomUUID(), job: randomUUID(), worker: randomUUID(), machine: randomUUID() }
    await asSuperuser(db)
    await db.query(
        `INSERT INTO public.estimator_quotes(id, org_id, record_kind, quality_label, yarn_denier, meters, yarn_rate_per_kg,
            landed_cost_per_meter, quote_price_per_meter, intended_margin_percent, worker_rate_per_m)
         VALUES ($1, $2, 'costing', 'Cotton', 100, 1000, 100, 20, 40, 50, 2)`,
        [ids.costing, owner.orgId],
    )
    await db.query(
        "INSERT INTO public.base_production_jobs(id, org_id, costing_id, quality_label, target_meters, start_date, status) VALUES ($1, $2, $3, 'Cotton', 10000, '2026-08-01', 'active')",
        [ids.job, owner.orgId, ids.costing],
    )
    await db.query("INSERT INTO public.base_production_workers(id, org_id, name, rate_per_meter, shift_availability) VALUES ($1, $2, $3, 2, 'both')", [ids.worker, owner.orgId, `Worker ${ids.worker.slice(0, 8)}`])
    await db.query("INSERT INTO public.base_production_machines(id, org_id, name, machine_type) VALUES ($1, $2, $3, 'power_loom')", [ids.machine, owner.orgId, `Loom ${ids.machine.slice(0, 8)}`])
    await db.query("INSERT INTO public.base_worker_machine_assignments(org_id, worker_id, machine_id, shift, effective_from) VALUES ($1, $2, $3, 'day', '2026-08-01')", [owner.orgId, ids.worker, ids.machine])
    await db.query("INSERT INTO public.base_machine_job_contexts(org_id, machine_id, job_id, effective_from) VALUES ($1, $2, $3, '2026-08-01')", [owner.orgId, ids.machine, ids.job])

    await asUser(db, owner.userId, owner.orgId)
    const entries = [{
        worker_id: ids.worker, entry_status: 'entered', meters: 100,
        allocations: [{ machine_id: ids.machine, job_id: ids.job, meters: 100 }],
        machine_records: [{ machine_id: ids.machine, state: 'entered' }],
    }]
    await db.query("SELECT public.save_base_daily_production_reviewed($1, 'day', $2, $3, NULL, NULL)", [dates.production, randomUUID(), JSON.stringify(entries)])
    return ids
}

// What the owner reviewed: 100 m × ₹2 = ₹200.00, no advances.
function reviewed(overrides: Record<string, unknown> = {}) {
    return { client_request_id: randomUUID(), period_start: dates.periodStart, gross_pay: 200, advance_deducted: 0, net_payout: 200, advance_balance_before: 0, ...overrides }
}

async function settle(owner: Owner, workerId: string, expected: object) {
    await asUser(db, owner.userId, owner.orgId)
    const { rows } = await db.query("SELECT public.settle_base_worker_payroll_reviewed($1, $2, 'cash', $3, NULL) AS result", [workerId, dates.today, JSON.stringify(expected)])
    return rows[0].result as { settlement_id: string; idempotent: boolean; gross_pay: number; net_payout: number }
}

async function settlements(workerId: string) {
    await asSuperuser(db)
    const { rows } = await db.query('SELECT status, gross_pay::float8 AS gross FROM public.base_payroll_settlements WHERE worker_id = $1 ORDER BY created_at', [workerId])
    return rows as { status: string; gross: number }[]
}

beforeAll(async () => {
    db = await freshDatabase()
    const { rows } = await db.query(`SELECT ((now() AT TIME ZONE 'Asia/Kolkata')::date - 1)::text AS production,
        (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS today,
        LEAST(date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata')::date, (now() AT TIME ZONE 'Asia/Kolkata')::date - 1)::text AS "periodStart"`)
    dates = rows[0]
})
afterAll(async () => { await db?.end() })

describe('Base piece-rate settlement', () => {
    it('INVARIANT O-INV-14: gross pay is metres × the snapshot rate, settled once', async () => {
        const { owner, worker } = await workerWithProduction()
        const result = await settle(owner, worker, reviewed())
        expect(result).toMatchObject({ gross_pay: 200, net_payout: 200, idempotent: false })
        expect(await settlements(worker)).toEqual([{ status: 'paid', gross: 200 }])
    })

    it('INVARIANT O-INV-17: retrying a settlement for the same period returns the same settlement', async () => {
        const { owner, worker } = await workerWithProduction()
        const expected = reviewed()
        const first = await settle(owner, worker, expected)
        const retry = await settle(owner, worker, expected)
        expect(retry).toMatchObject({ settlement_id: first.settlement_id, idempotent: true })
        expect(await settlements(worker)).toEqual([{ status: 'paid', gross: 200 }])
    })

    it('INVARIANT O-INV-17: amounts that differ from what the owner reviewed are refused', async () => {
        const { owner, worker } = await workerWithProduction()
        const error = await pgError(settle(owner, worker, reviewed({ gross_pay: 199, net_payout: 199 })))
        expect(error.code).toBe('40001')
        expect(await settlements(worker)).toEqual([])
    })

    it('KNOWN DEFECT OS-4: after a reversal, re-sending the original request settles the worker again', async () => {
        const { owner, worker } = await workerWithProduction()
        const expected = reviewed()
        const first = await settle(owner, worker, expected)
        await asUser(db, owner.userId, owner.orgId)
        await db.query("SELECT public.reverse_base_payroll_settlement($1, 'Paid by mistake', true)", [first.settlement_id])

        // The 2026-09-01 function refused this with "This payment request was
        // reversed. Reload payroll before recording another payment." The
        // 2026-09-13 reviewed wrapper no longer reads client_request_id.
        const replay = await settle(owner, worker, expected)
        expect(replay.settlement_id).not.toBe(first.settlement_id)
        expect(await settlements(worker)).toEqual([{ status: 'reversed', gross: 200 }, { status: 'paid', gross: 200 }])
    })
})
