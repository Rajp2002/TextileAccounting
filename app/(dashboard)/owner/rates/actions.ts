'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getCachedOrgTier, tierSatisfies } from '@/lib/subscription'
import { getRateReviewStatus } from '@/lib/cost-rates'
import {
    collectYarnRateCandidates,
    getYarnRateDiscoverySource,
    getYarnRateConflicts,
    isYarnRateDiscoverySource,
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
    return tierSatisfies(await getCachedOrgTier(orgId), 'base')
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

/**
 * Lightweight read for the Estimator shell. The full Rate Book loader also
 * discovers missing yarn rates from every saved quality and costing; that
 * work is only needed when opening the Rate Book itself, not to mark stale
 * default rates on the Estimator sidebar.
 */
export async function getStaleDefaultCostRateNames(): Promise<{ data?: string[]; error?: string }> {
    const { profile } = await requireRole(['owner'])
    const tierError = await requireBaseTier(profile.org_id)
    if (tierError) return { error: tierError }

    const supabase = await createServerClient()
    const { data, error } = await supabase
        .from('cost_rate_book')
        .select('name, last_reviewed_at, review_interval_days')
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
        .eq('apply_as_default', true)

    if (error) return { error: error.message }

    return {
        data: (data ?? [])
            .filter(rate => getRateReviewStatus(rate) === 'overdue')
            .map(rate => rate.name),
    }
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

    const includeArchived = Boolean(options?.includeArchived)
    let ratesQuery = supabase
            .from('cost_rate_book')
            .select('*')
            .eq('org_id', profile.org_id)
            .order('category')
            .order('name')
    if (!includeArchived) ratesQuery = ratesQuery.eq('is_active', true)

    // These four reads do not depend on one another. Starting them as one
    // batch removes a full Supabase round trip from the Rate Book cold path.
    const [ratesResult, profileResult, templatesResult, costingsResult] = await Promise.all([
        ratesQuery,
        supabase
            .from('factory_cost_profile')
            .select('yarn_review_interval_days')
            .eq('factory_id', profile.org_id)
            .maybeSingle(),
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
    const { data: existingRates, error } = ratesResult
    if (error) return { error: error.message }
    if (profileResult.error) return { error: profileResult.error.message }
    const yarnReviewIntervalDays = Number(profileResult.data?.yarn_review_interval_days ?? 90)

    if (templatesResult.error || costingsResult.error) {
        return { error: templatesResult.error?.message ?? costingsResult.error?.message }
    }

    const qualityTemplates = (templatesResult.data ?? []).map(template => ({
        ...template,
        discoverySource: 'saved_quality' as const,
    })) as YarnRateTemplate[]
    const savedCostings: YarnRateTemplate[] = (costingsResult.data ?? []).map(costing => ({
        id: `costing:${costing.id}`,
        name: costing.quality_label?.trim() || costing.party_name?.trim() || 'Saved costing',
        discoverySource: 'saved_costing',
        warp_rows: costing.warp_rows,
        weft_rows: costing.weft_rows,
    })) as YarnRateTemplate[]
    const savedYarnSources = [...qualityTemplates, ...savedCostings]
    let rates = existingRates ?? []

    const savedCandidates = collectYarnRateCandidates(savedYarnSources)
    if (savedCandidates.length) {
        await setAuditActor(supabase, user.id)
        for (const candidate of savedCandidates) {
            const { error: discoverError } = await supabase.rpc('discover_yarn_rate_atomic', {
                p_name: candidate.yarnName,
                p_category: candidate.category,
                p_current_value: candidate.currentValue,
                p_review_interval_days: yarnReviewIntervalDays,
                p_source: candidate.discoverySource === 'saved_quality' ? 'Saved quality' : 'Saved costing',
                p_notes: candidate.usageNotes.slice(0, 500),
            })
            if (discoverError) return { error: discoverError.message }
        }

        let refreshedQuery = supabase
            .from('cost_rate_book')
            .select('*')
            .eq('org_id', profile.org_id)
        if (!includeArchived) refreshedQuery = refreshedQuery.eq('is_active', true)

        const { data: refreshed, error: refreshError } = await refreshedQuery
            .order('category')
            .order('name')
        if (refreshError) return { error: refreshError.message }
        rates = refreshed ?? []
    }

    const { data: reviewedRows, error: reviewedError } = await supabase
        .from('cost_rate_history')
        .select('rate_id')
        .eq('org_id', profile.org_id)
        .in('event_type', ['recorded', 'reviewed', 'changed'])
    if (reviewedError) return { error: reviewedError.message }

    const reviewedRateIds = new Set((reviewedRows ?? []).map(row => row.rate_id))
    const candidateByKey = new Map(savedCandidates.map(candidate => [
        `${candidate.category}:${candidate.normalizedName}`,
        candidate,
    ]))
    return {
        data: rates.map(rate => {
            const candidate = candidateByKey.get(`${rate.category}:${normalizeYarnName(rate.name)}`)
            return {
                ...rate,
                is_reviewed: reviewedRateIds.has(rate.id),
                discovery_source: candidate && isYarnRateDiscoverySource(rate.source)
                    ? getYarnRateDiscoverySource(rate.source) ?? candidate.discoverySource
                    : null,
                fabric_names: candidate?.fabricNames ?? [],
                saved_quality_count: candidate?.savedQualityCount ?? 0,
            }
        }),
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
    if (error) return { error: error.message }

    const rows = data ?? []
    const actorIds = [...new Set(rows.map(row => row.changed_by).filter((id): id is string => Boolean(id)))]
    if (actorIds.length === 0) return { data: rows.map(row => ({ ...row, actor_name: null, actor_role: null })) }

    const { data: actors, error: actorError } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('org_id', profile.org_id)
        .in('id', actorIds)
    if (actorError) return { error: actorError.message }

    const actorById = new Map((actors ?? []).map(actor => [actor.id, actor]))
    return {
        data: rows.map(row => ({
            ...row,
            actor_name: row.changed_by ? actorById.get(row.changed_by)?.full_name ?? null : null,
            actor_role: row.changed_by ? actorById.get(row.changed_by)?.role ?? null : null,
        })),
    }
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

export async function confirmCostRateReview(rateId: string, expectedUpdatedAt: string) {
    if (!UUID_PATTERN.test(rateId)) return { error: 'Rate identifier is invalid.' }
    if (!expectedUpdatedAt || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
        return { error: 'This rate changed or is missing its version. Refresh before reviewing it.' }
    }
    const { user, profile } = await requireRole(['owner'])
    const tierError = await requireBaseTier(profile.org_id)
    if (tierError) return { error: tierError }
    const supabase = await createServerClient()
    await setAuditActor(supabase, user.id)
    const { data, error } = await supabase.rpc('review_cost_rate_atomic', {
        p_rate_id: rateId,
        p_expected_updated_at: expectedUpdatedAt,
    })
    if (error) return { error: error.message }
    const result = data as { rate?: unknown } | null
    if (!result?.rate) return { error: 'The rate review completed without returning the reviewed rate.' }
    revalidatePath('/owner/rates')
    revalidatePath('/owner/estimator')
    return { data: result.rate }
}

async function setCostRateActive(rateId: string, expectedUpdatedAt: string | undefined, isActive: boolean) {
    if (!UUID_PATTERN.test(rateId)) return { error: 'Rate identifier is invalid.' }
    if (!expectedUpdatedAt || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
        return { error: `This rate changed or is missing its version. Refresh before ${isActive ? 'restoring' : 'archiving'} it.` }
    }
    const { user, profile } = await requireRole(['owner'])
    const tierError = await requireBaseTier(profile.org_id)
    if (tierError) return { error: tierError }
    const supabase = await createServerClient()
    await setAuditActor(supabase, user.id)
    const { data, error } = await supabase.rpc('set_cost_rate_active_atomic', {
        p_rate_id: rateId,
        p_expected_updated_at: expectedUpdatedAt,
        p_is_active: isActive,
    })
    if (error) return { error: error.message }
    const result = data as { id?: string; updated_at?: string; is_active?: boolean } | null
    if (!result?.id) return { error: `The rate could not be ${isActive ? 'restored' : 'archived'}.` }
    revalidatePath('/owner/rates')
    revalidatePath('/owner', 'layout')
    return { success: true, updatedAt: result.updated_at, isActive: result.is_active }
}

export async function archiveCostRate(rateId: string, expectedUpdatedAt?: string) {
    return setCostRateActive(rateId, expectedUpdatedAt, false)
}

export async function restoreCostRate(rateId: string, expectedUpdatedAt?: string) {
    return setCostRateActive(rateId, expectedUpdatedAt, true)
}
