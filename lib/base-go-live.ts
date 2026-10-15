/**
 * Base go-live: the pay-cycle start from which a factory records production, payroll, orange stock and challans
 * in Weavly. Everything before it stays on paper, and fabric already in the godown is legacy stock.
 * Database twin: organizations.base_go_live_date and the guards in 20261015140000_base_go_live.sql.
 */
import { addDays, getBoundaryOnOrBefore, getNextBoundary, type PayrollCycleRule } from './payroll-cycle-engine'
import { formatToSurat } from './time'

export type BaseGoLivePhase = 'unscheduled' | 'setup' | 'live'

/** The next pay-cycle start, or today when today is one. */
export function nextGoLiveDate(today: string, rule: PayrollCycleRule): string {
    const boundary = getBoundaryOnOrBefore(today, rule)
    return boundary === today ? today : getNextBoundary(boundary, rule)
}

/** The cycle starts an owner may choose, earliest first. */
export function goLiveOptions(today: string, rule: PayrollCycleRule, count = 4): string[] {
    const options = [nextGoLiveDate(today, rule)]
    while (options.length < count) options.push(getNextBoundary(options[options.length - 1], rule))
    return options
}

export function goLivePhase(today: string, goLive: string | null): BaseGoLivePhase {
    if (!goLive) return 'unscheduled'
    return today >= goLive ? 'live' : 'setup'
}

/** Setup changes take effect from go-live; after go-live they take effect today. */
export function effectiveDateFor(today: string, goLive: string | null): string {
    return goLive && goLive > today ? goLive : today
}

type DatedRow = { active: boolean; effective_from: string; effective_to: string | null }

export type GoLiveReadiness = {
    loomsTotal: number
    loomsWithQuality: number
    staffed: { day: number; night: number }
    legacy: { state: 'none' | 'stale' | 'fresh'; countedOn: string | null }
}

function validOn(row: DatedRow, date: string) {
    return row.active && row.effective_from <= date && (!row.effective_to || row.effective_to >= date)
}

export function goLiveReadiness(input: {
    goLive: string
    machines: { id: string }[]
    jobContexts: (DatedRow & { machine_id: string })[]
    assignments: (DatedRow & { machine_id: string; shift: 'day' | 'night' })[]
    legacyCounts: { basis: 'unknown' | 'estimated' | 'counted'; basis_at: string | null }[]
}): GoLiveReadiness {
    const machineIds = new Set(input.machines.map(machine => machine.id))
    const withQuality = new Set(input.jobContexts.filter(row => machineIds.has(row.machine_id) && validOn(row, input.goLive)).map(row => row.machine_id))
    const staffed = (shift: 'day' | 'night') => new Set(input.assignments
        .filter(row => row.shift === shift && machineIds.has(row.machine_id) && validOn(row, input.goLive))
        .map(row => row.machine_id)).size
    // Several qualities: the oldest count decides, since that is the one most likely out of date.
    const countedOn = input.legacyCounts
        .filter(row => row.basis !== 'unknown' && row.basis_at)
        .map(row => formatToSurat(row.basis_at!, 'yyyy-MM-dd'))
        .sort()[0] ?? null
    return {
        loomsTotal: machineIds.size,
        loomsWithQuality: withQuality.size,
        staffed: { day: staffed('day'), night: staffed('night') },
        legacy: { state: !countedOn ? 'none' : countedOn >= addDays(input.goLive, -1) ? 'fresh' : 'stale', countedOn },
    }
}
