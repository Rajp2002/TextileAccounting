import Decimal from 'decimal.js'

// Configure Decimal for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

export interface ProductionLog {
    meters: number | string
    date?: string
    worker_id?: number | string
    machine_id?: string
}

/**
 * Calculate daily pay for a worker based on meters produced and rate per meter.
 * Uses Decimal.js to avoid floating-point errors.
 *
 * @param meters - meters produced (from DB, may be string or number)
 * @param rate - rate per meter in ₹ (from DB, may be string or number)
 * @returns pay amount as a string with 2 decimal places, e.g. "1250.00"
 */
export function calculateDailyPay(
    meters: number | string,
    rate: number | string
): string {
    const m = new Decimal(meters || 0)
    const r = new Decimal(rate || 0)
    return m.times(r).toFixed(2)
}

/**
 * Calculate total pay for a list of production items, where each item can have its own rate.
 * useful when rates vary by machine.
 *
 * @param items - array of objects with meters and rate
 * @returns total pay as a string with 2 decimal places
 */
export function calculateTotalPay(
    items: { meters: number | string; rate: number | string }[]
): string {
    const total = items.reduce((acc, item) => {
        const m = new Decimal(item.meters || 0)
        const r = new Decimal(item.rate || 0)
        return acc.plus(m.times(r))
    }, new Decimal(0))

    return total.toFixed(2)
}



/**
 * Sum meters across logs safely using Decimal.
 * Avoids floating-point drift when summing many DECIMAL values from Supabase.
 *
 * @param logs - array of objects with a `meters` field
 * @returns total meters as a string with 2 decimal places
 */
export function sumMeters(logs: { meters: number | string }[]): string {
    const total = logs.reduce((acc, log) => {
        return acc.plus(new Decimal(log.meters || 0))
    }, new Decimal(0))

    return total.toFixed(2)
}

/**
 * Format a number as Indian Rupees.
 * e.g. "1250.00" → "₹1,250.00"
 * @param amount - the amount to format
 * @param options - optional configuration (e.g. hideDecimals: true to remove .00)
 */
export function formatINR(amount: string | number, options?: { hideDecimals?: boolean }): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    const hide = options?.hideDecimals && num % 1 === 0
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: hide ? 0 : 2,
        maximumFractionDigits: hide ? 0 : 2,
    }).format(num)
}

/**
 * Sum advance amounts safely using Decimal.
 * Used to total pending advances for a worker during payroll settlement.
 *
 * @param advances - array of objects with an `amount` field
 * @returns total advances as a string with 2 decimal places
 */
export function sumAdvances(advances: { amount: number | string }[]): string {
    const total = advances.reduce((acc, adv) => {
        return acc.plus(new Decimal(adv.amount || 0))
    }, new Decimal(0))

    return total.toFixed(2)
}

/**
 * Calculate the maximum deductible amount per Indian labour law.
 * Under the Code on Wages, deductions from wages cannot exceed a specified
 * percentage (typically 50%) of gross wages in any pay period.
 *
 * @param grossPay - total earned
 * @param maxPercent - maximum deduction percentage (default: 50)
 * @returns max deductible amount as a string with 2 decimal places
 */
export function calculateMaxDeduction(
    grossPay: number | string,
    maxPercent: number = 50
): string {
    const gross = new Decimal(grossPay || 0)
    return gross.times(maxPercent).div(100).toFixed(2)
}

/**
 * Calculate the recommended advance recovery for a payroll settlement.
 * Recovery is capped to the configured percentage of gross pay, then any
 * leftover advance balance is carried forward.
 *
 * @param grossPay - total earned
 * @param totalAdvances - total pending advances to recover
 * @param maxDeductionPercent - max % of gross that can be recovered
 */
