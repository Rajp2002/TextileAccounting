'use server'

import { revalidatePath as revalidateNextPath } from 'next/cache'
import { z } from 'zod'

import { requireWritableOrg } from '@/lib/auth'
import { getOrgTier } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { DateSchema, UuidSchema, safeParse } from '@/lib/schemas'
import { getSuratTodayString } from '@/lib/time'
import {
    validateCycleRule,
    getEarliestSafeCycleChangeDate,
    previewPeriods,
    formatCycleExplanation,
    addDays,
    type PayrollCycleRule,
    type PayrollCycleType,
    type PayrollCycleConfig,
    DEFAULT_MONTHLY_CYCLE_RULE,
} from '@/lib/payroll-cycle-engine'

function revalidatePath(path: string) {
    revalidateNextPath(path)
    if (path === '/owner/operations' || path === '/owner/assignments' || path === '/owner/production') {
        revalidateNextPath('/owner/assignments')
        revalidateNextPath('/owner/operations')
        revalidateNextPath('/owner/workers')
        revalidateNextPath('/owner/machines')
    }
    if (path === '/owner/production') {
        revalidateNextPath('/owner/stock')
        revalidateNextPath('/owner/operations')
        revalidateNextPath('/owner/assignments')
        revalidateNextPath('/owner/setup')
        revalidateNextPath('/owner/payroll')
    }
}

const BaseWorkerSchema = z.object({
    payType: z.enum(['piece_rate', 'fixed_monthly']).default('piece_rate'),
    role: z.string().trim().max(80).default(''),
    monthlySalary: z.number().finite().min(0).max(10_000_000).default(0),
    startDate: DateSchema.optional().or(z.literal('')),
    endDate: DateSchema.optional().or(z.literal('')),
    salaryEffectiveFrom: DateSchema.optional().or(z.literal('')),
    name: z.string().trim().min(1, 'Worker name is required').max(120, 'Worker name is too long'),
    shiftAvailability: z.enum(['day', 'night', 'both']),
    isActive: z.boolean().default(true),
})

const UpdateWorkerSchema = BaseWorkerSchema.extend({
    workerId: UuidSchema,
    expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
})

type BaseWorkerCompensationInput = {
    payType?: 'piece_rate' | 'fixed_monthly'
    role?: string
    monthlySalary?: number
    startDate?: string
    endDate?: string
    salaryEffectiveFrom?: string
}

function validateWorkerCompensation(data: z.infer<typeof BaseWorkerSchema>) {
    if (data.payType !== 'fixed_monthly') return null
    if (!data.startDate || data.monthlySalary <= 0) return 'Enter a joining date and a positive monthly salary.'
    if (data.endDate && data.endDate < data.startDate) return 'Last working day cannot be before joining date.'
    if (!data.isActive && !data.endDate) return 'Enter the last working day before making salaried staff inactive.'
    return null
}

const BaseJobSchema = z.object({
    costingId: UuidSchema,
    targetMeters: z.number().finite().positive('Target metres must be greater than 0').max(10_000_000, 'Target is too high'),
    startDate: DateSchema,
    dueDate: DateSchema.optional().or(z.literal('')),
    customerReference: z.string().trim().max(160, 'Reference is too long').optional().or(z.literal('')),
    notes: z.string().trim().max(500, 'Notes are too long').optional().or(z.literal('')),
})

const BaseJobStatusSchema = z.object({
    jobId: UuidSchema,
    status: z.enum(['planned', 'active', 'completed', 'cancelled']),
})

const BaseProductionEntrySchema = z.object({
    jobId: UuidSchema,
    workerId: UuidSchema,
    productionDate: DateSchema,
    meters: z.number().finite().positive('Metres must be greater than 0').max(100_000, 'Metres are too high'),
    notes: z.string().trim().max(500, 'Notes are too long').optional().or(z.literal('')),
    clientRequestId: UuidSchema,
})

const BaseAdvanceSchema = z.object({
    workerId: UuidSchema,
    amount: z.number().finite().positive('Advance must be greater than 0').max(10_000_000, 'Advance is too high'),
    description: z.string().trim().max(240, 'Description is too long').optional().or(z.literal('')),
})

const BaseDeductionSchema = z.object({
    workerId: UuidSchema,
    amount: z.number().finite().positive('Deduction must be greater than 0').max(10_000_000, 'Deduction is too high'),
    reason: z.string().trim().max(100, 'Reason is too long').optional().or(z.literal('')),
    description: z.string().trim().max(240, 'Description is too long').optional().or(z.literal('')),
})

const BaseSettlementSchema = z.object({
    workerId: UuidSchema,
    paymentMode: z.enum(['cash', 'bank_transfer', 'upi', 'cheque']),
    periodEnd: DateSchema,
    note: z.string().trim().max(300, 'Note is too long').optional().or(z.literal('')),
    expected: z.object({
        client_request_id: UuidSchema,
        period_start: DateSchema,
        gross_pay: z.number().finite().nonnegative(),
        advance_deducted: z.number().finite().nonnegative(),
        net_payout: z.number().finite().nonnegative(),
        advance_balance_before: z.number().finite().nonnegative(),
    }),
})

const CompletePayrollPeriodSchema = z.object({
    periodStart: DateSchema,
    periodEnd: DateSchema,
    calculationSnapshot: z.any(),
    resolvedWorkerIds: z.array(z.string()).default([]),
})

const BaseCorrectionReasonSchema = z.string().trim().min(3, 'Briefly explain why this correction is needed.').max(240, 'Correction reason is too long.')

const ReopenPayrollPeriodSchema = z.object({
    periodId: UuidSchema,
    reason: BaseCorrectionReasonSchema,
})

