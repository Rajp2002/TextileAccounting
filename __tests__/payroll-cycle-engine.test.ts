import { describe, it, expect } from 'vitest'
import {
    PayrollCycleRule,
    validateCycleRule,
    getBoundaryOnOrBefore,
    getNextBoundary,
    getPreviousBoundary,
    getPeriodContaining,
    generatePeriods,
    previewPeriods,
    formatCycleExplanation,
    getEarliestSafeCycleChangeDate,
    addDays,
    diffInDays,
    isLeapYear,
    getDaysInMonth,
} from '@/lib/payroll-cycle-engine'

describe('PayrollCycleEngine — Pure Date Utilities', () => {
    it('accurately identifies leap years', () => {
        expect(isLeapYear(2024)).toBe(true)
        expect(isLeapYear(2026)).toBe(false)
        expect(isLeapYear(2027)).toBe(false)
        expect(isLeapYear(2028)).toBe(true)
        expect(isLeapYear(2100)).toBe(false)
        expect(isLeapYear(2000)).toBe(true)
    })

    it('returns exact days in month for leap and non-leap years', () => {
        expect(getDaysInMonth(2027, 2)).toBe(28)
        expect(getDaysInMonth(2028, 2)).toBe(29)
        expect(getDaysInMonth(2026, 9)).toBe(30)
        expect(getDaysInMonth(2026, 10)).toBe(31)
    })

    it('adds and subtracts days with integer precision across month/year boundaries', () => {
        expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
        expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
        expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
        expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
        expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    })

    it('calculates diff in days correctly', () => {
        expect(diffInDays('2026-09-25', '2026-09-01')).toBe(24)
        expect(diffInDays('2026-09-01', '2026-09-25')).toBe(-24)
    })
})

describe('PayrollCycleEngine — Validation', () => {
    it('validates monthly rules', () => {
        expect(validateCycleRule({ type: 'monthly', anchorDay: 1 }).valid).toBe(true)
        expect(validateCycleRule({ type: 'monthly', anchorDay: 26 }).valid).toBe(true)
        expect(validateCycleRule({ type: 'monthly', anchorDay: 31 }).valid).toBe(true)
        expect(validateCycleRule({ type: 'monthly', anchorDay: 0 }).valid).toBe(false)
        expect(validateCycleRule({ type: 'monthly', anchorDay: 32 }).valid).toBe(false)
    })

    it('validates weekly rules', () => {
        expect(validateCycleRule({ type: 'weekly', anchorWeekday: 'monday' }).valid).toBe(true)
        expect(validateCycleRule({ type: 'weekly', anchorWeekday: 'sunday' }).valid).toBe(true)
        expect(validateCycleRule({ type: 'weekly', anchorWeekday: 'invalid' }).valid).toBe(false)
    })

    it('validates interval rules', () => {
        expect(validateCycleRule({ type: 'interval_days', interval: 24, anchorDate: '2026-09-01' }).valid).toBe(true)
        expect(validateCycleRule({ type: 'interval_days', interval: 0, anchorDate: '2026-09-01' }).valid).toBe(false)
        expect(validateCycleRule({ type: 'interval_weeks', interval: 2, anchorDate: '2026-09-07' }).valid).toBe(true)
    })

    it('validates and normalizes semi-monthly rules', () => {
        const r1 = validateCycleRule({ type: 'semi_monthly', firstBoundary: 1, secondBoundary: 16 })
        expect(r1.valid).toBe(true)
        expect(r1.normalizedRule).toEqual({ type: 'semi_monthly', firstBoundary: 1, secondBoundary: 16 })

        // Auto-normalize inverted boundaries
        const r2 = validateCycleRule({ type: 'semi_monthly', firstBoundary: 20, secondBoundary: 5 })
        expect(r2.valid).toBe(true)
        expect(r2.normalizedRule).toEqual({ type: 'semi_monthly', firstBoundary: 5, secondBoundary: 20 })

        // Reject duplicate boundaries
        const r3 = validateCycleRule({ type: 'semi_monthly', firstBoundary: 15, secondBoundary: 15 })
        expect(r3.valid).toBe(false)
    })
})

