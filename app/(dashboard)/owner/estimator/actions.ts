'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { buildCostingResult, calcFullTotals, calcWorkerRateSnapshot, normalizeCurrencySnapshot, getEffectiveCostingWidthCm, getEffectiveYarnDenier, ensureOverheadIntegrity, LOOM_TYPE_DEFAULTS, makeDefaultEstimateState, type EstimateState, type FactorySections, type WarpRow, type WeftRow, type OverheadItem, type OverheadMode } from '@/lib/estimator'
import { getFirstEstimatorValidationMessage, requiresFactoryCapacity, validateEstimatorQuoteBoundary, validateEstimatorSnapshot, validateFactoryCostProfile } from '@/lib/estimator-validation'
import crypto from 'crypto'
import { readCompleteBaseRows } from '@/lib/base-complete-query'
import { currentBaseMonthlySalary, mergeBaseSalaryOverhead, readBaseSalaryHistory } from '@/lib/base-salary'
import type { BaseProductionWorker } from '@/lib/base-production-core'
import { getSuratTodayString } from '@/lib/time'
import { executeQuoteConversion } from '@/lib/quotes/convert-accepted-quote-to-order'
import { getMarketRunDisplayStatus } from '@/lib/market-runs'
import { getCachedOrgTier, getOrgTier, tierSatisfies } from '@/lib/subscription'
import { getNewEstimateRecordKind, normalizeCostingRecordKind, shouldCreateImmutableRevision } from '@/lib/costing-workspace'
import { getEstimatorWorkflowConfig, getOrganizationProductionMode } from '@/lib/production-mode'
import { buildSavedQualityRecipeState, type SavedQualityCostingReuse } from '@/lib/saved-costings'
import { auditHistoricalCosting } from '@/lib/costing-reconciliation'
import type { FactoryProfileId } from '@/lib/factory-cost-profiles'
import { buildCostingInputFingerprint } from '@/lib/costing-save-trust'
import { getRateReviewStatus } from '@/lib/cost-rates'
import { findCostingSaveReceipt } from '@/lib/costing-save-receipt'
import {
    deriveCostingOverheadPerMetre,
    MAX_MONTHLY_OVERHEAD_AMOUNT,
    MAX_STANDARD_MONTHLY_PRODUCTION_METRES,
} from '@/lib/monthly-overhead'

/**
 * Generates a 12-character URL-safe tracking token for orders.
 * Uses Node.js crypto (built-in, no ESM issues) — 9 random bytes → base64url → 12 chars.
 * e.g. 'aB3xK9mPqR2w' — non-guessable, safe for WhatsApp without line-wrapping.
 */
function generateTrackingToken(): string {
    return crypto.randomBytes(9).toString('base64url').slice(0, 12)
}

const ESTIMATOR_NAME_MAX_LENGTH = 120
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ProductionSetupRequirement = {
    error: string
    setupRequired?: 'machine'
}

async function getProductionSetupRequirement(
    supabase: Awaited<ReturnType<typeof createServerClient>>,
    orgId: string,
): Promise<ProductionSetupRequirement | null> {
    const { count, error } = await supabase
        .from('machines')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)

    if (error) {
        console.error('Failed to check loom setup before production start:', error)
        return { error: 'Could not check loom setup. Please try again.' }
    }

    if ((count ?? 0) === 0) {
        return { error: 'Add at least one loom before starting production.', setupRequired: 'machine' }
    }

    return null
}

async function attestCanonicalCostingPayload<T extends Record<string, unknown>>(
    userId: string,
    orgId: string,
    payload: T,
): Promise<{ payload?: T & { server_attestation_id: string }; error?: string }> {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('register_estimator_costing_attestation', {
        p_user_id: userId,
        p_org_id: orgId,
        p_payload: payload,
    })
    if (error) return { error: error.message }
    if (typeof data !== 'string' || !UUID_PATTERN.test(data)) {
        return { error: 'The server could not verify the canonical costing payload.' }
    }
    return { payload: { ...payload, server_attestation_id: data } }
}

function buildQuotationReference(id: string, createdAt = new Date()) {
    return `QT-${createdAt.getUTCFullYear()}-${id.replaceAll('-', '').slice(0, 8).toUpperCase()}`
}

function normalizeQuotationDate(value: string | null | undefined) {
    if (value === undefined || value === null || value === '') return null
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
    const timestamp = Date.parse(`${value}T00:00:00Z`)
    return Number.isFinite(timestamp) ? value : null
}

function normalizeCustomerTerms(value: string | null | undefined) {
    const terms = value?.trim() ?? ''
    return terms ? terms.slice(0, 2000) : null
}

type TemplateRecipeInput = {
    warpRows: WarpRow[]
    weftRows: WeftRow[]
    tapeLengthM?: number
    warpCrimpPct?: number
    perPickCostPaisa?: number
    yarnShortagePct?: number
    overheadOverridePerM?: number | null
    loomType?: string | null
    loomRpm?: number | null
    loomPowerKw?: number | null
    warpingMode?: 'in_house' | 'outsourced'
    sizingMode?: 'in_house' | 'outsourced'
    hoursPerShift?: number | null
}

function normalizeTemplateName(value: string): string {
    return value.trim().replace(/\s+/g, ' ')
}

function normalizeTemplateNameKey(value: string): string {
    return normalizeTemplateName(value).toLocaleLowerCase('en-IN')
}

function templateRecipeSignature(recipe: {
    warpRows: WarpRow[] | null | undefined
    weftRows: WeftRow[] | null | undefined
    tapeLengthM?: number | string | null
    warpCrimpPct?: number | string | null
    perPickCostPaisa?: number | string | null
    yarnShortagePct?: number | string | null
    overheadOverridePerM?: number | string | null
    loomType?: string | null
    loomRpm?: number | string | null
    loomPowerKw?: number | string | null
    warpingMode?: string | null
    sizingMode?: string | null
    hoursPerShift?: number | string | null
}) {
    const rows = (value: WarpRow[] | WeftRow[] | null | undefined) =>
        (value ?? []).map(row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'id')))
    return JSON.stringify({
        warpRows: rows(recipe.warpRows),
        weftRows: rows(recipe.weftRows),
        tapeLengthM: Number(recipe.tapeLengthM ?? 0),
        warpCrimpPct: Number(recipe.warpCrimpPct ?? 0),
        perPickCostPaisa: Number(recipe.perPickCostPaisa ?? 0),
        yarnShortagePct: Number(recipe.yarnShortagePct ?? 0),
        overheadOverridePerM: recipe.overheadOverridePerM == null ? null : Number(recipe.overheadOverridePerM),
        loomType: recipe.loomType ?? null,
        loomRpm: recipe.loomRpm == null ? null : Number(recipe.loomRpm),
        loomPowerKw: recipe.loomPowerKw == null ? null : Number(recipe.loomPowerKw),
        warpingMode: recipe.warpingMode ?? null,
        sizingMode: recipe.sizingMode ?? null,
        hoursPerShift: recipe.hoursPerShift == null ? null : Number(recipe.hoursPerShift),
    })
}

function templateWriteError(error: { code?: string; message: string }) {
    if (error.code === '23505') {
        return 'A saved quality with this name already exists. Choose Use as Starting Point and give the new quality a different name.'
    }
    return error.message
}

function validateTemplateName(value: string): string | null {
    const name = normalizeTemplateName(value)
    if (!name) return 'Quality name is required.'
    if (name.length > ESTIMATOR_NAME_MAX_LENGTH) {
        return `Quality name must be ${ESTIMATOR_NAME_MAX_LENGTH} characters or fewer.`
    }
    return null
}

function isLikelyQualityNameCorrection(currentValue: string, nextValue: string) {
    const current = normalizeTemplateNameKey(currentValue)
    const next = normalizeTemplateNameKey(nextValue)
    if (current === next) return true
    if (Math.abs(current.length - next.length) > 3) return false

    const previousRow = Array.from({ length: next.length + 1 }, (_, index) => index)
    for (let row = 1; row <= current.length; row += 1) {
        const nextRow = [row]
        for (let column = 1; column <= next.length; column += 1) {
            nextRow[column] = Math.min(
                nextRow[column - 1] + 1,
                previousRow[column] + 1,
                previousRow[column - 1] + (current[row - 1] === next[column - 1] ? 0 : 1),
            )
        }
        previousRow.splice(0, previousRow.length, ...nextRow)
    }
    return previousRow[next.length] <= Math.max(2, Math.floor(Math.max(current.length, next.length) * 0.08))
}

function validateOptionalPositiveNumber(
    value: unknown,
    label: string,
    maximum: number
): string | null {
    if (value === null || value === undefined) return null
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric <= 0) return `${label} must be greater than zero.`
    if (numeric > maximum) return `${label} is outside the supported range.`
    return null
}

function validateTemplateRecipe(data: TemplateRecipeInput): string | null {
    const base = makeDefaultEstimateState()
    const snapshot: EstimateState = {
        ...base,
        warpRows: data.warpRows,
        weftRows: data.weftRows,
        tapeLengthM: data.tapeLengthM ?? 1,
        warpCrimpPct: data.warpCrimpPct ?? base.warpCrimpPct,
        perPickCostPaisa: data.perPickCostPaisa ?? 0.01,
        yarnShortagePct: data.yarnShortagePct ?? base.yarnShortagePct,
        overheadOverridePerM: data.overheadOverridePerM ?? null,
        monthlyOutputM: 1,
    }
    // A saved quality is a reusable recipe, not a production beam plan. Base
    // intentionally hides tape length, while production workflows validate it
    // when a costing/order snapshot is saved. Do not make the hidden field a
    // prerequisite for persisting a Base quality.
    const recipeError = getFirstEstimatorValidationMessage(validateEstimatorSnapshot(snapshot, {
        requireTapeLength: false,
    }))
    if (recipeError) return recipeError

    if (data.warpingMode !== undefined && !['in_house', 'outsourced'].includes(data.warpingMode)) {
        return 'Warping mode is invalid.'
    }
    if (data.sizingMode !== undefined && !['in_house', 'outsourced'].includes(data.sizingMode)) {
        return 'Sizing mode is invalid.'
    }
    if (data.loomType !== null && data.loomType !== undefined && !Object.prototype.hasOwnProperty.call(LOOM_TYPE_DEFAULTS, data.loomType)) {
        return 'Loom type is invalid.'
    }

    return validateOptionalPositiveNumber(data.loomRpm, 'Loom RPM', 10_000)
        ?? validateOptionalPositiveNumber(data.loomPowerKw, 'Loom power', 10_000)
        ?? validateOptionalPositiveNumber(data.hoursPerShift, 'Hours per shift', 24)
}

function validateExpectedTimestamp(value: string | undefined, label: string): string | null {
    if (!value || !Number.isFinite(Date.parse(value))) {
        return `${label} changed or is missing its version. Refresh before saving again.`
    }
    return null
}

function buildSavedQualityUpdatePayload(estimate: EstimateState) {
    const firstWarp = estimate.warpRows[0]
    const firstWeft = estimate.weftRows[0]

    return {
        warp_rows: estimate.warpRows,
        weft_rows: estimate.weftRows,
        per_pick_cost_paise: estimate.perPickCostPaisa,
        tape_length_m: estimate.tapeLengthM,
        warp_crimp_pct: estimate.warpCrimpPct ?? 0,
        yarn_shortage_pct: estimate.yarnShortagePct ?? 0,
        overhead_override_per_m: estimate.overheadMode === 'direct' ? estimate.overheadOverridePerM ?? null : null,
        loom_type: estimate.loomType ?? null,
        loom_rpm: estimate.loomRpm ?? null,
        loom_power_kw: estimate.loomPowerKw ?? null,
        sizing_mode: estimate.sizingMode,
        hours_per_shift: estimate.hoursPerShift,
        yarn_denier: Math.round(firstWarp ? getEffectiveYarnDenier(firstWarp) : 75),
        calculated_yarn_denier: firstWarp ? getEffectiveYarnDenier(firstWarp) : 75,
        beam_ends: firstWarp?.beamEnds ?? 3200,
        ppi: Math.round(firstWeft?.picks ?? 68),
        reed_space: firstWeft ? getEffectiveCostingWidthCm(firstWeft) : 62,
        weft_denier: firstWeft ? getEffectiveYarnDenier(firstWeft) : 75,
        default_yarn_rate: firstWarp?.yarnRate ?? 107,
    }
}

function validateClientRequestId(value: string): string | null {
    return UUID_PATTERN.test(value)
        ? null
        : 'The save request identifier is invalid. Refresh the estimator and try again.'
}

