import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    filterCostRates,
    type CostRateRow,
} from '../lib/cost-rates'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

const sampleRates: CostRateRow[] = [
    {
        id: '11111111-1111-4111-8111-111111111111',
        name: '30/1000 Multi',
        category: 'yarn_warp',
        unit: 'per_kg',
        current_value: 162,
        previous_value: 158,
        effective_date: '2026-07-01',
        last_reviewed_at: '2026-07-01',
        review_interval_days: 90,
        source: 'Sitaram Yarns',
        notes: 'Mill standard',
        apply_as_default: true,
        updated_at: '2026-07-01T00:00:00Z',
        fabric_names: ['Cotton Rich Shirting', 'Poplin 60s'],
    },
    {
        id: '22222222-2222-4222-8222-222222222222',
        name: '80/72 Roto Polyester',
        category: 'yarn_weft',
        unit: 'per_kg',
        current_value: 146,
        previous_value: 140,
        effective_date: '2026-04-01',
        last_reviewed_at: '2026-04-01',
        review_interval_days: 60, // Overdue by July 2026
        source: 'Surat Syndicate',
        notes: 'Textured weft yarn',
        apply_as_default: false,
        updated_at: '2026-04-01T00:00:00Z',
        fabric_names: ['Poly Georgette'],
    },
    {
        id: '33333333-3333-4333-8333-333333333333',
        name: '40s Combed Cotton',
        category: 'yarn_weft',
        unit: 'per_kg',
        current_value: 235,
        previous_value: null,
        effective_date: '2026-07-15',
        last_reviewed_at: '2026-07-15',
        review_interval_days: 90,
        source: 'Saved quality',
        notes: null,
        apply_as_default: false,
        updated_at: '2026-07-15T00:00:00Z',
        is_reviewed: false, // Discovered & needs review
        fabric_names: ['Premium Oxford'],
    },
]

describe('Rate Book P1: Live Search & Filtering', () => {
    const mockNow = new Date('2026-07-19T00:00:00Z')

    it('searches yarn rates by name, count, or partial text case-insensitively', () => {
        const resultName = filterCostRates(sampleRates, { query: 'multi', category: 'all', status: 'all' }, mockNow)
        expect(resultName.map(r => r.name)).toEqual(['30/1000 Multi'])

        const resultCount = filterCostRates(sampleRates, { query: '80/72', category: 'all', status: 'all' }, mockNow)
        expect(resultCount.map(r => r.name)).toEqual(['80/72 Roto Polyester'])
    })

    it('searches yarn rates by linked fabric usage', () => {
        const result = filterCostRates(sampleRates, { query: 'Georgette', category: 'all', status: 'all' }, mockNow)
        expect(result.map(r => r.name)).toEqual(['80/72 Roto Polyester'])
    })

    it('searches yarn rates by source or notes', () => {
        const result = filterCostRates(sampleRates, { query: 'Sitaram', category: 'all', status: 'all' }, mockNow)
        expect(result.map(r => r.name)).toEqual(['30/1000 Multi'])
    })

    it('filters by category direction: all, yarn_warp, yarn_weft', () => {
        const all = filterCostRates(sampleRates, { query: '', category: 'all', status: 'all' }, mockNow)
        expect(all.length).toBe(3)

        const warp = filterCostRates(sampleRates, { query: '', category: 'yarn_warp', status: 'all' }, mockNow)
        expect(warp.map(r => r.name)).toEqual(['30/1000 Multi'])

        const weft = filterCostRates(sampleRates, { query: '', category: 'yarn_weft', status: 'all' }, mockNow)
        expect(weft.map(r => r.name)).toEqual(['80/72 Roto Polyester', '40s Combed Cotton'])
    })

    it('filters by status: needs_review isolates overdue and unreviewed yarns', () => {
        const needsReview = filterCostRates(sampleRates, { query: '', category: 'all', status: 'needs_review' }, mockNow)
        // 80/72 Roto is overdue, 40s Combed Cotton is is_reviewed: false
        expect(needsReview.map(r => r.name)).toEqual(['80/72 Roto Polyester', '40s Combed Cotton'])
    })

    it('combines search, direction, and review status seamlessly', () => {
        const combined = filterCostRates(
            sampleRates,
            { query: 'combed', category: 'yarn_weft', status: 'needs_review' },
            mockNow,
        )
        expect(combined.map(r => r.name)).toEqual(['40s Combed Cotton'])
    })
})

