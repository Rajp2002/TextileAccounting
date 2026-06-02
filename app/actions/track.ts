'use server'

/**
 * Dispatch Bridge — Public Server Actions
 *
 * These actions are called from the /track/[token] page by unauthenticated Traders.
 * They use createAdminClient() (service_role) to bypass RLS, but validate a
 * capability token before any mutation.
 *
 * Security model:
 *   - The client never receives or submits the internal dispatch UUID.
 *   - Confirmation uses the tracking token plus the human dispatch number.
 *   - The database wrapper resolves the UUID only after validating the token.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { checkTrackingRateLimit, getClientIpFromHeaders } from '@/lib/rate-limit'
import { isValidTrackingToken, normalizeTrackingToken } from '@/lib/tracking-token'
import { headers } from 'next/headers'

export async function confirmDispatchReceipt(
    dispatchNumber: number,
    trackingToken: string,
    qtyReceived: number | null  // null = accept the sent qty (no shortage)
): Promise<{ success: true; qty_received: number } | { error: string }> {
    const normalizedTrackingToken = normalizeTrackingToken(trackingToken)

    if (!Number.isInteger(dispatchNumber) || dispatchNumber <= 0 || !isValidTrackingToken(normalizedTrackingToken)) {
        return { error: 'Invalid tracking link' }
    }

    if (qtyReceived !== null && (!Number.isFinite(qtyReceived) || qtyReceived < 0)) {
        return { error: 'Enter a valid received quantity' }
    }

    const headerList = await headers()
    const clientIp = getClientIpFromHeaders(headerList)
    const rateLimitReset = await checkTrackingRateLimit(clientIp, normalizedTrackingToken)
    if (rateLimitReset) {
        const retryInSeconds = Math.max(1, Math.ceil((rateLimitReset - Date.now()) / 1000))
        return { error: `Too many attempts. Try again in ${retryInSeconds} seconds.` }
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('confirm_fabric_dispatch_receipt_by_number', {
        p_dispatch_number: dispatchNumber,
        p_tracking_token: normalizedTrackingToken,
        p_qty_received: qtyReceived,
    })

    if (error) {
        const message = error.message || 'Could not confirm receipt. Please try again.'
        if (
            message.includes('Invalid tracking link') ||
            message.includes('already been confirmed') ||
            message.includes('Enter a valid received quantity')
        ) {
            if (message.includes('already been confirmed')) {
                return { error: 'Receipt already confirmed' }
            }
            return { error: message }
        }
        return { error: 'Could not confirm receipt. Please try again.' }
    }

    const result = Array.isArray(data) ? data[0] : data
    return { success: true, qty_received: Number(result?.qty_received ?? qtyReceived ?? 0) }
}
