'use server'

import { revalidatePath } from 'next/cache'
import { saveEstimatorQuoteV3, updateSavedCostingLibraryState } from '@/app/(dashboard)/owner/estimator/actions'
import { requireRole } from '@/lib/auth'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getCachedOrgTier } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { createdAtDescendingAfter, readAllPages } from '@/lib/paged-read'
import { buildDraftStateFromQuote, type SavedCostingStateRow } from '@/lib/saved-costings'
import type { EstimateState } from '@/lib/estimator'
import {
    applyRateBookYarns,
    applyYarnRate,
    findAffectedLayers,
    isCostingEligible,
    latestCostingPerLineage,
    priceEstimate,
    PROPAGATION_BATCH_SIZE,
    type CostingLineageKey,
    type PropagationOutcome,
    type PropagationPreviewItem,
    type PropagationSkipped,
    type RateBookDriftItem,
    type RateBookYarn,
    type YarnCategory,
} from '@/lib/yarn-rate-propagation'
import { buildPropagationRequestId, buildRateBookUpdateRequestId } from '@/lib/yarn-rate-propagation-request.server'

// "Propagate a new yarn rate": count, preview and apply. The counts and the
// preview are read-only; apply saves new costing versions through the same
// path the estimator uses (see applyYarnRatePropagation).

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LINEAGE_PAGE_SIZE = 500
const READ_CHUNK_SIZE = 100
const CANT_PRICE_REASON = "This costing can't be priced with the new rate."

type Supabase = Awaited<ReturnType<typeof createServerClient>>

type CostingRow = SavedCostingStateRow & {
    id: string
    quality_label: string | null
    party_name: string | null
    template_id: string | null
    version_number: number | null
    updated_at: string
    warp_instruction: string | null
    weft_instruction: string | null
    factory_profile_updated_at: string | null
    is_favorite: boolean | null
    production_cost_per_meter: number | null
    quote_price_per_meter: number | null
}

type LoadedCosting = { row: CostingRow; estimate: EstimateState }

type YarnRate = { id: string; name: string; category: YarnCategory; current_value: number; updated_at: string }

async function requireBaseTier(orgId: string) {
    return hasCapability(await getCachedOrgTier(orgId), 'rate_book')
        ? null
        : 'An active Weavly Lite or Weavly Base subscription is required.'
}

/** The columns that rebuild a costing's estimate, plus what the review lists. */
const COSTING_COLUMNS = `id, quality_label, party_name, template_id, version_number, updated_at,
    warp_instruction, weft_instruction, warp_rows, weft_rows, beam_ends, reed_space, weft_denier,
    yarn_denier, yarn_rate_per_kg, ppi, tape_length_m, per_pick_cost_paise, warping_rate_per_kg,
    sizing_rate_per_kg, winding_rate_per_kg, processing_rate_per_m, finishing_rate_per_m,
    yarn_shortage_pct, warp_crimp_pct, overhead_items, monthly_output_m, overhead_override_per_m,
    commission_pct, transport_per_m, profit_margin_pct, intended_margin_percent, meters,
    enabled_sections, loom_type, estimator_rpm, estimator_power_kw, hours_per_shift, sizing_mode,
    loom_count, monthly_working_days, avg_output_per_loom_per_day, factory_profile_updated_at,
    is_favorite, production_cost_per_meter, quote_price_per_meter`

/**
 * Ids of the latest version of every costing lineage that may be propagated.
 * The latest is chosen first and archived or inactive-quality lineages are
 * dropped after, so an archived latest version never falls back to an older one.
 */
async function readEligibleLatestIds(supabase: Supabase, orgId: string): Promise<{ ids: string[]; error?: string }> {
    const { data: templates, error: templateError } = await supabase
        .from('estimator_templates')
        .select('id')
        .eq('org_id', orgId)
        .eq('is_active', true)
    if (templateError) return { ids: [], error: templateError.message }
    const activeTemplateIds = new Set((templates ?? []).map(template => template.id as string))

    type LineageRow = CostingLineageKey
    const pages = await readAllPages<LineageRow>(after => {
        let query = supabase
            .from('estimator_quotes')
            .select('id, costing_group_id, version_number, created_at, is_archived, template_id')
            .eq('org_id', orgId)
            .eq('record_kind', 'costing')
        if (after) query = query.or(createdAtDescendingAfter(after))
        return query
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .limit(LINEAGE_PAGE_SIZE)
            .then(({ data, error }) => ({ data: data as LineageRow[] | null, error }))
    })
    if (pages.error) return { ids: [], error: pages.error.message }

    return {
        ids: latestCostingPerLineage(pages.data)
            .filter(row => isCostingEligible(row, activeTemplateIds))
            .map(row => row.id),
    }
}

