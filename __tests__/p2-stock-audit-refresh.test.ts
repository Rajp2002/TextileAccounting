import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    appendUniqueStockMovements,
    getNextStockMovementCursor,
    STOCK_MOVEMENT_PAGE_SIZE,
    type StockMovementCursor,
} from '../lib/stock-movement-pagination'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

type MovementFixture = {
    id: string
    created_at: string
}

function sortMovementRows<T extends { created_at: string; id: string }>(rows: T[]) {
    return [...rows].sort((a, b) => {
        const dateOrder = b.created_at.localeCompare(a.created_at)
        if (dateOrder !== 0) return dateOrder
        return b.id.localeCompare(a.id)
    })
}

function pageAfterCursor<T extends { created_at: string; id: string }>(
    rows: T[],
    cursor: StockMovementCursor | null
): { page: T[]; cursor: StockMovementCursor | null; hasMore: boolean } {
    const sorted = sortMovementRows(rows)
    const eligible = cursor
        ? sorted.filter((row) => (
            row.created_at < cursor.created_at ||
            (row.created_at === cursor.created_at && row.id < cursor.id)
        ))
        : sorted

    const page = eligible.slice(0, STOCK_MOVEMENT_PAGE_SIZE)
    const hasMore = eligible.length > STOCK_MOVEMENT_PAGE_SIZE

    return {
        page,
        cursor: getNextStockMovementCursor(page, hasMore),
        hasMore,
    }
}

describe('P2 Batch 5 stock audit and refresh behavior', () => {
    it('paginates more than 500 movements deterministically without duplicates or gaps', () => {
        const base = Date.UTC(2026, 5, 28, 12, 0, 0)
        const rows: MovementFixture[] = Array.from({ length: 503 }, (_, index) => ({
            id: `movement-${String(9999 - index).padStart(4, '0')}`,
            created_at: new Date(base - Math.floor(index / 3) * 1000).toISOString(),
        }))

        let cursor: StockMovementCursor | null = null
        let collected: MovementFixture[] = []

        for (let i = 0; i < 10; i += 1) {
            const result: { page: MovementFixture[]; cursor: StockMovementCursor | null; hasMore: boolean } = pageAfterCursor(rows, cursor)
            collected = appendUniqueStockMovements(collected, result.page)
            cursor = result.cursor
            if (!result.hasMore) break
        }

        expect(collected).toHaveLength(503)
        expect(new Set(collected.map((row) => row.id)).size).toBe(503)
        expect(collected.map((row) => row.id)).toEqual(sortMovementRows(rows).map((row) => row.id))
    })

    it('exposes cursor-based stock movement retrieval instead of a hidden 500-row cap', () => {
        const actions = readProjectFile('app/(dashboard)/owner/stock/actions.ts')

        expect(actions).toContain('export async function getTakaStockMovements')
        expect(actions).toContain('STOCK_MOVEMENT_PAGE_SIZE')
        expect(actions).toContain('RECENT_STOCK_MOVEMENT_LIMIT')
        expect(actions).toContain(".order('created_at', { ascending: false })")
        expect(actions).toContain(".order('id', { ascending: false })")
        expect(actions).toContain('.limit(pageSize + 1)')
        expect(actions).toContain('buildStockMovementCursorFilter(input.cursor)')
        expect(actions).toContain('getNextStockMovementCursor(movements, hasMore)')
        expect(actions).not.toContain('.limit(500)')
    })

    it('loads older movement pages from the stock product surface', () => {
        const client = readProjectFile('app/(dashboard)/owner/stock/TakaStockClient.tsx')

        expect(client).toContain('getTakaStockMovements')
        expect(client).toContain('movementPages')
        expect(client).toContain('appendUniqueStockMovements')
        expect(client).toContain('Load older entries')
        expect(client).toContain('Full movement history loaded.')
    })

    it('refreshes stock state after sale-only success when no dispatch id exists', () => {
        const dialog = readProjectFile('components/dispatches/SellAndDispatchDialog.tsx')
        const stockClient = readProjectFile('app/(dashboard)/owner/stock/TakaStockClient.tsx')
        const dispatchActions = readProjectFile('app/(dashboard)/owner/dispatches/actions.ts')

        expect(dialog).toContain('onSuccess?.(result.dispatchId ?? null, result.trackingUrl ?? null)')
        expect(stockClient).toContain('if (dispatchId)')
        expect(stockClient).toContain('router.push(`/owner/dispatches?dispatchId=${dispatchId}&created=1`)')
        expect(stockClient).toContain('router.refresh()')
        expect(dispatchActions).toContain("revalidatePath('/owner/stock')")
        expect(dispatchActions).toContain('pendingDispatchMeters: Number(result.pending_dispatch_meters ?? 0)')
    })
})
