/**
 * Minimum wage configuration for Indian textile industry.
 * Source: Labour Department, Government of Gujarat (2025-26 schedule)
 * 
 * Under the Code on Wages 2019, employers must pay at least the
 * state-notified minimum wage. These constants are used for
 * advisory warnings only — they do not block any action.
 * 
 * Update these values when the state revises minimum wages.
 */

// Gujarat textile industry — skilled workers
export const MIN_WAGE_DAILY = 404      // ₹404/day
export const MIN_WAGE_MONTHLY = 12120  // ₹404 × 30 days

/**
 * Check if a given pay amount is below the minimum wage threshold.
 */
export function isBelowMinWage(
    amount: number,
    type: 'daily' | 'monthly'
): boolean {
    if (type === 'daily') return amount < MIN_WAGE_DAILY
    return amount < MIN_WAGE_MONTHLY
}