describe('PayrollCycleEngine — Monthly Schedule', () => {
    it('generates standard calendar months when anchorDay is 1', () => {
        const rule: PayrollCycleRule = { type: 'monthly', anchorDay: 1 }
        const periods = generatePeriods(rule, '2026-01-15', 3)

        expect(periods).toHaveLength(3)
        expect(periods[0]).toEqual({
            start: '2026-01-01',
            end: '2026-01-31',
            label: '1 Jan 2026 – 31 Jan 2026',
        })
        expect(periods[1]).toEqual({
            start: '2026-02-01',
            end: '2026-02-28',
            label: '1 Feb 2026 – 28 Feb 2026',
        })
        expect(periods[2]).toEqual({
            start: '2026-03-01',
            end: '2026-03-31',
            label: '1 Mar 2026 – 31 Mar 2026',
        })
    })

    it('generates mid-month 26th-anchored periods', () => {
        const rule: PayrollCycleRule = { type: 'monthly', anchorDay: 26 }
        const p1 = getPeriodContaining('2026-09-13', rule)
        expect(p1.start).toBe('2026-08-26')
        expect(p1.end).toBe('2026-09-25')

        const p2 = getPeriodContaining('2026-09-26', rule)
        expect(p2.start).toBe('2026-09-26')
        expect(p2.end).toBe('2026-10-25')

        const periods = generatePeriods(rule, '2026-01-01', 3)
        expect(periods[0]).toEqual({
            start: '2025-12-26',
            end: '2026-01-25',
            label: '26 Dec 2025 – 25 Jan 2026',
        })
        expect(periods[1]).toEqual({
            start: '2026-01-26',
            end: '2026-02-25',
            label: '26 Jan 2026 – 25 Feb 2026',
        })
        expect(periods[2]).toEqual({
            start: '2026-02-26',
            end: '2026-03-25',
            label: '26 Feb 2026 – 25 Mar 2026',
        })
    })

    it('handles 31st anchor with deterministic month-end fallback in non-leap and leap February', () => {
        const rule: PayrollCycleRule = { type: 'monthly', anchorDay: 31 }

        // Non-leap year 2027:
        // Jan boundary: 2027-01-31
        // Feb boundary: 2027-02-28 (fallback because 31 does not exist in Feb)
        // Mar boundary: 2027-03-31
        // Apr boundary: 2027-04-30 (fallback)
        const periods2027 = generatePeriods(rule, '2027-01-31', 4)
        expect(periods2027[0]).toEqual({
            start: '2027-01-31',
            end: '2027-02-27',
            label: '31 Jan 2027 – 27 Feb 2027',
        })
        expect(periods2027[1]).toEqual({
            start: '2027-02-28',
            end: '2027-03-30',
            label: '28 Feb 2027 – 30 Mar 2027',
        })
        expect(periods2027[2]).toEqual({
            start: '2027-03-31',
            end: '2027-04-29',
            label: '31 Mar 2027 – 29 Apr 2027',
        })
        expect(periods2027[3]).toEqual({
            start: '2027-04-30',
            end: '2027-05-30',
            label: '30 Apr 2027 – 30 May 2027',
        })

        // Leap year 2028: Feb has 29 days
        const periods2028 = generatePeriods(rule, '2028-01-31', 2)
        expect(periods2028[0]).toEqual({
            start: '2028-01-31',
            end: '2028-02-28',
            label: '31 Jan 2028 – 28 Feb 2028',
        })
        expect(periods2028[1]).toEqual({
            start: '2028-02-29',
            end: '2028-03-30',
            label: '29 Feb 2028 – 30 Mar 2028',
        })
    })
})

