'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { calculateTotalPay, calculateDailyPay } from '@/lib/finance'
import { AccessCodeSchema, PayrollConfigSchema, safeParse } from '@/lib/schemas'
import { getPayrollCycleBounds, getPayrollCycleStatus } from '@/lib/payroll-cycle'
import { getSuratTodayString } from '@/lib/time'
import {
    calculatePayrollManualAdjustmentTotals,
    sanitizePayrollManualAdjustments,
    type PayrollManualAdjustment,
} from '@/lib/payroll-manual-adjustments'

type PayrollProductionLog = {
    meters: number
    worker_rate_snapshot: number | null
}

type PayrollSettlementResult = {
    settlement_id?: string
}

type PayrollReversalResult = {
    reverted_advances?: number
}

export async function toggleWorkerPaid(
    workerType: 'meter' | 'fixed',
    workerId: number,
    month: string,
    currentPaid: boolean,
    isFinalSettlement: boolean = false,
    manualDeductionOverride: number | null = null,
    cycleStartDate: string | null = null,
    paymentMode: 'cash' | 'bank_transfer' | 'upi' | 'cheque' | null = null,
    manualAdjustments: PayrollManualAdjustment[] = [],
    verifiedByOwner: boolean = false,
    accessCode?: string
) {
    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    let reversalAccessCode: string | null = null

    if (currentPaid) {
        if (!accessCode) {
            return { error: 'Access code is required for reversal.' }
        }
        const parsedAccessCode = safeParse(AccessCodeSchema, accessCode)
        if ('error' in parsedAccessCode) {
            return { error: parsedAccessCode.error }
        }
        reversalAccessCode = parsedAccessCode.data
    }

    const newPaid = !currentPaid

    // 1. Get Cycle Config and derive bounds
    const { data: config } = await supabase
        .from('payroll_configs')
        .select('cycle_start_day, pay_date_day, pay_reminder_days')
        .eq('org_id', profile.org_id)
        .maybeSingle()
    
    const cycleStartDay = config?.cycle_start_day || 1
    const payDateDay = config?.pay_date_day || 10
    const payReminderDays = config?.pay_reminder_days ?? 3
    const bounds = getPayrollCycleBounds(month, cycleStartDay)
    const monthStart = bounds.cycle_start
    const monthEnd = bounds.cycle_end
    const cycleStatus = getPayrollCycleStatus(month, cycleStartDay, payDateDay, getSuratTodayString(), payReminderDays)
    
    let cycleStart = cycleStartDate
    if (newPaid && !cycleStart) {
        cycleStart = monthStart
    }

    if (newPaid && !isFinalSettlement && !cycleStatus.is_payroll_window_open) {
        return { error: `Payroll for this cycle is scheduled for ${cycleStatus.pay_date}. It opens ${payReminderDays} day${payReminderDays === 1 ? '' : 's'} before pay date.` }
    }

    // ── Calculate gross amount server-side ───────────────────────────────
    let calculatedAmountStr = '0'

    if (workerType === 'meter') {

        const { data: logs } = await supabase
            .from('production_logs')
            .select('meters, worker_rate_snapshot')
            .eq('org_id', profile.org_id)
            .eq('worker_id', workerId)
            .gt('meters', 0)
            .gte('date', monthStart)
            .lte('date', monthEnd)

        const payItems = ((logs || []) as PayrollProductionLog[]).map((log) => ({
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
                .gte('date', monthStart)
                .lte('date', monthEnd)
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
        if (!paymentMode) {
            return { error: 'Payment mode is required.' }
        }

        if (!verifiedByOwner) {
            return { error: 'Owner verification is required before confirming payroll.' }
        }

        const parsedAdjustments = sanitizePayrollManualAdjustments(manualAdjustments)
        if (!parsedAdjustments.success) {
            return { error: parsedAdjustments.error }
        }

        const adjustmentTotals = calculatePayrollManualAdjustmentTotals(parsedAdjustments.data)
        const adjustedGrossAmount = grossAmount + adjustmentTotals.manualAdjustmentTotal
        if (adjustedGrossAmount < 0) {
            return { error: 'Kapaat cannot make the final payout negative.' }
        }

        const { data, error } = await supabase.rpc('settle_worker_payroll_hardened', {
            p_org_id: profile.org_id,
            p_worker_type: workerType,
            p_worker_id: workerId,
            p_cycle_start: cycleStart,
            p_gross_amount: grossAmount,
            p_is_final_settlement: isFinalSettlement,
            p_manual_deduction_override: manualDeductionOverride,
            p_actor_id: user.id,
            p_payment_mode: paymentMode,
            p_manual_adjustments: parsedAdjustments.data,
            p_verified_by_owner: verifiedByOwner,
        })

        if (error) {
            console.error('Settlement failed:', error)
            return { error: error.message || 'Settlement failed. Please try again.' }
        }

        // ── Fire-and-forget: send payslip WhatsApp to worker ─────────────────
        const settlementId = (data as PayrollSettlementResult | null)?.settlement_id
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
        const { data, error } = await supabase.rpc('unsettle_worker_payroll_hardened', {
            p_org_id: profile.org_id,
            p_worker_type: workerType,
            p_worker_id: workerId,
            p_month: month,
            p_actor_id: user.id,
            p_access_code: reversalAccessCode
        })

        if (error) {
            console.error('Unsettle failed:', error)
            return { error: error.message || 'Failed to revert payment. Please try again.' }
        }

        revalidatePath('/owner/payroll')
        revalidatePath('/owner/advances')
        return {
            success: true,
            status: 'pending',
            reverted_advances: (data as PayrollReversalResult | null)?.reverted_advances ?? 0
        }
    }
}

export async function createPayrollAdjustment(input: {
    workerType: 'meter' | 'fixed'
    workerId: number
    month: string
    cycleStartDay: number
    categoryId: string
    amount: number
    description?: string
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    if (!input.categoryId || !input.amount || input.amount <= 0) {
        return { error: 'Valid category and amount are required.' }
    }

    const bounds = getPayrollCycleBounds(input.month, input.cycleStartDay)
    const cycleStart = bounds.cycle_start

    const payload: Record<string, string | number> = {
        org_id: profile.org_id,
        worker_type: input.workerType,
        category_id: input.categoryId,
        amount: input.amount,
        cycle_start_date: cycleStart,
    }

    payload[input.workerType === 'meter' ? 'meter_worker_id' : 'fixed_worker_id'] = input.workerId
    if (input.description?.trim()) {
        payload.description = input.description.trim()
    }

    const { error } = await supabase.from('payroll_adjustments').insert(payload)
    if (error) {
        return { error: error.message || 'Failed to add adjustment.' }
    }

    revalidatePath('/owner/payroll')
    return { success: true }
}

export async function savePayrollConfig(cycleStartDay: number, payDateDay = 10, payReminderDays = 3) {
    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const parsed = safeParse(PayrollConfigSchema, { cycleStartDay, payDateDay, payReminderDays })
    if ('error' in parsed) return { error: parsed.error }

    try {
        await supabase.rpc('set_actor_for_audit', { p_actor_id: user.id })
    } catch {
        // Non-fatal: the trigger falls back to auth.uid() when the helper is unavailable.
    }

    const { error } = await supabase
        .from('payroll_configs')
        .upsert({
            org_id: profile.org_id,
            cycle_start_day: parsed.data.cycleStartDay,
            pay_date_day: parsed.data.payDateDay,
            pay_reminder_days: parsed.data.payReminderDays,
            updated_at: new Date().toISOString()
        }, { onConflict: 'org_id' })

    if (error) {
        console.error('Failed to save payroll config:', error)
        return {
            error: error.message?.includes('record "new" has no field "id"')
                ? 'Payroll settings could not be audited because the database trigger is outdated. Please retry after the latest migration is applied.'
                : error.message || 'Failed to save payroll settings. Please try again.',
        }
    }

    revalidatePath('/owner/payroll')
    return { success: true }
}
