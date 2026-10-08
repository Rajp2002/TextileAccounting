import type {
    BaseIncentiveSnapshot,
    BasePayrollPaymentMode,
    BasePayrollPeriod,
    BasePayrollPeriodStatus,
    BasePayrollSettlement,
    BasePayrollSettlementLine,
} from './base-production-core'
import { DEFAULT_MONTHLY_CYCLE_RULE, getPeriodContaining, type PayrollCycleRule } from './payroll-cycle-engine'

export type BasePayrollHistoryEarning = {
    kind?: 'manual_incentive'
    incentiveSnapshot?: BaseIncentiveSnapshot | null
    payType?: 'piece_rate' | 'fixed_monthly'
    machineId: string | null
    machineLabel: string
    costingLabel: string
    rate: number
    meters: number
    grossPay: number
    productionDates: string[]
}

export type BasePayrollHistoryWorker = {
    status?: 'paid' | 'reversed'
    reversalReason?: string | null
    settlementId: string
    workerId: string
    workerName: string
    /** The dates this one payment covers; they can start in an earlier period. */
    coverStart?: string
    coverEnd?: string
    grossPay: number
    advanceBalanceBefore: number
    advanceRecovered: number
    remainingAdvanceBalance: number
    netPayout: number
    paymentMode: BasePayrollPaymentMode
    paidAt: string
    meters: number
    earnings: BasePayrollHistoryEarning[]
}

export type BasePayrollHistoryMachine = {
    machineId: string | null
    machineLabel: string
    meters: number
    grossPay: number
    workerCount: number
    costingCount: number
    workers: Array<{
        workerId: string
        workerName: string
        costingLabel: string
        rate: number
        meters: number
        grossPay: number
    }>
}

export type BasePayrollHistoryPeriod = {
    key: string
    start: string
    end: string
    status?: BasePayrollPeriodStatus | 'draft' | 'partial'
    isSettled?: boolean
    settledAt?: string | null
    workers: BasePayrollHistoryWorker[]
    machines: BasePayrollHistoryMachine[]
    totalMeters: number
    totalGrossPay: number
    totalAdvanceRecovered: number
    totalNetPayout: number
    paymentModes: BasePayrollPaymentMode[]
    latestPaidAt: string
    periodRecord?: BasePayrollPeriod | null
}

function round(value: number) {
    return Number(value.toFixed(2))
}

