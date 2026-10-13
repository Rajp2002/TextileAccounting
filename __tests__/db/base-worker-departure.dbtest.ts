import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

// A worker given a last working day (or made inactive) must stop holding looms after it,
// or every later sheet for their shift carries their row and the operator guard rejects it.
let db: Db
let dates: { today: string; yesterday: string; twoDaysAgo: string; weekAgo: string; inThreeDays: string; inFourDays: string }
type Fixture = Awaited<ReturnType<typeof fixture>>

async function fixture() {
    const owner = await seedOwnerOrg(db)
    const ids = { owner, leaver: randomUUID(), stayer: randomUUID(), job: randomUUID(), costing: randomUUID(), machines: [randomUUID(), randomUUID(), randomUUID()] }
    await asSuperuser(db)
    await db.query(`INSERT INTO public.estimator_quotes(id, org_id, record_kind, quality_label, yarn_denier, meters, yarn_rate_per_kg,
        landed_cost_per_meter, quote_price_per_meter, intended_margin_percent, worker_rate_per_m)
        VALUES ($1, $2, 'costing', 'Cotton', 100, 1000, 100, 20, 40, 50, 2)`, [ids.costing, owner.orgId])
    await db.query("INSERT INTO public.base_production_jobs(id, org_id, costing_id, quality_label, target_meters, start_date, status, worker_rate_per_meter) VALUES ($1, $2, $3, 'Cotton', 10000, $4, 'active', 2)", [ids.job, owner.orgId, ids.costing, dates.weekAgo])
    for (const [index, machine] of ids.machines.entries()) {
        await db.query("INSERT INTO public.base_production_machines(id, org_id, name, machine_type) VALUES ($1, $2, $3, 'air_jet')", [machine, owner.orgId, `Loom 0${index + 1}`])
        await db.query('INSERT INTO public.base_machine_job_contexts(org_id, machine_id, job_id, effective_from) VALUES ($1, $2, $3, $4)', [owner.orgId, machine, ids.job, dates.weekAgo])
    }
    for (const [id, name] of [[ids.leaver, 'Gorthan'], [ids.stayer, 'Ramesh']]) {
        await db.query("INSERT INTO public.base_production_workers(id, org_id, name, rate_per_meter, shift_availability) VALUES ($1, $2, $3, 9, 'night')", [id, owner.orgId, name])
    }
    await assign(ids, ids.leaver, ids.machines[0])
    await assign(ids, ids.leaver, ids.machines[1])
    await assign(ids, ids.stayer, ids.machines[2])
    return ids
}

async function assign(f: Pick<Fixture, 'owner'>, worker: string, machine: string, from = dates.weekAgo) {
    await asUser(db, f.owner.userId, f.owner.orgId)
    const { rows: [row] } = await db.query('SELECT public.upsert_base_worker_machine_assignment($1, $2, $3, $4, false) AS result', [worker, machine, 'night', from])
    return row.result as { assignment_id?: string; conflict?: boolean }
}

/** What the owner's worker editor sends: the whole row, end date and active flag included. */
async function updateWorker(f: Fixture, worker: string, change: { end_date?: string | null; is_active?: boolean; start_date?: string | null }) {
    await asUser(db, f.owner.userId, f.owner.orgId)
    const { rows: [current] } = await db.query('SELECT end_date::text, is_active, start_date::text FROM public.base_production_workers WHERE id = $1', [worker])
    const next = { ...current, ...change }
    await db.query('UPDATE public.base_production_workers SET end_date = $2, is_active = $3, start_date = $4, updated_at = now() WHERE id = $1',
        [worker, next.end_date, next.is_active, next.start_date])
}

async function assignmentsOf(worker: string) {
    await asSuperuser(db)
    const { rows } = await db.query(
        `SELECT machine_id, active, effective_from::text AS effective_from, effective_to::text AS effective_to
         FROM public.base_worker_machine_assignments WHERE worker_id = $1 ORDER BY effective_from, machine_id`, [worker])
    return rows as Array<{ machine_id: string; active: boolean; effective_from: string; effective_to: string | null }>
}

