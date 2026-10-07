import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asSuperuser, asSupervisor, asUser, freshDatabase, pgError, seedOwnerOrg, seedSupervisor, type Db } from './helpers'
import { buildSupervisorSheet, parseSupervisorSheet } from '@/lib/supervisor-daily-sheet'

// Supervisors record and correct the Base daily sheet (today and yesterday)
// through the same reviewed core the owner uses, and read a metres-only view.

let db: Db
let dates: { today: string; yesterday: string; twoDaysAgo: string; tomorrow: string; periodStart: string }

type Factory = { owner: { userId: string; orgId: string }; supervisor: string; costing: string; job: string; worker: string; machine: string }

async function factory(options: { jobStatus?: 'active' | 'planned'; supervisorStatus?: 'pending' | 'approved' | 'removed' } = {}): Promise<Factory> {
    const owner = await seedOwnerOrg(db, { tier: 'base' })
    const ids = { costing: randomUUID(), job: randomUUID(), worker: randomUUID(), machine: randomUUID() }
    await asSuperuser(db)
    await db.query(
        `INSERT INTO public.estimator_quotes(id, org_id, record_kind, quality_label, yarn_denier, meters, yarn_rate_per_kg,
            landed_cost_per_meter, quote_price_per_meter, intended_margin_percent, worker_rate_per_m)
         VALUES ($1, $2, 'costing', 'Cotton', 100, 1000, 100, 20, 40, 50, 2)`,
        [ids.costing, owner.orgId],
    )
    await db.query(
        "INSERT INTO public.base_production_jobs(id, org_id, costing_id, quality_label, target_meters, start_date, status, worker_rate_per_meter) VALUES ($1, $2, $3, 'Cotton', 10000, '2026-08-01', $4, 2)",
        [ids.job, owner.orgId, ids.costing, options.jobStatus ?? 'active'],
    )
    await db.query("INSERT INTO public.base_production_workers(id, org_id, name, rate_per_meter, shift_availability) VALUES ($1, $2, 'Weaver One', 2, 'both')", [ids.worker, owner.orgId])
    await db.query("INSERT INTO public.base_production_machines(id, org_id, name, machine_type) VALUES ($1, $2, 'Loom 1', 'power_loom')", [ids.machine, owner.orgId])
    for (const shift of ['day', 'night']) {
        await db.query("INSERT INTO public.base_worker_machine_assignments(org_id, worker_id, machine_id, shift, effective_from) VALUES ($1, $2, $3, $4, '2026-08-01')", [owner.orgId, ids.worker, ids.machine, shift])
    }
    await db.query("INSERT INTO public.base_machine_job_contexts(org_id, machine_id, job_id, effective_from) VALUES ($1, $2, $3, '2026-08-01')", [owner.orgId, ids.machine, ids.job])
    const supervisor = await seedSupervisor(db, owner.orgId, options.supervisorStatus ?? 'approved', 'Ramesh')
    return { owner, supervisor: supervisor.userId, ...ids }
}

function sheet(f: Factory, meters: number) {
    return [{
        worker_id: f.worker, entry_status: 'entered', meters,
        allocations: [{ machine_id: f.machine, job_id: f.job, meters }],
        machine_records: [{ machine_id: f.machine, state: 'entered' }],
    }]
}

async function supervisorSave(f: Factory, date: string, meters: number, options: { shift?: string; reason?: string | null; expected?: string | null } = {}) {
    await asSupervisor(db, f.supervisor)
    const { rows } = await db.query(
        'SELECT public.save_supervisor_daily_sheet($1, $2, $3, $4, $5, $6) AS result',
        [date, options.shift ?? 'day', randomUUID(), JSON.stringify(sheet(f, meters)), options.reason ?? null, options.expected ?? null],
    )
    return rows[0].result as { batch_id: string; revision_number: number; change_kind: string }
}

async function ownerSave(f: Factory, date: string, meters: number, options: { reason?: string | null; expected?: string | null } = {}) {
    await asUser(db, f.owner.userId, f.owner.orgId)
    const { rows } = await db.query(
        "SELECT public.save_base_daily_production_reviewed($1, 'day', $2, $3, $4, $5) AS result",
        [date, randomUUID(), JSON.stringify(sheet(f, meters)), options.reason ?? null, options.expected ?? null],
    )
    return rows[0].result as { batch_id: string }
}

async function batchUpdatedAt(batchId: string) {
    await asSuperuser(db)
    return (await db.query("SELECT to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS at FROM public.base_production_batches WHERE id = $1", [batchId])).rows[0].at as string
}

