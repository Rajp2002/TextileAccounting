import type { TourStepSpec } from './tours/tour-types'
import { TOUR_SURFACE_SELECTOR } from './tours/sample-surface'

export type PayrollTourVariant = 'base'
export type PayrollTourTrack = 'core' | 'help'
export const basePayrollTourSteps = ['pr-period', 'pr-readiness', 'pr-earnings', 'pr-recovery', 'pr-settle', 'pr-paid', 'pr-complete', 'pr-handoff'] as const
export const basePayrollHelpSteps = ['pra-advance', 'pra-deduction', 'pra-records', 'pra-export', 'pra-correct', 'pra-handoff'] as const
export type PayrollTourStep = typeof basePayrollTourSteps[number] | typeof basePayrollHelpSteps[number]
export function payrollTourSteps(track: PayrollTourTrack = 'core'): readonly PayrollTourStep[] {
    return track === 'help' ? basePayrollHelpSteps : basePayrollTourSteps
}
/** Steps that teach a real dialog: the settlement workspace, Mark paid, Record advance, Record deduction, Reverse payment. */
const DIALOG_STEPS: readonly PayrollTourStep[] = ['pr-settle', 'pr-paid', 'pr-complete', 'pra-advance', 'pra-deduction', 'pra-correct']
const anchors: Record<PayrollTourStep, string> = {
    'pr-period': 'period', 'pr-readiness': 'readiness', 'pr-earnings': 'earnings',
    'pr-recovery': 'recovery', 'pr-settle': 'settle', 'pr-paid': 'paymentDetails',
    'pr-complete': 'complete', 'pr-handoff': 'payroll.settle',
    'pra-advance': 'advance', 'pra-deduction': 'deduction', 'pra-records': 'records',
    'pra-export': 'export', 'pra-correct': 'correction', 'pra-handoff': 'payroll.records',
}
export const payrollTourSelector = (step: PayrollTourStep) => step.endsWith('handoff')
    ? `[data-tour-anchor="${anchors[step]}"]` : `[data-payroll-tour="${anchors[step]}"]`
const specs = (steps: readonly PayrollTourStep[]): readonly TourStepSpec<PayrollTourStep>[] => steps.map(id => ({
    id, anchor: payrollTourSelector(id), kind: id.endsWith('handoff') ? 'handoff' : 'sample',
    ...(DIALOG_STEPS.includes(id) ? { context: TOUR_SURFACE_SELECTOR } : {}),
    ...(['pr-period', 'pr-settle'].includes(id) ? { detail: true } : {}),
}))
export const payrollTourSpecs = specs(basePayrollTourSteps)
export const payrollHelpSpecs = specs(basePayrollHelpSteps)
