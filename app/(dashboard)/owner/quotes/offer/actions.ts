'use server'

import { buildOfferBase, type OfferBaseResult, type OfferSourceRow } from '@/lib/offer-check'
import { getEstimatorQuoteDetail } from '../../estimator/actions'

/**
 * The saved costing an offer is checked against, reduced to the few numbers the
 * check needs. The read goes through the same owner-scoped detail read the
 * Saved Costings page uses, so no costing outside the caller's organization is reachable.
 */
export async function getOfferBase(costingId: string): Promise<{ data: OfferBaseResult } | { error: string }> {
    const detail = await getEstimatorQuoteDetail(costingId)
    // The page shows its own message; the reason here is only for logs and tests.
    if ('error' in detail || !detail.data) return { error: ('error' in detail && detail.error) || 'missing' }
    return { data: buildOfferBase(detail.data as unknown as OfferSourceRow) }
}
