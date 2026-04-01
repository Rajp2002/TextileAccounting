'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

/**
 * Create a safety incident and fire a WhatsApp alert if severity = 'critical'.
 * Called from IncidentsClient when submitting the incident report form.
 */
export async function createIncident(data: {
    org_id: string
    date: string
    title: string
    description?: string | null
    severity: 'minor' | 'major' | 'critical'
    reported_by: string
    worker_id?: string | null
}) {
    // Both owner and supervisor can report incidents
    await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const { data: inserted, error } = await supabase
        .from('incidents')
        .insert([{
            org_id: data.org_id,
            date: data.date,
            title: data.title,
            description: data.description ?? null,
            severity: data.severity,
            reported_by: data.reported_by,
            worker_id: data.worker_id ?? null,
        }])
        .select('id')
        .single()

    if (error) {
        console.error('Failed to create incident:', error)
        return { error: 'Failed to report incident. Please try again.' }
    }

    // ── Fire-and-forget: send critical safety alert to owner's WhatsApp ───────
    // Non-blocking — incident record is created whether or not notification succeeds.
    if (data.severity === 'critical' && inserted?.id) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (supabaseUrl && serviceRoleKey) {
            fetch(`${supabaseUrl}/functions/v1/send-safety-alert`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${serviceRoleKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    org_id: data.org_id,
                    incident_id: inserted.id,
                }),
            }).catch((err) => console.error('[send-safety-alert] Notification failed:', err))
        }
    }

    return { success: true, incident_id: inserted?.id }
}
