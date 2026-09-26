import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { asSuperuser, freshDatabase, seedOwnerOrg, type Db } from './helpers'
import { createTestSupabase, type RpcCall } from './supabase-adapter'

// Fix package F2 (AS-01): Base onboarding's payroll step, end to end. The
// action used to retry refused writes with the service-role client, so a
// Lite, unpaid or locked owner could write base_payroll_cycle_configs.

type Actor = { userId: string; orgId: string }
const ctx = vi.hoisted(() => ({ db: undefined as unknown, actor: undefined as unknown, calls: [] as unknown[], adminUsed: 0 }))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))
vi.mock('@/lib/auth', () => {
    const session = async () => {
        const actor = ctx.actor as Actor
        return { user: { id: actor.userId }, profile: { id: actor.userId, org_id: actor.orgId, role: 'owner' } }
    }
    return { requireRole: session, requireWritableOrg: session }
})
vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => createTestSupabase(ctx.db as Db, { kind: 'user', ...(ctx.actor as Actor) }, ctx.calls as RpcCall[]),
}))
vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: () => {
        ctx.adminUsed += 1
        return createTestSupabase(ctx.db as Db, { kind: 'service' }, ctx.calls as RpcCall[])
    },
}))

const { saveBaseOnboardingPayrollAction } = await import('@/app/(auth)/onboarding/base/actions')

let db: Db

async function activeConfigs(orgId: string) {
    await asSuperuser(db)
    const { rows } = await db.query(
        'SELECT cycle_type, rule FROM public.base_payroll_cycle_configs WHERE org_id = $1 AND effective_until IS NULL',
        [orgId],
    )
    return rows as { cycle_type: string; rule: Record<string, unknown> }[]
}

beforeAll(async () => {
    db = await freshDatabase()
    ctx.db = db
})
afterAll(async () => { await db?.end() })
beforeEach(() => {
    ;(ctx.calls as RpcCall[]).length = 0
    ctx.adminUsed = 0
})

describe('Base onboarding payroll step (AS-01 fixed)', () => {
    it('INVARIANT: a Base owner saves the cycle, and a same-day change updates it in place', async () => {
        const base = await seedOwnerOrg(db, { tier: 'base' })
        ctx.actor = base
        expect(await saveBaseOnboardingPayrollAction({ cycleType: 'monthly', anchorDay: 1 })).toEqual({ success: true })
        expect(await saveBaseOnboardingPayrollAction({ cycleType: 'weekly', anchorWeekday: 'monday' })).toEqual({ success: true })
        expect(await activeConfigs(base.orgId)).toEqual([{ cycle_type: 'weekly', rule: { type: 'weekly', anchorWeekday: 'monday' } }])
        expect((ctx.calls as RpcCall[]).map(call => `${call.identity}:${call.fn}`)).toEqual(['user:update_base_payroll_cycle', 'user:update_base_payroll_cycle'])
        expect(ctx.adminUsed).toBe(0)
    })

    it('INVARIANT: a Lite owner is refused and nothing is written, with no service-role retry', async () => {
        const lite = await seedOwnerOrg(db, { tier: 'lite' })
        ctx.actor = lite
        expect(await saveBaseOnboardingPayrollAction({ cycleType: 'monthly', anchorDay: 1 })).toEqual({ error: 'Failed to configure payroll cycle. Please try again.' })
        expect(await activeConfigs(lite.orgId)).toEqual([])
        expect(ctx.adminUsed).toBe(0)
    })
})