function getInitialQualitySnapshotRequestId(templateId: string): string {
    const hex = crypto.createHash('sha256').update(`initial-quality-costing:${templateId}`).digest('hex')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

async function requirePremiumTier(orgId: string): Promise<string | null> {
    const tier = await getOrgTier(orgId)
    return tierSatisfies(tier, 'premium')
        ? null
        : 'This action requires the broader factory workflow. Your costing workspace cannot create this record.'
}

function getAuthoritativeQuoteTotals(
    estimate: EstimateState,
    precomputedTotals?: ReturnType<typeof calcFullTotals>
) {
    const totals = precomputedTotals ?? calcFullTotals(estimate)
    const result = buildCostingResult(estimate, totals)
    return {
        totals,
        result,
        productionCostPerM: result.productionCostPerM,
        landedCostPerM: result.landedCostPerM,
        quotePricePerM: result.suggestedSellingPricePerM,
    }
}

function totalsMatchAuthoritative(
    clientProductionCostPerM: number,
    clientQuotePricePerM: number,
    authoritative: ReturnType<typeof getAuthoritativeQuoteTotals>
) {
    return normalizeCurrencySnapshot(clientProductionCostPerM) === authoritative.productionCostPerM
        && normalizeCurrencySnapshot(clientQuotePricePerM) === authoritative.quotePricePerM
}

// ─── Factory Cost Profile ─────────────────────────────────────────────────────

export async function getFactoryCostProfile(options?: { createIfMissing?: boolean }) {
    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('factory_cost_profile')
        .select('*')
        .eq('factory_id', profile.org_id)
        .maybeSingle()

    if (error) return { error: error.message }

    const staffResult = await readCompleteBaseRows((from, to) => supabase.from('base_production_workers')
        .select('id, name, role, pay_type, is_active, monthly_salary, start_date, end_date, salary_history', from === 0 ? { count: 'exact' } : {})
        .eq('org_id', profile.org_id).eq('pay_type', 'fixed_monthly').order('id').range(from, to))
    if (staffResult.error) return { error: 'Staff salary overhead could not be loaded. Please refresh and try again.' }
    const staff: BaseProductionWorker[] = (staffResult.data ?? []).map(row => ({ ...row,
        pay_type: 'fixed_monthly', rate_per_meter: 0, shift_availability: 'both', salary_history: readBaseSalaryHistory(row.salary_history),
    }))
    const withStaff = (costProfile: NonNullable<typeof data>) => {
        const today = getSuratTodayString()
        const items = mergeBaseSalaryOverhead(ensureOverheadIntegrity(costProfile.overhead_items ?? []), staff, today)
        return { ...costProfile, overhead_items: items,
            overhead_override_per_m: staff.length && costProfile.overhead_mode === 'monthly_expenses'
                ? deriveCostingOverheadPerMetre(items, Number(costProfile.monthly_output_m)) : costProfile.overhead_override_per_m,
            base_salary_staff: staff.filter(worker => currentBaseMonthlySalary(worker, today) > 0).map(worker => ({ id: worker.id, name: worker.name, monthlySalary: currentBaseMonthlySalary(worker, today) })),
        }
    }

    // Page reads may opt out of the legacy first-visit bootstrap write. This
    // keeps a GET/read path read-only while settings' explicit profile editor
    // can retain the compatibility behavior when it intentionally requests it.
    if (!data && options?.createIfMissing !== false) {
        try {
            await supabase.rpc('set_actor_for_audit', { p_actor_id: user.id })
        } catch {
            // Non-fatal: authenticated writes still fall back to auth.uid() in the audit trigger.
        }

        const { data: created, error: createError } = await supabase
            .from('factory_cost_profile')
            .insert({
                factory_id:              profile.org_id,
                warping_rate_per_kg:     2.00,
                sizing_rate_per_kg:      1.50,
                winding_rate_per_kg:     0,
                overhead_pct:            0,
                overhead_mode:           'monthly_expenses',
                monthly_output_m:        0,
                default_commission_pct:  0,
                default_margin_pct:      10.00,
                default_transport_per_m: 0,
                yarn_review_interval_days: 90,
                loom_count:              0,
                monthly_working_days:    26,
                avg_output_per_loom_per_day: 50,
                enabled_sections: {
                    winding:    false,
                    processing: false,
                    finishing:  false,
                    commission: false,
                    transport:  false,
                },
                is_configured: false,
            })
            .select()
            .single()

            if (createError) return { error: createError.message }
            return { data: withStaff(created) }
    }

    return { data: data ? withStaff(data) : null }
}

// ─── Fixed Workers for Overhead ───────────────────────────────────────────────

/**
 * Fetches active fixed-salary workers so the estimator can pre-populate
 * the "Fixed Salary Staff" overhead section with real DB data.
 * Returns light objects; each maps to an OverheadItem with source='fixed_worker_derived'.
 */
export async function getFixedWorkersForOverhead(): Promise<{
    data?: { id: number; name: string; role: string; monthly_salary: number }[]
    error?: string
}> {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const tierError = await requirePremiumTier(profile.org_id)
    if (tierError) return { error: tierError }

    const { data, error } = await supabase
        .from('fixed_workers')
        .select('id, name, role, monthly_salary')
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
        .order('role', { ascending: true })
        .order('name', { ascending: true })

    if (error) return { error: error.message }
    return { data: data ?? [] }
}

export async function upsertFactoryCostProfile(data: {
    warping_rate_per_kg:     number
    sizing_rate_per_kg:      number
    winding_rate_per_kg:     number
    overhead_pct?:           number
    overhead_mode?:          OverheadMode
    default_commission_pct:  number
    default_margin_pct?:     number
    default_transport_per_m: number
    yarn_review_interval_days?: number
    default_processing_rate_per_m?: number
    default_finishing_rate_per_m?: number
    enabled_sections:        FactorySections
    factory_profile_key?:    FactoryProfileId
    overhead_items?:         OverheadItem[]
    monthly_output_m?:       number
    overhead_override_per_m?: number | null
    loom_count?:             number
    monthly_working_days?:   number
    avg_output_per_loom_per_day?: number
    yarn_shortage_pct?:      number
    warp_crimp_pct?:         number
    is_configured?:          boolean
    requireCapacity?:        boolean
    expectedUpdatedAt?:       string
}) {
    if (data.factory_profile_key && !['unselected', 'grey_weaver', 'job_weaver', 'processed_fabric', 'full_mill', 'custom'].includes(data.factory_profile_key)) {
        return { error: 'Choose a valid factory costing profile.' }
    }

    if (data.overhead_mode === 'monthly_expenses' || (data.overhead_mode == null && data.overhead_override_per_m == null)) {
        const monthlyOutput = Number(data.monthly_output_m ?? 0)
        const loomCount = Number(data.loom_count ?? 0)
        const workingDays = Number(data.monthly_working_days ?? 0)
        const avgOutput = Number(data.avg_output_per_loom_per_day ?? 0)
        // The first-run estimator wizard and production-capable workflows
        // still require a complete capacity reference. Lite Settings is the
        // one intentional exception: it can save a costing baseline from
        // standard monthly production and expenses without production metadata.
        if (data.requireCapacity !== false && (!Number.isFinite(loomCount) || loomCount <= 0)) return { error: 'Enter at least one loom before saving the monthly factory baseline.' }
        if (data.requireCapacity !== false && (!Number.isFinite(workingDays) || workingDays <= 0)) return { error: 'Enter positive working days before saving the monthly factory baseline.' }
        if (data.requireCapacity !== false && (!Number.isFinite(avgOutput) || avgOutput <= 0)) return { error: 'Enter positive daily output per loom before saving the monthly factory baseline.' }
        if (monthlyOutput <= 0) return { error: 'Enter the standard monthly production used to divide factory expenses.' }
    }

    const validationError = getFirstEstimatorValidationMessage(validateFactoryCostProfile(data))
    if (validationError) return { error: validationError }
    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    try {
        await supabase.rpc('set_actor_for_audit', { p_actor_id: user.id })
    } catch {
        // Non-fatal: authenticated writes still fall back to auth.uid() in the audit trigger.
    }

    const nextUpdatedAt = new Date().toISOString()
    const { expectedUpdatedAt, ...profileData } = data
    delete profileData.requireCapacity
    const normalizedProfileData = {
        ...profileData,
        // A successful save from Settings or the Estimator completes the
        // first-run baseline. Keep this explicit so monthly output and other
        // persisted defaults are hydrated on the next cold load.
        is_configured: data.is_configured ?? true,
        // Retain the legacy database column for older readers, but do not
        // calculate or expose an overhead percentage in the new workflow.
        overhead_pct: 0,
        overhead_mode: profileData.overhead_mode
            ?? (profileData.overhead_override_per_m != null ? 'direct' : 'monthly_expenses'),
    }
    let updatedAt: string | null = null

    if (expectedUpdatedAt) {
        const timestampError = validateExpectedTimestamp(expectedUpdatedAt, 'The factory baseline')
        if (timestampError) return { error: timestampError }

        const { data: updated, error } = await supabase
            .from('factory_cost_profile')
            .update({ ...normalizedProfileData, updated_at: nextUpdatedAt })
            .eq('factory_id', profile.org_id)
            .eq('updated_at', expectedUpdatedAt)
            .select('updated_at')
            .maybeSingle()

        if (error) return { error: error.message }
        if (!updated) return { error: 'The factory baseline changed in another tab. Refresh it before saving again.' }
        updatedAt = updated.updated_at
    } else {
        const { data: saved, error } = await supabase
            .from('factory_cost_profile')
            .upsert({
                factory_id: profile.org_id,
                ...normalizedProfileData,
                updated_at: nextUpdatedAt,
            }, { onConflict: 'factory_id' })
            .select('updated_at')
            .single()

        if (error) return { error: error.message }
        updatedAt = saved.updated_at
    }

    revalidatePath('/owner/estimator')
    revalidatePath('/owner/settings')
    revalidatePath('/owner', 'layout')
    return { success: true, updatedAt }
}

export async function applyMonthlyDerivedOverhead(data: {
    expenses: OverheadItem[]
    standardMonthlyProductionMetres: number
    expectedUpdatedAt: string
}) {
    if (!Array.isArray(data.expenses) || data.expenses.length === 0 || data.expenses.length > 500) {
        return { error: 'Enter at least one valid monthly factory expense.' }
    }

    const expenses = ensureOverheadIntegrity(data.expenses)
    for (const item of expenses) {
        if (!item.label.trim() || item.label.trim().length > 120) {
            return { error: 'Each monthly expense needs a description of 120 characters or fewer.' }
        }
        const amount = Number(item.monthlyAmount)
        if (!Number.isFinite(amount) || amount < 0) {
            return { error: 'Monthly expense amounts must be valid non-negative values.' }
        }
        if (amount > MAX_MONTHLY_OVERHEAD_AMOUNT) {
            return { error: 'Monthly expense amount exceeds the supported limit.' }
        }
    }

    const productionMetres = Number(data.standardMonthlyProductionMetres)
    if (!Number.isFinite(productionMetres) || productionMetres <= 0) {
        return { error: 'Enter standard monthly production greater than zero.' }
    }
    if (productionMetres > MAX_STANDARD_MONTHLY_PRODUCTION_METRES) {
        return { error: 'Standard monthly production exceeds the supported limit.' }
    }
    const derivedOverheadPerMetre = deriveCostingOverheadPerMetre(expenses, productionMetres)
    if (derivedOverheadPerMetre == null) {
        return { error: 'Enter standard monthly production greater than zero.' }
    }
    const timestampError = validateExpectedTimestamp(data.expectedUpdatedAt, 'The factory baseline')
    if (timestampError) return { error: timestampError }

    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    try {
        await supabase.rpc('set_actor_for_audit', { p_actor_id: user.id })
    } catch {
        // Non-fatal: authenticated writes still fall back to auth.uid().
    }

    const nextUpdatedAt = new Date().toISOString()
    const { data: updated, error } = await supabase
        .from('factory_cost_profile')
        .update({
            overhead_mode: 'monthly_expenses',
            overhead_items: expenses,
            monthly_output_m: productionMetres,
            overhead_override_per_m: derivedOverheadPerMetre,
            is_configured: true,
            updated_at: nextUpdatedAt,
        })
        .eq('factory_id', profile.org_id)
        .eq('updated_at', data.expectedUpdatedAt)
        .select('updated_at, overhead_items, overhead_override_per_m')
        .maybeSingle()

    if (error) return { error: error.message }
    if (!updated) return { error: 'The factory baseline changed in another tab. Refresh it before applying overhead.' }

    revalidatePath('/owner/estimator')
    revalidatePath('/owner/settings')
    revalidatePath('/owner', 'layout')
    return { success: true as const, updatedAt: updated.updated_at, expenses: updated.overhead_items as OverheadItem[], derivedOverheadPerMetre: Number(updated.overhead_override_per_m) }
}

// ─── Estimator Templates ──────────────────────────────────────────────────────

export async function getEstimatorTemplates(options?: { includeArchived?: boolean; summary?: boolean }) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const templateSelect = options?.summary ? 'id,name,updated_at,is_active' : '*'
    let query = supabase
        .from('estimator_templates')
        // The Supabase select parser cannot represent this conditional string
        // as one literal union; the runtime projection remains explicit.
        .select(templateSelect as '*')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })

    if (!options?.includeArchived) query = query.eq('is_active', true)

    const { data, error } = await query

    if (error) return { error: error.message }

    const templates = data ?? []
    if (options?.summary) return { data: templates }
    // Base is a repeat-costing product: when a quality is reopened, its
    // current recipe/rate rows should combine with the latest linked costing
    // assumptions. Full Suite keeps its existing quality-vs-quotation
    // separation and does not receive this Base-only enrichment.
    const effectiveTier = await getCachedOrgTier(profile.org_id)
    if (effectiveTier !== 'base' || templates.length === 0) return { data: templates }

    const templateIds = templates.map(template => template.id).filter(Boolean)
    const { data: costings, error: costingError } = await supabase
        .from('estimator_quotes')
        .select(`
            template_id,
            updated_at,
            warping_rate_per_kg,
            sizing_rate_per_kg,
            winding_rate_per_kg,
            processing_rate_per_m,
            finishing_rate_per_m,
            overhead_items,
            monthly_output_m,
            overhead_override_per_m,
            commission_pct,
            transport_per_m,
            profit_margin_pct,
            order_quantity_m,
            enabled_sections,
            loom_count,
            monthly_working_days,
            avg_output_per_loom_per_day
        `)
        .eq('org_id', profile.org_id)
        .eq('record_kind', 'costing')
        .in('template_id', templateIds)
        .order('updated_at', { ascending: false })

    if (costingError) return { error: costingError.message }

    const latestByTemplate = new Map<string, SavedQualityCostingReuse>()
    for (const costing of costings ?? []) {
        if (!costing.template_id || latestByTemplate.has(costing.template_id)) continue
        latestByTemplate.set(costing.template_id, costing)
    }

    return {
        data: templates.map(template => ({
            ...template,
            latest_costing_reuse: latestByTemplate.get(template.id) ?? null,
        })),
    }
}

/**
 * Secondary estimator data. The blank estimator only needs the factory
 * profile/defaults to calculate its first summary; saved qualities, premium
 * worker inputs, party suggestions, and review badges can hydrate after the
 * primary editor is interactive.
 */
export async function getEstimatorSecondaryData() {
    const { profile } = await requireRole(['owner'])
    const effectiveTier = await getCachedOrgTier(profile.org_id)
    const canUseProduction = tierSatisfies(effectiveTier, 'premium')
    const supabase = await createServerClient()

    const [templatesResult, workersResult, partiesResult, ratesResult] = await Promise.all([
        getEstimatorTemplates(),
        canUseProduction ? getFixedWorkersForOverhead() : Promise.resolve({ data: [] }),
        canUseProduction ? getEstimatorPartyNames() : Promise.resolve({ data: [] }),
        supabase
            .from('cost_rate_book')
            .select('name, last_reviewed_at, review_interval_days')
            .eq('org_id', profile.org_id)
            .eq('is_active', true)
            .eq('apply_as_default', true),
    ])

    const deferredErrors = [templatesResult, workersResult, partiesResult]
        .map(result => (result as { error?: string }).error)
        .filter((error): error is string => Boolean(error))
    if (ratesResult.error) deferredErrors.push(ratesResult.error.message)
    if (deferredErrors.length > 0) return { error: deferredErrors[0] }

    return {
        templates: templatesResult.data ?? [],
        workers: workersResult.data ?? [],
        partyNames: partiesResult.data ?? [],
        staleDefaultRateNames: (ratesResult.data ?? [])
            .filter(rate => getRateReviewStatus(rate) === 'overdue')
            .map(rate => rate.name),
    }
}

