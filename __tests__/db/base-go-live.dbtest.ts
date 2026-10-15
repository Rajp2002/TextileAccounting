import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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
