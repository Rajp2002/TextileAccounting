import type { TourStepSpec } from './tours/tour-types'

export const dispatchTourSteps = ['overview', 'quality', 'parties', 'lots', 'saveDraft', 'confirm', 'receipt', 'difference', 'payment', 'handoff'] as const
export type DispatchTourStep = typeof dispatchTourSteps[number]

export function dispatchTourSurface(step: DispatchTourStep) {
    if (['quality', 'parties', 'lots', 'saveDraft'].includes(step)) return 'draft'
    if (step === 'confirm' || step === 'receipt' || step === 'payment') return step
    if (step === 'difference') return 'detail'
    if (step === 'handoff') return 'live'
    return 'page'
}

export const dispatchTourSelector = (step: DispatchTourStep) => step === 'handoff'
    ? '[data-tour-anchor="dispatch.new"]'
    : `[data-dispatch-tour="${step}"]`

export const dispatchTourSpecs: readonly TourStepSpec<DispatchTourStep>[] = dispatchTourSteps.map(id => ({
    id,
    anchor: dispatchTourSelector(id),
    kind: id === 'handoff' ? 'handoff' : 'sample',
    ...(['draft', 'confirm', 'receipt', 'payment'].includes(dispatchTourSurface(id))
        ? { context: '[data-dispatch-tour-preview="true"]' } : {}),
    ...(['confirm', 'payment'].includes(id) ? { detail: true } : {}),
}))

/** Display-only fabric/receipt/payment illustration, with no business record IDs. */
export const dispatchTourExample = { sent: 100, received: 98, rate: 40, value: 4000, acceptedValue: 3920, payment: 2000, balance: 1920, credit: 80 } as const
