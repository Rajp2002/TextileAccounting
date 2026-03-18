'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

import { calculateTotalPay, calculateDailyPay } from '@/lib/finance'

export async function toggleWorkerPaid(
    workerType: 'meter' | 'fixed',
    workerId: number,
    month: string,
    currentPaid: boolean
) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    const newPaid = !currentPaid

    // ── Calculate gross amount server-side ───────────────────────────────
    let calculatedAmountStr = "0"

    if (workerType === 'meter') {
        const monthStart = `${month}-01`
        const monthEnd = `${month}-31`

        const { data: logs } = await supabase
            .from('production_logs')
            .select('machine_id, meters')
            .eq('org_id', profile.org_id)
            .eq('worker_id', workerId)
            .gte('date', monthStart)
            .lte('date', monthEnd)

        const { data: machines } = await supabase
            .from('machines')
            .select('id, rate_per_meter')
            .eq('org_id', profile.org_id)

        const machineMap = Object.fromEntries((machines || []).map(m => [m.id, m]))

        const payItems = (logs || []).map(log => ({
            meters: log.meters,
            rate: machineMap[log.machine_id]?.rate_per_meter || 0
        }))

        calculatedAmountStr = calculateTotalPay(payItems)

    } else {
        const { data: worker, error: workerError } = await supabase
            .from('fixed_workers')
            .select('role, monthly_salary')
            .eq('id', workerId)
            .eq('org_id', profile.org_id)
            .maybeSingle()

        if (workerError || !worker) throw new Error('Worker not found')

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
        // SETTLE: atomically mark paid + deduct pending advances
        const { data, error } = await supabase.rpc('settle_worker_payroll', {
            p_org_id: profile.org_id,
            p_worker_type: workerType,
            p_worker_id: workerId,
            p_month: month,
            p_gross_amount: grossAmount
        })

        if (error) {
            throw new Error(`Settlement failed: ${error.message}`)
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
        // UNSETTLE: atomically revert paid + restore advances for this cycle
        const { data, error } = await supabase.rpc('unsettle_worker_payroll', {
            p_org_id: profile.org_id,
            p_worker_type: workerType,
            p_worker_id: workerId,
            p_month: month
        })

        if (error) {
            throw new Error(`Unsettle failed: ${error.message}`)
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
