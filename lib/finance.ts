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
 */
export function formatINR(amount: string | number): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num)
}