describe('PayrollCycleEngine — Weekly Schedule', () => {
    it('generates Monday–Sunday periods', () => {
        const rule: PayrollCycleRule = { type: 'weekly', anchorWeekday: 'monday' }
        // 2026-09-07 is a Monday
        const periods = generatePeriods(rule, '2026-09-07', 3)
        expect(periods[0]).toEqual({
            start: '2026-09-07',
            end: '2026-09-13',
            label: '7 Sep 2026 – 13 Sep 2026',
        })
        expect(periods[1]).toEqual({
            start: '2026-09-14',
            end: '2026-09-20',
            label: '14 Sep 2026 – 20 Sep 2026',
        })
        expect(periods[2]).toEqual({
            start: '2026-09-21',
            end: '2026-09-27',
            label: '21 Sep 2026 – 27 Sep 2026',
        })
    })

    it('finds correct weekly period for mid-week dates', () => {
        const rule: PayrollCycleRule = { type: 'weekly', anchorWeekday: 'monday' }
        // 2026-09-10 is a Thursday
        const period = getPeriodContaining('2026-09-10', rule)
        expect(period.start).toBe('2026-09-07')
        expect(period.end).toBe('2026-09-13')
    })
})

describe('PayrollCycleEngine — Every N Days (e.g. 24-Day Cycle)', () => {
    it('generates sequential 24-day periods from 1 Sep 2026 without gaps', () => {
        const rule: PayrollCycleRule = {
            type: 'interval_days',
            interval: 24,
            anchorDate: '2026-09-01',
        }
        const periods = generatePeriods(rule, '2026-09-01', 4)

        expect(periods[0]).toEqual({
            start: '2026-09-01',
            end: '2026-09-24',
            label: '1 Sep 2026 – 24 Sep 2026',
        })
        expect(periods[1]).toEqual({
            start: '2026-09-25',
            end: '2026-10-18',
            label: '25 Sep 2026 – 18 Oct 2026',
        })
        expect(periods[2]).toEqual({
            start: '2026-10-19',
            end: '2026-11-11',
            label: '19 Oct 2026 – 11 Nov 2026',
        })
        expect(periods[3]).toEqual({
            start: '2026-11-12',
            end: '2026-12-05',
            label: '12 Nov 2026 – 5 Dec 2026',
        })
    })

    it('generates 20 sequential 24-day periods and preserves continuity throughout', () => {
        const rule: PayrollCycleRule = {
            type: 'interval_days',
            interval: 24,
            anchorDate: '2026-09-01',
        }
        const periods = generatePeriods(rule, '2026-09-01', 20)
        expect(periods).toHaveLength(20)

        for (let i = 0; i < periods.length - 1; i++) {
            const current = periods[i]
            const next = periods[i + 1]
            expect(addDays(current.end, 1)).toBe(next.start)
            expect(diffInDays(current.end, current.start)).toBe(23) // 24 inclusive days
        }
    })
})

describe('PayrollCycleEngine — Every N Weeks (Biweekly)', () => {
    it('generates 2-week periods starting Monday 7 Sep 2026', () => {
        const rule: PayrollCycleRule = {
            type: 'interval_weeks',
            interval: 2,
            anchorDate: '2026-09-07',
        }
        const periods = generatePeriods(rule, '2026-09-07', 3)

        expect(periods[0]).toEqual({
            start: '2026-09-07',
            end: '2026-09-20',
            label: '7 Sep 2026 – 20 Sep 2026',
        })
        expect(periods[1]).toEqual({
            start: '2026-09-21',
            end: '2026-10-04',
            label: '21 Sep 2026 – 4 Oct 2026',
        })
        expect(periods[2]).toEqual({
            start: '2026-10-05',
            end: '2026-10-18',
            label: '5 Oct 2026 – 18 Oct 2026',
        })
    })
})

