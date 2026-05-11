/**
 * Derives the display status of a Market Run based on production, stock, and sales data.
 * This avoids risky database schema changes while fixing production UX.
 *
 * @param params Object containing status and quantities
 * @returns The derived display status
 */
export function getMarketRunDisplayStatus(params: {
    storedStatus: string
    producedQuantity: number | string
    availableQuantity: number | string
    soldQuantity: number | string
}): 'closed' | 'sold_out' | 'partially_sold' | 'in_godown' | 'production' {
    const storedStatus = params.storedStatus
    
    // Database/view values can sometimes arrive as strings
    const producedQuantity = typeof params.producedQuantity === 'string' 
        ? parseFloat(params.producedQuantity) 
        : params.producedQuantity
    const availableQuantity = typeof params.availableQuantity === 'string' 
        ? parseFloat(params.availableQuantity) 
        : params.availableQuantity
    const soldQuantity = typeof params.soldQuantity === 'string' 
        ? parseFloat(params.soldQuantity) 
        : params.soldQuantity

    // 1. If storedStatus === "closed" → "closed"
    if (storedStatus === 'closed') {
        return 'closed'
    }

    // 2. If producedQuantity > 0 && availableQuantity <= 0 && soldQuantity > 0 → "sold_out"
    if (producedQuantity > 0 && availableQuantity <= 0 && soldQuantity > 0) {
        return 'sold_out'
    }

    // 3. If availableQuantity > 0 && soldQuantity > 0 → "partially_sold"
    if (availableQuantity > 0 && soldQuantity > 0) {
        return 'partially_sold'
    }

    // 4. If availableQuantity > 0 && soldQuantity <= 0 → "in_godown"
    if (availableQuantity > 0 && soldQuantity <= 0) {
        return 'in_godown'
    }

    // 5. Otherwise → "production"
    return 'production'
}
