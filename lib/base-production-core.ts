import Decimal from 'decimal.js'
import type { BaseMachineRecord } from './base-machine-register'

import { calculateAdvanceRecovery } from './finance'
import { calculateBaseSalaryLines, type BaseSalaryRate, type BaseSalaryLine } from './base-salary'

export const BASE_PAYROLL_DEDUCTION_PERCENT = 50

export type BaseProductionJobStatus = 'planned' | 'active' | 'completed' | 'cancelled'
export type BasePayrollPaymentMode = 'cash' | 'bank_transfer' | 'upi' | 'cheque'
export type BaseProductionShift = 'day' | 'night'
export type BaseWorkerShiftAvailability = BaseProductionShift | 'both'
export type BaseDailyProductionStatus = 'blank' | 'entered' | 'zero' | 'absent'

export type BaseProductionMachine = {
    id: string
    name: string
    machine_type: string
    custom_label: string | null
    is_active: boolean
    /** Why the owner marked the machine unavailable; null while it is available. */
    inactive_reason?: string | null
}

export type BaseWorkerMachineAssignment = {
    id: string
    worker_id: string
    machine_id: string
    shift: BaseProductionShift
    active: boolean
    effective_from: string
    effective_to: string | null
}

export type BaseMachineJobContext = {
    id: string
    machine_id: string
    job_id: string
    effective_from: string
    effective_to: string | null
    active: boolean
}

export type BaseProductionBatch = {
    machine_records?: BaseMachineRecord[]
    id: string
    production_date: string
    shift: BaseProductionShift
    status: 'draft' | 'saved' | 'finalized'
    client_request_id: string
    created_at: string
    updated_at: string
}

export type BaseProductionRevisionSnapshot = {
    machine_records?: BaseMachineRecord[]
    total_meters: number
    entered_count: number
    zero_count: number
    absent_count: number
    worker_count: number
    entries?: Array<{
        worker_id: string
        pay_basis_snapshot?: 'piece_rate' | 'fixed_monthly'
        piece_earning_state?: 'applicable' | 'inapplicable'
        entry_status: BaseDailyProductionStatus
        meters: number
        worker_rate_snapshot: number
        allocations: Array<{ machine_id: string; machine_label: string; job_id: string; job_label: string; meters: number; worker_rate_snapshot: number; pay_basis_snapshot?: 'piece_rate' | 'fixed_monthly'; piece_earning_state?: 'applicable' | 'inapplicable' }>
    }>
}

export type BaseProductionBatchRevision = {
    id: string
    batch_id: string
    revision_number: number
    change_kind: 'created' | 'corrected'
    correction_reason: string | null
    before_snapshot: BaseProductionRevisionSnapshot | null
    after_snapshot: BaseProductionRevisionSnapshot
    changed_at: string
    changed_by?: string | null
}

export type BaseProductionWorker = {
    updated_at?: string
    pay_type?: 'piece_rate' | 'fixed_monthly'
    role?: string
    operator_eligible?: boolean
    operator_effective_from?: string | null
    operator_approved_by?: string | null
    operator_approved_at?: string | null
    monthly_salary?: number
    salary_effective_from?: string | null
    salary_history?: BaseSalaryRate[]
    start_date?: string | null
    end_date?: string | null
    id: string
    name: string
    rate_per_meter: number
    shift_availability: BaseWorkerShiftAvailability
    is_active: boolean
}

export type BaseProductionCosting = {
    id: string
    quality_label: string
    costing_group_id: string | null
    version_number: number
    order_quantity_m?: number | null
    production_cost_per_meter: number
    landed_cost_per_meter: number
    quote_price_per_meter: number
    worker_rate_per_meter: number
}

export type BaseProductionJob = {
    id: string
    costing_id: string
    costing_group_id: string | null
    costing_version: number | null
    quality_label: string
    target_meters: number
    start_date: string
    due_date: string | null
    customer_reference: string | null
    notes: string | null
    status: BaseProductionJobStatus
    worker_rate_per_meter: number
    planned_cost_per_meter: number
    planned_price_per_meter: number
    created_at: string
}

