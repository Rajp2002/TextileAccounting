import { makeDefaultEstimateState, calcFullTotals, buildCostingResult } from './estimator'
import { createCostingExportModel } from './costing-export-model'
import type { TourStepSpec } from './tours/tour-types'

export const paidCostingSteps = ['find', 'versions', 'economics', 'reuse', 'internal', 'finish'] as const
export const freeCostingSteps = ['snapshots', 'freeSelect', 'internal', 'finish'] as const
export const comparisonCostingSteps = ['compareSelect', 'comparison', 'comparisonDetails', 'compareHandoff'] as const
export type SavedCostingStep = typeof paidCostingSteps[number] | typeof freeCostingSteps[number] | typeof comparisonCostingSteps[number] | 'production'
export type SavedCostingEnding = 'existing' | 'empty' | 'unavailable'
export function savedCostingTourSteps(free: boolean, production = false): SavedCostingStep[] {
    if (free) return [...freeCostingSteps]
    const steps: SavedCostingStep[] = [...paidCostingSteps]
    if (production) steps.splice(steps.indexOf('finish'), 0, 'production')
    return steps
}
export function savedCostingTourEnding(count: number, unavailable = false): SavedCostingEnding {
    return unavailable ? 'unavailable' : count > 0 ? 'existing' : 'empty'
}
export function isSavedCostingHandoff(step: SavedCostingStep | null) {
    return step === 'finish' || step === 'compareHandoff'
}
export function costingTourSurface(step: SavedCostingStep | null) {
    if (step === 'internal') return 'export'
    if (step === 'comparison' || step === 'comparisonDetails') return 'comparison'
    if (step && ['versions', 'economics', 'reuse', 'production', 'compareSelect'].includes(step)) return 'library'
    return 'page'
}
export function savedCostingTourSpecs(free: boolean, production = false, comparison = false, ending: SavedCostingEnding = 'empty'): TourStepSpec<SavedCostingStep>[] {
    const dialog = '[data-costing-tour-dialog="true"]'
    const anchors: Record<SavedCostingStep, string> = {
        find: '[data-costing-tour="sample"]', versions: '[data-costing-tour="versions"]', economics: '[data-costing-tour="economics"]',
        reuse: '[data-costing-tour="reuse"]', internal: '[data-costing-tour="export-modes"]', production: '[data-costing-tour="production"]',
        snapshots: '[data-costing-tour="free-sample"]', freeSelect: '[data-tour-anchor="free-costings.sample-export"]',
        compareSelect: '[data-costing-tour="versions"]', comparison: '[data-costing-tour="comparison"]', comparisonDetails: '[data-costing-tour="comparison-details"]',
        compareHandoff: '[data-tour-anchor="costings.compare"]',
        finish: `[data-tour-anchor="${free ? 'free-costings' : 'costings'}.${ending === 'existing' ? 'first-card' : 'new'}"]`,
    }
    return (comparison && !free ? [...comparisonCostingSteps] : savedCostingTourSteps(free, production)).map(id => ({
        id, anchor: anchors[id], kind: isSavedCostingHandoff(id) ? 'handoff' : 'sample',
        context: costingTourSurface(id) !== 'page' ? dialog : undefined,
        detail: ['versions', 'economics', 'reuse', 'internal', 'snapshots'].includes(id),
    }))
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

/** Display values use the very same calculated examples as the sample views. */
export function savedCostingTourValues(rows = makeSavedCostingTourExamples()) {
    const format = (value: number) => value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return { cost: format(rows[0].result.productionCostPerM), price: format(rows[0].result.suggestedSellingPricePerM), profit: format(rows[0].result.profitPerM), costChange: format(rows[0].result.productionCostPerM - rows[1].result.productionCostPerM) }
}