describe('PayrollCycleEngine — Twice Monthly / Semi-Monthly', () => {
    it('generates 1st and 16th semi-monthly periods', () => {
        const rule: PayrollCycleRule = {
            type: 'semi_monthly',
            firstBoundary: 1,
            secondBoundary: 16,
        }
        const periods = generatePeriods(rule, '2026-09-01', 4)

        expect(periods[0]).toEqual({
            start: '2026-09-01',
            end: '2026-09-15',
            label: '1 Sep 2026 – 15 Sep 2026',
        })
        expect(periods[1]).toEqual({
            start: '2026-09-16',
            end: '2026-09-30',
            label: '16 Sep 2026 – 30 Sep 2026',
        })
        expect(periods[2]).toEqual({
            start: '2026-10-01',
            end: '2026-10-15',
            label: '1 Oct 2026 – 15 Oct 2026',
        })
        expect(periods[3]).toEqual({
            start: '2026-10-16',
            end: '2026-10-31',
            label: '16 Oct 2026 – 31 Oct 2026',
        })
    })

    it('generates custom 5th and 20th semi-monthly periods', () => {
        const rule: PayrollCycleRule = {
            type: 'semi_monthly',
            firstBoundary: 5,
            secondBoundary: 20,
        }
        const periods = generatePeriods(rule, '2026-09-05', 4)

        expect(periods[0]).toEqual({
            start: '2026-09-05',
            end: '2026-09-19',
            label: '5 Sep 2026 – 19 Sep 2026',
        })
        expect(periods[1]).toEqual({
            start: '2026-09-20',
            end: '2026-10-04',
            label: '20 Sep 2026 – 4 Oct 2026',
        })
        expect(periods[2]).toEqual({
            start: '2026-10-05',
            end: '2026-10-19',
            label: '5 Oct 2026 – 19 Oct 2026',
        })
        expect(periods[3]).toEqual({
            start: '2026-10-20',
            end: '2026-11-04',
            label: '20 Oct 2026 – 4 Nov 2026',
        })
    })
})

describe('PayrollCycleEngine — Invariant & Property-Based Checks', () => {
    const testRules: PayrollCycleRule[] = [
        { type: 'monthly', anchorDay: 1 },
        { type: 'monthly', anchorDay: 26 },
        { type: 'monthly', anchorDay: 31 },
        { type: 'weekly', anchorWeekday: 'monday' },
        { type: 'weekly', anchorWeekday: 'friday' },
        { type: 'interval_days', interval: 24, anchorDate: '2026-09-01' },
        { type: 'interval_days', interval: 10, anchorDate: '2026-01-01' },
        { type: 'interval_weeks', interval: 2, anchorDate: '2026-09-07' },
        { type: 'semi_monthly', firstBoundary: 1, secondBoundary: 16 },
        { type: 'semi_monthly', firstBoundary: 10, secondBoundary: 25 },
    ]

    for (const rule of testRules) {
        it(`guarantees no gaps, no overlaps, and positive duration for ${rule.type}`, () => {
            const periods = generatePeriods(rule, '2026-01-01', 30)
            expect(periods.length).toBe(30)

            for (let i = 0; i < periods.length - 1; i++) {
                const current = periods[i]
                const next = periods[i + 1]

                // Positive duration
                expect(current.end >= current.start).toBe(true)

                // No overlap
                expect(current.end < next.start).toBe(true)

                // No gap
                expect(addDays(current.end, 1)).toBe(next.start)
            }
        })

        it(`ensures every sample date belongs to exactly one period for ${rule.type}`, () => {
            const testDates = [
                '2026-01-01', '2026-02-14', '2026-02-28', '2026-03-01', '2026-04-15',
                '2026-08-26', '2026-09-13', '2026-10-31', '2026-12-31', '2027-01-01',
                '2028-02-29', '2028-03-01',
            ]

            for (const date of testDates) {
                const period = getPeriodContaining(date, rule)
                expect(date >= period.start).toBe(true)
                expect(date <= period.end).toBe(true)

                // Previous boundary check
                const prevB = getPreviousBoundary(period.start, rule)
                expect(prevB < period.start).toBe(true)

                // Next boundary check
                const nextB = getNextBoundary(period.start, rule)
                expect(nextB > period.start).toBe(true)
                expect(addDays(nextB, -1)).toBe(period.end)
            }
        })
    }
})

