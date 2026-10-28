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
import { getCachedOrgTier } from '@/lib/subscription'
import { normalizeCostingRecordKind } from '@/lib/costing-workspace'
import { buildSavedQualityRecipeState, type SavedQualityCostingReuse } from '@/lib/saved-costings'
import { auditHistoricalCosting } from '@/lib/costing-reconciliation'
import type { FactoryProfileId } from '@/lib/factory-cost-profiles'
import { buildCostingInputFingerprint } from '@/lib/costing-save-trust'
import { buildEstimatorQuotePayload, toLegacyEstimatorQuotePayload } from '@/lib/estimator-quote-payload'
import { createdAtDescendingAfter, readAllPages } from '@/lib/paged-read'
import { getRateReviewStatus } from '@/lib/cost-rates'
import { findCostingSaveReceipt } from '@/lib/costing-save-receipt'
import {
    deriveCostingOverheadPerMetre,
    MAX_MONTHLY_OVERHEAD_AMOUNT,
    MAX_STANDARD_MONTHLY_PRODUCTION_METRES,
} from '@/lib/monthly-overhead'
import { detectTemplateYarnRenames } from '@/lib/yarn-rate-reconciliation'
import { sameConstruction, templateConstructionRows } from '@/lib/quality-construction'

const ESTIMATOR_NAME_MAX_LENGTH = 120
const ESTIMATOR_QUOTE_PAGE_SIZE = 500
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
        return { error: 'This costing could not be checked. Refresh the page and try again.' }
    }
    return { payload: { ...payload, server_attestation_id: data } }
}

type SaveRevisionRpcResult = {
    success?: boolean
    error?: string
    quoteId?: string
    updatedAt?: string
    createdAt?: string
    versionNumber?: number
    qualityUpdated?: boolean
    outcome?: string
    noChange?: boolean
    idempotentReplay?: boolean
}

type InitialQualityRpcResult = SaveRevisionRpcResult & { templateId?: string }

type CostingRpcOutcome = { data: unknown; error: { message: string; code?: string } | null }

// Must match the error text raised by save_estimator_costing_revision_v2.
const COSTING_PAYLOAD_UNSUPPORTED_FIELDS = 'The costing payload contains unsupported fields.'

/**
 * Attests a costing payload and saves it. A database without the LT01B
 * input-basis migration rejects the new keys before any write (the allowlist
 * check runs first and the call rolls back); in that case only, the legacy
 * payload is attested and saved once, so code deployed before the migration
 * keeps saving costings. No other error is retried.
 */