/** The workers the daily sheet seats on a loom for a date: the same filter the owner and supervisor sheets use. */
async function seatedOn(f: Fixture, date: string) {
    await asSuperuser(db)
    const { rows } = await db.query(
        `SELECT DISTINCT worker_id FROM public.base_worker_machine_assignments
         WHERE org_id = $1 AND shift = 'night' AND active AND effective_from <= $2
           AND (effective_to IS NULL OR effective_to >= $2)`, [f.owner.orgId, date])
    return rows.map((row: { worker_id: string }) => row.worker_id).sort()
}

function row(worker: string, machines: string[], status: 'entered' | 'blank', job: string) {
    return status === 'entered'
        ? { worker_id: worker, entry_status: 'entered', meters: 40, allocations: [{ machine_id: machines[0], job_id: job, meters: 40 }], machine_records: [{ machine_id: machines[0], state: 'entered' }] }
        : { worker_id: worker, entry_status: 'blank', meters: null, allocations: [], machine_records: machines.map(machine_id => ({ machine_id, state: 'pending' })) }
}

async function saveNight(f: Fixture, date: string, entries: object[]) {
    await asUser(db, f.owner.userId, f.owner.orgId)
    const { rows: [result] } = await db.query("SELECT public.save_base_daily_production_reviewed($1, 'night', $2, $3, NULL, NULL) AS result", [date, randomUUID(), JSON.stringify(entries)])
    return result.result as { batch_id: string; total_meters: number }
}

beforeAll(async () => {
    db = await freshDatabase()
    const { rows: [values] } = await db.query(`WITH today AS (SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date AS d)
        SELECT d::text AS today, (d - 1)::text AS yesterday, (d - 2)::text AS two_days_ago, (d - 7)::text AS week_ago,
               (d + 3)::text AS in_three_days, (d + 4)::text AS in_four_days FROM today`)
    dates = { today: values.today, yesterday: values.yesterday, twoDaysAgo: values.two_days_ago, weekAgo: values.week_ago, inThreeDays: values.in_three_days, inFourDays: values.in_four_days }
})
afterAll(async () => { await db?.end() })

