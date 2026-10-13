import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

let db: Db
let today: string
let weekAgo: string
type Fixture = Awaited<ReturnType<typeof fixture>>

async function fixture() {
    const owner = await seedOwnerOrg(db)
    await asSuperuser(db)
    const ids = { owner, day: randomUUID(), night: randomUUID(), both: randomUUID(), idle: randomUUID(), fixed: randomUUID(), machines: [randomUUID(), randomUUID()], job: randomUUID(), costing: randomUUID() }
    await db.query(`INSERT INTO public.estimator_quotes(id, org_id, record_kind, quality_label, yarn_denier, meters, yarn_rate_per_kg,
        landed_cost_per_meter, quote_price_per_meter, intended_margin_percent, worker_rate_per_m)
        VALUES ($1, $2, 'costing', 'Cotton', 100, 1000, 100, 20, 40, 50, 2)`, [ids.costing, owner.orgId])
    await db.query("INSERT INTO public.base_production_jobs(id, org_id, costing_id, quality_label, target_meters, start_date, status, worker_rate_per_meter) VALUES ($1, $2, $3, 'Cotton', 10000, $4, 'active', 2)", [ids.job, owner.orgId, ids.costing, weekAgo])
    for (const [i, machine] of ids.machines.entries()) {
        await db.query("INSERT INTO public.base_production_machines(id, org_id, name, machine_type) VALUES ($1, $2, $3, 'air_jet')", [machine, owner.orgId, `Loom ${i + 1}`])
        await db.query('INSERT INTO public.base_machine_job_contexts(org_id, machine_id, job_id, effective_from) VALUES ($1, $2, $3, $4)', [owner.orgId, machine, ids.job, weekAgo])
    }
    const insertWorker = (id: string, name: string, shift: string) => db.query(
        "INSERT INTO public.base_production_workers(id, org_id, name, rate_per_meter, shift_availability) VALUES ($1, $2, $3, 9, $4)", [id, owner.orgId, name, shift])
    await insertWorker(ids.day, 'Ramesh', 'day')
    await insertWorker(ids.night, 'Suresh', 'night')
    await insertWorker(ids.both, 'Mahesh', 'both')
    await insertWorker(ids.idle, 'Dinesh', 'night')
    await asUser(db, owner.userId, owner.orgId)
    await db.query(`INSERT INTO public.base_production_workers(id, org_id, name, rate_per_meter, pay_type, monthly_salary, start_date, shift_availability, operator_eligible)
        VALUES ($1, $2, 'Hari', 0, 'fixed_monthly', 18000, $3, 'day', false)`, [ids.fixed, owner.orgId, weekAgo])
    return ids
}

async function assign(f: Fixture, worker: string, machine: string, shift: 'day' | 'night') {
    await asUser(db, f.owner.userId, f.owner.orgId)
    await db.query('SELECT public.upsert_base_worker_machine_assignment($1, $2, $3, $4, false)', [worker, machine, shift, weekAgo])
}

async function rotate(f: Fixture, workerIds: string[], effectiveFrom = today) {
    await asUser(db, f.owner.userId, f.owner.orgId)
    const { rows: [row] } = await db.query('SELECT public.rotate_base_worker_shifts($1::uuid[], $2::date) AS result', [workerIds, effectiveFrom])
    return row.result as { success?: boolean; conflict?: boolean; workers_moved?: number; looms_moved?: number; clashes?: Array<Record<string, string>> }
}

async function snapshot(f: Fixture) {
    await asSuperuser(db)
    const { rows: workers } = await db.query('SELECT id, shift_availability FROM public.base_production_workers WHERE org_id = $1', [f.owner.orgId])
    const { rows: open } = await db.query(
        'SELECT worker_id, machine_id, shift FROM public.base_worker_machine_assignments WHERE org_id = $1 AND active AND effective_to IS NULL ORDER BY machine_id, shift', [f.owner.orgId])
    return { shifts: Object.fromEntries(workers.map((w: { id: string; shift_availability: string }) => [w.id, w.shift_availability])), open }
}

beforeAll(async () => {
    db = await freshDatabase()
    const { rows: [dates] } = await db.query(`SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS today,
        ((now() AT TIME ZONE 'Asia/Kolkata')::date - 7)::text AS week_ago`)
    today = dates.today; weekAgo = dates.week_ago
})
afterAll(async () => { await db?.end() })

