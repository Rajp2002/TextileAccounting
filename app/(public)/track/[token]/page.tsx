import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import TrackingPortal from './TrackingPortal'
import type { Metadata } from 'next'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TrackingDispatch {
    id: string
    dispatch_number: number
    qty_meters_sent: number
    qty_meters_received: number | null
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
    const supabase = createAdminClient()
    const { data } = await supabase.rpc('get_order_tracking_data', { p_token: token })

    if (!data) {
        return { title: 'Order Not Found · Weavly' }
    }

    return {
        title: `${data.party_name}'s Order · Weavly Tracking`,
        description: `Track fabric order for ${data.party_name} — ${data.meters_produced} of ${data.total_target_meters} metres produced.`,
    }
}

import { createClient } from '@/lib/supabase/server'

export default async function TrackingPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params

    // Basic token format validation — prevents trivially malformed lookups
    if (!token || token.length < 8 || token.length > 64) {
        notFound()
    }

    // Check if the current visitor is an internal team member (Owner/Supervisor)
    // to enable "Preview Mode" and disable actions like "Confirm Receipt"
    const authSupabase = await createClient()
    const { data: { session } } = await authSupabase.auth.getSession()
    const isInternalUser = !!session

    // Fetch tracking data via the SECURITY DEFINER RPC
    // Uses service_role client — bypasses RLS, returns only safe fields
    const adminSupabase = createAdminClient()
    const { data: trackingData, error } = await adminSupabase
        .rpc('get_order_tracking_data', { p_token: token })

    if (error) {
        console.error('[TrackingPage] RPC error:', error.message)
        notFound()
    }

    if (!trackingData) {
        notFound()  // Token not found → neutral 404, no data leak
    }

    const data = trackingData as TrackingData

    return (
        <TrackingPortal
            data={data}
            trackingToken={token}
            isPreview={isInternalUser}
        />
    )
}
