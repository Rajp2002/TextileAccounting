import { getPayrollCycleBounds } from '@/lib/payroll-cycle'
import {
    calculateFixedMachineOperatorGross,
    calculateMeterOperatorGross,
    type FixedMachineOperatorLine,
    type OperatorAssignmentPayrollInput,
    type OperatorPayMode,
    type OperatorProductionLogInput,
    type OperatorWorkerType,
} from '@/lib/machine-operator-payroll'

export type PaymentMode = 'cash' | 'bank_transfer' | 'upi' | 'cheque'

export interface SettlementRecord {
    id?: number
    gross_pay: number
    advance_deducted: number
    net_payout: number
    carried_forward_debt: number
    compliance_flag: boolean
    is_final_settlement: boolean
    settled_at?: string
    status: 'paid' | 'pending'
    itemization_payload?: unknown
    payment_mode?: PaymentMode | null
}

interface WorkerBase {
    id: number
    name: string
    whatsapp_number?: string | null
    totalAdvances: number
    pf_esi_enrolled?: boolean
    pf_esi_eligible?: boolean
    settlement?: SettlementRecord
}

export interface MeterWorkerPayroll extends WorkerBase {
    machines: { machineName: string; orderLabel?: string; meters: number; rate: number; pay: number }[]
    totalMeters: number
    totalPay: number
}

export interface FixedWorkerPayroll extends WorkerBase {
    role: string
    monthly_salary: number
    daysWorked?: number
    earnedPay: number
    isMachineOperator?: boolean
    machineOperatorLines?: FixedMachineOperatorLine[]
    usedProductionDateProxy?: boolean
}

export type PayrollWorker = MeterWorkerPayroll | FixedWorkerPayroll

export type ProductionLogRow = {
    worker_id: number | null
    meter_worker_id?: number | null
    fixed_worker_id?: number | null
    operator_assignment_id?: string | null
    operator_worker_type?: OperatorWorkerType | null
    operator_pay_mode_snapshot?: OperatorPayMode | null
    operator_rate_snapshot?: number | string | null
    machine_id: string | number | null
    meters: number | string | null
    worker_rate_snapshot: number | string | null
    order_id: string | number | null
    date: string
    shift?: 'day' | 'night' | null
}

export type MeterWorkerDbRow = {
    id: number
    name: string
    whatsapp_number: string | null
    is_active: boolean
    pf_esi_enrolled?: boolean | null
    pf_esi_eligible?: boolean | null
}

export type MachineRow = {
    id: string | number
    name: string
}

export type PayrollSettlementRow = SettlementRecord & {
    id: number
    worker_type?: 'meter' | 'fixed'
    month?: string
    meter_worker_id?: number | null
    fixed_worker_id?: number | null
}

export type WorkerAdvanceRow = {
    meter_worker_id?: number | null
    fixed_worker_id?: number | null
    amount: number | string | null
}

export type OrderRow = {
    id: string | number
    party_name: string | null
    quality_label: string | null
}

export type FixedWorkerDbRow = {
    id: number
    name: string
    whatsapp_number: string | null
    role: string
    monthly_salary: number | string | null
    start_date?: string | null
    pf_esi_enrolled?: boolean | null
    pf_esi_eligible?: boolean | null
}

export type AttendanceRow = {
    fixed_worker_id: number
    date?: string
    present?: boolean | null
}

export type MachineOperatorAssignmentRow = {
    id: string
    worker_type: OperatorWorkerType
    meter_worker_id?: number | null
    fixed_worker_id?: number | null
    pay_mode: OperatorPayMode
    rate: number | string | null
    effective_from?: string | null
    effective_to?: string | null
}

export function toPayrollNumber(value: unknown) {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
}

