import { calculateBaseJobSummary } from './base-production-core'

type SummaryJob = Parameters<typeof calculateBaseJobSummary>[0]
type SummaryEntry = Parameters<typeof calculateBaseJobSummary>[1][number]

export function calculateBaseJobSummaries(
    jobs: SummaryJob[],
    entries: SummaryEntry[],
    allocations: SummaryEntry[] = [],
) {
    const rowsByJob = new Map<string, { entries: SummaryEntry[]; allocations: SummaryEntry[] }>(
        jobs.map(job => [job.id, { entries: [], allocations: [] }]),
    )
    // Do not scan history when there are no job summaries to calculate.
    if (jobs.length === 0) return new Map<string, ReturnType<typeof calculateBaseJobSummary>>()

    // Preserve each source's order and duplicates. Keep the two sources separate
    // so the authoritative calculator retains its exact Decimal addition order.
    for (const entry of entries) rowsByJob.get(entry.job_id)?.entries.push(entry)
    for (const allocation of allocations) rowsByJob.get(allocation.job_id)?.allocations.push(allocation)

    return new Map(jobs.map(job => {
        const rows = rowsByJob.get(job.id)!
        return [job.id, calculateBaseJobSummary(job, rows.entries, rows.allocations)]
    }))
}
