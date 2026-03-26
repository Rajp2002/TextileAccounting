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
    currentPaid: boolean
) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    // ── Zod validation ──────────────────────────────────────────────────────
    const parsed = safeParse(ToggleWorkerPaidSchema, { workerType, workerId, month, currentPaid })
    if ('error' in parsed) return { error: parsed.error }
    const { workerType: wType, workerId: wId, month: wMonth, currentPaid: wCurrentPaid } = parsed.data

    const newPaid = !wCurrentPaid

    // ── Calculate gross amount server-side ───────────────────────────────
    let calculatedAmountStr = '0'

    if (wType === 'meter') {
        const monthStart = `${wMonth}-01`
        const monthEnd = `${wMonth}-31`

        // Fetch logs with quality rate from the linked yarn batch
        // Rate is defined on the fabric quality, not on the machine.
        const { data: logs } = await supabase
            .from('production_logs')
            .select('meters, yarn_batches(qualities(default_worker_rate_per_m))')
            .eq('org_id', profile.org_id)
            .eq('worker_id', wId)
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
            .eq('id', wId)
            .eq('org_id', profile.org_id)
            .maybeSingle()

        if (workerError || !worker) return { error: 'Worker not found' }

        if (worker.role === 'daily') {
            const { count } = await supabase
                .from('attendance')
                .select('*', { count: 'exact', head: true })
                .eq('org_id', profile.org_id)
                .eq('fixed_worker_id', wId)
                .gte('date', `${wMonth}-01`)
                .lte('date', `${wMonth}-31`)
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
            p_worker_type: wType,
            p_worker_id: wId,
            p_month: wMonth,
            p_gross_amount: grossAmount
        })

        if (error) {
            console.error('Settlement failed:', error)
            return { error: 'Settlement failed. Please try again.' }
        }

        revalidatePath('/owner/payroll')
        revalidatePath('/owner/advances')
        return {
            success: true,
            amount: data?.net_amount ?? grossAmount,
            gross_amount: grossAmount,
            total_deducted: data?.total_deducted ?? 0,
            remaining_debt: data?.remaining_debt ?? 0
        }
    } else {
        const { data, error } = await supabase.rpc('unsettle_worker_payroll', {
            p_org_id: profile.org_id,
            p_worker_type: wType,
            p_worker_id: wId,
            p_month: wMonth
        })

        if (error) {
            console.error('Unsettle failed:', error)
            return { error: 'Failed to revert payment. Please try again.' }
        }

        revalidatePath('/owner/payroll')
        revalidatePath('/owner/advances')
        return {
            success: true,
            amount: grossAmount,
            reverted_advances: data?.reverted_advances ?? 0
        }
    }
}
