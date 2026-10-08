import type { TourStepSpec } from './tours/tour-types'
import { TOUR_SURFACE_SELECTOR } from './tours/sample-surface'

export const dispatchTourSteps = ['overview', 'quality', 'parties', 'lots', 'saveDraft', 'confirm', 'receipt', 'difference', 'payment', 'handoff'] as const
export type DispatchTourStep = typeof dispatchTourSteps[number]

/** Steps that teach a real dialog: the draft editor (four steps), Confirm, Record receipt, the dispatch detail and Record payment. */
const DIALOG_STEPS: readonly DispatchTourStep[] = ['quality', 'parties', 'lots', 'saveDraft', 'confirm', 'receipt', 'difference', 'payment']

export const dispatchTourSelector = (step: DispatchTourStep) => step === 'handoff'
    ? '[data-tour-anchor="dispatch.new"]'
    : `[data-dispatch-tour="${step}"]`

export const dispatchTourSpecs: readonly TourStepSpec<DispatchTourStep>[] = dispatchTourSteps.map(id => ({
    id,
    anchor: dispatchTourSelector(id),
    kind: id === 'handoff' ? 'handoff' : 'sample',
    ...(DIALOG_STEPS.includes(id) ? { context: TOUR_SURFACE_SELECTOR } : {}),
    ...(['confirm', 'payment'].includes(id) ? { detail: true } : {}),
}))