describe('PayrollCycleEngine — UI Explanations & Previews', () => {
    it('generates friendly explanations for each cycle type', () => {
        expect(formatCycleExplanation({ type: 'monthly', anchorDay: 1 })).toBe(
            'Payroll runs monthly from the 1st to the final day of each calendar month.'
        )
        expect(formatCycleExplanation({ type: 'monthly', anchorDay: 26 })).toBe(
            'Payroll runs monthly, beginning on the 26th of each month.'
        )
        expect(formatCycleExplanation({ type: 'monthly', anchorDay: 31 })).toBe(
            'Payroll runs monthly, beginning on the 31st of each month (for shorter months, Weavly uses the final day of the month).'
        )
        expect(formatCycleExplanation({ type: 'weekly', anchorWeekday: 'monday' })).toBe(
            'Payroll repeats weekly, beginning every Monday.'
        )
        expect(formatCycleExplanation({ type: 'interval_days', interval: 24, anchorDate: '2026-09-01' })).toBe(
            'Payroll repeats every 24 days beginning 1 Sep 2026.'
        )
        expect(formatCycleExplanation({ type: 'interval_weeks', interval: 2, anchorDate: '2026-09-07' })).toBe(
            'Payroll repeats every 2 weeks beginning Monday, 7 Sep 2026.'
        )
        expect(formatCycleExplanation({ type: 'semi_monthly', firstBoundary: 1, secondBoundary: 16 })).toBe(
            'Payroll periods begin on the 1st and 16th of each month.'
        )
    })

    it('generates preview periods for UI', () => {
        const preview = previewPeriods({ type: 'monthly', anchorDay: 26 }, '2026-09-01', 4)
        expect(preview).toHaveLength(4)
        expect(preview[0].start).toBe('2026-08-26')
        expect(preview[0].end).toBe('2026-09-25')
        expect(preview[1].start).toBe('2026-09-26')
        expect(preview[1].end).toBe('2026-10-25')
    })
})

describe('PayrollCycleEngine — Safe Effective Date & Active Payroll Protection', () => {
    it('protects settled and in-progress periods from being truncated', () => {
        const result = getEarliestSafeCycleChangeDate({
            protectedPeriods: [
                {
                    period_start: '2026-08-01',
                    period_end: '2026-08-31',
                    status: 'settled',
                    paid_workers: 14,
                },
                {
                    period_start: '2026-09-01',
                    period_end: '2026-09-30',
                    status: 'in_progress',
                    paid_workers: 7,
                },
            ],
            today: '2026-09-13',
            currentRule: { type: 'monthly', anchorDay: 1 },
        })

        expect(result.safeEffectiveDate).toBe('2026-10-01')
        expect(result.protectedPeriodEnd).toBe('2026-09-30')
        expect(result.reason).toContain('30 Sep 2026')
    })

    it('defaults to next cycle start when no protected periods exist', () => {
        const result = getEarliestSafeCycleChangeDate({
            protectedPeriods: [],
            today: '2026-09-13',
            currentRule: { type: 'monthly', anchorDay: 1 },
        })

        expect(result.safeEffectiveDate).toBe('2026-10-01')
        expect(result.protectedPeriodEnd).toBe('2026-09-30')
    })

    it('calculates safe effective date when current cycle is 26th-anchored', () => {
        const result = getEarliestSafeCycleChangeDate({
            protectedPeriods: [],
            today: '2026-09-13',
            currentRule: { type: 'monthly', anchorDay: 26 },
        })

        // On 13 Sep 2026 with 26th anchor, current period is 26 Aug -> 25 Sep
        // Next period begins 26 Sep
        expect(result.safeEffectiveDate).toBe('2026-09-26')
        expect(result.protectedPeriodEnd).toBe('2026-09-25')
    })
})