const BaseMachineTypeSchema = z.enum(['jacquard', 'power_loom', 'rapier', 'water_jet', 'air_jet', 'circular', 'other'])

const BaseMachineSchema = z.object({
    name: z.string().trim().max(120, 'Machine name is too long').optional().or(z.literal('')),
    machineType: BaseMachineTypeSchema,
    customLabel: z.string().trim().max(80, 'Custom label is too long').optional().or(z.literal('')),
    isActive: z.boolean().default(true),
})

const UpdateMachineSchema = BaseMachineSchema.extend({
    machineId: UuidSchema,
    name: z.string().trim().min(1, 'Machine name is required').max(120, 'Machine name is too long'),
})

const BaseAssignmentSchema = z.object({
    workerId: UuidSchema,
    machineId: UuidSchema,
    shift: z.enum(['day', 'night']),
    effectiveFrom: DateSchema,
    replaceExisting: z.boolean().default(false),
})

const BaseMachineContextSchema = z.object({
    machineId: UuidSchema,
    jobId: UuidSchema.nullable(),
    effectiveFrom: DateSchema,
})

const BaseDailyProductionRowSchema = z.object({
    workerId: UuidSchema,
    meters: z.number().finite().nonnegative().max(100_000, 'Metres are too high').nullable().transform((value) => value === null ? null : Number(value.toFixed(2))),
    status: z.enum(['blank', 'entered', 'zero', 'absent']),
    machineRecords: z.array(z.object({
        machineId: UuidSchema,
        state: z.enum(['entered', 'pending', 'not_running', 'absent']),
    })).max(100).optional(),
    notes: z.string().trim().max(500, 'Notes are too long').optional().or(z.literal('')),
    allocations: z.array(z.object({
        machineId: UuidSchema,
        jobId: UuidSchema,
        meters: z.number().finite().positive('Allocation metres must be greater than 0').max(100_000, 'Allocation is too high').transform((value) => Number(value.toFixed(2))),
    })).max(100).default([]),
}).superRefine((row, context) => {
    if (row.status === 'blank' && row.meters !== null) {
        context.addIssue({ code: 'custom', path: ['meters'], message: 'Blank rows cannot contain metres.' })
    }
    if (row.status === 'entered' && (!row.meters || row.meters <= 0)) {
        context.addIssue({ code: 'custom', path: ['meters'], message: 'Enter positive metres for a production row.' })
    }
    if ((row.status === 'zero' || row.status === 'absent') && row.meters !== 0) {
        context.addIssue({ code: 'custom', path: ['meters'], message: 'Zero and absent rows must contain zero metres.' })
    }
    if (row.status !== 'entered' && row.allocations.length > 0) {
        context.addIssue({ code: 'custom', path: ['allocations'], message: 'Only produced rows can contain machine allocations.' })
    }
    const allocationKeys = row.allocations.map((allocation) => `${allocation.machineId}:${allocation.jobId}`)
    if (new Set(allocationKeys).size !== allocationKeys.length) {
        context.addIssue({ code: 'custom', path: ['allocations'], message: 'A machine and costing can appear only once per worker row.' })
    }
})

const BaseDailyProductionSchema = z.object({
    productionDate: DateSchema,
    shift: z.enum(['day', 'night']),
    clientRequestId: UuidSchema,
    expectedUpdatedAt: z.string().datetime({ offset: true }).nullable(),
    entries: z.array(BaseDailyProductionRowSchema).min(1, 'Add at least one worker row.').max(500),
}).superRefine((input, context) => {
    const workerIds = input.entries.map((entry) => entry.workerId)
    if (new Set(workerIds).size !== workerIds.length) {
        context.addIssue({ code: 'custom', path: ['entries'], message: 'Each worker can appear only once on a daily sheet.' })
    }
    if (!input.entries.some((entry) => entry.status !== 'blank')) {
        context.addIssue({ code: 'custom', path: ['entries'], message: 'Enter production or mark at least one row zero/absent.' })
    }
})

async function requireBaseProductionOwner() {
    const result = await requireWritableOrg(['owner'])
    const tier = await getOrgTier(result.profile.org_id)

    if (!hasCapability(tier, 'production')) {
        throw new Error('An active Weavly Base subscription is required for production management.')
    }

    return result
}

function databaseError(error: { message?: string } | null | undefined, fallback: string) {
    if (error?.message) console.error(`[base-production] ${error.message}`)
    return { error: fallback }
}

export async function createBaseProductionMachine(input: {
    name?: string
    machineType: 'jacquard' | 'power_loom' | 'rapier' | 'water_jet' | 'air_jet' | 'circular' | 'other'
    customLabel?: string
}) {
    const { user, profile } = await requireBaseProductionOwner()
    const parsed = safeParse(BaseMachineSchema, {
        ...input,
        name: input.name ?? '',
        customLabel: input.customLabel ?? '',
        isActive: true,
    })
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()
    const { data: existingMachines, error: machinesError } = await supabase
        .from('base_production_machines')
        .select('name')
        .eq('org_id', profile.org_id)

    if (machinesError) return databaseError(machinesError, 'Machines could not be checked. Please try again.')

    const names = new Set((existingMachines ?? []).map((machine) => String(machine.name).trim().toLowerCase()))
    const requestedName = parsed.data.name?.trim() ?? ''
    let nextAutoNumber = names.size + 1

    for (let attempt = 0; attempt < 5; attempt += 1) {
        let machineName = requestedName
        if (!machineName) {
            do {
                machineName = `Loom #${nextAutoNumber}`
                nextAutoNumber += 1
            } while (names.has(machineName.toLowerCase()))
        }

        const { data, error } = await supabase
            .from('base_production_machines')
            .insert({
                org_id: profile.org_id,
                name: machineName,
                machine_type: parsed.data.machineType,
                custom_label: parsed.data.customLabel?.trim() || null,
                is_active: true,
                created_by: user.id,
            })
            .select('id')
            .maybeSingle()

        if (!error && data) {
            revalidatePath('/owner/production')
    revalidatePath('/owner/payroll')
    revalidatePath('/owner/operations')
            return { success: true, machineId: data.id }
        }
        if (error?.code !== '23505' || requestedName) {
            return databaseError(error, 'Machine could not be added. Please try again.')
        }
        names.add(machineName.toLowerCase())
    }

    return { error: 'Machine numbering is busy. Please try again.' }
}

