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

    let calculatedAmountStr = "0"

    // Server-side calculation
    if (workerType === 'meter') {
        const monthStart = `${month}-01`
        const monthEnd = `${month}-31`

        // Fetch logs
        const { data: logs } = await supabase
            .from('production_logs')
            .select('machine_id, meters')
            .eq('org_id', profile.org_id)
            .eq('worker_id', workerId)
            .gte('date', monthStart)
            .lte('date', monthEnd)

        // Fetch machines for rates
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
            // daily rate = monthly_salary / 30, use calculateDailyPay equivalent math
            calculatedAmountStr = calculateDailyPay(daysWorked, worker.monthly_salary / 30)

            // Just to cap it logically, even if finance.ts handles the multiply safely
            if (parseFloat(calculatedAmountStr) > worker.monthly_salary) {
                calculatedAmountStr = worker.monthly_salary.toString()
            }
        } else {
            calculatedAmountStr = worker.monthly_salary.toString()
        }
    }

    const calculatedAmount = parseFloat(calculatedAmountStr)

    // NOTE: For the fixed schema we use the proper column (fixed_worker_id / meter_worker_id)
    const record: any = {
        org_id: profile.org_id,
        worker_type: workerType,
        month: month,
        amount: calculatedAmount,
        paid: newPaid,
        paid_at: newPaid ? new Date().toISOString() : null,
    }

    if (workerType === 'meter') {
        record.meter_worker_id = workerId
    } else {
        record.fixed_worker_id = workerId
    }

    let existing: any = null
    if (workerType === 'meter') {
        const { data } = await supabase
            .from('payroll_payments')
            .select('id')
            .eq('org_id', profile.org_id)
            .eq('meter_worker_id', workerId)
            .eq('month', month)
            .maybeSingle()
        existing = data
    } else {
        const { data } = await supabase
            .from('payroll_payments')
            .select('id')
            .eq('org_id', profile.org_id)
            .eq('fixed_worker_id', workerId)
            .eq('month', month)
            .maybeSingle()
        existing = data
    }

    if (existing) {
        const { error } = await supabase
            .from('payroll_payments')
            .update(record)
            .eq('id', existing.id)

        if (error) {
            throw new Error(`Update failed: ${error.message}`)
        }
    } else {
        const { error } = await supabase
            .from('payroll_payments')
            .insert(record)

        if (error) {
            throw new Error(`Insert failed: ${error.message}`)
        }
    }

    revalidatePath('/owner/payroll')
    return { success: true, amount: calculatedAmount }
}