describe('Rate Book P1: Server Action batch review (confirmAllCostRateReviews)', () => {
    const actions = read('app/(dashboard)/owner/rates/actions.ts')

    it('exports confirmAllCostRateReviews server action with proper typing', () => {
        expect(actions).toContain('export async function confirmAllCostRateReviews(')
        expect(actions).toContain('ratesToReview: { id: string; expectedUpdatedAt: string }[]')
        expect(actions).toContain('Promise<{ data?: CostRateRow[]; count?: number; error?: string }>')
    })

    it('validates batch array input, UUID patterns, and timestamps', () => {
        expect(actions).toContain("if (!Array.isArray(ratesToReview)) return { error: 'Invalid rates payload.' }")
        expect(actions).toContain('if (ratesToReview.length === 0) return { data: [], count: 0 }')
        expect(actions).toContain('UUID_PATTERN.test(item.id)')
        expect(actions).toContain('Number.isFinite(Date.parse(item.expectedUpdatedAt))')
    })

    it('enforces owner role, base tier check, and audit actor', () => {
        const fnStart = actions.indexOf('export async function confirmAllCostRateReviews')
        const fnBody = actions.slice(fnStart, fnStart + 1800)
        expect(fnBody).toContain("requireRole(['owner'])")
        expect(fnBody).toContain('requireBaseTier(profile.org_id)')
        expect(fnBody).toContain('setAuditActor(supabase, user.id)')
    })

    it('executes atomic RPC for each rate and revalidates paths', () => {
        const fnStart = actions.indexOf('export async function confirmAllCostRateReviews')
        const fnBody = actions.slice(fnStart, fnStart + 1800)
        expect(fnBody).toContain("supabase.rpc('review_cost_rate_atomic'")
        expect(fnBody).toContain("revalidatePath('/owner/rates')")
        expect(fnBody).toContain("revalidatePath('/owner/estimator')")
        expect(fnBody).toContain('return { data: updatedRates, count: updatedRates.length }')
    })
})

describe('Rate Book P1: UI & Interaction Wiring in RatesClient.tsx', () => {
    const client = read('app/(dashboard)/owner/rates/RatesClient.tsx')

    it('implements 1-click review execution without modal takeover', () => {
        expect(client).toContain('handleQuickReview')
        // Primary row and card buttons call handleQuickReview directly on click
        expect(client).toContain('onClick={() => handleQuickReview(rate)}')
        expect(client).toContain('Confirming…')
        expect(client).toContain('Existing costing snapshots were not changed.')
    })

    it('implements batch review with a Confirm All button in the review queue', () => {
        expect(client).toContain('handleConfirmAll')
        expect(client).toContain('Confirm All (')
        expect(client).toContain('as Current')
        expect(client).toContain('confirmAllCostRateReviews')
        expect(client).toContain('onClick={handleConfirmAll}')
    })

    it('provides keyboard-friendly search with / focus shortcut and clear button', () => {
        expect(client).toContain("event.key === '/'")
        expect(client).toContain("event.key === 'Escape'")
        expect(client).toContain('searchRef.current?.focus()')
        expect(client).toContain('Search yarn rates')
        expect(client).toContain('Clear search')
    })

    it('provides 3-way segmented direction control (All, Warp, Weft) and the Needs Review queue', () => {
        expect(client).toContain('value={categoryFilter}')
        expect(client).toContain('onValueChange={setCategoryFilter}')
        expect(client).toContain("{ value: 'yarn_warp', label: 'Warp' }")
        expect(client).toContain("{ value: 'yarn_weft', label: 'Weft' }")
        expect(client).not.toContain('statusFilter')
        expect(client).toContain("{tx('Needs Review')}")
    })
})
