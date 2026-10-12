import Decimal from 'decimal.js'
import {
    calcFullTotals,
    normalizeCurrencySnapshot,
    parseCostingResultSnapshot,
    runScenarios,
    type CostingResultSnapshot,
} from './estimator'
import { evaluateMarginAdjustment } from './costing-margin'
import {
    buildDraftStateFromQuote,
    isSavedCostingArchived,
    type SavedCostingStateRow,
} from './saved-costings'

/**
 * "The trader offers ₹X. Can I take it?" for one saved costing.
 *
 * Everything starts from the numbers the costing was saved with: its cost per
 * metre, transport, commission and break-even. Commission is a share of the
 * SELLING price (the buyer's price here), and margin is the share of the selling
 * price you keep, exactly as in the Saved Costings breakdown. At the costing's
 * own selling price the answer is therefore the costing's own profit.
 *
 * The what-if rows reuse the yarn +10% and output -15% cases of `runScenarios`.
 * They need the full recipe, so they are offered only when the saved inputs
 * reproduce the saved cost (the same test the margin slider applies).
 */

export const OFFER_PRICE_MAX = 100_000
export const OFFER_QUANTITY_MAX = 100_000_000

export type OfferStressId = 'yarn-up-10' | 'output-down-15'

export type OfferStressCase = {
    id: OfferStressId
    /** Cost per metre if this happened, anchored on the saved cost. */
    productionCostPerM: number
    /** What the case adds to the saved cost per metre; 0 when it does not move this costing. */
    costChangePerM: number
}

export type OfferStress =
    | { available: true; cases: OfferStressCase[]; fixedOverheadPerM: number | null }
    | { available: false }

export type OfferBase = {
    costingId: string
    qualityLabel: string
    versionNumber: number
    savedAt: string
    productionCostPerM: number
    transportPerM: number
    commissionPct: number
    breakEvenPricePerM: number
    sellingPricePerM: number
    targetMarginPct: number
    /** Metres the costing was made for, offered as a one-tap quantity. */
    quantityM: number | null
    stress: OfferStress
}

/** The columns of a saved costing (full detail read) that the check needs. */
export type OfferSourceRow = SavedCostingStateRow & {
    id: string
    quality_label: string | null
    version_number?: number | null
    created_at: string
    costing_result_snapshot?: unknown
    reconciliation_status?: string | null
}

export type OfferBaseResult =
    | { ok: true; base: OfferBase }
    /** No stored result, or one that has not been checked: the owner recalculates it first. */
    | { ok: false; reason: 'not_checked' }

const STRESS_IDS: readonly OfferStressId[] = ['yarn-up-10', 'output-down-15']

function buildStress(row: OfferSourceRow, saved: CostingResultSnapshot): OfferStress {
    const estimate = buildDraftStateFromQuote(row)
    if (!evaluateMarginAdjustment(estimate, saved).adjustable) return { available: false }
    const scenarios = new Map(runScenarios(estimate, calcFullTotals(estimate)).map(scenario => [scenario.id, scenario]))
    const cases = STRESS_IDS.flatMap((id): OfferStressCase[] => {
        const scenario = scenarios.get(id)
        if (!scenario) return []
        const moved = Math.abs(scenario.costDelta) >= 0.005
        const costChangePerM = moved ? normalizeCurrencySnapshot(scenario.costDelta) : 0
        return [{ id, productionCostPerM: normalizeCurrencySnapshot(saved.productionCostPerM + costChangePerM), costChangePerM }]
    })
    return { available: true, cases, fixedOverheadPerM: saved.overheadMode === 'direct' ? saved.overheadPerM : null }
}

/**
 * The saved costing as the starting point of an offer check. Only a costing that
 * kept its result and was checked when it was saved can be used: an older one
 * would have to guess its cost, and the check must never do that.
 */
export function buildOfferBase(row: OfferSourceRow): OfferBaseResult {
    const saved = parseCostingResultSnapshot(row.costing_result_snapshot)
    if (
        !saved
        || (row.reconciliation_status ?? 'verified') !== 'verified'
        || !saved.quoteIsValid
        || !(saved.productionCostPerM > 0)
        || !(saved.suggestedSellingPricePerM > 0)
    ) {
        return { ok: false, reason: 'not_checked' }
    }
    return {
        ok: true,
        base: {
            costingId: row.id,
            qualityLabel: row.quality_label ?? '',
            versionNumber: Number(row.version_number ?? 1),
            savedAt: row.created_at,
            productionCostPerM: saved.productionCostPerM,
            transportPerM: saved.transportPerM,
            commissionPct: saved.commissionPct,
            breakEvenPricePerM: saved.breakEvenPricePerM,
            sellingPricePerM: saved.suggestedSellingPricePerM,
            targetMarginPct: saved.targetMarginPct,
            quantityM: saved.quantityM,
            stress: buildStress(row, saved),
        },
    }
}

export type OfferVerdict = 'loss' | 'break_even' | 'below_price' | 'at_or_above_price'

