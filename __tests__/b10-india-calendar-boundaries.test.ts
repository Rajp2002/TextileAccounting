import { describe, expect, it } from 'vitest'
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
})
