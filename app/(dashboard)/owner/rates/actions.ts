'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getOrgTier, tierSatisfies } from '@/lib/subscription'
import {
    collectYarnRateCandidates,
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

    // A cost profile can seed zero-value yarn placeholders before the owner saves
    // their first quality. Promote those placeholders from the saved recipe so the
    // Rate Book never hides a known market rate behind ₹0/kg.
    const savedCandidates = collectYarnRateCandidates(qualityTemplates)
    const placeholderUpgrades = savedCandidates.flatMap(candidate => {
        const existing = rates.find(rate =>
            rate.category === candidate.category
            && normalizeYarnName(rate.name) === candidate.normalizedName
            && Number(rate.current_value) === 0
            && candidate.currentValue > 0
        )
        return existing ? [{ existing, candidate }] : []
    })
    if (placeholderUpgrades.length) {
        await setAuditActor(supabase, user.id)
        for (const { existing, candidate } of placeholderUpgrades) {
            const { error: promoteError } = await supabase
                .from('cost_rate_book')
                .update({
                    current_value: candidate.currentValue,
                    effective_date: today,
                    last_reviewed_at: today,
                    source: candidate.conflict ? 'Saved qualities — review needed' : 'Saved qualities',
                    notes: (candidate.conflict
                        ? `Different saved rates found: ${candidate.conflict.rates.map(value => `₹${value}/kg`).join(', ')}. Choose one current rate.`
                        : `Promoted from ${candidate.yarnName} layers in saved qualities.`).slice(0, 500),
                    updated_by: user.id,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
                .eq('org_id', profile.org_id)
                .eq('current_value', 0)
            if (promoteError) return { error: promoteError.message }
        }

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
    const { data, error } = await supabase.rpc('save_cost_rate_atomic', {
        p_rate_id: input.id ?? null,
        p_name: input.name.trim(),
        p_category: input.category,
        p_unit: input.unit,
        p_current_value: input.currentValue,
        p_effective_date: input.effectiveDate,
        p_last_reviewed_at: input.lastReviewedAt,
        p_review_interval_days: input.reviewIntervalDays,
        p_source: input.source?.trim() || null,
        p_notes: input.notes?.trim() || null,
        p_apply_as_default: input.applyAsDefault,
    })
    if (error) return { error: error.message }
    const result = data as { rate?: unknown; synced_quality_count?: number } | null
    if (!result?.rate) return { error: 'The rate update completed without returning the saved rate.' }

    revalidatePath('/owner/rates')
    revalidatePath('/owner/estimator')
    revalidatePath('/owner/settings')
    return {
        data: result.rate,
        syncedQualityCount: Number(result.synced_quality_count ?? 0),
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