describe('rotate_base_worker_shifts', () => {
    it('swaps the day and night worker of a loom and keeps the history', async () => {
        const f = await fixture()
        await assign(f, f.day, f.machines[0], 'day')
        await assign(f, f.night, f.machines[0], 'night')

        const result = await rotate(f, [f.day, f.night])
        expect(result).toMatchObject({ success: true, workers_moved: 2, looms_moved: 2 })

        const after = await snapshot(f)
        expect(after.shifts[f.day]).toBe('night')
        expect(after.shifts[f.night]).toBe('day')
        expect(after.open).toEqual(expect.arrayContaining([
            { worker_id: f.day, machine_id: f.machines[0], shift: 'night' },
            { worker_id: f.night, machine_id: f.machines[0], shift: 'day' },
        ]))
        expect(after.open).toHaveLength(2)

        await asSuperuser(db)
        const { rows: ended } = await db.query(
            `SELECT shift, effective_to::text AS effective_to FROM public.base_worker_machine_assignments
             WHERE org_id = $1 AND worker_id = $2 AND NOT active`, [f.owner.orgId, f.day])
        expect(ended).toEqual([{ shift: 'day', effective_to: new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10) }])
    })

    it('moves a worker who runs no looms by changing the shift setting only', async () => {
        const f = await fixture()
        const result = await rotate(f, [f.idle])
        expect(result).toMatchObject({ success: true, workers_moved: 1, looms_moved: 0 })
        expect((await snapshot(f)).shifts[f.idle]).toBe('day')
    })

    it('reports a clash and changes nothing when only one of a swapping pair is selected', async () => {
        const f = await fixture()
        await assign(f, f.day, f.machines[0], 'day')
        await assign(f, f.night, f.machines[0], 'night')
        const before = await snapshot(f)

        const result = await rotate(f, [f.day])
        expect(result.conflict).toBe(true)
        expect(result.clashes).toEqual([expect.objectContaining({
            worker_name: 'Ramesh', machine_name: 'Loom 1', shift: 'night', held_by_worker_name: 'Suresh',
        })])
        expect(await snapshot(f)).toEqual(before)
    })

    it('moves each loom of a Day & night worker to the other shift and keeps their setting', async () => {
        const f = await fixture()
        await assign(f, f.both, f.machines[0], 'day')
        await assign(f, f.both, f.machines[1], 'night')

        const result = await rotate(f, [f.both])
        expect(result).toMatchObject({ success: true, workers_moved: 1, looms_moved: 2 })

        const after = await snapshot(f)
        expect(after.shifts[f.both]).toBe('both')
        expect(after.open).toEqual(expect.arrayContaining([
            { worker_id: f.both, machine_id: f.machines[0], shift: 'night' },
            { worker_id: f.both, machine_id: f.machines[1], shift: 'day' },
        ]))
        expect(after.open).toHaveLength(2)
    })

    it('lets a Day & night worker who runs both shifts of one loom swap with themselves', async () => {
        const f = await fixture()
        await assign(f, f.both, f.machines[0], 'day')
        await assign(f, f.both, f.machines[0], 'night')

        const result = await rotate(f, [f.both])
        expect(result).toMatchObject({ success: true, workers_moved: 1, looms_moved: 2 })
        expect((await snapshot(f)).open).toEqual([
            { worker_id: f.both, machine_id: f.machines[0], shift: 'day' },
            { worker_id: f.both, machine_id: f.machines[0], shift: 'night' },
        ])
    })

    it('reports a clash for a Day & night worker until the loom\'s other worker switches too', async () => {
        const f = await fixture()
        await assign(f, f.both, f.machines[0], 'day')
        await assign(f, f.night, f.machines[0], 'night')
        const before = await snapshot(f)

        const clash = await rotate(f, [f.both])
        expect(clash.conflict).toBe(true)
        expect(clash.clashes).toEqual([expect.objectContaining({ worker_name: 'Mahesh', shift: 'night', held_by_worker_name: 'Suresh' })])
        expect(await snapshot(f)).toEqual(before)

        const result = await rotate(f, [f.both, f.night])
        expect(result).toMatchObject({ success: true, workers_moved: 2, looms_moved: 2 })
        const after = await snapshot(f)
        expect(after.shifts[f.both]).toBe('both')
        expect(after.shifts[f.night]).toBe('day')
        expect(after.open).toEqual(expect.arrayContaining([
            { worker_id: f.both, machine_id: f.machines[0], shift: 'night' },
            { worker_id: f.night, machine_id: f.machines[0], shift: 'day' },
        ]))
    })

    it('treats an unselected Day & night worker as a blocker', async () => {
        const f = await fixture()
        await assign(f, f.day, f.machines[1], 'day')
        await assign(f, f.both, f.machines[1], 'night')

        const result = await rotate(f, [f.day])
        expect(result.conflict).toBe(true)
        expect(result.clashes).toEqual([expect.objectContaining({ held_by_worker_name: 'Mahesh' })])
    })

    it('rejects workers that cannot be rotated and changes nothing', async () => {
        const f = await fixture()
        await assign(f, f.day, f.machines[0], 'day')
        const before = await snapshot(f)

        // f.both runs no loom here, so there is nothing of theirs to switch.
        for (const blocked of [f.both, f.fixed, randomUUID()]) {
            await asUser(db, f.owner.userId, f.owner.orgId)
            const error = await pgError(db.query('SELECT public.rotate_base_worker_shifts($1::uuid[], $2::date)', [[f.day, blocked], today]))
            expect(error.code).toBe('22023')
        }
        expect(await snapshot(f)).toEqual(before)
    })

    it('refuses another factory\'s workers and an empty selection', async () => {
        const f = await fixture()
        const other = await fixture()

        await asUser(db, other.owner.userId, other.owner.orgId)
        const foreign = await pgError(db.query('SELECT public.rotate_base_worker_shifts($1::uuid[], $2::date)', [[f.day], today]))
        expect(foreign.code).toBe('22023')

        const empty = await pgError(db.query('SELECT public.rotate_base_worker_shifts($1::uuid[], $2::date)', [[], today]))
        expect(empty.code).toBe('22023')
    })

    it('is not callable by anonymous users', async () => {
        const f = await fixture()
        await asSuperuser(db)
        await db.query('SET ROLE anon')
        const error = await pgError(db.query('SELECT public.rotate_base_worker_shifts($1::uuid[], $2::date)', [[f.day], today]))
        expect(error.code).toBe('42501')
    })
})