export function buildMeterWorkerPayroll({
    logs,
    workers,
    machines,
    settlements,
    advances,
    orders,
}: {
    logs: ProductionLogRow[]
    workers: MeterWorkerDbRow[]
    machines: MachineRow[]
    settlements: PayrollSettlementRow[]
    advances: WorkerAdvanceRow[]
    orders: OrderRow[]
}): MeterWorkerPayroll[] {
    const advanceMap: Record<number, number> = {}
    advances.forEach((advance) => {
        if (!advance.meter_worker_id) return
        advanceMap[advance.meter_worker_id] = (advanceMap[advance.meter_worker_id] || 0) + toPayrollNumber(advance.amount)
    })

    const machineMap = Object.fromEntries(machines.map((machine) => [String(machine.id), machine]))
    const settlementMap = Object.fromEntries(
        settlements
            .filter((settlement) => settlement.meter_worker_id)
            .map((settlement) => [settlement.meter_worker_id as number, settlement])
    )
    const orderLabelMap = Object.fromEntries(
        orders.map((order) => [
            String(order.id),
            order.quality_label ? `${order.party_name || 'Order'} · ${order.quality_label}` : order.party_name || 'Order',
        ])
    )
    const resolveMeterWorkerId = (log: ProductionLogRow) => (
        log.meter_worker_id ?? (!log.operator_assignment_id ? log.worker_id : null)
    )
    const workerIdsWithLogs = new Set(
        logs
            .map(resolveMeterWorkerId)
            .filter((id): id is number => typeof id === 'number')
    )

    const result: MeterWorkerPayroll[] = []
    for (const worker of workers) {
        if (!worker.is_active && !workerIdsWithLogs.has(worker.id)) continue

        const workerLogs = logs.filter((log) => resolveMeterWorkerId(log) === worker.id)
        if (workerLogs.length === 0 && !settlementMap[worker.id]) continue

        const machineGroups: Record<string, { meters: number; rate: number; name: string; orderLabel?: string }> = {}
        for (const log of workerLogs) {
            if ((log.operator_pay_mode_snapshot ?? 'per_meter') !== 'per_meter') continue
            const machine = log.machine_id ? machineMap[String(log.machine_id)] : null
            const rate = toPayrollNumber(log.operator_rate_snapshot ?? log.worker_rate_snapshot)
            const orderId = log.order_id || '__no_order__'
            const key = `${orderId}-${log.machine_id}-${rate}`

            if (!machineGroups[key]) {
                machineGroups[key] = {
                    meters: 0,
                    rate,
                    name: machine?.name || 'Unknown',
                    orderLabel: log.order_id ? orderLabelMap[String(log.order_id)] : undefined,
                }
            }
            machineGroups[key].meters += toPayrollNumber(log.meters)
        }

        const machineBreakdown = Object.values(machineGroups).map((group) => ({
            machineName: group.name,
            orderLabel: group.orderLabel,
            meters: group.meters,
            rate: group.rate,
            pay: group.meters * group.rate,
        }))
        const totalMeters = machineBreakdown.reduce((sum, item) => sum + item.meters, 0)
        const totalPay = calculateMeterOperatorGross(workerLogs.map((log): OperatorProductionLogInput => ({
            operatorAssignmentId: log.operator_assignment_id,
            operatorWorkerType: log.operator_worker_type,
            meterWorkerId: log.meter_worker_id,
            fixedWorkerId: log.fixed_worker_id,
            workerId: log.worker_id,
            productionDate: log.date,
            shift: log.shift ?? 'day',
            meters: log.meters,
            workerRateSnapshot: log.worker_rate_snapshot,
            operatorRateSnapshot: log.operator_rate_snapshot,
            operatorPayModeSnapshot: log.operator_pay_mode_snapshot,
        })), worker.id)

        result.push({
            id: worker.id,
            name: worker.name,
            whatsapp_number: worker.whatsapp_number ?? null,
            pf_esi_enrolled: worker.pf_esi_enrolled ?? undefined,
            pf_esi_eligible: worker.pf_esi_eligible ?? undefined,
            machines: machineBreakdown,
            totalMeters,
            totalPay,
            totalAdvances: advanceMap[worker.id] || 0,
            settlement: settlementMap[worker.id],
        })
    }

    return result.sort((a, b) => b.totalPay - a.totalPay)
}

