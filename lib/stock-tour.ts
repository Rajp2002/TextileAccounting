export const fabricStockTourSteps = ['balance', 'tracking', 'openingPending', 'opening', 'correction', 'counted', 'finish'] as const
export const yarnStockTourSteps = ['balance', 'yarn', 'opening', 'receipt', 'link', 'movement', 'correction', 'finish'] as const
export type StockTourKind = 'fabric-stock' | 'yarn-stock'
export type StockTourStep = typeof fabricStockTourSteps[number] | typeof yarnStockTourSteps[number]
export const stockTourSteps = (kind: StockTourKind): readonly StockTourStep[] => kind === 'fabric-stock' ? fabricStockTourSteps : yarnStockTourSteps
export function stockTourSection(step: StockTourStep, kind: StockTourKind) {
    const i = stockTourSteps(kind).indexOf(step)
    if (kind === 'yarn-stock') return i < 2 ? 0 : i < 4 ? 1 : i < 6 ? 2 : 3
    return i < 2 ? 0 : i < 4 ? 1 : i < 6 ? 2 : 3
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
export const fabricStockExample = { preStartPhysical: 650, historicalCommitted: 150, opening: 500, production: 200, dispatch: 100, balance: 600, counted: 590, correction: -10 } as const

export const yarnStockExample = { unused: 80, embodied: 20, undispatchedMetres: 200, warpKgPer100: 6, weftKgPer100: 4, opening: 100, receipt: 20, dispatchedMetres: 100, kgPer100: 10, deduction: 10, balance: 110, counted: 108 } as const
