import type { TourStepSpec } from './tours/tour-types'
import { TOUR_SURFACE_SELECTOR } from './tours/sample-surface'

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
/** Steps that teach a real dialog: opening, correction and history for fabric; opening, receipt, formula link and correction for yarn. */
const FABRIC_DIALOG_STEPS: readonly FabricStockTourStep[] = ['fs-opening', 'fs-correct', 'fs-history']
const YARN_DIALOG_STEPS: readonly YarnStockTourStep[] = ['ys-opening', 'ys-receipt', 'ys-link', 'ys-correct']
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
    ...(FABRIC_DIALOG_STEPS.includes(id) ? { context: TOUR_SURFACE_SELECTOR } : {}),
    ...(['fs-correct', 'fs-history'].includes(id) ? { detail: true } : {}),
}))

export const yarnStockTourSpecs: readonly TourStepSpec<YarnStockTourStep>[] = yarnStockTourSteps.map(id => ({
    id, anchor: stockTourSelector(id), kind: id === 'ys-handoff' ? 'handoff' : 'sample',
    ...(YARN_DIALOG_STEPS.includes(id) ? { context: TOUR_SURFACE_SELECTOR } : {}),
    ...(['ys-balance', 'ys-usage', 'ys-correct'].includes(id) ? { detail: true } : {}),
}))