export type BaseProductionEntry = {
    pay_basis_snapshot?: 'piece_rate' | 'fixed_monthly'
    piece_earning_state?: 'applicable' | 'inapplicable'
    id: string
    job_id: string
    worker_id: string
    production_date: string
    meters: number
    worker_rate_snapshot: number
    notes: string | null
    created_at: string
    batch_id?: string | null
    shift?: BaseProductionShift
    entry_status?: BaseDailyProductionStatus
    allocation_mode?: 'worker_total' | 'machine_breakdown'
    machine_id?: string | null
    machine_label?: string | null
    job_label?: string | null
    assignment_snapshot?: unknown
}

export type BaseProductionAllocation = {
    pay_basis_snapshot?: 'piece_rate' | 'fixed_monthly'
    piece_earning_state?: 'applicable' | 'inapplicable'
    id: string
    entry_id: string
    worker_id: string
    assignment_id: string | null
    machine_id: string
    job_id: string
    meters: number
    worker_rate_snapshot: number
    machine_label: string
    job_label: string
    assignment_snapshot: unknown
    created_at: string
}

export type BaseDailyProductionRow = {
    worker_id: string
    meters: number | null
    status: BaseDailyProductionStatus
}

export type BaseDailyProductionSummary = {
    total_meters: number
    entered_count: number
    zero_count: number
    absent_count: number
    outstanding_count: number
}

export type BaseWorkerAdvance = {
    id: string
    worker_id: string
    amount: number
    recovered_amount: number
    description: string | null
    status: 'pending' | 'deducted'
    created_at: string
}

export type BaseWorkerIncentive = {
    id: string
    worker_id: string
    service_start: string
    service_end: string
    amount: number
    evidence_reference: string
    status: 'draft' | 'approved' | 'voided'
    updated_at: string
    approved_by: string | null
    approved_at: string | null
    void_reason?: string | null
    settlement_id?: string | null
}
export type BaseIncentiveSnapshot = {
    id: string
    service_start: string
    service_end: string
    amount: number
    evidence_reference: string
    approved_by: string
    approved_at: string
    updated_at: string
    calculation_version: 'manual-incentive-v1'
    currency: 'INR'
    unit: 'amount'
}
export type BasePayrollSettlement = {
    incentive_pay?: number
    id: string
    worker_id: string
    period_start: string
    period_end: string
    gross_pay: number
    advance_deducted: number
    net_payout: number
    payment_mode: BasePayrollPaymentMode
    paid_at: string
    status?: 'paid' | 'reversed'
    reversal_reason?: string | null
    reversed_at?: string | null
    recovery_receipt_complete?: boolean
    worker_name_snapshot?: string
    advance_balance_before?: number
    remaining_advance_balance?: number
    note?: string | null
    payroll_period_id?: string | null
}

export type BasePayrollPeriodStatus = 'open' | 'in_progress' | 'ready_to_complete' | 'settled'

export type BasePayrollPeriod = {
    id: string
    org_id?: string
    period_start: string
    period_end: string
    status: BasePayrollPeriodStatus
    total_gross: number
    total_recovery: number
    total_net: number
    total_workers: number
    paid_workers: number
    settled_at: string | null
    settled_by: string | null
    calculation_snapshot: unknown
    resolved_worker_ids?: string[]
    notes?: string | null
    created_at?: string
    updated_at?: string
}

export type BasePayrollPeriodSummary = {
    status: BasePayrollPeriodStatus
    totalGross: number
    totalRecovery: number
    totalNet: number
    totalWorkers: number
    paidWorkers: number
    outstandingWorkers: number
    resolvedWorkers: number
    paidAmount: number
    remainingAmount: number
    totalPaid: number
    totalRemaining: number
    progressPercent: number
    isReadyToComplete: boolean
    isSettled: boolean
    settledAt?: string | null
}

export type BasePayrollSettlementLine = {
    earning_snapshot?: BaseIncentiveSnapshot | null
    source_id?: string
    id: string
    settlement_id: string
    worker_id: string
    production_date: string
    shift: BaseProductionShift | null
    machine_id: string | null
    machine_label: string
    job_id: string | null
    costing_label: string
    meters: number
    worker_rate_snapshot: number
    gross_pay: number
    source_kind: 'legacy_entry' | 'worker_total' | 'machine_allocation' | 'fixed_salary' | 'manual_incentive'
}