async function readSheet(userId: string, date: string, shift = 'day') {
    await asSupervisor(db, userId)
    const { rows } = await db.query('SELECT public.get_supervisor_daily_sheet($1, $2) AS sheet', [date, shift])
    return rows[0].sheet as Record<string, unknown>
}

function keysDeep(value: unknown, keys = new Set<string>()): Set<string> {
    if (Array.isArray(value)) value.forEach(item => keysDeep(item, keys))
    else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) { keys.add(key); keysDeep(item, keys) }
    return keys
}

beforeAll(async () => {
    db = await freshDatabase()
    const { rows } = await db.query(`SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS today,
        ((now() AT TIME ZONE 'Asia/Kolkata')::date - 1)::text AS yesterday,
        ((now() AT TIME ZONE 'Asia/Kolkata')::date - 2)::text AS "twoDaysAgo",
        ((now() AT TIME ZONE 'Asia/Kolkata')::date + 1)::text AS tomorrow,
        LEAST(date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata')::date, (now() AT TIME ZONE 'Asia/Kolkata')::date - 1)::text AS "periodStart"`)
    dates = rows[0]
})
afterAll(async () => { await db?.end() })

describe('supervisor save window and actor', () => {
    it('an approved supervisor saves today, and the receipt names the supervisor', async () => {
        const f = await factory()
        const result = await supervisorSave(f, dates.today, 120)
        expect(result.change_kind).toBe('created')
        await asSuperuser(db)
        const revision = (await db.query('SELECT changed_by FROM public.base_production_batch_revisions WHERE batch_id = $1', [result.batch_id])).rows[0]
        expect(revision.changed_by).toBe(f.supervisor)
        const batch = (await db.query('SELECT created_by FROM public.base_production_batches WHERE id = $1', [result.batch_id])).rows[0]
        expect(batch.created_by).toBe(f.supervisor)
    })

    it('yesterday’s night shift is inside the window', async () => {
        const f = await factory()
        const result = await supervisorSave(f, dates.yesterday, 80, { shift: 'night' })
        expect(result.batch_id).toBeTruthy()
    })

    it('two days ago and tomorrow are outside the window', async () => {
        const f = await factory()
        expect(await pgError(supervisorSave(f, dates.twoDaysAgo, 10))).toEqual({ code: '22023', message: 'Supervisors can record today and yesterday only.' })
        expect((await pgError(supervisorSave(f, dates.tomorrow, 10))).code).toBe('22023')
    })

    it('pending and removed supervisors cannot save', async () => {
        for (const status of ['pending', 'removed'] as const) {
            const f = await factory({ supervisorStatus: status })
            expect((await pgError(supervisorSave(f, dates.today, 10))).code).toBe('42501')
        }
    })

    it('a lapsed plan or a locked factory stops supervisor saves', async () => {
        const lapsed = await factory()
        await asSuperuser(db)
        await db.query("UPDATE public.org_subscriptions SET current_end = now() - interval '3 days' WHERE org_id = $1", [lapsed.owner.orgId])
        expect((await pgError(supervisorSave(lapsed, dates.today, 10))).code).toBe('42501')
        const locked = await factory()
        await asSuperuser(db)
        await db.query('UPDATE public.organizations SET is_locked_down = true WHERE id = $1', [locked.owner.orgId])
        expect((await pgError(supervisorSave(locked, dates.today, 10))).code).toBe('42501')
    })

    it('a supervisor cannot use the owner save entry point', async () => {
        const f = await factory()
        await asSupervisor(db, f.supervisor)
        const error = await pgError(db.query("SELECT public.save_base_daily_production_reviewed($1, 'day', $2, $3, NULL, NULL)", [dates.today, randomUUID(), JSON.stringify(sheet(f, 5))]))
        expect(error.code).toBe('42501')
    })

    it('clients cannot call the private reviewed core', async () => {
        const f = await factory()
        await asUser(db, f.owner.userId, f.owner.orgId)
        const error = await pgError(db.query("SELECT private.save_base_daily_production_reviewed_core($1, 'day', $2, $3, NULL, NULL)", [dates.today, randomUUID(), JSON.stringify(sheet(f, 5))]))
        expect(error.code).toBe('42501')
    })
})

