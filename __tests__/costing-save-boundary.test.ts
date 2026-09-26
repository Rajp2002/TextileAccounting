import { beforeEach, describe, expect, it, vi } from 'vitest'
import { F1, f1State } from './fixtures/costing-characterization'

// Refactor Package 1A, C-INV-17: the paid save recomputes the costing on the
// server and requires the client's production cost and price to equal the
// server values after 2dp rounding. It had no test before this package.

const writes = vi.hoisted(() => ({ adminCalls: [] as string[], revalidated: [] as string[] }))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: (path: string) => { writes.revalidated.push(path) } }))
vi.mock('@/lib/auth', () => ({
    requireRole: vi.fn(async () => ({
        user: { id: '10000000-0000-4000-8000-000000000001' },
        profile: { id: '10000000-0000-4000-8000-000000000001', org_id: '20000000-0000-4000-8000-000000000001', role: 'owner' },
    })),
}))

// Reads return "nothing saved yet": no replay row and no existing template names.
function emptyQuery() {
    const query: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'neq', 'in', 'order', 'limit', 'is']) query[method] = () => query
    query.maybeSingle = async () => ({ data: null, error: null })
    query.single = async () => ({ data: null, error: null })
    query.then = (resolve: (value: unknown) => unknown) => resolve({ data: [], error: null })
    return query
}
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({ from: () => emptyQuery() })),
}))
// Any admin use after the boundary is recorded and stopped, so a passing
// boundary is observable without performing a save.
vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: vi.fn(() => new Proxy({}, {
        get: (_target, property) => (...args: unknown[]) => {
            writes.adminCalls.push(`${String(property)}:${String(args[0] ?? '')}`)
            throw new Error('admin client reached after the total check')
        },
    })),
}))

const { saveEstimatorQuoteV3 } = await import('@/app/(dashboard)/owner/estimator/actions')

function save(totalProductionCostPerM: number, quotePricePerM: number) {
    return saveEstimatorQuoteV3({
        clientRequestId: '30000000-0000-4000-8000-000000000001',
        qualityLabel: 'Package 1A boundary quality',
        estimate: f1State(),
        totalProductionCostPerM,
        quotePricePerM,
    })
}

const MISMATCH = 'The estimate changed before it was saved. Review the recalculated totals and save again.'

describe('paid costing save total boundary (Package 1A)', () => {
    beforeEach(() => {
        writes.adminCalls.length = 0
        writes.revalidated.length = 0
    })

    it('INVARIANT C-INV-17: a production cost one paisa away from the server value is rejected before any write', async () => {
        await expect(save(F1.result.productionCostPerM + 0.01, F1.result.suggestedSellingPricePerM)).resolves.toEqual({ error: MISMATCH })
        expect(writes.adminCalls).toEqual([])
        expect(writes.revalidated).toEqual([])
    })

    it('INVARIANT C-INV-17: a price one paisa away from the server value is rejected before any write', async () => {
        await expect(save(F1.result.productionCostPerM, F1.result.suggestedSellingPricePerM - 0.01)).resolves.toEqual({ error: MISMATCH })
        expect(writes.adminCalls).toEqual([])
    })

    it('INVARIANT C-INV-17: unrounded client values that round to the server values are accepted', async () => {
        // The client sends raw engine values; the server rounds half-up first.
        await expect(save(F1.productionCostRawPerM, 31.444870588235294)).rejects.toThrow('admin client reached after the total check')
        expect(writes.adminCalls.length).toBeGreaterThan(0)
    })

    it('INVARIANT C-INV-17: exact server values pass the boundary and continue to the save', async () => {
        await expect(save(F1.result.productionCostPerM, F1.result.suggestedSellingPricePerM)).rejects.toThrow('admin client reached after the total check')
        expect(writes.adminCalls.length).toBeGreaterThan(0)
    })
})
