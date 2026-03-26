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
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const newPaid = !currentPaid

    // ── Calculate gross amount server-side ───────────────────────────────
    let calculatedAmountStr = '0'

    if (workerType === 'meter') {
        const monthStart = `${month}-01`
        const monthEnd = `${month}-31`

        const { data: logs } = await supabase
            .from('production_logs')
            .select('meters, yarn_batches(qualities(default_worker_rate_per_m))')
            .eq('org_id', profile.org_id)
            .eq('worker_id', workerId)
            .gte('date', monthStart)
            .lte('date', monthEnd)

        const payItems = (logs || []).map((log: any) => ({
            meters: log.meters,
            rate: (log.yarn_batches as any)?.qualities?.default_worker_rate_per_m || 0
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
            p_is_final_settlement: isFinalSettlement
        })

        if (error) {
            console.error('Settlement failed:', error)
            return { error: 'Settlement failed. Please try again.' }
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
            p_month: month
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
