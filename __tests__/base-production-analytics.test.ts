import { describe, expect, it } from 'vitest'

import {
    calculateBaseProductionDay,
    compareBaseProductionDays,
    buildBaseLoomOutputRows,
    countBaseLoomsNotEntered,
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

    it('splits the day by loom as well', () => {
        const day = calculateBaseProductionDay({
            date: TODAY,
            entries: [
                entry({ id: 'entry-1' }),
                entry({ id: 'entry-legacy', job_id: 'job-2', meters: 40, machine_id: 'machine-3', allocation_mode: 'worker_total', batch_id: null }),
                entry({ id: 'entry-unplaced', job_id: 'job-2', meters: 25, machine_id: null, allocation_mode: 'worker_total', batch_id: null }),
            ],
            allocations: [
                allocation({ id: 'a1', entry_id: 'entry-1', machine_id: 'machine-1', meters: 120.5 }),
                allocation({ id: 'a2', entry_id: 'entry-1', machine_id: 'machine-2', meters: 80 }),
                allocation({ id: 'a3', entry_id: 'entry-1', machine_id: 'machine-1', meters: 10 }),
            ],
            batches: [batch()],
        })

        expect(day.metersByMachineId.get('machine-1')).toBe(130.5)
        expect(day.metersByMachineId.get('machine-2')).toBe(80)
        expect(day.metersByMachineId.get('machine-3')).toBe(40)
        // Metres with no loom still count in the total, just not against a loom.
        expect(day.totalMeters).toBe(120.5 + 80 + 10 + 40 + 25)
        expect(day.metersByMachineId.size).toBe(3)
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

    it('knows which looms were recorded, so a loom with no reading is not read as zero', () => {
        const record = (machine_id: string, state: 'entered' | 'pending' | 'not_running' | 'absent') => ({
            machine_id, worker_id: 'worker-1', machine_label: machine_id, job_id: null, job_label: null, state,
        })
        const day = calculateBaseProductionDay({
            date: TODAY,
            entries: [
                entry({ id: 'entry-1' }),
                entry({ id: 'entry-legacy-zero', entry_status: 'zero', machine_id: 'm6', allocation_mode: 'worker_total', batch_id: null }),
            ],
            allocations: [allocation({ entry_id: 'entry-1', machine_id: 'm1', meters: 100 })],
            batches: [
                batch({ machine_records: [record('m1', 'entered'), record('m2', 'not_running'), record('m3', 'pending'), record('m4', 'absent')] }),
                batch({ id: 'b-old', production_date: YESTERDAY, shift: 'night', machine_records: [record('m5', 'entered')] }),
            ],
        })

        // Loom 3 is pending, and Loom 5 was recorded on another day.
        expect([...day.recordedMachineIds].sort()).toEqual(['m1', 'm2', 'm4', 'm6'])
        expect(day.metersByMachineId.get('m2')).toBeUndefined()
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
        metersByMachineId: new Map<string, number>(),
        savedShifts: shifts,
        hasSavedSheet: shifts.day || shifts.night,
        recordedMachineIds: new Set<string>(),
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

describe('buildBaseLoomOutputRows', () => {
    const machine = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
        id, name, custom_label: null as string | null, is_active: true, ...overrides,
    })
    // A loom with output was recorded; `zero` lists looms recorded as not running.
    const dayOf = (date: string, byMachine: Record<string, number>, saved = true, zero: string[] = []) => ({
        date,
        totalMeters: Object.values(byMachine).reduce((sum, meters) => sum + meters, 0),
        metersByJobId: new Map<string, number>(),
        metersByMachineId: new Map(Object.entries(byMachine)),
        savedShifts: { day: saved, night: false },
        hasSavedSheet: saved,
        recordedMachineIds: new Set([...Object.keys(byMachine), ...zero]),
    })
    const jobs = new Map([['job-a', 'Quality A'], ['job-b', 'Quality B']])

    it('lists each running loom with its quality and both days', () => {
        const rows = buildBaseLoomOutputRows({
            machines: [machine('m1', 'Loom 1', { custom_label: 'North 1' })],
            runningJobIdByMachineId: new Map([['m1', 'job-a']]),
            jobLabelById: jobs,
            today: dayOf(TODAY, { m1: 150 }),
            yesterday: dayOf(YESTERDAY, { m1: 120 }),
        })

        expect(rows).toEqual([expect.objectContaining({
            machineId: 'm1', label: 'North 1', qualityLabel: 'Quality A',
            todayMeters: 150, yesterdayMeters: 120, deltaPercent: 25,
        })])
    })

    it('ranks by today once it is saved, and by yesterday before that', () => {
        const machines = [machine('m1', 'Loom 1'), machine('m2', 'Loom 2'), machine('m10', 'Loom 10')]
        const running = new Map([['m1', 'job-a'], ['m2', 'job-a'], ['m10', 'job-a']])

        const saved = buildBaseLoomOutputRows({
            machines, runningJobIdByMachineId: running, jobLabelById: jobs,
            today: dayOf(TODAY, { m1: 90, m2: 140, m10: 90 }),
            yesterday: dayOf(YESTERDAY, { m1: 200, m2: 100, m10: 100 }),
        })
        // Ties fall back to natural loom order, so Loom 2 does not sort after Loom 10.
        expect(saved.map(row => row.label)).toEqual(['Loom 2', 'Loom 1', 'Loom 10'])

        const unsaved = buildBaseLoomOutputRows({
            machines, runningJobIdByMachineId: running, jobLabelById: jobs,
            today: dayOf(TODAY, {}, false),
            yesterday: dayOf(YESTERDAY, { m1: 200, m2: 100, m10: 150 }),
        })
        expect(unsaved.map(row => row.label)).toEqual(['Loom 1', 'Loom 10', 'Loom 2'])
        expect(unsaved.every(row => row.todayMeters === 0)).toBe(true)
        // Without a saved sheet every loom would read as -100%, which is not a change.
        expect(unsaved.every(row => row.deltaPercent === null)).toBe(true)
    })

    it('leaves out inactive looms and idle looms that produced nothing', () => {
        const rows = buildBaseLoomOutputRows({
            machines: [
                machine('m1', 'Loom 1'),
                machine('m2', 'Loom 2', { is_active: false }),
                machine('m3', 'Loom 3'),
                machine('m4', 'Loom 4'),
            ],
            runningJobIdByMachineId: new Map([['m1', 'job-a']]),
            jobLabelById: jobs,
            today: dayOf(TODAY, { m1: 100, m2: 50, m4: 30 }),
            yesterday: dayOf(YESTERDAY, { m1: 100 }),
        })

        // Loom 3 is idle with no output; Loom 4 has no quality now but did produce today.
        expect(rows.map(row => row.label)).toEqual(['Loom 1', 'Loom 4'])
        expect(rows[1].qualityLabel).toBeNull()
    })

    it('compares each loom with its own yesterday, and omits the change when yesterday was nothing', () => {
        const rows = buildBaseLoomOutputRows({
            machines: [machine('m1', 'Loom 1'), machine('m2', 'Loom 2')],
            runningJobIdByMachineId: new Map([['m1', 'job-a'], ['m2', 'job-a']]),
            jobLabelById: jobs,
            today: dayOf(TODAY, { m1: 90, m2: 60 }),
            yesterday: dayOf(YESTERDAY, { m1: 120 }),
        })

        expect(rows.find(row => row.machineId === 'm1')?.deltaPercent).toBe(-25)
        expect(rows.find(row => row.machineId === 'm2')?.deltaPercent).toBeNull()
    })

    it('flags a loom below 75% of the average of looms on the same quality', () => {
        const rows = buildBaseLoomOutputRows({
            machines: [machine('m1', 'Loom 1'), machine('m2', 'Loom 2'), machine('m3', 'Loom 3'), machine('m4', 'Loom 4')],
            runningJobIdByMachineId: new Map([['m1', 'job-a'], ['m2', 'job-a'], ['m3', 'job-a'], ['m4', 'job-b']]),
            jobLabelById: jobs,
            // Quality A averages 110 m, so 82.5 m is the line; Quality B has a single loom.
            today: dayOf(TODAY, { m1: 150, m2: 80, m3: 100, m4: 20 }),
            yesterday: dayOf(YESTERDAY, {}),
        })
        const byId = Object.fromEntries(rows.map(row => [row.machineId, row]))

        expect(byId.m2.lagging).toBe(true)
        expect(byId.m1.lagging).toBe(false)
        expect(byId.m3.lagging).toBe(false)
        expect(byId.m2.peerAverage).toBe(110)
        // A quality's only loom has no peers to fall behind, however small its output.
        expect(byId.m4.lagging).toBe(false)
        expect(byId.m4.peerAverage).toBeNull()
    })

    it('tells a loom with no reading today apart from one that ran zero', () => {
        const rows = buildBaseLoomOutputRows({
            machines: [machine('m1', 'Loom 1'), machine('m2', 'Loom 2'), machine('m3', 'Loom 3')],
            runningJobIdByMachineId: new Map([['m1', 'job-a'], ['m2', 'job-a'], ['m3', 'job-a']]),
            jobLabelById: jobs,
            today: dayOf(TODAY, { m1: 100 }, true, ['m2']),
            yesterday: dayOf(YESTERDAY, { m1: 100, m2: 90, m3: 80 }),
        })
        const byId = Object.fromEntries(rows.map(row => [row.machineId, row]))

        expect(byId.m2).toMatchObject({ todayRecorded: true, todayMeters: 0, deltaPercent: -100 })
        // Loom 3 has no reading: it is not a -100% day, and it does not drag the quality average down.
        expect(byId.m3).toMatchObject({ todayRecorded: false, deltaPercent: null, lagging: false })
        expect(byId.m1.peerAverage).toBe(50)
        expect(byId.m2.lagging).toBe(true)
    })

    it('never flags a loom before today is entered', () => {
        const rows = buildBaseLoomOutputRows({
            machines: [machine('m1', 'Loom 1'), machine('m2', 'Loom 2')],
            runningJobIdByMachineId: new Map([['m1', 'job-a'], ['m2', 'job-a']]),
            jobLabelById: jobs,
            today: dayOf(TODAY, {}, false),
            yesterday: dayOf(YESTERDAY, { m1: 150, m2: 10 }),
        })

        expect(rows.every(row => !row.lagging && row.peerAverage === null)).toBe(true)
    })
})

describe('countBaseLoomsNotEntered', () => {
    const machines = [
        { id: 'm1', is_active: true }, { id: 'm2', is_active: true }, { id: 'm3', is_active: true },
        { id: 'm4', is_active: false }, { id: 'm5', is_active: true },
    ]
    const running = new Map([['m1', 'job-a'], ['m2', 'job-a'], ['m3', 'job-a'], ['m4', 'job-a']])
    const today = (recorded: string[], saved = true) => ({
        date: TODAY, totalMeters: 0, metersByJobId: new Map<string, number>(), metersByMachineId: new Map<string, number>(),
        savedShifts: { day: saved, night: false }, hasSavedSheet: saved, recordedMachineIds: new Set(recorded),
    })

    it('counts running looms with no reading once a sheet is saved today', () => {
        // Loom 2 ran zero, so it was entered; inactive Loom 4 and Loom 5 with no quality are not counted.
        expect(countBaseLoomsNotEntered({ machines, runningJobIdByMachineId: running, today: today(['m1', 'm2']) })).toBe(1)
        expect(countBaseLoomsNotEntered({ machines, runningJobIdByMachineId: running, today: today(['m1', 'm2', 'm3']) })).toBe(0)
    })

    it('leaves the count to the day line until a sheet is saved', () => {
        expect(countBaseLoomsNotEntered({ machines, runningJobIdByMachineId: running, today: today([], false) })).toBe(0)
    })
})
