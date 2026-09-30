import type {
    BaseProductionAllocation,
    BaseProductionEntry,
    BaseWorkerPayable,
} from './base-production-core'

export type BasePayrollReadinessIssueCode =
    | 'incentive_review'
    | 'allocation_mismatch'
    | 'missing_allocation'
    | 'missing_context'
    | 'missing_rate'

export type BasePayrollReadinessIssue = {
    code: BasePayrollReadinessIssueCode
    entryId: string
    productionDate: string
    shift: string | null
    message: string
}

export type BaseWorkerPayrollReadiness = {
    workerId: string
    verifiedLineCount: number
    machineLineCount: number
    legacyLineCount: number
    issueCount: number
    issues: BasePayrollReadinessIssue[]
    readyToSettle: boolean
}

export type BasePayrollReadiness = {
    salaryLineCount: number
    verifiedLineCount: number
    machineLineCount: number
    legacyLineCount: number
    issueCount: number
    readyWorkerCount: number
    workers: BaseWorkerPayrollReadiness[]
}

const METER_TOLERANCE = 0.01

function positive(value: number) {
    return Number.isFinite(value) && value > 0
}

function issue(
    entry: BaseProductionEntry,
    code: BasePayrollReadinessIssueCode,
    message: string,
): BasePayrollReadinessIssue {
    return {
        code,
        entryId: entry.id,
        productionDate: entry.production_date,
        shift: entry.shift ?? null,
        message,
    }
}

export function buildBasePayrollReadiness({
    payables,
    entries,
    allocations,
}: {
    payables: BaseWorkerPayable[]
    entries: BaseProductionEntry[]
    allocations: BaseProductionAllocation[]
}): BasePayrollReadiness {
    // Keep source order within each worker, including duplicate entries. This
    // index belongs only to this calculation; corrections are read on every call.
    const entriesByWorker = new Map<string, BaseProductionEntry[]>()
    for (const entry of entries) {
        const current = entriesByWorker.get(entry.worker_id) ?? []
        current.push(entry)
        entriesByWorker.set(entry.worker_id, current)
    }
    const allocationsByEntry = new Map<string, BaseProductionAllocation[]>()
    for (const allocation of allocations) {
        const current = allocationsByEntry.get(allocation.entry_id) ?? []
        current.push(allocation)
        allocationsByEntry.set(allocation.entry_id, current)
    }

    const workers = payables.map((payable): BaseWorkerPayrollReadiness => {
        const periodEntries = (entriesByWorker.get(payable.worker_id) ?? []).filter((entry) => (
            entry.production_date >= payable.period_start
            && entry.production_date <= payable.period_end
            && positive(entry.meters)
            && entry.entry_status !== 'zero'
            && entry.entry_status !== 'absent'
        ))
        const issues: BasePayrollReadinessIssue[] = (payable.incentive_review_ids ?? []).map(id => ({
            code: 'incentive_review', entryId: id, productionDate: payable.period_end, shift: null,
            message: 'Review incentives and include their complete service periods before payment.',
        }))
        let machineLineCount = 0
        let legacyLineCount = 0

        for (const entry of periodEntries) {
            if (entry.allocation_mode !== 'machine_breakdown') {
                legacyLineCount += 1
                if (entry.piece_earning_state !== 'inapplicable' && !positive(entry.worker_rate_snapshot)) {
                    issues.push(issue(entry, 'missing_rate', 'A saved worker total has no positive pay rate.'))
                }
                continue
            }

            const entryAllocations = allocationsByEntry.get(entry.id) ?? []
            machineLineCount += entryAllocations.length
            if (entryAllocations.length === 0) {
                issues.push(issue(entry, 'missing_allocation', 'Machine production has no payroll allocation.'))
                continue
            }

            const allocationMeters = entryAllocations.reduce((total, allocation) => total + allocation.meters, 0)
            if (Math.abs(allocationMeters - entry.meters) > METER_TOLERANCE) {
                issues.push(issue(entry, 'allocation_mismatch', 'Machine metres do not match the worker total.'))
            }
            if (entryAllocations.some((allocation) => allocation.worker_id !== entry.worker_id || !allocation.machine_id || !allocation.job_id)) {
                issues.push(issue(entry, 'missing_context', 'A machine line is missing its worker, machine, or costing context.'))
            }
            if (entryAllocations.some((allocation) => allocation.piece_earning_state !== 'inapplicable' && !positive(allocation.worker_rate_snapshot))) {
                issues.push(issue(entry, 'missing_rate', 'A machine line has no positive saved weaver rate.'))
            }
        }

        return {
            workerId: payable.worker_id,
            machineLineCount,
            legacyLineCount,
            verifiedLineCount: machineLineCount + legacyLineCount,
            issueCount: issues.length,
            issues,
            readyToSettle: payable.status === 'unsettled' && payable.gross_pay > 0 && issues.length === 0,
        }
    })

    const summary: BasePayrollReadiness = {
        salaryLineCount: payables.filter(payable => payable.pay_type === 'fixed_monthly' && payable.status !== 'paid').reduce((total, payable) => total + (payable.salary_lines?.length ?? 0), 0),
        verifiedLineCount: 0,
        machineLineCount: 0,
        legacyLineCount: 0,
        issueCount: 0,
        readyWorkerCount: 0,
        workers,
    }
    for (const worker of workers) {
        summary.verifiedLineCount += worker.verifiedLineCount
        summary.machineLineCount += worker.machineLineCount
        summary.legacyLineCount += worker.legacyLineCount
        summary.issueCount += worker.issueCount
        if (worker.readyToSettle) summary.readyWorkerCount += 1
    }
    return summary
}
