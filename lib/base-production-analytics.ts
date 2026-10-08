import Decimal from 'decimal.js'

import {
    toBaseNumber,
    type BaseProductionAllocation,
    type BaseProductionBatch,
    type BaseProductionEntry,
} from './base-production-core'

export type BaseProductionDay = {
    date: string
    totalMeters: number
    metersByJobId: Map<string, number>
    savedShifts: { day: boolean; night: boolean }
    hasSavedSheet: boolean
}

export type BaseProductionDayComparison = {
    previousMeters: number
    deltaMeters: number
    /** Null when the previous day produced nothing, so there is no base to divide by. */
    deltaPercent: number | null
    /** False while the later day has not saved every shift the previous day had. */
    comparable: boolean
}

function positiveMeters(value: number | string | null | undefined) {
    try {
        const meters = new Decimal(value ?? 0)
        return meters.isFinite() && meters.gt(0) ? meters : null
    } catch {
        return null
    }
}

/**
 * One day's output across all looms, attributed to qualities the same way job
 * progress is (calculateBaseJobSummary): metres live on allocations, and a
 * legacy entry that names its own job counts directly. A machine-breakdown
 * entry has no job of its own, so its metres are never counted twice.
 */
export function calculateBaseProductionDay({
    date,
    entries,
    allocations,
    batches,
}: {
    date: string
    entries: Pick<BaseProductionEntry, 'id' | 'job_id' | 'meters' | 'production_date'>[]
    allocations: Pick<BaseProductionAllocation, 'entry_id' | 'job_id' | 'meters'>[]
    batches: Pick<BaseProductionBatch, 'production_date' | 'shift'>[]
}): BaseProductionDay {
    const entryIdsOnDate = new Set<string>()
    const byJob = new Map<string, Decimal>()
    let total = new Decimal(0)

    const add = (jobId: string, meters: Decimal) => {
        byJob.set(jobId, (byJob.get(jobId) ?? new Decimal(0)).plus(meters))
        total = total.plus(meters)
    }

    for (const entry of entries) {
        if (entry.production_date !== date) continue
        entryIdsOnDate.add(entry.id)
        const meters = positiveMeters(entry.meters)
        if (entry.job_id && meters) add(entry.job_id, meters)
    }
    for (const allocation of allocations) {
        if (!entryIdsOnDate.has(allocation.entry_id)) continue
        const meters = positiveMeters(allocation.meters)
        if (allocation.job_id && meters) add(allocation.job_id, meters)
    }

    const savedShifts = { day: false, night: false }
    for (const batch of batches) {
        if (batch.production_date === date) savedShifts[batch.shift] = true
    }

    return {
        date,
        totalMeters: toBaseNumber(total.toString()),
        metersByJobId: new Map([...byJob].map(([jobId, meters]) => [jobId, toBaseNumber(meters.toString())])),
        savedShifts,
        // Legacy entries have no batch, so recorded metres also prove the day was entered.
        hasSavedSheet: savedShifts.day || savedShifts.night || total.gt(0),
    }
}

/**
 * Today against the previous day. Null when the previous day was never entered.
 * A day with fewer shifts saved than the previous day is reported as not
 * comparable, so a half-entered day is not shown as a drop.
 */
export function compareBaseProductionDays(
    current: BaseProductionDay,
    previous: BaseProductionDay,
): BaseProductionDayComparison | null {
    if (!previous.hasSavedSheet) return null

    const delta = new Decimal(current.totalMeters).minus(previous.totalMeters)
    const comparable = (!previous.savedShifts.day || current.savedShifts.day)
        && (!previous.savedShifts.night || current.savedShifts.night)

    return {
        previousMeters: previous.totalMeters,
        deltaMeters: toBaseNumber(delta.toString()),
        deltaPercent: previous.totalMeters > 0
            ? Number(delta.div(previous.totalMeters).times(100).toFixed(1))
            : null,
        comparable,
    }
}

/** The calendar day before a YYYY-MM-DD date, so yesterday follows the page's Surat "today". */
export function getBasePreviousDate(date: string) {
    const [year, month, day] = date.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10)
}

/** Metres on the day that belong to qualities outside `jobIds`, e.g. one deactivated after it produced. */
export function metersOutsideBaseJobs(day: BaseProductionDay, jobIds: Iterable<string>) {
    const active = new Set(jobIds)
    let outside = new Decimal(0)
    for (const [jobId, meters] of day.metersByJobId) {
        if (!active.has(jobId)) outside = outside.plus(meters)
    }
    return toBaseNumber(outside.toString())
}

export function formatBaseMeters(value: number) {
    return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)} m`
}
