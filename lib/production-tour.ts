/** The first-use workflow; maintenance is a separately replayable walkthrough. */
export const productionTourSteps = ['overview', 'prerequisites', 'activate', 'allocate', 'operators', 'date', 'reading', 'pending', 'rollup', 'draft', 'save', 'finish'] as const
export const productionTourDetailSteps = ['board', 'loomStates', 'switchQuality', 'deactivate', 'print', 'workerStatus', 'incomplete', 'history', 'saved', 'correction', 'audit'] as const
export type ProductionTourStep = typeof productionTourSteps[number] | typeof productionTourDetailSteps[number]
export type ProductionTourField = ProductionTourStep | 'tabs' | 'qualities' | 'filters' | 'daily'
export const productionTourAllSteps = [...productionTourSteps, ...productionTourDetailSteps] as const
export function productionTourSequence(step: ProductionTourStep): readonly ProductionTourStep[] {
    return (productionTourDetailSteps as readonly ProductionTourStep[]).includes(step) ? productionTourDetailSteps : productionTourSteps
}
export function productionTourSection(step: ProductionTourStep) {
    if ((productionTourDetailSteps as readonly ProductionTourStep[]).includes(step)) return productionTourDetailSteps.indexOf(step as typeof productionTourDetailSteps[number]) < 4 ? 2 : 3
    return (productionTourSteps as readonly ProductionTourStep[]).indexOf(step) < 5 ? 0 : 1
}
export function productionTourSurface(step: ProductionTourStep) {
    if (step === 'activate') return 'activate'
    if (['allocate', 'loomStates'].includes(step)) return 'allocate'
    if (['switchQuality', 'deactivate', 'incomplete', 'correction', 'audit'].includes(step)) return step
    return ['overview', 'prerequisites', 'board', 'operators'].includes(step) ? 'overview' : 'daily'
}
export const productionTourSelector = (step: ProductionTourStep) => `[data-production-tour="${step}"]`
/** Display-only numbers. No business record identifiers or action payloads. */
export const productionTourExample = { date: '2026-09-16', metres: 120, rate: 2, earnings: 240, correctedMetres: 125, correctedEarnings: 250 } as const