describe('a worker who leaves stops holding looms after their last working day', () => {
    it('a past last working day ends their looms on that day, so later night sheets save without them', async () => {
        const f = await fixture()
        await updateWorker(f, f.leaver, { end_date: dates.twoDaysAgo })

        expect(await assignmentsOf(f.leaver)).toEqual(f.machines.slice(0, 2).sort().map(machine_id => ({
            machine_id, active: true, effective_from: dates.weekAgo, effective_to: dates.twoDaysAgo,
        })))
        // They still run their looms up to the last day, and nobody holds them after it.
        expect(await seatedOn(f, dates.twoDaysAgo)).toEqual([f.leaver, f.stayer].sort())
        expect(await seatedOn(f, dates.today)).toEqual([f.stayer])

        const saved = await saveNight(f, dates.today, [row(f.stayer, [f.machines[2]], 'entered', f.job)])
        expect(saved.total_meters).toBe(40)
    })

    it('still rejects a sheet that carries the departed worker, which is why the sheet must leave them out', async () => {
        const f = await fixture()
        await updateWorker(f, f.leaver, { end_date: dates.twoDaysAgo })

        const error = await pgError(saveNight(f, dates.today, [
            row(f.stayer, [f.machines[2]], 'entered', f.job),
            row(f.leaver, [], 'blank', f.job),
        ]))
        expect(error).toMatchObject({ code: '22023', message: 'Choose an approved operator available for this date and shift.' })
    })

    it('a future last working day keeps their looms until then, and the looms can be handed on from the next day', async () => {
        const f = await fixture()
        await updateWorker(f, f.leaver, { end_date: dates.inThreeDays })

        expect((await assignmentsOf(f.leaver)).map(item => [item.active, item.effective_to])).toEqual([[true, dates.inThreeDays], [true, dates.inThreeDays]])
        expect(await seatedOn(f, dates.today)).toEqual([f.leaver, f.stayer].sort())

        const handover = await assign(f, f.stayer, f.machines[0], dates.inFourDays)
        expect(handover.conflict).toBeFalsy()
        expect(handover.assignment_id).toEqual(expect.any(String))
    })

    it('making a worker inactive retires their looms', async () => {
        const f = await fixture()
        await updateWorker(f, f.leaver, { is_active: false })

        expect((await assignmentsOf(f.leaver)).map(item => [item.active, item.effective_to])).toEqual([[false, dates.yesterday], [false, dates.yesterday]])
        expect(await seatedOn(f, dates.today)).toEqual([f.stayer])
    })

    it('retires, rather than keeps, an assignment the operator guard would no longer accept', async () => {
        const f = await fixture()
        // The joining date moved past the assignment start, so keeping the row live would trip the guard.
        await updateWorker(f, f.leaver, { start_date: dates.yesterday })
        await updateWorker(f, f.leaver, { end_date: dates.today })

        expect((await assignmentsOf(f.leaver)).every(item => !item.active && item.effective_to === dates.today)).toBe(true)
    })

    it('does not touch other workers, other factories, or looms that already ended', async () => {
        const f = await fixture()
        const other = await fixture()
        await asUser(db, f.owner.userId, f.owner.orgId)
        await db.query('SELECT public.delete_base_worker_machine_assignment(id) FROM public.base_worker_machine_assignments WHERE worker_id = $1 AND machine_id = $2', [f.leaver, f.machines[1]])
        const endedBefore = (await assignmentsOf(f.leaver)).find(item => item.machine_id === f.machines[1])

        await updateWorker(f, f.leaver, { end_date: dates.twoDaysAgo })

        expect((await assignmentsOf(f.leaver)).find(item => item.machine_id === f.machines[1])).toEqual(endedBefore)
        expect((await assignmentsOf(f.stayer)).map(item => item.effective_to)).toEqual([null])
        expect((await assignmentsOf(other.leaver)).map(item => item.effective_to)).toEqual([null, null])
    })

    it('repairs looms a worker already left behind, by the reconcile or when the worker is next saved', async () => {
        const f = await fixture()
        // Workers inserted with an end date never passed through an update, like rows saved before the fix.
        const strand = async (name: string, machine: string) => {
            const id = randomUUID()
            await asSuperuser(db)
            await db.query("INSERT INTO public.base_production_workers(id, org_id, name, rate_per_meter, shift_availability, end_date) VALUES ($1, $2, $3, 9, 'night', $4)", [id, f.owner.orgId, name, dates.twoDaysAgo])
            await asUser(db, f.owner.userId, f.owner.orgId)
            await db.query('SELECT public.upsert_base_worker_machine_assignment($1, $2, $3, $4, true)', [id, machine, 'night', dates.weekAgo])
            expect((await assignmentsOf(id)).map(item => item.effective_to)).toEqual([null])
            return id
        }

        const reconciled = await strand('Gorthan Butani', f.machines[0])
        await asSuperuser(db)
        await db.query('SELECT private.end_departed_base_worker_assignments($1, $2)', [f.owner.orgId, reconciled])
        expect((await assignmentsOf(reconciled)).map(item => [item.active, item.effective_to])).toEqual([[true, dates.twoDaysAgo]])

        const resaved = await strand('Bhavesh', f.machines[1])
        await updateWorker(f, resaved, {})
        expect((await assignmentsOf(resaved)).map(item => [item.active, item.effective_to])).toEqual([[true, dates.twoDaysAgo]])
        // A second save changes nothing.
        await updateWorker(f, resaved, {})
        expect((await assignmentsOf(resaved)).map(item => [item.active, item.effective_to])).toEqual([[true, dates.twoDaysAgo]])
    })

    it('keeps the helper out of reach of signed-in users', async () => {
        const f = await fixture()
        await asUser(db, f.owner.userId, f.owner.orgId)
        const error = await pgError(db.query('SELECT private.end_departed_base_worker_assignments($1, $2)', [f.owner.orgId, f.leaver]))
        expect(error.code).toBe('42501')
    })
})
