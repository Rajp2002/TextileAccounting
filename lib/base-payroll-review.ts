import type { BaseWorkerPayable } from './base-production-core'

// These are the values the owner explicitly reviewed. The database compares
// them inside the settlement transaction and rolls back if anything changed.
export function basePayrollReview(payable: BaseWorkerPayable, requestId: string) {
    return {
        client_request_id: requestId,
        period_start: payable.period_start,
        gross_pay: payable.gross_pay,
        advance_deducted: payable.advance_recovery,
        net_payout: payable.net_payout,
        advance_balance_before: payable.pending_advance,
    }
}