/** Rebuilds the estimate of each costing id, exactly as the Saved Costings page does. */
async function readCostings(supabase: Supabase, orgId: string, ids: readonly string[]): Promise<{ data: LoadedCosting[]; error?: string }> {
    const loaded: LoadedCosting[] = []
    for (let start = 0; start < ids.length; start += READ_CHUNK_SIZE) {
        const chunk = ids.slice(start, start + READ_CHUNK_SIZE)
        const read = (columns: string) => supabase
            .from('estimator_quotes')
            .select(columns as '*')
            .eq('org_id', orgId)
            .eq('record_kind', 'costing')
            .in('id', chunk)
        // The warping and overhead modes exist only after the input-basis
        // migration; read without them until then, as the estimator does.
        let { data, error } = await read(`${COSTING_COLUMNS}, warping_mode, overhead_mode`)
        if (error && ['42703', 'PGRST204'].includes(error.code ?? '')) ({ data, error } = await read(COSTING_COLUMNS))
        if (error) return { data: [], error: error.message }
        for (const row of (data ?? []) as unknown as CostingRow[]) {
            loaded.push({ row, estimate: buildDraftStateFromQuote(row) })
        }
    }
    return { data: loaded }
}

async function readEligibleCostings(supabase: Supabase, orgId: string) {
    const eligible = await readEligibleLatestIds(supabase, orgId)
    if (eligible.error) return { data: [] as LoadedCosting[], error: eligible.error }
    return readCostings(supabase, orgId, eligible.ids)
}

/** The yarn rate a review is about, or the plain reason it cannot be propagated. */
async function readYarnRate(supabase: Supabase, orgId: string, rateId: string): Promise<{ rate?: YarnRate; error?: string }> {
    if (!UUID_PATTERN.test(rateId)) return { error: 'Rate identifier is invalid.' }
    const { data, error } = await supabase
        .from('cost_rate_book')
        .select('id, name, category, current_value, updated_at, is_active')
        .eq('id', rateId)
        .eq('org_id', orgId)
        .maybeSingle()
    if (error) return { error: error.message }
    if (!data) return { error: 'This rate no longer exists.' }
    if (data.is_active === false) return { error: 'This rate is archived.' }
    if (data.category !== 'yarn_warp' && data.category !== 'yarn_weft') return { error: 'Only yarn rates can be propagated.' }
    return {
        rate: {
            id: data.id,
            name: data.name,
            category: data.category,
            current_value: Number(data.current_value),
            updated_at: data.updated_at,
        },
    }
}

function savedPrice(row: CostingRow) {
    const productionCostPerM = Number(row.production_cost_per_meter)
    const sellingPricePerM = Number(row.quote_price_per_meter)
    return row.production_cost_per_meter != null && row.quote_price_per_meter != null
        && Number.isFinite(productionCostPerM) && Number.isFinite(sellingPricePerM)
        ? { productionCostPerM, sellingPricePerM }
        : null
}

/** How many costings each active yarn rate would re-cost: `{ [rateId]: count }`, zero counts omitted. */
export async function getYarnRatePropagationCounts(): Promise<{ data?: Record<string, number>; error?: string }> {
    const { profile } = await requireRole(['owner'])
    const tierError = await requireBaseTier(profile.org_id)
    if (tierError) return { error: tierError }
    const supabase = await createServerClient()

    const [ratesResult, costings] = await Promise.all([
        supabase
            .from('cost_rate_book')
            .select('id, name, category, current_value')
            .eq('org_id', profile.org_id)
            .eq('is_active', true)
            .in('category', ['yarn_warp', 'yarn_weft']),
        readEligibleCostings(supabase, profile.org_id),
    ])
    if (ratesResult.error) return { error: ratesResult.error.message }
    if (costings.error) return { error: costings.error }

    const counts: Record<string, number> = {}
    for (const rate of ratesResult.data ?? []) {
        const affected = costings.data.filter(({ estimate }) =>
            findAffectedLayers(estimate, rate.category as YarnCategory, rate.name, Number(rate.current_value)).length > 0).length
        if (affected > 0) counts[rate.id] = affected
    }
    return { data: counts }
}

