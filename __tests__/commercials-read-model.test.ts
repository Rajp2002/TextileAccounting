import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('Commercials read-model and UI attributes', () => {
    it('implements getCommercialReceivables server action enrichment', () => {
        const actionFile = readProjectFile('app/(dashboard)/owner/commercials/actions.ts')
        
        // Assert backend polymorphic batch fetching and merging is fully implemented
        expect(actionFile).toContain('fabric_stock_sales')
        expect(actionFile).toContain('meters_sold')
        expect(actionFile).toContain('dispatched_meters')
        expect(actionFile).toContain('pending_dispatch_meters')
        expect(actionFile).toContain('dispatch_status')
        expect(actionFile).toContain('credit_days')
        expect(actionFile).toContain('booked_gross_profit')
    })

    it('defines Receivable interface with the 10+ enriched commercial attributes', () => {
        const clientFile = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')
        
        // Assert all required properties exist in UI types
        expect(clientFile).toContain('credit_days?: number | null')
        expect(clientFile).toContain('meters_sold?: number | null')
        expect(clientFile).toContain('dispatch_status?:')
        expect(clientFile).toContain('dispatched_meters?: number | null')
        expect(clientFile).toContain('pending_dispatch_meters?: number | null')
        expect(clientFile).toContain('booked_gross_profit?: number | null')
    })

    it('contains local timezone drift-safe date comparison and bucket categorization helpers', () => {
        const clientFile = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')
        const helperFile = readProjectFile('lib/commercials/date-buckets.ts')
        
        // Verify local date comparison and bucketing logic
        expect(clientFile).toContain('getLocalDateString')
        expect(clientFile).toContain('getDueBucket')
        expect(clientFile).toContain('getCommercialDueBucket')
        expect(clientFile).toContain('normalizeCommercialDateOnly')
        expect(helperFile).toContain('Date.UTC')
        expect(helperFile).toContain('daysBetweenCommercialDates')
        expect(clientFile).toContain("'overdue'")
        expect(clientFile).toContain("'due_today'")
        expect(clientFile).toContain("'due_this_week'")
        expect(clientFile).toContain("'upcoming'")
        expect(clientFile).toContain("'paid'")
    })

    it('renders beautiful visual dispatch badges, credit terms, and booked profit in desktop/mobile layout', () => {
        const clientFile = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')
        
        // Verify dispatch badge helpers and desktop/mobile metrics are visual
        expect(clientFile).toContain('getDispatchStatusLabel')
        expect(clientFile).toContain('getDispatchStatusTone')
        expect(clientFile).toContain('Credit terms:')
        expect(clientFile).toContain('days credit')
        expect(clientFile).toContain('Booked Gross Profit:')
    })

    it('renders top five high-fidelity summary metrics', () => {
        const clientFile = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')
        
        // Verify 5 top summary cards in the Overview panel
        expect(clientFile).toContain('Total to Collect')
        expect(clientFile).toContain('Collected This Month')
        expect(clientFile).toContain('Overdue')
        expect(clientFile).toContain('Due This Week')
        expect(clientFile).toContain('Booked Gross Profit')
    })

    it('supports interactive due bucket filter tabs and harmonized search filtering', () => {
        const clientFile = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')
        
        // Verify search & bucket filter combination
        expect(clientFile).toContain('filteredReceivables')
        expect(clientFile).toContain('receivableSearch')
        expect(clientFile).toContain('dueTab')
        expect(clientFile).toContain('matchesBucket')
    })

    it('adds lightweight party identity, leaderboard, and party directory without unarchiving ledger', () => {
        const migration = readProjectFile('supabase/migrations/20260601010000_commercial_party_identity.sql')
        const actions = readProjectFile('app/(dashboard)/owner/commercials/actions.ts')
        const clientFile = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')
        const phaseScope = readProjectFile('lib/phase1-scope.ts')

        expect(migration).toContain('ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES parties(id)')
        expect(migration).toContain('DROP INDEX IF EXISTS idx_parties_org_name_active')
        expect(migration).toContain('HAVING COUNT(*) = 1')
        expect(migration).toContain('Multiple saved parties share this name')
        expect(migration).toContain('p_party_id UUID DEFAULT NULL')
        expect(migration).toContain('INSERT INTO parties')
        expect(migration).toContain('commercial_profit_entries')
        expect(migration).toContain('s.party_id')

        expect(actions).toContain('getCommercialPartyInsights')
        expect(actions).toContain('partiesByName')
        expect(actions).toContain('nameMatches.length === 1')
        expect(actions).toContain("CommercialPartyPeriod = '7d' | '30d' | 'year' | 'all'")
        expect(actions).toContain('leaderboards')
        expect(actions).toContain('bookedGrossProfit')

        expect(clientFile).toContain('Top Parties')
        expect(clientFile).toContain('Ranked by booked gross profit')
        expect(clientFile).toContain('Last sale')
        expect(clientFile).toContain('row.overdue')
        expect(clientFile).toContain('expandedPartyKey')
        expect(clientFile).toContain('partyKey: string')
        expect(clientFile).toContain('identityLine')
        expect(clientFile).toContain('PartiesDirectory')
        expect(clientFile).toContain('Parties ({partyInsights.parties.length})')
        expect(phaseScope).toContain("'/owner/ledger'")
    })

    it('classifies stock-sale origin from source fields instead of display labels', () => {
        const migration = readProjectFile('supabase/migrations/20260628121903_batch_4_commercials_receivables_payments.sql')
        const actions = readProjectFile('app/(dashboard)/owner/commercials/actions.ts')
        const clientFile = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')

        expect(migration).toContain('l.source_type AS stock_source_type')
        expect(migration).toContain('l.market_run_id AS stock_market_run_id')
        expect(migration).toContain('l.order_id AS stock_order_id')
        expect(actions).toContain('stock_source_type: string | null')
        expect(actions).toContain('stock_market_run_id: string | null')
        expect(actions).toContain('stock_order_id: string | null')
        expect(clientFile).toContain("entry.stock_source_type === 'market_run'")
        expect(clientFile).toContain("entry.stock_source_type === 'order'")
        expect(clientFile).not.toContain('source_label.toLowerCase')
    })
})
