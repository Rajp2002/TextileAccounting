import Decimal from 'decimal.js'

export const PAYROLL_MANUAL_ADJUSTMENT_REASONS = [
    'Attendance correction',
    'Quality issue',
    'Damage',
    'Extra work',
    'Festival / goodwill',
    'Rounding correction',
    'Other',
] as const

export type PayrollManualAdjustmentType = 'inam' | 'kapaat'
export type PayrollManualAdjustmentReason = typeof PAYROLL_MANUAL_ADJUSTMENT_REASONS[number]

export interface PayrollManualAdjustment {
    adjustment_type: PayrollManualAdjustmentType
    reason: PayrollManualAdjustmentReason
    amount: number
    note: string
}

export interface PayrollFinalizationPreview {
    baseEarnings: number
    inamTotal: number
    kapaatTotal: number
    manualAdjustmentTotal: number
    advanceRecovery: number
    finalPayout: number
    remainingDebt: number
    canConfirm: boolean
}

const REASON_SET = new Set<string>(PAYROLL_MANUAL_ADJUSTMENT_REASONS)

function toMoney(value: number | string) {
    return new Decimal(value || 0)
}

export function calculatePayrollManualAdjustmentTotals(
    adjustments: PayrollManualAdjustment[]
) {
    const totals = adjustments.reduce(
        (acc, adjustment) => {
            const amount = toMoney(adjustment.amount)
            if (adjustment.adjustment_type === 'inam') {
                return { ...acc, inamTotal: acc.inamTotal.plus(amount) }
            }

            return { ...acc, kapaatTotal: acc.kapaatTotal.plus(amount) }
        },
        {
            inamTotal: new Decimal(0),
            kapaatTotal: new Decimal(0),
        }
    )

    return {
        inamTotal: totals.inamTotal.toNumber(),
        kapaatTotal: totals.kapaatTotal.toNumber(),
        manualAdjustmentTotal: totals.inamTotal.minus(totals.kapaatTotal).toNumber(),
    }
}

export function calculatePayrollFinalizationPreview(params: {
    baseEarnings: number
    adjustments: PayrollManualAdjustment[]
    advanceRecovery: number
    existingDebt: number
}): PayrollFinalizationPreview {
    const totals = calculatePayrollManualAdjustmentTotals(params.adjustments)
    const baseEarnings = toMoney(params.baseEarnings)
    const advanceRecovery = Decimal.max(0, toMoney(params.advanceRecovery))
    const existingDebt = Decimal.max(0, toMoney(params.existingDebt))
    const finalPayout = baseEarnings
        .plus(totals.inamTotal)
        .minus(totals.kapaatTotal)
        .minus(advanceRecovery)
    const remainingDebt = Decimal.max(0, existingDebt.minus(advanceRecovery))

    return {
        baseEarnings: baseEarnings.toNumber(),
        inamTotal: totals.inamTotal,
        kapaatTotal: totals.kapaatTotal,
        manualAdjustmentTotal: totals.manualAdjustmentTotal,
        advanceRecovery: advanceRecovery.toNumber(),
        finalPayout: finalPayout.toNumber(),
        remainingDebt: remainingDebt.toNumber(),
        canConfirm: finalPayout.gte(0),
    }
}

export function sanitizePayrollManualAdjustment(input: unknown):
    | { success: true; data: PayrollManualAdjustment }
    | { success: false; error: string } {
    if (!input || typeof input !== 'object') {
        return { success: false, error: 'Adjustment type is required.' }
    }

    const raw = input as Record<string, unknown>
    const adjustmentType = raw.adjustment_type
    const reason = raw.reason
    const amount = Number(raw.amount)
    const note = typeof raw.note === 'string' ? raw.note.trim() : ''

    if (adjustmentType !== 'inam' && adjustmentType !== 'kapaat') {
        return { success: false, error: 'Adjustment type is required.' }
    }

    if (typeof reason !== 'string' || !REASON_SET.has(reason)) {
        return { success: false, error: 'Reason is required.' }
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        return { success: false, error: 'Amount must be greater than 0.' }
    }

    if (!note) {
        return { success: false, error: 'Note is required.' }
    }

    return {
        success: true,
        data: {
            adjustment_type: adjustmentType,
            reason: reason as PayrollManualAdjustmentReason,
            amount,
            note,
        },
    }
}

export function sanitizePayrollManualAdjustments(input: unknown):
    | { success: true; data: PayrollManualAdjustment[] }
    | { success: false; error: string } {
    if (input === undefined || input === null) {
        return { success: true, data: [] }
    }

    if (!Array.isArray(input)) {
        return { success: false, error: 'Manual adjustments must be a list.' }
    }

    const adjustments: PayrollManualAdjustment[] = []
    for (const item of input) {
        const parsed = sanitizePayrollManualAdjustment(item)
        if (!parsed.success) return parsed
        adjustments.push(parsed.data)
    }

    return { success: true, data: adjustments }
}