/** The review: each affected costing with its cost before and after, and those that cannot be re-costed. */
export async function previewYarnRatePropagation(rateId: string): Promise<{
    data?: {
        rateUpdatedAt: string
        rateName: string
        rateValue: number
        category: YarnCategory
        items: PropagationPreviewItem[]
        skipped: PropagationSkipped[]
    }
    error?: string
}> {
    const { profile } = await requireRole(['owner'])
    const tierError = await requireBaseTier(profile.org_id)
    if (tierError) return { error: tierError }
    const supabase = await createServerClient()

    const { rate, error: rateError } = await readYarnRate(supabase, profile.org_id, rateId)
    if (!rate) return { error: rateError }
    const costings = await readEligibleCostings(supabase, profile.org_id)
    if (costings.error) return { error: costings.error }

    const items: PropagationPreviewItem[] = []
    const skipped: PropagationSkipped[] = []
    for (const { row, estimate } of costings.data) {
        const layers = findAffectedLayers(estimate, rate.category, rate.name, rate.current_value)
        if (layers.length === 0) continue
        // "Before" is the price Saved Costings shows for this version, so the review
        // matches what the owner sees there; it falls back to a recalculation.
        const before = savedPrice(row) ?? priceEstimate(estimate)
        const after = priceEstimate(applyYarnRate(estimate, rate.category, rate.name, rate.current_value))
        const qualityLabel = row.quality_label?.trim() || 'Costing'
        if (!before || !after) {
            skipped.push({ id: row.id, qualityLabel, reason: CANT_PRICE_REASON })
            continue
        }
        items.push({
            id: row.id,
            qualityLabel,
            partyName: row.party_name,
            versionNumber: Number(row.version_number ?? 1),
            updatedAt: row.updated_at,
            templateId: row.template_id,
            layers,
            before,
            after,
        })
    }
    return {
        data: {
            rateUpdatedAt: rate.updated_at,
            rateName: rate.name,
            rateValue: rate.current_value,
            category: rate.category,
            items,
            skipped,
        },
    }
}

/**
 * The requested costings that are still the latest, active version of their
 * lineage, rebuilt for saving. Anything else is stale: it was archived, edited
 * or superseded since the review. Checks only the requested lineages, so a
 * batch does not re-read the whole costing library.
 */
async function readStillEligibleCostings(supabase: Supabase, orgId: string, ids: readonly string[]) {
    const lineageColumns = 'id, costing_group_id, version_number, created_at, is_archived, template_id'
    const [requested, templates] = await Promise.all([
        supabase.from('estimator_quotes').select(lineageColumns).eq('org_id', orgId).eq('record_kind', 'costing').in('id', [...ids]),
        supabase.from('estimator_templates').select('id, updated_at').eq('org_id', orgId).eq('is_active', true),
    ])
    if (requested.error) return { error: requested.error.message }
    if (templates.error) return { error: templates.error.message }
    const requestedRows = (requested.data ?? []) as unknown as CostingLineageKey[]

    const groupIds = [...new Set(requestedRows.map(row => row.costing_group_id).filter((id): id is string => Boolean(id)))]
    let siblingRows: CostingLineageKey[] = []
    if (groupIds.length > 0) {
        const siblings = await supabase
            .from('estimator_quotes')
            .select(lineageColumns)
            .eq('org_id', orgId)
            .eq('record_kind', 'costing')
            .in('costing_group_id', groupIds)
        if (siblings.error) return { error: siblings.error.message }
        siblingRows = (siblings.data ?? []) as unknown as CostingLineageKey[]
    }

    const everyVersion = new Map<string, CostingLineageKey>()
    for (const row of [...requestedRows, ...siblingRows]) everyVersion.set(row.id, row)
    const latestIds = new Set(latestCostingPerLineage([...everyVersion.values()]).map(row => row.id))
    const templateUpdatedAt = new Map((templates.data ?? []).map(template => [template.id as string, template.updated_at as string]))
    const activeTemplateIds = new Set(templateUpdatedAt.keys())

    const stillEligible = requestedRows
        .filter(row => latestIds.has(row.id) && isCostingEligible(row, activeTemplateIds))
        .map(row => row.id)
    const costings = await readCostings(supabase, orgId, stillEligible)
    if (costings.error) return { error: costings.error }
    return { costings: new Map(costings.data.map(loaded => [loaded.row.id, loaded])), templateUpdatedAt }
}