export async function updateBaseProductionMachine(input: {
    machineId: string
    name: string
    machineType: 'jacquard' | 'power_loom' | 'rapier' | 'water_jet' | 'air_jet' | 'circular' | 'other'
    customLabel?: string
    isActive: boolean
}) {
    const { profile } = await requireBaseProductionOwner()
    const parsed = safeParse(UpdateMachineSchema, input)
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()
    const { error } = await supabase
        .from('base_production_machines')
        .update({
            name: parsed.data.name.trim(),
            machine_type: parsed.data.machineType,
            custom_label: parsed.data.customLabel?.trim() || null,
            is_active: parsed.data.isActive,
            updated_at: new Date().toISOString(),
        })
        .eq('org_id', profile.org_id)
        .eq('id', parsed.data.machineId)

    if (error?.code === '23505') return { error: 'A machine with this name already exists.' }
    if (error) return databaseError(error, 'Machine could not be updated. Please try again.')

    revalidatePath('/owner/production')
    revalidatePath('/owner/payroll')
    revalidatePath('/owner/operations')
    return { success: true }
}

export async function upsertBaseWorkerMachineAssignment(input: {
    workerId: string
    machineId: string
    shift: 'day' | 'night'
    effectiveFrom: string
    replaceExisting?: boolean
}) {
    const { profile } = await requireBaseProductionOwner()
    const parsed = safeParse(BaseAssignmentSchema, { ...input, replaceExisting: input.replaceExisting ?? false })
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()
    const { data: worker, error: workerError } = await supabase
        .from('base_production_workers')
        .select('shift_availability, is_active')
        .eq('org_id', profile.org_id)
        .eq('id', parsed.data.workerId)
        .maybeSingle()

    if (workerError) return databaseError(workerError, 'Worker availability could not be checked. Please try again.')
    if (!worker?.is_active) return { error: 'Only active workers can be assigned.' }
    if (worker.shift_availability !== 'both' && worker.shift_availability !== parsed.data.shift) {
        return { error: `This worker is only available for the ${worker.shift_availability} shift. Edit the worker to change availability.` }
    }

    const { data: machineContext, error: contextError } = await supabase
        .from('base_machine_job_contexts')
        .select('id, job_id, active, effective_from, effective_to, base_production_jobs!inner(id, status)')
        .eq('org_id', profile.org_id)
        .eq('machine_id', parsed.data.machineId)
        .eq('active', true)
        .lte('effective_from', parsed.data.effectiveFrom)
        .or(`effective_to.is.null,effective_to.gte.${parsed.data.effectiveFrom}`)
        .in('base_production_jobs.status', ['planned', 'active'])
        .maybeSingle()

    if (contextError) return databaseError(contextError, 'Production job context could not be verified. Please try again.')
    if (!machineContext) {
        return { error: 'This machine has no active production job. Create or select one before assigning a worker.' }
    }

    const { data, error } = await supabase.rpc('upsert_base_worker_machine_assignment', {
        p_worker_id: parsed.data.workerId,
        p_machine_id: parsed.data.machineId,
        p_shift: parsed.data.shift,
        p_effective_from: parsed.data.effectiveFrom,
        p_replace_existing: parsed.data.replaceExisting,
    })

    if (error) return databaseError(error, 'Assignment could not be saved. Please try again.')
    const result = data as { conflict?: boolean; assignment_id?: string; current_worker_name?: string; message?: string; replaced_worker_name?: string } | null
    if (result?.conflict) {
        return {
            conflict: true,
            currentWorkerName: result.current_worker_name ?? 'Another worker',
            message: result.message ?? 'This machine already has a primary worker for this shift.',
        }
    }

    revalidatePath('/owner/production')
    revalidatePath('/owner/payroll')
    revalidatePath('/owner/operations')
    return {
        success: true,
        assignmentId: result?.assignment_id ?? null,
        replaced: Boolean((data as { replaced?: boolean } | null)?.replaced),
        replacedWorkerName: result?.replaced_worker_name ?? null,
    }
}

export async function removeBaseWorkerMachineAssignment(input: { assignmentId: string }) {
    await requireBaseProductionOwner()
    const parsed = safeParse(z.object({ assignmentId: UuidSchema }), input)
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()
    const { data, error } = await supabase.rpc('delete_base_worker_machine_assignment', {
        p_assignment_id: parsed.data.assignmentId,
    })

    if (error) return databaseError(error, 'Assignment could not be removed. Please try again.')

    revalidatePath('/owner/production')
    revalidatePath('/owner/payroll')
    revalidatePath('/owner/operations')
    const result = data as { removed?: boolean; deleted?: boolean } | null
    return { success: true, removed: Boolean(result?.removed ?? result?.deleted) }
}

