// Browser-safe half of yarn rate propagation: what the review dialog needs to
// split a save into batches and report the result. lib/yarn-rate-propagation.ts
// holds the costing maths, which the dialog does not import.

/** Costings saved per `applyYarnRatePropagation` call. */
export const PROPAGATION_BATCH_SIZE = 10

export type PropagationOutcome = {
    id: string
    status: 'created' | 'unchanged' | 'stale' | 'failed'
    versionNumber?: number
    quoteId?: string
    message?: string
}

export function chunkIds<T>(items: readonly T[], size: number = PROPAGATION_BATCH_SIZE): T[][] {
    const chunks: T[][] = []
    for (let start = 0; start < items.length; start += size) chunks.push(items.slice(start, start + size))
    return chunks
}

export function summarizeOutcomes(outcomes: readonly PropagationOutcome[]) {
    const summary = { created: 0, unchanged: 0, stale: 0, failed: 0 }
    for (const outcome of outcomes) summary[outcome.status] += 1
    return summary
}

/**
 * The ticks after the review reloads: every costing is ticked except those the
 * owner had unticked, so a Retry never re-selects a costing they left out.
 */
export function tickedAfterReload(itemIds: readonly string[], unticked: ReadonlySet<string>): Set<string> {
    return new Set(itemIds.filter(id => !unticked.has(id)))
}