/** A version this same request already saved, e.g. when the response was lost. */
async function findSavedVersion(supabase: Supabase, orgId: string, requestId: string) {
    const { data } = await supabase
        .from('estimator_quotes')
        .select('id, version_number')
        .eq('org_id', orgId)
        .eq('client_request_id', requestId)
        .maybeSingle()
    return data ? { quoteId: data.id as string, versionNumber: Number(data.version_number) } : null
}

/** A save error that ends the whole batch rather than one costing. */
function endsTheBatch(message: string) {
    return /locked|subscription|not authori[sz]ed|only an organization owner/i.test(message)
}

/**
 * Saves one costing's new version through saveEstimatorQuoteV3, the estimator's
 * own save, and records the outcome. Returns the batch's response when a save
 * error ends the whole batch (a locked org or a lapsed plan).
 */
async function saveNewVersion({ loaded, expectedUpdatedAt, nextEstimate, price, clientRequestId, templateUpdatedAt, outcomes }: {
    loaded: LoadedCosting
    expectedUpdatedAt: string
    nextEstimate: EstimateState
    price: { productionCostPerM: number; sellingPricePerM: number }
    clientRequestId: string
    templateUpdatedAt: Map<string, string>
    outcomes: PropagationOutcome[]
}): Promise<{ data: { outcomes: PropagationOutcome[] }; error: string } | null> {
    const { row } = loaded
    let result: Awaited<ReturnType<typeof saveEstimatorQuoteV3>>
    try {
        result = await saveEstimatorQuoteV3({
            clientRequestId,
            partyName: row.party_name,
            qualityLabel: row.quality_label?.trim() || 'Costing',
            warpInstruction: row.warp_instruction ?? undefined,
            weftInstruction: row.weft_instruction ?? undefined,
            estimate: nextEstimate,
            totalProductionCostPerM: price.productionCostPerM,
            quotePricePerM: price.sellingPricePerM,
            status: 'draft',
            recordKind: 'costing',
            sourceQuoteId: row.id,
            expectedSourceUpdatedAt: expectedUpdatedAt,
            templateId: row.template_id ?? undefined,
            expectedTemplateUpdatedAt: row.template_id ? templateUpdatedAt.get(row.template_id) : undefined,
            // Only yarn rates changed: the factory inputs are still the ones this version was costed with.
            factoryProfileUpdatedAt: row.factory_profile_updated_at ?? undefined,
        })
    } catch {
        outcomes.push({ id: row.id, status: 'failed', message: 'The new version could not be saved.' })
        return null
    }
    if (!result.success) {
        const message = result.error ?? 'The new version could not be saved.'
        if (endsTheBatch(message)) {
            if (outcomes.some(outcome => outcome.status === 'created')) {
                revalidatePath('/owner/quotes')
                revalidatePath('/owner/rates')
            }
            return { error: message, data: { outcomes } }
        }
        outcomes.push({ id: row.id, status: 'failed', message })
    } else if (result.noChange) {
        outcomes.push({ id: row.id, status: 'unchanged' })
    } else {
        outcomes.push({ id: row.id, status: 'created', versionNumber: result.versionNumber, quoteId: result.quoteId })
        // Every new version starts un-starred; keep the owner's favourites.
        if (row.is_favorite && result.quoteId && result.updatedAt && !result.idempotentReplay) {
            try {
                await updateSavedCostingLibraryState({ id: result.quoteId, expectedUpdatedAt: result.updatedAt, isFavorite: true })
            } catch {
                // The version is saved; a missing star is not worth failing it.
            }
        }
    }
    return null
}

/**
 * Saves a new version of up to PROPAGATION_BATCH_SIZE costings at the Rate
 * Book's current value for the yarn. The value is read here, never taken from
 * the caller, and the call is refused if the rate changed since the review.
 * Each costing goes through saveEstimatorQuoteV3, the estimator's own save, so
 * attestation, the fabric guard, version numbering, replay and the org lock
 * all apply; a repeated request replays instead of adding a version.
 */
