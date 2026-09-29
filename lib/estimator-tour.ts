import type { TourStepSpec } from './tours/tour-types'

export type EstimatorTourContext = { freePlan: boolean; existingCosting: boolean; productionPipeline: boolean }
export type EstimatorTourStep = 'est-purpose' | 'est-warp' | 'est-weft' | 'est-weaving' | 'est-warping' | 'est-overhead' | 'est-pricing' | 'est-live' | 'est-save' | 'est-handoff'

// The same Quick-view sequence teaches every plan; only the approved copy varies.
export const estimatorTourSteps: readonly TourStepSpec<EstimatorTourStep>[] = [
    { id: 'est-purpose', anchor: '[data-tour-anchor="estimator.quick-basics"]', kind: 'live' },
    { id: 'est-warp', anchor: '[data-tour-anchor="estimator.quick-warp"]', kind: 'live' },
    { id: 'est-weft', anchor: '[data-tour-anchor="estimator.quick-weft"]', kind: 'live' },
    { id: 'est-weaving', anchor: '[data-tour-anchor="estimator.quick-weaving"]', kind: 'live' },
    { id: 'est-warping', anchor: '[data-tour-anchor="estimator.quick-warping"]', kind: 'live' },
    { id: 'est-overhead', anchor: '[data-tour-anchor="estimator.quick-overhead"]', kind: 'live' },
    { id: 'est-pricing', anchor: '[data-tour-anchor="estimator.quick-pricing"]', kind: 'live' },
    { id: 'est-live', anchor: '[data-estimator-field="liveCostMetrics"]', context: '#mobile-live-estimate-panel', kind: 'live' },
    { id: 'est-save', anchor: '[data-estimator-field="liveCostActions"]', context: '#mobile-live-estimate-panel', kind: 'live' },
    { id: 'est-handoff', anchor: '[data-estimator-field="qualityLabel"]', kind: 'handoff' },
]

export function estimatorTourView(step: EstimatorTourStep) {
    return { entryMode: 'quick' as const, liveEstimateOpen: step === 'est-live' || step === 'est-save', showQualityLibrary: false, showAdvancedOverhead: false }
}
