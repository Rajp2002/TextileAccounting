/**
 * Weavly — Configurable Payroll Cycle Engine
 * Domain-level service for calculating, validating, and generating payroll period boundaries.
 * 
 * Invariants Guaranteed:
 * 1. No gaps: Every calendar day belongs to exactly one payroll period.
 * 2. No overlaps: Boundaries use the half-open interval model [start, nextStart).
 *    period_end is strictly derived as (next_period_start - 1 day).
 * 3. Deterministic arithmetic: Integer date-only math (YYYY-MM-DD) avoiding timezone shifts.
 * 4. Month-end fallbacks: For monthly/semi-monthly cycles, nonexistent anchor days in shorter
 *    months fall back to that month's final calendar day.
 * 5. Active & historical payroll protection: Settled/in-progress periods are immutable;
 *    new rules become effective only on safe future boundaries.
 */

export type PayrollCycleType =
    | 'monthly'
    | 'weekly'
    | 'interval_weeks'
    | 'interval_days'
    | 'semi_monthly'

export type WeekdayName =
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday'

export interface MonthlyCycleRule {
    type: 'monthly'
    anchorDay: number // 1 to 31
}

export interface WeeklyCycleRule {
    type: 'weekly'
    anchorWeekday: WeekdayName
}

export interface IntervalWeeksCycleRule {
    type: 'interval_weeks'
    interval: number // positive integer, e.g. 2
    anchorDate: string // YYYY-MM-DD
}

export interface IntervalDaysCycleRule {
    type: 'interval_days'
    interval: number // positive integer, e.g. 24
    anchorDate: string // YYYY-MM-DD
}

export interface SemiMonthlyCycleRule {
    type: 'semi_monthly'
    firstBoundary: number // 1 to 31
    secondBoundary: number // 1 to 31, firstBoundary < secondBoundary
}

export type PayrollCycleRule =
    | MonthlyCycleRule
    | WeeklyCycleRule
    | IntervalWeeksCycleRule
    | IntervalDaysCycleRule
    | SemiMonthlyCycleRule

export interface PayrollPeriodBoundary {
    start: string // YYYY-MM-DD (inclusive)
    end: string   // YYYY-MM-DD (inclusive)
    label: string // e.g. "26 Aug 2026 – 25 Sep 2026"
}

export interface PayrollCycleConfig {
    id?: string
    orgId?: string
    cycleType: PayrollCycleType
    rule: PayrollCycleRule
    effectiveFrom: string // YYYY-MM-DD
    effectiveUntil?: string | null // YYYY-MM-DD or null
    createdAt?: string
    updatedAt?: string
}

export interface ProtectedPeriodSummary {
    period_start: string
    period_end: string
    status?: string // 'open' | 'in_progress' | 'ready_to_complete' | 'settled'
    paid_workers?: number
    total_gross?: number
}

export const WEEKDAYS: WeekdayName[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
]

export const DEFAULT_MONTHLY_CYCLE_RULE: MonthlyCycleRule = {
    type: 'monthly',
    anchorDay: 1,
}

// ---------------------------------------------------------------------------
// Pure Date-Only Math Utilities (UTC integer operations, zero timezone drift)
// ---------------------------------------------------------------------------

export function isValidDateString(dateStr: string): boolean {
    if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return false
    }
    const [y, m, d] = dateStr.split('-').map(Number)
    if (m < 1 || m > 12 || d < 1 || d > 31) return false
    const dim = getDaysInMonth(y, m)
    return d <= dim
}

export function parseYMD(dateStr: string): { year: number; month: number; day: number } {
    const [year, month, day] = dateStr.split('-').map(Number)
    return { year, month, day }
}