export async function applyYarnRatePropagation(input: {
    rateId: string
    expectedRateUpdatedAt: string
    costings: { id: string; expectedUpdatedAt: string }[]
}): Promise<{ data?: { outcomes: PropagationOutcome[] }; error?: string }> {
    const requests = Array.isArray(input?.costings) ? input.costings : []
    if (requests.length === 0) return { error: 'Choose at least one costing to save.' }
    if (requests.length > PROPAGATION_BATCH_SIZE) return { error: 'Save fewer costings at a time.' }
    if (requests.some(request => !request?.id || !Number.isFinite(Date.parse(request.expectedUpdatedAt)))) {
        return { error: 'These costings could not be read. Reopen Propagate and try again.' }
    }
    if (!Number.isFinite(Date.parse(input.expectedRateUpdatedAt))) return { error: 'Reopen Propagate and try again.' }

    const { profile } = await requireRole(['owner'])
    const tierError = await requireBaseTier(profile.org_id)
    if (tierError) return { error: tierError }
    const supabase = await createServerClient()

    const { rate, error: rateError } = await readYarnRate(supabase, profile.org_id, input.rateId)
    if (!rate) return { error: rateError }
    if (Date.parse(rate.updated_at) !== Date.parse(input.expectedRateUpdatedAt)) {
        return { error: 'This rate changed since you opened the review. Reopen Propagate.' }
    }

    const current = await readStillEligibleCostings(supabase, profile.org_id, requests.map(request => request.id))
    if ('error' in current) return { error: current.error }

    const outcomes: PropagationOutcome[] = []
    for (const request of requests) {
        const loaded = current.costings.get(request.id)
        if (!loaded || Date.parse(loaded.row.updated_at) !== Date.parse(request.expectedUpdatedAt)) {
            // A save that already committed (lost response, double press) leaves this
            // costing superseded by the version it created; that is a success, not a change.
            const saved = await findSavedVersion(supabase, profile.org_id, buildPropagationRequestId(request.id, rate.id, rate.current_value))
            outcomes.push(saved
                ? { id: request.id, status: 'created', ...saved }
                : { id: request.id, status: 'stale', message: 'This costing changed since the review. Reopen Propagate.' })
            continue
        }
        const { row, estimate } = loaded
        if (findAffectedLayers(estimate, rate.category, rate.name, rate.current_value).length === 0) {
            outcomes.push({ id: request.id, status: 'unchanged' })
            continue
        }
        const nextEstimate = applyYarnRate(estimate, rate.category, rate.name, rate.current_value)
        const price = priceEstimate(nextEstimate)
        if (!price) {
            outcomes.push({ id: request.id, status: 'failed', message: CANT_PRICE_REASON })
            continue
        }

        const ended = await saveNewVersion({
            loaded,
            expectedUpdatedAt: request.expectedUpdatedAt,
            nextEstimate,
            price,
            clientRequestId: buildPropagationRequestId(row.id, rate.id, rate.current_value),
            templateUpdatedAt: current.templateUpdatedAt,
            outcomes,
        })
        if (ended) return ended
    }

    revalidatePath('/owner/quotes')
    revalidatePath('/owner/rates')
    return { data: { outcomes } }
}

/** The active warp and weft yarns of the Rate Book, and a key that changes whenever one of them does. */
async function readRateBookYarns(supabase: Supabase, orgId: string): Promise<{ yarns: (RateBookYarn & { id: string })[]; ratesKey: string; error?: string }> {
    const { data, error } = await supabase
        .from('cost_rate_book')
        .select('id, name, category, current_value, updated_at')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .in('category', ['yarn_warp', 'yarn_weft'])
    if (error) return { yarns: [], ratesKey: '', error: error.message }
    const rows = [...(data ?? [])].sort((left, right) => String(left.id).localeCompare(String(right.id)))
    return {
        yarns: rows.map(rate => ({ id: rate.id, name: rate.name, category: rate.category as YarnCategory, current_value: Number(rate.current_value) })),
        ratesKey: rows.map(rate => `${rate.id}@${Date.parse(rate.updated_at)}:${Number(rate.current_value)}`).join('|'),
    }
}

/**
 * Saved costings whose yarns cost something else in the Rate Book today: the
 * latest active version of each, with its cost as saved and at today's rates.
 * Read-only; the Saved Costings page shows it and its review saves from it.
 */
