'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole, requireWritableOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { getSuratTodayString } from '@/lib/time'
import {
    BASE_ONBOARDING_VERSION,
    getDefaultBaseOnboardingDraft,
    type BaseOnboardingDraft,
    type FactoryDefaultsInput,
    type PayrollCycleInput,
} from '@/lib/base-onboarding'
import { getFactoryReadiness } from '@/lib/base-onboarding.server'
import {
    validateCycleRule,
    type MonthlyCycleRule,
    type WeeklyCycleRule,
    type IntervalDaysCycleRule,
    type WeekdayName,
} from '@/lib/payroll-cycle-engine'

// ─── 1. Load Initial State ────────────────────────────────────────────────────

export async function getBaseOnboardingInitialState() {
    try {
        const { user, profile } = await requireRole(['owner'], { allowFreeAccount: false })
        const planAccess = await getCachedOrgPlanAccess(profile.org_id)

        const admin = createAdminClient()

        // Fetch organization, profile, defaults, machines, workers, payroll, quotes in parallel
        const [
            orgRes,
            profileRes,
            costProfileRes,
            machinesRes,
            workersRes,
            payrollRes,
            quotesRes,
        ] = await Promise.all([
            admin
                .from('organizations')
                .select('name, base_onboarding, onboarding_complete')
                .eq('id', profile.org_id)
                .single(),
            admin
                .from('profiles')
                .select('full_name, phone')
                .eq('id', user.id)
                .single(),
            admin
                .from('factory_cost_profile')
                .select('yarn_shortage_pct, default_margin_pct, overhead_mode, default_warping_mode, default_sizing_mode')
                .eq('factory_id', profile.org_id)
                .maybeSingle(),
            admin
                .from('base_production_machines')
                .select('id, name, machine_type, custom_label, is_active')
                .eq('org_id', profile.org_id)
                .eq('is_active', true)
                .order('created_at', { ascending: true }),
            admin
                .from('base_production_workers')
                .select('id, name, pay_type, monthly_salary, role, is_active')
                .eq('org_id', profile.org_id)
                .eq('is_active', true)
                .order('created_at', { ascending: true }),
            admin
                .from('base_payroll_cycle_configs')
                .select('cycle_type, rule')
                .eq('org_id', profile.org_id)
                .is('effective_until', null)
                .maybeSingle(),
            admin
                .from('estimator_quotes')
                .select('id', { count: 'exact', head: true })
                .eq('org_id', profile.org_id),
        ])

        let org = orgRes.data
        if (orgRes.error && (orgRes.error.code === '42703' || orgRes.error.message?.includes('base_onboarding'))) {
            const { data: fallbackOrg } = await admin
                .from('organizations')
                .select('name, onboarding_complete')
                .eq('id', profile.org_id)
                .maybeSingle()
            org = fallbackOrg ? ({ ...fallbackOrg, base_onboarding: null } as any) : null
        }

        const factoryName = org?.name ?? ''
        const baseOnboardingMeta = org?.base_onboarding as Record<string, unknown> | null
        const isCompleted = baseOnboardingMeta?.status === 'completed' || org?.onboarding_complete === true

        // Check if draft exists in base_onboarding JSONB
        const savedDraft = (baseOnboardingMeta?.draft as BaseOnboardingDraft) || null

        // Existing costing defaults (supports Lite -> Base migration)
        const costDefaults = costProfileRes.data
        const hasExistingDefaults = Boolean(
            costDefaults &&
            typeof costDefaults.yarn_shortage_pct === 'number' &&
            typeof costDefaults.default_margin_pct === 'number'
        )

        // Existing machines and workers mapped into draft structure
        const existingMachines: Record<string, Array<{ id: string; name: string; machineType: string; customLabel?: string }>> = {}
        if (machinesRes.data && machinesRes.data.length > 0) {
            for (const m of machinesRes.data) {
                const type = m.machine_type || 'rapier'
                if (!existingMachines[type]) existingMachines[type] = []
                existingMachines[type].push({
                    id: m.id,
                    name: m.name,
                    machineType: type,
                    customLabel: m.custom_label || undefined,
                })
            }
        }

        const existingWorkers = {
            pieceRate: [] as Array<{ id: string; name: string; payType: 'piece_rate' }>,
            fixedSalary: [] as Array<{ id: string; name: string; payType: 'fixed_monthly'; monthlySalary: number; role: string }>,
        }
        if (workersRes.data && workersRes.data.length > 0) {
            for (const w of workersRes.data) {
                if (w.pay_type === 'fixed_monthly') {
                    existingWorkers.fixedSalary.push({
                        id: w.id,
                        name: w.name,
                        payType: 'fixed_monthly',
                        monthlySalary: Number(w.monthly_salary) || 0,
                        role: w.role || '',
                    })
                } else {
                    existingWorkers.pieceRate.push({
                        id: w.id,
                        name: w.name,
                        payType: 'piece_rate',
                    })
                }
            }
        }

        // Initialize draft combining defaults, server data, and saved draft
        const draft = getDefaultBaseOnboardingDraft(factoryName)
        draft.factory.name = factoryName
        draft.factory.ownerContact = profileRes.data?.full_name || profileRes.data?.phone || ''

        if (hasExistingDefaults && costDefaults) {
            draft.defaults = {
                name: factoryName,
                yarnShortagePct: Number(costDefaults.yarn_shortage_pct) || 3.0,
                defaultMarginPct: Number(costDefaults.default_margin_pct) || 5.0,
                overheadMode: costDefaults.overhead_mode === 'direct' ? 'direct' : 'monthly_expenses',
                warpingMode: costDefaults.default_warping_mode === 'outsourced' ? 'outsourced' : 'in_house',
                sizingMode: costDefaults.default_sizing_mode === 'outsourced' ? 'outsourced' : 'in_house',
            }
        }

        if (Object.keys(existingMachines).length > 0) {
            draft.machines = existingMachines
        }
        if (existingWorkers.pieceRate.length > 0 || existingWorkers.fixedSalary.length > 0) {
            draft.workers = existingWorkers
        }

        if (payrollRes.data) {
            const cycleType = payrollRes.data.cycle_type as any
            const rule = payrollRes.data.rule as any
            draft.payroll = {
                cycleType: cycleType || 'monthly',
                anchorDay: rule?.anchorDay || 1,
                anchorWeekday: rule?.anchorWeekday || 'monday',
                intervalDays: rule?.interval || 14,
                anchorDate: rule?.anchorDate || getSuratTodayString(),
            }
        }

        // Merge saved client/server draft if newer or present
        if (savedDraft) {
            if (savedDraft.currentStep) draft.currentStep = savedDraft.currentStep
            if (savedDraft.factory?.name) draft.factory = savedDraft.factory
            if (savedDraft.defaults) draft.defaults = savedDraft.defaults
            if (savedDraft.machines && Object.keys(savedDraft.machines).length > 0) {
                draft.machines = savedDraft.machines
            }
            if (savedDraft.workers) {
                draft.workers = savedDraft.workers
            }
            if (savedDraft.payroll) draft.payroll = savedDraft.payroll
            if (savedDraft.skippedSteps) draft.skippedSteps = savedDraft.skippedSteps
        }

        const readiness = await getFactoryReadiness(profile.org_id)
        const hasSavedCostings = (quotesRes.count ?? 0) > 0

        return {
            ok: true,
            orgId: profile.org_id,
            factoryName,
            isCompleted,
            draft,
            readiness,
            hasSavedCostings,
            tier: planAccess.effectiveTier,
        }
    } catch (err: unknown) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : 'Failed to initialize onboarding state',
        }
    }
}

