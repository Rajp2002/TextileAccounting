import type { TourStepSpec } from './tours/tour-types'

/** Overview setup only. Daily Sheet gets its own launcher and runtime in GT-12. */
export const productionTourSteps = ['pd-overview', 'pd-prereq', 'pd-activate', 'pd-looms', 'pd-operators', 'pd-board', 'pd-handoff'] as const
export type ProductionOverviewTourStep = typeof productionTourSteps[number]

export type ProductionTourStep = ProductionOverviewTourStep
export type ProductionTourField = 'overview' | 'prerequisites' | 'activate' | 'allocate' | 'operators' | 'board' | 'qualities' | 'filters'

export function productionTourSurface(step: ProductionTourStep) {
    if (step === 'pd-handoff') return 'live'
    if (step === 'pd-activate') return 'activate'
    if (step === 'pd-looms') return 'allocate'
    return 'overview'
}

const overviewAnchors: Record<ProductionOverviewTourStep, string> = {
    'pd-overview': 'overview', 'pd-prereq': 'prerequisites', 'pd-activate': 'activate',
    'pd-looms': 'allocate', 'pd-operators': 'operators', 'pd-board': 'board', 'pd-handoff': 'production.activate',
}
export const productionTourSelector = (step: ProductionTourStep) => step === 'pd-handoff'
    ? '[data-tour-anchor="production.activate"]'
    : `[data-production-tour="${overviewAnchors[step]}"]`

export const productionTourSpecs: readonly TourStepSpec<ProductionOverviewTourStep>[] = productionTourSteps.map(id => ({
    id,
    anchor: productionTourSelector(id),
    kind: id === 'pd-handoff' ? 'handoff' : 'sample',
    ...(['pd-activate', 'pd-looms'].includes(id) ? { context: '[data-production-tour-preview="true"]' } : {}),
    ...(['pd-prereq', 'pd-activate', 'pd-board'].includes(id) ? { detail: true } : {}),
}))

/** Display-only numbers. No business record identifiers or action payloads. */
export const productionTourExample = { date: '2026-09-16', metres: 120, rate: 2, earnings: 240, correctedMetres: 125, correctedEarnings: 250 } as const
