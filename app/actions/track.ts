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
    const { data, error } = await supabase.rpc('confirm_fabric_dispatch_receipt', {
        p_dispatch_id: normalizedDispatchId,
        p_tracking_token: normalizedTrackingToken,
        p_qty_received: qtyReceived,
    })

    if (error) {
        const message = error.message || 'Could not confirm receipt. Please try again.'
        if (
            message.includes('Invalid tracking link') ||
            message.includes('already been confirmed') ||
            message.includes('Received quantity cannot exceed') ||
            message.includes('Enter a valid received quantity')
        ) {
            return { error: message }
        }
        return { error: 'Could not confirm receipt. Please try again.' }
    }

    const result = Array.isArray(data) ? data[0] : data
    return { success: true, qty_received: Number(result?.qty_received ?? qtyReceived ?? 0) }
}
