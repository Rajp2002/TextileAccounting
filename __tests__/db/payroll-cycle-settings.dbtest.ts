import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getEarliestSafeCycleChangeDate } from '@/lib/payroll-cycle-engine'
import { getSuratTodayString } from '@/lib/time'
import { asSuperuser, freshDatabase, seedOwnerOrg, type Db } from './helpers'
import { createTestSupabase, type RpcCall } from './supabase-adapter'

// OS-13: the payroll cycle settings action (saveBasePayrollCycleConfig), end
// to end. When update_base_payroll_cycle refused a change, the action used to
// write base_payroll_cycle_configs directly, skipping the RPC's lock and its
// rule that a new cycle may not start before the current one.

type Actor = { userId: string; orgId: string }
const ctx = vi.hoisted(() => ({ db: undefined as unknown, actor: undefined as unknown, calls: [] as unknown[] }))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))
vi.mock('@/lib/auth', () => ({
    requireWritableOrg: async () => {
        const actor = ctx.actor as Actor
        return { user: { id: actor.userId }, profile: { id: actor.userId, org_id: actor.orgId, role: 'owner' } }
    },
}))
vi.mock('@/lib/subscription', () => ({ getOrgTier: async () => 'base' }))
vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => createTestSupabase(ctx.db as Db, { kind: 'user', ...(ctx.actor as Actor) }, ctx.calls as RpcCall[]),
}))

const { saveBasePayrollCycleConfig } = await import('@/app/(dashboard)/owner/production/actions')

let db: Db
let safeDay: (offset: number) => string

const monthly = (effectiveFrom: string) => saveBasePayrollCycleConfig({ cycleType: 'monthly', rule: { type: 'monthly', anchorDay: 1 }, effectiveFrom })
const weekly = (effectiveFrom: string) => saveBasePayrollCycleConfig({ cycleType: 'weekly', rule: { type: 'weekly', anchorWeekday: 'monday' }, effectiveFrom })

async function configs(orgId: string) {
    await asSuperuser(db)
    const { rows } = await db.query(
        'SELECT cycle_type, effective_from::text AS "from", effective_until::text AS "until" FROM public.base_payroll_cycle_configs WHERE org_id = $1 ORDER BY effective_from',
        [orgId],
    )
    return rows
}

async function newOwner() {
    ctx.actor = await seedOwnerOrg(db, { tier: 'base' })
    return ctx.actor as Actor
}

beforeAll(async () => {
    db = await freshDatabase()
    ctx.db = db
    // The action refuses a cycle that starts before the next payroll period, so
    // dates a fixed number of days from today only clear that guard late in the
    // month. Offset from the earliest date the action accepts instead, which
    // keeps every case the same on any day of the month.
    const earliest = getEarliestSafeCycleChangeDate({ today: getSuratTodayString() }).safeEffectiveDate
    safeDay = (offset: number) => {
        const date = new Date(earliest)
        date.setUTCDate(date.getUTCDate() + offset)
        return date.toISOString().slice(0, 10)
    }
})
afterAll(async () => { await db?.end() })
beforeEach(() => { (ctx.calls as RpcCall[]).length = 0 })

describe('payroll cycle settings (OS-13 fixed)', () => {
    it('INVARIANT: a later effective date goes through the RPC and closes the previous cycle', async () => {
        const owner = await newOwner()
        expect(await monthly(safeDay(10))).toMatchObject({ success: true, effectiveFrom: safeDay(10) })
        expect(await weekly(safeDay(20))).toMatchObject({ success: true, effectiveFrom: safeDay(20) })
        expect(await configs(owner.orgId)).toEqual([
            { cycle_type: 'monthly', from: safeDay(10), until: safeDay(19) },
            { cycle_type: 'weekly', from: safeDay(20), until: null },
        ])
        expect((ctx.calls as RpcCall[]).map(call => `${call.identity}:${call.fn}`)).toEqual(['user:update_base_payroll_cycle', 'user:update_base_payroll_cycle'])
    })

    it('INVARIANT OS-13: an effective date before the current cycle is refused and nothing changes', async () => {
        const owner = await newOwner()
        await monthly(safeDay(10))
        expect(await weekly(safeDay(5))).toEqual({ error: 'Failed to save payroll cycle configuration. Your existing settings have not changed.' })
        expect(await configs(owner.orgId)).toEqual([{ cycle_type: 'monthly', from: safeDay(10), until: null }])
    })

    it('INVARIANT: a same-day change updates the current cycle in place', async () => {
        const owner = await newOwner()
        await monthly(safeDay(10))
        expect(await weekly(safeDay(10))).toMatchObject({ success: true })
        expect(await configs(owner.orgId)).toEqual([{ cycle_type: 'weekly', from: safeDay(10), until: null }])
    })
})