export type BaseJobSummary = {
    produced_meters: number
    remaining_meters: number
    excess_meters: number
    progress_percent: number
    planned_cost_total: number
    planned_value_total: number
}

export type BaseWorkerPayable = {
    base_pay?: number
    incentive_pay?: number
    incentive_lines?: BaseWorkerIncentive[]
    incentive_review_ids?: string[]
    pay_type?: 'piece_rate' | 'fixed_monthly'
    salary_lines?: BaseSalaryLine[]
    worker_id: string
    worker_name: string
    period_start: string
    period_end: string
    meters: number
    gross_pay: number
    pending_advance: number
    advance_recovery: number
    max_advance_recovery: number
    remaining_debt: number
    net_payout: number
    status: 'unsettled' | 'paid'
    payment_mode?: BasePayrollPaymentMode | null
    settlement_id: string | null
    paid_at: string | null
    note?: string | null
    is_resolved?: boolean
}

type NumericValue = number | string | null | undefined

function toDecimal(value: NumericValue) {
    try {
        const result = new Decimal(value ?? 0)
        return result.isFinite() ? result : new Decimal(0)
    } catch {
        return new Decimal(0)
    }
}

function toRoundedNumber(value: Decimal) {
    const result = Number(value.toFixed(2))
    return Number.isFinite(result) ? result : 0
}

export function toBaseNumber(value: NumericValue) {
    return toRoundedNumber(toDecimal(value))
}

function addOneDay(date: string) {
    const [year, month, day] = date.split('-').map(Number)
    if (![year, month, day].every(Number.isFinite)) return date
    return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
}