export type OfferStressEvaluation = OfferStressCase & {
    profitPerM: number
    marginPct: number
    /** Profit on the whole order under this case; null without a quantity. */
    orderProfit: number | null
}

export type OfferEvaluation = {
    offerPerM: number
    costPerM: number
    transportPerM: number
    commissionPerM: number
    landedCostPerM: number
    profitPerM: number
    /** Share of the offer you keep, in per cent. */
    marginPct: number
    verdict: OfferVerdict
    /** Offer minus the costing's selling price, in rupees and as a share of that price. */
    versusPrice: { differencePerM: number; differencePct: number }
    /** Offer minus the break-even price. */
    versusBreakEven: { differencePerM: number; differencePct: number }
    order: { quantityM: number; value: number; cost: number; profit: number } | null
    stress: OfferStressEvaluation[]
}

function marginOf(profit: Decimal.Value, offer: Decimal.Value): number {
    const price = new Decimal(offer)
    return price.gt(0) ? normalizeCurrencySnapshot(new Decimal(profit).div(price).times(100)) : 0
}

function shareOf(difference: Decimal.Value, reference: Decimal.Value): number {
    const base = new Decimal(reference)
    return base.gt(0) ? normalizeCurrencySnapshot(new Decimal(difference).div(base).times(100)) : 0
}

/**
 * What the offer leaves you with. Figures are rounded to the paisa the way a
 * saved costing rounds them, and the profit is taken from the rounded cost lines
 * so that the lines shown always add up.
 */
export function evaluateOffer(base: OfferBase, offerPerM: number, quantityM: number | null): OfferEvaluation {
    const offer = normalizeCurrencySnapshot(offerPerM)
    const commissionPerM = normalizeCurrencySnapshot(new Decimal(offer).times(base.commissionPct).div(100))
    const costLines = new Decimal(base.productionCostPerM).plus(base.transportPerM).plus(commissionPerM)
    const landedCostPerM = normalizeCurrencySnapshot(costLines)
    const profitPerM = normalizeCurrencySnapshot(new Decimal(offer).minus(landedCostPerM))
    const quantity = quantityM != null && Number.isFinite(quantityM) && quantityM > 0 ? quantityM : null

    const orderProfitFor = (landedPerM: number) => {
        if (quantity == null) return null
        const value = normalizeCurrencySnapshot(new Decimal(offer).times(quantity))
        const cost = normalizeCurrencySnapshot(new Decimal(landedPerM).times(quantity))
        return { quantityM: quantity, value, cost, profit: normalizeCurrencySnapshot(new Decimal(value).minus(cost)) }
    }

    const order = orderProfitFor(landedCostPerM)
    const verdict: OfferVerdict = profitPerM < 0
        ? 'loss'
        : profitPerM === 0
            ? 'break_even'
            : offer < base.sellingPricePerM ? 'below_price' : 'at_or_above_price'
    const againstPrice = normalizeCurrencySnapshot(new Decimal(offer).minus(base.sellingPricePerM))
    const againstBreakEven = normalizeCurrencySnapshot(new Decimal(offer).minus(base.breakEvenPricePerM))

    const stress = base.stress.available
        ? base.stress.cases.map((stressCase): OfferStressEvaluation => {
            const landed = normalizeCurrencySnapshot(new Decimal(stressCase.productionCostPerM).plus(base.transportPerM).plus(commissionPerM))
            const profit = normalizeCurrencySnapshot(new Decimal(offer).minus(landed))
            return {
                ...stressCase,
                profitPerM: profit,
                marginPct: marginOf(profit, offer),
                orderProfit: orderProfitFor(landed)?.profit ?? null,
            }
        })
        : []

    return {
        offerPerM: offer,
        costPerM: base.productionCostPerM,
        transportPerM: base.transportPerM,
        commissionPerM,
        landedCostPerM,
        profitPerM,
        marginPct: marginOf(profitPerM, offer),
        verdict,
        versusPrice: { differencePerM: againstPrice, differencePct: shareOf(againstPrice, base.sellingPricePerM) },
        versusBreakEven: { differencePerM: againstBreakEven, differencePct: shareOf(againstBreakEven, base.breakEvenPricePerM) },
        order,
        stress,
    }
}

export type ParsedOfferNumber =
    | { status: 'empty' }
    | { status: 'invalid' }
    | { status: 'ok'; value: number }

/**
 * A price or a quantity typed by the owner. Commas are thousands separators
 * (5,000), the point is the decimal mark, and zero or an absurd figure is not
 * an answer the check can work with.
 */
export function parseOfferNumber(text: string, max: number): ParsedOfferNumber {
    const cleaned = text.replace(/[\s,]/g, '')
    if (!cleaned) return { status: 'empty' }
    if (!/^(\d+\.?\d*|\.\d+)$/.test(cleaned)) return { status: 'invalid' }
    const value = Number(cleaned)
    return Number.isFinite(value) && value > 0 && value <= max ? { status: 'ok', value } : { status: 'invalid' }
}

