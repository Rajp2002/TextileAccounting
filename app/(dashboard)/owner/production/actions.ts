'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireWritableOrg } from '@/lib/auth'
import { getOrgTier, tierSatisfies } from '@/lib/subscription'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { DateSchema, UuidSchema, safeParse } from '@/lib/schemas'
import { getSuratTodayString } from '@/lib/time'

const BaseWorkerSchema = z.object({
    name: z.string().trim().min(1, 'Worker name is required').max(120, 'Worker name is too long'),
    ratePerMeter: z.number().finite().nonnegative('Rate cannot be negative').max(100_000, 'Rate is too high'),
    isActive: z.boolean().default(true),
})

const UpdateWorkerSchema = BaseWorkerSchema.extend({
    workerId: UuidSchema,
})

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

const BaseSettlementSchema = z.object({
    workerId: UuidSchema,
    paymentMode: z.enum(['cash', 'bank_transfer', 'upi', 'cheque']),
})

async function requireBaseProductionOwner() {
    const result = await requireWritableOrg(['owner'])
    const tier = await getOrgTier(result.profile.org_id)

    if (!tierSatisfies(tier, 'base')) {
        throw new Error('An active Weavly Base or Full Suite subscription is required.')
    }

    return result
}

function databaseError(error: { message?: string } | null | undefined, fallback: string) {
    if (error?.message) console.error(`[base-production] ${error.message}`)
    return { error: fallback }
}

export async function createBaseProductionWorker(input: {
    name: string
    ratePerMeter: number
}) {
    const { user, profile } = await requireBaseProductionOwner()
    const parsed = safeParse(BaseWorkerSchema, { ...input, isActive: true })
    if ('error' in parsed) return parsed

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
            rate_per_meter: parsed.data.ratePerMeter,
            is_active: true,
            created_by: user.id,
        })

    if (error?.code === '23505') return { error: 'A worker with this name already exists.' }
    if (error) return databaseError(error, 'Worker could not be added. Please try again.')

    revalidatePath('/owner/production')
    return { success: true }
}

export async function updateBaseProductionWorker(input: {
    workerId: string
    name: string
    ratePerMeter: number
    isActive: boolean
}) {
    await requireBaseProductionOwner()
    const parsed = safeParse(UpdateWorkerSchema, input)
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()
    const { error } = await supabase
        .from('base_production_workers')
        .update({
            name: parsed.data.name,
            rate_per_meter: parsed.data.ratePerMeter,
            is_active: parsed.data.isActive,
            updated_at: new Date().toISOString(),
        })
        .eq('id', parsed.data.workerId)

    if (error?.code === '23505') return { error: 'A worker with this name already exists.' }
    if (error) return databaseError(error, 'Worker could not be updated. Please try again.')

    revalidatePath('/owner/production')
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
        .select('id, record_kind, quality_label, costing_group_id, version_number, is_archived, production_cost_per_meter, landed_cost_per_meter, quote_price_per_meter')
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
            planned_cost_per_meter: costing.production_cost_per_meter ?? costing.landed_cost_per_meter ?? 0,
            planned_price_per_meter: costing.quote_price_per_meter ?? 0,
            created_by: user.id,
        })

    if (error) return databaseError(error, 'Production job could not be created. Please try again.')

    revalidatePath('/owner/production')
    return { success: true }
}

export async function updateBaseProductionJobStatus(input: {
    jobId: string
    status: 'planned' | 'active' | 'completed' | 'cancelled'
}) {
    await requireBaseProductionOwner()
    const parsed = safeParse(BaseJobStatusSchema, input)
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()
    const { error } = await supabase
        .from('base_production_jobs')
        .update({
            status: parsed.data.status,
            updated_at: new Date().toISOString(),
        })
        .eq('id', parsed.data.jobId)

    if (error) return databaseError(error, 'Job status could not be updated. Please try again.')

    revalidatePath('/owner/production')
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
    return { success: true }
}

export async function settleBaseWorkerPayroll(input: {
    workerId: string
    paymentMode: 'cash' | 'bank_transfer' | 'upi' | 'cheque'
}) {
    await requireBaseProductionOwner()
    const parsed = safeParse(BaseSettlementSchema, input)
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()
    const { data, error } = await supabase.rpc('settle_base_worker_payroll', {
        p_worker_id: parsed.data.workerId,
        p_period_end: getSuratTodayString(),
        p_payment_mode: parsed.data.paymentMode,
    })

    if (error) return databaseError(error, error.message || 'Payroll could not be settled. Please try again.')

    revalidatePath('/owner/production')
    return { success: true, settlement: data }
}