export function buildFixedWorkerPayroll({
    workers,
    attendanceRows,
    settlements,
    advances,
    assignments,
    logs,
    month,
    cycleStartDay,
}: {
    workers: FixedWorkerDbRow[]
    attendanceRows: AttendanceRow[]
    settlements: PayrollSettlementRow[]
    advances: WorkerAdvanceRow[]
    assignments: MachineOperatorAssignmentRow[]
    logs: ProductionLogRow[]
    month: string
    cycleStartDay: number
}): FixedWorkerPayroll[] {
    const { cycle_start: monthStart, cycle_end: monthEnd } = getPayrollCycleBounds(month, cycleStartDay)
    const attendanceMap: Record<number, Set<string>> = {}
    attendanceRows.forEach((attendance) => {
        if (!attendance.date) return
        if (!attendanceMap[attendance.fixed_worker_id]) attendanceMap[attendance.fixed_worker_id] = new Set()
        attendanceMap[attendance.fixed_worker_id].add(attendance.date)
    })

    const settlementMap = Object.fromEntries(
        settlements
            .filter((settlement) => settlement.fixed_worker_id)
            .map((settlement) => [settlement.fixed_worker_id as number, settlement])
    )

    const advanceMap: Record<number, number> = {}
    advances.forEach((advance) => {
        if (!advance.fixed_worker_id) return
        advanceMap[advance.fixed_worker_id] = (advanceMap[advance.fixed_worker_id] || 0) + toPayrollNumber(advance.amount)
    })

    return workers
        .filter((worker) => !worker.start_date || worker.start_date <= monthEnd)
        .map((worker) => {
            const monthlySalary = toPayrollNumber(worker.monthly_salary)
            const workerAssignments = assignments.filter((assignment) => assignment.fixed_worker_id === worker.id)
            const workerLogs = logs.filter((log) => log.fixed_worker_id === worker.id)
            const machineOperatorGross = calculateFixedMachineOperatorGross({
                fixedWorker: {
                    id: worker.id,
                    role: worker.role,
                    monthlySalary,
                },
                assignments: workerAssignments.map((assignment): OperatorAssignmentPayrollInput => ({
                    id: assignment.id,
                    workerType: assignment.worker_type,
                    workerId: assignment.fixed_worker_id ?? worker.id,
                    payMode: assignment.pay_mode,
                    rate: assignment.rate,
                    effectiveFrom: assignment.effective_from,
                    effectiveTo: assignment.effective_to,
                })),
                productionLogs: workerLogs.map((log): OperatorProductionLogInput => ({
                    operatorAssignmentId: log.operator_assignment_id,
                    operatorWorkerType: log.operator_worker_type,
                    meterWorkerId: log.meter_worker_id,
                    fixedWorkerId: log.fixed_worker_id,
                    workerId: log.worker_id,
                    productionDate: log.date,
                    shift: log.shift ?? 'day',
                    meters: log.meters,
                    workerRateSnapshot: log.worker_rate_snapshot,
                    operatorRateSnapshot: log.operator_rate_snapshot,
                    operatorPayModeSnapshot: log.operator_pay_mode_snapshot,
                })),
                attendance: attendanceRows.map((attendance) => ({
                    fixedWorkerId: attendance.fixed_worker_id,
                    date: attendance.date ?? '',
                    present: attendance.present,
                })),
                cycleStart: monthStart,
                cycleEnd: monthEnd,
            })
            const isMachineOperator = workerAssignments.length > 0 || workerLogs.some((log) => !!log.operator_pay_mode_snapshot)
            const daysWorked = worker.role === 'daily' || workerAssignments.some((assignment) => assignment.pay_mode === 'fixed_daily')
                ? (attendanceMap[worker.id]?.size || 0)
                : undefined

            return {
                id: worker.id,
                name: worker.name,
                whatsapp_number: worker.whatsapp_number ?? null,
                pf_esi_enrolled: worker.pf_esi_enrolled ?? undefined,
                pf_esi_eligible: worker.pf_esi_eligible ?? undefined,
                role: worker.role,
                monthly_salary: monthlySalary,
                daysWorked,
                earnedPay: machineOperatorGross.gross,
                isMachineOperator,
                machineOperatorLines: isMachineOperator ? machineOperatorGross.lines : undefined,
                usedProductionDateProxy: machineOperatorGross.usedProductionDateProxy,
                totalAdvances: advanceMap[worker.id] || 0,
                settlement: settlementMap[worker.id],
            } as FixedWorkerPayroll
        })
}
