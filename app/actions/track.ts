'use server'

/**
 * Dispatch Bridge — Public Server Actions
 *
 * These actions are called from the /track/[token] page by unauthenticated Traders.
 * They use createAdminClient() (service_role) to bypass RLS, but validate a
 * capability token before any mutation.
 *
 * Security model:
 *   - Knowing only a dispatchId (UUID) is NOT sufficient to confirm a dispatch.
 *   - The tracking_token of the parent order must also match.
 *   - This prevents a Trader from confirming a different factory's dispatch
 *     by guessing a UUID — even via a brute-force attempt.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export async function confirmDispatchReceipt(
    dispatchId: string,
    trackingToken: string,
    qtyReceived: number | null  // null = accept the sent qty (no shortage)
): Promise<{ success: true; qty_received: number } | { error: string }> {
    const supabase = createAdminClient()

    // Dual-key check: dispatch must belong to the order that has this token.
    // The !inner join means the query returns no row if the token doesn't match.
    const { data: dispatch, error: fetchError } = await supabase
        .from('dispatches')
        .select('id, order_id, status, qty_meters_sent, orders!inner(tracking_token)')
        .eq('id', dispatchId)
        .eq('orders.tracking_token', trackingToken)
        .single()

    if (fetchError || !dispatch) return { error: 'Invalid tracking link' }
    if (dispatch.status !== 'in_transit') return { error: 'This batch has already been confirmed' }

    // Default received qty to sent qty if trader doesn't enter a value
    const received = qtyReceived !== null && qtyReceived >= 0
        ? qtyReceived
        : dispatch.qty_meters_sent

    const { error: updateError } = await supabase
        .from('dispatches')
        .update({
            status:               'delivered',
            qty_meters_received:  received,
            received_at:          new Date().toISOString(),
        })
        .eq('id', dispatchId)

    if (updateError) return { error: 'Could not confirm receipt. Please try again.' }

    return { success: true, qty_received: Number(received) }
}
