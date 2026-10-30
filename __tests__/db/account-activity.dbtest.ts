import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asServiceRole, asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

// Release 1 activity tracking (spec 2026-10-30 section A): one private row per
// org, owner and India day, written only through the clamped recorder.

let db: Db
let owner: { userId: string; orgId: string }

type DayRow = {
    active_minutes: number; area_minutes: Record<string, number>; phone_minutes: number; tablet_minutes: number
    desktop_minutes: number; installed_minutes: number; first_seen_at: Date | null; last_seen_at: Date | null
}

async function record(minutes: number, areas: Record<string, number>, device = 'phone', installed = false): Promise<number> {
    await asServiceRole(db)
    const { rows } = await db.query('SELECT public.record_account_activity($1,$2,$3,$4::jsonb,$5,$6) AS accepted',
        [owner.userId, owner.orgId, minutes, JSON.stringify(areas), device, installed])
    return rows[0].accepted
}

const TODAY = "(now() AT TIME ZONE 'Asia/Kolkata')::date"

async function today(): Promise<DayRow> {
    await asSuperuser(db)
    const { rows } = await db.query(`SELECT * FROM private.account_activity_days WHERE org_id=$1 AND user_id=$2 AND day=${TODAY}`, [owner.orgId, owner.userId])
    return rows[0]
}

/** Superuser UPDATE of today's row; values are SQL expressions so clamps start from a known elapsed time. */
async function setRow(patch: Record<string, string>) {
    await asSuperuser(db)
    const assignments = Object.entries(patch).map(([column, expression]) => `${column} = ${expression}`).join(', ')
    await db.query(`UPDATE private.account_activity_days SET ${assignments} WHERE org_id=$1 AND user_id=$2 AND day=${TODAY}`, [owner.orgId, owner.userId])
}

beforeAll(async () => {
    db = await freshDatabase()
    owner = await seedOwnerOrg(db, { tier: 'lite' })
})
afterAll(async () => { await db?.end() })

describe('account activity recorder', () => {
    it('records minutes, areas and device on the India day', async () => {
        expect(await record(5, { estimator: 3, rate_book: 2 }, 'phone', true)).toBe(5)
        const row = await today()
        expect(row).toMatchObject({ active_minutes: 5, phone_minutes: 5, tablet_minutes: 0, desktop_minutes: 0, installed_minutes: 5, area_minutes: { estimator: 3, rate_book: 2 } })
        expect(row.first_seen_at).toBeTruthy()
        expect(row.last_seen_at).toBeTruthy()
    })

    it('clamps a second flush to the elapsed time, so two windows cannot double count', async () => {
        await setRow({ last_flush_at: "now() - interval '30 seconds'" })
        expect(await record(5, { estimator: 5 })).toBe(2)
        expect(await today()).toMatchObject({ active_minutes: 7, area_minutes: { estimator: 5, rate_book: 2 } })
    })

    it('scales area minutes down to the accepted total', async () => {
        await setRow({ last_flush_at: "now() - interval '150 seconds'" })
        expect(await record(9, { estimator: 6, saved_costings: 3 })).toBe(4)
        expect(await today()).toMatchObject({ active_minutes: 11, area_minutes: { estimator: 7, saved_costings: 1, rate_book: 2 } })
    })

    it('caps the day at 1440 minutes', async () => {
        await setRow({ active_minutes: '1438', last_flush_at: "now() - interval '1 hour'" })
        expect(await record(10, { other: 10 })).toBe(2)
        expect((await today()).active_minutes).toBe(1440)
    })

    it('rejects unknown areas, bad values and devices', async () => {
        expect((await pgError(record(1, { cart: 1 }))).code).toBe('22023')
        expect((await pgError(record(1, { estimator: -1 }))).code).toBe('22023')
        expect((await pgError(record(1, { estimator: 1.5 }))).code).toBe('22023')
        expect((await pgError(record(11, { estimator: 1 }))).code).toBe('22023')
        expect((await pgError(record(1, { estimator: 1 }, 'watch'))).code).toBe('22023')
    })

    it('is closed to signed-in clients', async () => {
        await asUser(db, owner.userId, owner.orgId)
        expect((await pgError(db.query('SELECT * FROM private.account_activity_days'))).code).toBe('42501')
        expect((await pgError(db.query("SELECT public.record_account_activity($1,$2,1,'{}'::jsonb,'phone',false)", [owner.userId, owner.orgId]))).code).toBe('42501')
    })
})
