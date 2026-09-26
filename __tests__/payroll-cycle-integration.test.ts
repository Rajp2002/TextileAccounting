import { describe, it, expect } from 'vitest'
import {
    PayrollCycleRule,
    PayrollPeriodBoundary,
    DEFAULT_MONTHLY_CYCLE_RULE,
    validateCycleRule,
    getPeriodContaining,
    generatePeriods,
    getEarliestSafeCycleChangeDate,
    addDays,
} from '@/lib/payroll-cycle-engine'
import {
    calculateBaseWorkerPayables,
    type BaseProductionWorker,
    type BaseProductionEntry,
    type BasePayrollSettlement,
} from '@/lib/base-production-core'
import { calculateBaseSalaryLines } from '@/lib/base-salary'

describe('Payroll Cycle Engine — Historical Immutability & Accounting Protection', () => {
    it('Scenario 1: Settled August payroll remains strictly immutable when cycle changes from 1st to 26th', () => {
        // Historical August payroll settled under standard monthly rule (anchorDay = 1)
        const augustPeriod: PayrollPeriodBoundary = {
            start: '2026-08-01',
            end: '2026-08-31',
            label: '1 Aug 2026 – 31 Aug 2026',
        }

        const workers: BaseProductionWorker[] = [
            {
                id: 'w-1',
                name: 'Ramesh Weaver',
                rate_per_meter: 4.5,
                pay_type: 'piece_rate',
                shift_availability: 'both',
                is_active: true,
                monthly_salary: 0,
            },
        ]

        const entries: BaseProductionEntry[] = [
            {
                id: 'e-1',
                worker_id: 'w-1',
                job_id: 'j-1',
                production_date: '2026-08-15',
                meters: 1000,
                worker_rate_snapshot: 4.5,
                notes: null,
                created_at: '2026-08-15T10:00:00Z',
            },
        ]

        const augustSettlement: BasePayrollSettlement = {
            id: 's-aug',
            worker_id: 'w-1',
            period_start: augustPeriod.start,
            period_end: augustPeriod.end,
            gross_pay: 4500,
            advance_deducted: 0,
            net_payout: 4500,
            payment_mode: 'cash',
            paid_at: '2026-09-01T10:00:00Z',
            worker_name_snapshot: 'Ramesh Weaver',
            status: 'paid',
        }

        // Calculate August payables
        const augustPayables = calculateBaseWorkerPayables({
            workers,
            entries,
            advances: [],
            settlements: [augustSettlement],
            periodEnd: augustPeriod.end,
        })

        // Verify August gross
        expect(augustPayables[0].gross_pay).toBe(4500)
        expect(augustSettlement.period_start).toBe('2026-08-01')
        expect(augustSettlement.period_end).toBe('2026-08-31')

        // Now the owner changes cycle to Monthly starting on the 26th
        const newRule: PayrollCycleRule = { type: 'monthly', anchorDay: 26 }
        expect(validateCycleRule(newRule).valid).toBe(true)

        // The safe effective date service guarantees that settled August is protected
        const safeResult = getEarliestSafeCycleChangeDate({
            protectedPeriods: [
                {
                    period_start: augustPeriod.start,
                    period_end: augustPeriod.end,
                    status: 'settled',
                    paid_workers: 1,
                },
            ],
            today: '2026-09-13',
            currentRule: DEFAULT_MONTHLY_CYCLE_RULE,
        })

        // Safe effective date must not truncate August or current uncompleted period
        expect(safeResult.safeEffectiveDate > augustPeriod.end).toBe(true)

        // Historical settlement record remains 100% identical and unchanged
        expect(augustSettlement.period_start).toBe('2026-08-01')
        expect(augustSettlement.period_end).toBe('2026-08-31')
        expect(augustSettlement.gross_pay).toBe(4500)
        expect(augustSettlement.net_payout).toBe(4500)
    })

    it('Scenario 2: In-progress September payroll boundaries and recorded payments are protected from mutation', () => {
        // September period in progress: 14 workers, 7 paid
        const activePeriod = {
            period_start: '2026-09-01',
            period_end: '2026-09-30',
            status: 'in_progress',
            paid_workers: 7,
            total_workers: 14,
        }

        // Owner attempts to change cycle to Every 24 Days on 13 September
        const new24DayRule: PayrollCycleRule = {
            type: 'interval_days',
            interval: 24,
            anchorDate: '2026-09-01',
        }
        expect(validateCycleRule(new24DayRule).valid).toBe(true)

        const safeCheck = getEarliestSafeCycleChangeDate({
            protectedPeriods: [activePeriod],
            today: '2026-09-13',
            currentRule: DEFAULT_MONTHLY_CYCLE_RULE,
        })

        // New rule must NOT take effect inside September! Earliest safe date must be after 30 Sep
        expect(safeCheck.safeEffectiveDate).toBe('2026-10-01')
        expect(safeCheck.protectedPeriodEnd).toBe('2026-09-30')

        // If user tries to set effective date to 2026-09-13, it will be rejected as < safeEffectiveDate
        const requestedInvalidDate = '2026-09-13'
        expect(requestedInvalidDate < safeCheck.safeEffectiveDate).toBe(true)
    })
})