describe('corrections and conflicts', () => {
    it('a correction needs a reason', async () => {
        const f = await factory()
        const first = await supervisorSave(f, dates.today, 100)
        const error = await pgError(supervisorSave(f, dates.today, 90, { expected: await batchUpdatedAt(first.batch_id) }))
        expect(error.code).toBe('22023')
    })

    it('owner and supervisor correct each other’s sheets, and each revision names its author', async () => {
        const f = await factory()
        const created = await supervisorSave(f, dates.today, 100)
        await ownerSave(f, dates.today, 95, { reason: 'Counter re-read', expected: await batchUpdatedAt(created.batch_id) })
        const corrected = await supervisorSave(f, dates.today, 97, { reason: 'Second loom check', expected: await batchUpdatedAt(created.batch_id) })
        expect(corrected.change_kind).toBe('corrected')
        await asSuperuser(db)
        const { rows } = await db.query('SELECT revision_number, changed_by, correction_reason FROM public.base_production_batch_revisions WHERE batch_id = $1 ORDER BY revision_number', [created.batch_id])
        expect(rows).toEqual([
            { revision_number: 1, changed_by: f.supervisor, correction_reason: null },
            { revision_number: 2, changed_by: f.owner.userId, correction_reason: 'Counter re-read' },
            { revision_number: 3, changed_by: f.supervisor, correction_reason: 'Second loom check' },
        ])
    })

    it('a stale sheet is refused with a conflict', async () => {
        const f = await factory()
        const created = await supervisorSave(f, dates.today, 100)
        const stale = await batchUpdatedAt(created.batch_id)
        await ownerSave(f, dates.today, 95, { reason: 'Counter re-read', expected: stale })
        expect((await pgError(supervisorSave(f, dates.today, 90, { reason: 'Late fix', expected: stale }))).code).toBe('40001')
    })

    it('paid production stays protected from supervisor corrections', async () => {
        const f = await factory()
        const created = await supervisorSave(f, dates.yesterday, 100)
        await asUser(db, f.owner.userId, f.owner.orgId)
        await db.query("SELECT public.settle_base_worker_payroll_reviewed($1, $2, 'cash', $3, NULL)", [
            f.worker, dates.today,
            JSON.stringify({ client_request_id: randomUUID(), period_start: dates.periodStart, gross_pay: 200, advance_deducted: 0, net_payout: 200, advance_balance_before: 0 }),
        ])
        const error = await pgError(supervisorSave(f, dates.yesterday, 50, { reason: 'Recount', expected: await batchUpdatedAt(created.batch_id) }))
        expect(error.code).toBe('22023')
        expect(error.message).toMatch(/finalized|protected/)
    })

    it('recorded metres start a planned job', async () => {
        const f = await factory({ jobStatus: 'planned' })
        await supervisorSave(f, dates.today, 40)
        await asSuperuser(db)
        expect((await db.query('SELECT status FROM public.base_production_jobs WHERE id = $1', [f.job])).rows[0].status).toBe('active')
    })

    it('the owner save is unchanged', async () => {
        const f = await factory()
        const result = await ownerSave(f, dates.today, 70)
        expect(result.batch_id).toBeTruthy()
    })
})