export function buildBasePayrollHistory(
    settlements: BasePayrollSettlement[],
    lines: BasePayrollSettlementLine[],
    periodRecords: BasePayrollPeriod[] = [],
    cycleRule: PayrollCycleRule = DEFAULT_MONTHLY_CYCLE_RULE,
): BasePayrollHistoryPeriod[] {
    const linesBySettlement = new Map<string, BasePayrollSettlementLine[]>()
    for (const line of lines) {
        const current = linesBySettlement.get(line.settlement_id) ?? []
        current.push(line)
        linesBySettlement.set(line.settlement_id, current)
    }

    const periodRecordByKey = new Map<string, BasePayrollPeriod>()
    for (const record of periodRecords) {
        periodRecordByKey.set(`${record.period_start}:${record.period_end}`, record)
    }

    // A payment belongs to the pay period its covered dates end in. A completed
    // period keeps its stored dates even if the cycle rule changed afterwards.
    function periodKeyFor(date: string) {
        const record = periodRecords.find(item => item.period_start <= date && date <= item.period_end)
        if (record) return `${record.period_start}:${record.period_end}`
        const period = getPeriodContaining(date, cycleRule)
        return `${period.start}:${period.end}`
    }

    // Completed periods appear even when every worker in them earned nothing.
    const settlementsByPeriod = new Map<string, BasePayrollSettlement[]>(
        [...periodRecordByKey.keys()].map(key => [key, []]),
    )
    for (const settlement of settlements) {
        const key = periodKeyFor(settlement.period_end)
        const current = settlementsByPeriod.get(key) ?? []
        current.push(settlement)
        settlementsByPeriod.set(key, current)
    }

    return [...settlementsByPeriod.entries()].map(([key, periodSettlements]) => {
        const workers: BasePayrollHistoryWorker[] = periodSettlements.map((settlement) => {
            const earningGroups = new Map<string, BasePayrollHistoryEarning>()

            for (const line of linesBySettlement.get(settlement.id) ?? []) {
                const earningKey = line.source_kind === 'manual_incentive' ? `incentive:${line.source_id ?? line.id}` : `${line.machine_id ?? line.machine_label}:${line.costing_label}:${line.worker_rate_snapshot}`
                const current: BasePayrollHistoryEarning = earningGroups.get(earningKey) ?? {
                    kind: line.source_kind === 'manual_incentive' ? 'manual_incentive' : undefined,
                    incentiveSnapshot: line.earning_snapshot,
                    payType: line.source_kind === 'fixed_salary' ? 'fixed_monthly' as const : 'piece_rate' as const,
                    machineId: line.machine_id,
                    machineLabel: line.machine_label,
                    costingLabel: line.costing_label,
                    rate: line.worker_rate_snapshot,
                    meters: 0,
                    grossPay: 0,
                    productionDates: [],
                }
                current.meters = round(current.meters + line.meters)
                current.grossPay = round(current.grossPay + line.gross_pay)
                if (!current.productionDates.includes(line.production_date)) {
                    current.productionDates.push(line.production_date)
                }
                earningGroups.set(earningKey, current)
            }

            const earnings = [...earningGroups.values()]
                .map((earning) => ({ ...earning, productionDates: earning.productionDates.sort() }))
                .sort((a, b) => a.machineLabel.localeCompare(b.machineLabel) || a.costingLabel.localeCompare(b.costingLabel))

            return {
                settlementId: settlement.id,
                status: settlement.status ?? 'paid',
                reversalReason: settlement.reversal_reason,
                workerId: settlement.worker_id,
                workerName: settlement.worker_name_snapshot ?? 'Worker',
                coverStart: settlement.period_start,
                coverEnd: settlement.period_end,
                grossPay: settlement.gross_pay,
                advanceBalanceBefore: settlement.advance_balance_before ?? settlement.advance_deducted,
                advanceRecovered: settlement.advance_deducted,
                remainingAdvanceBalance: settlement.remaining_advance_balance ?? 0,
                netPayout: settlement.net_payout,
                paymentMode: settlement.payment_mode,
                paidAt: settlement.paid_at,
                meters: round(earnings.reduce((sum, earning) => sum + earning.meters, 0)),
                earnings,
            }
        }).sort((a, b) => a.workerName.localeCompare(b.workerName) || a.paidAt.localeCompare(b.paidAt))

        const machineGroups = new Map<string, BasePayrollHistoryMachine>()
        for (const worker of workers.filter(worker => worker.status !== 'reversed')) {
            for (const earning of worker.earnings) {
                if (earning.payType === 'fixed_monthly' || earning.kind === 'manual_incentive') continue
                const machineKey = earning.machineId ?? earning.machineLabel
                const current = machineGroups.get(machineKey) ?? {
                    machineId: earning.machineId,
                    machineLabel: earning.machineLabel,
                    meters: 0,
                    grossPay: 0,
                    workerCount: 0,
                    costingCount: 0,
                    workers: [],
                }
                current.meters = round(current.meters + earning.meters)
                current.grossPay = round(current.grossPay + earning.grossPay)
                current.workers.push({
                    workerId: worker.workerId,
                    workerName: worker.workerName,
                    costingLabel: earning.costingLabel,
                    rate: earning.rate,
                    meters: earning.meters,
                    grossPay: earning.grossPay,
                })
                current.workerCount = new Set(current.workers.map((item) => item.workerId)).size
                current.costingCount = new Set(current.workers.map((item) => item.costingLabel)).size
                machineGroups.set(machineKey, current)
            }
        }

        const [start, end] = key.split(':')
        const periodRecord = periodRecordByKey.get(key) ?? null

        return {
            key,
            start,
            end,
            status: periodRecord?.status ?? (workers.length > 0 ? 'in_progress' : 'open'),
            isSettled: periodRecord?.status === 'settled',
            settledAt: periodRecord?.settled_at ?? null,
            periodRecord,
            workers,
            machines: [...machineGroups.values()].sort((a, b) => a.machineLabel.localeCompare(b.machineLabel)),
            totalMeters: round(workers.filter(worker => worker.status !== 'reversed').reduce((sum, worker) => sum + worker.meters, 0)),
            totalGrossPay: round(workers.filter(worker => worker.status !== 'reversed').reduce((sum, worker) => sum + worker.grossPay, 0)),
            totalAdvanceRecovered: round(workers.filter(worker => worker.status !== 'reversed').reduce((sum, worker) => sum + worker.advanceRecovered, 0)),
            totalNetPayout: round(workers.filter(worker => worker.status !== 'reversed').reduce((sum, worker) => sum + worker.netPayout, 0)),
            paymentModes: [...new Set(workers.filter(worker => worker.status !== 'reversed').map((worker) => worker.paymentMode))],
            latestPaidAt: workers.map((worker) => worker.paidAt).sort().at(-1) ?? '',
        }
    }).sort((a, b) => b.end.localeCompare(a.end) || b.start.localeCompare(a.start))
}

