import type { TourStepSpec } from './tours/tour-types'
import { TOUR_SURFACE_SELECTOR } from './tours/sample-surface'

/** Overview setup only. Daily Sheet gets its own launcher and runtime in GT-12. */
export const productionTourSteps = ['pd-overview', 'pd-prereq', 'pd-activate', 'pd-looms', 'pd-operators', 'pd-board', 'pd-handoff'] as const
export type ProductionOverviewTourStep = typeof productionTourSteps[number]

export type ProductionTourStep = ProductionOverviewTourStep
/** Every field is an element of the REAL Production page (or one of its real dialogs), tagged `data-production-tour`. */
export type ProductionTourField = 'overview' | 'qualities' | 'activate' | 'allocate' | 'operators' | 'board'

const overviewAnchors: Record<ProductionOverviewTourStep, string> = {
    'pd-overview': 'overview', 'pd-prereq': 'qualities', 'pd-activate': 'activate',
    'pd-looms': 'allocate', 'pd-operators': 'operators', 'pd-board': 'board', 'pd-handoff': 'production.activate',
}
export const productionTourSelector = (step: ProductionTourStep) => step === 'pd-handoff'
    ? '[data-tour-anchor="production.activate"]'
    : `[data-production-tour="${overviewAnchors[step]}"]`

export const productionTourSpecs: readonly TourStepSpec<ProductionOverviewTourStep>[] = productionTourSteps.map(id => ({
    id,
    anchor: productionTourSelector(id),
    kind: id === 'pd-handoff' ? 'handoff' : 'sample',
    ...(['pd-activate', 'pd-looms', 'pd-operators'].includes(id) ? { context: TOUR_SURFACE_SELECTOR } : {}),
    ...(['pd-prereq', 'pd-activate', 'pd-board'].includes(id) ? { detail: true } : {}),
}))