export function getBasePayrollPeriod(periodEnd: string): { start: string; end: string } {
    const [year, month] = periodEnd.split('-').map(Number)
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        throw new Error('Invalid payroll period date')
    }

    return {
        start: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`,
        end: periodEnd,
    }
}

export function calculateBaseJobSummary(
    job: Pick<BaseProductionJob, 'id' | 'target_meters' | 'planned_cost_per_meter' | 'planned_price_per_meter'>,
    entries: Pick<BaseProductionEntry, 'job_id' | 'meters'>[],
    allocations: Pick<BaseProductionAllocation, 'job_id' | 'meters'>[] = [],
): BaseJobSummary {
    const produced = entries
        .filter((entry) => entry.job_id === job.id)
        .reduce((total, entry) => total.plus(toDecimal(entry.meters)), new Decimal(0))
        .plus(
            allocations
                .filter((allocation) => allocation.job_id === job.id)
                .reduce((total, allocation) => total.plus(toDecimal(allocation.meters)), new Decimal(0)),
        )
    const target = Decimal.max(0, toDecimal(job.target_meters))
    const remaining = Decimal.max(0, target.minus(produced))
    const excess = Decimal.max(0, produced.minus(target))
    const progress = target.gt(0)
        ? Decimal.min(100, produced.div(target).times(100))
        : new Decimal(0)

    return {
        produced_meters: toRoundedNumber(produced),
        remaining_meters: toRoundedNumber(remaining),
        excess_meters: toRoundedNumber(excess),
        progress_percent: toRoundedNumber(progress),
        planned_cost_total: toRoundedNumber(target.times(toDecimal(job.planned_cost_per_meter))),
        planned_value_total: toRoundedNumber(target.times(toDecimal(job.planned_price_per_meter))),
    }
}

export function reconcileBaseProductionJobStatuses<TJob extends Pick<BaseProductionJob, 'id' | 'status'>>(
    jobs: TJob[],
    entries: Pick<BaseProductionEntry, 'job_id' | 'meters'>[],
    allocations: Pick<BaseProductionAllocation, 'job_id' | 'meters'>[] = [],
): TJob[] {
    const startedJobIds = new Set<string>()
    for (const entry of entries) {
        if (entry.job_id && toDecimal(entry.meters).gt(0)) startedJobIds.add(entry.job_id)
    }
    for (const allocation of allocations) {
        if (allocation.job_id && toDecimal(allocation.meters).gt(0)) startedJobIds.add(allocation.job_id)
    }

    return jobs.map((job) => (
        job.status === 'planned' && startedJobIds.has(job.id)
            ? { ...job, status: 'active' }
            : job
    ))
}

function calculateBaseEntryGrossDecimal(
    entry: Pick<BaseProductionEntry, 'meters' | 'worker_rate_snapshot' | 'allocation_mode' | 'id' | 'piece_earning_state'>,
    allocations: Pick<BaseProductionAllocation, 'entry_id' | 'meters' | 'worker_rate_snapshot' | 'piece_earning_state'>[],
) {
    if (entry.piece_earning_state === 'inapplicable') return new Decimal(0)
    if (entry.allocation_mode === 'machine_breakdown') {
        return allocations
            .filter((allocation) => allocation.entry_id === entry.id && allocation.piece_earning_state !== 'inapplicable')
            .reduce(
                (total, allocation) => total.plus(toDecimal(allocation.meters).times(toDecimal(allocation.worker_rate_snapshot))),
                new Decimal(0),
            )
    }

    return toDecimal(entry.meters).times(toDecimal(entry.worker_rate_snapshot))
}

export function calculateBaseEntryGrossPay(
    entry: Pick<BaseProductionEntry, 'meters' | 'worker_rate_snapshot' | 'allocation_mode' | 'id' | 'piece_earning_state'>,
    allocations: Pick<BaseProductionAllocation, 'entry_id' | 'meters' | 'worker_rate_snapshot' | 'piece_earning_state'>[] = [],
) {
    return toRoundedNumber(calculateBaseEntryGrossDecimal(entry, allocations))
}

export function calculateBaseDailyProductionSummary(
    rows: BaseDailyProductionRow[],
): BaseDailyProductionSummary {
    const total = rows.reduce(
        (sum, row) => {
            const meters = toDecimal(row.meters)
            return sum.plus(row.status === 'entered' && meters.gt(0) ? meters : 0)
        },
        new Decimal(0),
    )

    return {
        total_meters: toRoundedNumber(total),
        entered_count: rows.filter((row) => row.status === 'entered').length,
        zero_count: rows.filter((row) => row.status === 'zero').length,
        absent_count: rows.filter((row) => row.status === 'absent').length,
        outstanding_count: rows.filter((row) => row.status === 'blank').length,
    }
}

function getWorkerPeriodStart(
    workerId: string,
    settlements: BasePayrollSettlement[],
    periodEnd: string,
    entries: BaseProductionEntry[],
    incentives: BaseWorkerIncentive[],
) {
    const monthStart = getBasePayrollPeriod(periodEnd).start
    const latestEnd = settlements
        .filter((settlement) => settlement.worker_id === workerId && settlement.period_end < periodEnd)
        .map((settlement) => settlement.period_end)
        .sort()
        .at(-1)

    if (latestEnd) return addOneDay(latestEnd)
    // A first payment can happen months after the work. Never drop unpaid
    // production merely because the owner did not settle before month end.
    const firstProduction = entries
        .filter((entry) => entry.worker_id === workerId && entry.production_date <= periodEnd && entry.meters > 0)
        .map((entry) => entry.production_date)
        .sort()[0]
    const firstIncentive = incentives.filter(item => item.worker_id === workerId && item.status !== 'voided'
        && !item.settlement_id && item.service_start <= periodEnd).map(item => item.service_start).sort()[0]
    return [monthStart, firstProduction, firstIncentive].filter((date): date is string => Boolean(date)).sort()[0]
}

export function calculateBaseWorkerPayables({
    workers,
    entries,
    allocations = [],
    incentives = [],
    advances,
    settlements,
    periodEnd,
}: {
    workers: BaseProductionWorker[]
    entries: BaseProductionEntry[]
    allocations?: BaseProductionAllocation[]
    incentives?: BaseWorkerIncentive[]
    advances: BaseWorkerAdvance[]
    settlements: BasePayrollSettlement[]
    periodEnd: string
}): BaseWorkerPayable[] {
    const activeSettlements = settlements.filter(settlement => settlement.status !== 'reversed')
    const allocationsByEntry = new Map<string, BaseProductionAllocation[]>()
    for (const allocation of allocations) {
        const current = allocationsByEntry.get(allocation.entry_id) ?? []
        current.push(allocation)
        allocationsByEntry.set(allocation.entry_id, current)
    }

    return workers.map((worker) => {
        const lastPaid = activeSettlements.filter(item => item.worker_id === worker.id && item.period_end < periodEnd).sort((a, b) => b.period_end.localeCompare(a.period_end))[0]
        const periodStart = worker.pay_type === 'fixed_monthly'
            ? lastPaid ? new Date(new Date(`${lastPaid.period_end}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10) : worker.start_date ?? periodEnd
            : getWorkerPeriodStart(worker.id, activeSettlements, periodEnd, entries, incentives)
        const salaryLines = calculateBaseSalaryLines(worker, periodStart, periodEnd)
        const periodEntries = entries.filter((entry) => (
            entry.worker_id === worker.id
            && entry.production_date >= periodStart
            && entry.production_date <= periodEnd
        ))
        const baseGross = worker.pay_type === 'fixed_monthly' ? salaryLines.reduce((total, line) => total.plus(line.grossPay), new Decimal(0)) : periodEntries.reduce(
            (total, entry) => total.plus(
                entry.allocation_mode === 'machine_breakdown'
                    ? calculateBaseEntryGrossDecimal(entry, allocationsByEntry.get(entry.id) ?? [])
                    : toDecimal(entry.meters).times(toDecimal(entry.worker_rate_snapshot ?? worker.rate_per_meter)),
            ),
            new Decimal(0),
        )
        const paidForEnd = activeSettlements.find(item => item.worker_id === worker.id && item.period_end === periodEnd)
        const incentiveStart = paidForEnd?.period_start ?? periodStart
        const openIncentives = incentives.filter(item => item.worker_id === worker.id && item.status !== 'voided'
            && (paidForEnd ? item.settlement_id === paidForEnd.id : !item.settlement_id) && item.service_start <= periodEnd)
        const incentiveLines = openIncentives.filter(item => item.status === 'approved'
            && item.service_start >= incentiveStart && item.service_end <= periodEnd
            && Number.isFinite(item.amount) && item.amount > 0 && item.approved_by && item.approved_at)
        const incentiveReviewIds = paidForEnd ? [] : openIncentives.filter(item => !incentiveLines.includes(item)).map(item => item.id)
        const incentiveGross = incentiveLines.reduce((sum, item) => sum.plus(item.amount), new Decimal(0))
        const gross = baseGross.plus(incentiveGross)
        const pendingAdvance = advances
            .filter((advance) => (
                advance.worker_id === worker.id
                && advance.status === 'pending'
            ))
            .reduce(
                (total, advance) => total.plus(Decimal.max(0, toDecimal(advance.amount).minus(toDecimal(advance.recovered_amount)))),
                new Decimal(0),
            )
        const settlement = activeSettlements
            .filter((candidate) => candidate.worker_id === worker.id && candidate.period_end === periodEnd)
            .sort((a, b) => b.paid_at.localeCompare(a.paid_at))
            .at(0)
        const recovery = calculateAdvanceRecovery(
            gross.toFixed(2),
            pendingAdvance.toFixed(2),
            BASE_PAYROLL_DEDUCTION_PERCENT,
        )
        const paidSettlement = settlement ?? null
        const isPaid = paidSettlement !== null
        const grossPay = paidSettlement ? toBaseNumber(paidSettlement.gross_pay) : toRoundedNumber(gross)
        const advanceRecovery = paidSettlement ? toBaseNumber(paidSettlement.advance_deducted) : Number(recovery.recommendedRecovery)
        const netPayout = paidSettlement ? toBaseNumber(paidSettlement.net_payout) : toRoundedNumber(Decimal.max(0, gross.minus(advanceRecovery)))

        return {
            base_pay: paidSettlement ? toBaseNumber(paidSettlement.gross_pay - (paidSettlement.incentive_pay ?? 0)) : toRoundedNumber(baseGross),
            incentive_pay: paidSettlement ? toBaseNumber(paidSettlement.incentive_pay) : toRoundedNumber(incentiveGross),
            incentive_lines: incentiveLines,
            incentive_review_ids: incentiveReviewIds,
            pay_type: worker.pay_type ?? 'piece_rate',
            salary_lines: salaryLines,
            worker_id: worker.id,
            worker_name: worker.name,
            period_start: paidSettlement?.period_start ?? periodStart,
            period_end: periodEnd,
            meters: toRoundedNumber(
                periodEntries.reduce((total, entry) => total.plus(toDecimal(entry.meters)), new Decimal(0)),
            ),
            gross_pay: grossPay,
            pending_advance: toRoundedNumber(pendingAdvance),
            advance_recovery: advanceRecovery,
            max_advance_recovery: Number(recovery.maxDeduction),
            remaining_debt: isPaid ? toRoundedNumber(pendingAdvance) : toBaseNumber(recovery.remainingDebt),
            net_payout: netPayout,
            status: isPaid ? 'paid' : 'unsettled',
            payment_mode: paidSettlement?.payment_mode ?? null,
            settlement_id: paidSettlement?.id ?? null,
            paid_at: paidSettlement?.paid_at ?? null,
            note: paidSettlement?.note ?? null,
        }
    })
}