export async function saveAsFabricTemplate(data: {
    name:             string
    partyName?:       string
    warpRows:         WarpRow[]
    weftRows:         WeftRow[]
    tapeLengthM:      number
    warpCrimpPct?:    number
    perPickCostPaisa: number
    yarnShortagePct?: number
    overheadMode?: OverheadMode
    overheadOverridePerM?: number | null
    loomType?:        string | null
    loomRpm?:         number | null
    loomPowerKw?:     number | null
    warpingMode?:     'in_house' | 'outsourced'
    sizingMode?:      'in_house' | 'outsourced'
    hoursPerShift?:   number | null
    estimate:          EstimateState
}) {
    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const recipeError = validateTemplateRecipe(data)
    if (recipeError) return { error: recipeError }

    // Derive legacy flat fields from first row (legacy columns are now nullable,
    // but we still populate them for any older UI that reads them)
    const firstWarp = data.warpRows[0]
    const firstWeft = data.weftRows[0]

    const nameError = validateTemplateName(data.name)
    if (nameError) return { error: nameError }
    const normalizedName = normalizeTemplateName(data.name)
    const snapshotEstimate: EstimateState = {
        ...data.estimate,
        warpRows: data.warpRows,
        weftRows: data.weftRows,
    }
    const effectiveTier = await getOrgTier(profile.org_id)
    const requireCapacity = requiresFactoryCapacity(
        snapshotEstimate,
        tierSatisfies(effectiveTier, 'premium'),
    )
    const snapshotTotals = getAuthoritativeQuoteTotals(snapshotEstimate)
    const snapshotBoundaryError = getFirstEstimatorValidationMessage(validateEstimatorQuoteBoundary({
        estimate: snapshotEstimate,
        totalProductionCostPerM: snapshotTotals.productionCostPerM,
        quotePricePerM: snapshotTotals.quotePricePerM,
        targetMeters: snapshotEstimate.orderQuantityM,
        requireTapeLength: false,
        requireCapacity,
        result: snapshotTotals.result,
        totals: snapshotTotals.totals,
    }))
    if (snapshotBoundaryError) return { error: snapshotBoundaryError }
    const costingInputFingerprint = buildCostingInputFingerprint(snapshotEstimate)
    const initialRequestId = getInitialQualitySnapshotRequestId(
        `${profile.org_id}:${normalizedName}:${costingInputFingerprint}`,
    )

    // Give the owner a useful decision before the database uniqueness rule is
    // reached. An archived name is deliberately reserved so a new costing
    // cannot silently recreate a quality the owner archived.
    const { data: sameNameTemplates, error: sameNameError } = await supabase
        .from('estimator_templates')
        .select('id, name, is_active')
        .eq('org_id', profile.org_id)
    if (sameNameError) return { error: sameNameError.message }
    const sameName = (sameNameTemplates ?? []).find(template => normalizeTemplateNameKey(template.name) === normalizeTemplateNameKey(data.name))
    if (sameName?.is_active) {
        const { data: replay } = await supabase
            .from('estimator_quotes')
            .select('id, template_id, updated_at, version_number')
            .eq('org_id', profile.org_id)
            .eq('client_request_id', initialRequestId)
            .maybeSingle()
        if (replay) {
            return {
                success: true,
                templateId: replay.template_id,
                updatedAt: replay.updated_at,
                quoteId: replay.id,
                versionNumber: replay.version_number,
                idempotentReplay: true,
            }
        }
        return { error: 'A saved quality with this name already exists. Choose Use as Starting Point and give the new quality a different name.' }
    }
    if (sameName && !sameName.is_active) return { error: 'This quality name is archived. Restore that quality or choose a different name for the new recipe.' }

    // Validate the exact costing snapshot before the first database write.
    // Base does not expose tape length because it is beam-capacity metadata,
    // not a commercial costing requirement.
    const { data: factoryProfile, error: factoryProfileError } = await supabase
        .from('factory_cost_profile')
        .select('updated_at')
        .eq('factory_id', profile.org_id)
        .maybeSingle()
    if (factoryProfileError) return { error: factoryProfileError.message }

    const workerRatePerM = calcWorkerRateSnapshot(snapshotEstimate.weftRows, snapshotEstimate.perPickCostPaisa ?? 0)
    const templatePayload = {
        name: normalizedName,
        warp_rows: data.warpRows,
        weft_rows: data.weftRows,
        per_pick_cost_paise: data.perPickCostPaisa,
        tape_length_m: data.tapeLengthM,
        warp_crimp_pct: data.warpCrimpPct ?? 0,
        yarn_shortage_pct: data.yarnShortagePct ?? 0,
        overhead_override_per_m: (data.overheadMode ?? data.estimate.overheadMode) === 'direct' ? data.overheadOverridePerM ?? null : null,
        loom_type: data.loomType ?? null,
        loom_rpm: data.loomRpm ?? null,
        loom_power_kw: data.loomPowerKw ?? null,
        sizing_mode: data.sizingMode ?? 'in_house',
        hours_per_shift: data.hoursPerShift ?? 12,
        yarn_denier: Math.round(firstWarp ? getEffectiveYarnDenier(firstWarp) : 75),
        calculated_yarn_denier: firstWarp ? getEffectiveYarnDenier(firstWarp) : 75,
        beam_ends: firstWarp?.beamEnds ?? 3200,
        ppi: Math.round(firstWeft?.picks ?? 68),
        reed_space: firstWeft ? getEffectiveCostingWidthCm(firstWeft) : 62,
        weft_denier: firstWeft ? getEffectiveYarnDenier(firstWeft) : 75,
        default_yarn_rate: firstWarp?.yarnRate ?? 107,
        gsm: 80,
        is_active: true,
    }
    const quotePayload = {
        org_id: profile.org_id,
        record_kind: 'costing',
        party_name: normalizeTemplateName(data.partyName || '') || null,
        quality_label: normalizedName,
        template_id: null,
        warp_instruction: null,
        weft_instruction: null,
        warp_rows: snapshotEstimate.warpRows,
        weft_rows: snapshotEstimate.weftRows,
        per_pick_cost_paise: snapshotEstimate.perPickCostPaisa,
        tape_length_m: snapshotEstimate.tapeLengthM,
        warp_crimp_pct: snapshotEstimate.warpCrimpPct ?? 0,
        yarn_shortage_pct: snapshotEstimate.yarnShortagePct ?? 0,
        warping_rate_per_kg: snapshotEstimate.warpingRatePerKg,
        sizing_rate_per_kg: snapshotEstimate.sizingRatePerKg,
        winding_rate_per_kg: snapshotEstimate.windingRatePerKg,
        processing_rate_per_m: snapshotEstimate.processingRatePerM,
        finishing_rate_per_m: snapshotEstimate.finishingRatePerM,
        overhead_items: snapshotEstimate.overheadItems,
        monthly_output_m: snapshotEstimate.monthlyOutputM,
        overhead_override_per_m: snapshotEstimate.overheadMode === 'direct' ? snapshotEstimate.overheadOverridePerM ?? null : null,
        overhead_pct: 0,
        commission_pct: snapshotEstimate.commissionPct,
        transport_per_m: snapshotEstimate.transportPerM,
        order_quantity_m: snapshotEstimate.orderQuantityM,
        profit_margin_pct: snapshotEstimate.profitPct,
        enabled_sections: snapshotEstimate.enabledSections,
        loom_type: snapshotEstimate.loomType ?? null,
        estimator_rpm: snapshotEstimate.loomRpm ?? null,
        estimator_power_kw: snapshotEstimate.loomPowerKw ?? null,
        hours_per_shift: snapshotEstimate.hoursPerShift,
        sizing_mode: snapshotEstimate.sizingMode,
        loom_count: snapshotEstimate.loomCount,
        monthly_working_days: snapshotEstimate.monthlyWorkingDays,
        avg_output_per_loom_per_day: snapshotEstimate.avgOutputPerLoomPerDay,
        calculation_version: snapshotTotals.result.calculationVersion,
        rounding_policy: snapshotTotals.result.roundingPolicy,
        production_cost_per_meter: snapshotTotals.result.productionCostPerM,
        overhead_per_meter: snapshotTotals.result.overheadPerM,
        commission_cost_per_meter: snapshotTotals.result.commissionPerM,
        break_even_price_per_meter: snapshotTotals.result.breakEvenPricePerM,
        expected_profit_per_meter: snapshotTotals.result.profitPerM,
        expected_profit_total: snapshotTotals.result.expectedProfitTotal,
        actual_margin_percent: snapshotTotals.result.actualMarginPct,
        costing_result_snapshot: snapshotTotals.result,
        reconciliation_status: 'verified',
        reconciliation_note: null,
        reconciled_at: new Date().toISOString(),
        landed_cost_per_meter: snapshotTotals.result.landedCostPerM,
        quote_price_per_meter: snapshotTotals.result.suggestedSellingPricePerM,
        intended_margin_percent: snapshotTotals.result.targetMarginPct,
        meters: snapshotEstimate.orderQuantityM ?? 0,
        status: 'draft',
        client_request_id: initialRequestId,
        worker_rate_per_m: workerRatePerM,
        costing_input_fingerprint: costingInputFingerprint,
        factory_profile_updated_at: factoryProfile?.updated_at ?? null,
        ppi: Math.round(snapshotEstimate.weftRows[0]?.picks ?? 68),
        yarn_denier: Math.round(snapshotEstimate.warpRows[0] ? getEffectiveYarnDenier(snapshotEstimate.warpRows[0]) : 75),
        yarn_rate_per_kg: snapshotEstimate.warpRows[0]?.yarnRate ?? 0,
    }

    const attestation = await attestCanonicalCostingPayload(user.id, profile.org_id, quotePayload)
    if (!attestation.payload) return { error: attestation.error ?? 'The costing payload could not be verified.' }

    const { data: atomicResult, error: atomicError } = await supabase.rpc(
        'create_saved_quality_with_initial_costing_v1',
        {
            p_template_payload: templatePayload,
            p_quote_payload: attestation.payload,
        },
    )
    if (atomicError) return { error: templateWriteError(atomicError) }
    if (!atomicResult || atomicResult.success !== true) {
        return { error: atomicResult?.error ?? 'The quality was not saved because its costing snapshot could not be created.' }
    }

    revalidatePath('/owner/estimator')
    revalidatePath('/owner/settings')
    revalidatePath('/owner/quotes')
    return {
        success: true,
        templateId: atomicResult.templateId,
        updatedAt: atomicResult.updatedAt,
        quoteId: atomicResult.quoteId,
        versionNumber: atomicResult.versionNumber,
        idempotentReplay: atomicResult.idempotentReplay,
    }
}

/**
 * Repair legacy qualities created before quality saves automatically included
 * their first costing snapshot. This is idempotent for qualities that already
 * have any linked costing history.
 */
export async function ensureCostingSnapshotsForSavedQualities() {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const [{ data: templates, error: templateError }, { data: linked, error: linkedError }, { data: costProfile, error: profileError }] = await Promise.all([
        supabase.from('estimator_templates').select('*').eq('org_id', profile.org_id).eq('is_active', true),
        supabase.from('estimator_quotes').select('template_id').eq('org_id', profile.org_id).not('template_id', 'is', null),
        supabase.from('factory_cost_profile').select('*').eq('factory_id', profile.org_id).maybeSingle(),
    ])
    if (templateError || linkedError || profileError) {
        return { error: templateError?.message ?? linkedError?.message ?? profileError?.message }
    }

    const linkedTemplateIds = new Set((linked ?? []).map(row => row.template_id).filter(Boolean))
    const missing = (templates ?? []).filter(template => !linkedTemplateIds.has(template.id))
    if (missing.length === 0) return { success: true, created: 0 }

    const { data: fixedWorkers } = await supabase
        .from('fixed_workers')
        .select('id, name, role, monthly_salary')
        .eq('org_id', profile.org_id)
        .eq('is_active', true)

    let created = 0
    for (const template of missing) {
        const estimate = buildSavedQualityRecipeState(template, costProfile ?? undefined, fixedWorkers ?? [])
        const totals = getAuthoritativeQuoteTotals(estimate)
        const result = await saveEstimatorQuoteV3({
            clientRequestId: getInitialQualitySnapshotRequestId(template.id),
            partyName: null,
            qualityLabel: template.name,
            estimate,
            totalProductionCostPerM: totals.productionCostPerM,
            quotePricePerM: totals.quotePricePerM,
            status: 'draft',
            recordKind: 'costing',
            templateId: template.id,
        })
        if (!result.success) return { error: result.error, created }
        created += 1
    }

    revalidatePath('/owner/quotes')
    return { success: true, created }
}

/**
 * Update an existing template's yarn rates (warp + weft rows).
 * Used when market rates change — owner wants to keep fabric structure
 * but refresh the rate snapshot stored in the template.
 */
