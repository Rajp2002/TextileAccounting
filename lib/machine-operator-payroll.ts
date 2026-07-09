export type OperatorPayMode = 'per_meter' | 'fixed_monthly' | 'fixed_daily' | 'fixed_shift'
export type OperatorWorkerType = 'meter_worker' | 'fixed_worker'
export type MachineType = 'jacquard' | 'power_loom' | 'rapier' | 'water_jet' | 'other'
export type Shift = 'day' | 'night'

export type OperatorAssignmentPayrollInput = {
    id: string
    workerType: OperatorWorkerType
    workerId: number
    payMode: OperatorPayMode
    rate: number | string | null
    effectiveFrom?: string | null
    effectiveTo?: string | null
}

export type OperatorProductionLogInput = {
    operatorAssignmentId?: string | null
    operatorWorkerType?: OperatorWorkerType | null
    meterWorkerId?: number | null
    fixedWorkerId?: number | null
    workerId?: number | null
    productionDate: string
    shift: Shift
    meters: number | string | null
    workerRateSnapshot?: number | string | null
    operatorRateSnapshot?: number | string | null
    operatorPayModeSnapshot?: OperatorPayMode | null
}

export type FixedWorkerPayrollSetup = {
    id: number
    role?: string | null
    monthlySalary?: number | string | null
}

export type FixedWorkerAttendanceInput = {
    fixedWorkerId: number
    date: string
    present?: boolean | null
}

export type FixedMachineOperatorLine = {
    payMode: OperatorPayMode
    label: string
    quantityLabel: string
    rate: number
    amount: number
    source: 'salary' | 'assignment' | 'attendance' | 'production_proxy'
    productionMeters?: number
}

export type FixedMachineOperatorGrossResult = {
    gross: number
    lines: FixedMachineOperatorLine[]
    usedProductionDateProxy: boolean
}

export const FIXED_OPERATOR_PAY_MODES: OperatorPayMode[] = ['fixed_monthly', 'fixed_daily', 'fixed_shift']

function toNumber(value: unknown): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
}

function positive(value: unknown): number {
    return Math.max(toNumber(value), 0)
}

function normalizedText(value: unknown) {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
}

export function normalizeMachineType(value: unknown): MachineType {
    const text = normalizedText(value)

    if (['jacquard', 'jakard', 'jakards', 'jac', 'jacard'].includes(text)) return 'jacquard'
    if (['power loom', 'powerloom', 'pl'].includes(text)) return 'power_loom'
    if (['rapier', 'rap'].includes(text)) return 'rapier'
    if (['water jet', 'waterjet', 'wj'].includes(text)) return 'water_jet'

    return 'other'
}

export function getDefaultPayModeForMachineType(machineType: MachineType): OperatorPayMode {
    if (machineType === 'jacquard' || machineType === 'power_loom') return 'per_meter'
    return 'fixed_monthly'
}

export function machineTypeRequiresOwnerConfiguredPayMode(machineType: MachineType): boolean {
    return machineType === 'other'
}

export function getOperatorWorkerTypeForPayMode(payMode: OperatorPayMode): OperatorWorkerType {
    return payMode === 'per_meter' ? 'meter_worker' : 'fixed_worker'
}

export function isFixedOperatorPayMode(payMode: OperatorPayMode | null | undefined): boolean {
    return !!payMode && FIXED_OPERATOR_PAY_MODES.includes(payMode)
}

export function calculateMeterOperatorGross(logs: OperatorProductionLogInput[], workerId: number): number {
    return logs.reduce((sum, log) => {
        const belongsToWorker = log.meterWorkerId === workerId || (!log.operatorAssignmentId && log.workerId === workerId)
        if (!belongsToWorker) return sum
        if ((log.operatorPayModeSnapshot ?? 'per_meter') !== 'per_meter') return sum

        return sum + positive(log.meters) * positive(log.operatorRateSnapshot ?? log.workerRateSnapshot)
    }, 0)
}

function isInCycle(value: string | null | undefined, cycleStart: string, cycleEnd: string) {
    return !!value && value >= cycleStart && value <= cycleEnd
}

function activeInCycle(
    assignment: Pick<OperatorAssignmentPayrollInput, 'effectiveFrom' | 'effectiveTo'>,
    cycleStart: string,
    cycleEnd: string
) {
    const effectiveFrom = assignment.effectiveFrom ?? cycleStart
    const effectiveTo = assignment.effectiveTo ?? cycleEnd
    return effectiveFrom <= cycleEnd && effectiveTo >= cycleStart
}

