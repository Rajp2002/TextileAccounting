import type { BaseProductionWorker, BaseProductionShift } from './base-production-core'

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

export function isBaseOperatorAvailable(worker: Operator, shift: BaseProductionShift, date: string) {
    return worker.is_active
        && hasBaseOperatorEligibility(worker, date)
        && (worker.shift_availability === 'both' || worker.shift_availability === shift)
        && (!worker.start_date || date >= worker.start_date)
        && (!worker.end_date || date <= worker.end_date)
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
