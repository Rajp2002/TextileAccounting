import { describe, expect, it } from 'vitest'

import {
    calculateBaseProductionDay,
    compareBaseProductionDays,
    formatBaseMeters,
    getBasePreviousDate,
    metersOutsideBaseJobs,
} from '../lib/base-production-analytics'
import type {
    BaseProductionAllocation,
    BaseProductionBatch,
    BaseProductionEntry,
} from '../lib/base-production-core'

const TODAY = '2026-10-08'
const YESTERDAY = '2026-10-07'

function entry(overrides: Partial<BaseProductionEntry> = {}): BaseProductionEntry {
    return {
        id: 'entry-1',
        job_id: '',
        worker_id: 'worker-1',
        production_date: TODAY,
        meters: 0,
        worker_rate_snapshot: 8,
        notes: null,
        created_at: `${TODAY}T10:00:00.000Z`,
        batch_id: 'batch-day',
        shift: 'day',
        entry_status: 'entered',
        allocation_mode: 'machine_breakdown',
        ...overrides,
    }
}

function allocation(overrides: Partial<BaseProductionAllocation> = {}): BaseProductionAllocation {
    return {
        id: 'alloc-1',
        entry_id: 'entry-1',
        worker_id: 'worker-1',
        assignment_id: null,
        machine_id: 'machine-1',
        job_id: 'job-1',
        meters: 100,
        worker_rate_snapshot: 8,
        machine_label: 'Loom 1',
        job_label: 'Quality A',
        assignment_snapshot: {},
        created_at: `${TODAY}T10:00:00.000Z`,
        ...overrides,
    }
}

function batch(overrides: Partial<BaseProductionBatch> = {}): BaseProductionBatch {
    return {
        id: 'batch-day',
        production_date: TODAY,
        shift: 'day',
        status: 'saved',
        client_request_id: 'request-1',
        created_at: `${TODAY}T10:00:00.000Z`,
        updated_at: `${TODAY}T10:00:00.000Z`,
        ...overrides,
    }
}

describe('calculateBaseProductionDay', () => {
    it('totals the day across looms and splits it by quality', () => {
        const day = calculateBaseProductionDay({
            date: TODAY,
            entries: [entry({ id: 'entry-1' }), entry({ id: 'entry-2', worker_id: 'worker-2' })],
            allocations: [
                allocation({ id: 'a1', entry_id: 'entry-1', machine_id: 'machine-1', job_id: 'job-1', meters: 120.5 }),
                allocation({ id: 'a2', entry_id: 'entry-1', machine_id: 'machine-2', job_id: 'job-1', meters: 80 }),
                allocation({ id: 'a3', entry_id: 'entry-2', machine_id: 'machine-3', job_id: 'job-2', meters: 60 }),
            ],
            batches: [batch()],
        })

        expect(day.totalMeters).toBe(260.5)
        expect(day.metersByJobId.get('job-1')).toBe(200.5)
        expect(day.metersByJobId.get('job-2')).toBe(60)
    })

    it('ignores production saved for other dates', () => {
        const day = calculateBaseProductionDay({
            date: TODAY,
            entries: [
                entry({ id: 'entry-today' }),
                entry({ id: 'entry-yesterday', production_date: YESTERDAY, batch_id: 'batch-old' }),
            ],
            allocations: [
                allocation({ id: 'a1', entry_id: 'entry-today', meters: 90 }),
                allocation({ id: 'a2', entry_id: 'entry-yesterday', meters: 500 }),
            ],
            batches: [batch(), batch({ id: 'batch-old', production_date: YESTERDAY })],
        })

        expect(day.totalMeters).toBe(90)
    })

    it('attributes metres once, the way job progress does', () => {
        // A machine_breakdown entry carries no job of its own: its metres live in its allocations.
        // A legacy entry names its job directly and has no allocations.
        const day = calculateBaseProductionDay({
            date: TODAY,
            entries: [
                entry({ id: 'entry-new', job_id: '', meters: 100, allocation_mode: 'machine_breakdown' }),
                entry({ id: 'entry-legacy', job_id: 'job-2', meters: 40, allocation_mode: 'worker_total', batch_id: null }),
            ],
            allocations: [allocation({ entry_id: 'entry-new', job_id: 'job-1', meters: 100 })],
            batches: [batch()],
        })

        expect(day.totalMeters).toBe(140)
        expect(day.metersByJobId.get('job-1')).toBe(100)
        expect(day.metersByJobId.get('job-2')).toBe(40)
    })

    it('adds decimal metres exactly and ignores zero or negative readings', () => {
        const day = calculateBaseProductionDay({
            date: TODAY,
            entries: [entry()],
            allocations: [
                allocation({ id: 'a1', meters: 0.1 }),
                allocation({ id: 'a2', meters: 0.2 }),
                allocation({ id: 'a3', meters: 0 }),
                allocation({ id: 'a4', meters: -5 }),
            ],
            batches: [batch()],
        })

        expect(day.totalMeters).toBe(0.3)
    })

    it('tells an unsaved day apart from a saved day with zero metres', () => {
        const unsaved = calculateBaseProductionDay({ date: TODAY, entries: [], allocations: [], batches: [] })
        expect(unsaved.hasSavedSheet).toBe(false)
        expect(unsaved.savedShifts).toEqual({ day: false, night: false })
        expect(unsaved.totalMeters).toBe(0)

        const allIdle = calculateBaseProductionDay({
            date: TODAY,
            entries: [entry({ entry_status: 'zero' })],
            allocations: [],
            batches: [batch()],
        })
        expect(allIdle.hasSavedSheet).toBe(true)
        expect(allIdle.totalMeters).toBe(0)
    })

    it('counts a day that only has legacy entries as saved', () => {
        const day = calculateBaseProductionDay({
            date: TODAY,
            entries: [entry({ id: 'entry-legacy', job_id: 'job-1', meters: 75, allocation_mode: 'worker_total', batch_id: null })],
            allocations: [],
            batches: [],
        })

        expect(day.totalMeters).toBe(75)
        expect(day.hasSavedSheet).toBe(true)
    })

    it('reports which shifts are saved for the date only', () => {
        const day = calculateBaseProductionDay({
            date: TODAY,
            entries: [],
            allocations: [],
            batches: [
                batch({ id: 'b-day', shift: 'day' }),
                batch({ id: 'b-old-night', shift: 'night', production_date: YESTERDAY }),
            ],
        })

        expect(day.savedShifts).toEqual({ day: true, night: false })
    })
})

