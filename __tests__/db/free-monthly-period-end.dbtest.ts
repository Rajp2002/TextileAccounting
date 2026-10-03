import { createHash, randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asServiceRole, asSuperuser, freshDatabase, seedOwnerOrg, type Db } from './helpers'

// FR05: Free monthly period_end follows the India-time calendar month. The
// debit computed it by adding a month to the IST start instant in UTC, which
// ends March, May, July, October and December early. Only the stored and
// returned metadata was wrong; bucket selection used the correct start.

const MIGRATIONS = join(process.cwd(), 'supabase/migrations')
const migrationFile = readdirSync(MIGRATIONS).find(name => name.endsWith('_free_monthly_period_end_local_month.sql'))
const IST = 330 * 60_000
/** Independent oracle: India has kept UTC+05:30 without DST since 1945. */
const istMonthStart = (year: number, month: number) => new Date(Date.UTC(year, month, 1) - IST).toISOString()
/** Rows from the untyped test client. */
type Row = Record<string, unknown>
type UsageRow = Row & { period_start: string; period_end: string }
/** The test client may return timestamptz as Date or text. */
const iso = (value: unknown) => new Date(value as string).toISOString()

let db: Db
let free: { userId: string; orgId: string }

async function monthEnd(start: string) {
    const { rows } = await db.query("SELECT public.free_local_month_end($1::timestamptz, 'Asia/Kolkata') AS end_at", [start])
    return iso(rows[0].end_at)
}

async function usageRows(): Promise<UsageRow[]> {
    await asSuperuser(db)
    const { rows } = await db.query(
        `SELECT subject_id, period_start, period_end, policy_version, allowance, used
           FROM public.free_monthly_usage WHERE subject_id = $1 ORDER BY period_start`,
        [free.userId],
    )
    return rows.map((row: Row) => ({ ...row, period_start: iso(row.period_start), period_end: iso(row.period_end) }))
}

async function protectedCounts() {
    await asSuperuser(db)
    const { rows } = await db.query(
        `SELECT (SELECT count(*)::int FROM public.free_calculation_receipts) AS receipts,
                (SELECT count(*)::int FROM public.free_saved_costings) AS snapshots,
                (SELECT md5(string_agg(s::text, '|' ORDER BY s::text)) FROM public.free_saved_costings s) AS snapshot_hash`,
    )
    return rows[0]
}

async function reapplyMigration() {
    await asSuperuser(db)
    await db.query(readFileSync(join(MIGRATIONS, migrationFile!), 'utf8'))
}

beforeAll(async () => {
    db = await freshDatabase()
    free = await seedOwnerOrg(db, { tier: null, name: 'Free Weaver' })
    await asSuperuser(db)
    await db.query('INSERT INTO public.free_account_subjects(id, verified_at, beta_allowed) VALUES ($1, now(), true)', [free.userId])
    await db.query('INSERT INTO public.free_account_grants(org_id, subject_id) VALUES ($1, $2)', [free.orgId, free.userId])
    await db.query('UPDATE public.free_rollout SET estimation_enabled = true')
})
afterAll(async () => { await db?.end() })

describe('FR05 India-time month end', () => {
    it('ships as a separate forward migration', () => {
        expect(migrationFile).toBeTruthy()
    })

    it('ends every month of a year at the next IST month start, including the short-preceding-month cases', async () => {
        await asSuperuser(db)
        for (let month = 0; month < 12; month++) {
            expect(await monthEnd(istMonthStart(2026, month))).toBe(istMonthStart(2026, month + 1))
        }
        // December into January, and a leap-year February into March.
        expect(await monthEnd(istMonthStart(2026, 11))).toBe('2026-12-31T18:30:00.000Z')
        expect(await monthEnd(istMonthStart(2028, 1))).toBe('2028-02-29T18:30:00.000Z')
        expect(await monthEnd(istMonthStart(2028, 2))).toBe('2028-03-31T18:30:00.000Z')
    })

    it('does not depend on the database session time zone', async () => {
        await asSuperuser(db)
        for (const zone of ['UTC', 'America/New_York', 'Asia/Kolkata', 'Pacific/Kiritimati']) {
            await db.query(`SET TIME ZONE '${zone}'`)
            expect(await monthEnd(istMonthStart(2026, 2))).toBe('2026-03-31T18:30:00.000Z')
            expect(await monthEnd(istMonthStart(2026, 9))).toBe('2026-10-31T18:30:00.000Z')
        }
        await db.query('RESET TIME ZONE')
    })

    it('treats an instant either side of IST midnight as belonging to its own local month', async () => {
        await asSuperuser(db)
        const { rows } = await db.query(
            `SELECT public.free_local_month_end(date_trunc('month', $1::timestamptz AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata', 'Asia/Kolkata') AS before_midnight,
                    public.free_local_month_end(date_trunc('month', $2::timestamptz AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata', 'Asia/Kolkata') AS after_midnight`,
            ['2026-10-31T18:29:59.999Z', '2026-10-31T18:30:00.000Z'],
        )
        expect(iso(rows[0].before_midnight)).toBe('2026-10-31T18:30:00.000Z')
        expect(iso(rows[0].after_midnight)).toBe('2026-11-30T18:30:00.000Z')
    })

    it('a new debit stores and returns the correct end for the current month, whatever the session zone', async () => {
        await asSuperuser(db)
        await db.query("SET TIME ZONE 'America/New_York'")
        await asServiceRole(db)
        const { rows } = await db.query(
            `SELECT public.complete_free_saved_costing($1, $2, $3, $4, 'estimator_v3_2026_08', $5, 'Test costing', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb) AS quota`,
            [free.userId, free.orgId, randomUUID(), createHash('sha256').update('fr05').digest('hex'), new Date(Date.now() - 60_000).toISOString()],
        )
        await asSuperuser(db)
        await db.query('RESET TIME ZONE')
        const now = new Date(Date.now() + IST)
        const expectedStart = istMonthStart(now.getUTCFullYear(), now.getUTCMonth())
        const expectedEnd = istMonthStart(now.getUTCFullYear(), now.getUTCMonth() + 1)
        expect(iso(rows[0].quota.periodStart)).toBe(expectedStart)
        expect(iso(rows[0].quota.resetsAt)).toBe(expectedEnd)
        const stored = (await usageRows()).find(row => row.period_start === expectedStart)
        expect(stored?.period_end).toBe(expectedEnd)
    })
})

