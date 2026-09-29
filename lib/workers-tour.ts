import type { BaseProductionWorkerWithOperational } from './worker-operational'
import type { Language } from './i18n/context'
import type { TourStepSpec } from './tours/tour-types'
import { workersTutorialCopy } from './i18n/workers-tutorial'

export const workersTourPaths = {
    piece: ['wk-paytype', 'wkp-availability', 'wkp-wage', 'wkp-loom', 'wkp-earnings', 'wk-handoff'],
    salary: ['wk-paytype', 'wks-salary', 'wks-joining', 'wks-changes', 'wks-payroll', 'wk-handoff'],
} as const
export type WorkersTourPath = keyof typeof workersTourPaths
export type WorkersTourStep = typeof workersTourPaths[WorkersTourPath][number]
export type WorkersTourCopyKey = 'paytype' | 'availability' | 'wage' | 'loom' | 'earnings' | 'salary' | 'joining' | 'changes' | 'payroll' | 'handoff'
export const workersTourSteps = [...new Set<WorkersTourStep>([...workersTourPaths.piece, ...workersTourPaths.salary])]
export const workersHelpSteps = ['search', 'shiftFilter', 'statusFilter', 'groups', 'pieceCard', 'salaryReadiness', 'add', 'name', 'salaryRole', 'edit', 'lastDay', 'active'] as const
export type WorkersHelpStep = typeof workersHelpSteps[number]
export type WorkersTourEditor = 'piece' | 'salary' | 'edit' | null

export function workersTourEditor(step: WorkersTourStep, path: WorkersTourPath = 'piece'): WorkersTourEditor {
    if (step === 'wk-paytype') return path
    if (step === 'wkp-availability') return 'piece'
    if (step === 'wks-salary' || step === 'wks-joining') return 'salary'
    if (step === 'wks-changes') return 'edit'
    return null
}

export function workersTourCopyKey(step: WorkersTourStep): WorkersTourCopyKey {
    return step.replace(/^wk[ps]?-/, '') as WorkersTourCopyKey
}

export function workersTourControlLabels(t: (key: string) => string) {
    return { addWorker: t('workers.addWorker'), viewPayroll: t('workers.viewPayroll') }
}

/** A fixed 30-day month keeps the joining date and the worked ₹9,000 example aligned. */
export const workersTourExample = {
    meters: 100, wage: 1.5, monthlySalary: 18000,
    joining: '2026-09-16', periodStart: '2026-09-01', periodEnd: '2026-09-30',
} as const

/** In-memory examples only. These non-UUID IDs must never reach worker actions. */
export function makeWorkersTourExamples(language: Language = 'en'): BaseProductionWorkerWithOperational[] {
    const names = workersTutorialCopy[language].samples
    return [
        { id: 'tour-workers-piece', name: names.worker, pay_type: 'piece_rate', shift_availability: 'both', rate_per_meter: 0, is_active: true, assignedMachineCount: 2 },
        { id: 'tour-workers-salary', name: names.staff, pay_type: 'fixed_monthly', role: names.role, shift_availability: 'both', rate_per_meter: 0, monthly_salary: workersTourExample.monthlySalary, salary_history: [{ effective_from: workersTourExample.joining, monthly_salary: workersTourExample.monthlySalary }], start_date: workersTourExample.joining, is_active: true, assignedMachineCount: 0 },
    ]
}
const piece = '[data-workers-tour="piece"]'
const salary = '[data-workers-tour="salary-card"]'
export const workersTourSelectors: Record<WorkersTourStep, string> = {
    'wk-paytype': '[data-workers-tour-field="payType"]',
    'wkp-availability': '[data-workers-tour-field="availability"]',
    'wkp-wage': `${piece} [data-workers-tour="readiness"]`,
    'wkp-loom': `${piece} [data-workers-tour="assignments"]`,
    'wkp-earnings': `${piece} [data-workers-tour="readiness"]`,
    'wks-salary': '[data-workers-tour-field="salary"]',
    'wks-joining': '[data-workers-tour-field="joining"]',
    'wks-changes': '[data-workers-tour-field="effective"]',
    'wks-payroll': `${salary} [data-workers-tour="payroll"]`,
    'wk-handoff': '[data-tour-anchor="workers.add"]',
}

export function workersTourSpecs(path: WorkersTourPath): readonly TourStepSpec<WorkersTourStep>[] {
    return workersTourPaths[path].map(id => ({
        id, anchor: workersTourSelectors[id], kind: id === 'wk-handoff' ? 'handoff' : 'sample',
        // Path changes replace the editor while keeping the same first step. A distinct
        // context restarts readiness on every switch, without remounting the tour.
        ...(workersTourEditor(id, path) ? { context: '[data-workers-tour-preview="true"]' + (id === 'wk-paytype' ? `:has([data-workers-tour-field="${path === 'piece' ? 'availability' : 'salary'}"])` : '') } : {}),
    }))
}
