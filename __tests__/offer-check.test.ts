import { describe, expect, it } from 'vitest'
import { buildCostingResult, calcFullTotals, makeDefaultEstimateState, type EstimateState } from '../lib/estimator'
import {
    buildOfferBase,
    evaluateOffer,
    findOfferCandidate,
    listOfferCandidates,
    offerSliderRange,
    parseOfferNumber,
    snapOfferToSlider,
    type OfferBase,
    type OfferCandidateRecord,
    type OfferSourceRow,
} from '../lib/offer-check'

/** A costing saved from the engine, the way a Lite owner's would be: the sample recipe, optionally reshaped. */
function savedCosting(change: (state: EstimateState) => void = () => {}, row: Partial<OfferSourceRow> = {}) {
    const state = makeDefaultEstimateState()
    state.warpRows = [{ ...state.warpRows[0], id: 'w', label: 'Warp 75D', calcDenier: 75, beamEnds: 3200, yarnRate: 120 }]
    state.weftRows = [{ ...state.weftRows[0], id: 'f', label: 'Weft 75D', calcDenier: 75, picks: 68, effectiveCostingWidthCm: 112, reedSpace: 112, yarnRate: 112 }]
    state.yarnShortagePct = 2
    state.warpCrimpPct = 5
    state.overheadMode = 'direct'
    state.overheadOverridePerM = 3
    state.profitPct = 12
    state.orderQuantityM = 1000
    state.isConfigured = true
    state.perPickCostPaisa = 0.12
    change(state)
    const result = buildCostingResult(state, calcFullTotals(state))
    const source: OfferSourceRow = {
        id: 'costing-1',
        quality_label: 'Fabric 75D',
        version_number: 2,
        created_at: '2026-10-01T06:00:00.000Z',
        snapshot_data: state,
        costing_result_snapshot: result,
        reconciliation_status: 'verified',
        meters: 1000,
        ...row,
    }
    return { state, result, source }
}

/** Round numbers, so every expected figure can be checked by hand. */
const BASE: OfferBase = {
    costingId: 'c',
    qualityLabel: 'Hand check',
    versionNumber: 1,
    savedAt: '2026-10-01T00:00:00.000Z',
    productionCostPerM: 10,
    transportPerM: 1,
    commissionPct: 5,
    breakEvenPricePerM: 11.58,
    sellingPricePerM: 13,
    targetMarginPct: 10,
    quantityM: 1000,
    stress: { available: false },
}