const SLIDER_STEP = 0.05

/**
 * The slider's span: from a little under break-even to a little over the costing's
 * own price, so the whole conversation with a trader sits inside it.
 */
export function offerSliderRange(base: Pick<OfferBase, 'breakEvenPricePerM' | 'sellingPricePerM'>) {
    const low = Math.min(base.breakEvenPricePerM, base.sellingPricePerM)
    const high = Math.max(base.breakEvenPricePerM, base.sellingPricePerM)
    const min = Math.max(SLIDER_STEP, Math.floor((low * 0.9) / SLIDER_STEP) * SLIDER_STEP)
    const max = Math.ceil((high * 1.15) / SLIDER_STEP) * SLIDER_STEP
    return { min: normalizeCurrencySnapshot(min), max: normalizeCurrencySnapshot(Math.max(max, min + SLIDER_STEP)), step: SLIDER_STEP }
}

/** The slider position (a multiple of the step inside the range) nearest a price. */
export function snapOfferToSlider(price: number, range: ReturnType<typeof offerSliderRange>) {
    if (!Number.isFinite(price)) return range.min
    const snapped = Math.round(price / range.step) * range.step
    return normalizeCurrencySnapshot(Math.min(range.max, Math.max(range.min, snapped)))
}

export type OfferCandidateRecord = {
    id: string
    quality_label: string | null
    template_id?: string | null
    version_number?: number | null
    created_at: string
    updated_at: string
    is_archived?: boolean | null
    record_kind?: string | null
    quote_price_per_meter: number | string | null
    production_cost_per_meter?: number | string | null
    reconciliation_status?: string | null
}

export type OfferCandidateTemplate = { id: string; name: string; is_active?: boolean | null }

export type OfferCandidate = {
    key: string
    /** Empty when the costing was saved without a quality name. */
    name: string
    /** The latest version of the quality: the costing the check starts from. */
    latestId: string
    /** Every unarchived version of the quality, so a link to any of them finds this one. */
    recordIds: string[]
    versionNumber: number
    savedAt: string
    updatedAt: string
    sellingPricePerM: number | null
    /** False for a costing saved before cost and margin were kept, or not yet checked. */
    checkable: boolean
}

function qualityKey(value: string | null | undefined) {
    return (value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN')
}

function positiveOrNull(value: unknown) {
    const parsed = Number(value)
    return value !== null && value !== undefined && value !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/**
 * The qualities an offer can be checked against: the Saved Costings cards,
 * minus archived ones, each at its latest version. Grouped the way the cards are
 * (a saved quality first, then the quality name), so the list matches the page.
 */
export function listOfferCandidates(records: readonly OfferCandidateRecord[], templates: readonly OfferCandidateTemplate[]): OfferCandidate[] {
    const templateById = new Map(templates.map(template => [template.id, template]))
    const activeTemplates = templates.filter(template => template.is_active !== false)
    const labelIndex = new Map(activeTemplates.map(template => [qualityKey(template.name), `template:${template.id}`]))
    const groups = new Map<string, { name: string; records: OfferCandidateRecord[] }>()

    for (const record of records) {
        if (record.record_kind === 'market_run') continue
        const template = record.template_id ? templateById.get(record.template_id) : null
        if (isSavedCostingArchived(record, template)) continue
        const label = qualityKey(record.quality_label)
        const templateKey = record.template_id && template && template.is_active !== false ? `template:${record.template_id}` : null
        const key = templateKey ?? labelIndex.get(label) ?? `label:${label || record.id}`
        const group = groups.get(key)
        if (group) group.records.push(record)
        else groups.set(key, { name: (templateKey && template?.name) || record.quality_label || '', records: [record] })
    }

    return [...groups.entries()]
        .map(([key, group]): OfferCandidate => {
            const latest = [...group.records].sort((left, right) => (
                Number(right.version_number ?? 1) - Number(left.version_number ?? 1)
                || Date.parse(right.created_at) - Date.parse(left.created_at)
                || right.id.localeCompare(left.id)
            ))[0]
            return {
                key,
                name: group.name,
                latestId: latest.id,
                recordIds: group.records.map(record => record.id),
                versionNumber: Number(latest.version_number ?? 1),
                savedAt: latest.created_at,
                updatedAt: group.records.reduce((newest, record) => (Date.parse(record.updated_at) > Date.parse(newest) ? record.updated_at : newest), latest.updated_at),
                sellingPricePerM: positiveOrNull(latest.quote_price_per_meter),
                checkable: (latest.reconciliation_status ?? 'verified') === 'verified' && positiveOrNull(latest.production_cost_per_meter) != null,
            }
        })
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || left.name.localeCompare(right.name, 'en-IN'))
}

/** The candidate that holds a given saved costing, whichever of its versions the link named. */
export function findOfferCandidate(candidates: readonly OfferCandidate[], costingId: string | null | undefined) {
    return costingId ? candidates.find(candidate => candidate.recordIds.includes(costingId)) ?? null : null
}