export type BaseWorkerMachineBreakdownRow = {
    machine_label: string
    rate_per_meter: number
    meters: number
    pay: number
}

export type BaseWorkerMachineBreakdown = {
    rows: BaseWorkerMachineBreakdownRow[]
    meters: number
    pay: number
}

/**
 * One worker's production in a pay period, grouped by machine and by the weaver rate
 * snapshotted on each allocation. Follows the same rules as calculateBaseWorkerPayables
 * so the pay total matches that worker's base pay.
 */
export function calculateBaseWorkerMachineBreakdown({
    workerId,
    fallbackRate,
    periodStart,
    periodEnd,
    entries,
    allocations = [],
}: {
    workerId: string
    fallbackRate: number
    periodStart: string
    periodEnd: string
    entries: BaseProductionEntry[]
    allocations?: BaseProductionAllocation[]
}): BaseWorkerMachineBreakdown {
    const allocationsByEntry = new Map<string, BaseProductionAllocation[]>()
    for (const allocation of allocations) {
        const current = allocationsByEntry.get(allocation.entry_id) ?? []
        current.push(allocation)
        allocationsByEntry.set(allocation.entry_id, current)
    }

    const groups = new Map<string, { machine_label: string; rate: Decimal; meters: Decimal; pay: Decimal }>()
    const addLine = (machineLabel: string, rate: Decimal, meters: Decimal, pay: Decimal) => {
        const key = `${machineLabel}|${rate.toFixed(4)}`
        const current = groups.get(key) ?? { machine_label: machineLabel, rate, meters: new Decimal(0), pay: new Decimal(0) }
        groups.set(key, { ...current, meters: current.meters.plus(meters), pay: current.pay.plus(pay) })
    }

    const periodEntries = entries.filter((entry) => (
        entry.worker_id === workerId
        && entry.production_date >= periodStart
        && entry.production_date <= periodEnd
    ))
    for (const entry of periodEntries) {
        if (entry.allocation_mode === 'machine_breakdown') {
            if (entry.piece_earning_state === 'inapplicable') continue
            for (const allocation of allocationsByEntry.get(entry.id) ?? []) {
                if (allocation.piece_earning_state === 'inapplicable') continue
                const meters = toDecimal(allocation.meters)
                const rate = toDecimal(allocation.worker_rate_snapshot)
                addLine(allocation.machine_label || 'Machine', rate, meters, meters.times(rate))
            }
        } else {
            // Legacy worker totals were never tied to a machine.
            const meters = toDecimal(entry.meters)
            const rate = toDecimal(entry.worker_rate_snapshot ?? fallbackRate)
            addLine('', rate, meters, meters.times(rate))
        }
    }

    // Machines in number order (Loom 2 before Loom 10); legacy worker totals last; lines with
    // no metres and no pay say nothing, so they are left out.
    const rows = [...groups.values()]
        .filter((group) => !group.meters.isZero() || !group.pay.isZero())
        .sort((a, b) => Number(!a.machine_label) - Number(!b.machine_label)
            || a.machine_label.localeCompare(b.machine_label, undefined, { numeric: true, sensitivity: 'base' })
            || a.rate.comparedTo(b.rate))
        .map((group) => ({
            machine_label: group.machine_label,
            rate_per_meter: toRoundedNumber(group.rate),
            meters: toRoundedNumber(group.meters),
            pay: toRoundedNumber(group.pay),
        }))
    const totals = [...groups.values()].reduce(
        (sum, group) => ({ meters: sum.meters.plus(group.meters), pay: sum.pay.plus(group.pay) }),
        { meters: new Decimal(0), pay: new Decimal(0) },
    )

    return { rows, meters: toRoundedNumber(totals.meters), pay: toRoundedNumber(totals.pay) }
}