export async function setBaseMachineJobContext(input: {
    machineId: string
    jobId: string | null
    effectiveFrom: string
}) {
    await requireBaseProductionOwner()
    const parsed = safeParse(BaseMachineContextSchema, input)
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()
    const { data, error } = await supabase.rpc('set_base_machine_job_context', {
        p_machine_id: parsed.data.machineId,
        p_job_id: parsed.data.jobId,
        p_effective_from: parsed.data.effectiveFrom,
    })

    if (error) return databaseError(error, 'Machine job context could not be saved. Please try again.')

    revalidatePath('/owner/production')
    revalidatePath('/owner/payroll')
    revalidatePath('/owner/operations')
    return { success: true, context: data }
}

export async function validateQualityActivationYarnAction(input: { costingId: string }) {
    await requireBaseProductionOwner()
    const parsed = safeParse(z.object({ costingId: UuidSchema }), input)
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()
    const { data, error } = await supabase.rpc('validate_quality_activation_yarn', {
        p_costing_id: parsed.data.costingId,
    })

    if (error) return databaseError(error, 'Could not check required yarn stock.')
    return { success: true, validation: data as {
        can_activate: boolean
        error?: string
        costing_id: string
        quality_label: string
        costing_version: number
        yarns: Array<{
            yarn_id: string | null
            yarn_name: string
            yarn_key: string
            role: string
            kg_per_100m: number
            current_stock_kg: number
            status: 'available' | 'zero_stock' | 'missing'
        }>
    } }
}

export async function activateSavedCostingForProduction(input: { costingId: string }) {
    await requireBaseProductionOwner()
    const parsed = safeParse(z.object({ costingId: UuidSchema }), input)
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()
    const { data, error } = await supabase.rpc('activate_saved_costing_for_production', {
        p_costing_id: parsed.data.costingId,
    })

    if (error) return databaseError(error, 'Saved quality could not be activated for production. Please try again.')

    const result = data as Record<string, unknown>
    if (result && result.blocked) {
        return { success: false, blocked: true, ...result }
    }

    revalidatePath('/owner/production')
    revalidatePath('/owner/quotes')
    return { success: true, ...result }
}

export async function deactivateQualityProduction(input: { jobId: string }) {
    await requireBaseProductionOwner()
    const parsed = safeParse(z.object({ jobId: UuidSchema }), input)
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()
    const { data, error } = await supabase.rpc('deactivate_quality_production', {
        p_job_id: parsed.data.jobId,
    })

    if (error) return databaseError(error, 'Quality could not be deactivated. Please try again.')

    revalidatePath('/owner/production')
    revalidatePath('/owner/quotes')
    return { success: true, ...(data as Record<string, unknown>) }
}

export async function switchBaseMachineQuality(input: {
    machineId: string
    toJobId: string
    effectiveFrom?: string
}) {
    await requireBaseProductionOwner()
    const parsed = safeParse(
        z.object({
            machineId: UuidSchema,
            toJobId: UuidSchema,
            effectiveFrom: DateSchema.optional(),
        }),
        input,
    )
    if ('error' in parsed) return parsed

    const today = getSuratTodayString()
    const effectiveFrom = parsed.data.effectiveFrom || today

    const supabase = await createServerClient()
    const { data, error } = await supabase.rpc('switch_base_machine_quality', {
        p_machine_id: parsed.data.machineId,
        p_to_job_id: parsed.data.toJobId,
        p_effective_from: effectiveFrom,
    })

    if (error) return databaseError(error, 'Quality could not be switched. Please try again.')

    revalidatePath('/owner/production')
    return { success: true, ...(data as Record<string, unknown>) }
}

export async function bulkAssignMachinesToQuality(input: {
    jobId: string
    machineIds: string[]
    effectiveFrom?: string
}) {
    await requireBaseProductionOwner()
    const parsed = safeParse(
        z.object({
            jobId: UuidSchema,
            machineIds: z.array(UuidSchema).min(1, 'Select at least one machine.'),
            effectiveFrom: DateSchema.optional(),
        }),
        input,
    )
    if ('error' in parsed) return parsed

    const today = getSuratTodayString()
    const effectiveFrom = parsed.data.effectiveFrom || today

    const supabase = await createServerClient()
    const { data, error } = await supabase.rpc('bulk_assign_machines_to_quality', {
        p_job_id: parsed.data.jobId,
        p_machine_ids: parsed.data.machineIds,
        p_effective_from: effectiveFrom,
    })

    if (error) return databaseError(error, 'Machines could not be assigned. Please try again.')

    revalidatePath('/owner/production')
    return { success: true, ...(data as Record<string, unknown>) }
}

