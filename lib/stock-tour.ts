export const fabricStockTourSteps = ['balance', 'tracking', 'search', 'quality', 'openingPending', 'opening', 'openingQuality', 'openingAmount', 'openingReason', 'openingSave', 'correction', 'counted', 'correctionReason', 'correctionSave', 'history', 'historyFilter', 'movement', 'older', 'refresh', 'finish'] as const
export const yarnStockTourSteps = ['balance', 'tracking', 'yarn', 'opening', 'openingQuality', 'openingAmount', 'openingReason', 'receipt', 'receiptAmount', 'receiptSave', 'formulas', 'link', 'costing', 'weights', 'linkReason', 'linkSave', 'correction', 'counted', 'correctionReason', 'auditDate', 'historical', 'current', 'export', 'historyFilter', 'movement', 'finish'] as const
export type StockTourKind = 'fabric-stock' | 'yarn-stock'
export type StockTourStep = typeof fabricStockTourSteps[number] | typeof yarnStockTourSteps[number]
export const stockTourSteps = (kind: StockTourKind): readonly StockTourStep[] => kind === 'fabric-stock' ? fabricStockTourSteps : yarnStockTourSteps
export function stockTourSection(step: StockTourStep, kind: StockTourKind) {
    const i = stockTourSteps(kind).indexOf(step)
    if (kind === 'yarn-stock') return i < 3 ? 0 : i < 10 ? 1 : i < 16 ? 2 : i < 19 ? 3 : i < 23 ? 4 : 5
    return i < 2 ? 0 : i < 5 ? 1 : i < 10 ? 2 : i < 14 ? 3 : 4
}
export function stockTourSurface(step: StockTourStep) {
    if (['opening', 'openingQuality', 'openingAmount', 'openingReason', 'openingSave'].includes(step)) return 'opening'
    if (['correction', 'counted', 'correctionReason', 'correctionSave'].includes(step)) return 'correction'
    if (['receipt', 'receiptAmount', 'receiptSave'].includes(step)) return 'receipt'
    if (['link', 'costing', 'weights', 'linkReason', 'linkSave'].includes(step)) return 'link'
    return 'page'
}
export const stockTourSelector = (step: StockTourStep) => `[data-stock-tour="${step}"]`
/** Display-only examples, never business record payloads. */
export const fabricStockExample = { opening: 500, production: 200, dispatch: 100, balance: 600, counted: 590, correction: -10 } as const

export const yarnStockExample = { opening: 100, receipt: 20, dispatchedMetres: 100, kgPer100: 10, deduction: 10, balance: 110, counted: 108 } as const