describe('offer check against a saved costing', () => {
    it('reads the costing it was saved with', () => {
        const { result, source } = savedCosting()
        const built = buildOfferBase(source)
        expect(built.ok).toBe(true)
        if (!built.ok) return
        expect(built.base).toMatchObject({
            costingId: 'costing-1',
            versionNumber: 2,
            productionCostPerM: result.productionCostPerM,
            transportPerM: result.transportPerM,
            commissionPct: result.commissionPct,
            breakEvenPricePerM: result.breakEvenPricePerM,
            sellingPricePerM: result.suggestedSellingPricePerM,
            targetMarginPct: 12,
            quantityM: 1000,
        })
    })

    it('gives the costing its own profit when the offer is its own selling price', () => {
        for (const change of [
            () => {},
            (state: EstimateState) => { state.commissionPct = 2; state.transportPerM = 0.5; state.profitPct = 9 },
            (state: EstimateState) => { state.commissionPct = 1.5; state.profitPct = 14; state.orderQuantityM = 2500 },
        ]) {
            const { result, source } = savedCosting(change)
            const built = buildOfferBase(source)
            if (!built.ok) throw new Error('expected a usable costing')
            const evaluation = evaluateOffer(built.base, result.suggestedSellingPricePerM, result.quantityM)
            expect(Math.abs(evaluation.profitPerM - result.profitPerM)).toBeLessThanOrEqual(0.01)
            expect(Math.abs((evaluation.order?.profit ?? 0) - (result.expectedProfitTotal ?? 0))).toBeLessThanOrEqual(0.01 * (result.quantityM ?? 1))
            expect(evaluation.marginPct).toBeCloseTo(result.actualMarginPct, 1)
            expect(evaluation.verdict).toBe('at_or_above_price')
            expect(evaluation.versusPrice.differencePerM).toBe(0)
        }
    })

    it('takes commission from the buyer price, not from the cost', () => {
        const evaluation = evaluateOffer(BASE, 14, null)
        // 14 − 10 cost − 1 transport − 0.70 commission (5% of 14)
        expect(evaluation).toMatchObject({ offerPerM: 14, commissionPerM: 0.7, landedCostPerM: 11.7, profitPerM: 2.3 })
        // Margin is the share of the offer you keep: 2.30 ÷ 14.
        expect(evaluation.marginPct).toBeCloseTo(16.43, 2)
    })

    it('adds the lines up exactly as they are shown', () => {
        for (const offer of [11.37, 12.01, 13.33, 17.77, 9.99]) {
            const { offerPerM, costPerM, transportPerM, commissionPerM, profitPerM } = evaluateOffer(BASE, offer, null)
            expect(Math.round((offerPerM - costPerM - transportPerM - commissionPerM) * 100)).toBe(Math.round(profitPerM * 100))
        }
    })

    it('calls an offer below break-even a loss, on every metre and on the order', () => {
        const evaluation = evaluateOffer(BASE, 10, 2000)
        expect(evaluation.profitPerM).toBe(-1.5)
        expect(evaluation.verdict).toBe('loss')
        expect(evaluation.marginPct).toBe(-15)
        expect(evaluation.order).toEqual({ quantityM: 2000, value: 20000, cost: 23000, profit: -3000 })
    })

    it('finds break-even at the break-even price and tells the three zones apart', () => {
        expect(evaluateOffer(BASE, 11.58, null)).toMatchObject({ profitPerM: 0, verdict: 'break_even' })
        expect(evaluateOffer(BASE, 12.5, null).verdict).toBe('below_price')
        expect(evaluateOffer(BASE, 13, null).verdict).toBe('at_or_above_price')
        expect(evaluateOffer(BASE, 14, null).verdict).toBe('at_or_above_price')
    })

    it('measures the offer against the costing price and against break-even', () => {
        const evaluation = evaluateOffer(BASE, 12.4, null)
        expect(evaluation.versusPrice).toEqual({ differencePerM: -0.6, differencePct: -4.62 })
        expect(evaluation.versusBreakEven.differencePerM).toBe(0.82)
    })

    it('prices the whole order from the quantity, and only with one', () => {
        expect(evaluateOffer(BASE, 14, null).order).toBeNull()
        expect(evaluateOffer(BASE, 14, 0).order).toBeNull()
        expect(evaluateOffer(BASE, 14, 5000).order).toEqual({ quantityM: 5000, value: 70000, cost: 58500, profit: 11500 })
    })

    it('does not use a costing that was never checked or kept no result', () => {
        expect(buildOfferBase(savedCosting(() => {}, { costing_result_snapshot: null }).source)).toEqual({ ok: false, reason: 'not_checked' })
        expect(buildOfferBase(savedCosting(() => {}, { reconciliation_status: 'needs_review' }).source)).toEqual({ ok: false, reason: 'not_checked' })
        expect(buildOfferBase(savedCosting(() => {}, { reconciliation_status: 'legacy' }).source)).toEqual({ ok: false, reason: 'not_checked' })
        expect(buildOfferBase(savedCosting(() => {}, { costing_result_snapshot: { productionCostPerM: 0 } }).source)).toEqual({ ok: false, reason: 'not_checked' })
    })
})