// ─── 2. Auto-Save Draft ───────────────────────────────────────────────────────

export async function saveBaseOnboardingDraftAction(draft: Partial<BaseOnboardingDraft>) {
    try {
        const { profile } = await requireWritableOrg(['owner'])
        const admin = createAdminClient()

        const { data: org, error: readError } = await admin
            .from('organizations')
            .select('base_onboarding')
            .eq('id', profile.org_id)
            .single()

        if (readError && (readError.code === '42703' || readError.message?.includes('base_onboarding'))) {
            return { success: true }
        }

        const existing = (org?.base_onboarding as Record<string, unknown>) || {}
        const updated = {
            ...existing,
            version: BASE_ONBOARDING_VERSION,
            status: existing.status === 'completed' ? 'completed' : 'in_progress',
            draft: {
                ...(existing.draft as Record<string, unknown> || {}),
                ...draft,
                lastUpdated: new Date().toISOString(),
            },
        }

        const { error: updateError } = await admin
            .from('organizations')
            .update({ base_onboarding: updated })
            .eq('id', profile.org_id)

        if (updateError && (updateError.code === '42703' || updateError.message?.includes('base_onboarding'))) {
            return { success: true }
        }

        return { success: true }
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : 'Failed to save draft' }
    }
}

// ─── 3. Save Factory Context ──────────────────────────────────────────────────

