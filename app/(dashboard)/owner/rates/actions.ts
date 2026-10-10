'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getCachedOrgTier } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { getRateReviewStatus, type CostRateRow } from '@/lib/cost-rates'
import type { PricePoint } from '@/lib/rate-book-board'
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
/** How many of a yarn's latest recorded prices its board card draws. */
const PRICE_TRAIL_POINTS = 24

async function requireBaseTier(orgId: string) {
    return hasCapability(await getCachedOrgTier(orgId), 'rate_book')
        ? null
        : 'An active Weavly Lite or Weavly Base subscription is required.'
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
    const { profile } = await requireRole(['owner'])
    const tierError = await requireBaseTier(profile.org_id)
    if (tierError) return { error: tierError }
    const supabase = await createServerClient()

    const includeArchived = Boolean(options?.includeArchived)
    let ratesQuery = supabase
            .from('cost_rate_book')
            .select('id, name, category, unit, current_value, previous_value, effective_date, last_reviewed_at, review_interval_days, source, notes, apply_as_default, updated_at, is_active')
            .eq('org_id', profile.org_id)
            .order('category')
            .order('name')
    if (!includeArchived) ratesQuery = ratesQuery.eq('is_active', true)

    // The Rate Book GET is intentionally read-only. Yarn discovery happens on
    // costing/Saved Quality writes; usage and conflict detail is secondary.
    // The legacy standalone costing fallback used `.is('template_id', null)`;
    // it is intentionally absent from this critical GET and is represented by
    // the explicit read-only usage action below.
    const [ratesResult, profileResult, reviewedResult] = await Promise.all([
        ratesQuery,
        supabase
            .from('factory_cost_profile')
            .select('yarn_review_interval_days')
            .eq('factory_id', profile.org_id)
            .maybeSingle(),
        // The same history rows also carry each recorded price, which the
        // board draws as the yarn's price trail.
        supabase
            .from('cost_rate_history')
            .select('rate_id, value, effective_date')
            .eq('org_id', profile.org_id)
            .in('event_type', ['recorded', 'reviewed', 'changed']),
    ])
    const { data: existingRates, error } = ratesResult
    if (error) return { error: error.message }
    if (profileResult.error) return { error: profileResult.error.message }
    if (reviewedResult.error) return { error: reviewedResult.error.message }
    const yarnReviewIntervalDays = Number(profileResult.data?.yarn_review_interval_days ?? 90)
    const reviewedRateIds = new Set((reviewedResult.data ?? []).map(row => row.rate_id))
    const pricePoints = new Map<string, PricePoint[]>()
    for (const row of reviewedResult.data ?? []) {
        const value = Number(row.value)
        if (!Number.isFinite(value) || !row.effective_date) continue
        const points = pricePoints.get(row.rate_id) ?? []
        points.push({ date: row.effective_date, value })
        pricePoints.set(row.rate_id, points)
    }
    return {
        data: (existingRates ?? []).map(rate => ({
            ...rate,
            is_reviewed: reviewedRateIds.has(rate.id),
            price_points: (pricePoints.get(rate.id) ?? []).sort((left, right) => left.date.localeCompare(right.date)).slice(-PRICE_TRAIL_POINTS),
            discovery_source: isYarnRateDiscoverySource(rate.source)
                ? getYarnRateDiscoverySource(rate.source)
                : null,
            fabric_names: [],
            // Deferred usage mapping retains the prior contract:
            // saved_quality_count: candidate?.savedQualityCount ?? 0
            saved_quality_count: 0,
        })),
        conflicts: [],
        yarnReviewIntervalDays,
    }
}

/**
 * Secondary usage/conflict read for the Rate Book. It deliberately has no
 * write-capable RPCs: legacy gaps are reconciled by the explicit maintenance
 * operation or by the write-time triggers, never by a page GET.
 */
export async function getCostRateUsage() {
    const { profile } = await requireRole(['owner'])
    const tierError = await requireBaseTier(profile.org_id)
    if (tierError) return { error: tierError }
    const supabase = await createServerClient()
    const { data: templates, error } = await supabase
        .from('estimator_templates')
        .select('id, name, warp_rows, weft_rows')
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
    if (error) return { error: error.message }

    const qualityTemplates = (templates ?? []).map(template => ({
        ...template,
        discoverySource: 'saved_quality' as const,
    })) as YarnRateTemplate[]

    // Legacy page discovery previously used review_interval_days:
    // review_interval_days: yarnReviewIntervalDays
    // and `.from('estimator_quotes').eq('record_kind', 'costing').is('template_id', null)`.
    // The Rate Book is strictly quality-first: only active Saved Qualities define yarn usage.
    return {
        data: collectYarnRateCandidates(qualityTemplates),
        conflicts: getYarnRateConflicts(qualityTemplates),
    }
}

/**
 * Explicit maintenance operation for legacy rows created before write-time
 * yarn synchronization. It is intentionally not called by the Rate Book GET.
 */
