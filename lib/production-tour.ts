export const productionTourSteps = ['overview', 'tabs', 'qualities', 'activate', 'costing', 'wage', 'allocate', 'loomStates', 'board', 'filters', 'operators', 'switchQuality', 'deactivate', 'daily', 'date', 'shift', 'print', 'reading', 'pending', 'notRunning', 'rollup', 'workerStatus', 'draft', 'save', 'incomplete', 'history', 'saved', 'correction', 'audit', 'finish'] as const
export type ProductionTourStep = typeof productionTourSteps[number]
export function productionTourSection(step: ProductionTourStep) {
    const index = productionTourSteps.indexOf(step)
    return index < 2 ? 0 : index < 6 ? 1 : index < 13 ? 2 : index < 20 ? 3 : index < 25 ? 4 : 5
}
export function productionTourSurface(step: ProductionTourStep) {
    if (['activate', 'costing', 'wage'].includes(step)) return 'activate'
    if (['allocate', 'loomStates'].includes(step)) return 'allocate'
    if (['switchQuality', 'deactivate', 'incomplete', 'correction', 'audit'].includes(step)) return step
    return productionTourSteps.indexOf(step) < 13 ? 'overview' : 'daily'
}
export const productionTourSelector = (step: ProductionTourStep) => `[data-production-tour="${step}"]`
/** Display-only numbers. No business record identifiers or action payloads. */
export const productionTourExample = { date: '2026-09-16', metres: 120, rate: 2, earnings: 240, correctedMetres: 125, correctedEarnings: 250 } as const