describe('what-if rows', () => {
    it('raises the cost of a costing when yarn goes up 10%', () => {
        const built = buildOfferBase(savedCosting().source)
        if (!built.ok || !built.base.stress.available) throw new Error('expected what-ifs')
        const yarn = built.base.stress.cases.find(item => item.id === 'yarn-up-10')!
        expect(yarn.costChangePerM).toBeGreaterThan(0)
        expect(yarn.productionCostPerM).toBeCloseTo(built.base.productionCostPerM + yarn.costChangePerM, 2)
        // Yarn is most of the cost, so +10% on it is a few per cent of the whole.
        expect(yarn.costChangePerM / built.base.productionCostPerM).toBeGreaterThan(0.02)
        expect(yarn.costChangePerM / built.base.productionCostPerM).toBeLessThan(0.1)
    })

    it('leaves a fixed factory rate alone when output drops, and says so', () => {
        const built = buildOfferBase(savedCosting().source)
        if (!built.ok || !built.base.stress.available) throw new Error('expected what-ifs')
        expect(built.base.stress.cases.find(item => item.id === 'output-down-15')).toMatchObject({ costChangePerM: 0 })
        expect(built.base.stress.fixedOverheadPerM).toBe(3)
    })

    it('raises the cost when output drops and overhead is shared across monthly output', () => {
        const built = buildOfferBase(savedCosting(state => {
            state.overheadMode = 'monthly_expenses'
            state.overheadOverridePerM = null
            state.monthlyOutputM = 20000
            state.loomCount = 10
            state.monthlyWorkingDays = 26
            state.avgOutputPerLoomPerDay = 100
            state.overheadItems = state.overheadItems.map((item, index) => (index === 0 ? { ...item, monthlyAmount: 80000 } : item))
        }).source)
        if (!built.ok || !built.base.stress.available) throw new Error('expected what-ifs')
        const output = built.base.stress.cases.find(item => item.id === 'output-down-15')!
        expect(built.base.stress.fixedOverheadPerM).toBeNull()
        // ₹80,000 over 20,000 m is ₹4.00 a metre; over 17,000 m it is about ₹4.71.
        expect(output.costChangePerM).toBeCloseTo(0.71, 1)
    })

    it('shows what the same offer earns when the cost moves', () => {
        const built = buildOfferBase(savedCosting().source)
        if (!built.ok) throw new Error('expected a usable costing')
        const evaluation = evaluateOffer(built.base, built.base.sellingPricePerM, 1000)
        const yarn = evaluation.stress.find(item => item.id === 'yarn-up-10')!
        expect(yarn.profitPerM).toBeCloseTo(evaluation.profitPerM - yarn.costChangePerM, 2)
        expect(yarn.marginPct).toBeLessThan(evaluation.marginPct)
        expect(yarn.orderProfit).toBeCloseTo(yarn.profitPerM * 1000, 0)
    })

    it('shows no what-ifs when the saved inputs no longer reproduce the saved cost', () => {
        const { source } = savedCosting()
        const drifted = { ...source, snapshot_data: { ...source.snapshot_data, yarnShortagePct: 9 } }
        const built = buildOfferBase(drifted)
        expect(built.ok && built.base.stress).toEqual({ available: false })
        // The answer itself still comes from the saved numbers.
        expect(built.ok && evaluateOffer(built.base, 20, null).profitPerM).toBeGreaterThan(0)
    })
})

describe('typed numbers', () => {
    it('accepts prices and quantities the way an owner types them', () => {
        expect(parseOfferNumber('19.5', 1000)).toEqual({ status: 'ok', value: 19.5 })
        expect(parseOfferNumber(' 5,000 ', 1e8)).toEqual({ status: 'ok', value: 5000 })
        expect(parseOfferNumber('.75', 1000)).toEqual({ status: 'ok', value: 0.75 })
        expect(parseOfferNumber('20.', 1000)).toEqual({ status: 'ok', value: 20 })
    })

    it('treats nothing typed as empty and everything else unusable as invalid', () => {
        expect(parseOfferNumber('', 1000)).toEqual({ status: 'empty' })
        expect(parseOfferNumber('   ', 1000)).toEqual({ status: 'empty' })
        for (const text of ['0', '0.00', '-5', 'abc', '1.2.3', '12abc', '1e3', '₹20', '1001']) {
            expect(parseOfferNumber(text, 1000), text).toEqual({ status: 'invalid' })
        }
    })

    it('keeps the slider around the conversation and on the grid', () => {
        const range = offerSliderRange({ breakEvenPricePerM: 17.44, sellingPricePerM: 19.82 })
        expect(range.min).toBeLessThan(17.44)
        expect(range.max).toBeGreaterThan(19.82)
        expect(range.step).toBe(0.05)
        expect(snapOfferToSlider(19.82, range)).toBe(19.8)
        expect(snapOfferToSlider(1, range)).toBe(range.min)
        expect(snapOfferToSlider(999, range)).toBe(range.max)
        expect(snapOfferToSlider(Number.NaN, range)).toBe(range.min)
    })
})