export function getMonthPayrollBounds(dateOrMonth: string): { start: string; end: string; monthKey: string; label: string } {
    const parts = dateOrMonth.slice(0, 7).split('-').map(Number)
    const year = parts[0]
    const month = parts[1]
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        throw new Error('Invalid month key or date')
    }
    const start = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const end = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const monthKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
    const label = new Intl.DateTimeFormat('en-IN', {
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
    }).format(new Date(Date.UTC(year, month - 1, 1)))

    return { start, end, monthKey, label }
}

export function getAdjacentMonthKey(monthKey: string, offset: number): string {
    const [year, month] = monthKey.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1 + offset, 1))
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function calculateBasePayrollPeriodSummary({
    payables,
    periodRecord = null,
    resolvedWorkerIds = [],
}: {
    payables: BaseWorkerPayable[]
    periodRecord?: BasePayrollPeriod | null
    resolvedWorkerIds?: string[]
}): BasePayrollPeriodSummary {
    const isSettled = periodRecord?.status === 'settled'

    if (isSettled && periodRecord) {
        const net = toBaseNumber(periodRecord.total_net)
        return {
            status: 'settled',
            totalGross: toBaseNumber(periodRecord.total_gross),
            totalRecovery: toBaseNumber(periodRecord.total_recovery),
            totalNet: net,
            totalWorkers: periodRecord.total_workers,
            paidWorkers: periodRecord.paid_workers,
            outstandingWorkers: 0,
            resolvedWorkers: 0,
            paidAmount: net,
            remainingAmount: 0,
            totalPaid: net,
            totalRemaining: 0,
            progressPercent: 100,
            isReadyToComplete: false,
            isSettled: true,
            settledAt: periodRecord.settled_at ?? null,
        }
    }

    const allResolved = new Set([
        ...(periodRecord?.resolved_worker_ids ?? []),
        ...resolvedWorkerIds,
    ])

    let totalGross = new Decimal(0)
    let totalRecovery = new Decimal(0)
    let totalNet = new Decimal(0)
    let paidAmount = new Decimal(0)
    let paidCount = 0
    let resolvedCount = 0

    for (const payable of payables) {
        totalGross = totalGross.plus(toDecimal(payable.gross_pay))
        totalRecovery = totalRecovery.plus(toDecimal(payable.advance_recovery))
        totalNet = totalNet.plus(toDecimal(payable.net_payout))

        if (payable.status === 'paid') {
            paidAmount = paidAmount.plus(toDecimal(payable.net_payout))
            paidCount += 1
        } else if (payable.gross_pay === 0 && !payable.incentive_review_ids?.length && allResolved.has(payable.worker_id)) {
            resolvedCount += 1
        }
    }

    const totalWorkers = payables.length
    const remainingWorkers = totalWorkers - paidCount - resolvedCount
    const outstandingWorkers = Math.max(0, remainingWorkers)
    const remainingAmount = Decimal.max(0, totalNet.minus(paidAmount))

    let status: BasePayrollPeriodStatus = 'open'
    if (totalWorkers > 0 && outstandingWorkers === 0) {
        status = 'ready_to_complete'
    } else if (paidCount > 0) {
        status = 'in_progress'
    }

    const progressPercent = totalWorkers > 0
        ? Math.min(100, Math.round(((paidCount + resolvedCount) / totalWorkers) * 100))
        : 0

    const roundedPaid = toRoundedNumber(paidAmount)
    const roundedRemaining = toRoundedNumber(remainingAmount)

    return {
        status,
        totalGross: toRoundedNumber(totalGross),
        totalRecovery: toRoundedNumber(totalRecovery),
        totalNet: toRoundedNumber(totalNet),
        totalWorkers,
        paidWorkers: paidCount,
        outstandingWorkers,
        resolvedWorkers: resolvedCount,
        paidAmount: roundedPaid,
        remainingAmount: roundedRemaining,
        totalPaid: roundedPaid,
        totalRemaining: roundedRemaining,
        progressPercent,
        isReadyToComplete: status === 'ready_to_complete',
        isSettled: false,
        settledAt: null,
    }
}

