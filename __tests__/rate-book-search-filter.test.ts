import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    filterCostRates,
    getRateReviewStatus,
    type CostRateRow,
} from '../lib/cost-rates'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

const sampleRates: CostRateRow[] = [
    {
        id: '10000000-0000-4000-8000-000000000001',
        name: '80/72 Roto Polyester',
        category: 'yarn_warp',
        unit: 'per_kg',
        current_value: 146,
        previous_value: 142,
        effective_date: '2026-08-01',
        last_reviewed_at: '2026-08-01',
        review_interval_days: 90,
        source: 'Sanjay Broker WhatsApp',
        notes: 'High speed loom warp',
        apply_as_default: true,
        fabric_names: ['Cotton Roto Sheeting', 'Airjet Twill'],
        discovery_source: 'saved_costing',
        is_reviewed: true,
        updated_at: '2026-08-01T00:00:00Z',
    },
    {
        id: '10000000-0000-4000-8000-000000000002',
        name: '30/1000 MUALTI Cotton',
        category: 'yarn_weft',
        unit: 'per_kg',
        current_value: 285,
        previous_value: 280,
        effective_date: '2026-06-01',
        last_reviewed_at: '2026-06-01',
        review_interval_days: 30, // overdue as of mid-July 2026
        source: 'Surat Central Market',
        notes: 'Carded weft yarn',
        apply_as_default: false,
        fabric_names: ['Assam Silk Fine'],
        discovery_source: 'saved_quality',
        is_reviewed: true,
        updated_at: '2026-06-01T00:00:00Z',
    },
    {
        id: '10000000-0000-4000-8000-000000000003',
        name: '150D Bright Slub',
        category: 'yarn_weft',
        unit: 'per_kg',
        current_value: 118,
        previous_value: null,
        effective_date: '2026-07-10',
        last_reviewed_at: '2026-07-10',
        review_interval_days: 60,
        source: null,
        notes: null,
        apply_as_default: false,
        fabric_names: [],
        discovery_source: null,
        is_reviewed: false, // needs owner review
        updated_at: '2026-07-10T00:00:00Z',
    },
]

describe('Rate Book Live Search & Quick Filter logic', () => {
    const asOf = new Date('2026-07-19T00:00:00Z')

    it('searches by yarn name case-insensitively and handles count numbers', () => {
        const resultsByNumber = filterCostRates(sampleRates, { query: '80', category: 'all', status: 'all' }, asOf)
        expect(resultsByNumber.map(r => r.name)).toEqual(['80/72 Roto Polyester'])

        const resultsByPartial = filterCostRates(sampleRates, { query: 'slub', category: 'all', status: 'all' }, asOf)
        expect(resultsByPartial.map(r => r.name)).toEqual(['150D Bright Slub'])
    })

    it('searches by broker/supplier source name and notes', () => {
        const resultsBySource = filterCostRates(sampleRates, { query: 'whatsapp', category: 'all', status: 'all' }, asOf)
        expect(resultsBySource.map(r => r.name)).toEqual(['80/72 Roto Polyester'])

        const resultsByNotes = filterCostRates(sampleRates, { query: 'carded', category: 'all', status: 'all' }, asOf)
        expect(resultsByNotes.map(r => r.name)).toEqual(['30/1000 MUALTI Cotton'])
    })

    it('searches by linked fabric name usage', () => {
        const resultsByFabric = filterCostRates(sampleRates, { query: 'assam silk', category: 'all', status: 'all' }, asOf)
        expect(resultsByFabric.map(r => r.name)).toEqual(['30/1000 MUALTI Cotton'])

        const resultsBySecondFabric = filterCostRates(sampleRates, { query: 'airjet twill', category: 'all', status: 'all' }, asOf)
        expect(resultsBySecondFabric.map(r => r.name)).toEqual(['80/72 Roto Polyester'])
    })

    it('filters by category direction: all, yarn_warp, yarn_weft', () => {
        const allRates = filterCostRates(sampleRates, { query: '', category: 'all', status: 'all' }, asOf)
        expect(allRates).toHaveLength(3)

        const warpRates = filterCostRates(sampleRates, { query: '', category: 'yarn_warp', status: 'all' }, asOf)
        expect(warpRates.map(r => r.name)).toEqual(['80/72 Roto Polyester'])

        const weftRates = filterCostRates(sampleRates, { query: '', category: 'yarn_weft', status: 'all' }, asOf)
        expect(weftRates.map(r => r.name)).toEqual(['30/1000 MUALTI Cotton', '150D Bright Slub'])
    })

    it('filters by status: needs_review isolates both unreviewed and overdue rates', () => {
        const reviewRates = filterCostRates(sampleRates, { query: '', category: 'all', status: 'needs_review' }, asOf)
        expect(reviewRates.map(r => r.name)).toEqual(['30/1000 MUALTI Cotton', '150D Bright Slub'])
        expect(getRateReviewStatus(sampleRates[0], asOf)).toBe('current')
        expect(getRateReviewStatus(sampleRates[1], asOf)).toBe('overdue')
        expect(getRateReviewStatus(sampleRates[2], asOf)).toBe('needs_review')
    })

    it('combines text query with direction and status filters', () => {
        // Search "cotton" in weft with needs_review
        const matched = filterCostRates(sampleRates, { query: 'cotton', category: 'yarn_weft', status: 'needs_review' }, asOf)
        expect(matched.map(r => r.name)).toEqual(['30/1000 MUALTI Cotton'])

        // Search "cotton" in warp with needs_review (should match none)
        const none = filterCostRates(sampleRates, { query: 'cotton', category: 'yarn_warp', status: 'needs_review' }, asOf)
        expect(none).toHaveLength(0)
    })
})

