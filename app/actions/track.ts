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
import { checkTrackingRateLimit } from '@/lib/rate-limit'
import { headers } from 'next/headers'

const DISPATCH_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TRACKING_TOKEN_RE = /^[A-Za-z0-9_-]{12}$/

export async function confirmDispatchReceipt(
    dispatchId: string,
    trackingToken: string,
    qtyReceived: number | null  // null = accept the sent qty (no shortage)
): Promise<{ success: true; qty_received: number } | { error: string }> {
    const normalizedDispatchId = dispatchId.trim()
    const normalizedTrackingToken = trackingToken.trim()

    if (!DISPATCH_ID_RE.test(normalizedDispatchId) || !TRACKING_TOKEN_RE.test(normalizedTrackingToken)) {
        return { error: 'Invalid tracking link' }
    }

    if (qtyReceived !== null && (!Number.isFinite(qtyReceived) || qtyReceived < 0)) {
        return { error: 'Enter a valid received quantity' }
    }

    const headerList = await headers()
    const clientIp = headerList.get('x-forwarded-for')?.split(',')[0]?.trim()
        || headerList.get('x-real-ip')
        || 'unknown'
    const rateLimitReset = await checkTrackingRateLimit(clientIp, normalizedTrackingToken)
    if (rateLimitReset) {
        const retryInSeconds = Math.max(1, Math.ceil((rateLimitReset - Date.now()) / 1000))
        return { error: `Too many attempts. Try again in ${retryInSeconds} seconds.` }
    }

    const supabase = createAdminClient()

    // Dual-key check: dispatch must belong to the order that has this token.
    // The !inner join means the query returns no row if the token doesn't match.
    const { data: dispatch, error: fetchError } = await supabase
        .from('dispatches')
        .select('id, order_id, status, qty_meters_sent, orders!inner(tracking_token)')
        .eq('id', normalizedDispatchId)
        .eq('orders.tracking_token', normalizedTrackingToken)
        .single()

    if (fetchError || !dispatch) return { error: 'Invalid tracking link' }
    if (dispatch.status !== 'in_transit') return { error: 'This batch has already been confirmed' }

    // Default received qty to sent qty if trader doesn't enter a value
    const received = qtyReceived !== null && qtyReceived >= 0
        ? qtyReceived
        : dispatch.qty_meters_sent

    if (received > Number(dispatch.qty_meters_sent)) {
        return { error: 'Received quantity cannot exceed the sent quantity' }
    }

    const { error: updateError } = await supabase
        .from('dispatches')
        .update({
            status:               'delivered',
            qty_meters_received:  received,
            received_at:          new Date().toISOString(),
        })
        .eq('id', normalizedDispatchId)
        .eq('status', 'in_transit')
        .select('id')
        .single()

    if (updateError) return { error: 'Could not confirm receipt. Please try again.' }

    return { success: true, qty_received: Number(received) }
}