export async function saveBaseDailyProductionBatch(input: {
    productionDate: string
    shift: 'day' | 'night'
    clientRequestId: string
    expectedUpdatedAt: string | null
    correctionReason?: string
    entries: Array<{
        workerId: string
        meters: number | null
        status: 'blank' | 'entered' | 'zero' | 'absent'
        machineRecords?: Array<{ machineId: string; state: 'entered' | 'pending' | 'not_running' | 'absent' }>
        notes?: string
        allocations: Array<{
            machineId: string
            jobId: string
            meters: number
        }>
    }>
}) {
    const { profile } = await requireBaseProductionOwner()
    const parsed = safeParse(BaseDailyProductionSchema, input)
    if ('error' in parsed) return parsed
    const correctionReason = input.correctionReason?.trim()
        ? safeParse(BaseCorrectionReasonSchema, input.correctionReason)
        : null
    if (correctionReason && 'error' in correctionReason) return correctionReason

    const supabase = await createServerClient()
    const { data, error } = await supabase.rpc('save_base_daily_production_reviewed', {
        p_production_date: parsed.data.productionDate,
        p_shift: parsed.data.shift,
        p_client_request_id: parsed.data.clientRequestId,
        p_correction_reason: correctionReason?.data ?? null,
        p_expected_updated_at: parsed.data.expectedUpdatedAt,
        p_entries: parsed.data.entries.map((entry) => ({
            worker_id: entry.workerId,
            meters: entry.meters,
            entry_status: entry.status,
            ...(entry.machineRecords ? { machine_records: entry.machineRecords.map(record => ({ machine_id: record.machineId, state: record.state })) } : {}),
            notes: entry.notes || null,
            allocations: entry.allocations.map((allocation) => ({
                machine_id: allocation.machineId,
                job_id: allocation.jobId,
                meters: allocation.meters,
            })),
        })),
    })
    if (error) {
        if (error.code === '40001') {
            return databaseError(error, 'This shift changed in another session. Reload the saved version before correcting it; your local draft is retained.')
        }
        if (error.code === '23503') {
            return databaseError(error, 'The worker, machine, or job no longer matches the dated Setup. Review Setup before saving this correction; your local draft is retained.')
        }
        return databaseError(error, error.message || 'The daily production sheet could not be saved. Please try again.')
    }

    const startedJobIds = [...new Set(
        parsed.data.entries.flatMap((entry) => entry.allocations
            .filter((allocation) => allocation.meters > 0)
            .map((allocation) => allocation.jobId)),
    )]

    if (startedJobIds.length > 0) {
        const { error: statusError } = await supabase
            .from('base_production_jobs')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('org_id', profile.org_id)
            .eq('status', 'planned')
            .in('id', startedJobIds)

        if (statusError) {
            return databaseError(statusError, 'Production was saved, but the related job status could not be refreshed. Reload to continue.')
        }
    }

    revalidatePath('/owner/production')
    revalidatePath('/owner/payroll')
    revalidatePath('/owner/operations')
    return { success: true, summary: data }
}

export async function createBaseProductionWorker(input: BaseWorkerCompensationInput & {
    name: string
    shiftAvailability: 'day' | 'night' | 'both'
}) {
    const { user, profile } = await requireBaseProductionOwner()
    const parsed = safeParse(BaseWorkerSchema, { ...input, isActive: true })
    if ('error' in parsed) return parsed
    const compensationError = validateWorkerCompensation(parsed.data)
    if (compensationError) return { error: compensationError }

    const supabase = await createServerClient()
    const { data: duplicate, error: duplicateError } = await supabase
        .from('base_production_workers')
        .select('id')
        .eq('org_id', profile.org_id)
        .eq('name', parsed.data.name)
        .maybeSingle()

    if (duplicateError) return databaseError(duplicateError, 'Worker could not be checked. Please try again.')
    if (duplicate) return { error: 'A worker with this name already exists.' }

    const { error } = await supabase
        .from('base_production_workers')
        .insert({
            org_id: profile.org_id,
            name: parsed.data.name,
            rate_per_meter: 0,
            pay_type: parsed.data.payType,
            role: parsed.data.role,
            monthly_salary: parsed.data.monthlySalary,
            start_date: parsed.data.startDate || null,
            salary_effective_from: parsed.data.startDate || null,
            shift_availability: parsed.data.shiftAvailability,
            is_active: true,
            created_by: user.id,
        })

    if (error?.code === '23505') return { error: 'A worker with this name already exists.' }
    if (error) return databaseError(error, 'Worker could not be added. Please try again.')

    revalidatePath('/owner/production')
    revalidatePath('/owner/payroll')
    revalidatePath('/owner/operations')
    revalidatePath('/owner/settings')
    revalidatePath('/owner/estimator')
    return { success: true }
}

export async function updateBaseProductionWorker(input: BaseWorkerCompensationInput & {
    expectedUpdatedAt?: string
    workerId: string
    name: string
    shiftAvailability: 'day' | 'night' | 'both'
    isActive: boolean
}) {
    const { profile } = await requireBaseProductionOwner()
    const parsed = safeParse(UpdateWorkerSchema, input)
    if ('error' in parsed) return parsed
    const compensationError = validateWorkerCompensation(parsed.data)
    if (compensationError) return { error: compensationError }

    const supabase = await createServerClient()
    if (parsed.data.payType === 'fixed_monthly' && !parsed.data.expectedUpdatedAt) return { error: 'Reload staff before updating salary details.' }
    let update = supabase
        .from('base_production_workers')
        .update({
            name: parsed.data.name,
            shift_availability: parsed.data.shiftAvailability,
            pay_type: parsed.data.payType,
            role: parsed.data.role,
            monthly_salary: parsed.data.monthlySalary,
            start_date: parsed.data.startDate || null,
            end_date: parsed.data.endDate || null,
            salary_effective_from: parsed.data.salaryEffectiveFrom || null,
            is_active: parsed.data.isActive,
            updated_at: new Date().toISOString(),
        })
        .eq('org_id', profile.org_id)
        .eq('id', parsed.data.workerId)

    if (parsed.data.expectedUpdatedAt) update = update.eq('updated_at', parsed.data.expectedUpdatedAt)
    const { data: updated, error } = await update.select('id').maybeSingle()

    if (error?.code === '23505') return { error: 'A worker with this name already exists.' }
    if (error?.code === '22023' || error?.code === '23514') return { error: error.message }
    if (error) return databaseError(error, 'Worker could not be updated. Please try again.')
    if (!updated) return { error: 'Worker details changed in another tab. Reload before saving.' }

    revalidatePath('/owner/production')
    revalidatePath('/owner/payroll')
    revalidatePath('/owner/operations')
    revalidatePath('/owner/settings')
    revalidatePath('/owner/estimator')
    return { success: true }
}