export function formatYMD(year: number, month: number, day: number): string {
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function getDaysInMonth(year: number, month: number): number {
    switch (month) {
        case 2:
            return isLeapYear(year) ? 29 : 28
        case 4:
        case 6:
        case 9:
        case 11:
            return 30
        default:
            return 31
    }
}

export function addDays(dateStr: string, days: number): string {
    const { year, month, day } = parseYMD(dateStr)
    const ms = Date.UTC(year, month - 1, day + days)
    const d = new Date(ms)
    return formatYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

export function diffInDays(dateStrA: string, dateStrB: string): number {
    const a = parseYMD(dateStrA)
    const b = parseYMD(dateStrB)
    const msA = Date.UTC(a.year, a.month - 1, a.day)
    const msB = Date.UTC(b.year, b.month - 1, b.day)
    return Math.round((msA - msB) / 86400000)
}

export function getWeekdayName(dateStr: string): WeekdayName {
    const { year, month, day } = parseYMD(dateStr)
    // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
    const map: WeekdayName[] = [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
    ]
    return map[dayOfWeek]
}

export function getPrevMonth(year: number, month: number): { year: number; month: number } {
    return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

export function getNextMonth(year: number, month: number): { year: number; month: number } {
    return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
}

export function formatDateLabel(dateStr: string): string {
    const { year, month, day } = parseYMD(dateStr)
    const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ]
    return `${day} ${monthNames[month - 1]} ${year}`
}

export function getOrdinalSuffix(day: number): string {
    if (day >= 11 && day <= 13) return 'th'
    switch (day % 10) {
        case 1: return 'st'
        case 2: return 'nd'
        case 3: return 'rd'
        default: return 'th'
    }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateCycleRule(rule: unknown): { valid: boolean; error?: string; normalizedRule?: PayrollCycleRule } {
    if (!rule || typeof rule !== 'object') {
        return { valid: false, error: 'Cycle rule must be an object' }
    }

    const r = rule as Partial<PayrollCycleRule>

    switch (r.type) {
        case 'monthly': {
            const anchor = Number(r.anchorDay)
            if (!Number.isInteger(anchor) || anchor < 1 || anchor > 31) {
                return { valid: false, error: 'Monthly period start day must be between 1 and 31' }
            }
            return { valid: true, normalizedRule: { type: 'monthly', anchorDay: anchor } }
        }

        case 'weekly': {
            if (!r.anchorWeekday || !WEEKDAYS.includes(r.anchorWeekday as WeekdayName)) {
                return { valid: false, error: 'Weekly start day must be a valid weekday' }
            }
            return { valid: true, normalizedRule: { type: 'weekly', anchorWeekday: r.anchorWeekday as WeekdayName } }
        }

        case 'interval_weeks': {
            const interval = Number(r.interval)
            if (!Number.isInteger(interval) || interval < 1 || interval > 52) {
                return { valid: false, error: 'Interval weeks must be an integer between 1 and 52' }
            }
            if (!r.anchorDate || !isValidDateString(r.anchorDate)) {
                return { valid: false, error: 'A valid anchor date (YYYY-MM-DD) is required for weekly intervals' }
            }
            return {
                valid: true,
                normalizedRule: {
                    type: 'interval_weeks',
                    interval,
                    anchorDate: r.anchorDate,
                },
            }
        }

        case 'interval_days': {
            const interval = Number(r.interval)
            if (!Number.isInteger(interval) || interval < 1 || interval > 365) {
                return { valid: false, error: 'Interval days must be an integer between 1 and 365' }
            }
            if (!r.anchorDate || !isValidDateString(r.anchorDate)) {
                return { valid: false, error: 'A valid anchor date (YYYY-MM-DD) is required for day intervals' }
            }
            return {
                valid: true,
                normalizedRule: {
                    type: 'interval_days',
                    interval,
                    anchorDate: r.anchorDate,
                },
            }
        }

        case 'semi_monthly': {
            let b1 = Number(r.firstBoundary)
            let b2 = Number(r.secondBoundary)
            if (!Number.isInteger(b1) || b1 < 1 || b1 > 31) {
                return { valid: false, error: 'First boundary must be a day between 1 and 31' }
            }
            if (!Number.isInteger(b2) || b2 < 1 || b2 > 31) {
                return { valid: false, error: 'Second boundary must be a day between 1 and 31' }
            }
            if (b1 === b2) {
                return { valid: false, error: 'Semi-monthly boundaries must be different days' }
            }
            if (b1 > b2) {
                const temp = b1
                b1 = b2
                b2 = temp
            }
            return {
                valid: true,
                normalizedRule: {
                    type: 'semi_monthly',
                    firstBoundary: b1,
                    secondBoundary: b2,
                },
            }
        }

        default:
            return { valid: false, error: `Unsupported payroll cycle type: ${String(r.type)}` }
    }
}

// ---------------------------------------------------------------------------
// Boundary Generation & Deterministic Recurrence
// ---------------------------------------------------------------------------

/**
 * Calculates the monthly boundary date for a specific year and month,
 * applying the deterministic month-end fallback rule when anchorDay > daysInMonth.
 */
function getMonthlyBoundaryForMonth(year: number, month: number, anchorDay: number): string {
    const dim = getDaysInMonth(year, month)
    const resolvedDay = Math.min(anchorDay, dim)
    return formatYMD(year, month, resolvedDay)
}

/**
 * Returns the cycle boundary date on or immediately before `dateStr`.
 */
export function getBoundaryOnOrBefore(dateStr: string, rule: PayrollCycleRule): string {
    switch (rule.type) {
        case 'monthly': {
            const { year, month } = parseYMD(dateStr)
            const currentMonthBoundary = getMonthlyBoundaryForMonth(year, month, rule.anchorDay)
            if (dateStr >= currentMonthBoundary) {
                return currentMonthBoundary
            }
            const prev = getPrevMonth(year, month)
            return getMonthlyBoundaryForMonth(prev.year, prev.month, rule.anchorDay)
        }

        case 'weekly': {
            const targetWeekdayIdx = WEEKDAYS.indexOf(rule.anchorWeekday)
            const currentWeekdayName = getWeekdayName(dateStr)
            const currentWeekdayIdx = WEEKDAYS.indexOf(currentWeekdayName)
            const daysBack = (currentWeekdayIdx - targetWeekdayIdx + 7) % 7
            return addDays(dateStr, -daysBack)
        }

        case 'interval_weeks': {
            const cycleDays = rule.interval * 7
            const diff = diffInDays(dateStr, rule.anchorDate)
            const cycles = Math.floor(diff / cycleDays)
            return addDays(rule.anchorDate, cycles * cycleDays)
        }

        case 'interval_days': {
            const diff = diffInDays(dateStr, rule.anchorDate)
            const cycles = Math.floor(diff / rule.interval)
            return addDays(rule.anchorDate, cycles * rule.interval)
        }

        case 'semi_monthly': {
            const { year, month } = parseYMD(dateStr)
            const dim = getDaysInMonth(year, month)
            const b1 = Math.min(rule.firstBoundary, dim)
            const b2 = Math.min(rule.secondBoundary, dim)

            const date1 = formatYMD(year, month, b1)
            const date2 = formatYMD(year, month, b2)

            if (dateStr >= date2) {
                return date2
            }
            if (dateStr >= date1) {
                return date1
            }

            // Fallback to previous month's second boundary
            const prev = getPrevMonth(year, month)
            const prevDim = getDaysInMonth(prev.year, prev.month)
            const prevB2 = Math.min(rule.secondBoundary, prevDim)
            return formatYMD(prev.year, prev.month, prevB2)
        }
    }
}

/**
 * Returns the immediate next boundary strictly after `currentBoundary`.
 */
export function getNextBoundary(currentBoundary: string, rule: PayrollCycleRule): string {
    switch (rule.type) {
        case 'monthly': {
            const { year, month } = parseYMD(currentBoundary)
            const next = getNextMonth(year, month)
            return getMonthlyBoundaryForMonth(next.year, next.month, rule.anchorDay)
        }

        case 'weekly': {
            return addDays(currentBoundary, 7)
        }

        case 'interval_weeks': {
            return addDays(currentBoundary, rule.interval * 7)
        }

        case 'interval_days': {
            return addDays(currentBoundary, rule.interval)
        }

        case 'semi_monthly': {
            const { year, month, day } = parseYMD(currentBoundary)
            const dim = getDaysInMonth(year, month)
            const b1 = Math.min(rule.firstBoundary, dim)
            const b2 = Math.min(rule.secondBoundary, dim)

            // If currently on b1, next is b2 of the same month
            if (day === b1 && b2 > b1) {
                return formatYMD(year, month, b2)
            }

            // Otherwise, next is b1 of the next month
            const next = getNextMonth(year, month)
            const nextDim = getDaysInMonth(next.year, next.month)
            const nextB1 = Math.min(rule.firstBoundary, nextDim)
            return formatYMD(next.year, next.month, nextB1)
        }
    }
}

/**
 * Returns the previous boundary strictly before `currentBoundary`.
 */
export function getPreviousBoundary(currentBoundary: string, rule: PayrollCycleRule): string {
    // A boundary strictly before `currentBoundary` is the boundary on or before (currentBoundary - 1 day)
    return getBoundaryOnOrBefore(addDays(currentBoundary, -1), rule)
}

/**
 * Returns the concrete PayrollPeriodBoundary containing `dateStr`.
 * Guaranteed to satisfy: start <= dateStr <= end, with end = nextStart - 1 day.
 */
export function getPeriodContaining(dateStr: string, rule: PayrollCycleRule): PayrollPeriodBoundary {
    const start = getBoundaryOnOrBefore(dateStr, rule)
    const nextStart = getNextBoundary(start, rule)
    const end = addDays(nextStart, -1)
    return {
        start,
        end,
        label: `${formatDateLabel(start)} – ${formatDateLabel(end)}`,
    }
}

/**
 * Generates `count` sequential, continuous payroll periods starting on or containing `fromDate`.
 */
export function generatePeriods(
    rule: PayrollCycleRule,
    fromDate: string,
    count: number = 4
): PayrollPeriodBoundary[] {
    const periods: PayrollPeriodBoundary[] = []
    let currentStart = getBoundaryOnOrBefore(fromDate, rule)

    for (let i = 0; i < count; i++) {
        const nextStart = getNextBoundary(currentStart, rule)
        const end = addDays(nextStart, -1)
        periods.push({
            start: currentStart,
            end,
            label: `${formatDateLabel(currentStart)} – ${formatDateLabel(end)}`,
        })
        currentStart = nextStart
    }

    return periods
}

/**
 * Live Period Preview for Settings UI.
 * Returns at least 4 continuous periods centered around or starting from referenceDate.
 * Shows: [Current/Previous, Current, Next 1, Next 2, Next 3]
 */
export function previewPeriods(
    rule: PayrollCycleRule,
    referenceDate: string = '2026-09-01',
    count: number = 4
): PayrollPeriodBoundary[] {
    return generatePeriods(rule, referenceDate, count)
}

/**
 * Plain-language explanation for Settings UI.
 */
export function formatCycleExplanation(rule: PayrollCycleRule): string {
    switch (rule.type) {
        case 'monthly': {
            if (rule.anchorDay === 1) {
                return 'Payroll runs monthly from the 1st to the final day of each calendar month.'
            }
            const suffix = getOrdinalSuffix(rule.anchorDay)
            const fallbackNote = rule.anchorDay >= 29 ? ' (for shorter months, Weavly uses the final day of the month)' : ''
            return `Payroll runs monthly, beginning on the ${rule.anchorDay}${suffix} of each month${fallbackNote}.`
        }

        case 'weekly': {
            const capWeekday = rule.anchorWeekday.charAt(0).toUpperCase() + rule.anchorWeekday.slice(1)
            return `Payroll repeats weekly, beginning every ${capWeekday}.`
        }

        case 'interval_weeks': {
            const anchor = formatDateLabel(rule.anchorDate)
            const capWeekday = getWeekdayName(rule.anchorDate).charAt(0).toUpperCase() + getWeekdayName(rule.anchorDate).slice(1)
            return `Payroll repeats every ${rule.interval} weeks beginning ${capWeekday}, ${anchor}.`
        }

        case 'interval_days': {
            const anchor = formatDateLabel(rule.anchorDate)
            return `Payroll repeats every ${rule.interval} days beginning ${anchor}.`
        }

        case 'semi_monthly': {
            const s1 = `${rule.firstBoundary}${getOrdinalSuffix(rule.firstBoundary)}`
            const s2 = `${rule.secondBoundary}${getOrdinalSuffix(rule.secondBoundary)}`
            return `Payroll periods begin on the ${s1} and ${s2} of each month.`
        }
    }
}

// ---------------------------------------------------------------------------
// Safe Effective Date & Active Payroll Protection
// ---------------------------------------------------------------------------

/**
 * Determines the earliest safe effective date for changing a workspace's payroll cycle.
 * Invariant: Any period that is settled, in-progress, ready to complete, or has recorded
 * payments must NOT be truncated or reshaped. The new rule takes effect on the day
 * immediately following the latest protected period.
 */
export function getEarliestSafeCycleChangeDate(params: {
    protectedPeriods?: ProtectedPeriodSummary[]
    today: string
    currentRule?: PayrollCycleRule
}): {
    safeEffectiveDate: string
    reason: string
    protectedPeriodEnd?: string
} {
    const { protectedPeriods = [], today, currentRule = DEFAULT_MONTHLY_CYCLE_RULE } = params

    // Filter to periods with immutable accounting state
    const activeOrSettled = protectedPeriods.filter((p) => {
        const isSettledOrProgress = p.status === 'settled' || p.status === 'in_progress' || p.status === 'ready_to_complete'
        const hasPaidWorkers = (p.paid_workers ?? 0) > 0
        return isSettledOrProgress || hasPaidWorkers
    })

    if (activeOrSettled.length > 0) {
        // Find latest protected end date
        const sortedEnds = activeOrSettled.map((p) => p.period_end).sort()
        const latestProtectedEnd = sortedEnds[sortedEnds.length - 1]

        // Safe effective date is the day after the latest protected period
        const safeDate = addDays(latestProtectedEnd, 1)
        return {
            safeEffectiveDate: safeDate,
            reason: `Existing payroll period ending on ${formatDateLabel(latestProtectedEnd)} is protected. The new cycle will begin on ${formatDateLabel(safeDate)}.`,
            protectedPeriodEnd: latestProtectedEnd,
        }
    }

    // If no protected periods exist in DB, check if today is inside an ongoing period under currentRule
    const currentPeriod = getPeriodContaining(today, currentRule)
    const nextStart = addDays(currentPeriod.end, 1)

    return {
        safeEffectiveDate: nextStart,
        reason: `New cycle will take effect at the start of the next payroll period on ${formatDateLabel(nextStart)}.`,
        protectedPeriodEnd: currentPeriod.end,
    }
}