export async function getCostingsBehindRateBook(): Promise<{
    data?: { ratesKey: string; yarnCount: number; items: RateBookDriftItem[]; skipped: PropagationSkipped[] }
    error?: string
}> {
    const { profile } = await requireRole(['owner'])
    const tierError = await requireBaseTier(profile.org_id)
    if (tierError) return { error: tierError }
    const supabase = await createServerClient()

    const [rateBook, costings] = await Promise.all([
        readRateBookYarns(supabase, profile.org_id),
        readEligibleCostings(supabase, profile.org_id),
    ])
    if (rateBook.error) return { error: rateBook.error }
    if (costings.error) return { error: costings.error }

    const items: RateBookDriftItem[] = []
    const skipped: PropagationSkipped[] = []
    for (const { row, estimate } of costings.data) {
        const next = applyRateBookYarns(estimate, rateBook.yarns)
        if (next.changes.length === 0) continue
        const before = savedPrice(row) ?? priceEstimate(estimate)
        const after = priceEstimate(next.estimate)
        const qualityLabel = row.quality_label?.trim() || 'Costing'
        if (!before || !after) {
            skipped.push({ id: row.id, qualityLabel, reason: CANT_PRICE_REASON })
            continue
        }
        items.push({
            id: row.id,
            qualityLabel,
            partyName: row.party_name,
            versionNumber: Number(row.version_number ?? 1),
            updatedAt: row.updated_at,
            templateId: row.template_id,
            changes: next.changes,
            before,
            after,
        })
    }
    // The costings that lose the most first.
    items.sort((left, right) => (right.after.productionCostPerM - right.before.productionCostPerM) - (left.after.productionCostPerM - left.before.productionCostPerM))
    return { data: { ratesKey: rateBook.ratesKey, yarnCount: rateBook.yarns.length, items, skipped } }
}

/**
 * Saves a new version of up to PROPAGATION_BATCH_SIZE costings with every yarn
 * at the Rate Book's rate today. The rates are read here, never taken from the
 * caller, and the call is refused if any yarn rate changed since the review.
 */
export async function updateCostingsToRateBook(input: {
    ratesKey: string
    costings: { id: string; expectedUpdatedAt: string }[]
}): Promise<{ data?: { outcomes: PropagationOutcome[] }; error?: string }> {
    const requests = Array.isArray(input?.costings) ? input.costings : []
    if (requests.length === 0) return { error: 'Choose at least one costing to save.' }
    if (requests.length > PROPAGATION_BATCH_SIZE) return { error: 'Save fewer costings at a time.' }
    if (requests.some(request => !request?.id || !Number.isFinite(Date.parse(request.expectedUpdatedAt)))) {
        return { error: 'These costings could not be read. Reopen the review and try again.' }
    }

    const { profile } = await requireRole(['owner'])
    const tierError = await requireBaseTier(profile.org_id)
    if (tierError) return { error: tierError }
    const supabase = await createServerClient()

    const rateBook = await readRateBookYarns(supabase, profile.org_id)
    if (rateBook.error) return { error: rateBook.error }
    if (rateBook.ratesKey !== input.ratesKey) return { error: 'Yarn rates changed since you opened the review. Reopen it.' }

    const current = await readStillEligibleCostings(supabase, profile.org_id, requests.map(request => request.id))
    if ('error' in current) return { error: current.error }

    const outcomes: PropagationOutcome[] = []
    for (const request of requests) {
        const loaded = current.costings.get(request.id)
        if (!loaded || Date.parse(loaded.row.updated_at) !== Date.parse(request.expectedUpdatedAt)) {
            outcomes.push({ id: request.id, status: 'stale', message: 'This costing changed since the review. Reopen the review.' })
            continue
        }
        const next = applyRateBookYarns(loaded.estimate, rateBook.yarns)
        if (next.changes.length === 0) {
            outcomes.push({ id: request.id, status: 'unchanged' })
            continue
        }
        const price = priceEstimate(next.estimate)
        if (!price) {
            outcomes.push({ id: request.id, status: 'failed', message: CANT_PRICE_REASON })
            continue
        }
        const ended = await saveNewVersion({
            loaded,
            expectedUpdatedAt: request.expectedUpdatedAt,
            nextEstimate: next.estimate,
            price,
            clientRequestId: buildRateBookUpdateRequestId(loaded.row.id, next.changes),
            templateUpdatedAt: current.templateUpdatedAt,
            outcomes,
        })
        if (ended) return ended
    }

    revalidatePath('/owner/quotes')
    revalidatePath('/owner/rates')
    return { data: { outcomes } }
}