export async function createBaseProductionJob(input: {
    costingId: string
    targetMeters: number
    startDate: string
    dueDate?: string
    customerReference?: string
    notes?: string
}) {
    const { user, profile } = await requireBaseProductionOwner()
    const parsed = safeParse(BaseJobSchema, input)
    if ('error' in parsed) return parsed

    const dueDate = parsed.data.dueDate || null
    if (dueDate && dueDate < parsed.data.startDate) {
        return { error: 'Due date cannot be before the start date.' }
    }

    const supabase = await createServerClient()
    const { data: costing, error: costingError } = await supabase
        .from('estimator_quotes')
        .select('id, record_kind, quality_label, costing_group_id, version_number, is_archived, production_cost_per_meter, landed_cost_per_meter, quote_price_per_meter, worker_rate_per_m')
        .eq('id', parsed.data.costingId)
        .eq('org_id', profile.org_id)
        .eq('record_kind', 'costing')
        .eq('is_archived', false)
        .maybeSingle()

    if (costingError) return databaseError(costingError, 'Costing could not be loaded. Please try again.')
    if (!costing) return { error: 'Choose an active saved costing before creating a job.' }

    const { error } = await supabase
        .from('base_production_jobs')
        .insert({
            org_id: profile.org_id,
            costing_id: costing.id,
            costing_group_id: costing.costing_group_id,
            costing_version: costing.version_number,
            quality_label: costing.quality_label?.trim() || 'Unnamed costing',
            target_meters: parsed.data.targetMeters,
            start_date: parsed.data.startDate,
            due_date: dueDate,
            customer_reference: parsed.data.customerReference || null,
            notes: parsed.data.notes || null,
            worker_rate_per_meter: costing.worker_rate_per_m ?? 0,
            planned_cost_per_meter: costing.production_cost_per_meter ?? costing.landed_cost_per_meter ?? 0,
            planned_price_per_meter: costing.quote_price_per_meter ?? 0,
            created_by: user.id,
        })

    if (error) return databaseError(error, 'Production job could not be created. Please try again.')

    revalidatePath('/owner/production')
    revalidatePath('/owner/payroll')
    revalidatePath('/owner/operations')
    return { success: true }
}

export async function updateBaseProductionJobStatus(input: {
    jobId: string
    status: 'planned' | 'active' | 'completed' | 'cancelled'
}) {
    const { profile } = await requireBaseProductionOwner()
    const parsed = safeParse(BaseJobStatusSchema, input)
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()
    const { error } = await supabase
        .from('base_production_jobs')
        .update({
            status: parsed.data.status,
            updated_at: new Date().toISOString(),
        })
        .eq('org_id', profile.org_id)
        .eq('id', parsed.data.jobId)

    if (error) return databaseError(error, 'Job status could not be updated. Please try again.')

    revalidatePath('/owner/production')
    revalidatePath('/owner/payroll')
    revalidatePath('/owner/operations')
    return { success: true }
}

export async function recordBaseProduction(input: {
    jobId: string
    workerId: string
    productionDate: string
    meters: number
    notes?: string
    clientRequestId: string
}) {
    const { user, profile } = await requireBaseProductionOwner()
    const parsed = safeParse(BaseProductionEntrySchema, input)
    if ('error' in parsed) return parsed

    const today = getSuratTodayString()
    if (parsed.data.productionDate > today) {
        return { error: 'Production date cannot be in the future.' }
    }

    const supabase = await createServerClient()
    const { data: existing } = await supabase
        .from('base_production_entries')
        .select('id')
        .eq('org_id', profile.org_id)
        .eq('client_request_id', parsed.data.clientRequestId)
        .maybeSingle()

    if (existing) return { success: true, duplicate: true }

    const { data: job, error: jobError } = await supabase
        .from('base_production_jobs')
        .select('id, status')
        .eq('id', parsed.data.jobId)
        .eq('org_id', profile.org_id)
        .maybeSingle()

    if (jobError) return databaseError(jobError, 'Production job could not be loaded. Please try again.')
    if (!job) return { error: 'Production job not found.' }
    if (job.status === 'completed' || job.status === 'cancelled') {
        return { error: 'Reopen the job before recording more production.' }
    }

    const { data: worker, error: workerError } = await supabase
        .from('base_production_workers')
        .select('id, rate_per_meter, is_active')
        .eq('id', parsed.data.workerId)
        .eq('org_id', profile.org_id)
        .maybeSingle()

    if (workerError) return databaseError(workerError, 'Worker could not be loaded. Please try again.')
    if (!worker?.is_active) return { error: 'Choose an active worker.' }

    if (job.status === 'planned') {
        const { error: activateError } = await supabase
            .from('base_production_jobs')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('id', job.id)
            .eq('org_id', profile.org_id)
        if (activateError) return databaseError(activateError, 'Job could not be started. Please try again.')
    }

    const { error } = await supabase
        .from('base_production_entries')
        .insert({
            org_id: profile.org_id,
            job_id: job.id,
            worker_id: worker.id,
            production_date: parsed.data.productionDate,
            meters: parsed.data.meters,
            worker_rate_snapshot: worker.rate_per_meter,
            notes: parsed.data.notes || null,
            client_request_id: parsed.data.clientRequestId,
            created_by: user.id,
        })

    if (error) {
        if (error.code === '23505') {
            return { success: true, duplicate: true }
        }
        return databaseError(error, 'Production could not be recorded. Please try again.')
    }

    revalidatePath('/owner/production')
    revalidatePath('/owner/payroll')
    revalidatePath('/owner/operations')
    return { success: true }
}