export function calculateAdvanceRecovery(
    grossPay: number | string,
    totalAdvances: number | string,
    maxDeductionPercent: number = 50
): {
    maxDeduction: string
    recommendedRecovery: string
    remainingDebt: string
    capApplied: boolean
} {
    const gross = Decimal.max(0, new Decimal(grossPay || 0))
    const advances = Decimal.max(0, new Decimal(totalAdvances || 0))
    const maxDeduction = gross.times(maxDeductionPercent).div(100)
    const recommendedRecovery = Decimal.min(advances, maxDeduction)
    const remainingDebt = Decimal.max(0, advances.minus(recommendedRecovery))

    return {
        maxDeduction: maxDeduction.toFixed(2),
        recommendedRecovery: recommendedRecovery.toFixed(2),
        remainingDebt: remainingDebt.toFixed(2),
        capApplied: advances.gt(recommendedRecovery) && maxDeductionPercent < 100,
    }
}

/**
 * Calculate net payout after deducting advances from gross pay.
 * Net pay is floored at ₹0 — never goes negative.
 *
 * @param grossPay - total earned (may be string from Decimal calculation)
 * @param totalAdvances - total pending advances to deduct
 * @param maxDeductionPercent - max % of gross that can be deducted (default: 50 for labour law compliance)
 * @returns net payout as a string with 2 decimal places, minimum "0.00"
 */
export function calculateNetPay(
    grossPay: number | string,
    totalAdvances: number | string,
    maxDeductionPercent: number = 50 // Default to 50% as per Code on Wages
): string {
    const gross = new Decimal(grossPay || 0)
    const advances = new Decimal(totalAdvances || 0)
    const maxDeduction = gross.times(maxDeductionPercent).div(100)
    const actualDeduction = Decimal.min(advances, maxDeduction)
    return Decimal.max(0, gross.minus(actualDeduction)).toFixed(2)
}

/**
 * Calculate remaining debt when advances exceed gross pay.
 * Returns 0 when gross pay covers all advances.
 *
 * @param grossPay - total earned
 * @param totalAdvances - total pending advances
 * @returns remaining debt as a string with 2 decimal places
 */
export function calculateRemainingDebt(
    grossPay: number | string,
    totalAdvances: number | string,
    maxDeductionPercent: number = 50 // Default to 50% as per Code on Wages
): string {
    const gross = new Decimal(grossPay || 0)
    const advances = new Decimal(totalAdvances || 0)
    const maxDeduction = gross.times(maxDeductionPercent).div(100)
    const actualDeduction = Decimal.min(advances, maxDeduction)
    return Decimal.max(0, advances.minus(actualDeduction)).toFixed(2)
}

// ─── Yarn-to-Fabric Yield Calculations ───────────────────────────────────────

/**
 * Ya = Σ Fabric Produced (m) / Total Batch Weight (kg)
 * Zero-division safe: returns "0.00" if weight is 0.
 */
export function calculateActualYield(
    totalMetersProduced: number | string,
    totalWeightKg: number | string
): string {
    const meters = new Decimal(totalMetersProduced || 0)
    const weight = new Decimal(totalWeightKg || 0)
    if (weight.isZero()) return '0.00'
    return meters.div(weight).toFixed(2)
}

/**
 * V = ((Ya - Ye) / Ye) × 100
 * Negative V = Leakage (theft/waste). Positive V > 10% = Padding (over-reporting).
 * Zero-division safe: returns "0.00" if expectedYield is 0.
 */
export function calculateEfficiencyVariance(
    actualYield: number | string,
    expectedYield: number | string
): string {
    const ya = new Decimal(actualYield || 0)
    const ye = new Decimal(expectedYield || 0)
    if (ye.isZero()) return '0.00'
    return ya.minus(ye).div(ye).times(100).toFixed(2)
}

/**
 * Monetary Loss = (Ye - Ya) × Weight × Price/m
 * Only calculated when Ya < Ye (negative variance / leakage).
 * Returns "0.00" if no loss.
 */
export function calculateMonetaryLoss(
    actualYield: number | string,
    expectedYield: number | string,
    totalWeightKg: number | string,
    avgSalePricePerM: number | string
): string {
    const ya = new Decimal(actualYield || 0)
    const ye = new Decimal(expectedYield || 0)
    const weight = new Decimal(totalWeightKg || 0)
    const price = new Decimal(avgSalePricePerM || 0)

    if (ya.gte(ye)) return '0.00' // no loss
    return ye.minus(ya).times(weight).times(price).toFixed(2)
}
