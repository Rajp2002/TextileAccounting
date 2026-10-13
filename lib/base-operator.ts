import type { BaseDailyProductionStatus, BaseProductionWorker, BaseProductionShift } from './base-production-core'

type Operator = Pick<BaseProductionWorker,
    'pay_type' | 'operator_eligible' | 'operator_effective_from' | 'is_active' | 'shift_availability' | 'start_date' | 'end_date'>

/** Existing piece workers retain eligibility; monthly staff require owner approval.
 * Eligibility covers primary operation in this factory. Dated machine/shift
 * assignments supply the machine scope; job titles never grant capability.
 */
export function hasBaseOperatorEligibility(worker: Operator, date?: string) {
    const approved = worker.operator_eligible ?? worker.pay_type !== 'fixed_monthly'
    return approved && (!date || !worker.operator_effective_from || date >= worker.operator_effective_from)
}

/** Whether private.guard_base_piece_worker accepts a daily production row for this worker.
 * Like the guard it ignores is_active, so a saved shift stays correctable after someone leaves.
 */
export function canRecordBaseOperatorProduction(worker: Operator, shift: BaseProductionShift, date: string) {
    return hasBaseOperatorEligibility(worker, date)
        && (worker.shift_availability === 'both' || worker.shift_availability === shift)
        && (!worker.start_date || date >= worker.start_date)
        && (!worker.end_date || date <= worker.end_date)
}

export function isBaseOperatorAvailable(worker: Operator, shift: BaseProductionShift, date: string) {
    return worker.is_active && canRecordBaseOperatorProduction(worker, shift, date)
}

/** The database writes a row for every unpaid worker on the sheet, blank ones included, and the
 * operator guard rejects the whole shift for one it does not accept. A blank row for someone who
 * cannot work this date and shift (left, not yet joined, on the other shift) holds nothing, so it
 * is left out. A row with production, zero or absence is blocked so the sheet can name it.
 * Paid rows are never rewritten, so the guard never sees them.
 */
export function reviewBaseSheetOperators(
    rows: ReadonlyArray<{ workerId: string; status: BaseDailyProductionStatus; paid?: boolean }>,
    workerById: ReadonlyMap<string, Operator>,
    shift: BaseProductionShift,
    date: string,
) {
    const omittedWorkerIds = new Set<string>()
    const blockedWorkerIds: string[] = []
    for (const row of rows) {
        const worker = workerById.get(row.workerId)
        if (row.paid || (worker && canRecordBaseOperatorProduction(worker, shift, date))) continue
        if (row.status === 'blank') omittedWorkerIds.add(row.workerId)
        else blockedWorkerIds.push(row.workerId)
    }
    return { omittedWorkerIds, blockedWorkerIds }
}

/** "Loom 01, Loom 03 (Gorthan Butani); Ramesh": the looms and operator of each blocked row. */
export function describeBaseSheetRows(rows: ReadonlyArray<{ workerName: string; machineLabels: readonly string[] }>) {
    return rows
        .map(row => row.machineLabels.length > 0 ? `${row.machineLabels.join(', ')} (${row.workerName})` : row.workerName)
        .join('; ')
}

export type BasePieceRateResolution =
    | { state: 'inapplicable'; rate: 0; source: 'fixed_monthly' }
    | { state: 'applicable'; rate: number; source: 'job' | 'legacy_worker' }
    | { state: 'unresolved'; rate: null; source: null }

/** Rupees per metre. Zero is a value; only a missing job value inherits the
 * expressly supplied legacy rate. Preserve rate precision, round amounts later.
 */
export function resolveBasePieceRate(
    payType: BaseProductionWorker['pay_type'],
    jobRate: number | null | undefined,
    legacyRate?: number | null,
): BasePieceRateResolution {
    if (payType === 'fixed_monthly') return { state: 'inapplicable', rate: 0, source: 'fixed_monthly' }
    const rate = jobRate ?? legacyRate
    if (rate == null || !Number.isFinite(rate) || rate < 0) return { state: 'unresolved', rate: null, source: null }
    return { state: 'applicable', rate, source: jobRate == null ? 'legacy_worker' : 'job' }
}
