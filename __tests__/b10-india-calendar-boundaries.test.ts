import { describe, expect, it } from 'vitest'
import {
    getCycleBoundsForDate,
    getPayrollCycleBounds,
    getPayrollCycleDetails,
} from '../lib/payroll-cycle'
import { getSuratMonthToDateBounds } from '../lib/time'

describe('B10 India calendar boundaries', () => {
    it('switches commercial month-to-date at India midnight, not UTC midnight', () => {
        expect(getSuratMonthToDateBounds('2026-12-31T17:00:00.000Z')).toEqual({
            start: '2026-12-01',
            end: '2026-12-31',
        })
        expect(getSuratMonthToDateBounds('2026-12-31T18:30:00.000Z')).toEqual({
            start: '2027-01-01',
            end: '2027-01-01',
        })
    })

    it('retains leap day until India midnight', () => {
        expect(getSuratMonthToDateBounds('2024-02-29T18:29:59.999Z')).toEqual({
            start: '2024-02-01',
            end: '2024-02-29',
        })
        expect(getSuratMonthToDateBounds('2024-02-29T18:30:00.000Z')).toEqual({
            start: '2024-03-01',
            end: '2024-03-01',
        })
    })

    it('classifies year-crossing payroll cycles exactly', () => {
        expect(getPayrollCycleBounds('2023-12', 15)).toEqual({
            cycle_start: '2023-12-15',
            cycle_end: '2024-01-14',
            next_cycle_start: '2024-01-15',
        })
        expect(getPayrollCycleDetails('2023-12', 15, 10).pay_date).toBe('2024-02-10')
    })

    it('includes leap day in both full-month and mid-month payroll cycles', () => {
        expect(getPayrollCycleBounds('2024-02', 1).cycle_end).toBe('2024-02-29')
        expect(getCycleBoundsForDate('2024-02-29', 15)).toEqual({
            cycle_start: '2024-02-15',
            cycle_end: '2024-03-14',
            next_cycle_start: '2024-03-15',
        })
    })
})