export async function updateTemplateRates(data: {
    id:                string
    expectedUpdatedAt: string
    warpRows:          WarpRow[]
    weftRows:          WeftRow[]
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const timestampError = validateExpectedTimestamp(data.expectedUpdatedAt, 'This saved quality')
    if (timestampError) return { error: timestampError }
    const recipeError = validateTemplateRecipe({
        warpRows: data.warpRows,
        weftRows: data.weftRows,
    })
    if (recipeError) return { error: recipeError }

    const firstWarp = data.warpRows[0]

    const { data: current, error: currentError } = await supabase
        .from('estimator_templates')
        .select('id, updated_at, warp_rows, weft_rows')
        .eq('id', data.id)
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
        .maybeSingle()
    if (currentError) return { error: currentError.message }
    if (!current) return { error: 'This saved quality changed in another tab or was deleted. Refresh before saving again.' }
    if (current.updated_at !== data.expectedUpdatedAt) return { error: 'This saved quality changed in another tab or was deleted. Refresh before saving again.' }
    if (templateRecipeSignature({ warpRows: current.warp_rows, weftRows: current.weft_rows }) === templateRecipeSignature({ warpRows: data.warpRows, weftRows: data.weftRows })) {
        return { success: true, updatedAt: current.updated_at, noChange: true }
    }

    const { data: updated, error } = await supabase
        .from('estimator_templates')
        .update({
            warp_rows:         data.warpRows,
            weft_rows:         data.weftRows,
            // Sync legacy flat field too
            default_yarn_rate: firstWarp?.yarnRate ?? 107,
            updated_at:        new Date().toISOString(),
        })
        .eq('id', data.id)
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
        .eq('updated_at', data.expectedUpdatedAt)
        .select('id, updated_at')
        .maybeSingle()

    if (error) return { error: error.message }
    if (!updated) return { error: 'This saved quality changed in another tab or was deleted. Refresh before saving again.' }

    revalidatePath('/owner/estimator')
    revalidatePath('/owner/settings')
    return { success: true, updatedAt: updated.updated_at }
}

/**
 * Full update of a fabric template (recipe + charges + shortages).
 * Used when the user "saves" an active template after making modifications.
 */
export async function updateFabricTemplate(data: {
    id:               string
    expectedUpdatedAt: string
    name:             string
    warpRows:         WarpRow[]
    weftRows:         WeftRow[]
    tapeLengthM:      number
    warpCrimpPct?:    number
    perPickCostPaisa: number
    yarnShortagePct?: number
    overheadMode?: OverheadMode
    overheadOverridePerM?: number | null
    loomType?:        string | null
    loomRpm?:         number | null
    loomPowerKw?:     number | null
    warpingMode?:     'in_house' | 'outsourced'
    sizingMode?:      'in_house' | 'outsourced'
    hoursPerShift?:   number | null
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const firstWarp = data.warpRows[0]
    const firstWeft = data.weftRows[0]

    const timestampError = validateExpectedTimestamp(data.expectedUpdatedAt, 'This saved quality')
    if (timestampError) return { error: timestampError }
    const recipeError = validateTemplateRecipe(data)
    if (recipeError) return { error: recipeError }

    const { data: current, error: currentError } = await supabase
        .from('estimator_templates')
        .select('id, updated_at, warp_rows, weft_rows, tape_length_m, warp_crimp_pct, per_pick_cost_paise, yarn_shortage_pct, overhead_override_per_m, loom_type, loom_rpm, loom_power_kw, sizing_mode, hours_per_shift')
        .eq('id', data.id)
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
        .maybeSingle()
    if (currentError) return { error: currentError.message }
    if (!current) return { error: 'This saved quality changed in another tab or was deleted. Refresh before saving again.' }
    if (current.updated_at !== data.expectedUpdatedAt) return { error: 'This saved quality changed in another tab or was deleted. Refresh before saving again.' }
    if (templateRecipeSignature({
        warpRows: current.warp_rows,
        weftRows: current.weft_rows,
        tapeLengthM: current.tape_length_m,
        warpCrimpPct: current.warp_crimp_pct,
        perPickCostPaisa: current.per_pick_cost_paise,
        yarnShortagePct: current.yarn_shortage_pct,
        overheadOverridePerM: current.overhead_override_per_m,
        loomType: current.loom_type,
        loomRpm: current.loom_rpm,
        loomPowerKw: current.loom_power_kw,
        warpingMode: (current as { warping_mode?: string | null }).warping_mode ?? null,
        sizingMode: current.sizing_mode,
        hoursPerShift: current.hours_per_shift,
    }) === templateRecipeSignature({
        warpRows: data.warpRows,
        weftRows: data.weftRows,
        tapeLengthM: data.tapeLengthM,
        warpCrimpPct: data.warpCrimpPct,
        perPickCostPaisa: data.perPickCostPaisa,
        yarnShortagePct: data.yarnShortagePct,
        overheadOverridePerM: data.overheadMode === 'direct' ? data.overheadOverridePerM ?? null : null,
        loomType: data.loomType,
        loomRpm: data.loomRpm,
        loomPowerKw: data.loomPowerKw,
        warpingMode: data.warpingMode,
        sizingMode: data.sizingMode,
        hoursPerShift: data.hoursPerShift,
    })) {
        return { success: true, updatedAt: current.updated_at, noChange: true }
    }

    const { data: updated, error } = await supabase
        .from('estimator_templates')
        .update({
            // Saved Quality names are stable identities. Use the explicit
            // rename action only for a typo correction; a different fabric
            // construction must be saved as a new quality.
            warp_rows:           data.warpRows,
            weft_rows:           data.weftRows,
            per_pick_cost_paise: data.perPickCostPaisa,
            tape_length_m:       data.tapeLengthM,
            warp_crimp_pct:      data.warpCrimpPct ?? 0,
            yarn_shortage_pct:   data.yarnShortagePct ?? 0,
            overhead_override_per_m: data.overheadMode === 'direct' ? data.overheadOverridePerM ?? null : null,
            // Loom type + sizing mode (new)
            loom_type:           data.loomType ?? null,
            loom_rpm:            data.loomRpm ?? null,
            loom_power_kw:       data.loomPowerKw ?? null,
            sizing_mode:         data.sizingMode ?? 'in_house',
            hours_per_shift:     data.hoursPerShift ?? 12,
            // Legacy sync
            yarn_denier:         Math.round(firstWarp ? getEffectiveYarnDenier(firstWarp) : 75),
            calculated_yarn_denier: firstWarp ? getEffectiveYarnDenier(firstWarp) : 75,
            beam_ends:           firstWarp?.beamEnds ?? 3200,
            ppi:                 Math.round(firstWeft?.picks ?? 68),
            reed_space:          firstWeft ? getEffectiveCostingWidthCm(firstWeft) : 62,
            weft_denier:         firstWeft ? getEffectiveYarnDenier(firstWeft) : 75,
            default_yarn_rate:   firstWarp?.yarnRate ?? 107,
            updated_at:          new Date().toISOString(),
        })
        .eq('id', data.id)
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
        .eq('updated_at', data.expectedUpdatedAt)
        .select('id, updated_at')
        .maybeSingle()

    if (error) return { error: templateWriteError(error) }
    if (!updated) return { error: 'This saved quality changed in another tab or was deleted. Refresh before saving again.' }

    revalidatePath('/owner/estimator')
    revalidatePath('/owner/settings')
    return { success: true, updatedAt: updated.updated_at }
}


/** Rename a template (owner can fix typos without recreating). */
export async function renameTemplate(id: string, name: string, expectedUpdatedAt: string) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const timestampError = validateExpectedTimestamp(expectedUpdatedAt, 'This saved quality')
    if (timestampError) return { error: timestampError }
    const nameError = validateTemplateName(name)
    if (nameError) return { error: nameError }

    const normalizedName = normalizeTemplateName(name)
    const { data: current, error: currentError } = await supabase
        .from('estimator_templates')
        .select('id, name, updated_at, is_active')
        .eq('id', id)
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
        .maybeSingle()
    if (currentError) return { error: currentError.message }
    if (!current) return { error: 'This saved quality changed in another tab or was deleted. Refresh before renaming it.' }
    if (current.updated_at !== expectedUpdatedAt) return { error: 'This saved quality changed in another tab or was deleted. Refresh before renaming it.' }
    if (normalizeTemplateNameKey(current.name) === normalizeTemplateNameKey(normalizedName)) {
        return { success: true, updatedAt: current.updated_at, noChange: true }
    }
    if (!isLikelyQualityNameCorrection(current.name, normalizedName)) {
        return { error: 'Only a spelling or formatting correction is allowed here. For a different fabric construction, use Use as Starting Point and save a new quality.' }
    }

    const { data: sameNameTemplates, error: sameNameError } = await supabase
        .from('estimator_templates')
        .select('id, name, is_active')
        .eq('org_id', profile.org_id)
        .neq('id', id)
    if (sameNameError) return { error: sameNameError.message }
    const sameName = (sameNameTemplates ?? []).find(template => normalizeTemplateNameKey(template.name) === normalizeTemplateNameKey(name))
    if (sameName?.is_active) return { error: 'A saved quality with this name already exists. Choose a different name or use Use as Starting Point.' }
    if (sameName && !sameName.is_active) return { error: 'This quality name is archived. Restore that quality or choose a different name.' }

    const { data: updated, error } = await supabase
        .from('estimator_templates')
        .update({ name: normalizedName, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
        .eq('updated_at', expectedUpdatedAt)
        .select('id, updated_at')
        .maybeSingle()

    if (error) return { error: templateWriteError(error) }
    if (!updated) return { error: 'This saved quality changed in another tab or was deleted. Refresh before renaming it.' }

    revalidatePath('/owner/estimator')
    revalidatePath('/owner/settings')
    return { success: true, updatedAt: updated.updated_at }
}

export async function archiveTemplate(id: string, expectedUpdatedAt?: string) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    let resolvedUpdatedAt = expectedUpdatedAt
    if (!resolvedUpdatedAt) {
        const { data: current, error: currentError } = await supabase
            .from('estimator_templates')
            .select('updated_at')
            .eq('id', id)
            .eq('org_id', profile.org_id)
            .eq('is_active', true)
            .maybeSingle()
        if (currentError) return { error: currentError.message }
        resolvedUpdatedAt = current?.updated_at
    }

    const timestampError = validateExpectedTimestamp(resolvedUpdatedAt, 'This saved quality')
    if (timestampError) return { error: timestampError }

    const { data: deleted, error } = await supabase
        .from('estimator_templates')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
        .eq('updated_at', resolvedUpdatedAt!)
        .select('id, updated_at')
        .maybeSingle()

    if (error) return { error: error.message }
    if (!deleted) return { error: 'This saved quality changed in another tab or was already archived. Refresh before archiving it.' }

    revalidatePath('/owner/estimator')
    revalidatePath('/owner/settings')
    return { success: true, updatedAt: deleted.updated_at }
}

export async function restoreTemplate(id: string, expectedUpdatedAt?: string) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    let resolvedUpdatedAt = expectedUpdatedAt
    if (!resolvedUpdatedAt) {
        const { data: current, error: currentError } = await supabase
            .from('estimator_templates')
            .select('updated_at')
            .eq('id', id)
            .eq('org_id', profile.org_id)
            .eq('is_active', false)
            .maybeSingle()
        if (currentError) return { error: currentError.message }
        resolvedUpdatedAt = current?.updated_at
    }

    const timestampError = validateExpectedTimestamp(resolvedUpdatedAt, 'This saved quality')
    if (timestampError) return { error: timestampError }

    const { data: restored, error } = await supabase
        .from('estimator_templates')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('org_id', profile.org_id)
        .eq('is_active', false)
        .eq('updated_at', resolvedUpdatedAt!)
        .select('id, name, updated_at, is_active')
        .maybeSingle()

    if (error) return { error: templateWriteError(error) }
    if (!restored) return { error: 'This saved quality changed in another tab or was already restored. Refresh before restoring it.' }

    revalidatePath('/owner/estimator')
    revalidatePath('/owner/settings')
    revalidatePath('/owner/quotes')
    return { success: true, data: restored, updatedAt: restored.updated_at }
}

/** @deprecated Use archiveTemplate. Kept as a compatibility alias for older callers. */
export async function deleteTemplate(id: string, expectedUpdatedAt?: string) {
    return archiveTemplate(id, expectedUpdatedAt)
}

// ─── Save Quote (V3) ──────────────────────────────────────────────────────────

export async function getCostingSaveReceipt(clientRequestId: string) {
    const { profile } = await requireRole(['owner'])
    if (validateClientRequestId(clientRequestId)) return { status: 'unavailable' as const }
    const client = await createServerClient()
    const { data, error } = await findCostingSaveReceipt(client, profile.org_id, clientRequestId)
    if (error) return { status: 'unavailable' as const }
    if (!data) return { status: 'unconfirmed' as const }
    return { status: 'saved' as const, receipt: data }
}

export async function saveEstimatorQuoteV3(params: {
    clientRequestId:    string
    partyName?:         string | null
    qualityLabel:       string
    warpInstruction?:   string
    weftInstruction?:   string
    estimate:           EstimateState
    totalProductionCostPerM: number
    quotePricePerM:     number
    status?:            'draft' | 'sent' | 'accepted' | 'rejected'
    recordKind?:        'costing' | 'quotation'
    sourceQuoteId?:     string
    expectedSourceUpdatedAt?: string
    templateId?:         string
    expectedTemplateUpdatedAt?: string
    factoryProfileUpdatedAt?: string
    updateSavedQuality?: boolean
    quotationValidUntil?: string | null
    customerTerms?: string | null
}) {
    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    const admin = createAdminClient()
    const [tier, productionModeResult] = await Promise.all([
        getOrgTier(profile.org_id),
        getOrganizationProductionMode(supabase, profile.org_id),
    ])
    const canUseProduction = tierSatisfies(tier, 'premium')
    const newRecordKind = getNewEstimateRecordKind(canUseProduction, params.recordKind)
    const allowsPartyOrders = getEstimatorWorkflowConfig(productionModeResult.productionMode).allowsPartyOrders

    if (newRecordKind === 'quotation' && !allowsPartyOrders) {
        return { error: 'Party quotations are unavailable in Market Run only mode.' }
    }

    const requestIdError = validateClientRequestId(params.clientRequestId)
    if (requestIdError) return { error: requestIdError }

    // A response can be lost after PostgreSQL commits. Replaying the same
    // client request returns the original row instead of creating a duplicate.
    const { data: replay, error: replayError } = await supabase
        .from('estimator_quotes')
        .select('id, updated_at, created_at, version_number, quotation_reference')
        .eq('org_id', profile.org_id)
        .eq('client_request_id', params.clientRequestId)
        .maybeSingle()
    if (replayError) return { error: replayError.message }
    if (replay) {
        return { success: true, quoteId: replay.id, updatedAt: replay.updated_at, createdAt: replay.created_at, versionNumber: replay.version_number, quotationReference: replay.quotation_reference, idempotentReplay: true }
    }

    const { estimate } = params
    if (newRecordKind === 'quotation' && !params.partyName?.trim()) return { error: 'Customer or party is required for a quotation.' }
    if (!params.qualityLabel.trim()) return { error: 'Quality label is required.' }
    if (newRecordKind === 'quotation' && params.quotationValidUntil !== undefined && params.quotationValidUntil !== null && params.quotationValidUntil !== '' && !normalizeQuotationDate(params.quotationValidUntil)) {
        return { error: 'Quotation validity date is invalid.' }
    }
    if (newRecordKind === 'quotation' && params.customerTerms && params.customerTerms.trim().length > 2000) {
        return { error: 'Customer terms must be 2,000 characters or fewer.' }
    }
    if (params.templateId && !UUID_PATTERN.test(params.templateId)) return { error: 'Saved quality identifier is invalid.' }
    if (params.templateId) {
        const { data: template, error: templateError } = await supabase
            .from('estimator_templates')
            .select('id')
            .eq('id', params.templateId)
            .eq('org_id', profile.org_id)
            .eq('is_active', true)
            .maybeSingle()
        if (templateError) return { error: templateError.message }
        if (!template) return { error: 'The selected saved quality is no longer available.' }
    }
    // A legacy costing can be missing template_id while still carrying a
    // source quote identity. It is an edit of an existing immutable lineage,
    // not a request to create another Saved Quality with the same name. Let
    // the revision RPC resolve the source template and perform the atomic
    // version save instead of surfacing a misleading duplicate-quality error.
    if (!params.templateId && !params.sourceQuoteId && newRecordKind === 'costing') {
        const [{ data: archivedTemplates, error: archivedTemplateError }, { data: activeTemplates, error: activeTemplateError }] = await Promise.all([
            supabase
            .from('estimator_templates')
            .select('name')
            .eq('org_id', profile.org_id)
            .eq('is_active', false),
            supabase
                .from('estimator_templates')
                .select('name')
                .eq('org_id', profile.org_id)
                .eq('is_active', true),
        ])
        if (archivedTemplateError || activeTemplateError) return { error: archivedTemplateError?.message ?? activeTemplateError?.message }
        const archivedName = (archivedTemplates ?? []).some(template => normalizeTemplateNameKey(template.name) === normalizeTemplateNameKey(params.qualityLabel))
        if (archivedName) return { error: 'This quality name is archived. Restore the saved quality or choose a different name before saving a new Cost Estimate.' }
        const existingName = (activeTemplates ?? []).some(template => normalizeTemplateNameKey(template.name) === normalizeTemplateNameKey(params.qualityLabel))
        if (existingName) return { error: 'This Saved Quality already exists. Select it from My Qualities to update it, or use Use as Starting Point and save a new quality.' }
    }
    const requireCapacity = requiresFactoryCapacity(estimate, newRecordKind === 'quotation')
    const snapshotError = getFirstEstimatorValidationMessage(validateEstimatorSnapshot(estimate, {
        requireTapeLength: canUseProduction,
        requireCapacity,
    }))
    if (snapshotError) return { error: snapshotError }
    const authoritative = getAuthoritativeQuoteTotals(estimate)
    const validationError = getFirstEstimatorValidationMessage(validateEstimatorQuoteBoundary({
        estimate,
        totalProductionCostPerM: authoritative.productionCostPerM,
        quotePricePerM: authoritative.quotePricePerM,
        targetMeters: estimate.orderQuantityM,
        requireTapeLength: canUseProduction,
        requireCapacity,
        result: authoritative.result,
        totals: authoritative.totals,
    }))
    if (validationError) return { error: validationError }
    if (!totalsMatchAuthoritative(params.totalProductionCostPerM, params.quotePricePerM, authoritative)) {
        return { error: 'The estimate changed before it was saved. Review the recalculated totals and save again.' }
    }

    // Compute loom-worker wage rate: Σ(picks across all weft rows) × perPickCostPaisa
    // e.g. 58 picks × 0.16 = ₹9.28/m — this is what the weaver earns per metre
    const workerRatePerM = calcWorkerRateSnapshot(estimate.weftRows, estimate.perPickCostPaisa ?? 0)

    const quotationDocumentPayload = newRecordKind === 'quotation'
        ? {
            ...(params.quotationValidUntil !== undefined
                ? { quotation_valid_until: normalizeQuotationDate(params.quotationValidUntil) }
                : {}),
            ...(params.customerTerms !== undefined
                ? { customer_terms: normalizeCustomerTerms(params.customerTerms) }
                : {}),
        }
        : {}

    let factoryProfileUpdatedAt = params.factoryProfileUpdatedAt ?? null
    if (newRecordKind === 'costing' && !factoryProfileUpdatedAt) {
        const { data: factoryProfile, error: factoryProfileError } = await supabase
            .from('factory_cost_profile')
            .select('updated_at')
            .eq('factory_id', profile.org_id)
            .maybeSingle()
        if (factoryProfileError) return { error: factoryProfileError.message }
        factoryProfileUpdatedAt = factoryProfile?.updated_at ?? null
    }

    const costingInputFingerprint = newRecordKind === 'costing'
        ? buildCostingInputFingerprint(estimate, {
            warpInstruction: params.warpInstruction,
            weftInstruction: params.weftInstruction,
        })
        : null

    const quotePayload = {
            org_id:               profile.org_id,
            record_kind:          newRecordKind,
            party_name:           params.partyName?.trim() || null,
            quality_label:        params.qualityLabel.trim(),
            template_id:          params.templateId ?? null,
            warp_instruction:     params.warpInstruction?.trim() || null,
            weft_instruction:     params.weftInstruction?.trim() || null,
            // V3 full recipe snapshots
            warp_rows:            estimate.warpRows,
            weft_rows:            estimate.weftRows,
            per_pick_cost_paise:  estimate.perPickCostPaisa,
            tape_length_m:        estimate.tapeLengthM,
            warp_crimp_pct:       estimate.warpCrimpPct ?? 0,
            yarn_shortage_pct:    estimate.yarnShortagePct ?? 0,
            warping_rate_per_kg:  estimate.warpingRatePerKg,
            sizing_rate_per_kg:   estimate.sizingRatePerKg,
            winding_rate_per_kg:  estimate.windingRatePerKg,
            processing_rate_per_m: estimate.processingRatePerM,
            finishing_rate_per_m: estimate.finishingRatePerM,
            // Overhead V2: store the selected method inputs; no percentage metric is persisted.
            overhead_items:       estimate.overheadItems,
            monthly_output_m:     estimate.monthlyOutputM,
            overhead_override_per_m: estimate.overheadMode === 'direct' ? estimate.overheadOverridePerM ?? null : null,
            overhead_pct:         0,
            // Persist commercial scalar fields from the same rounded result
            // that drives the saved costing snapshot. The recipe remains the
            // source of inputs; the canonical result is the source of truth
            // for every price-changing value written beside it.
            commission_pct:       authoritative.result.commissionPct,
            transport_per_m:      authoritative.result.transportPerM,
            order_quantity_m:     authoritative.result.quantityM,
            profit_margin_pct:    authoritative.result.targetMarginPct,
            enabled_sections:     estimate.enabledSections,
            // Loom type + sizing mode audit trail (Gap 2 fix)
            loom_type:            estimate.loomType ?? null,
            estimator_rpm:        estimate.loomRpm ?? null,
            estimator_power_kw:   estimate.loomPowerKw ?? null,
            hours_per_shift:      estimate.hoursPerShift,
            sizing_mode:          estimate.sizingMode,
            loom_count:           estimate.loomCount,
            monthly_working_days: estimate.monthlyWorkingDays,
            avg_output_per_loom_per_day: estimate.avgOutputPerLoomPerDay,
            // Result snapshots
            calculation_version:      authoritative.result.calculationVersion,
            rounding_policy:          authoritative.result.roundingPolicy,
            production_cost_per_meter: authoritative.result.productionCostPerM,
            overhead_per_meter:       authoritative.result.overheadPerM,
            commission_cost_per_meter: authoritative.result.commissionPerM,
            break_even_price_per_meter: authoritative.result.breakEvenPricePerM,
            expected_profit_per_meter: authoritative.result.profitPerM,
            expected_profit_total:     authoritative.result.expectedProfitTotal,
            actual_margin_percent:     authoritative.result.actualMarginPct,
            costing_result_snapshot:   authoritative.result,
            reconciliation_status:     'verified',
            reconciliation_note:       null,
            reconciled_at:             new Date().toISOString(),
            landed_cost_per_meter:    authoritative.result.landedCostPerM,
            quote_price_per_meter:    authoritative.result.suggestedSellingPricePerM,
            intended_margin_percent:  authoritative.result.targetMarginPct,
            meters:                   authoritative.result.quantityM ?? 0,
            status:                   params.status ?? 'draft',
            client_request_id:        params.clientRequestId,
            costing_input_fingerprint: costingInputFingerprint,
            factory_profile_updated_at: factoryProfileUpdatedAt,
            ...quotationDocumentPayload,
            // Weaver wage rate snapshot — flows downstream to shift_assignments
            worker_rate_per_m:    workerRatePerM,
            // Legacy required fields with sane defaults
            ppi:     Math.round(estimate.weftRows[0]?.picks ?? 68),
            yarn_denier: Math.round(estimate.warpRows[0] ? getEffectiveYarnDenier(estimate.warpRows[0]) : 75),
            yarn_rate_per_kg: estimate.warpRows[0]?.yarnRate ?? 0,
    }

    const costingAttestation = newRecordKind === 'costing'
        ? await attestCanonicalCostingPayload(user.id, profile.org_id, quotePayload)
        : null
    if (costingAttestation && !costingAttestation.payload) {
        return { error: costingAttestation.error ?? 'The costing payload could not be verified.' }
    }
    const trustedQuotePayload = costingAttestation?.payload ?? quotePayload

    if (params.updateSavedQuality) {
        if (newRecordKind !== 'costing') {
            return { error: 'Only a Cost Estimate can update a Saved Quality.' }
        }
        if (!params.templateId) {
            return { error: 'Select a Saved Quality before updating its recipe.' }
        }
        const timestampError = validateExpectedTimestamp(params.expectedTemplateUpdatedAt, 'The Saved Quality')
        if (timestampError) return { error: timestampError }

        // The RPC updates both rows in one transaction. A costing version is
        // never used as a substitute for the reusable quality record.
        const { data: combined, error: combinedError } = await supabase.rpc(
            'save_estimator_costing_revision_v2',
            {
                p_quote_payload: trustedQuotePayload,
                p_source_quote_id: params.sourceQuoteId ?? null,
                p_expected_source_updated_at: params.expectedSourceUpdatedAt ?? null,
                p_template_id: params.templateId,
                p_expected_template_updated_at: params.expectedTemplateUpdatedAt,
                p_update_saved_quality: true,
                p_template_payload: buildSavedQualityUpdatePayload(estimate),
            },
        )

        if (combinedError) return { error: combinedError.message }
        if (!combined || combined.success !== true) {
            return { error: combined?.error ?? 'The costing and Saved Quality were not saved.' }
        }
        return {
            success: true,
            quoteId: combined.quoteId,
            updatedAt: combined.updatedAt,
            createdAt: combined.createdAt,
            versionNumber: combined.versionNumber,
            qualityUpdated: true,
            outcome: combined.outcome,
            noChange: combined.noChange,
            idempotentReplay: combined.idempotentReplay,
        }
    }

    // Base Cost Estimates always use the transactional revision boundary. It
    // is what makes “Save New Costing Version” predictable when two tabs or a
    // double-click reach the server together. Quotation save semantics below
    // remain separate for Full Suite.
    if (newRecordKind === 'costing') {
        const { data: costingResult, error: costingError } = await supabase.rpc(
            'save_estimator_costing_revision_v2',
            {
                p_quote_payload: trustedQuotePayload,
                p_source_quote_id: params.sourceQuoteId ?? null,
                p_expected_source_updated_at: params.expectedSourceUpdatedAt ?? null,
                p_template_id: params.templateId ?? null,
                p_expected_template_updated_at: params.expectedTemplateUpdatedAt ?? null,
                p_update_saved_quality: false,
                p_template_payload: {},
            },
        )

        if (costingError) return { error: costingError.message }
        if (!costingResult || costingResult.success !== true) {
            return { error: costingResult?.error ?? 'The Cost Estimate could not be saved.' }
        }
        return {
            success: true,
            quoteId: costingResult.quoteId,
            updatedAt: costingResult.updatedAt,
            createdAt: costingResult.createdAt,
            versionNumber: costingResult.versionNumber,
            qualityUpdated: costingResult.qualityUpdated,
            outcome: costingResult.outcome,
            noChange: costingResult.noChange,
            idempotentReplay: costingResult.idempotentReplay,
        }
    }

    if (params.sourceQuoteId) {
        const timestampError = validateExpectedTimestamp(params.expectedSourceUpdatedAt, 'The quote being edited')
        if (timestampError) return { error: timestampError }

        const { data: source, error: sourceError } = await supabase
            .from('estimator_quotes')
            .select('id, status, order_id, updated_at, costing_group_id, version_number, record_kind')
            .eq('id', params.sourceQuoteId)
            .eq('org_id', profile.org_id)
            .maybeSingle()

        if (sourceError) return { error: sourceError.message }
        if (!source) return { error: 'The quote being edited no longer exists.' }
        if (Date.parse(source.updated_at) !== Date.parse(params.expectedSourceUpdatedAt!)) {
            return { error: 'This Quotation changed in another tab. Reload it from Quotations before saving again.' }
        }

        const sourceRecordKind = normalizeCostingRecordKind(source.record_kind)
        if (sourceRecordKind === 'quotation' && !allowsPartyOrders) {
            return { error: 'Party quotations are unavailable in Market Run only mode.' }
        }
        const editableQuotationPayload = sourceRecordKind === 'quotation'
            && ['draft', 'sent', 'rejected'].includes(source.status)
            ? { ...quotePayload, status: source.status }
            : quotePayload
        if (shouldCreateImmutableRevision(sourceRecordKind, source.status, Boolean(source.order_id))) {
            if (sourceRecordKind === 'costing') {
                const { data: latestCosting, error: latestCostingError } = await supabase
                    .from('estimator_quotes')
                    .select('id')
                    .eq('org_id', profile.org_id)
                    .eq('record_kind', 'costing')
                    .eq('costing_group_id', source.costing_group_id ?? source.id)
                    .order('version_number', { ascending: false })
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (latestCostingError) return { error: latestCostingError.message }
                if (latestCosting && latestCosting.id !== source.id) {
                    return { error: 'A newer costing version already exists. Reload it before saving again.' }
                }
            }

            const versionId = crypto.randomUUID()
            const { data: version, error: versionError } = await admin
                .from('estimator_quotes')
                .insert({
                    ...quotePayload,
                    id: versionId,
                    ...(sourceRecordKind === 'quotation'
                        ? { quotation_reference: buildQuotationReference(versionId) }
                        : {}),
                    record_kind: sourceRecordKind,
                    source_quote_id: source.id,
                    costing_group_id: source.costing_group_id ?? source.id,
                    version_number: Number(source.version_number ?? 1) + 1,
                })
                .select('id, updated_at, version_number, quotation_reference')
                .single()
            if (versionError) return { error: versionError.message }
            return { success: true, quoteId: version.id, updatedAt: version.updated_at, versionNumber: version.version_number, quotationReference: version.quotation_reference }
        }

        // Draft/sent/rejected quotes remain the same business record. Accepted
        // or converted quotes are immutable audit history, so re-estimation
        // creates a linked new version instead.
        if (canUseProduction && sourceRecordKind === 'quotation' && !source.order_id && ['draft', 'sent', 'rejected'].includes(source.status)) {
            const { data: updated, error: updateError } = await supabase
                .from('estimator_quotes')
                .update(editableQuotationPayload)
                .eq('id', source.id)
                .eq('org_id', profile.org_id)
                .is('order_id', null)
                .in('status', ['draft', 'sent', 'rejected'])
                .eq('updated_at', params.expectedSourceUpdatedAt!)
                .select('id, updated_at, quotation_reference')
                .maybeSingle()

            if (updateError) return { error: updateError.message }
            if (!updated) return { error: 'This Quotation changed in another tab. Refresh Quotations before saving again.' }
            return { success: true, quoteId: updated.id, updatedAt: updated.updated_at, quotationReference: updated.quotation_reference, updated: true }
        }
    }

    const savedId = crypto.randomUUID()
    const { data: saved, error } = await admin
        .from('estimator_quotes')
        .insert({
            ...quotePayload,
            id: savedId,
            ...(newRecordKind === 'quotation'
                ? { quotation_reference: buildQuotationReference(savedId) }
                : {}),
            source_quote_id: params.sourceQuoteId ?? null,
        })
        .select('id, updated_at, version_number, quotation_reference')
        .single()

    if (error) {
        if (error.code === '23505') {
            const { data: existing } = await supabase
                .from('estimator_quotes')
                .select('id, updated_at, quotation_reference')
                .eq('org_id', profile.org_id)
                .eq('client_request_id', params.clientRequestId)
                .maybeSingle()
            if (existing) {
                return { success: true, quoteId: existing.id, updatedAt: existing.updated_at, quotationReference: existing.quotation_reference, idempotentReplay: true }
            }
        }
        return { error: error.message }
    }
    return { success: true, quoteId: saved.id, updatedAt: saved.updated_at, versionNumber: saved.version_number, quotationReference: saved.quotation_reference }
}

// ─── Convert Quote to Order ───────────────────────────────────────────────────

export async function convertQuoteToOrder(data: {
    party_name:          string
    quality_label:       string
    warp_instruction?:   string
    weft_instruction?:   string
    notes?:              string
    total_target_meters: number
    deadline:            string
    estimate?:           EstimateState
    quote_price_per_m?:  number
    totalProductionCostPerM?: number
}) {
    void data
    return {
        error: 'Direct Party Order creation from the estimator has been retired. Save the Quotation, accept it, then convert it from Quotations.',
    }
}

export async function convertAcceptedQuoteToOrder(data: {
    quoteId: string
    total_target_meters: number
    deadline: string
    notes?: string
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const tierError = await requirePremiumTier(profile.org_id)
    if (tierError) return { error: tierError }

    const targetMeters = Number(data.total_target_meters)
    if (!Number.isFinite(targetMeters) || targetMeters <= 0) {
        return { error: 'Order quantity must be greater than 0.' }
    }

    const result = await executeQuoteConversion({
        supabase,
        orgId:         profile.org_id,
        quoteId:       data.quoteId,
        targetMeters,
        deadline:      data.deadline,
        notes:         data.notes,
        trackingToken: generateTrackingToken(),
    })

    if ('error' in result) return result

    revalidatePath('/owner/orders')
    revalidatePath('/owner/analytics')
    revalidatePath('/owner/quotes')
    revalidatePath('/owner/machines')
    revalidatePath('/supervisor/machines')
    return { success: true, orderId: result.orderId }
}

// ─── Start Party Order ────────────────────────────────────────────────────────

export type StartPartyOrderInput = {
    /** Snapshot of the estimator state captured when the dialog opened */
    estimatorState:       EstimateState
    partyName:            string
    qualityLabel:         string
    warpInstruction?:     string | null
    weftInstruction?:     string | null
    targetMeters:         number
    deadline:             string | null
    quotePricePerM:       number
    costPerM:             number
    instructions?:        string | null
    orderNotes?:          string | null
}

/**
 * Creates an accepted estimator quote and immediately converts it to a
 * production order — the "Start Party Order" fast path from the Estimator.
 *
 * Backend flow (Batch 23 — QUOTE-007 atomic transaction boundary):
 *   1. Validate inputs (role-scoped, server-side)
 *   2. Pre-compute yarn requirements from estimator state
 *   3. Call the atomic start_party_order_from_estimator RPC which creates
 *      the accepted quote, active order, quote/order backlinks, and
 *      order_yarn_requirements in a single database transaction.
 *
 * If the RPC fails, no orphaned accepted quote is left behind — all writes
 * are rolled back by PostgreSQL.
 */
export async function startPartyOrderFromEstimator(input: StartPartyOrderInput) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const tierError = await requirePremiumTier(profile.org_id)
    if (tierError) return { error: tierError }

    // ── Input validation ─────────────────────────────────────────────────────
    if (!input.partyName?.trim())         return { error: 'Add a party name before starting an order.' }
    if (!input.qualityLabel?.trim())      return { error: 'Add a quality label before starting an order.' }

    const targetMeters = Number(input.targetMeters)
    if (!Number.isFinite(targetMeters) || targetMeters <= 0)
        return { error: 'Target meters must be greater than zero.' }

    const clientCostPerM = Number(input.costPerM)
    if (!Number.isFinite(clientCostPerM) || clientCostPerM < 0)
        return { error: 'Complete the estimate before starting an order.' }

    const clientQuotePricePerM = Number(input.quotePricePerM)
    if (!Number.isFinite(clientQuotePricePerM) || clientQuotePricePerM <= 0)
        return { error: 'Quote price is missing. Complete the estimate first.' }

    // Deadline is optional — accept null/empty
    const deadline = input.deadline?.trim() || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

    const estimateForOrder = { ...input.estimatorState, orderQuantityM: targetMeters }
    const snapshotError = getFirstEstimatorValidationMessage(validateEstimatorSnapshot(estimateForOrder, { requireCapacity: true }))
    if (snapshotError) return { error: snapshotError }
    const totals = calcFullTotals(estimateForOrder)
    const authoritative = getAuthoritativeQuoteTotals(estimateForOrder, totals)
    const { estimatorState } = input
    const validationError = getFirstEstimatorValidationMessage(validateEstimatorQuoteBoundary({
        estimate: estimateForOrder,
        totalProductionCostPerM: authoritative.productionCostPerM,
        quotePricePerM: authoritative.quotePricePerM,
        targetMeters,
        requireCapacity: true,
        result: authoritative.result,
        totals: authoritative.totals,
    }))
    if (validationError) return { error: validationError }
    if (!totalsMatchAuthoritative(input.costPerM, input.quotePricePerM, authoritative)) {
        return { error: 'The estimate changed before the order was created. Review the recalculated totals and try again.' }
    }

    // Worker pay is an authoritative snapshot derived from the validated
    // recipe. Never accept a client-provided rate for downstream payroll.
    const workerRatePerM = calcWorkerRateSnapshot(
        estimatorState.weftRows,
        estimatorState.perPickCostPaisa ?? 0
    )

    // ── Pre-compute yarn requirements (same logic as executeQuoteConversion) ──
    const warpRequiredKg  = (totals.totalWarpKgPer100m / 100) * targetMeters
    const weftRequiredKg  = ((totals.totalAllYarnKgPer100m - totals.totalWarpKgPer100m) / 100) * targetMeters
    const totalRequiredKg = warpRequiredKg + weftRequiredKg
    const estimatedBeams  = totals.estimatedBeamCapacityM > 0
        ? Math.max(1, Math.ceil(targetMeters / totals.estimatedBeamCapacityM))
        : null

    const productionSetupRequirement = await getProductionSetupRequirement(supabase, profile.org_id)
    if (productionSetupRequirement) return productionSetupRequirement

    // ── Atomic RPC: quote + order + backlinks + yarn requirements ─────────────
    const { data: rpcRows, error: rpcError } = await supabase.rpc(
        'start_party_order_from_estimator_v2',
        {
            // Quote fields
            p_party_name:            input.partyName.trim(),
            p_quality_label:         input.qualityLabel.trim(),
            p_warp_instruction:      input.warpInstruction?.trim() ?? null,
            p_weft_instruction:      input.weftInstruction?.trim() ?? null,
            p_warp_rows:             estimatorState.warpRows,
            p_weft_rows:             estimatorState.weftRows,
            p_per_pick_cost_paise:   estimatorState.perPickCostPaisa,
            p_tape_length_m:         estimatorState.tapeLengthM,
            p_warp_crimp_pct:        estimatorState.warpCrimpPct ?? 0,
            p_warping_rate_per_kg:   estimatorState.warpingRatePerKg,
            p_sizing_rate_per_kg:    estimatorState.sizingRatePerKg,
            p_winding_rate_per_kg:   estimatorState.windingRatePerKg,
            p_processing_rate_per_m: estimatorState.processingRatePerM,
            p_finishing_rate_per_m:  estimatorState.finishingRatePerM,
            p_overhead_items:        estimatorState.overheadItems,
            p_monthly_output_m:      estimatorState.monthlyOutputM,
            p_overhead_override_per_m: estimatorState.overheadMode === 'direct' ? estimatorState.overheadOverridePerM ?? null : null,
            p_overhead_pct:          0,
            p_commission_pct:        authoritative.result.commissionPct,
            p_transport_per_m:       authoritative.result.transportPerM,
            p_order_quantity_m:      authoritative.result.quantityM ?? targetMeters,
            p_profit_margin_pct:     authoritative.result.targetMarginPct,
            p_enabled_sections:      estimatorState.enabledSections,
            p_loom_type:             estimatorState.loomType ?? null,
            p_estimator_rpm:         estimatorState.loomRpm ?? null,
            p_estimator_power_kw:    estimatorState.loomPowerKw ?? null,
            p_hours_per_shift:       estimatorState.hoursPerShift,
            p_sizing_mode:           estimatorState.sizingMode,
            p_landed_cost_per_meter: authoritative.landedCostPerM,
            p_quote_price_per_meter: authoritative.quotePricePerM,
            p_intended_margin_pct:   authoritative.result.targetMarginPct,
            p_worker_rate_per_m:     workerRatePerM,
            p_ppi:                   Math.round(estimatorState.weftRows[0]?.picks ?? 68),
            p_yarn_denier:           Math.round(estimatorState.warpRows[0] ? getEffectiveYarnDenier(estimatorState.warpRows[0]) : 75),
            p_yarn_rate_per_kg:      estimatorState.warpRows[0]?.yarnRate ?? 0,
            // Order fields
            p_target_meters:         targetMeters,
            p_deadline:              deadline,
            p_notes:                 input.orderNotes?.trim() ?? input.instructions?.trim() ?? '',
            p_tracking_token:        generateTrackingToken(),
            // Pre-computed yarn requirements
            p_warp_required_kg:      Number(warpRequiredKg.toFixed(3)),
            p_weft_required_kg:      Number(weftRequiredKg.toFixed(3)),
            p_total_required_kg:     Number(totalRequiredKg.toFixed(3)),
            p_estimated_beams:       estimatedBeams,
            p_requirement_snapshot:  {
                order_quantity_m:          targetMeters,
                estimated_beam_capacity_m: totals.estimatedBeamCapacityM,
                warp_rows:                 estimateForOrder.warpRows,
                weft_rows:                 estimateForOrder.weftRows,
                warp_crimp_pct:            estimateForOrder.warpCrimpPct ?? 0,
                yarn_shortage_pct:         estimateForOrder.yarnShortagePct ?? 0,
            },
            p_costing_result_snapshot: authoritative.result,
        }
    )

    if (rpcError) {
        return { error: rpcError.message || 'Failed to create order. Please try again.' }
    }

    const rpcResult = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows
    if (!rpcResult?.success || !rpcResult.order_id) {
        return { error: rpcResult?.error ?? 'Failed to create order.' }
    }

    revalidatePath('/owner/orders')
    revalidatePath('/owner/analytics')
    revalidatePath('/owner/quotes')
    revalidatePath('/owner/machines')
    revalidatePath('/supervisor/machines')

    return {
        success: true,
        quoteId: rpcResult.quote_id as string,
        orderId: rpcResult.order_id as string,
    }
}

// ─── Party Rate Memory ────────────────────────────────────────────────────────

/**
 * Return recent distinct party names for the inline Base/Full Suite chooser.
 * The names come only from tenant-scoped estimator history; creating a new name
 * remains a simple free-text action.
 */
export async function getEstimatorPartyNames(): Promise<{ data?: string[]; error?: string }> {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('estimator_quotes')
        .select('party_name')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
        .limit(100)

    if (error) return { error: error.message }
    const seen = new Set<string>()
    const names = (data ?? [])
        .map(row => row.party_name?.trim())
        .filter((name): name is string => Boolean(name))
        .filter(name => {
            const key = name.toLocaleLowerCase('en-IN')
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
        .slice(0, 25)
    return { data: names }
}

/**
 * Returns the most recent quote for a given party name.
 * Used to surface "You last quoted X ₹Y/m for Quality Z on Date" in the estimator.
 * Only fires when partyName is 3+ chars (enforced by the caller).
 */
export async function getLastQuoteForParty(partyName: string): Promise<{
    data?: {
        quality_label:        string
        quote_price_per_meter: number
        landed_cost_per_meter: number
        created_at:            string
        order_id:              string | null
    }
    error?: string
}> {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('estimator_quotes')
        .select('quality_label, quote_price_per_meter, landed_cost_per_meter, created_at, order_id')
        .eq('org_id', profile.org_id)
        .ilike('party_name', partyName.trim())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error) return { error: error.message }
    if (!data) return {}
    return { data }
}

// ─── Monthly Output Suggestion ────────────────────────────────────────────────

/**
 * Suggests a monthly output value by summing production_logs metres
 * over the last 30 days, divided by the number of active production days.
 */
export async function getMonthlyOutputSuggestion(): Promise<{
    data?: {
        avg30Days: number
        avg90Days: number
        lastUpdated: string
    }
    error?: string
}> {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const tierError = await requirePremiumTier(profile.org_id)
    if (tierError) return { error: tierError }

    const now = new Date()
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const since90 = ninetyDaysAgo.toISOString().split('T')[0]

    const { data, error } = await supabase
        .from('production_logs')
        .select('meters, date')
        .eq('org_id', profile.org_id)
        .gte('date', since90)

    if (error) return { error: error.message }
    if (!data || data.length === 0) {
        return { data: { avg30Days: 0, avg90Days: 0, lastUpdated: now.toISOString() } }
    }

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const since30 = thirtyDaysAgo.toISOString().split('T')[0]

    const logs30 = data.filter(r => r.date >= since30)
    const total30 = logs30.reduce((s, r) => s + Number(r.meters ?? 0), 0)
    const days30  = new Set(logs30.map(r => r.date)).size
    const avg30Days = days30 > 0 ? Math.round((total30 / days30) * 26) : 0

    const total90 = data.reduce((s, r) => s + Number(r.meters ?? 0), 0)
    const days90  = new Set(data.map(r => r.date)).size
    const avg90Days = days90 > 0 ? Math.round((total90 / days90) * 26) : 0

    return { 
        data: { 
            avg30Days, 
            avg90Days, 
            lastUpdated: now.toISOString() 
        } 
    }
}

// ─── Quote History ────────────────────────────────────────────────────────────

export async function getEstimatorQuotes(filters?: { status?: string }) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    let query = supabase
        .from('estimator_quotes')
        // Summary-first library read. Full recipes, result snapshots, and
        // linked production records load only on open/compare/export intent.
        .select('id, status, party_name, quality_label, quote_price_per_meter, landed_cost_per_meter, intended_margin_percent, created_at, updated_at, sent_at, quotation_reference, quotation_valid_until, customer_terms, meters, source_quote_id, costing_group_id, version_number, is_archived, is_favorite, record_kind, template_id, market_run_id, production_cost_per_meter, overhead_per_meter, commission_cost_per_meter, break_even_price_per_meter, expected_profit_per_meter, expected_profit_total, actual_margin_percent, calculation_version, rounding_policy, factory_profile_updated_at, reconciliation_status, reconciliation_note')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })

    if (filters?.status) {
        query = query.eq('status', filters.status)
    }

    const { data, error } = await query
    if (error) return { error: error.message }
    return { data }
}

