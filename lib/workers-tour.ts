import type { BaseProductionWorkerWithOperational } from './worker-operational'

export const workersTourPaths = {
    piece: ['purpose', 'payType', 'availability', 'pieceReadiness', 'assignments', 'earnings', 'finish'],
    salary: ['purpose', 'payType', 'salary', 'joining', 'effective', 'lastDay', 'payroll', 'finish'],
} as const
export type WorkersTourPath = keyof typeof workersTourPaths
export type WorkersTourStep = typeof workersTourPaths[WorkersTourPath][number]
export const workersTourSteps = [...new Set<WorkersTourStep>([...workersTourPaths.piece, ...workersTourPaths.salary])]
export const workersHelpSteps = ['search', 'shiftFilter', 'statusFilter', 'groups', 'pieceCard', 'salaryReadiness', 'add', 'name', 'salaryRole', 'edit', 'lastDay', 'active'] as const
export type WorkersHelpStep = typeof workersHelpSteps[number]
export type WorkersTourEditor = 'piece' | 'salary' | 'edit' | null

export function workersTourEditor(step: WorkersTourStep, path: WorkersTourPath = 'piece'): WorkersTourEditor {
    if (step === 'payType') return path
    if (step === 'availability') return 'piece'
    if (step === 'salary' || step === 'joining') return 'salary'
    if (step === 'effective' || step === 'lastDay') return 'edit'
    return null
}

/** In-memory examples only. These non-UUID IDs must never reach worker actions. */
export function makeWorkersTourExamples(today: string): BaseProductionWorkerWithOperational[] {
    return [
        { id: 'tour-workers-piece', name: 'Sample worker', pay_type: 'piece_rate', shift_availability: 'both', rate_per_meter: 0, is_active: true, assignedMachineCount: 2 },
        { id: 'tour-workers-salary', name: 'Sample staff', pay_type: 'fixed_monthly', role: 'Supervisor', shift_availability: 'both', rate_per_meter: 0, monthly_salary: 18000, salary_history: [{ effective_from: today, monthly_salary: 18000 }], start_date: today, is_active: true, assignedMachineCount: 0 },
    ]
}
const piece = '[data-workers-tour="piece"]'
const salary = '[data-workers-tour="salary-card"]'
export const workersTourSelectors: Record<WorkersTourStep, string> = {
    purpose: '[data-workers-tour="groups"]',
    payType: '[data-workers-tour-field="payType"]',
    availability: '[data-workers-tour-field="availability"]',
    pieceReadiness: `${piece} [data-workers-tour="readiness"]`,
    assignments: `${piece} [data-workers-tour="assignments"]`,
    earnings: piece,
    salary: '[data-workers-tour-field="salary"]',
    joining: '[data-workers-tour-field="joining"]',
    effective: '[data-workers-tour-field="effective"]',
    lastDay: '[data-workers-tour-field="lastDay"]',
    payroll: `${salary} [data-workers-tour="payroll"]`,
    finish: '[data-workers-tour="header"]',
}
