import { describe, expect, it } from 'vitest'
import { effectiveDateFor, goLiveOptions, goLivePhase, goLiveReadiness, nextGoLiveDate } from '../lib/base-go-live'

const monthly1 = { type: 'monthly', anchorDay: 1 } as const

describe('nextGoLiveDate', () => {
    it('is the next monthly boundary mid-cycle', () => expect(nextGoLiveDate('2026-10-24', monthly1)).toBe('2026-11-01'))
    it('is today on a boundary', () => expect(nextGoLiveDate('2026-11-01', monthly1)).toBe('2026-11-01'))
    it('follows a mid-month anchor', () => expect(nextGoLiveDate('2026-10-03', { type: 'monthly', anchorDay: 16 })).toBe('2026-10-16'))
    it('falls back at month end for anchor 31', () => expect(nextGoLiveDate('2026-11-05', { type: 'monthly', anchorDay: 31 })).toBe('2026-11-30'))
    it('handles weekly', () => expect(nextGoLiveDate('2026-10-15', { type: 'weekly', anchorWeekday: 'monday' })).toBe('2026-10-19'))
})

it('lists the next boundaries', () => expect(goLiveOptions('2026-10-24', monthly1, 3)).toEqual(['2026-11-01', '2026-12-01', '2027-01-01']))

it('classifies phases', () => {
    expect(goLivePhase('2026-10-24', null)).toBe('unscheduled')
    expect(goLivePhase('2026-10-24', '2026-11-01')).toBe('setup')
    expect(goLivePhase('2026-11-01', '2026-11-01')).toBe('live')
})

it('dates setup changes from go-live', () => {
    expect(effectiveDateFor('2026-10-24', '2026-11-01')).toBe('2026-11-01')
    expect(effectiveDateFor('2026-11-05', '2026-11-01')).toBe('2026-11-05')
    expect(effectiveDateFor('2026-10-24', null)).toBe('2026-10-24')
})

describe('goLiveReadiness', () => {
    const goLive = '2026-11-01'
    const machines = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }]
    const jobContexts = [
        { machine_id: 'm1', active: true, effective_from: '2026-11-01', effective_to: null },
        { machine_id: 'm2', active: true, effective_from: '2026-10-20', effective_to: null },
        { machine_id: 'm3', active: true, effective_from: '2026-10-20', effective_to: '2026-10-25' },
    ]
    const assignments = [
        { machine_id: 'm1', shift: 'day' as const, active: true, effective_from: '2026-11-01', effective_to: null },
        { machine_id: 'm2', shift: 'day' as const, active: true, effective_from: '2026-10-24', effective_to: null },
        { machine_id: 'm1', shift: 'night' as const, active: false, effective_from: '2026-11-01', effective_to: '2026-11-01' },
    ]

    it('counts looms with a quality and staffed shifts on go-live', () => {
        const readiness = goLiveReadiness({ goLive, machines, jobContexts, assignments, legacyCounts: [] })
        expect(readiness.loomsTotal).toBe(3)
        expect(readiness.loomsWithQuality).toBe(2)
        expect(readiness.staffed).toEqual({ day: 2, night: 0 })
        expect(readiness.legacy).toEqual({ state: 'none', countedOn: null })
    })
    it('flags a legacy count taken well before go-live', () => {
        const readiness = goLiveReadiness({ goLive, machines, jobContexts, assignments, legacyCounts: [
            { basis: 'counted', basis_at: '2026-10-31T18:00:00+05:30' },
            { basis: 'estimated', basis_at: '2026-10-20T10:00:00+05:30' },
            { basis: 'unknown', basis_at: null },
        ] })
        expect(readiness.legacy).toEqual({ state: 'stale', countedOn: '2026-10-20' })
    })
    it('accepts a count from the evening before go-live', () => {
        const readiness = goLiveReadiness({ goLive, machines, jobContexts, assignments, legacyCounts: [{ basis: 'counted', basis_at: '2026-10-31T18:00:00+05:30' }] })
        expect(readiness.legacy).toEqual({ state: 'fresh', countedOn: '2026-10-31' })
    })
})
