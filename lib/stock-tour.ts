import type { TourStepSpec } from './tours/tour-types'
import { TOUR_SURFACE_SELECTOR } from './tours/sample-surface'

export const fabricStockTourSteps = ['fs-balance', 'fs-pending', 'fs-opening', 'fs-correct', 'fs-history', 'fs-handoff'] as const
export type FabricStockTourStep = typeof fabricStockTourSteps[number]
export type StockTourKind = 'fabric-stock'
/** Steps that teach a real dialog: opening, correction and history. */
const FABRIC_DIALOG_STEPS: readonly FabricStockTourStep[] = ['fs-opening', 'fs-correct', 'fs-history']
const fabricAnchors: Record<FabricStockTourStep, string> = {
    'fs-balance': 'balance', 'fs-pending': 'openingPending', 'fs-opening': 'opening',
    'fs-correct': 'correction', 'fs-history': 'history', 'fs-handoff': 'fabric.opening',
}
export const stockTourSelector = (step: FabricStockTourStep) => step === 'fs-handoff'
    ? '[data-tour-anchor="fabric.opening"]'
    : `[data-stock-tour="${fabricAnchors[step]}"]`

export const fabricStockTourSpecs: readonly TourStepSpec<FabricStockTourStep>[] = fabricStockTourSteps.map(id => ({
    id, anchor: stockTourSelector(id), kind: id === 'fs-handoff' ? 'handoff' : 'sample',
    ...(FABRIC_DIALOG_STEPS.includes(id) ? { context: TOUR_SURFACE_SELECTOR } : {}),
    ...(['fs-correct', 'fs-history'].includes(id) ? { detail: true } : {}),
}))
