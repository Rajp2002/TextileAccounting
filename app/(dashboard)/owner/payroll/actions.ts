'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { calculateTotalPay, calculateDailyPay } from '@/lib/finance'
import { ToggleWorkerPaidSchema, safeParse } from '@/lib/schemas'

export async function toggleWorkerPaid(
    workerType: 'meter' | 'fixed',
    workerId: number,
    month: string,
    currentPaid: boolean,
    isFinalSettlement: boolean = false
) {
    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const newPaid = !currentPaid

    // ── Calculate gross amount server-side ───────────────────────────────
    let calculatedAmountStr = '0'

    if (workerType === 'meter') {
        const monthStart = `${month}-01`
        const monthEnd = `${month}-31`

        const { data: logs } = await supabase
            .from('production_logs')
            .select('meters, worker_rate_snapshot')
            .eq('org_id', profile.org_id)
            .eq('worker_id', workerId)
            .gte('date', monthStart)
            .lte('date', monthEnd)

        const payItems = (logs || []).map((log: any) => ({
            meters: log.meters,
            rate: log.worker_rate_snapshot || 0,
        }))

        calculatedAmountStr = calculateTotalPay(payItems)
    } else {
        const { data: worker, error: workerError } = await supabase
            .from('fixed_workers')
            .select('role, monthly_salary')
            .eq('id', workerId)
            .eq('org_id', profile.org_id)
            .maybeSingle()

        if (workerError || !worker) return { error: 'Worker not found' }

        if (worker.role === 'daily') {
            const { count } = await supabase
                .from('attendance')
                .select('*', { count: 'exact', head: true })
                .eq('org_id', profile.org_id)
                .eq('fixed_worker_id', workerId)
                .gte('date', `${month}-01`)
                .lte('date', `${month}-31`)
                .eq('present', true)

            const daysWorked = count || 0
            calculatedAmountStr = calculateDailyPay(daysWorked, worker.monthly_salary / 30)

            if (parseFloat(calculatedAmountStr) > worker.monthly_salary) {
                calculatedAmountStr = worker.monthly_salary.toString()
            }
        } else {
            calculatedAmountStr = worker.monthly_salary.toString()
        }
    }

    const grossAmount = parseFloat(calculatedAmountStr)

    // ── Use atomic RPC for settlement ────────────────────────────────────
    if (newPaid) {
        const { data, error } = await supabase.rpc('settle_worker_payroll', {
            p_org_id: profile.org_id,
            p_worker_type: workerType,
            p_worker_id: workerId,
            p_month: month,
            p_gross_amount: grossAmount,
            p_is_final_settlement: isFinalSettlement,
            p_actor_id: user.id
        })

        if (error) {
            console.error('Settlement failed:', error)
            return { error: 'Settlement failed. Please try again.' }
        }

        // ── Fire-and-forget: send payslip WhatsApp to worker ─────────────────
        const settlementId = (data as any)?.settlement_id
        if (settlementId) {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
            const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
            if (supabaseUrl && serviceRoleKey) {
                fetch(`${supabaseUrl}/functions/v1/send-payslip`, {
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
                }).catch((err) => console.error('[send-payslip] Notification failed:', err))
            }
        }

        revalidatePath('/owner/payroll')
        revalidatePath('/owner/advances')
        return {
            success: true,
            status: 'paid',
            settlement: data
        }
    } else {
        const { data, error } = await supabase.rpc('unsettle_worker_payroll', {
            p_org_id: profile.org_id,
            p_worker_type: workerType,
            p_worker_id: workerId,
            p_month: month,
            p_actor_id: user.id
        })

        if (error) {
            console.error('Unsettle failed:', error)
            return { error: 'Failed to revert payment. Please try again.' }
        }

        revalidatePath('/owner/payroll')
        revalidatePath('/owner/advances')
        return {
            success: true,
            status: 'pending',
            reverted_advances: data?.reverted_advances ?? 0
        }
    }
}
