import { makeDefaultEstimateState, calcFullTotals, buildCostingResult } from './estimator'
import { createCostingExportModel } from './estimator-export'

export const paidCostingSteps = ['find', 'versions', 'economics', 'reuse', 'internal', 'finish'] as const
export const freeCostingSteps = ['snapshots', 'freeSelect', 'internal', 'finish'] as const
export const comparisonCostingSteps = ['compareSelect', 'comparison', 'comparisonDetails', 'finish'] as const
export type SavedCostingStep = typeof paidCostingSteps[number] | typeof freeCostingSteps[number] | typeof comparisonCostingSteps[number]
    | 'filters' | 'select' | 'breakdown' | 'organize' | 'customer' | 'share' | 'production'
    | 'searchAndFilters' | 'search' | 'freeFilters'
export function savedCostingTourSteps(free: boolean, production = false): SavedCostingStep[] {
    if (free) return [...freeCostingSteps]
    const steps: SavedCostingStep[] = [...paidCostingSteps]
    if (production) steps.splice(steps.indexOf('finish'), 0, 'production')
    return steps
}
export type SavedCostingEnding = 'existing' | 'empty' | 'unavailable'
export function savedCostingTourEnding(count: number, unavailable = false): SavedCostingEnding {
    return unavailable ? 'unavailable' : count > 0 ? 'existing' : 'empty'
}
export function costingTourSurface(step: SavedCostingStep | null) {
    if (step === 'internal' || step === 'customer' || step === 'share') return 'export'
    if ((step === 'comparison' || step === 'comparisonDetails')) return 'comparison'
    if (step && ['versions', 'breakdown', 'economics', 'reuse', 'organize', 'production', 'compareSelect'].includes(step)) return 'library'
    return 'page'
}
/** In-memory examples only. These IDs must never be passed to persistence actions. */
export function makeSavedCostingTourExamples() {
    return [2, 1].map(version => {
        const state = makeDefaultEstimateState()
        state.warpRows = [{ ...state.warpRows[0], id: 'tour-warp', label: 'Warp 75D', calcDenier: 75, beamEnds: 3200, yarnRate: version === 2 ? 120 : 110 }]
        state.weftRows = [{ ...state.weftRows[0], id: 'tour-weft', label: 'Weft 75D', calcDenier: 75, picks: 68, effectiveCostingWidthCm: 112, reedSpace: 112, yarnRate: 112 }]
        state.yarnShortagePct = 2
        state.warpCrimpPct = 5
        state.overheadMode = 'direct'
        state.overheadOverridePerM = 3
        state.profitPct = 12
        state.orderQuantityM = 1000
        state.isConfigured = true
        state.perPickCostPaisa = version === 2 ? 0.12 : 0.1
        const totals = calcFullTotals(state)
        const result = buildCostingResult(state, totals)
        const date = `2026-01-0${version}T06:00:00.000Z`
        return {
            id: `tour-preview-v${version}`, quality_label: 'Tour sample', label: 'Tour sample',
            costing_group_id: 'tour-preview', version_number: version,
            status: 'draft' as const, record_kind: 'costing' as const, party_name: null,
            quote_price_per_meter: result.suggestedSellingPricePerM,
            landed_cost_per_meter: result.productionCostPerM,
            intended_margin_percent: state.profitPct, meters: 1000,
            created_at: date, updated_at: date, snapshot_data: state,
            costing_result_snapshot: result, reconciliation_status: 'verified',
            estimate: state, result, totals,
        }
    })
}
export function makeSavedCostingTourExport() {
    const row = makeSavedCostingTourExamples()[0]
    return createCostingExportModel({qualityLabel: row.label, createdAt: row.created_at, state: row.estimate, totals: row.totals, result: row.result})
}
