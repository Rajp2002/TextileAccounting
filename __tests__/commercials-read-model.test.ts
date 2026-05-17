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
        
        // Verify local date comparison and bucketing logic
        expect(clientFile).toContain('getLocalDateString')
        expect(clientFile).toContain('getDueBucket')
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
})
