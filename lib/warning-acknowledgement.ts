import type { EstimateState } from './estimator'
import { canonicalFreeInputs } from './free-estimator-canonical'

/**
 * What an owner's "I reviewed these values" covers: the warnings shown and the
 * exact effective inputs behind them. Warning text alone is not enough, since
 * many messages name only the field ("yarn rate is above ₹1000/kg"), so a
 * reviewed ₹1,001 and an unreviewed ₹2,000 would otherwise share one approval.
 * Cosmetic changes (row ids, labels, equivalent units) keep the approval.
 */
export function warningAcknowledgementKey(warnings: ReadonlyArray<{ field: string; message: string }>, state: EstimateState): string {
  if (warnings.length === 0) return ''
  return `${warnings.map(warning => `${warning.field}:${warning.message}`).join('|')}#${JSON.stringify(canonicalFreeInputs(state))}`
}
