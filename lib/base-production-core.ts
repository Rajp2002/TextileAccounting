import Decimal from 'decimal.js'

import { calculateAdvanceRecovery } from './finance'

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
    id: string
    production_date: string
    shift: BaseProductionShift
    status: 'draft' | 'saved' | 'finalized'
    client_request_id: string
    created_at: string
    updated_at: string
}

export type BaseProductionWorker = {
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

export type BasePayrollSettlement = {
    id: string
    worker_id: string
    period_start: string
    period_end: string
    gross_pay: number
    advance_deducted: number
    net_payout: number
    payment_mode: BasePayrollPaymentMode
    paid_at: string
    worker_name_snapshot?: string
    advance_balance_before?: number
    remaining_advance_balance?: number
}

export type BasePayrollSettlementLine = {
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
    source_kind: 'legacy_entry' | 'worker_total' | 'machine_allocation'
}

export type BaseJobSummary = {
    produced_meters: number
    remaining_meters: number
    progress_percent: number
    planned_cost_total: number
    planned_value_total: number
}

export type BaseWorkerPayable = {
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
    settlement_id: string | null
    paid_at: string | null
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
    const progress = target.gt(0)
        ? Decimal.min(100, produced.div(target).times(100))
        : new Decimal(0)

    return {
        produced_meters: toRoundedNumber(produced),
        remaining_meters: toRoundedNumber(remaining),
        progress_percent: toRoundedNumber(progress),
        planned_cost_total: toRoundedNumber(target.times(toDecimal(job.planned_cost_per_meter))),
        planned_value_total: toRoundedNumber(target.times(toDecimal(job.planned_price_per_meter))),
    }
}

function calculateBaseEntryGrossDecimal(
    entry: Pick<BaseProductionEntry, 'meters' | 'worker_rate_snapshot' | 'allocation_mode' | 'id'>,
    allocations: Pick<BaseProductionAllocation, 'entry_id' | 'meters' | 'worker_rate_snapshot'>[],
) {
    if (entry.allocation_mode === 'machine_breakdown') {
        return allocations
            .filter((allocation) => allocation.entry_id === entry.id)
            .reduce(
                (total, allocation) => total.plus(toDecimal(allocation.meters).times(toDecimal(allocation.worker_rate_snapshot))),
                new Decimal(0),
            )
    }

    return toDecimal(entry.meters).times(toDecimal(entry.worker_rate_snapshot))
}

export function calculateBaseEntryGrossPay(
    entry: Pick<BaseProductionEntry, 'meters' | 'worker_rate_snapshot' | 'allocation_mode' | 'id'>,
    allocations: Pick<BaseProductionAllocation, 'entry_id' | 'meters' | 'worker_rate_snapshot'>[] = [],
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
) {
    const monthStart = getBasePayrollPeriod(periodEnd).start
    const latestEnd = settlements
        .filter((settlement) => settlement.worker_id === workerId && settlement.period_end < periodEnd)
        .map((settlement) => settlement.period_end)
        .sort()
        .at(-1)

    if (!latestEnd) return monthStart
    const nextPeriodStart = addOneDay(latestEnd)
    return nextPeriodStart > monthStart ? nextPeriodStart : monthStart
}

export function calculateBaseWorkerPayables({
    workers,
    entries,
    allocations = [],
    advances,
    settlements,
    periodEnd,
}: {
    workers: BaseProductionWorker[]
    entries: BaseProductionEntry[]
    allocations?: BaseProductionAllocation[]
    advances: BaseWorkerAdvance[]
    settlements: BasePayrollSettlement[]
    periodEnd: string
}): BaseWorkerPayable[] {
    const allocationsByEntry = new Map<string, BaseProductionAllocation[]>()
    for (const allocation of allocations) {
        const current = allocationsByEntry.get(allocation.entry_id) ?? []
        current.push(allocation)
        allocationsByEntry.set(allocation.entry_id, current)
    }

    return workers.map((worker) => {
        const periodStart = getWorkerPeriodStart(worker.id, settlements, periodEnd)
        const periodEntries = entries.filter((entry) => (
            entry.worker_id === worker.id
            && entry.production_date >= periodStart
            && entry.production_date <= periodEnd
        ))
        const gross = periodEntries.reduce(
            (total, entry) => total.plus(
                entry.allocation_mode === 'machine_breakdown'
                    ? calculateBaseEntryGrossDecimal(entry, allocationsByEntry.get(entry.id) ?? [])
                    : toDecimal(entry.meters).times(toDecimal(entry.worker_rate_snapshot ?? worker.rate_per_meter)),
            ),
            new Decimal(0),
        )
        const pendingAdvance = advances
            .filter((advance) => (
                advance.worker_id === worker.id
                && advance.status === 'pending'
            ))
            .reduce(
                (total, advance) => total.plus(Decimal.max(0, toDecimal(advance.amount).minus(toDecimal(advance.recovered_amount)))),
                new Decimal(0),
            )
        const settlement = settlements
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
            settlement_id: paidSettlement?.id ?? null,
            paid_at: paidSettlement?.paid_at ?? null,
        }
    })
}
