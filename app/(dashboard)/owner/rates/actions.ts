'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getOrgTier, tierSatisfies } from '@/lib/subscription'
import {
    applyYarnRateToTemplate,
    getMissingYarnRateCandidates,
    getYarnRateConflicts,
    normalizeYarnName,
    type YarnRateTemplate,
} from '@/lib/yarn-rate-reconciliation'

export type CostRateCategory =
    | 'yarn_warp'
    | 'yarn_weft'
    | 'warping'
    | 'sizing'
    | 'winding'
    | 'processing'
    | 'finishing'
    | 'transport'
    | 'commission'
    | 'overhead'

export type CostRateUnit = 'per_kg' | 'per_m' | 'percent'

export type CostRateInput = {
    id?: string
    name: string
    category: CostRateCategory
    unit: CostRateUnit
    currentValue: number
    effectiveDate: string
    lastReviewedAt: string
    reviewIntervalDays: number
    source?: string
    notes?: string
    applyAsDefault: boolean
}

const CATEGORIES = new Set<CostRateCategory>([
    'yarn_warp', 'yarn_weft', 'warping', 'sizing', 'winding',
    'processing', 'finishing', 'transport', 'commission', 'overhead',
])
const UNITS = new Set<CostRateUnit>(['per_kg', 'per_m', 'percent'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function requireBaseTier(orgId: string) {
    return tierSatisfies(await getOrgTier(orgId), 'base')
        ? null
        : 'An active Weavly Estimator or Full Suite subscription is required.'
}

function validateRate(input: CostRateInput) {
    if (input.id && !UUID_PATTERN.test(input.id)) return 'Rate identifier is invalid.'
    if (!input.name.trim() || input.name.trim().length > 120) return 'Rate name must be between 1 and 120 characters.'
    if (!CATEGORIES.has(input.category)) return 'Rate category is invalid.'
    if (!UNITS.has(input.unit)) return 'Rate unit is invalid.'
    if (!Number.isFinite(input.currentValue) || input.currentValue < 0 || input.currentValue > 10_000_000) return 'Enter a valid non-negative rate.'
    if (!Number.isInteger(input.reviewIntervalDays) || input.reviewIntervalDays < 1 || input.reviewIntervalDays > 1095) return 'Review period must be between 1 and 1095 days.'
    if (!Number.isFinite(Date.parse(input.effectiveDate))) return 'Effective date is invalid.'
    if (!Number.isFinite(Date.parse(input.lastReviewedAt))) return 'Review date is invalid.'
    if ((input.notes?.length ?? 0) > 500) return 'Notes must be 500 characters or fewer.'
    return null
}

async function setAuditActor(supabase: Awaited<ReturnType<typeof createServerClient>>, userId: string) {
    try {
        await supabase.rpc('set_actor_for_audit', { p_actor_id: userId })
    } catch {
        // Audit triggers fall back to auth.uid().
    }
}

async function applyProfileDefault(
    supabase: Awaited<ReturnType<typeof createServerClient>>,
    orgId: string,
    input: CostRateInput,
) {
    if (!input.applyAsDefault) return null

    const mapping: Partial<Record<CostRateCategory, Record<string, string | number>>> = {
        yarn_warp: {
            default_warp_yarn_name: input.name.trim(),
            default_warp_yarn_rate_per_kg: input.currentValue,
        },
        yarn_weft: {
            default_weft_yarn_name: input.name.trim(),
            default_weft_yarn_rate_per_kg: input.currentValue,
        },
        warping: { warping_rate_per_kg: input.currentValue },
        sizing: { sizing_rate_per_kg: input.currentValue },
        winding: { winding_rate_per_kg: input.currentValue },
        processing: { default_processing_rate_per_m: input.currentValue },
        finishing: { default_finishing_rate_per_m: input.currentValue },
        transport: { default_transport_per_m: input.currentValue },
        commission: { default_commission_pct: input.currentValue },
        overhead: { overhead_pct: input.currentValue },
    }
    const values = mapping[input.category]
    if (!values) return null
    const { data, error } = await supabase
        .from('factory_cost_profile')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('factory_id', orgId)
        .select('id')
        .maybeSingle()
    if (error) return error.message
    return data ? null : 'Factory defaults were not updated because the cost profile has not been configured yet.'
}

export async function getCostRates() {
    const { user, profile } = await requireRole(['owner'])
    const tierError = await requireBaseTier(profile.org_id)
    if (tierError) return { error: tierError }
    const supabase = await createServerClient()

    const { data: existingRates, error } = await supabase
        .from('cost_rate_book')
        .select('*')
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
        .order('category')
        .order('name')
    if (error) return { error: error.message }

    const { data: templates, error: templatesError } = await supabase
        .from('estimator_templates')
        .select('id, name, warp_rows, weft_rows')
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
    if (templatesError) return { error: templatesError.message }

    const qualityTemplates = (templates ?? []) as YarnRateTemplate[]
    const today = new Date().toISOString().slice(0, 10)
    let rates = existingRates ?? []

    if (!rates.length) {
        const { data: costProfile, error: profileError } = await supabase
            .from('factory_cost_profile')
            .select('*')
            .eq('factory_id', profile.org_id)
            .maybeSingle()
        if (profileError) return { error: profileError.message }

        const defaultWarpName = costProfile?.default_warp_yarn_name || 'Warp yarn'
        const defaultWeftName = costProfile?.default_weft_yarn_name || 'Weft yarn'
        const savedQualityRates = getMissingYarnRateCandidates(qualityTemplates, [])
        const savedRate = (name: string, category: CostRateCategory, fallback: number) => savedQualityRates.find(candidate => candidate.category === category && normalizeYarnName(candidate.yarnName) === normalizeYarnName(name))?.currentValue ?? fallback
        const defaults = [
            { name: defaultWarpName, category: 'yarn_warp', unit: 'per_kg', current_value: savedRate(defaultWarpName, 'yarn_warp', Number(costProfile?.default_warp_yarn_rate_per_kg ?? 0)), apply_as_default: true },
            { name: defaultWeftName, category: 'yarn_weft', unit: 'per_kg', current_value: savedRate(defaultWeftName, 'yarn_weft', Number(costProfile?.default_weft_yarn_rate_per_kg ?? 0)), apply_as_default: true },
            { name: 'Warping', category: 'warping', unit: 'per_kg', current_value: Number(costProfile?.warping_rate_per_kg ?? 2), apply_as_default: true },
            { name: 'Sizing', category: 'sizing', unit: 'per_kg', current_value: Number(costProfile?.sizing_rate_per_kg ?? 1.5), apply_as_default: true },
            { name: 'Transport', category: 'transport', unit: 'per_m', current_value: Number(costProfile?.default_transport_per_m ?? 0), apply_as_default: true },
        ].map(item => ({
            ...item,
            org_id: profile.org_id,
            effective_date: today,
            last_reviewed_at: today,
            review_interval_days: 90,
            source: 'Estimator defaults',
            created_by: user.id,
            updated_by: user.id,
        }))

        await setAuditActor(supabase, user.id)
        const { data: seeded, error: seedError } = await supabase
            .from('cost_rate_book')
            .upsert(defaults, { onConflict: 'org_id,name,category', ignoreDuplicates: true })
            .select('*')
        if (seedError) return { error: seedError.message }
        rates = seeded ?? []
    }

    const missingYarns = getMissingYarnRateCandidates(qualityTemplates, rates)
    if (missingYarns.length) {
        const discoveredRates = missingYarns.map(candidate => ({
            org_id: profile.org_id,
            name: candidate.yarnName,
            category: candidate.category,
            unit: 'per_kg',
            current_value: candidate.currentValue,
            effective_date: today,
            last_reviewed_at: today,
            review_interval_days: 90,
            source: candidate.conflict ? 'Saved qualities — review needed' : 'Saved qualities',
            notes: (candidate.conflict
                ? `Different saved rates found: ${candidate.conflict.rates.map(value => `₹${value}/kg`).join(', ')}. Choose one current rate.`
                : `Discovered from ${candidate.yarnName} layers in saved qualities.`).slice(0, 500),
            apply_as_default: false,
            created_by: user.id,
            updated_by: user.id,
        }))
        await setAuditActor(supabase, user.id)
        const { error: discoveredError } = await supabase
            .from('cost_rate_book')
            .upsert(discoveredRates, { onConflict: 'org_id,name,category', ignoreDuplicates: true })
        if (discoveredError) return { error: discoveredError.message }

        const { data: refreshed, error: refreshError } = await supabase
            .from('cost_rate_book')
            .select('*')
            .eq('org_id', profile.org_id)
            .eq('is_active', true)
            .order('category')
            .order('name')
        if (refreshError) return { error: refreshError.message }
        rates = refreshed ?? []
    }

    return { data: rates, conflicts: getYarnRateConflicts(qualityTemplates) }
}

async function syncYarnRateToSavedQualities(
    supabase: Awaited<ReturnType<typeof createServerClient>>,
    orgId: string,
    yarnName: string,
    yarnRate: number,
) {
    const { data, error } = await supabase
        .from('estimator_templates')
        .select('id, name, warp_rows, weft_rows, updated_at')
        .eq('org_id', orgId)
        .eq('is_active', true)
    if (error) return { count: 0, warning: error.message }

    let count = 0
    for (const template of data ?? []) {
        const updated = applyYarnRateToTemplate(template as YarnRateTemplate, yarnName, yarnRate)
        if (!updated.changed) continue

        const { data: saved, error: updateError } = await supabase
            .from('estimator_templates')
            .update({
                warp_rows: updated.warpRows,
                weft_rows: updated.weftRows,
                default_yarn_rate: updated.warpRows[0]?.yarnRate ?? 0,
                updated_at: new Date().toISOString(),
            })
            .eq('id', template.id)
            .eq('org_id', orgId)
            .eq('is_active', true)
            .eq('updated_at', template.updated_at)
            .select('id')
            .maybeSingle()
        if (updateError) return { count, warning: updateError.message }
        if (!saved) return { count, warning: `${template.name} changed in another tab and was not updated.` }
        count += 1
    }

    return { count, warning: null }
}

export async function getCostRateHistory(rateId: string) {
    if (!UUID_PATTERN.test(rateId)) return { error: 'Rate identifier is invalid.' }
    const { profile } = await requireRole(['owner'])
    const tierError = await requireBaseTier(profile.org_id)
    if (tierError) return { error: tierError }
    const supabase = await createServerClient()
    const { data, error } = await supabase
        .from('cost_rate_history')
        .select('*')
        .eq('org_id', profile.org_id)
        .eq('rate_id', rateId)
        .order('effective_date', { ascending: false })
        .order('created_at', { ascending: false })
    return error ? { error: error.message } : { data: data ?? [] }
}

export async function saveCostRate(input: CostRateInput) {
    const validationError = validateRate(input)
    if (validationError) return { error: validationError }
    const { user, profile } = await requireRole(['owner'])
    const tierError = await requireBaseTier(profile.org_id)
    if (tierError) return { error: tierError }
    const supabase = await createServerClient()
    await setAuditActor(supabase, user.id)

    let previousValue: number | null = null
    if (input.id) {
        const { data: existing, error: existingError } = await supabase
            .from('cost_rate_book')
            .select('id, name, category, unit, current_value')
            .eq('id', input.id)
            .eq('org_id', profile.org_id)
            .eq('is_active', true)
            .maybeSingle()
        if (existingError) return { error: existingError.message }
        if (!existing) return { error: 'Rate no longer exists.' }
        const existingIsYarn = existing.category === 'yarn_warp' || existing.category === 'yarn_weft'
        if (existingIsYarn && (
            normalizeYarnName(existing.name) !== normalizeYarnName(input.name)
            || existing.category !== input.category
            || existing.unit !== input.unit
        )) {
            return { error: 'A yarn rate name, category, and unit cannot be changed because they match saved quality layers.' }
        }
        previousValue = Number(existing.current_value)
    }

    const payload = {
        org_id: profile.org_id,
        name: input.name.trim(),
        category: input.category,
        unit: input.unit,
        current_value: input.currentValue,
        previous_value: previousValue,
        effective_date: input.effectiveDate,
        last_reviewed_at: input.lastReviewedAt,
        review_interval_days: input.reviewIntervalDays,
        source: input.source?.trim() || null,
        notes: input.notes?.trim() || null,
        apply_as_default: input.applyAsDefault,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
    }

    const query = input.id
        ? supabase.from('cost_rate_book').update(payload).eq('id', input.id).eq('org_id', profile.org_id)
        : supabase.from('cost_rate_book').insert({ ...payload, created_by: user.id })
    const { data: saved, error } = await query.select('*').single()
    if (error) return { error: error.code === '23505' ? 'A rate with this name and category already exists.' : error.message }

    const { error: historyError } = await supabase.from('cost_rate_history').insert({
        org_id: profile.org_id,
        rate_id: saved.id,
        value: input.currentValue,
        effective_date: input.effectiveDate,
        source: input.source?.trim() || null,
        notes: input.notes?.trim() || null,
        changed_by: user.id,
    })
    if (historyError) {
        return {
            data: saved,
            syncedQualityCount: 0,
            syncWarning: `The current rate was saved, but its history entry failed: ${historyError.message}`,
            partialSuccess: true,
        }
    }

    const profileError = await applyProfileDefault(supabase, profile.org_id, input)
    if (profileError) {
        return {
            data: saved,
            syncedQualityCount: 0,
            syncWarning: `The current rate was saved, but the factory default was not updated: ${profileError}`,
            partialSuccess: true,
        }
    }

    const isYarnRate = input.category === 'yarn_warp' || input.category === 'yarn_weft'
    const qualitySync = isYarnRate
        ? await syncYarnRateToSavedQualities(supabase, profile.org_id, input.name.trim(), input.currentValue)
        : { count: 0, warning: null }

    revalidatePath('/owner/rates')
    revalidatePath('/owner/estimator')
    revalidatePath('/owner/settings')
    return {
        data: saved,
        syncedQualityCount: qualitySync.count,
        syncWarning: qualitySync.warning,
    }
}

export async function archiveCostRate(rateId: string) {
    if (!UUID_PATTERN.test(rateId)) return { error: 'Rate identifier is invalid.' }
    const { user, profile } = await requireRole(['owner'])
    const tierError = await requireBaseTier(profile.org_id)
    if (tierError) return { error: tierError }
    const supabase = await createServerClient()
    await setAuditActor(supabase, user.id)
    const { data, error } = await supabase
        .from('cost_rate_book')
        .update({ is_active: false, updated_by: user.id, updated_at: new Date().toISOString() })
        .eq('id', rateId)
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
        .select('id')
        .maybeSingle()
    if (error) return { error: error.message }
    if (!data) return { error: 'Rate no longer exists.' }
    revalidatePath('/owner/rates')
    return { success: true }
}