/** Full immutable costing/detail read used only by explicit user intent. */
export async function getEstimatorQuoteDetail(id: string) {
    if (!UUID_PATTERN.test(id)) return { error: 'Costing identifier is invalid.' }
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    const { data, error } = await supabase
        .from('estimator_quotes')
        .select(`
            *,
            orders!estimator_quotes_order_id_fkey (
                id,
                status,
                party_name,
                quality_label,
                total_target_meters,
                market_run_id,
                production_logs ( meters ),
                warp_instruction,
                weft_instruction
            )
        `)
        .eq('id', id)
        .eq('org_id', profile.org_id)
        .maybeSingle()
    if (error) return { error: error.message }
    if (!data) return { error: 'This saved costing no longer exists.' }
    return { data }
}

/**
 * Re-checks the saved record against its stored canonical snapshot. This is
 * metadata-only: it never recalculates with today's rate book or rewrites any
 * historical financial value.
 */
export async function auditHistoricalCostingSnapshot(costingId: string, expectedUpdatedAt: string) {
    if (!UUID_PATTERN.test(costingId)) return { error: 'Costing identifier is invalid.' }
    const timestampError = validateExpectedTimestamp(expectedUpdatedAt, 'This costing')
    if (timestampError) return { error: timestampError }

    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    try {
        await supabase.rpc('set_actor_for_audit', { p_actor_id: user.id })
    } catch {
        // Audit triggers fall back to auth.uid().
    }
    const { data: costing, error: costingError } = await supabase
        .from('estimator_quotes')
        .select('*')
        .eq('id', costingId)
        .eq('org_id', profile.org_id)
        .maybeSingle()
    if (costingError) return { error: costingError.message }
    if (!costing) return { error: 'This costing no longer exists.' }

    const audit = auditHistoricalCosting(costing)
    const { data, error } = await supabase
        .from('estimator_quotes')
        .update({
            reconciliation_status: audit.status,
            reconciliation_note: audit.reasons.length > 0 ? audit.reasons.join(' ') : null,
            reconciled_at: new Date().toISOString(),
        })
        .eq('id', costingId)
        .eq('org_id', profile.org_id)
        .eq('updated_at', expectedUpdatedAt)
        .select('id, updated_at, reconciliation_status, reconciliation_note, reconciled_at')
        .maybeSingle()
    if (error) return { error: error.message }
    if (!data) return { error: 'This costing changed in another tab. Refresh before auditing it again.' }
    revalidatePath('/owner/quotes')
    revalidatePath('/owner/estimator')
    return { data, audit }
}