describe('supervisor sheet read', () => {
    it('returns the dated Setup and the saved metres, and no money', async () => {
        const f = await factory()
        await supervisorSave(f, dates.today, 120)
        const data = await readSheet(f.supervisor, dates.today)
        expect(data).toMatchObject({ org_id: f.owner.orgId, today: dates.today, min_date: dates.yesterday })
        expect(data.machine_jobs).toEqual([{ machine_id: f.machine, job_id: f.job, job_label: 'Cotton' }])
        expect(data.assignments).toEqual([expect.objectContaining({ worker_id: f.worker, machine_id: f.machine })])
        expect(data.allocations).toEqual([expect.objectContaining({ worker_id: f.worker, machine_id: f.machine, meters: 120 })])
        expect(data.revisions).toEqual([expect.objectContaining({ revision_number: 1, change_kind: 'created', changed_by_name: 'Ramesh', after_total: 120 })])
        const forbidden = [...keysDeep(data)].filter(key => /rate|salary|price|earning|gross|cost|pay_basis|amount/.test(key))
        expect(forbidden).toEqual([])
    })

    it('is exactly what the supervisor sheet model reads', async () => {
        const f = await factory()
        await supervisorSave(f, dates.today, 120)
        const sheet = buildSupervisorSheet(parseSupervisorSheet(await readSheet(f.supervisor, dates.today)), dates.today, 'day')
        expect(sheet.rows).toEqual([expect.objectContaining({ machineId: f.machine, workerId: f.worker, jobId: f.job, jobLabel: 'Cotton', paid: false })])
        expect(sheet.baseline[f.worker]).toMatchObject({ status: 'entered', machineMeters: { [`${f.machine}:${f.job}`]: '120' } })
        expect(parseSupervisorSheet(await readSheet(f.supervisor, dates.yesterday, 'night')).batch).toBeNull()
    })

    it('is refused outside the window, while pending, after the plan lapses and while locked', async () => {
        const f = await factory()
        expect((await pgError(readSheet(f.supervisor, dates.twoDaysAgo))).code).toBe('22023')
        const pending = await factory({ supervisorStatus: 'pending' })
        expect((await pgError(readSheet(pending.supervisor, dates.today))).code).toBe('42501')
        await asSuperuser(db)
        await db.query('UPDATE public.organizations SET is_locked_down = true WHERE id = $1', [f.owner.orgId])
        expect((await pgError(readSheet(f.supervisor, dates.today))).code).toBe('42501')
        await asSuperuser(db)
        await db.query('UPDATE public.organizations SET is_locked_down = false WHERE id = $1', [f.owner.orgId])
        expect((await readSheet(f.supervisor, dates.today)).org_id).toBe(f.owner.orgId)
        await asSuperuser(db)
        await db.query("UPDATE public.org_subscriptions SET current_end = now() - interval '3 days' WHERE org_id = $1", [f.owner.orgId])
        expect((await pgError(readSheet(f.supervisor, dates.today))).code).toBe('42501')
    })
})

describe('supervisor isolation', () => {
    it('supervisors read no factory rows directly, in any status', async () => {
        const f = await factory()
        await supervisorSave(f, dates.today, 120)
        await asSuperuser(db)
        const tables = (await db.query(`SELECT c.table_name FROM information_schema.columns c
            JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
            WHERE c.table_schema = 'public' AND c.column_name = 'org_id' ORDER BY 1`)).rows.map((row: { table_name: string }) => row.table_name)
        expect(tables).toEqual(expect.arrayContaining(['base_daily_production_entries', 'estimator_quotes', 'org_subscriptions', 'factory_supervisors', 'supervisor_join_codes', 'dispatches']))
        for (const status of ['pending', 'approved', 'removed'] as const) {
            const supervisor = status === 'approved' ? f.supervisor : (await seedSupervisor(db, f.owner.orgId, status)).userId
            await asSupervisor(db, supervisor)
            for (const table of tables) {
                const visible = await db.query(`SELECT count(*)::int AS n FROM public.${table} WHERE org_id = $1`, [f.owner.orgId])
                    .then((result: { rows: Array<{ n: number }> }) => result.rows[0].n, (error: { code?: string }) => error.code === '42501' ? 0 : Promise.reject(error))
                expect({ status, table, visible }).toEqual({ status, table, visible: 0 })
            }
            expect((await db.query('SELECT count(*)::int AS n FROM public.organizations')).rows[0].n).toBe(0)
            expect((await db.query('SELECT id FROM public.profiles')).rows.map((row: { id: string }) => row.id)).toEqual([supervisor])
        }
    })

    it('every retired supervisor policy still requires the caller’s organization', async () => {
        await asSuperuser(db)
        const { rows } = await db.query(`SELECT tablename, policyname, coalesce(qual, '') || ' ' || coalesce(with_check, '') AS expr FROM pg_policies
            WHERE schemaname = 'public' AND (coalesce(qual, '') || coalesce(with_check, '')) ILIKE '%supervisor%'`)
        expect(rows.length).toBeGreaterThan(0)
        for (const row of rows) {
            const scoped = /auth\.jwt\(\) ->> 'org_id'|get_user_org_id\(\)|supervisor_id = auth\.uid\(\)/.test(row.expr)
            expect({ policy: `${row.tablename}.${row.policyname}`, scoped }).toEqual({ policy: `${row.tablename}.${row.policyname}`, scoped: true })
        }
    })

    it('no policy reads the supervisor membership or code tables', async () => {
        await asSuperuser(db)
        const { rows } = await db.query(`SELECT tablename, policyname FROM pg_policies
            WHERE tablename IN ('factory_supervisors', 'supervisor_join_codes')
               OR (coalesce(qual, '') || coalesce(with_check, '')) ~ '(factory_supervisors|supervisor_join_codes|active_supervisor_org)'`)
        expect(rows).toEqual([])
    })
})
