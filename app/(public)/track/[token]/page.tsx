import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import TrackingPortal from './TrackingPortal'
import type { Metadata } from 'next'
import { I18nProvider } from '@/lib/i18n/context'
import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { checkTrackingRateLimit, getClientIpFromHeaders } from '@/lib/rate-limit'
import { isValidTrackingToken, normalizeTrackingToken } from '@/lib/tracking-token'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TrackingDispatch {
    dispatch_number: number
    qty_meters_sent: number
    qty_meters_received: number | null
    receipt_confirmed_by_owner: boolean
    status: 'in_transit' | 'delivered' | 'disputed'
    dispatched_at: string
    received_at: string | null
}

export interface TrackingData {
    party_name: string
    total_target_meters: number
    status: 'active' | 'completed' | 'cancelled'
    meters_produced: number
    dispatches: TrackingDispatch[]
}

// ─── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
    const { token } = await params
    if (!isValidTrackingToken(token)) {
        return { title: 'Order Not Found · Weavly' }
    }

    return {
        title: 'Order Tracking · Weavly',
        description: 'Track your fabric dispatch and confirm received quantities.',
    }
}

import { createClient } from '@/lib/supabase/server'

export default async function TrackingPage({ params }: { params: Promise<{ token: string }> }) {
    const { token: rawToken } = await params
    const token = normalizeTrackingToken(rawToken)

    if (!isValidTrackingToken(token)) {
        notFound()
    }

    const headerList = await headers()
    const clientIp = getClientIpFromHeaders(headerList)
    const rateLimitReset = await checkTrackingRateLimit(clientIp, token)
    if (rateLimitReset) {
        notFound()
    }

    // Check if the current visitor is an internal team member (Owner/Supervisor)
    // to enable "Preview Mode" and disable actions like "Confirm Receipt"
    const authSupabase = await createClient()
    const { data: { user } } = await authSupabase.auth.getUser()
    const isInternalUser = !!user

    // Fetch tracking data via the SECURITY DEFINER RPC
    // Uses service_role client — bypasses RLS, returns only safe fields
    const adminSupabase = createAdminClient()
    const { data: trackingData, error } = await adminSupabase
        .rpc('get_order_tracking_data', { p_token: token })

    if (error) {
        Sentry.captureException(error, { tags: { route: 'public_tracking' } })
        notFound()
    }

    if (!trackingData) {
        notFound()  // Token not found → neutral 404, no data leak
    }

    const data = trackingData as TrackingData

    return (
        <I18nProvider>
            <TrackingPortal
                data={data}
                trackingToken={token}
                isPreview={isInternalUser}
            />
        </I18nProvider>
    )
}