export async function updateSavedCostingLibraryState(input: {
    id: string
    expectedUpdatedAt: string
    isArchived?: boolean
    isFavorite?: boolean
}) {
    if (!UUID_PATTERN.test(input.id)) return { error: 'Costing identifier is invalid.' }
    const timestampError = validateExpectedTimestamp(input.expectedUpdatedAt, 'This costing')
    if (timestampError) return { error: timestampError }
    if (input.isArchived === undefined && input.isFavorite === undefined) return { error: 'No library change was requested.' }

    const { user } = await requireRole(['owner'])
    const supabase = await createServerClient()
    try {
        await supabase.rpc('set_actor_for_audit', { p_actor_id: user.id })
    } catch {
        // Audit trigger falls back to auth.uid().
    }

    const { data, error } = await supabase.rpc('update_saved_costing_library_state_atomic', {
        p_costing_id: input.id,
        p_expected_updated_at: input.expectedUpdatedAt,
        p_is_archived: input.isArchived ?? null,
        p_is_favorite: input.isFavorite ?? null,
    })
    if (error) return { error: error.message || 'This costing changed in another tab. Refresh Saved Costings and try again.' }
    if (!data || typeof data !== 'object' || !('id' in data)) {
        return { error: 'The Saved Costing library update completed without returning its new state.' }
    }
    revalidatePath('/owner/quotes')
    return { data }
}

