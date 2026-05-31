import { describe, it, expect } from 'vitest'
import {
    getCycleBoundsForDate,
    getLatestOpenPayrollMonth,
    getPreviousPayrollMonth,
    getPayrollCycleBounds,
    getPayrollCycleDetails,
    getPayrollCycleStatus,
    getPayrollPayDate,
} from '../lib/payroll-cycle'

describe('Payroll Cycle Helpers', () => {
    describe('getPayrollCycleBounds', () => {
        it('should return correct bounds for 15th start day', () => {
            const bounds = getPayrollCycleBounds('2026-05', 15)
            expect(bounds.cycle_start).toBe('2026-05-15')
            expect(bounds.cycle_end).toBe('2026-06-14')
            expect(bounds.next_cycle_start).toBe('2026-06-15')
        })

        it('should return correct bounds for 1st start day', () => {
            const bounds = getPayrollCycleBounds('2026-05', 1)
            expect(bounds.cycle_start).toBe('2026-05-01')
            expect(bounds.cycle_end).toBe('2026-05-31')
            expect(bounds.next_cycle_start).toBe('2026-06-01')
        })

        it('should throw error for invalid cycle start day (0)', () => {
            expect(() => getPayrollCycleBounds('2026-05', 0)).toThrow('Cycle start day must be between 1 and 28')
        })

        it('should throw error for invalid cycle start day (29)', () => {
            expect(() => getPayrollCycleBounds('2026-05', 29)).toThrow('Cycle start day must be between 1 and 28')
        })
    })

    describe('getCycleBoundsForDate', () => {
        it('should return correct bounds for date on or after cycle start', () => {
            const bounds = getCycleBoundsForDate('2026-05-20', 15)
            expect(bounds.cycle_start).toBe('2026-05-15')
            expect(bounds.cycle_end).toBe('2026-06-14')
        })

        it('should return correct bounds for date before cycle start', () => {
            const bounds = getCycleBoundsForDate('2026-05-10', 15)
            expect(bounds.cycle_start).toBe('2026-04-15')
            expect(bounds.cycle_end).toBe('2026-05-14')
        })

        it('should return correct bounds for 1st start day', () => {
            const bounds = getCycleBoundsForDate('2026-05-20', 1)
            expect(bounds.cycle_start).toBe('2026-05-01')
            expect(bounds.cycle_end).toBe('2026-05-31')
        })
    })

    describe('pay dates', () => {
        it('should pay month-end cycles on the configured day of the following month', () => {
            expect(getPayrollPayDate('2026-01-31', 10)).toBe('2026-02-10')
            expect(getPayrollPayDate('2026-02-28', 10)).toBe('2026-03-10')
            expect(getPayrollPayDate('2026-04-30', 10)).toBe('2026-05-10')
        })

        it('should pick the first configured pay day after a mid-month cycle closes', () => {
            const details = getPayrollCycleDetails('2026-01', 15, 10)

            expect(details.cycle_start).toBe('2026-01-15')
            expect(details.cycle_end).toBe('2026-02-14')
            expect(details.pay_date).toBe('2026-03-10')
        })

        it('should open the payroll window only near or after pay date', () => {
            expect(getPayrollCycleStatus('2026-01', 1, 10, '2026-02-06', 3).status).toBe('scheduled')
            expect(getPayrollCycleStatus('2026-01', 1, 10, '2026-02-07', 3).status).toBe('approaching')
            expect(getPayrollCycleStatus('2026-01', 1, 10, '2026-02-10', 3).status).toBe('due_today')
            expect(getPayrollCycleStatus('2026-01', 1, 10, '2026-02-12', 3).status).toBe('overdue')
        })

        it('should choose the latest open cycle when looking for a payable cycle', () => {
            expect(getLatestOpenPayrollMonth('2026-05-31', 1, 10, 3)).toBe('2026-04')
            expect(getLatestOpenPayrollMonth('2026-06-07', 1, 10, 3)).toBe('2026-05')
        })

        it('should derive the previous payroll month for the pay-date panel', () => {
            expect(getPreviousPayrollMonth('2026-06')).toBe('2026-05')
            expect(getPreviousPayrollMonth('2026-01')).toBe('2025-12')
        })

        it('should reject invalid pay date and reminder settings', () => {
            expect(() => getPayrollPayDate('2026-01-31', 0)).toThrow('Pay date day must be between 1 and 28')
            expect(() => getPayrollCycleStatus('2026-01', 1, 10, '2026-02-07', 15)).toThrow('Reminder days must be between 0 and 14')
        })
    })
})