const FactoryContextSchema = z.object({
    name: z.string().trim().min(1, 'Factory name is required').max(120, 'Name must be 120 characters or fewer'),
    ownerContact: z.string().trim().max(100).optional(),
})

export async function saveBaseOnboardingFactoryAction(input: { name: string; ownerContact?: string }) {
    try {
        const { user, profile } = await requireWritableOrg(['owner'])
        const parsed = FactoryContextSchema.safeParse(input)
        if (!parsed.success) {
            return { error: parsed.error.issues[0]?.message || 'Invalid factory details' }
        }

        const admin = createAdminClient()
        const { error: orgError } = await admin
            .from('organizations')
            .update({ name: parsed.data.name })
            .eq('id', profile.org_id)

        if (orgError) return { error: 'Failed to update factory name' }

        if (parsed.data.ownerContact) {
            await admin
                .from('profiles')
                .update({ full_name: parsed.data.ownerContact })
                .eq('id', user.id)
                .is('full_name', null)
        }

        return { success: true }
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : 'Unable to save factory context' }
    }
}

// ─── 4. Save Factory & Costing Defaults ────────────────────────────────────────

const DefaultsSchema = z.object({
    yarnShortagePct: z.number().min(0, 'Wastage percentage cannot be negative').max(100, 'Wastage cannot exceed 100%'),
    defaultMarginPct: z.number().min(0, 'Margin cannot be negative').max(99.99, 'Margin must be less than 100%'),
    overheadMode: z.enum(['direct', 'monthly_expenses']),
    warpingMode: z.enum(['in_house', 'outsourced']),
    sizingMode: z.enum(['in_house', 'outsourced']),
})

export async function saveBaseOnboardingDefaultsAction(input: FactoryDefaultsInput) {
    try {
        const { profile } = await requireWritableOrg(['owner'])
        const parsed = DefaultsSchema.safeParse(input)
        if (!parsed.success) {
            return { error: parsed.error.issues[0]?.message || 'Invalid defaults provided' }
        }

        const supabase = await createClient()
        const nextUpdatedAt = new Date().toISOString()

        const { data: existing } = await supabase
            .from('factory_cost_profile')
            .select('factory_id')
            .eq('factory_id', profile.org_id)
            .maybeSingle()

        const payload = {
            yarn_shortage_pct: parsed.data.yarnShortagePct,
            default_margin_pct: parsed.data.defaultMarginPct,
            overhead_mode: parsed.data.overheadMode,
            default_warping_mode: parsed.data.warpingMode,
            default_sizing_mode: parsed.data.sizingMode,
            updated_at: nextUpdatedAt,
        }

        if (existing) {
            const { error } = await supabase
                .from('factory_cost_profile')
                .update(payload)
                .eq('factory_id', profile.org_id)
            if (error) return { error: 'Failed to update costing defaults' }
        } else {
            const { error } = await supabase
                .from('factory_cost_profile')
                .insert({
                    factory_id: profile.org_id,
                    ...payload,
                    name: 'Default Profile',
                    overhead_items: [],
                })
            if (error) return { error: 'Failed to create costing defaults profile' }
        }

        revalidatePath('/owner/settings')
        revalidatePath('/owner/estimator')
        return { success: true }
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : 'Unable to save costing defaults' }
    }
}