describe('qualities to check an offer against', () => {
    const record = (id: string, change: Partial<OfferCandidateRecord> = {}): OfferCandidateRecord => ({
        id,
        quality_label: 'Fabric 75D',
        template_id: 't1',
        version_number: 1,
        created_at: '2026-10-01T06:00:00.000Z',
        updated_at: '2026-10-01T06:00:00.000Z',
        is_archived: false,
        record_kind: 'costing',
        quote_price_per_meter: 19.82,
        production_cost_per_meter: 17.44,
        reconciliation_status: 'verified',
        ...change,
    })
    const templates = [{ id: 't1', name: 'Fabric 75D', is_active: true }, { id: 't2', name: 'Satin 60D', is_active: true }, { id: 't3', name: 'Old quality', is_active: false }]

    it('lists each quality once, at its latest version', () => {
        const list = listOfferCandidates([
            record('a1'),
            record('a2', { version_number: 2, created_at: '2026-10-05T06:00:00.000Z', updated_at: '2026-10-05T06:00:00.000Z', quote_price_per_meter: 21 }),
            record('b1', { template_id: 't2', quality_label: 'Satin 60D' }),
        ], templates)
        expect(list.map(item => [item.name, item.latestId, item.versionNumber])).toEqual([
            ['Fabric 75D', 'a2', 2],
            ['Satin 60D', 'b1', 1],
        ])
        expect(list[0].sellingPricePerM).toBe(21)
    })

    it('leaves out archived costings, archived qualities and production runs', () => {
        const list = listOfferCandidates([
            record('a1', { is_archived: true }),
            record('c1', { template_id: 't3', quality_label: 'Old quality' }),
            record('d1', { template_id: 't2', quality_label: 'Satin 60D', record_kind: 'market_run' }),
        ], templates)
        expect(list).toEqual([])
    })

    it('uses the older unarchived version when the newest one is archived', () => {
        const list = listOfferCandidates([record('a1'), record('a2', { version_number: 2, is_archived: true })], templates)
        expect(list.map(item => item.latestId)).toEqual(['a1'])
    })

    it('groups a costing saved without a quality by its name, as the cards do', () => {
        const list = listOfferCandidates([
            record('x1', { template_id: null, quality_label: ' Poplin  40s ' }),
            record('x2', { template_id: null, quality_label: 'poplin 40s', version_number: 2 }),
        ], [])
        expect(list).toHaveLength(1)
        expect(list[0].latestId).toBe('x2')
    })

    it('marks a costing that kept no cost, or was not checked, as needing a recalculation', () => {
        const [first] = listOfferCandidates([record('a1', { production_cost_per_meter: null })], templates)
        expect(first.checkable).toBe(false)
        const [second] = listOfferCandidates([record('a1', { reconciliation_status: 'needs_review' })], templates)
        expect(second.checkable).toBe(false)
        expect(listOfferCandidates([record('a1')], templates)[0].checkable).toBe(true)
    })

    it('finds a quality from the link to any of its versions', () => {
        const list = listOfferCandidates([record('a1'), record('a2', { version_number: 2 })], templates)
        expect(findOfferCandidate(list, 'a1')?.latestId).toBe('a2')
        expect(findOfferCandidate(list, 'a2')?.latestId).toBe('a2')
        expect(findOfferCandidate(list, 'missing')).toBeNull()
        expect(findOfferCandidate(list, undefined)).toBeNull()
    })

    it('puts the most recently saved quality first', () => {
        const list = listOfferCandidates([
            record('a1'),
            record('b1', { template_id: 't2', quality_label: 'Satin 60D', updated_at: '2026-10-09T06:00:00.000Z' }),
        ], templates)
        expect(list.map(item => item.name)).toEqual(['Satin 60D', 'Fabric 75D'])
    })
})