export function calculateFixedMachineOperatorGross(params: {
    fixedWorker: FixedWorkerPayrollSetup
    assignments?: OperatorAssignmentPayrollInput[]
    productionLogs?: OperatorProductionLogInput[]
    attendance?: FixedWorkerAttendanceInput[]
    cycleStart: string
    cycleEnd: string
}): FixedMachineOperatorGrossResult {
    const workerId = params.fixedWorker.id
    const assignments = (params.assignments ?? []).filter(
        (assignment) => assignment.workerType === 'fixed_worker'
            && assignment.workerId === workerId
            && activeInCycle(assignment, params.cycleStart, params.cycleEnd)
    )
    const logs = (params.productionLogs ?? []).filter(
        (log) => log.fixedWorkerId === workerId
            && isInCycle(log.productionDate, params.cycleStart, params.cycleEnd)
            && positive(log.meters) > 0
    )
    const presentDates = new Set(
        (params.attendance ?? [])
            .filter((row) => row.fixedWorkerId === workerId && row.present !== false && isInCycle(row.date, params.cycleStart, params.cycleEnd))
            .map((row) => row.date)
    )
    const monthlySalary = positive(params.fixedWorker.monthlySalary)
    const lines: FixedMachineOperatorLine[] = []
    let usedProductionDateProxy = false
    const hasMachineOperatorContext = assignments.length > 0 || logs.some((log) => isFixedOperatorPayMode(log.operatorPayModeSnapshot))

    if (!hasMachineOperatorContext) {
        if (params.fixedWorker.role === 'daily') {
            const dailyFallbackRate = monthlySalary > 0 ? monthlySalary / 30 : 0
            const amount = Math.min(monthlySalary, dailyFallbackRate * presentDates.size)
            return {
                gross: amount,
                lines: [{
                    payMode: 'fixed_daily',
                    label: 'Days present',
                    quantityLabel: `${presentDates.size} day${presentDates.size === 1 ? '' : 's'}`,
                    rate: dailyFallbackRate,
                    amount,
                    source: 'attendance',
                }],
                usedProductionDateProxy: false,
            }
        }

        return {
            gross: monthlySalary,
            lines: [{
                payMode: 'fixed_monthly',
                label: 'Monthly salary',
                quantityLabel: '1 cycle',
                rate: monthlySalary,
                amount: monthlySalary,
                source: 'salary',
            }],
            usedProductionDateProxy: false,
        }
    }

    const monthlyRates = assignments
        .filter((assignment) => assignment.payMode === 'fixed_monthly')
        .map((assignment) => positive(assignment.rate))
    const loggedMonthlyRates = logs
        .filter((log) => log.operatorPayModeSnapshot === 'fixed_monthly')
        .map((log) => positive(log.operatorRateSnapshot))
    const monthlyRate = Math.max(monthlySalary, ...monthlyRates, ...loggedMonthlyRates, 0)
    if (monthlyRate > 0 && (monthlyRates.length > 0 || loggedMonthlyRates.length > 0)) {
        lines.push({
            payMode: 'fixed_monthly',
            label: 'Monthly fixed machine operator salary',
            quantityLabel: '1 cycle',
            rate: monthlyRate,
            amount: monthlyRate,
            source: monthlyRates.length > 0 || loggedMonthlyRates.length > 0 ? 'assignment' : 'salary',
        })
    }

    const shiftGroups = new Map<string, { rate: number; meters: number }>()
    for (const log of logs) {
        if (log.operatorPayModeSnapshot !== 'fixed_shift' || !log.operatorAssignmentId) continue
        const key = `${log.operatorAssignmentId}:${log.productionDate}:${log.shift}`
        const current = shiftGroups.get(key) ?? { rate: 0, meters: 0 }
        current.rate = Math.max(current.rate, positive(log.operatorRateSnapshot))
        current.meters += positive(log.meters)
        shiftGroups.set(key, current)
    }
    const shiftCount = shiftGroups.size
    if (shiftCount > 0) {
        const amount = Array.from(shiftGroups.values()).reduce((sum, group) => sum + group.rate, 0)
        const representativeRate = shiftCount > 0 ? amount / shiftCount : 0
        lines.push({
            payMode: 'fixed_shift',
            label: 'Logged production shifts',
            quantityLabel: `${shiftCount} shift${shiftCount === 1 ? '' : 's'}`,
            rate: representativeRate,
            amount,
            source: 'production_proxy',
            productionMeters: Array.from(shiftGroups.values()).reduce((sum, group) => sum + group.meters, 0),
        })
    }

    const fixedDailyAssignments = assignments.filter((assignment) => assignment.payMode === 'fixed_daily')
    const dailyFallbackRate = monthlySalary > 0 ? monthlySalary / 30 : 0
    if (fixedDailyAssignments.length > 0 || logs.some((log) => log.operatorPayModeSnapshot === 'fixed_daily')) {
        if (presentDates.size > 0) {
            const amount = Array.from(presentDates).reduce((sum, date) => {
                const rateForDate = Math.max(
                    ...fixedDailyAssignments
                        .filter((assignment) => activeInCycle(assignment, date, date))
                        .map((assignment) => positive(assignment.rate)),
                    dailyFallbackRate
                )
                return sum + rateForDate
            }, 0)
            lines.push({
                payMode: 'fixed_daily',
                label: 'Days present',
                quantityLabel: `${presentDates.size} day${presentDates.size === 1 ? '' : 's'}`,
                rate: presentDates.size > 0 ? amount / presentDates.size : 0,
                amount,
                source: 'attendance',
            })
        } else {
            const dates = new Map<string, { rate: number; meters: number }>()
            for (const log of logs) {
                if (log.operatorPayModeSnapshot !== 'fixed_daily') continue
                const current = dates.get(log.productionDate) ?? { rate: 0, meters: 0 }
                current.rate = Math.max(current.rate, positive(log.operatorRateSnapshot))
                current.meters += positive(log.meters)
                dates.set(log.productionDate, current)
            }
            const dayCount = dates.size
            if (dayCount > 0) {
                usedProductionDateProxy = true
                const amount = Array.from(dates.values()).reduce((sum, day) => sum + day.rate, 0)
                lines.push({
                    payMode: 'fixed_daily',
                    label: 'Logged production dates',
                    quantityLabel: `${dayCount} day${dayCount === 1 ? '' : 's'}`,
                    rate: dayCount > 0 ? amount / dayCount : 0,
                    amount,
                    source: 'production_proxy',
                    productionMeters: Array.from(dates.values()).reduce((sum, day) => sum + day.meters, 0),
                })
            }
        }
    }

    return {
        gross: lines.reduce((sum, line) => sum + line.amount, 0),
        lines,
        usedProductionDateProxy,
    }
}
