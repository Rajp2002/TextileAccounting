export interface StockLotLifecycleData {
    available_meters: number
    available_for_sale_meters: number
    reserved_meters: number
    pending_dispatch_meters: number
    has_unresolved_discrepancy: boolean
    source_type?: 'market_run' | 'order' | 'opening' | 'manual' | 'adjustment' | string | null
    source_id?: string | null
    parent_status?: string | null
}

export function isStockLotActionable(lot: StockLotLifecycleData): boolean {
    if (lot.has_unresolved_discrepancy) return true
    if (lot.available_meters > 0) return true
    if (lot.available_for_sale_meters > 0) return true
    if (lot.reserved_meters > 0) return true
    if (lot.source_type === 'market_run' && ['closed', 'sold_out'].includes(lot.parent_status ?? '')) {
        return false
    }
    if (lot.pending_dispatch_meters > 0) return true

    return false
}

export function shouldHideFromActiveGodown(lot: StockLotLifecycleData): boolean {
    return !isStockLotActionable(lot)
}

export function shouldAppearInArchive(lot: StockLotLifecycleData): boolean {
    return !isStockLotActionable(lot)
}