export async function reconcileLegacyYarnRates() {
    const { user, profile } = await requireRole(['owner'])
    const usage = await getCostRateUsage()
    if (usage.error) return { error: usage.error }
    const supabase = await createServerClient()
    await setAuditActor(supabase, user.id)
    const { data: reviewProfile, error: reviewProfileError } = await supabase
        .from('factory_cost_profile')
        .select('yarn_review_interval_days')
        .eq('factory_id', profile.org_id)
        .maybeSingle()
    if (reviewProfileError) return { error: reviewProfileError.message }
    const reviewIntervalDays = Number(reviewProfile?.yarn_review_interval_days ?? 90)

    let attempted = 0
    for (const candidate of usage.data ?? []) {
        const { error } = await supabase.rpc('discover_yarn_rate_atomic', {
            p_name: candidate.yarnName,
            p_category: candidate.category,
            p_current_value: candidate.currentValue,
            p_review_interval_days: reviewIntervalDays,
            p_source: 'Saved quality',
            p_notes: candidate.usageNotes.slice(0, 500),
        })
        if (error) return { error: error.message, attempted }
        attempted += 1
    }

    // Clean up orphaned auto-discovered rates with zero active usages
    const { data: existingYarnRates } = await supabase
        .from('cost_rate_book')
        .select('id, name, category, source, apply_as_default')
        .eq('org_id', profile.org_id)
        .in('category', ['yarn_warp', 'yarn_weft'])
        .in('source', ['Saved quality', 'Saved costing'])
        .eq('apply_as_default', false)

    const activeKeys = new Set(
        (usage.data ?? []).map(c => `${c.category}:${c.normalizedName}`),
    )
    const orphanIds = (existingYarnRates ?? [])
        .filter(r => !activeKeys.has(`${r.category}:${normalizeYarnName(r.name)}`))
        .map(r => r.id)

    if (orphanIds.length > 0) {
        await supabase
            .from('cost_rate_book')
            .delete()
            .eq('org_id', profile.org_id)
            .in('id', orphanIds)
    }

    revalidatePath('/owner/rates')
    return { data: { attempted, conflictCount: usage.conflicts?.length ?? 0 } }
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

export async function confirmAllCostRateReviews(
    ratesToReview: { id: string; expectedUpdatedAt: string }[]
): Promise<{ data?: CostRateRow[]; count?: number; error?: string }> {
    if (!Array.isArray(ratesToReview)) return { error: 'Invalid rates payload.' }
    if (ratesToReview.length === 0) return { data: [], count: 0 }

    for (const item of ratesToReview) {
        if (!item?.id || !UUID_PATTERN.test(item.id)) return { error: 'Rate identifier is invalid.' }
        if (!item.expectedUpdatedAt || !Number.isFinite(Date.parse(item.expectedUpdatedAt))) {
            return { error: 'One or more rates changed or are missing version data. Refresh before reviewing.' }
        }
    }

    const { user, profile } = await requireRole(['owner'])
    const tierError = await requireBaseTier(profile.org_id)
    if (tierError) return { error: tierError }

    const supabase = await createServerClient()
    await setAuditActor(supabase, user.id)

    const updatedRates: CostRateRow[] = []
    for (const item of ratesToReview) {
        const { data, error } = await supabase.rpc('review_cost_rate_atomic', {
            p_rate_id: item.id,
            p_expected_updated_at: item.expectedUpdatedAt,
        })
        if (error) return { error: error.message }
        const result = data as { rate?: unknown } | null
        if (!result?.rate) {
            return { error: 'A rate review completed without returning the reviewed rate.' }
        }
        updatedRates.push(result.rate as CostRateRow)
    }

    revalidatePath('/owner/rates')
    revalidatePath('/owner/estimator')
    return { data: updatedRates, count: updatedRates.length }
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

export async function deleteCostRate(rateId: string) {
    if (!UUID_PATTERN.test(rateId)) return { error: 'Rate identifier is invalid.' }
    const { profile } = await requireRole(['owner'])
    const tierError = await requireBaseTier(profile.org_id)
    if (tierError) return { error: tierError }
    const supabase = await createServerClient()

    const { data: targetRate, error: targetError } = await supabase
        .from('cost_rate_book')
        .select('id, name, category, source, apply_as_default')
        .eq('id', rateId)
        .eq('org_id', profile.org_id)
        .maybeSingle()
    if (targetError) return { error: targetError.message }
    if (!targetRate) return { error: 'Rate no longer exists.' }
    if (targetRate.apply_as_default) return { error: 'Default rates cannot be deleted. You can edit them or clear the default flag.' }

    const usage = await getCostRateUsage()
    if (usage.error) return { error: usage.error }

    const isUsed = (usage.data ?? []).some(
        c => c.category === targetRate.category && c.normalizedName === normalizeYarnName(targetRate.name),
    )
    if (isUsed) {
        return { error: 'This rate is currently used by a saved quality or costing. Change or archive that quality before deleting this rate.' }
    }

    const { error: deleteError } = await supabase
        .from('cost_rate_book')
        .delete()
        .eq('id', rateId)
        .eq('org_id', profile.org_id)
    if (deleteError) return { error: deleteError.message }

    revalidatePath('/owner/rates')
    revalidatePath('/owner', 'layout')
    return { success: true }
}

