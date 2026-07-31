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
    expectedUpdatedAt?: string
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
    if (input.id && (!input.expectedUpdatedAt || !Number.isFinite(Date.parse(input.expectedUpdatedAt)))) return 'Rate version is invalid. Refresh before saving again.'
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

export async function getCostRates(options?: { includeArchived?: boolean }) {
    const { user, profile } = await requireRole(['owner'])
    const tierError = await requireBaseTier(profile.org_id)
    if (tierError) return { error: tierError }
    const supabase = await createServerClient()

    let ratesQuery = supabase
            .from('cost_rate_book')
            .select('*')
            .eq('org_id', profile.org_id)
            .order('category')
            .order('name')
    if (!options?.includeArchived) ratesQuery = ratesQuery.eq('is_active', true)

    const [ratesResult, profileResult] = await Promise.all([
        ratesQuery,
        supabase
            .from('factory_cost_profile')
            .select('yarn_review_interval_days')
            .eq('factory_id', profile.org_id)
            .maybeSingle(),
    ])
    const { data: existingRates, error } = ratesResult
    if (error) return { error: error.message }
    if (profileResult.error) return { error: profileResult.error.message }
    const yarnReviewIntervalDays = Number(profileResult.data?.yarn_review_interval_days ?? 90)

    const [templatesResult, costingsResult] = await Promise.all([
        supabase
            .from('estimator_templates')
            .select('id, name, warp_rows, weft_rows')
            .eq('org_id', profile.org_id)
            .eq('is_active', true),
        supabase
            .from('estimator_quotes')
            .select('id, quality_label, party_name, warp_rows, weft_rows')
            .eq('org_id', profile.org_id)
            .eq('record_kind', 'costing')
            .eq('is_archived', false)
            // Templates are already included above. This fallback is for
            // standalone costings saved before the database trigger existed.
            .is('template_id', null),
    ])
    if (templatesResult.error || costingsResult.error) {
        return { error: templatesResult.error?.message ?? costingsResult.error?.message }
    }

    const qualityTemplates = (templatesResult.data ?? []) as YarnRateTemplate[]
    const savedCostings: YarnRateTemplate[] = (costingsResult.data ?? []).map(costing => ({
        id: `costing:${costing.id}`,
        name: costing.quality_label?.trim() || costing.party_name?.trim() || 'Saved costing',
        warp_rows: costing.warp_rows,
        weft_rows: costing.weft_rows,
    })) as YarnRateTemplate[]
    const savedYarnSources = [...qualityTemplates, ...savedCostings]
    const today = new Date().toISOString().slice(0, 10)
    let rates = existingRates ?? []

    // Remove only untouched yarn placeholders created by the old read-time
    // seeding behavior. Any rate the owner saved has a history row and must be
    // preserved, even if its source label still says "Estimator defaults".
    const legacyDefaultIds = rates
        .filter(rate =>
            rate.is_active !== false
            &&
            (rate.category === 'yarn_warp' || rate.category === 'yarn_weft')
            && rate.source === 'Estimator defaults'
            && rate.apply_as_default
        )
        .map(rate => rate.id)
    if (legacyDefaultIds.length) {
        const { data: reviewedDefaults, error: historyError } = await supabase
            .from('cost_rate_history')
            .select('rate_id')
            .eq('org_id', profile.org_id)
            .in('rate_id', legacyDefaultIds)
        if (historyError) return { error: historyError.message }

        const reviewedIds = new Set((reviewedDefaults ?? []).map(row => row.rate_id))
        const untouchedIds = legacyDefaultIds.filter(id => !reviewedIds.has(id))
        if (untouchedIds.length) {
            await setAuditActor(supabase, user.id)
            const { error: cleanupError } = await supabase
                .from('cost_rate_book')
                .delete()
                .eq('org_id', profile.org_id)
                .in('id', untouchedIds)
            if (cleanupError) return { error: cleanupError.message }
            rates = rates.filter(rate => !untouchedIds.includes(rate.id))
        }
    }

    const savedCandidates = collectYarnRateCandidates(savedYarnSources)
    const placeholderUpgrades = savedCandidates.flatMap(candidate => {
        const existing = rates.find(rate =>
            rate.is_active !== false
            &&
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
                    source: candidate.conflict ? 'Saved qualities or costings — review needed' : 'Saved quality or costing',
                    notes: (candidate.conflict
                        ? `Different saved rates found: ${candidate.conflict.rates.map(value => `₹${value}/kg`).join(', ')}. Choose one current rate.`
                        : `Discovered from ${candidate.yarnName} layers in a saved quality or costing.`).slice(0, 500),
                    updated_by: user.id,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
                .eq('org_id', profile.org_id)
                .eq('current_value', 0)
                .eq('is_active', true)
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

    const missingYarns = getMissingYarnRateCandidates(savedYarnSources, rates.filter(rate => rate.is_active !== false))
    if (missingYarns.length) {
        const discoveredRates = missingYarns.map(candidate => ({
            org_id: profile.org_id,
            name: candidate.yarnName,
            category: candidate.category,
            unit: 'per_kg',
            current_value: candidate.currentValue,
            effective_date: today,
            last_reviewed_at: today,
            review_interval_days: yarnReviewIntervalDays,
            source: candidate.conflict ? 'Saved qualities or costings — review needed' : 'Saved quality or costing',
            notes: (candidate.conflict
                ? `Different saved rates found: ${candidate.conflict.rates.map(value => `₹${value}/kg`).join(', ')}. Choose one current rate.`
                : `Discovered from ${candidate.yarnName} layers in a saved quality or costing.`).slice(0, 500),
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

    if (options?.includeArchived) {
        const { data: allRates, error: allRatesError } = await supabase
            .from('cost_rate_book')
            .select('*')
            .eq('org_id', profile.org_id)
            .order('category')
            .order('name')
        if (allRatesError) return { error: allRatesError.message }
        rates = allRates ?? []
    }

    const { data: reviewedRows, error: reviewedError } = await supabase
        .from('cost_rate_history')
        .select('rate_id')
        .eq('org_id', profile.org_id)
    if (reviewedError) return { error: reviewedError.message }

    const reviewedRateIds = new Set((reviewedRows ?? []).map(row => row.rate_id))
    return {
        data: rates.map(rate => ({ ...rate, is_reviewed: reviewedRateIds.has(rate.id) })),
        conflicts: getYarnRateConflicts(savedYarnSources),
        yarnReviewIntervalDays,
    }
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
    const { data, error } = await supabase.rpc('save_cost_rate_atomic_versioned', {
        p_rate_id: input.id ?? null,
        p_expected_updated_at: input.expectedUpdatedAt ?? null,
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
    revalidatePath('/owner', 'layout')
    return {
        data: result.rate,
        syncedQualityCount: Number(result.synced_quality_count ?? 0),
    }
}

export async function archiveCostRate(rateId: string, expectedUpdatedAt?: string) {
    if (!UUID_PATTERN.test(rateId)) return { error: 'Rate identifier is invalid.' }
    const { user, profile } = await requireRole(['owner'])
    const tierError = await requireBaseTier(profile.org_id)
    if (tierError) return { error: tierError }
    const supabase = await createServerClient()
    await setAuditActor(supabase, user.id)
    if (expectedUpdatedAt && !Number.isFinite(Date.parse(expectedUpdatedAt))) {
        return { error: 'This rate changed or is missing its version. Refresh before archiving it.' }
    }
    let query = supabase
        .from('cost_rate_book')
        .update({ is_active: false, updated_by: user.id, updated_at: new Date().toISOString() })
        .eq('id', rateId)
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
    if (expectedUpdatedAt) query = query.eq('updated_at', expectedUpdatedAt)
    const { data, error } = await query.select('id, updated_at').maybeSingle()
    if (error) return { error: error.message }
    if (!data) return { error: 'This rate changed in another tab or was already archived. Refresh before archiving it.' }
    revalidatePath('/owner/rates')
    revalidatePath('/owner', 'layout')
    return { success: true, updatedAt: data.updated_at }
}

export async function restoreCostRate(rateId: string, expectedUpdatedAt?: string) {
    if (!UUID_PATTERN.test(rateId)) return { error: 'Rate identifier is invalid.' }
    const { user, profile } = await requireRole(['owner'])
    const tierError = await requireBaseTier(profile.org_id)
    if (tierError) return { error: tierError }
    if (expectedUpdatedAt && !Number.isFinite(Date.parse(expectedUpdatedAt))) {
        return { error: 'This rate changed or is missing its version. Refresh before restoring it.' }
    }
    const supabase = await createServerClient()
    await setAuditActor(supabase, user.id)
    let query = supabase
        .from('cost_rate_book')
        .update({ is_active: true, updated_by: user.id, updated_at: new Date().toISOString() })
        .eq('id', rateId)
        .eq('org_id', profile.org_id)
        .eq('is_active', false)
    if (expectedUpdatedAt) query = query.eq('updated_at', expectedUpdatedAt)
    const { data, error } = await query.select('id, updated_at').maybeSingle()
    if (error) return { error: error.message }
    if (!data) return { error: 'This rate changed in another tab or was already restored. Refresh before restoring it.' }
    revalidatePath('/owner/rates')
    revalidatePath('/owner', 'layout')
    return { success: true, updatedAt: data.updated_at }
}
