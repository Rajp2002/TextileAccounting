import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { StockAdjustmentSchema, stockHistoryPage, type StockMovement } from '../lib/quality-stock'
import { hasCapability } from '../lib/subscription-access'
const id = '10000000-0000-4000-8000-000000000001'
const opening = { qualityLabel: '  Cotton   40s ', meters: 100.25, kind: 'opening', reason: 'Physical opening count', clientRequestId: id }
describe('quality metre stock', () => {
    it('accepts zero opening stock and normalizes names without creating lot identities', () => {
        expect(StockAdjustmentSchema.parse({ ...opening, meters: 0 })).toMatchObject({ qualityLabel: 'Cotton 40s', meters: 0 })
    })
    it('rejects invalid quantities and unreviewed corrections', () => {
        for (const meters of [NaN, Infinity, -1, 0.001, 100_000_001]) expect(StockAdjustmentSchema.safeParse({ ...opening, meters }).success).toBe(false)
        expect(StockAdjustmentSchema.safeParse({ ...opening, kind: 'correction' }).success).toBe(false)
        expect(StockAdjustmentSchema.safeParse({ ...opening, kind: 'correction', expectedMeters: 20 }).success).toBe(true)
    })
    it('requires a reason and stable request identifier', () => {
        expect(StockAdjustmentSchema.safeParse({ ...opening, reason: '  ' }).success).toBe(false)
        expect(StockAdjustmentSchema.safeParse({ ...opening, clientRequestId: '' }).success).toBe(false)
    })
    it('uses a lookahead row without skipping the first row of the next page', () => {
        const rows = Array.from({ length: 51 }, (_, index) => ({ id: String(index), created_at: '2026-09-08T12:00:00Z' } as StockMovement))
        const page = stockHistoryPage(rows)
        expect(page.movements).toHaveLength(50)
        expect(page.nextCursor?.id).toBe('49')
        expect(stockHistoryPage(rows.slice(0, 50)).nextCursor).toBeNull()
        expect(stockHistoryPage([])).toEqual({ movements: [], nextCursor: null })
    })
    it('makes stock available with production access and removes old entry points', () => {
        expect(hasCapability('base', 'production')).toBe(true)
        expect(hasCapability('lite', 'production')).toBe(false)
        for (const path of ['app/(dashboard)/owner/stock/TakaStockClient.tsx', 'app/(dashboard)/owner/stock/StockClient.tsx', 'components/dispatches/SellAndDispatchDialog.tsx', 'app/(dashboard)/owner/dispatches/actions.ts']) expect(existsSync(path)).toBe(false)
        expect(readFileSync('app/(dashboard)/owner/stock/actions.ts','utf8')).not.toMatch(/fabric_stock|parties|taka/)
    })
})
