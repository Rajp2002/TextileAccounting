export type PayrollTourVariant = 'base' | 'full'
export type PayrollTourTrack = 'core' | 'help'

export const basePayrollTourSteps = ['period', 'readiness', 'earnings', 'recovery', 'obligations', 'paymentDetails', 'confirm', 'paid', 'complete', 'finish'] as const
export const fullPayrollTourSteps = ['cycle', 'fullEarnings', 'fullSettlement', 'fullRecovery', 'mode', 'finalSettlement', 'confirm', 'paid', 'finish'] as const
export const basePayrollHelpSteps = ['advance', 'deduction', 'records', 'machineRecord', 'export', 'correction', 'finish'] as const
export const fullPayrollHelpSteps = ['rules', 'adjustment', 'history', 'receipt', 'csv', 'slip', 'whatsapp', 'finish'] as const
export type PayrollTourStep = typeof basePayrollTourSteps[number] | typeof fullPayrollTourSteps[number] | typeof basePayrollHelpSteps[number] | typeof fullPayrollHelpSteps[number]

export function payrollTourSteps(variant: PayrollTourVariant, track: PayrollTourTrack = 'core'): readonly PayrollTourStep[] {
    if (track === 'help') return variant === 'base' ? basePayrollHelpSteps : fullPayrollHelpSteps
    return variant === 'base' ? basePayrollTourSteps : fullPayrollTourSteps
}
export function payrollTourSurface(step: PayrollTourStep) {
    if (['advance', 'deduction', 'rules', 'correction'].includes(step)) return step as 'advance' | 'deduction' | 'rules' | 'correction'
    if (['obligations', 'paymentDetails', 'mode', 'confirm', 'paid', 'complete', 'fullSettlement', 'adjustment', 'fullRecovery', 'finalSettlement'].includes(step)) return 'settlement'
    if (['records', 'machineRecord', 'export', 'history', 'receipt', 'csv', 'slip', 'whatsapp'].includes(step)) return 'records'
    return 'page'
}
export function payrollTourSection(step: PayrollTourStep) {
    if (['period', 'cycle', 'rules'].includes(step)) return 0
    if (step === 'readiness') return 1
    if (['earnings', 'fullEarnings', 'recovery'].includes(step)) return 2
    if (['advance', 'deduction'].includes(step)) return 3
    if (payrollTourSurface(step) === 'settlement') return 4
    if (step !== 'finish') return 5
    return 6
}
export const payrollTourSelector = (step: PayrollTourStep) => `[data-payroll-tour="${step}"]`

/** Display-only examples, deliberately separate from business action payloads. */
export function makePayrollTourExample() {
    const piece = { id: 'tour-payroll-piece', metres: 1000, rate: 2, gross: 2000, debt: 1000, recovery: 1000, net: 1000, carry: 0 }
    const salary = { id: 'tour-payroll-salary', monthly: 18000, days: 30, monthDays: 30, gross: 18000, recovery: 0, net: 18000 }
    const zero = { id: 'tour-payroll-zero', gross: 0, net: 0 }
    return { piece, salary, zero, period: '01–30 Sep 2026', gross: piece.gross + salary.gross, recovery: piece.recovery, net: piece.net + salary.net, paid: salary.net, remaining: piece.net }
}