describe('compareBaseProductionDays', () => {
    const saved = (totalMeters: number, shifts: { day: boolean; night: boolean }) => ({
        date: TODAY,
        totalMeters,
        metersByJobId: new Map<string, number>(),
        savedShifts: shifts,
        hasSavedSheet: shifts.day || shifts.night,
    })

    it('reports the change against yesterday once today covers the same shifts', () => {
        const comparison = compareBaseProductionDays(
            saved(1240, { day: true, night: true }),
            saved(1180, { day: true, night: true }),
        )

        expect(comparison).toEqual({ previousMeters: 1180, deltaMeters: 60, deltaPercent: 5.1, comparable: true })
    })

    it('shows a drop as a negative change', () => {
        const comparison = compareBaseProductionDays(
            saved(900, { day: true, night: true }),
            saved(1200, { day: true, night: true }),
        )

        expect(comparison).toMatchObject({ deltaMeters: -300, deltaPercent: -25, comparable: true })
    })

    it('does not call a half-entered day a drop', () => {
        const comparison = compareBaseProductionDays(
            saved(600, { day: true, night: false }),
            saved(1200, { day: true, night: true }),
        )

        expect(comparison).toMatchObject({ previousMeters: 1200, comparable: false })
    })

    it('has no comparison when yesterday was never entered', () => {
        expect(compareBaseProductionDays(
            saved(600, { day: true, night: false }),
            saved(0, { day: false, night: false }),
        )).toBeNull()
    })

    it('omits the percentage when yesterday produced nothing', () => {
        const comparison = compareBaseProductionDays(
            saved(300, { day: true, night: false }),
            saved(0, { day: true, night: false }),
        )

        expect(comparison).toMatchObject({ deltaMeters: 300, deltaPercent: null, comparable: true })
    })
})

describe('getBasePreviousDate', () => {
    it.each([
        ['2026-10-08', '2026-10-07'],
        ['2026-10-01', '2026-09-30'],
        ['2026-01-01', '2025-12-31'],
        ['2028-03-01', '2028-02-29'],
    ])('steps %s back to %s', (date, expected) => {
        expect(getBasePreviousDate(date)).toBe(expected)
    })
})

describe('metersOutsideBaseJobs', () => {
    it('reports metres produced on qualities that are no longer active', () => {
        const day = calculateBaseProductionDay({
            date: TODAY,
            entries: [entry()],
            allocations: [
                allocation({ id: 'a1', job_id: 'job-1', meters: 100.1 }),
                allocation({ id: 'a2', job_id: 'job-retired', meters: 40.2 }),
            ],
            batches: [batch()],
        })

        expect(metersOutsideBaseJobs(day, ['job-1'])).toBe(40.2)
        expect(metersOutsideBaseJobs(day, ['job-1', 'job-retired'])).toBe(0)
    })
})

describe('formatBaseMeters', () => {
    it('groups digits the Indian way and trims trailing zeros', () => {
        expect(formatBaseMeters(1240)).toBe('1,240 m')
        expect(formatBaseMeters(123456.5)).toBe('1,23,456.5 m')
        expect(formatBaseMeters(0)).toBe('0 m')
    })
})
