import { z } from 'zod'
import type { BaseProductionRevisionSnapshot } from './base-production-core'

const amount = z.coerce.number().finite().nonnegative()
const applicability = {
    pay_basis_snapshot: z.enum(['piece_rate', 'fixed_monthly']).optional(),
    piece_earning_state: z.enum(['applicable', 'inapplicable']).optional(),
}
const entrySchema = z.object({
    ...applicability,
    worker_id: z.string(), entry_status: z.enum(['blank', 'entered', 'zero', 'absent']),
    meters: amount.nullable().transform(value => value ?? 0), worker_rate_snapshot: amount,
    allocations: z.array(z.object({ ...applicability, machine_id: z.string(), machine_label: z.string(), job_id: z.string(), job_label: z.string(), meters: amount, worker_rate_snapshot: amount })).default([]),
})
export function readBaseRevisionEntries(value: unknown) {
    const result = z.array(entrySchema).safeParse(value)
    return result.success ? result.data : undefined
}

type AuditLine = { workerId: string; machine: string; job: string; meters: number; rate: number; pay: number; status: string }
function lines(snapshot: BaseProductionRevisionSnapshot | null) {
    const result = new Map<string, AuditLine>()
    for (const entry of snapshot?.entries ?? []) {
        const allocations = entry.allocations.length ? entry.allocations : [{ machine_id: '', machine_label: 'Worker total', job_id: '', job_label: '', meters: entry.meters, worker_rate_snapshot: entry.worker_rate_snapshot }]
        for (const allocation of allocations) {
            const key = `${entry.worker_id}:${allocation.machine_id}:${allocation.job_id}`
            result.set(key, { workerId: entry.worker_id, machine: allocation.machine_label, job: allocation.job_label, meters: allocation.meters, rate: allocation.worker_rate_snapshot, pay: Number((allocation.meters * allocation.worker_rate_snapshot).toFixed(2)), status: entry.entry_status })
        }
    }
    for (const record of snapshot?.machine_records ?? []) {
        if (record.state === 'entered') continue // Financial detail comes from allocations above.
        const key = `${record.worker_id}:${record.machine_id}:${record.job_id ?? ''}`
        result.set(key, { workerId: record.worker_id, machine: record.machine_label, job: record.job_label ?? '', meters: 0, rate: 0, pay: 0, status: record.state })
    }
    return result
}

export function baseProductionAuditChanges(before: BaseProductionRevisionSnapshot | null, after: BaseProductionRevisionSnapshot) {
    const oldLines = lines(before)
    const newLines = lines(after)
    return [...new Set([...oldLines.keys(), ...newLines.keys()])].flatMap(key => {
        const previous = oldLines.get(key)
        const next = newLines.get(key)
        if (previous && next && previous.meters === next.meters && previous.rate === next.rate && previous.status === next.status) return []
        return [{ key, line: next ?? previous!, before: previous ?? null, after: next ?? null }]
    })
}