export async function updateQuoteStatus(
    id: string,
    status: 'draft' | 'sent' | 'accepted' | 'rejected',
    expectedUpdatedAt: string
) {
    if (!UUID_PATTERN.test(id)) return { error: 'Quotation identifier is invalid.' }
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const timestampError = validateExpectedTimestamp(expectedUpdatedAt, 'This quote')
    if (timestampError) return { error: timestampError }

    const { data: current, error: currentError } = await supabase
        .from('estimator_quotes')
        .select('id, status, order_id, updated_at, record_kind')
        .eq('id', id)
        .eq('org_id', profile.org_id)
        .single()

    if (currentError || !current) return { error: currentError?.message ?? 'Quote not found.' }
    if (normalizeCostingRecordKind(current.record_kind) !== 'quotation') {
        return { error: 'Standalone costings do not have quotation statuses. Create a quotation from this costing first.' }
    }
    if (current.order_id) return { error: 'Converted quotes can no longer change status.' }
    if (Date.parse(current.updated_at) !== Date.parse(expectedUpdatedAt)) {
        return { error: 'This Quotation changed in another tab. Refresh Quotations before changing its status.' }
    }

    const allowedTransitions: Record<string, string[]> = {
        draft: ['sent'],
        sent: ['accepted', 'rejected'],
        accepted: [],
        rejected: [],
    }

    if (!allowedTransitions[current.status]?.includes(status)) {
        const nextAction = allowedTransitions[current.status]?.length
            ? `Next allowed action: ${allowedTransitions[current.status].join(' or ')}.`
            : 'No further status changes are allowed; create a new quotation from the saved snapshot.'
        return { error: `Invalid quote transition from "${current.status}" to "${status}". ${nextAction}` }
    }

    const { data, error } = await supabase
        .from('estimator_quotes')
        .update({ status })
        .eq('id', id)
        .eq('org_id', profile.org_id)
        .eq('updated_at', expectedUpdatedAt)
        .select()
        .maybeSingle()

    if (error) return { error: error.message }
    if (!data) return { error: 'This Quotation changed in another tab. Refresh Quotations before changing its status.' }
    
    revalidatePath('/owner/quotes')
    return { success: true, data }
}

export async function getQuoteStatusHistory(id: string) {
    if (!UUID_PATTERN.test(id)) return { error: 'Quotation identifier is invalid.' }
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('audit_log')
        .select('changed_at, changed_by, old_data, new_data')
        .eq('org_id', profile.org_id)
        .eq('table_name', 'estimator_quotes')
        .eq('record_id', id)
        .order('changed_at', { ascending: true })

    if (error) return { error: error.message }

    const statusValues = new Set(['draft', 'sent', 'accepted', 'rejected'])
    const getStatus = (value: unknown) => {
        if (!value || typeof value !== 'object' || !('status' in value)) return null
        const status = (value as { status?: unknown }).status
        return typeof status === 'string' && statusValues.has(status) ? status : null
    }

    const history = (data ?? []).map(row => ({
        changedAt: row.changed_at,
        changedBy: row.changed_by,
        from: getStatus(row.old_data),
        to: getStatus(row.new_data),
    })).filter(row => row.to && row.from !== row.to)

    return { data: history }
}

export async function updateQuotationDocumentMetadata(input: {
    id: string
    expectedUpdatedAt: string
    validUntil: string
    customerTerms?: string | null
}) {
    if (!UUID_PATTERN.test(input.id)) return { error: 'Quotation identifier is invalid.' }
    const timestampError = validateExpectedTimestamp(input.expectedUpdatedAt, 'This quotation')
    if (timestampError) return { error: timestampError }

    const validUntil = normalizeQuotationDate(input.validUntil)
    if (!validUntil) return { error: 'Enter a valid quotation validity date.' }
    if ((input.customerTerms ?? '').trim().length > 2000) return { error: 'Customer terms must be 2,000 characters or fewer.' }

    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    const { data: current, error: currentError } = await supabase
        .from('estimator_quotes')
        .select('id, record_kind, status, order_id, updated_at, quotation_reference, created_at')
        .eq('id', input.id)
        .eq('org_id', profile.org_id)
        .maybeSingle()

    if (currentError) return { error: currentError.message }
    if (!current) return { error: 'Quotation not found.' }
    if (normalizeCostingRecordKind(current.record_kind) !== 'quotation') {
        return { error: 'Standalone costings do not have customer quotation metadata.' }
    }
    if (current.order_id || current.status === 'accepted') {
        return { error: 'Accepted quotations are locked. Reopen a draft or sent quotation to change its customer terms.' }
    }

    const { data, error } = await supabase
        .from('estimator_quotes')
        .update({
            quotation_reference: current.quotation_reference ?? buildQuotationReference(current.id, new Date(current.created_at)),
            quotation_valid_until: validUntil,
            customer_terms: normalizeCustomerTerms(input.customerTerms),
        })
        .eq('id', input.id)
        .eq('org_id', profile.org_id)
        .eq('updated_at', input.expectedUpdatedAt)
        .select('id, updated_at, quotation_reference, quotation_valid_until, customer_terms')
        .maybeSingle()

    if (error) return { error: error.message }
    if (!data) return { error: 'This quotation changed in another tab. Refresh Quotations before exporting again.' }

    revalidatePath('/owner/quotes')
    return { success: true, data }
}

export async function deleteEstimatorQuote(id: string, expectedUpdatedAt: string) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const timestampError = validateExpectedTimestamp(expectedUpdatedAt, 'This quote')
    if (timestampError) return { error: timestampError }

    // Accepted/sent/converted quotes are commercial audit history. Only an
    // unconverted draft or rejected quote may be explicitly removed.
    const { data: deleted, error } = await supabase
        .from('estimator_quotes')
        .delete()
        .eq('id', id)
        .eq('org_id', profile.org_id)
        .eq('updated_at', expectedUpdatedAt)
        .is('order_id', null)
        .in('status', ['draft', 'rejected'])
        .select('id')
        .maybeSingle()

    if (error) return { error: error.message }
    if (!deleted) {
        return { error: 'This Quotation changed, is no longer deletable, or was already removed. Refresh Quotations.' }
    }

    revalidatePath('/owner/quotes')
    return { success: true }
}

// ─── Market Run — Create ──────────────────────────────────────────────────────

/**
 * Creates a Market Run from estimator output.
 * Steps:
 *   1. Save the estimator snapshot as an estimator_quote (market mode)
 *   2. Create the market_runs record with cost anchor
 *   3. Link quote → market_run bidirectionally
 *   4. Create a backing production order (party_name = fabric_label, market_run_id set)
 *   5. Returns { marketRunId } for redirect
 */
