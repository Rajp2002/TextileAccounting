import type { TourStepSpec } from './tours/tour-types'

export const fabricStockTourSteps = ['fs-balance', 'fs-pending', 'fs-opening', 'fs-correct', 'fs-history', 'fs-handoff'] as const
export const yarnStockTourSteps = ['ys-balance', 'ys-opening', 'ys-receipt', 'ys-link', 'ys-usage', 'ys-correct', 'ys-handoff'] as const
export type YarnStockTourStep = typeof yarnStockTourSteps[number]
export type FabricStockTourStep = typeof fabricStockTourSteps[number]
export type StockTourKind = 'fabric-stock' | 'yarn-stock'
export type StockTourStep = typeof fabricStockTourSteps[number] | typeof yarnStockTourSteps[number]
export const stockTourSteps = (kind: StockTourKind): readonly StockTourStep[] => kind === 'fabric-stock' ? fabricStockTourSteps : yarnStockTourSteps
export function stockTourSection(step: StockTourStep, kind: StockTourKind) {
    const i = stockTourSteps(kind).indexOf(step)
    if (kind === 'yarn-stock') return i < 2 ? 0 : i < 4 ? 1 : i < 6 ? 2 : 3
    return i < 2 ? 0 : i < 4 ? 1 : i < 6 ? 2 : 3
}
export function stockTourSurface(step: StockTourStep) {
    if (['fs-opening', 'ys-opening', 'opening', 'openingQuality', 'openingAmount', 'openingReason', 'openingSave'].includes(step)) return 'opening'
    if (['fs-correct', 'ys-correct', 'correction', 'counted', 'correctionReason', 'correctionSave'].includes(step)) return 'correction'
    if (['ys-receipt', 'receipt', 'receiptAmount', 'receiptSave'].includes(step)) return 'receipt'
    if (['ys-link', 'link', 'costing', 'weights', 'linkReason', 'linkSave'].includes(step)) return 'link'
    return 'page'
}
const fabricAnchors: Record<FabricStockTourStep, string> = {
    'fs-balance': 'balance', 'fs-pending': 'openingPending', 'fs-opening': 'opening',
    'fs-correct': 'correction', 'fs-history': 'history', 'fs-handoff': 'fabric.opening',
}
const yarnAnchors: Record<YarnStockTourStep, string> = {
    'ys-balance': 'balance', 'ys-opening': 'opening', 'ys-receipt': 'receipt',
    'ys-link': 'link', 'ys-usage': 'movement', 'ys-correct': 'correction', 'ys-handoff': 'yarn.opening',
}
export const stockTourSelector = (step: StockTourStep) => step === 'fs-handoff'
    ? '[data-tour-anchor="fabric.opening"]'
    : step === 'ys-handoff' ? '[data-tour-anchor="yarn.opening"]'
    : `[data-stock-tour="${fabricAnchors[step as FabricStockTourStep] ?? yarnAnchors[step as YarnStockTourStep]}"]`

export const fabricStockTourSpecs: readonly TourStepSpec<FabricStockTourStep>[] = fabricStockTourSteps.map(id => ({
    id, anchor: stockTourSelector(id), kind: id === 'fs-handoff' ? 'handoff' : 'sample',
    ...(['fs-opening', 'fs-correct'].includes(id) ? { context: '[data-stock-tour-preview="true"]' } : {}),
    ...(['fs-correct', 'fs-history'].includes(id) ? { detail: true } : {}),
}))

export const yarnStockTourSpecs: readonly TourStepSpec<YarnStockTourStep>[] = yarnStockTourSteps.map(id => ({
    id, anchor: stockTourSelector(id), kind: id === 'ys-handoff' ? 'handoff' : 'sample',
    ...(stockTourSurface(id) !== 'page' ? { context: '[data-stock-tour-preview="true"]' } : {}),
    ...(['ys-balance', 'ys-usage', 'ys-correct'].includes(id) ? { detail: true } : {}),
}))
/** Display-only examples, never business record payloads. */
export const fabricStockExample = { opening: 500, production: 200, dispatch: 100, balance: 600, counted: 590, correction: -10 } as const

export const yarnStockExample = { warpKgPer100: 6, weftKgPer100: 4, opening: 100, receipt: 20, producedMetres: 200, kgPer100: 10, deduction: 20, balance: 100, counted: 98 } as const

export function fabricStockBalance(step: FabricStockTourStep) {
    if (step === 'fs-handoff') return null
    if (step === 'fs-history') return fabricStockExample.counted
    if (step === 'fs-correct') return fabricStockExample.balance
    return fabricStockExample.production - fabricStockExample.dispatch
}