function csvCell(value: string | number) {
    // Prevent spreadsheet formulas in owner-entered names and reversal reasons.
    const text = typeof value === 'string' && /^[\s]*[=+@-]/.test(value) ? `'${value}` : String(value)
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function buildBasePayrollHistoryCsv(period: BasePayrollHistoryPeriod) {
    const headers = [
        'Period Start', 'Period End', 'Worker', 'Machine / Pay Basis', 'Costing / Salary Period', 'Rate',
        'Metres', 'Line Gross Pay', 'Worker Gross Pay', 'Advance Balance Before',
        'Advance Recovered', 'Remaining Advance Balance', 'Worker Net Pay', 'Payment Mode', 'Paid At', 'Record Status', 'Reversal Reason', 'Rate Unit',
        'Incentive Service Start', 'Incentive Service End', 'Evidence Reference', 'Approved By', 'Approved At', 'Calculation Version',
        'Work Covered From', 'Work Covered To',
    ]
    const rows: Array<Array<string | number>> = []

    for (const worker of period.workers) {
        const earnings: BasePayrollHistoryEarning[] = worker.earnings.length > 0 ? worker.earnings : [{
            payType: 'piece_rate' as const,
            machineId: null, productionDates: [], machineLabel: '', costingLabel: '', rate: 0, meters: 0, grossPay: 0,
        }]
        for (const earning of earnings) {
            rows.push([
                period.start, period.end, worker.workerName, earning.machineLabel, earning.costingLabel,
                earning.rate, earning.meters, earning.grossPay, worker.grossPay,
                worker.advanceBalanceBefore, worker.advanceRecovered, worker.remainingAdvanceBalance,
                worker.netPayout, worker.paymentMode, worker.paidAt, worker.status ?? 'paid', worker.reversalReason ?? '',
                earning.kind === 'manual_incentive' ? 'amount' : earning.payType === 'fixed_monthly' ? 'per month' : 'per metre',
                earning.incentiveSnapshot?.service_start ?? '', earning.incentiveSnapshot?.service_end ?? '',
                earning.incentiveSnapshot?.evidence_reference ?? '', earning.incentiveSnapshot?.approved_by ?? '',
                earning.incentiveSnapshot?.approved_at ?? '', earning.incentiveSnapshot?.calculation_version ?? '',
                worker.coverStart ?? period.start, worker.coverEnd ?? period.end,
            ])
        }
    }

    return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
}