// ─── 5. Bulk Save Machines ────────────────────────────────────────────────────

export async function saveBaseOnboardingMachinesBulkAction(
    machines: Array<{ name: string; machineType: string; customLabel?: string }>
) {
    try {
        const { user, profile } = await requireWritableOrg(['owner'])
        const supabase = await createClient()

        // Prune empty rows and trim
        const cleanRows = machines
            .map((m, idx) => ({
                row: idx + 1,
                name: (m.name || '').trim(),
                machineType: m.machineType || 'other',
                customLabel: (m.customLabel || '').trim() || null,
            }))
            .filter(m => m.name.length > 0)

        if (cleanRows.length === 0) {
            return { success: true, count: 0 }
        }

        // Validate lengths and detect duplicates within the submission
        const seenNames = new Set<string>()
        for (const row of cleanRows) {
            if (row.name.length > 120) {
                return {
                    error: `Row ${row.row}: Machine identifier "${row.name.slice(0, 20)}..." exceeds 120 characters.`,
                    rowError: { row: row.row, field: 'name', error: 'Exceeds 120 characters' },
                }
            }
            const lower = row.name.toLowerCase()
            if (seenNames.has(lower)) {
                return {
                    error: `Duplicate machine identifier "${row.name}" found in your list. Each machine identifier must be unique.`,
                    rowError: { row: row.row, field: 'name', error: 'Duplicate machine name' },
                }
            }
            seenNames.add(lower)
        }

        // Query existing active machine names in database
        const { data: existingData, error: readError } = await supabase
            .from('base_production_machines')
            .select('name')
            .eq('org_id', profile.org_id)

        if (readError) return { error: 'Failed to verify existing machine records' }

        const existingDbNames = new Set(
            (existingData ?? []).map(m => String(m.name).trim().toLowerCase())
        )

        // Only insert machines that do not already exist
        const toInsert = cleanRows
            .filter(r => !existingDbNames.has(r.name.toLowerCase()))
            .map(r => ({
                org_id: profile.org_id,
                name: r.name,
                machine_type: ['jacquard', 'power_loom', 'rapier', 'water_jet', 'air_jet', 'circular', 'other'].includes(r.machineType)
                    ? r.machineType
                    : 'other',
                custom_label: r.customLabel,
                is_active: true,
                created_by: user.id,
            }))

        if (toInsert.length > 0) {
            const { error: insertError } = await supabase
                .from('base_production_machines')
                .insert(toInsert)

            if (insertError) {
                if (insertError.code === '23505') {
                    return { error: 'One or more machine names already exist in your factory.' }
                }
                return { error: 'Unable to save machines. Please check your machine list and try again.' }
            }
        }

        revalidatePath('/owner/production')
        revalidatePath('/owner/machines')
        return { success: true, count: cleanRows.length, insertedCount: toInsert.length }
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : 'Unable to save machines' }
    }
}

// ─── 6. Bulk Save Workforce ───────────────────────────────────────────────────

