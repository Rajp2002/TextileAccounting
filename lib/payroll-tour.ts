export type PayrollTourVariant = 'base' | 'full'
export const basePayrollTourSteps = ['period', 'periodStatus', 'summary', 'progress', 'readiness', 'search', 'filter', 'piece', 'salary', 'recovery', 'carry', 'advance', 'deduction', 'workspace', 'breakdown', 'mode', 'paymentDate', 'note', 'confirm', 'paid', 'complete', 'records', 'workerRecord', 'machineRecord', 'export', 'correction', 'finish'] as const
export const fullPayrollTourSteps = ['cycle', 'rules', 'payWindow', 'summary', 'search', 'tabs', 'piece', 'salary', 'fullSettlement', 'adjustment', 'fullRecovery', 'mode', 'finalSettlement', 'confirm', 'paid', 'history', 'receipt', 'csv', 'slip', 'whatsapp', 'finish'] as const
export type PayrollTourStep = typeof basePayrollTourSteps[number] | typeof fullPayrollTourSteps[number]
export function payrollTourSteps(variant: PayrollTourVariant): readonly PayrollTourStep[] {
    return variant === 'base' ? basePayrollTourSteps : fullPayrollTourSteps
}
export function payrollTourSurface(step: PayrollTourStep) {
    if (['advance', 'deduction', 'rules', 'correction'].includes(step)) return step as 'advance' | 'deduction' | 'rules' | 'correction'
    if (['workspace', 'breakdown', 'mode', 'paymentDate', 'note', 'confirm', 'paid', 'complete', 'fullSettlement', 'adjustment', 'fullRecovery', 'finalSettlement'].includes(step)) return 'settlement'
    if (['records', 'workerRecord', 'machineRecord', 'export', 'history', 'receipt', 'csv'].includes(step)) return 'records'
    return 'page'
}
export function payrollTourSection(step: PayrollTourStep) {
    if (['period', 'periodStatus', 'cycle', 'rules', 'payWindow'].includes(step)) return 0
    if (['summary', 'progress', 'readiness'].includes(step)) return 1
    if (['search', 'filter', 'tabs', 'piece', 'salary', 'recovery', 'carry'].includes(step)) return 2
    if (['advance', 'deduction'].includes(step)) return 3
    if (payrollTourSurface(step) === 'settlement') return 4
    if (step !== 'finish') return 5
    return 6
}
export const payrollTourSelector = (step: PayrollTourStep) => `[data-payroll-tour="${step}"]`

/** Display-only examples, deliberately separate from business action payloads. */
export function makePayrollTourExample() {
    const piece = { id: 'tour-payroll-piece', name: 'Sample weaver', metres: 1000, rate: 2, gross: 2000, debt: 1000, recovery: 500, net: 1500, carry: 500 }
    const salary = { id: 'tour-payroll-salary', name: 'Sample staff', monthly: 18000, days: 30, monthDays: 30, gross: 18000, recovery: 0, net: 18000 }
    return { piece, salary, period: '01–30 Sep 2026', gross: piece.gross + salary.gross, recovery: piece.recovery, net: piece.net + salary.net, paid: salary.net, remaining: piece.net }
}