describe('RatesClient UI contract for search, filters, and keyboard shortcuts', () => {
    const clientSource = read('app/(dashboard)/owner/rates/RatesClient.tsx')

    it('contains live search input with icon, placeholder, and clear action', () => {
        expect(clientSource).toContain('id="yarn-rates-search"')
        expect(clientSource).toContain('Search yarn by name, count, source, or fabric')
        expect(clientSource).toContain('aria-label={tx(\'Clear search\')}')
        expect(clientSource).toContain('ref={searchRef}')
    })

    it('provides keyboard shortcut pill / and escape listener', () => {
        expect(clientSource).toContain("event.key === '/'")
        expect(clientSource).toContain("event.key === 'Escape'")
        expect(clientSource).toContain('searchRef.current?.focus()')
        expect(clientSource).toContain('searchRef.current?.blur()')
        expect(clientSource).toContain('<kbd')
    })

    it('provides 3-way direction toggle with All, Warp, and Weft', () => {
        expect(clientSource).toContain("YarnDirectionFilter = 'all' | YarnRateCategory")
        expect(clientSource).toContain("role=\"group\"")
        expect(clientSource).toContain("aria-label=\"Show yarn rates by direction\"")
        expect(clientSource).toContain("categoryFilter === 'all'")
        expect(clientSource).toContain("categoryFilter === 'yarn_warp'")
        expect(clientSource).toContain("categoryFilter === 'yarn_weft'")
    })

    it('provides a dedicated Needs Review quick status chip with live count', () => {
        expect(clientSource).toContain("statusFilter === 'needs_review'")
        expect(clientSource).toContain("dueReviewRates.length")
        expect(clientSource).toContain("Needs Review")
        expect(clientSource).toContain("CalendarClock")
    })

    it('renders clear filters action when active filters exist', () => {
        expect(clientSource).toContain('hasActiveFilters')
        expect(clientSource).toContain('resetFilters')
        expect(clientSource).toContain('Clear filters')
    })

    it('provides polished empty state with clear search & filters button', () => {
        expect(clientSource).toContain('No yarn rates match “${searchQuery.trim()}”')
        expect(clientSource).toContain('Clear search & filters')
        expect(clientSource).toContain('Check the spelling or clear active filters to view all yarns.')
    })

    it('announces search result counts politely for screen reader accessibility', () => {
        expect(clientSource).toContain('aria-live="polite"')
        expect(clientSource).toContain('{visibleRates.length === 1 ? \'yarn rate\' : \'yarn rates\'} found.')
    })
})
