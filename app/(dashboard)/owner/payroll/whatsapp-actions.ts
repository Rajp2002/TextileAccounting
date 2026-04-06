'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

/**
 * Trigger a WhatsApp payslip delivery to a worker via the send-payslip edge function.
 * Can be called on-demand from the payroll page (e.g. re-send after settlement).
 */
export async function sendPayslipWhatsApp(
    workerId: number,
    workerType: 'meter' | 'fixed',
    settlementId: number
): Promise<{ success?: boolean; skipped?: boolean; reason?: string; error?: string }> {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    // Verify settlement belongs to this org (security check)
    const { data: settlement, error: settlementError } = await supabase
        .from('payroll_settlements')
        .select('id, meter_worker_id, fixed_worker_id')
        .eq('id', settlementId)
        .eq('org_id', profile.org_id)
        .maybeSingle()

    if (settlementError || !settlement) {
        return { error: 'Settlement not found or access denied.' }
    }

    // Verify worker ID matches the settlement row
    const expectedWorkerId = workerType === 'meter'
        ? settlement.meter_worker_id
        : settlement.fixed_worker_id

    if (expectedWorkerId !== workerId) {
        return { error: 'Worker/settlement mismatch.' }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
        return { error: 'Server configuration error.' }
    }

    try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-payslip`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                org_id: profile.org_id,
                worker_id: workerId,
                worker_type: workerType,
                settlement_id: settlementId,
            }),
        })

        const json = await res.json().catch(() => ({}))

        if (!res.ok) {
            console.error('[sendPayslipWhatsApp] Edge function error:', json)
            return { error: 'Failed to send message. Please try again.' }
        }

        // Edge function returns { success, skipped, reason, worker }
        if (json.skipped) {
            return { skipped: true, reason: json.reason ?? 'Worker has no WhatsApp number.' }
        }

        return { success: json.success === true }
    } catch (err) {
        console.error('[sendPayslipWhatsApp] Fetch error:', err)
        return { error: 'Network error. Please try again.' }
    }
}
