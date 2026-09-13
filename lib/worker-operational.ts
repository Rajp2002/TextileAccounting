import type { BaseProductionWorker } from './base-production-core'

export type BaseProductionWorkerWithOperational = BaseProductionWorker & {
    assignedMachineCount?: number
}

export type WorkerOperationalSummary = {
    isPieceRate: boolean
    isFixedSalary: boolean
    assignedMachineCount: number
    hasRateConfigured: boolean
    rateStatusLabel: 'Configured' | 'Not configured'
    hasSalaryConfigured: boolean
    salaryStatusLabel: 'Configured' | 'Not configured'
    payrollStatusLabel: 'Ready' | 'Needs setup'
}

/**
 * Derives authoritative operational readiness indicators for worker cards.
 *
 * Rules:
 * - Piece-rate workers:
 *   - Rate setup is "Configured" if worker.rate_per_meter > 0, otherwise "Not configured".
 *   - Machine assignments count is derived from active effective assignments.
 *
 * - Fixed-salary workers:
 *   - Salary is "Configured" if monthly_salary > 0 or has salary_history, otherwise "Not configured".
 *   - Payroll is "Ready" if salary is configured AND worker.start_date is defined (required for calculation);
 *     otherwise "Needs setup".
 *   - Raw salary amounts are never exposed on card overviews to maintain privacy.
 */
export function getWorkerOperationalSummary(
    worker: BaseProductionWorkerWithOperational
): WorkerOperationalSummary {
    const isFixedSalary = worker.pay_type === 'fixed_monthly'
    const isPieceRate = !isFixedSalary

    const assignedMachineCount = typeof worker.assignedMachineCount === 'number'
        ? Math.max(0, worker.assignedMachineCount)
        : 0

    // Piece-rate configuration
    const hasRateConfigured = Boolean(
        typeof worker.rate_per_meter === 'number' && worker.rate_per_meter > 0
    )
    const rateStatusLabel = hasRateConfigured ? 'Configured' : 'Not configured'

    // Fixed-salary configuration
    const hasMonthlySalary = typeof worker.monthly_salary === 'number' && worker.monthly_salary > 0
    const hasSalaryHistory = Boolean(worker.salary_history && worker.salary_history.length > 0)
    const hasSalaryConfigured = hasMonthlySalary || hasSalaryHistory
    const salaryStatusLabel = hasSalaryConfigured ? 'Configured' : 'Not configured'

    // Fixed-salary payroll readiness: requires salary AND start_date
    const hasStartDate = Boolean(worker.start_date && worker.start_date.trim().length > 0)
    const isPayrollReady = hasSalaryConfigured && hasStartDate
    const payrollStatusLabel = isPayrollReady ? 'Ready' : 'Needs setup'

    return {
        isPieceRate,
        isFixedSalary,
        assignedMachineCount,
        hasRateConfigured,
        rateStatusLabel,
        hasSalaryConfigured,
        salaryStatusLabel,
        payrollStatusLabel,
    }
}