export async function saveBaseOnboardingWorkersBulkAction(
    workers: Array<{
        name: string
        payType: 'piece_rate' | 'fixed_monthly'
        monthlySalary?: number
        role?: string
        startDate?: string
    }>
) {
    try {
        const { user, profile } = await requireWritableOrg(['owner'])
        const supabase = await createClient()
        const today = getSuratTodayString()

        // Prune empty rows and normalize
        const cleanRows = workers
            .map((w, idx) => ({
                row: idx + 1,
                name: (w.name || '').trim(),
                payType: w.payType === 'fixed_monthly' ? 'fixed_monthly' : 'piece_rate',
                monthlySalary: Number(w.monthlySalary) || 0,
                role: (w.role || '').trim(),
                startDate: w.startDate || today,
            }))
            .filter(w => w.name.length > 0)

        if (cleanRows.length === 0) {
            return { success: true, count: 0 }
        }

        // Validate rows and duplicate names within payload
        const seenNames = new Set<string>()
        for (const row of cleanRows) {
            if (row.name.length > 120) {
                return {
                    error: `Row ${row.row}: Worker name "${row.name.slice(0, 20)}..." exceeds 120 characters.`,
                    rowError: { row: row.row, field: 'name', error: 'Exceeds 120 characters' },
                }
            }
            const lower = row.name.toLowerCase()
            if (seenNames.has(lower)) {
                return {
                    error: `Duplicate worker name "${row.name}" found in your list. Each worker name must be unique.`,
                    rowError: { row: row.row, field: 'name', error: 'Duplicate worker name' },
                }
            }
            seenNames.add(lower)

            if (row.payType === 'fixed_monthly') {
                if (row.monthlySalary <= 0) {
                    return {
                        error: `Row ${row.row}: Please enter a positive monthly salary for fixed worker "${row.name}".`,
                        rowError: { row: row.row, field: 'monthlySalary', error: 'Salary must be greater than 0' },
                    }
                }
                if (row.monthlySalary > 10000000) {
                    return {
                        error: `Row ${row.row}: Salary exceeds allowed limit.`,
                        rowError: { row: row.row, field: 'monthlySalary', error: 'Salary exceeds limit' },
                    }
                }
            }
        }

        // Query existing active workers in database
        const { data: existingWorkers, error: readError } = await supabase
            .from('base_production_workers')
            .select('name')
            .eq('org_id', profile.org_id)

        if (readError) return { error: 'Failed to verify existing worker records' }

        const existingNames = new Set(
            (existingWorkers ?? []).map(w => String(w.name).trim().toLowerCase())
        )

        const toInsert = cleanRows
            .filter(r => !existingNames.has(r.name.toLowerCase()))
            .map(r => ({
                org_id: profile.org_id,
                name: r.name,
                rate_per_meter: 0,
                pay_type: r.payType,
                role: r.role,
                monthly_salary: r.payType === 'fixed_monthly' ? r.monthlySalary : 0,
                start_date: r.payType === 'fixed_monthly' ? r.startDate : null,
                salary_effective_from: r.payType === 'fixed_monthly' ? r.startDate : null,
                shift_availability: 'both',
                is_active: true,
                created_by: user.id,
            }))

        if (toInsert.length > 0) {
            const { error: insertError } = await supabase
                .from('base_production_workers')
                .insert(toInsert)

            if (insertError) {
                if (insertError.code === '23505') {
                    return { error: 'One or more workers already exist with the same name.' }
                }
                return { error: 'Unable to save workers. Please review your worker entries and try again.' }
            }
        }

        revalidatePath('/owner/production')
        revalidatePath('/owner/payroll')
        revalidatePath('/owner/workers')
        return { success: true, count: cleanRows.length, insertedCount: toInsert.length }
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : 'Unable to save workers' }
    }
}

// ─── 7. Save Payroll Configuration ────────────────────────────────────────────