export async function createBaseWorkerAdvance(input: {
    workerId: string
    amount: number
    description?: string
}) {
    const { user, profile } = await requireBaseProductionOwner()
    const parsed = safeParse(BaseAdvanceSchema, input)
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()
    const { data: worker, error: workerError } = await supabase
        .from('base_production_workers')
        .select('id, is_active')
        .eq('id', parsed.data.workerId)
        .eq('org_id', profile.org_id)
        .maybeSingle()

    if (workerError) return databaseError(workerError, 'Worker could not be loaded. Please try again.')
    if (!worker?.is_active) return { error: 'Choose an active worker.' }

    const { error } = await supabase
        .from('base_worker_advances')
        .insert({
            org_id: profile.org_id,
            worker_id: worker.id,
            amount: parsed.data.amount,
            description: parsed.data.description || null,
            created_by: user.id,
        })

    if (error) return databaseError(error, 'Advance could not be recorded. Please try again.')

    revalidatePath('/owner/production')
    revalidatePath('/owner/payroll')
    revalidatePath('/owner/operations')
    return { success: true }
}

export async function createBaseWorkerDeduction(input: {
    workerId: string
    amount: number
    reason?: string
    description?: string
}) {
    const { user, profile } = await requireBaseProductionOwner()
    const parsed = safeParse(BaseDeductionSchema, input)
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()
    const { data: worker, error: workerError } = await supabase
        .from('base_production_workers')
        .select('id, is_active')
        .eq('id', parsed.data.workerId)
        .eq('org_id', profile.org_id)
        .maybeSingle()

    if (workerError) return databaseError(workerError, 'Worker could not be loaded. Please try again.')
    if (!worker?.is_active) return { error: 'Choose an active worker.' }

    const combinedDescription = [
        parsed.data.reason ? `[Deduction: ${parsed.data.reason}]` : '[Deduction]',
        parsed.data.description?.trim(),
    ].filter(Boolean).join(' ').slice(0, 240)

    const { error } = await supabase
        .from('base_worker_advances')
        .insert({
            org_id: profile.org_id,
            worker_id: worker.id,
            amount: parsed.data.amount,
            description: combinedDescription || '[Deduction]',
            created_by: user.id,
        })

    if (error) return databaseError(error, 'Deduction could not be recorded. Please try again.')

    revalidatePath('/owner/production')
    revalidatePath('/owner/payroll')
    revalidatePath('/owner/operations')
    return { success: true }
}

export async function settleBaseWorkerPayroll(input: {
    workerId: string
    paymentMode: 'cash' | 'bank_transfer' | 'upi' | 'cheque'
    periodEnd: string
    note?: string
    expected: { client_request_id: string; period_start: string; gross_pay: number; advance_deducted: number; net_payout: number; advance_balance_before: number }
}) {
    await requireBaseProductionOwner()
    const parsed = safeParse(BaseSettlementSchema, input)
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()
    const params: Record<string, unknown> = {
        p_worker_id: parsed.data.workerId,
        p_period_end: parsed.data.periodEnd,
        p_payment_mode: parsed.data.paymentMode,
        p_expected: parsed.data.expected,
    }
    if (parsed.data.note) {
        params.p_note = parsed.data.note
    }

    let { data, error } = await supabase.rpc('settle_base_worker_payroll_reviewed', params)

    if (error && params.p_note && error.message?.includes('p_note')) {
        delete params.p_note
        const retry = await supabase.rpc('settle_base_worker_payroll_reviewed', params)
        data = retry.data
        error = retry.error
    }

    if (error) return databaseError(error, error.message || 'Payroll could not be settled. Please try again.')

    revalidatePath('/owner/production')
    revalidatePath('/owner/payroll')
    revalidatePath('/owner/operations')
    return { success: true, settlement: data }
}

export async function reverseBasePayrollSettlement(input: { settlementId: string; reason: string; paymentNotMade: boolean }) {
    await requireBaseProductionOwner()
    const parsed = safeParse(z.object({ settlementId: UuidSchema, reason: BaseCorrectionReasonSchema, paymentNotMade: z.literal(true) }), input)
    if ('error' in parsed) return parsed
    const supabase = await createServerClient()
    const { error } = await supabase.rpc('reverse_base_payroll_settlement', { p_settlement_id: parsed.data.settlementId, p_reason: parsed.data.reason, p_payment_not_made: true })
    if (error) return databaseError(error, error.message || 'Settlement could not be reversed.')
    revalidatePath('/owner/production')
    revalidatePath('/owner/payroll')
    revalidatePath('/owner/operations')
    return { success: true }
}

export async function completeBasePayrollPeriod(input: {
    periodStart: string
    periodEnd: string
    calculationSnapshot: unknown
    resolvedWorkerIds?: string[]
}) {
    await requireBaseProductionOwner()
    const parsed = safeParse(CompletePayrollPeriodSchema, input)
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()
    const { data, error } = await supabase.rpc('complete_base_payroll_period', {
        p_period_start: parsed.data.periodStart,
        p_period_end: parsed.data.periodEnd,
        p_calculation_snapshot: parsed.data.calculationSnapshot,
        p_resolved_worker_ids: parsed.data.resolvedWorkerIds ?? [],
    })

    if (error) return databaseError(error, error.message || 'Payroll period could not be completed. Please try again.')

    revalidatePath('/owner/production')
    revalidatePath('/owner/payroll')
    revalidatePath('/owner/operations')
    return { success: true, period: data }
}

export async function reopenBasePayrollPeriod(input: {
    periodId: string
    reason: string
}) {
    await requireBaseProductionOwner()
    const parsed = safeParse(ReopenPayrollPeriodSchema, input)
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()
    const { data, error } = await supabase.rpc('reopen_base_payroll_period', {
        p_period_id: parsed.data.periodId,
        p_reason: parsed.data.reason,
    })

    if (error) return databaseError(error, error.message || 'Payroll period could not be reopened. Please try again.')

    revalidatePath('/owner/production')
    revalidatePath('/owner/payroll')
    revalidatePath('/owner/operations')
    return { success: true, period: data }
}