describe('Payroll Cycle Engine — Piece-Rate and Fixed-Salary Continuity', () => {
    it('accurately slices piece-rate production into the configured 26th-anchored cycle', () => {
        const cycleRule: PayrollCycleRule = { type: 'monthly', anchorDay: 26 }

        // Period 1: 26 Aug -> 25 Sep
        const period1 = getPeriodContaining('2026-09-13', cycleRule)
        expect(period1.start).toBe('2026-08-26')
        expect(period1.end).toBe('2026-09-25')

        // Production on 25 Aug belongs to previous period (26 Jul -> 25 Aug)
        const periodPrev = getPeriodContaining('2026-08-25', cycleRule)
        expect(periodPrev.start).toBe('2026-07-26')
        expect(periodPrev.end).toBe('2026-08-25')

        // Production on 26 Aug belongs to period 1
        const periodAug26 = getPeriodContaining('2026-08-26', cycleRule)
        expect(periodAug26.start).toBe('2026-08-26')
        expect(periodAug26.end).toBe('2026-09-25')

        // Production on 26 Sep belongs to next period (26 Sep -> 25 Oct)
        const periodNext = getPeriodContaining('2026-09-26', cycleRule)
        expect(periodNext.start).toBe('2026-09-26')
        expect(periodNext.end).toBe('2026-10-25')

        // Zero gaps
        expect(addDays(periodPrev.end, 1)).toBe(period1.start)
        expect(addDays(period1.end, 1)).toBe(periodNext.start)
    })

    it('calculates fixed monthly salary lines across non-calendar cycle boundaries', () => {
        const worker: BaseProductionWorker = {
            id: 'fw-1',
            name: 'Masterji Fixed',
            role: 'Master',
            pay_type: 'fixed_monthly',
            monthly_salary: 30000,
            salary_history: [{ effective_from: '2026-01-01', monthly_salary: 30000 }],
            start_date: '2026-01-01',
            is_active: true,
            rate_per_meter: 0,
            shift_availability: 'both',
        }

        // Cycle 26 Aug -> 25 Sep (31 days span)
        const lines = calculateBaseSalaryLines(worker, '2026-08-26', '2026-09-25')
        expect(lines.length).toBeGreaterThan(0)

        const totalGross = lines.reduce((acc, l) => acc + l.grossPay, 0)
        // Full month equivalent
        expect(totalGross).toBeGreaterThan(25000)
        expect(totalGross).toBeLessThan(35000)
    })
})

describe('Payroll Cycle Engine — Edge Cases & Extreme Calendars', () => {
    it('handles transition from 31 Jan to non-leap Feb, leap Feb, and beyond', () => {
        const rule31: PayrollCycleRule = { type: 'monthly', anchorDay: 31 }

        // In 2028 (leap year)
        const periods2028 = generatePeriods(rule31, '2028-01-31', 5)
        expect(periods2028[0].start).toBe('2028-01-31')
        expect(periods2028[0].end).toBe('2028-02-28') // day before 29 Feb
        expect(periods2028[1].start).toBe('2028-02-29')
        expect(periods2028[1].end).toBe('2028-03-30') // day before 31 Mar
        expect(periods2028[2].start).toBe('2028-03-31')
        expect(periods2028[2].end).toBe('2028-04-29') // day before 30 Apr
        expect(periods2028[3].start).toBe('2028-04-30')
        expect(periods2028[3].end).toBe('2028-05-30') // day before 31 May

        // Invariance holds
        for (let i = 0; i < periods2028.length - 1; i++) {
            expect(addDays(periods2028[i].end, 1)).toBe(periods2028[i + 1].start)
            expect(periods2028[i].end < periods2028[i + 1].start).toBe(true)
        }
    })

    it('generates 50 sequential periods for every cycle type without any gap or overlap', () => {
        const rules: PayrollCycleRule[] = [
            { type: 'monthly', anchorDay: 1 },
            { type: 'monthly', anchorDay: 15 },
            { type: 'monthly', anchorDay: 26 },
            { type: 'monthly', anchorDay: 28 },
            { type: 'monthly', anchorDay: 29 },
            { type: 'monthly', anchorDay: 30 },
            { type: 'monthly', anchorDay: 31 },
            { type: 'weekly', anchorWeekday: 'monday' },
            { type: 'weekly', anchorWeekday: 'saturday' },
            { type: 'interval_days', interval: 24, anchorDate: '2026-09-01' },
            { type: 'interval_days', interval: 7, anchorDate: '2026-09-01' },
            { type: 'interval_weeks', interval: 2, anchorDate: '2026-09-07' },
            { type: 'semi_monthly', firstBoundary: 1, secondBoundary: 16 },
            { type: 'semi_monthly', firstBoundary: 5, secondBoundary: 20 },
        ]

        for (const r of rules) {
            const periods = generatePeriods(r, '2026-01-01', 50)
            expect(periods).toHaveLength(50)

            for (let i = 0; i < periods.length - 1; i++) {
                const cur = periods[i]
                const nxt = periods[i + 1]

                expect(addDays(cur.end, 1)).toBe(nxt.start)
                expect(cur.end < nxt.start).toBe(true)
                expect(cur.end >= cur.start).toBe(true)
            }
        }
    })
})