export async function saveBaseOnboardingPayrollAction(input: PayrollCycleInput) {
    try {
        await requireWritableOrg(['owner'])
        const supabase = await createClient()
        const today = getSuratTodayString()

        let cycleRule: any
        const cycleType = input.cycleType || 'monthly'

        if (cycleType === 'monthly') {
            const rule: MonthlyCycleRule = {
                type: 'monthly',
                anchorDay: Math.min(31, Math.max(1, input.anchorDay || 1)),
            }
            cycleRule = rule
        } else if (cycleType === 'weekly') {
            const rule: WeeklyCycleRule = {
                type: 'weekly',
                anchorWeekday: (input.anchorWeekday as WeekdayName) || 'monday',
            }
            cycleRule = rule
        } else if (cycleType === 'interval_days') {
            const rule: IntervalDaysCycleRule = {
                type: 'interval_days',
                interval: Math.max(1, input.intervalDays || 14),
                anchorDate: input.anchorDate || today,
            }
            cycleRule = rule
        } else {
            const rule: MonthlyCycleRule = { type: 'monthly', anchorDay: 1 }
            cycleRule = rule
        }

        const validation = validateCycleRule(cycleRule)
        if (!validation.valid || !validation.normalizedRule) {
            return { error: validation.error || 'Invalid payroll cycle configuration' }
        }

        // The RPC checks owner and Base access and handles same-day edits in
        // place (20260915120000). There is deliberately no service-role
        // fallback: a refused write must not bypass those checks.
        const { error: rpcError } = await supabase.rpc('update_base_payroll_cycle', {
            p_cycle_type: cycleType,
            p_rule: validation.normalizedRule,
            p_effective_from: today,
        })

        if (rpcError) {
            console.error('update_base_payroll_cycle failed during onboarding:', rpcError.message)
            return { error: 'Failed to configure payroll cycle. Please try again.' }
        }

        revalidatePath('/owner/production')
        revalidatePath('/owner/payroll')
        return { success: true }
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : 'Unable to configure payroll' }
    }
}

// ─── 8. Complete Base Onboarding ──────────────────────────────────────────────

export async function completeBaseOnboardingAction() {
    try {
        const { user, profile } = await requireWritableOrg(['owner'])
        const admin = createAdminClient()

        const now = new Date().toISOString()
        const { data: org } = await admin
            .from('organizations')
            .select('base_onboarding')
            .eq('id', profile.org_id)
            .maybeSingle()

        const existing = (org?.base_onboarding as Record<string, unknown>) || {}
        const completedMeta = {
            ...existing,
            version: BASE_ONBOARDING_VERSION,
            status: 'completed',
            completed_at: now,
            completed_steps: ['factory', 'defaults', 'machines', 'workers', 'payroll', 'review'],
        }

        let updateError: any = null

        // 1. Attempt full update with base_onboarding metadata and onboarding_complete
        const res1 = await admin
            .from('organizations')
            .update({
                base_onboarding: completedMeta,
                onboarding_complete: true,
            })
            .eq('id', profile.org_id)

        updateError = res1.error

        // 2. If base_onboarding column is missing, retry without it
        if (updateError && (updateError.code === '42703' || updateError.message?.includes('base_onboarding'))) {
            console.warn('[completeBaseOnboardingAction] base_onboarding column missing, retrying without it:', updateError)
            const res2 = await admin
                .from('organizations')
                .update({
                    onboarding_complete: true,
                })
                .eq('id', profile.org_id)
            updateError = res2.error
        }

        if (updateError) {
            console.error('[completeBaseOnboardingAction] Failed to update organization:', updateError)
            return { error: updateError.message || 'Failed to complete factory setup. Please try again.' }
        }

        // Update user app_metadata to sync session claims immediately
        try {
            await admin.auth.admin.updateUserById(user.id, {
                app_metadata: {
                    ...(user.app_metadata || {}),
                    onboarding_complete: true,
                },
            })
        } catch (authErr) {
            console.warn('[completeBaseOnboardingAction] Failed to update user app_metadata:', authErr)
        }

        revalidatePath('/owner/production')
        revalidatePath('/owner/production')
        revalidatePath('/owner/machines')
        revalidatePath('/owner/workers')
        revalidatePath('/owner/payroll')
        revalidatePath('/owner/estimator')
        revalidatePath('/onboarding/base')

        return { success: true }
    } catch (err: unknown) {
        console.error('[completeBaseOnboardingAction] Unexpected exception:', err)
        return { error: err instanceof Error ? err.message : 'Unable to complete factory setup' }
    }
}