describe('FR05 metadata-only backfill', () => {
    const march = istMonthStart(2026, 2), may = istMonthStart(2026, 4), august = istMonthStart(2026, 7)
    // Historical weekly bucket under policy version 1, and a month-policy row
    // whose start is not a local month start (an anomaly for review).
    const weeklyStart = '2026-09-06T18:30:00.000Z', weeklyEnd = '2026-09-13T18:30:00.000Z'
    const oddStart = '2026-06-15T00:00:00.000Z', oddEnd = '2026-07-15T00:00:00.000Z'
    let before: Awaited<ReturnType<typeof usageRows>>
    let countsBefore: Awaited<ReturnType<typeof protectedCounts>>

    beforeAll(async () => {
        await asSuperuser(db)
        const insert = 'INSERT INTO public.free_monthly_usage(subject_id, period_start, period_end, policy_version, allowance, used) VALUES ($1, $2, $3, $4, 2, $5)'
        // The pre-fix UTC arithmetic: March ends 28 Mar, May ends 30 May.
        await db.query(insert, [free.userId, march, '2026-03-28T18:30:00.000Z', 2, 2])
        await db.query(insert, [free.userId, may, '2026-05-30T18:30:00.000Z', 2, 0])
        await db.query(insert, [free.userId, august, istMonthStart(2026, 8), 2, 1])
        await db.query(insert, [free.userId, weeklyStart, weeklyEnd, 1, 1])
        await db.query(insert, [free.userId, oddStart, oddEnd, 2, 1])
        // A receipt still references the March bucket; replay must keep finding it.
        await db.query(
            `INSERT INTO public.free_calculation_receipts(request_id, subject_id, period_start, input_binding, engine_version, issued_at, completed_at, expires_at)
             VALUES ($1, $2, $3, $4, 'estimator_v3_2026_08', $5, $5, $6)`,
            [randomUUID(), free.userId, march, createHash('sha256').update('march').digest('hex'), '2026-03-10T05:00:00.000Z', '2099-01-01T00:00:00.000Z'],
        )
        before = await usageRows()
        countsBefore = await protectedCounts()
        await reapplyMigration()
    })

    it('corrects only period_end on month-policy rows, and only where it was wrong', async () => {
        const after = await usageRows()
        const byStart = (rows: typeof after, start: string) => rows.find(row => row.period_start === start)
        expect(byStart(after, march)).toEqual({ ...byStart(before, march), period_end: '2026-03-31T18:30:00.000Z' })
        expect(byStart(after, may)).toEqual({ ...byStart(before, may), period_end: '2026-05-31T18:30:00.000Z' })
        expect(byStart(after, august)).toEqual(byStart(before, august))
    })

    it('leaves historical weekly rows and anomalies for review untouched', async () => {
        const after = await usageRows()
        expect(after.find(row => row.period_start === weeklyStart)).toEqual(before.find(row => row.period_start === weeklyStart))
        expect(after.find(row => row.period_start === oddStart)).toEqual(before.find(row => row.period_start === oddStart))
    })

    it('never refills: used, allowance, start and policy are unchanged, as are receipts and saved snapshots', async () => {
        const after = await usageRows()
        const counted = (rows: typeof after) => rows.map(row => [row.subject_id, row.period_start, row.policy_version, row.allowance, row.used])
        expect(counted(after)).toEqual(counted(before))
        expect(await protectedCounts()).toEqual(countsBefore)
    })

    it('is idempotent', async () => {
        const once = await usageRows()
        await reapplyMigration()
        expect(await usageRows()).toEqual(once)
        expect(await protectedCounts()).toEqual(countsBefore)
    })
})
