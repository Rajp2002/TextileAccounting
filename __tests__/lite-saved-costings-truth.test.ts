import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { calcFullTotals } from '@/lib/estimator'
import { readAllPages, type PageResult } from '@/lib/paged-read'
import { buildSavedQualityRecipeState, canPriceSavedRecipe } from '@/lib/saved-costings'
import { f1State } from './fixtures/costing-characterization'

// LT04 P0 (LC71, LC73): Saved Costings shows no money it cannot support, keeps
// a load failure distinct from an empty library, and reads every costing.

describe('recipe-only quality cards', () => {
    const summaryOnly = { id: 'q-1', name: 'Poplin', updated_at: '2026-10-01T00:00:00Z', is_active: true }
    const fullRecipe = { ...summaryOnly, warp_rows: f1State().warpRows, weft_rows: f1State().weftRows }
    const profile = { warping_rate_per_kg: 12, overhead_mode: 'direct' as const, overhead_override_per_m: 2 }

    it('CHARACTERIZATION: the summary row priced through defaults yields a number that is not this recipe', () => {
        const fabricated = calcFullTotals(buildSavedQualityRecipeState(summaryOnly)).totalProductionCostPerM
        expect(Number.isFinite(fabricated)).toBe(true)
    })

    it('does not price a summary-only row or a recipe without the factory profile', () => {
        expect(canPriceSavedRecipe(summaryOnly, profile)).toBe(false)
        expect(canPriceSavedRecipe(fullRecipe, undefined)).toBe(false)
        expect(canPriceSavedRecipe({ ...fullRecipe, weft_rows: [] }, profile)).toBe(false)
        expect(canPriceSavedRecipe(fullRecipe, profile)).toBe(true)
    })

    it('Saved Costings only prices a recipe it can support and says when it did not', () => {
        const source = readFileSync('app/(dashboard)/owner/quotes/QuotesClient.tsx', 'utf8')
        expect(source).toContain('canPriceSavedRecipe(group.template, initialProfile)')
        expect(source).toContain("tx('Not calculated')")
    })
})

describe('a failed library load is not an empty library', () => {
    const page = readFileSync('app/(dashboard)/owner/quotes/page.tsx', 'utf8')
    const client = readFileSync('app/(dashboard)/owner/quotes/QuotesClient.tsx', 'utf8')

    it('passes the load failure to the client', () => {
        expect(page).toContain('loadError={Boolean(quotesError || templatesError)}')
    })

    it('shows a retryable error before any empty or sample state', () => {
        expect(client).toContain('data-saved-costings-load-error')
        expect(client).toContain('Saved costings could not be loaded. Nothing was deleted. Try again.')
        expect(client.indexOf('data-saved-costings-load-error')).toBeLessThan(client.indexOf("data-costing-tour=\"sample\""))
        expect(client).toMatch(/const isDemoCostingActive = !loadError && /)
    })
})

type Row = { id: string; created_at: string }

/** A fake table read by keyset after (created_at desc, id desc), with a server row cap. */
function fakeTable(rows: Row[], options: { cap?: number; failOnPage?: number; onPage?: (page: number) => void } = {}) {
    const sorted = () => [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
    let page = 0
    return async (after: Row | null): Promise<PageResult<Row>> => {
        page += 1
        options.onPage?.(page)
        if (options.failOnPage === page) return { data: null, error: { message: 'connection reset' } }
        const remaining = sorted().filter(row => !after || row.created_at < after.created_at || (row.created_at === after.created_at && row.id < after.id))
        return { data: remaining.slice(0, Math.min(1000, options.cap ?? 1000)), error: null }
    }
}

const manyRows = (count: number) => Array.from({ length: count }, (_, index) => ({
    id: `row-${String(index).padStart(5, '0')}`,
    // Long runs of equal timestamps exercise the id tie-break.
    created_at: `2026-09-${String(1 + Math.floor(index / 500)).padStart(2, '0')}T00:00:00Z`,
}))

describe('readAllPages', () => {
    it('reads every row once across pages with equal timestamps, whatever the server cap', async () => {
        const rows = manyRows(2345)
        for (const cap of [1000, 400, 1]) {
            const result = await readAllPages(fakeTable(rows.slice(0, cap === 1 ? 7 : 2345), { cap }))
            const expected = cap === 1 ? 7 : 2345
            expect(result.error).toBeNull()
            expect(result.data).toHaveLength(expected)
            expect(new Set(result.data!.map(row => row.id)).size).toBe(expected)
        }
    })

    it('fails the whole read when any page fails', async () => {
        const result = await readAllPages(fakeTable(manyRows(2345), { failOnPage: 2 }))
        expect(result).toMatchObject({ data: null, error: { message: 'connection reset' } })
    })

    it('neither misses nor repeats rows when a newer row is added while reading', async () => {
        const rows = manyRows(1500)
        const result = await readAllPages(fakeTable(rows, {
            onPage: page => { if (page === 2) rows.push({ id: 'row-new', created_at: '2026-10-04T00:00:00Z' }) },
        }))
        expect(result.data).toHaveLength(1500)
        expect(new Set(result.data!.map(row => row.id)).size).toBe(1500)
    })

    it('stops with an error if a page does not advance', async () => {
        const stuck = async (): Promise<PageResult<Row>> => ({ data: [{ id: 'a', created_at: 'x' }], error: null })
        const result = await readAllPages(stuck)
        expect(result.error?.message).toMatch(/could not be loaded completely/)
    })
})

describe('the costing library read uses the paged reader', () => {
    it('orders deterministically and reads after the last row', () => {
        const actions = readFileSync('app/(dashboard)/owner/estimator/actions.ts', 'utf8')
        const read = actions.slice(actions.indexOf('export async function getEstimatorQuotes'), actions.indexOf('export async function getEstimatorQuoteDetail'))
        expect(read).toMatch(/readAllPages(<\w+>)?\(/)
        expect(read).toContain(".order('created_at', { ascending: false })")
        expect(read).toContain(".order('id', { ascending: false })")
        expect(read).toContain('createdAtDescendingAfter(after)')
    })
})
