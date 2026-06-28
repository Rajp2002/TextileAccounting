export const STOCK_MOVEMENT_PAGE_SIZE = 100
export const RECENT_STOCK_MOVEMENT_LIMIT = 50

export type StockMovementCursor = {
    created_at: string
    id: string
}

type MovementCursorSource = {
    id: string
    created_at: string
}

export function getStockMovementCursor(row: MovementCursorSource): StockMovementCursor {
    return {
        created_at: row.created_at,
        id: row.id,
    }
}

export function getNextStockMovementCursor<T extends MovementCursorSource>(
    rows: T[],
    hasMore: boolean
): StockMovementCursor | null {
    if (!hasMore || rows.length === 0) return null
    return getStockMovementCursor(rows[rows.length - 1])
}

export function buildStockMovementCursorFilter(cursor: StockMovementCursor): string {
    return [
        `created_at.lt.${cursor.created_at}`,
        `and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
    ].join(',')
}

export function appendUniqueStockMovements<T extends { id: string }>(
    existing: T[],
    next: T[]
): T[] {
    const seen = new Set(existing.map((row) => row.id))
    const merged = [...existing]

    for (const row of next) {
        if (seen.has(row.id)) continue
        seen.add(row.id)
        merged.push(row)
    }

    return merged
}
