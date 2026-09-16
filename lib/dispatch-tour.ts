/** Core workflow; secondary controls remain available as contextual help. */
export const dispatchTourSteps = ['overview', 'quality', 'parties', 'lots', 'saveDraft', 'confirm', 'receipt', 'difference', 'payment', 'balance', 'finish'] as const
export type DispatchTourStep = typeof dispatchTourSteps[number]
export const dispatchTourHelp = {
    overview: ['status'],
    quality: ['new', 'yarn'],
    parties: ['rate', 'terms'],
    lots: ['keyboard', 'totals'],
    saveDraft: ['optional', 'print'],
    confirm: ['issued', 'reverseDispatch'],
    receipt: ['acknowledged'],
    difference: ['resolve'],
    payment: ['adjustment', 'reverseEntry'],
    balance: ['due', 'changeTerms', 'refund'],
    finish: ['tabs', 'search', 'audit', 'legacy'],
} as const satisfies Record<DispatchTourStep, readonly string[]>
export type DispatchTourHelpTopic = typeof dispatchTourHelp[DispatchTourStep][number]
export type DispatchTourTopic = DispatchTourStep | DispatchTourHelpTopic
export function dispatchTourSection(step: DispatchTourStep) {
    const i = dispatchTourSteps.indexOf(step)
    return i === 0 ? 0 : i < 5 ? 1 : i === 5 ? 2 : i < 8 ? 3 : i < 10 ? 4 : 5
}
export function dispatchTourSurface(step: DispatchTourStep) {
    if (['quality', 'parties', 'lots', 'saveDraft'].includes(step)) return 'draft'
    if (step === 'confirm' || step === 'receipt' || step === 'payment') return step
    if (step === 'difference' || step === 'balance') return 'detail'
    return 'page'
}
export const dispatchTourSelector = (step: DispatchTourStep) => `[data-dispatch-tour="${step}"]`
/** Display-only illustrations with no business record IDs. */
export const dispatchTourExample = { sent: 100, received: 98, rate: 40, value: 4000, acceptedValue: 3920, payment: 2000, balance: 1920, credit: 80, yarnKgPer100: 10, yarnDeduction: 10 } as const