async function saveAttestedCostingPayload(
    userId: string,
    orgId: string,
    payload: Record<string, unknown>,
    save: (attestedPayload: Record<string, unknown>) => PromiseLike<CostingRpcOutcome>,
): Promise<CostingRpcOutcome | { attestationError: string }> {
    const attestation = await attestCanonicalCostingPayload(userId, orgId, payload)
    if (!attestation.payload) return { attestationError: attestation.error ?? 'This costing could not be checked. Refresh the page and try again.' }
    const outcome = await save(attestation.payload)
    const rejectedInputBasis = outcome.error?.code === '22023' && outcome.error.message === COSTING_PAYLOAD_UNSUPPORTED_FIELDS
    if (!rejectedInputBasis) return outcome

    const legacyAttestation = await attestCanonicalCostingPayload(userId, orgId, toLegacyEstimatorQuotePayload(payload))
    if (!legacyAttestation.payload) return { attestationError: legacyAttestation.error ?? 'This costing could not be checked. Refresh the page and try again.' }
    return save(legacyAttestation.payload)
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

function validateClientRequestId(value: string): string | null {
    return UUID_PATTERN.test(value)
        ? null
        : 'The save request identifier is invalid. Refresh the estimator and try again.'
}

function getInitialQualitySnapshotRequestId(templateId: string): string {
    const hex = crypto.createHash('sha256').update(`initial-quality-costing:${templateId}`).digest('hex')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
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

    // The fixed-salary staff feed the overhead; they do not depend on the
    // profile row, so both are read at once.
    const [{ data, error }, staffResult] = await Promise.all([
        supabase
            .from('factory_cost_profile')
            .select('*')
            .eq('factory_id', profile.org_id)
            .maybeSingle(),
        readCompleteBaseRows((from, to) => supabase.from('base_production_workers')
            .select('id, name, role, pay_type, is_active, monthly_salary, start_date, end_date, salary_history', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', profile.org_id).eq('pay_type', 'fixed_monthly').order('id').range(from, to)),
    ])

    if (error) return { error: error.message }
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

    let profileData = data
    if (profileData && !profileData.is_configured) {
        // If the account has already dismissed the wizard, or already has entries in
        // the rate book or saved qualities, treat it as configured and heal the database.
        const wizardDismissed = user.user_metadata?.factory_cost_wizard_dismissed === true
            || user.user_metadata?.factory_cost_configured === true
        let shouldMarkConfigured = wizardDismissed

        if (!shouldMarkConfigured) {
            const { count: rateCount } = await supabase
                .from('cost_rate_book')
                .select('id', { count: 'exact', head: true })
                .eq('org_id', profile.org_id)
            if ((rateCount ?? 0) > 0) {
                shouldMarkConfigured = true
            } else {
                const { count: templateCount } = await supabase
                    .from('estimator_templates')
                    .select('id', { count: 'exact', head: true })
                    .eq('org_id', profile.org_id)
                if ((templateCount ?? 0) > 0) {
                    shouldMarkConfigured = true
                }
            }
        }

        if (shouldMarkConfigured) {
            profileData = { ...profileData, is_configured: true }
            void supabase
                .from('factory_cost_profile')
                .update({ is_configured: true })
                .eq('factory_id', profile.org_id)
        }
    }

    return { data: profileData ? withStaff(profileData) : null }
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
        if (data.requireCapacity !== false && (!Number.isFinite(loomCount) || loomCount <= 0)) return { error: 'Enter at least one loom before saving your monthly factory costs.' }
        if (data.requireCapacity !== false && (!Number.isFinite(workingDays) || workingDays <= 0)) return { error: 'Enter positive working days before saving your monthly factory costs.' }
        if (data.requireCapacity !== false && (!Number.isFinite(avgOutput) || avgOutput <= 0)) return { error: 'Enter positive daily output per loom before saving your monthly factory costs.' }
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
        if (!updated) return { error: 'Your factory costs were changed in another tab. Refresh before saving again.' }
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

    if (user.user_metadata?.factory_cost_wizard_dismissed !== true) {
        try {
            await supabase.auth.updateUser({
                data: { factory_cost_wizard_dismissed: true },
            })
        } catch {
            // Non-fatal: database row is already saved
        }
    }

    revalidatePath('/owner/estimator')
    revalidatePath('/owner/settings')
    revalidatePath('/owner', 'layout')
    return { success: true, updatedAt }
}

/**
 * Persists factory cost wizard dismissal at the account level (user_metadata)
 * and marks the database factory_cost_profile configured so the onboarding
 * modal never re-appears.
 */
export async function dismissFactoryCostWizard(): Promise<{ success: boolean }> {
    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    if (user.user_metadata?.factory_cost_wizard_dismissed !== true) {
        const { error } = await supabase.auth.updateUser({
            data: { factory_cost_wizard_dismissed: true },
        })
        if (error) return { success: false }
    }

    try {
        await supabase
            .from('factory_cost_profile')
            .upsert({
                factory_id: profile.org_id,
                is_configured: true,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'factory_id' })
    } catch {
        // Non-fatal: user_metadata already persists dismissal
    }

    revalidatePath('/owner/estimator')
    return { success: true }
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
    if (!updated) return { error: 'Your factory costs were changed in another tab. Refresh before applying factory expenses.' }

    revalidatePath('/owner/estimator')
    revalidatePath('/owner/settings')
    revalidatePath('/owner', 'layout')
    return { success: true as const, updatedAt: updated.updated_at, expenses: updated.overhead_items as OverheadItem[], derivedOverheadPerMetre: Number(updated.overhead_override_per_m) }
}

// ─── Estimator Templates ──────────────────────────────────────────────────────

export async function getEstimatorTemplates(options?: { includeArchived?: boolean; summary?: boolean }) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    // The summary carries the recipe rows only for their yarn names, which the
    // Saved Costings catalogue lists on each quality's card.
    const templateSelect = options?.summary ? 'id,name,updated_at,is_active,warp_rows,weft_rows' : '*'
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
    // Reopened qualities combine current recipe/rate rows with their latest
    // linked costing assumptions in the Lite and Base workspaces.
    const effectiveTier = await getCachedOrgTier(profile.org_id)
    if ((effectiveTier !== 'base' && effectiveTier !== 'lite') || templates.length === 0) return { data: templates }

    const templateIds = templates.map(template => template.id).filter(Boolean)
    const reuseColumns = `
            template_id,
            updated_at,
            version_number,
            warp_rows,
            weft_rows,
            per_pick_cost_paise,
            yarn_shortage_pct,
            warp_crimp_pct,
            tape_length_m,
            loom_type,
            estimator_rpm,
            estimator_power_kw,
            hours_per_shift,
            sizing_mode,
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
            avg_output_per_loom_per_day`
    const readReuse = (columns: string) => supabase
        .from('estimator_quotes')
        .select(columns as '*')
        .eq('org_id', profile.org_id)
        .eq('record_kind', 'costing')
        .in('template_id', templateIds)
        .order('updated_at', { ascending: false })
    // LT01B stores each costing's warping and overhead modes. Until that
    // migration is applied the columns do not exist; read without them then.
    let { data: costings, error: costingError } = await readReuse(`${reuseColumns}, warping_mode, overhead_mode`)
    if (costingError && ['42703', 'PGRST204'].includes(costingError.code ?? '')) {
        ({ data: costings, error: costingError } = await readReuse(reuseColumns))
    }

    if (costingError) return { error: costingError.message }

    const latestByTemplate = new Map<string, SavedQualityCostingReuse>()
    const highestVersionByTemplate = new Map<string, number>()
    for (const costing of costings ?? []) {
        if (!costing.template_id) continue
        // The next costing is the next version after the highest one saved,
        // which is not always the most recently touched costing.
        const version = Number(costing.version_number)
        if (Number.isFinite(version)) {
            highestVersionByTemplate.set(costing.template_id, Math.max(version, highestVersionByTemplate.get(costing.template_id) ?? 0))
        }
        if (latestByTemplate.has(costing.template_id)) continue
        latestByTemplate.set(costing.template_id, costing)
    }
    for (const [templateId, reuse] of latestByTemplate) {
        const highest = highestVersionByTemplate.get(templateId)
        if (highest !== undefined) reuse.version_number = highest
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
 * profile/defaults to calculate its first summary; saved qualities and review badges can hydrate after the
 * primary editor is interactive.
 */
export async function getEstimatorSecondaryData() {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const [templatesResult, workersResult, ratesResult, yarnRatesResult] = await Promise.all([
        getEstimatorTemplates(),
        Promise.resolve({ data: [] }),
        supabase
            .from('cost_rate_book')
            .select('name, last_reviewed_at, review_interval_days')
            .eq('org_id', profile.org_id)
            .eq('is_active', true)
            .eq('apply_as_default', true),
        supabase
            .from('cost_rate_book')
            .select('id, name, category, current_value, unit')
            .eq('org_id', profile.org_id)
            .eq('is_active', true)
            .in('category', ['yarn_warp', 'yarn_weft']),
    ])

    const deferredErrors = [templatesResult, workersResult]
        .map(result => (result as { error?: string }).error)
        .filter((error): error is string => Boolean(error))
    if (ratesResult.error) deferredErrors.push(ratesResult.error.message)
    if (yarnRatesResult.error) deferredErrors.push(yarnRatesResult.error.message)
    if (deferredErrors.length > 0) return { error: deferredErrors[0] }

    return {
        templates: templatesResult.data ?? [],
        workers: workersResult.data ?? [],
        staleDefaultRateNames: (ratesResult.data ?? [])
            .filter(rate => getRateReviewStatus(rate) === 'overdue')
            .map(rate => rate.name),
        rateBookYarns: (yarnRatesResult.data ?? []).map(r => ({
            id: r.id,
            name: r.name,
            category: r.category as 'yarn_warp' | 'yarn_weft',
            currentValue: Number(r.current_value),
            unit: r.unit,
        })),
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
    const requireCapacity = requiresFactoryCapacity(
        snapshotEstimate,
        false,
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
    const quotePayload = buildEstimatorQuotePayload({
        orgId: profile.org_id,
        recordKind: 'costing',
        partyName: normalizeTemplateName(data.partyName || '') || null,
        qualityLabel: normalizedName,
        templateId: null,
        warpInstruction: null,
        weftInstruction: null,
        estimate: snapshotEstimate,
        result: snapshotTotals.result,
        // The first costing of a new saved quality keeps its estimate's commercial inputs.
        commercial: {
            commissionPct: snapshotEstimate.commissionPct,
            transportPerM: snapshotEstimate.transportPerM,
            orderQuantityM: snapshotEstimate.orderQuantityM,
            profitPct: snapshotEstimate.profitPct,
        },
        status: 'draft',
        clientRequestId: initialRequestId,
        workerRatePerM,
        costingInputFingerprint,
        factoryProfileUpdatedAt: factoryProfile?.updated_at ?? null,
        reconciledAt: new Date().toISOString(),
    })

    const atomicOutcome = await saveAttestedCostingPayload(user.id, profile.org_id, quotePayload, trustedQuotePayload => supabase.rpc(
        'create_saved_quality_with_initial_costing_v1',
        {
            p_template_payload: templatePayload,
            p_quote_payload: trustedQuotePayload,
        },
    ))
    if ('attestationError' in atomicOutcome) return { error: atomicOutcome.attestationError }
    const { data: atomicResult, error: atomicError } = atomicOutcome as { data: InitialQualityRpcResult | null; error: CostingRpcOutcome['error'] }
    if (atomicError) return { error: templateWriteError(atomicError) }
    if (!atomicResult || atomicResult.success !== true) {
        return { error: atomicResult?.error ?? 'The quality was not saved because its costing could not be saved. Try again.' }
    }

    revalidatePath('/owner/estimator')
    revalidatePath('/owner/settings')
    revalidatePath('/owner/quotes')
    revalidatePath('/owner/rates')
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

async function syncTemplateYarnRenames(
    supabase: Awaited<ReturnType<typeof createServerClient>>,
    orgId: string,
    templateId: string,
    oldWarpRows?: WarpRow[] | null,
    oldWeftRows?: WeftRow[] | null,
    newWarpRows?: WarpRow[] | null,
    newWeftRows?: WeftRow[] | null,
) {
    try {
        const [otherTemplatesRes, existingRatesRes] = await Promise.all([
            supabase
                .from('estimator_templates')
                .select('warp_rows, weft_rows')
                .eq('org_id', orgId)
                .eq('is_active', true)
                .neq('id', templateId),
            supabase
                .from('cost_rate_book')
                .select('name, category')
                .eq('org_id', orgId)
                .in('category', ['yarn_warp', 'yarn_weft']),
        ])

        const renameActions = detectTemplateYarnRenames({
            oldWarpRows,
            oldWeftRows,
            newWarpRows,
            newWeftRows,
            otherTemplates: otherTemplatesRes.data ?? [],
            existingRates: existingRatesRes.data ?? [],
        })

        for (const action of renameActions) {
            if (action.kind === 'rename') {
                await supabase
                    .from('cost_rate_book')
                    .update({
                        name: action.newName,
                        current_value: action.newRate,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('org_id', orgId)
                    .eq('category', action.category)
                    .ilike('name', action.oldNormalizedName)
            } else if (action.kind === 'delete_orphan') {
                await supabase
                    .from('cost_rate_book')
                    .delete()
                    .eq('org_id', orgId)
                    .eq('category', action.category)
                    .eq('apply_as_default', false)
                    .in('source', ['Saved quality', 'Saved costing'])
                    .ilike('name', action.oldNormalizedName)
            }
        }
    } catch {
        // Trigger provides primary DB-level guarantee; non-blocking fallback
    }
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

    await syncTemplateYarnRenames(supabase, profile.org_id, data.id, current.warp_rows, current.weft_rows, data.warpRows, data.weftRows)

    revalidatePath('/owner/estimator')
    revalidatePath('/owner/settings')
    revalidatePath('/owner/rates')
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
    revalidatePath('/owner/rates')
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
    revalidatePath('/owner/rates')
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
    revalidatePath('/owner/rates')
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
    quotationValidUntil?: string | null
    customerTerms?: string | null
}) {
    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

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
    if (!params.qualityLabel.trim()) return { error: 'Quality label is required.' }
    if (params.templateId && !UUID_PATTERN.test(params.templateId)) return { error: 'Saved quality identifier is invalid.' }
    if (params.templateId) {
        const { data: template, error: templateError } = await supabase
            .from('estimator_templates')
            .select('id, name, warp_rows, weft_rows, calculated_yarn_denier, yarn_denier, beam_ends, ppi, reed_space, weft_denier')
            .eq('id', params.templateId)
            .eq('org_id', profile.org_id)
            .eq('is_active', true)
            .maybeSingle()
        if (templateError) return { error: templateError.message }
        if (!template) return { error: 'The selected saved quality is no longer available.' }
        // A saved quality is one fabric: a different fabric is a new quality,
        // even from an old tab or a crafted request. Only new saves are checked;
        // a legacy costing that already differs is left alone.
        if (!sameConstruction(templateConstructionRows(template), estimate)) {
            // Re-costing an existing costing on its own fabric is not a fabric
            // change, even if that quality was edited in place before this rule
            // (the old Update Quality). Only a request that matches neither the
            // quality nor its source costing is refused.
            let matchesSourceCosting = false
            if (params.sourceQuoteId && UUID_PATTERN.test(params.sourceQuoteId)) {
                const { data: source, error: sourceError } = await supabase
                    .from('estimator_quotes')
                    .select('warp_rows, weft_rows')
                    .eq('id', params.sourceQuoteId)
                    .eq('org_id', profile.org_id)
                    .eq('record_kind', 'costing')
                    .eq('template_id', params.templateId)
                    .maybeSingle()
                if (sourceError) return { error: sourceError.message }
                if (Array.isArray(source?.warp_rows) && Array.isArray(source?.weft_rows) && source.warp_rows.length > 0 && source.weft_rows.length > 0) {
                    matchesSourceCosting = sameConstruction({ warpRows: source.warp_rows as WarpRow[], weftRows: source.weft_rows as WeftRow[] }, estimate)
                }
            }
            if (!matchesSourceCosting) return {
                error: `This is a different fabric from ${template.name}. Save it as a new quality.`,
                errorCode: 'different_fabric' as const,
                qualityName: template.name as string,
            }
        }
    }
    // A legacy costing can be missing template_id while still carrying a
    // source quote identity. It is an edit of an existing immutable lineage,
    // not a request to create another Saved Quality with the same name. Let
    // the revision RPC resolve the source template and perform the atomic
    // version save instead of surfacing a misleading duplicate-quality error.
    if (!params.templateId && !params.sourceQuoteId) {
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
    const requireCapacity = requiresFactoryCapacity(estimate, false)
    const snapshotError = getFirstEstimatorValidationMessage(validateEstimatorSnapshot(estimate, {
        requireTapeLength: false,
        requireCapacity,
    }))
    if (snapshotError) return { error: snapshotError }
    const authoritative = getAuthoritativeQuoteTotals(estimate)
    const validationError = getFirstEstimatorValidationMessage(validateEstimatorQuoteBoundary({
        estimate,
        totalProductionCostPerM: authoritative.productionCostPerM,
        quotePricePerM: authoritative.quotePricePerM,
        targetMeters: estimate.orderQuantityM,
        requireTapeLength: false,
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

    let factoryProfileUpdatedAt = params.factoryProfileUpdatedAt ?? null
    if (!factoryProfileUpdatedAt) {
        const { data: factoryProfile, error: factoryProfileError } = await supabase
            .from('factory_cost_profile')
            .select('updated_at')
            .eq('factory_id', profile.org_id)
            .maybeSingle()
        if (factoryProfileError) return { error: factoryProfileError.message }
        factoryProfileUpdatedAt = factoryProfile?.updated_at ?? null
    }

    const costingInputFingerprint = buildCostingInputFingerprint(estimate, {
        warpInstruction: params.warpInstruction,
        weftInstruction: params.weftInstruction,
    })

    const quotePayload = buildEstimatorQuotePayload({
        orgId: profile.org_id,
        recordKind: 'costing',
        partyName: params.partyName?.trim() || null,
        qualityLabel: params.qualityLabel.trim(),
        templateId: params.templateId ?? null,
        warpInstruction: params.warpInstruction?.trim() || null,
        weftInstruction: params.weftInstruction?.trim() || null,
        estimate,
        result: authoritative.result,
        // Persist commercial scalar fields from the same rounded result that
        // drives the saved costing snapshot. The recipe remains the source of
        // inputs; the canonical result is the source of truth for every
        // price-changing value written beside it.
        commercial: {
            commissionPct: authoritative.result.commissionPct,
            transportPerM: authoritative.result.transportPerM,
            orderQuantityM: authoritative.result.quantityM,
            profitPct: authoritative.result.targetMarginPct,
        },
        status: params.status ?? 'draft',
        clientRequestId: params.clientRequestId,
        workerRatePerM,
        costingInputFingerprint,
        factoryProfileUpdatedAt,
        reconciledAt: new Date().toISOString(),
    })

    // Cost Estimates always use the transactional revision boundary. It is
    // what makes “Save New Costing Version” predictable when two tabs or a
    // double-click reach the server together. A source record of another kind
    // (for example a legacy quotation) is handled by the same RPC.
    const costingOutcome = await saveAttestedCostingPayload(user.id, profile.org_id, quotePayload, trustedQuotePayload => supabase.rpc(
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
    ))
    if ('attestationError' in costingOutcome) return { error: costingOutcome.attestationError }
    const { data: costingResult, error: costingError } = costingOutcome as { data: SaveRevisionRpcResult | null; error: CostingRpcOutcome['error'] }

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

// ─── Quote History ────────────────────────────────────────────────────────────

export async function getEstimatorQuotes(filters?: { status?: string }) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    // Summary-first library read. Full recipes, result snapshots, and
    // linked production records load only on open/compare/export intent.
    // LT04: read every page in a deterministic order, so a library larger
    // than the server's row cap is never cut short; any page error fails it.
    const summaryQuery = () => supabase
        .from('estimator_quotes')
        .select('id, status, party_name, quality_label, quote_price_per_meter, landed_cost_per_meter, intended_margin_percent, created_at, updated_at, sent_at, quotation_reference, quotation_valid_until, customer_terms, meters, source_quote_id, costing_group_id, version_number, is_archived, is_favorite, record_kind, template_id, market_run_id, production_cost_per_meter, overhead_per_meter, commission_cost_per_meter, break_even_price_per_meter, expected_profit_per_meter, expected_profit_total, actual_margin_percent, calculation_version, rounding_policy, factory_profile_updated_at, reconciliation_status, reconciliation_note, cost_breakdown:costing_result_snapshot->breakdown')
        .eq('org_id', profile.org_id)
    type QuoteSummaryRow = NonNullable<Awaited<ReturnType<typeof summaryQuery>>['data']>[number]
    const result = await readAllPages<QuoteSummaryRow>(after => {
        let query = summaryQuery()
        if (filters?.status) query = query.eq('status', filters.status)
        if (after) query = query.or(createdAtDescendingAfter(after))
        return query
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .limit(ESTIMATOR_QUOTE_PAGE_SIZE)
            .then(({ data, error }) => ({ data, error }))
    })
    if (result.error) return { error: result.error.message }
    return { data: result.data }
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
    if (!data) return { error: 'This costing was changed in another tab. Refresh before checking it again.' }
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
