import type {
    BasePayrollPaymentMode,
    BasePayrollSettlement,
    BasePayrollSettlementLine,
} from './base-production-core'

export type BasePayrollHistoryEarning = {
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
    workers: BasePayrollHistoryWorker[]
    machines: BasePayrollHistoryMachine[]
    totalMeters: number
    totalGrossPay: number
    totalAdvanceRecovered: number
    totalNetPayout: number
    paymentModes: BasePayrollPaymentMode[]
    latestPaidAt: string
}

function round(value: number) {
    return Number(value.toFixed(2))
}

export function buildBasePayrollHistory(
    settlements: BasePayrollSettlement[],
    lines: BasePayrollSettlementLine[],
): BasePayrollHistoryPeriod[] {
    const linesBySettlement = new Map<string, BasePayrollSettlementLine[]>()
    for (const line of lines) {
        const current = linesBySettlement.get(line.settlement_id) ?? []
        current.push(line)
        linesBySettlement.set(line.settlement_id, current)
    }

    const settlementsByPeriod = new Map<string, BasePayrollSettlement[]>()
    for (const settlement of settlements) {
        const key = `${settlement.period_start}:${settlement.period_end}`
        const current = settlementsByPeriod.get(key) ?? []
        current.push(settlement)
        settlementsByPeriod.set(key, current)
    }

    return [...settlementsByPeriod.entries()].map(([key, periodSettlements]) => {
        const workers: BasePayrollHistoryWorker[] = periodSettlements.map((settlement) => {
            const earningGroups = new Map<string, BasePayrollHistoryEarning>()

            for (const line of linesBySettlement.get(settlement.id) ?? []) {
                const earningKey = `${line.machine_id ?? line.machine_label}:${line.costing_label}:${line.worker_rate_snapshot}`
                const current = earningGroups.get(earningKey) ?? {
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
        }).sort((a, b) => a.workerName.localeCompare(b.workerName))

        const machineGroups = new Map<string, BasePayrollHistoryMachine>()
        for (const worker of workers.filter(worker => worker.status !== 'reversed')) {
            for (const earning of worker.earnings) {
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

        const start = periodSettlements[0]?.period_start ?? ''
        const end = periodSettlements[0]?.period_end ?? ''
        return {
            key,
            start,
            end,
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
        'Period Start', 'Period End', 'Worker', 'Machine', 'Costing', 'Weaver Rate per Metre',
        'Metres', 'Line Gross Pay', 'Worker Gross Pay', 'Advance Balance Before',
        'Advance Recovered', 'Remaining Advance Balance', 'Worker Net Pay', 'Payment Mode', 'Paid At', 'Record Status', 'Reversal Reason',
    ]
    const rows: Array<Array<string | number>> = []

    for (const worker of period.workers) {
        const earnings = worker.earnings.length > 0 ? worker.earnings : [{
            machineLabel: '', costingLabel: '', rate: 0, meters: 0, grossPay: 0,
        }]
        for (const earning of earnings) {
            rows.push([
                period.start, period.end, worker.workerName, earning.machineLabel, earning.costingLabel,
                earning.rate, earning.meters, earning.grossPay, worker.grossPay,
                worker.advanceBalanceBefore, worker.advanceRecovered, worker.remainingAdvanceBalance,
                worker.netPayout, worker.paymentMode, worker.paidAt, worker.status ?? 'paid', worker.reversalReason ?? '',
            ])
        }
    }

    return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
}