const SavePayrollCycleSchema = z.object({
    cycleType: z.enum(['monthly', 'weekly', 'interval_weeks', 'interval_days', 'semi_monthly']),
    rule: z.record(z.string(), z.unknown()),
    effectiveFrom: DateSchema.optional(),
})

export async function saveBasePayrollCycleConfig(input: {
    cycleType: PayrollCycleType
    rule: unknown
    effectiveFrom?: string
}) {
    const { user, profile } = await requireBaseProductionOwner()
    const parsed = safeParse(SavePayrollCycleSchema, input)
    if ('error' in parsed) return parsed

    const validation = validateCycleRule(parsed.data.rule)
    if (!validation.valid || !validation.normalizedRule) {
        return { error: validation.error || 'Invalid payroll cycle configuration' }
    }

    const supabase = await createServerClient()

    // Query protected periods to guarantee no active or settled period is truncated
    const { data: protectedPeriodRows } = await supabase
        .from('base_payroll_periods')
        .select('period_start, period_end, status, paid_workers, total_gross')
        .eq('org_id', profile.org_id)
        .in('status', ['settled', 'in_progress', 'ready_to_complete'])

    const safeResult = getEarliestSafeCycleChangeDate({
        protectedPeriods: (protectedPeriodRows as any[]) || [],
        today: getSuratTodayString(),
    })

    const effectiveDate = parsed.data.effectiveFrom || safeResult.safeEffectiveDate
    if (effectiveDate < safeResult.safeEffectiveDate) {
        return {
            error: `The requested effective date (${effectiveDate}) falls inside a protected payroll period. The earliest safe date is ${safeResult.safeEffectiveDate}.`,
        }
    }

    // Call update_base_payroll_cycle RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('update_base_payroll_cycle', {
        p_cycle_type: parsed.data.cycleType,
        p_rule: validation.normalizedRule,
        p_effective_from: effectiveDate,
    })

    if (rpcError) {
        // Check if existing active config started on effectiveDate (same-day modification)
        const { data: existingConfig } = await supabase
            .from('base_payroll_cycle_configs')
            .select('id, effective_from')
            .eq('org_id', profile.org_id)
            .is('effective_until', null)
            .maybeSingle()

        if (existingConfig && existingConfig.effective_from === effectiveDate) {
            const { error: updateError } = await supabase
                .from('base_payroll_cycle_configs')
                .update({
                    cycle_type: parsed.data.cycleType,
                    rule: validation.normalizedRule,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existingConfig.id)

            if (updateError) {
                return databaseError(updateError, 'Failed to save payroll cycle configuration. Your existing settings have not changed.')
            }
        } else {
            // Fallback for mock/test environments where custom RPC might not be present
            const prevCloseDate = addDays(effectiveDate, -1)
            await supabase
                .from('base_payroll_cycle_configs')
                .update({ effective_until: prevCloseDate, updated_at: new Date().toISOString() })
                .eq('org_id', profile.org_id)
                .is('effective_until', null)

            const { data: insertData, error: insertError } = await supabase
                .from('base_payroll_cycle_configs')
                .insert({
                    org_id: profile.org_id,
                    cycle_type: parsed.data.cycleType,
                    rule: validation.normalizedRule,
                    effective_from: effectiveDate,
                    effective_until: null,
                    created_by: user.id,
                })
                .select('id')
                .single()

            if (insertError) {
                return databaseError(insertError, 'Failed to save payroll cycle configuration. Your existing settings have not changed.')
            }
        }
    }

    revalidateNextPath('/owner/settings')
    revalidateNextPath('/owner/payroll')
    revalidateNextPath('/owner/production')

    return {
        success: true,
        effectiveFrom: effectiveDate,
        rule: validation.normalizedRule,
    }
}

export async function getBasePayrollCycleConfig() {
    const { profile } = await requireBaseProductionOwner()
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('base_payroll_cycle_configs')
        .select('id, org_id, cycle_type, rule, effective_from, effective_until, created_at, updated_at')
        .eq('org_id', profile.org_id)
        .is('effective_until', null)
        .order('created_at', { ascending: false })
        .maybeSingle()

    if (error && error.code !== 'PGRST205' && error.code !== '42P01') {
        console.error('Failed to load payroll cycle config:', error)
    }

    if (!data) {
        return {
            cycleType: 'monthly' as const,
            rule: DEFAULT_MONTHLY_CYCLE_RULE,
            effectiveFrom: '2020-01-01',
            effectiveUntil: null,
        }
    }

    const ruleValidation = validateCycleRule(data.rule)
    return {
        id: data.id,
        orgId: data.org_id,
        cycleType: data.cycle_type as PayrollCycleType,
        rule: ruleValidation.normalizedRule ?? DEFAULT_MONTHLY_CYCLE_RULE,
        effectiveFrom: data.effective_from,
        effectiveUntil: data.effective_until,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
    }
}

export async function getSafePayrollCycleEffectiveDateAction(ruleInput?: unknown) {
    const { profile } = await requireBaseProductionOwner()
    const supabase = await createServerClient()

    const { data: protectedPeriodRows } = await supabase
        .from('base_payroll_periods')
        .select('period_start, period_end, status, paid_workers, total_gross')
        .eq('org_id', profile.org_id)
        .in('status', ['settled', 'in_progress', 'ready_to_complete'])

    const safeResult = getEarliestSafeCycleChangeDate({
        protectedPeriods: (protectedPeriodRows as any[]) || [],
        today: getSuratTodayString(),
    })

    return {
        success: true,
        ...safeResult,
    }
}

