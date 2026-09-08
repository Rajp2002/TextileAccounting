import type { calculateBaseJobSummary } from '../../lib/base-production-core'

/** Synthetic history only; entry and allocation values stay separate. */
export function jobSummariesFixture(jobCount: number, rowCount: number, seed = 0) {
    const jobs: Parameters<typeof calculateBaseJobSummary>[0][] = Array.from({ length: jobCount }, (_, i) => ({
        id: `job-${i}`, target_meters: 10000.01 + i,
        planned_cost_per_meter: 20.125, planned_price_per_meter: 30.555,
    }))
    const entries: Parameters<typeof calculateBaseJobSummary>[1] = Array.from({ length: rowCount }, (_, i) => ({
        job_id: `job-${(i * 17 + seed) % (jobCount + 1)}`, // Includes unrelated history.
        meters: i % 19 === 0 ? -0.005 : 120.015,
    }))
    const allocations = entries.filter((_, i) => i % 3 !== 0).map((entry, i) => ({
        job_id: entry.job_id, meters: i % 23 === 0 ? 0 : 40.005,
    }))
    return { jobs, entries, allocations }
}
