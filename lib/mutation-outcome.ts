export const DEFAULT_MUTATION_TIMEOUT_MS = 15_000

export type MutationOutcome<T> =
    | { status: 'completed'; value: T }
    | { status: 'unknown' }

/**
 * A client timeout cannot prove that a server mutation failed: the server may
 * have committed after the response path was interrupted. This helper races
 * only the response wait and deliberately reports an unknown outcome instead
 * of converting it into a definite failure.
 */
export async function runMutationWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs = DEFAULT_MUTATION_TIMEOUT_MS
): Promise<MutationOutcome<T>> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const operationResult = operation().then(
        (value) => ({ status: 'completed' as const, value }),
        (error) => Promise.reject(error)
    )
    const timeoutResult = new Promise<{ status: 'unknown' }>((resolve) => {
        timeoutId = setTimeout(() => resolve({ status: 'unknown' }), timeoutMs)
    })

    try {
        return await Promise.race([operationResult, timeoutResult])
    } finally {
        if (timeoutId) clearTimeout(timeoutId)
    }
}

type SubmittedProductionEntry = {
    machine_id: string
    meters: number
    zero_meter_reason?: string | null
}

type PersistedProductionLog = {
    machine_id: string
    meters: number
    zero_meter_reason?: string | null
}

export function productionSubmissionMatchesPersistedState(
    entries: SubmittedProductionEntry[],
    logs: PersistedProductionLog[]
) {
    if (entries.length !== logs.length) return false

    const logsByMachine = new Map(logs.map((log) => [log.machine_id, log]))
    return entries.every((entry) => {
        const log = logsByMachine.get(entry.machine_id)
        return Boolean(
            log &&
            Number(log.meters) === Number(entry.meters) &&
            (log.zero_meter_reason ?? null) === (entry.zero_meter_reason ?? null)
        )
    })
}
