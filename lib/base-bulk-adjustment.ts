import Decimal from 'decimal.js'

export const DEDUCTION_REASONS = [
    'Mistake / Damage',
    'Water access / Utilities',
    'Penalty / Absence',
    'Mess / Canteen / Food',
    'Other',
] as const

export type DeductionReason = typeof DEDUCTION_REASONS[number]

export type BulkAdjustmentKind = 'advance' | 'deduction'
export type BulkWorkerGroup = 'piece_rate' | 'fixed_monthly'

export type BulkAdjustmentWorker = {
    id: string
    name: string
    is_active: boolean
    pay_type?: BulkWorkerGroup
}

const DESCRIPTION_LIMIT = 240

/** Same text the single-worker deduction writes; worker cards parse this prefix. */
export function buildDeductionDescription(reason: string | null | undefined, note: string | null | undefined) {
    return [
        reason ? `[Deduction: ${reason}]` : '[Deduction]',
        note?.trim(),
    ].filter(Boolean).join(' ').slice(0, DESCRIPTION_LIMIT)
}

export function bulkWorkerGroup(worker: Pick<BulkAdjustmentWorker, 'pay_type'>): BulkWorkerGroup {
    return worker.pay_type === 'fixed_monthly' ? 'fixed_monthly' : 'piece_rate'
}

export function bulkEligibleWorkers<T extends BulkAdjustmentWorker>(workers: readonly T[]): T[] {
    return workers
        .filter(worker => worker.is_active)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export function bulkGroupCounts(workers: readonly BulkAdjustmentWorker[]): Record<BulkWorkerGroup, number> {
    const counts: Record<BulkWorkerGroup, number> = { piece_rate: 0, fixed_monthly: 0 }
    for (const worker of workers) counts[bulkWorkerGroup(worker)] += 1
    return counts
}

export function bulkGroupState(
    selected: ReadonlySet<string>,
    workers: readonly BulkAdjustmentWorker[],
    group: BulkWorkerGroup,
): 'all' | 'some' | 'none' {
    const members = workers.filter(worker => bulkWorkerGroup(worker) === group)
    const picked = members.filter(worker => selected.has(worker.id)).length
    if (picked === 0) return 'none'
    return picked === members.length ? 'all' : 'some'
}

/** A fully selected group is cleared; a partly or un-selected one is filled. */
export function toggleBulkGroup(
    selected: ReadonlySet<string>,
    workers: readonly BulkAdjustmentWorker[],
    group: BulkWorkerGroup,
): Set<string> {
    const next = new Set(selected)
    const clear = bulkGroupState(selected, workers, group) === 'all'
    for (const worker of workers) {
        if (bulkWorkerGroup(worker) !== group) continue
        if (clear) next.delete(worker.id)
        else next.add(worker.id)
    }
    return next
}

export function toggleBulkWorker(selected: ReadonlySet<string>, workerId: string): Set<string> {
    const next = new Set(selected)
    if (!next.delete(workerId)) next.add(workerId)
    return next
}

export function bulkAdjustmentTotal(amount: number, workerCount: number): number {
    if (!Number.isFinite(amount) || amount <= 0 || workerCount <= 0) return 0
    return new Decimal(amount).times(workerCount).toDecimalPlaces(2).toNumber()
}
