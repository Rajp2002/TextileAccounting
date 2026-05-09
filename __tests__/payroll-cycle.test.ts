import { describe, it, expect } from 'vitest'
import { getPayrollCycleBounds, getCycleBoundsForDate } from '../lib/payroll-cycle'

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
})
