export const dispatchTourSteps = ['overview', 'tabs', 'search', 'status', 'new', 'quality', 'rate', 'parties', 'terms', 'optional', 'lots', 'keyboard', 'totals', 'saveDraft', 'print', 'confirm', 'yarn', 'issued', 'receipt', 'acknowledged', 'difference', 'resolve', 'balance', 'payment', 'adjustment', 'due', 'changeTerms', 'refund', 'audit', 'reverseEntry', 'reverseDispatch', 'legacy', 'finish'] as const
export type DispatchTourStep = typeof dispatchTourSteps[number]
export function dispatchTourSection(step: DispatchTourStep) {
    const i = dispatchTourSteps.indexOf(step)
    return i < 4 ? 0 : i < 10 ? 1 : i < 15 ? 2 : i < 18 ? 3 : i < 22 ? 4 : i < 28 ? 5 : 6
}
export function dispatchTourSurface(step: DispatchTourStep) {
    if (['new', 'quality', 'rate', 'parties', 'terms', 'optional', 'lots', 'keyboard', 'totals', 'saveDraft'].includes(step)) return 'draft'
    if (['confirm', 'yarn'].includes(step)) return 'confirm'
    if (['receipt', 'acknowledged'].includes(step)) return 'receipt'
    if (['resolve', 'payment', 'adjustment', 'changeTerms', 'refund', 'reverseDispatch', 'reverseEntry'].includes(step)) return step
    if (['print', 'issued', 'difference', 'balance', 'due', 'audit'].includes(step)) return 'detail'
    return 'page'
}
export const dispatchTourSelector = (step: DispatchTourStep) => `[data-dispatch-tour="${step}"]`
/** Display-only illustrations with no business record IDs. */
export const dispatchTourExample = { sent: 100, received: 98, rate: 40, value: 4000, acceptedValue: 3920, payment: 2000, balance: 1920, credit: 80, yarnKgPer100: 10, yarnDeduction: 10 } as const