export async function createMarketRunFromEstimator(params: {
    fabricLabel:             string
    qualityLabel:            string
    warpInstruction?:        string
    weftInstruction?:        string
    targetMeters:            number
    estimate:                EstimateState
    totalProductionCostPerM: number
    notes?:                  string
    deadline:                string
    templateId?:             string
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    const admin = createAdminClient()

    const tierError = await requirePremiumTier(profile.org_id)
    if (tierError) return { error: tierError }

    const targetMeters = Number(params.targetMeters)
    if (!Number.isFinite(targetMeters) || targetMeters <= 0) {
        return { error: 'Target meters must be greater than 0.' }
    }
    if (!params.fabricLabel.trim()) {
        return { error: 'Fabric label is required.' }
    }
    if (params.templateId && !UUID_PATTERN.test(params.templateId)) return { error: 'Saved quality identifier is invalid.' }
    if (params.templateId) {
        const { data: template, error: templateError } = await supabase
            .from('estimator_templates')
            .select('id')
            .eq('id', params.templateId)
            .eq('org_id', profile.org_id)
            .eq('is_active', true)
            .maybeSingle()
        if (templateError) return { error: templateError.message }
        if (!template) return { error: 'The selected saved quality is no longer available.' }
    }

    const estimate = { ...params.estimate, orderQuantityM: targetMeters }
    const snapshotError = getFirstEstimatorValidationMessage(validateEstimatorSnapshot(estimate, { requireCapacity: true }))
    if (snapshotError) return { error: snapshotError }
    const authoritative = getAuthoritativeQuoteTotals(estimate)
    const validationError = getFirstEstimatorValidationMessage(validateEstimatorQuoteBoundary({
        estimate,
        totalProductionCostPerM: authoritative.productionCostPerM,
        quotePricePerM: authoritative.quotePricePerM,
        targetMeters,
        requireCapacity: true,
        result: authoritative.result,
        totals: authoritative.totals,
    }))
    if (validationError) return { error: validationError }
    if (normalizeCurrencySnapshot(params.totalProductionCostPerM) !== authoritative.productionCostPerM) {
        return { error: 'The estimate changed before the market run was created. Review the recalculated totals and try again.' }
    }

    // Recompute the payroll snapshot after validation. A caller cannot lower
    // or inflate the downstream worker rate independently of the recipe.
    const workerRatePerM = calcWorkerRateSnapshot(
        estimate.weftRows,
        estimate.perPickCostPaisa ?? 0
    )

    const productionSetupRequirement = await getProductionSetupRequirement(supabase, profile.org_id)
    if (productionSetupRequirement) return productionSetupRequirement

    // 1. Save estimator snapshot as a quote (party_name = fabric label for display)
    const { data: savedQuote, error: quoteError } = await admin
        .from('estimator_quotes')
        .insert({
            org_id:               profile.org_id,
            record_kind:          'market_run',
            party_name:           params.fabricLabel.trim(),   // fabric label used as party placeholder
            quality_label:        params.qualityLabel.trim(),
            template_id:          params.templateId ?? null,
            warp_instruction:     params.warpInstruction?.trim(),
            weft_instruction:     params.weftInstruction?.trim(),
            warp_rows:            estimate.warpRows,
            weft_rows:            estimate.weftRows,
            per_pick_cost_paise:  estimate.perPickCostPaisa,
            tape_length_m:        estimate.tapeLengthM,
            warp_crimp_pct:       estimate.warpCrimpPct ?? 0,
            yarn_shortage_pct:    estimate.yarnShortagePct ?? 0,
            warping_rate_per_kg:  estimate.warpingRatePerKg,
            sizing_rate_per_kg:   estimate.sizingRatePerKg,
            winding_rate_per_kg:  estimate.windingRatePerKg,
            processing_rate_per_m: estimate.processingRatePerM,
            finishing_rate_per_m: estimate.finishingRatePerM,
            overhead_items:       estimate.overheadItems,
            monthly_output_m:     estimate.monthlyOutputM,
            overhead_override_per_m: estimate.overheadMode === 'direct' ? estimate.overheadOverridePerM ?? null : null,
            overhead_pct:         0,
            commission_pct:       authoritative.result.commissionPct,
            transport_per_m:      authoritative.result.transportPerM,
            order_quantity_m:     authoritative.result.quantityM ?? targetMeters,
            profit_margin_pct:    authoritative.result.targetMarginPct,
            enabled_sections:     estimate.enabledSections,
            loom_type:            estimate.loomType ?? null,
            estimator_rpm:        estimate.loomRpm ?? null,
            estimator_power_kw:   estimate.loomPowerKw ?? null,
            hours_per_shift:      estimate.hoursPerShift,
            sizing_mode:          estimate.sizingMode,
            loom_count:           estimate.loomCount,
            monthly_working_days: estimate.monthlyWorkingDays,
            avg_output_per_loom_per_day: estimate.avgOutputPerLoomPerDay,
            calculation_version:      authoritative.result.calculationVersion,
            rounding_policy:          authoritative.result.roundingPolicy,
            production_cost_per_meter: authoritative.result.productionCostPerM,
            overhead_per_meter:       authoritative.result.overheadPerM,
            commission_cost_per_meter: authoritative.result.commissionPerM,
            break_even_price_per_meter: authoritative.result.breakEvenPricePerM,
            expected_profit_per_meter: authoritative.result.profitPerM,
            expected_profit_total:     authoritative.result.expectedProfitTotal,
            actual_margin_percent:     authoritative.result.actualMarginPct,
            costing_result_snapshot:   authoritative.result,
            reconciliation_status:     'verified',
            reconciliation_note:       null,
            reconciled_at:             new Date().toISOString(),
            landed_cost_per_meter:    authoritative.landedCostPerM,
            quote_price_per_meter:    authoritative.quotePricePerM,
            intended_margin_percent:  authoritative.result.targetMarginPct,
            meters:                   authoritative.result.quantityM ?? targetMeters,
            status:                   'accepted',       // auto-accept — no party negotiation needed
            worker_rate_per_m:        workerRatePerM,
            ppi:     Math.round(estimate.weftRows[0]?.picks ?? 68),
            yarn_denier: Math.round(estimate.warpRows[0] ? getEffectiveYarnDenier(estimate.warpRows[0]) : 75),
            yarn_rate_per_kg: estimate.warpRows[0]?.yarnRate ?? 0,
        })
        .select('id')
        .single()

    if (quoteError || !savedQuote) return { error: quoteError?.message ?? 'Failed to save estimator snapshot.' }

    // 2. Create market_runs record
    const { data: marketRun, error: runError } = await supabase
        .from('market_runs')
        .insert({
            org_id:           profile.org_id,
            fabric_label:     params.fabricLabel.trim(),
            quality_label:    params.qualityLabel.trim() || null,
            warp_instruction: params.warpInstruction?.trim() || null,
            weft_instruction: params.weftInstruction?.trim() || null,
            target_meters:    targetMeters,
            cost_per_meter:   authoritative.landedCostPerM,
            worker_rate_per_m: workerRatePerM,
            quote_id:         savedQuote.id,
            status:           'production',
            notes:            params.notes?.trim() || null,
        })
        .select('id')
        .single()

    if (runError || !marketRun) {
        // Cleanup orphaned quote
        await admin.from('estimator_quotes').delete().eq('id', savedQuote.id).eq('org_id', profile.org_id)
        return { error: runError?.message ?? 'Failed to create market run.' }
    }

    // 3. Backlink quote → market_run
    await admin
        .from('estimator_quotes')
        .update({ market_run_id: marketRun.id })
        .eq('id', savedQuote.id)
        .eq('org_id', profile.org_id)

    // 4. Create backing production order (no party_id — market run orders have no external party)
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
            org_id:              profile.org_id,
            party_name:          params.fabricLabel.trim(),     // fabric label as display name
            quality_label:       params.qualityLabel.trim() || null,
            warp_instruction:    params.warpInstruction?.trim() ?? '',
            weft_instruction:    params.weftInstruction?.trim() ?? '',
            total_target_meters: targetMeters,
            start_date:          new Date().toISOString().split('T')[0],
            deadline:            params.deadline,
            status:              'active',
            worker_rate_per_m:   workerRatePerM,
            notes:               params.notes?.trim() ?? '',
            tracking_token:      generateTrackingToken(),
            market_run_id:       marketRun.id,
        })
        .select('id')
        .single()

    if (orderError || !order) {
        // Cleanup
        await supabase.from('market_runs').delete().eq('id', marketRun.id).eq('org_id', profile.org_id)
        await admin.from('estimator_quotes').delete().eq('id', savedQuote.id).eq('org_id', profile.org_id)
        return { error: orderError?.message ?? 'Failed to create production order.' }
    }

    await admin
        .from('estimator_quotes')
        .update({ order_id: order.id, market_run_id: marketRun.id })
        .eq('id', savedQuote.id)
        .eq('org_id', profile.org_id)

    // 5. Compute and store yarn requirements (same as quote-to-order flow)
    const estimateForOrder = {
        ...estimate,
        orderQuantityM: targetMeters,
    }
    const { calcFullTotals: calc } = await import('@/lib/estimator')
    const totals = calc(estimateForOrder)
    const warpRequiredKg = (totals.totalWarpKgPer100m / 100) * targetMeters
    const weftRequiredKg = ((totals.totalAllYarnKgPer100m - totals.totalWarpKgPer100m) / 100) * targetMeters
    const totalRequiredKg = warpRequiredKg + weftRequiredKg
    const estimatedBeams = totals.estimatedBeamCapacityM > 0
        ? Math.max(1, Math.ceil(targetMeters / totals.estimatedBeamCapacityM))
        : null

    await supabase
        .from('order_yarn_requirements')
        .upsert({
            org_id: profile.org_id,
            order_id: order.id,
            quote_id: savedQuote.id,
            warp_required_kg: Number(warpRequiredKg.toFixed(3)),
            weft_required_kg: Number(weftRequiredKg.toFixed(3)),
            total_required_kg: Number(totalRequiredKg.toFixed(3)),
            estimated_beams: estimatedBeams,
            requirement_snapshot: {
                order_quantity_m: targetMeters,
                estimated_beam_capacity_m: totals.estimatedBeamCapacityM,
                warp_rows: estimate.warpRows,
                weft_rows: estimate.weftRows,
                warp_crimp_pct: estimate.warpCrimpPct ?? 0,
                yarn_shortage_pct: estimate.yarnShortagePct ?? 0,
            },
        }, { onConflict: 'order_id' })

    revalidatePath('/owner/market-runs')
    revalidatePath('/owner/orders')
    revalidatePath('/owner/analytics')
    revalidatePath('/owner/machines')
    revalidatePath('/supervisor/machines')
    return { success: true, marketRunId: marketRun.id }
}

// ─── Market Run — Read ────────────────────────────────────────────────────────

export async function getMarketRuns(options: { includeArchived?: boolean } = {}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('market_run_summary')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })

    if (error) return { error: error.message }
    const rows = data ?? []
    if (options.includeArchived) return { data: rows }

    return {
        data: rows.filter((run) => {
            const displayStatus = getMarketRunDisplayStatus({
                storedStatus: run.status,
                producedQuantity: run.total_meters_produced,
                availableQuantity: run.meters_in_godown,
                soldQuantity: run.total_meters_sold,
            })
            return !['sold_out', 'closed'].includes(displayStatus)
        }),
    }
}

export async function getMarketRunDetail(marketRunId: string) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data: run, error } = await supabase
        .from('market_run_summary')
        .select('*')
        .eq('market_run_id', marketRunId)
        .eq('org_id', profile.org_id)
        .single()

    if (error || !run) return { error: error?.message ?? 'Market run not found.' }

    const { data: quote, error: quoteError } = await supabase
        .from('estimator_quotes')
        .select('*')
        .eq('id', run.quote_id)
        .eq('org_id', profile.org_id)
        .maybeSingle()

    if (quoteError) return { error: quoteError.message }

    // Fetch both direct market run sales and stock sales from fabric_stock_sales
    const [salesRes, stockSalesRes] = await Promise.all([
        supabase
            .from('market_run_sales')
            .select(`
                *,
                parties ( id, name, phone )
            `)
            .eq('market_run_id', marketRunId)
            .eq('org_id', profile.org_id),
        supabase
            .from('fabric_stock_sales')
            .select(`
                id,
                sale_date,
                meters_sold,
                price_per_meter,
                cost_per_meter,
                dispatch_status,
                party_name,
                party_phone,
                notes,
                fabric_stock_lots!inner (
                    market_run_id
                )
            `)
            .eq('fabric_stock_lots.market_run_id', marketRunId)
            .eq('org_id', profile.org_id)
    ])

    if (salesRes.error) return { error: salesRes.error.message }
    if (stockSalesRes.error) return { error: stockSalesRes.error.message }

    const directSales = (salesRes.data ?? []).map((s) => ({
        id: s.id,
        market_run_id: marketRunId,
        party_id: s.party_id,
        invoice_id: s.invoice_id,
        meters_sold: Number(s.meters_sold),
        price_per_meter: Number(s.price_per_meter),
        cost_per_meter: Number(s.cost_per_meter),
        status: s.status as 'pending' | 'dispatched' | 'settled',
        sale_date: s.sale_date,
        notes: s.notes,
        parties: Array.isArray(s.parties) ? s.parties[0] : s.parties
    }))

    const stockSalesMapped = (stockSalesRes.data ?? []).map((ss) => ({
        id: ss.id,
        market_run_id: marketRunId,
        party_id: '',
        invoice_id: null,
        meters_sold: Number(ss.meters_sold),
        price_per_meter: Number(ss.price_per_meter),
        cost_per_meter: Number(ss.cost_per_meter),
        status: (ss.dispatch_status === 'received'
            ? 'settled'
            : (ss.dispatch_status === 'dispatched' || ss.dispatch_status === 'discrepancy')
                ? 'dispatched'
                : 'pending') as 'pending' | 'dispatched' | 'settled',
        sale_date: ss.sale_date,
        notes: ss.notes,
        parties: {
            id: '',
            name: ss.party_name || 'Stock Sale',
            phone: ss.party_phone,
        }
    }))

    const combinedSales = [...directSales, ...stockSalesMapped].sort(
        (a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime()
    )

    return { data: { run, quote: quote ?? null, sales: combinedSales } }
}

// ─── Market Run — Record a Sale ───────────────────────────────────────────────

export async function createMarketRunSaleAction(params: {
    marketRunId:   string
    partyId:       string
    metersSold:    number
    pricePerMeter: number
    saleDate:      string
    invoiceNumber: string
    dueDays?:      number     // days from sale date → due date
    notes?:        string
}) {
    await requireRole(['owner'])
    void params
    return {
        error: 'Direct market-run sale is disabled. Sell from Godown Stock so the sale creates exactly one commercial receivable.',
    }
}

// ─── Market Run — Update Status ───────────────────────────────────────────────

export async function updateMarketRunStatus(
    marketRunId: string,
    status: 'production' | 'in_godown' | 'partially_sold' | 'sold_out' | 'closed'
) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { error } = await supabase
        .from('market_runs')
        .update({ status })
        .eq('id', marketRunId)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }

    if (status === 'closed') {
        const { data: backingOrders } = await supabase
            .from('orders')
            .select('id')
            .eq('market_run_id', marketRunId)
            .eq('org_id', profile.org_id)

        if (backingOrders && backingOrders.length > 0) {
            const orderIds = backingOrders.map(o => o.id)

            // Set backing orders to completed
            await supabase
                .from('orders')
                .update({ status: 'completed' })
                .in('id', orderIds)
                .eq('org_id', profile.org_id)

            // Unlink all machines assigned to these orders and set them to inactive
            await supabase
                .from('machines')
                .update({ current_order_id: null, status: 'inactive' })
                .in('current_order_id', orderIds)
                .eq('org_id', profile.org_id)
        }
    }

    revalidatePath(`/owner/market-runs/${marketRunId}`)
    revalidatePath('/owner/market-runs')
    revalidatePath('/owner/archive')
    revalidatePath('/owner/stock')
    revalidatePath('/owner/machines')
    revalidatePath('/supervisor/machines')
    return { success: true }
}
