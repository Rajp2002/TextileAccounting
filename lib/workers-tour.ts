import type { BaseProductionWorkerWithOperational } from './worker-operational'

export const workersTourSteps = ['search', 'shiftFilter', 'statusFilter', 'groups', 'pieceCard', 'pieceReadiness', 'salaryReadiness', 'add', 'name', 'payType', 'availability', 'salaryRole', 'salary', 'joining', 'edit', 'effective', 'lastDay', 'active', 'assignments', 'payroll', 'finish'] as const
export type WorkersTourStep = typeof workersTourSteps[number]
export type WorkersTourEditor = 'piece' | 'salary' | 'edit' | null

export function workersTourEditor(step: WorkersTourStep): WorkersTourEditor {
    if (['name', 'payType', 'availability'].includes(step)) return 'piece'
    if (['salaryRole', 'salary', 'joining'].includes(step)) return 'salary'
    if (['effective', 'lastDay', 'active'].includes(step)) return 'edit'
    return null
}
export function workersTourSection(step: WorkersTourStep): number {
    const index = workersTourSteps.indexOf(step)
    return index < 3 ? 0 : index < 5 ? 1 : index < 7 ? 2 : index < 10 ? 3 : index < 14 ? 4 : index < 18 ? 5 : 6
}

/** In-memory examples only. These non-UUID IDs must never reach worker actions. */
export function makeWorkersTourExamples(today: string): BaseProductionWorkerWithOperational[] {
    return [
        { id: 'tour-workers-piece', name: 'Sample worker', pay_type: 'piece_rate', shift_availability: 'both', rate_per_meter: 1.5, is_active: true, assignedMachineCount: 2 },
        { id: 'tour-workers-salary', name: 'Sample staff', pay_type: 'fixed_monthly', role: 'Supervisor', shift_availability: 'both', rate_per_meter: 0, monthly_salary: 18000, start_date: today, is_active: true, assignedMachineCount: 0 },
    ]
}
const piece = '[data-workers-tour="piece"]'
const salary = '[data-workers-tour="salary-card"]'
export const workersTourSelectors: Record<WorkersTourStep, string> = {
    search: '[data-workers-tour="toolbar"] input',
    shiftFilter: '[data-workers-tour="shift-filter"]',
    statusFilter: '[data-workers-tour="status-filter"]',
    groups: '[data-workers-tour="groups"]',
    pieceCard: piece,
    pieceReadiness: `${piece} [data-workers-tour="readiness"]`,
    salaryReadiness: `${salary} [data-workers-tour="readiness"]`,
    add: '[data-workers-tour="header"] header button',
    name: '[data-workers-tour-field="name"]',
    payType: '[data-workers-tour-field="payType"]',
    availability: '[data-workers-tour-field="availability"]',
    salaryRole: '[data-workers-tour-field="role"]',
    salary: '[data-workers-tour-field="salary"]',
    joining: '[data-workers-tour-field="joining"]',
    edit: `${salary} [data-workers-tour="edit"]`,
    effective: '[data-workers-tour-field="effective"]',
    lastDay: '[data-workers-tour-field="lastDay"]',
    active: '[data-workers-tour-field="active"]',
    assignments: `${piece} [data-workers-tour="assignments"]`,
    payroll: `${salary} [data-workers-tour="payroll"]`,
    finish: '[data-workers-tour="launcher"]',
}
