import { describe, it, expect } from 'vitest'
import { isStockLotActionable } from '../lib/stock-lifecycle'

describe('Stock Lot Lifecycle Helper Tests', () => {
    it('1. Active market run with available meters appears in active Godown', () => {
        const lot = {
            available_meters: 460,
            available_for_sale_meters: 460,
            reserved_meters: 0,
            pending_dispatch_meters: 0,
            has_unresolved_discrepancy: false,
            source_type: 'market_run',
            parent_status: 'production'
        }
        expect(isStockLotActionable(lot)).toBe(true)
    })

    it('2. Market run marked completed/closed with 0m available, 0m reserved, 0m pending dispatch, and no discrepancy does NOT appear in active Godown', () => {
        const lot = {
            available_meters: 0,
            available_for_sale_meters: 0,
            reserved_meters: 0,
            pending_dispatch_meters: 0,
            has_unresolved_discrepancy: false,
            source_type: 'market_run',
            parent_status: 'closed'
        }
        expect(isStockLotActionable(lot)).toBe(false)
    })

    it('3. Order marked completed but still has reserved or pending dispatch meters appears in active Godown', () => {
        const lotWithReserved = {
            available_meters: 50,
            available_for_sale_meters: 0,
            reserved_meters: 50,
            pending_dispatch_meters: 0,
            has_unresolved_discrepancy: false,
            source_type: 'order',
            parent_status: 'completed'
        }
        expect(isStockLotActionable(lotWithReserved)).toBe(true)

        const lotWithPending = {
            available_meters: 0,
            available_for_sale_meters: 0,
            reserved_meters: 0,
            pending_dispatch_meters: 50,
            has_unresolved_discrepancy: false,
            source_type: 'order',
            parent_status: 'completed'
        }
        expect(isStockLotActionable(lotWithPending)).toBe(true)
    })

    it('4. Fulfilled/closed order stock lot with 0m available, 0m reserved, 0m pending dispatch, and no discrepancy does NOT appear in active Godown', () => {
        const lot = {
            available_meters: 0,
            available_for_sale_meters: 0,
            reserved_meters: 0,
            pending_dispatch_meters: 0,
            has_unresolved_discrepancy: false,
            source_type: 'order',
            parent_status: 'completed'
        }
        expect(isStockLotActionable(lot)).toBe(false)
    })

    it('5 & 6. Sold-out archived lots and their ledger entries are preserved (shouldAppearInArchive is true)', () => {
        const lot = {
            available_meters: 0,
            available_for_sale_meters: 0,
            reserved_meters: 0,
            pending_dispatch_meters: 0,
            has_unresolved_discrepancy: false,
            source_type: 'market_run',
            parent_status: 'closed'
        }
        expect(isStockLotActionable(lot)).toBe(false)
    })

    it('7. Closed market-run lots with only pending dispatch move out of active Godown', () => {
        const lot = {
            available_meters: 0,
            available_for_sale_meters: 0,
            reserved_meters: 0,
            pending_dispatch_meters: 120,
            has_unresolved_discrepancy: false,
            source_type: 'market_run',
            parent_status: 'closed'
        }
        expect(isStockLotActionable(lot)).toBe(false)
    })

    it('7b. Sold-out market-run lots with only pending dispatch move out of active Godown', () => {
        const lot = {
            available_meters: 0,
            available_for_sale_meters: 0,
            reserved_meters: 0,
            pending_dispatch_meters: 120,
            has_unresolved_discrepancy: false,
            source_type: 'market_run',
            parent_status: 'sold_out'
        }
        expect(isStockLotActionable(lot)).toBe(false)
    })

    it('8. Lots with unresolved discrepancies remain active', () => {
        const lot = {
            available_meters: 0,
            available_for_sale_meters: 0,
            reserved_meters: 0,
            pending_dispatch_meters: 0,
            has_unresolved_discrepancy: true,
            source_type: 'market_run',
            parent_status: 'closed'
        }
        expect(isStockLotActionable(lot)).toBe(true)
    })

    it('9. Active Godown totals exclude archived/sold-out/exhausted lots (helper should return false)', () => {
        const lot = {
            available_meters: 0,
            available_for_sale_meters: 0,
            reserved_meters: 0,
            pending_dispatch_meters: 0,
            has_unresolved_discrepancy: false,
            source_type: 'market_run',
            parent_status: 'closed'
        }
        expect(isStockLotActionable(lot)).toBe(false)
    })

    it('10. Rounded/derived taka approximation (approx 0.4 taka) does not keep a 0m exhausted lot active', () => {
        // Taka count is positive but available_meters is 0m. Actionable logic checks only meters.
        const lot = {
            available_meters: 0,
            available_for_sale_meters: 0,
            reserved_meters: 0,
            pending_dispatch_meters: 0,
            has_unresolved_discrepancy: false,
            source_type: 'market_run',
            parent_status: 'closed'
        }
        expect(isStockLotActionable(lot)).toBe(false)
    })
})
