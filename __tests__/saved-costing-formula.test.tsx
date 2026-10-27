import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SavedCostingFormula } from '@/components/estimator/SavedCostingFormula'
import { buildCostingResult, calcFullTotals, makeDefaultEstimateState, type EstimateState } from '@/lib/estimator'
import { I18nContext } from '@/lib/i18n/context'
import { savedCostingFormulaText } from '@/lib/i18n/saved-costing-formula'
import { buildSavedCostingFormula, sellingPriceFormula } from '@/lib/saved-costing-formula'

function savedCosting(edit: (state: EstimateState) => EstimateState) {
    const state = edit(makeDefaultEstimateState())
    return { state, result: buildCostingResult(state, calcFullTotals(state)) }
}

/** 75D warp of 5,200 ends at ₹150 and a 150D weft at 60 PPI over 46 inches, as Surat costs a poplin. */
const poplin = (base: EstimateState): EstimateState => ({
    ...base,
    warpRows: [{ ...base.warpRows[0], label: 'ZZ 75/36 FDY', calcDenier: 75, beamEnds: 5200, yarnRate: 150, gstPct: 0, shortagePct: null, crimpPct: null }],
    weftRows: [{ ...base.weftRows[0], label: 'Weft 1', calcDenier: 150, picks: 60, reedSpace: 116.84, effectiveCostingWidthCm: 116.84, yarnRate: 140, gstPct: 5, shortagePct: null, pickRatio: null }],
    perPickCostPaisa: 0.125,
    yarnShortagePct: 3,
    warpCrimpPct: 5,
    overheadMode: 'direct',
    overheadOverridePerM: 4,
    profitPct: 10,
    orderQuantityM: 8000,
})

function renderHtml(formula: ReturnType<typeof buildSavedCostingFormula>, language: 'en' | 'hi' | 'gu' = 'en') {
    const value = {
        language,
        setLanguage: async () => ({ ok: true as const, language }),
        languageStatus: 'ready' as const,
        pendingLanguage: null,
        languageError: null,
        t: (key: string) => key,
        tx: (text: string) => text,
    }
    return renderToStaticMarkup(createElement(I18nContext.Provider, { value }, createElement(SavedCostingFormula, { formula })))
}

/** The text a reader sees. */
const render = (...args: Parameters<typeof renderHtml>) => renderHtml(...args).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ')

describe('saved costing worksheet', () => {
    it('weighs and prices each yarn layer from its saved inputs', () => {
        const { state, result } = savedCosting(poplin)
        const formula = buildSavedCostingFormula(result, state)
        const [warp, weft] = formula.layers

        expect(warp).toMatchObject({ system: 'warp', position: 1, name: 'ZZ 75/36 FDY', ratePerKg: 150, costFromRate: true, wastePct: 3, crimpPct: 5 })
        expect(warp.weight).toMatchObject({ mode: 'formula', denier: 75, ends: 5200, countNe: null })
        expect(warp.weight.kgPer100m).toBeCloseTo(75 * 5200 * 100 / 9_000_000, 9)
        expect(warp.baseCostPerM).toBeCloseTo(6.5, 9)
        // The estimator's default "Weft 1" is not a name of its own.
        expect(weft).toMatchObject({ system: 'weft', position: 1, name: null, gstPct: 5, costFromRate: true, crimpPct: 0 })
        expect(weft.weight).toMatchObject({ mode: 'formula', picks: 60, lengthM: 100 })
        if (weft.weight.mode === 'formula') expect(weft.weight.widthInches).toBeCloseTo(46, 9)

        // Warp carries crimp and weft does not, so wastage is shown per layer.
        expect(formula.sharedAllowance).toBeNull()
        expect(formula.yarnBasePerM).toBeCloseTo(warp.baseCostPerM + weft.baseCostPerM, 9)
        expect(formula.allowancePerM).toBeCloseTo(warp.allowancePerM + weft.allowancePerM, 9)
        expect(formula.weaving).toEqual({ perM: result.breakdown.weaveCostPerM, picks: 60, paisePerPick: 12.5 })
        expect(formula.warpingSizing).toMatchObject({ perM: 0, inHouse: true })
        expect(formula.overhead).toEqual({ perM: 4, monthlyTotal: null, monthlyOutputM: null })
        expect(formula.productionCostPerM).toBe(result.productionCostPerM)
    })

    it('shows the formula with its inputs in the order an owner works it', () => {
        const { state, result } = savedCosting(poplin)
        const text = render(buildSavedCostingFormula(result, state))

        expect(text).toContain('Warp 1ZZ 75/36 FDY75D × 5,200 ends × 100 ÷ 9000000=4.333 kg/100 m')
        expect(text).toContain('4.333 kg × ₹150/kg ÷ 100=₹6.50/m')
        expect(text).toContain('150D × 60 PPI × 46″ × 100 ÷ 9000000')
        expect(text).toContain('× (1 + 5% GST) ÷ 100')
        expect(text).toContain('₹6.50 × (3% waste + 5% crimp)')
        expect(text).toContain('60 PPI × 12.5 paise/pick=₹7.50/m')
        expect(text).toContain(`Production cost`)
        expect(text).toContain(`=₹${result.productionCostPerM.toFixed(2)}/m`)
        expect(text.indexOf('Warp 1')).toBeLessThan(text.indexOf('Wastage & crimp'))
        expect(text.indexOf('Wastage & crimp')).toBeLessThan(text.indexOf('Weaving'))
        expect(text.indexOf('Weaving')).toBeLessThan(text.indexOf('Factory expenses'))
    })

    it('colours each kind of input the same in every step', () => {
        const { state, result } = savedCosting(poplin)
        const html = renderHtml(buildSavedCostingFormula(result, state))
        const pill = (kind: string, text: string) => new RegExp(`data-formula-input="${kind}"[^>]*>${text}<`, 'g')
        expect(html).toMatch(pill('count', '75D'))
        expect(html).toMatch(pill('ends', '5,200 ends'))
        expect(html).toMatch(pill('width', '46″'))
        // PPI keeps its colour in the weft's weight and in weaving.
        expect(html.match(pill('picks', '60 PPI'))).toHaveLength(2)
        expect(html).toMatch(pill('rate', '₹150/kg'))
        expect(html).toMatch(pill('rate', '12.5 paise/pick'))
        expect(html).toMatch(pill('percent', '5% GST'))
        expect(html).toMatch(pill('percent', '3% waste'))
        const css = readFileSync('app/globals.css', 'utf8')
        for (const kind of ['count', 'ends', 'picks', 'width', 'rate', 'percent']) expect(css).toContain(`[data-formula-input="${kind}"]`)
    })

    it('applies one wastage percentage to the yarn total when every layer shares it', () => {
        const { state, result } = savedCosting(base => ({ ...poplin(base), warpCrimpPct: 0 }))
        const formula = buildSavedCostingFormula(result, state)
        expect(formula.sharedAllowance).toEqual({ wastePct: 3, crimpPct: 0 })
        expect(render(formula)).toContain(`₹${formula.yarnBasePerM!.toFixed(2)} × 3% waste`)
    })

    it('starts a cotton count from 5315 ÷ Ne and shows a hand-entered weight as entered', () => {
        const { state, result } = savedCosting(base => {
            const next = poplin(base)
            return {
                ...next,
                warpRows: [{ ...next.warpRows[0], linearDensityUnit: 'cotton_count_ne', cottonCountNe: 40, calcDenier: 0 }],
                weftRows: [{ ...next.weftRows[0], calculationMode: 'manual', manualKgPer100m: 1.25 }],
            }
        })
        const formula = buildSavedCostingFormula(result, state)
        expect(formula.layers[0].weight).toMatchObject({ mode: 'formula', countNe: 40 })
        expect(formula.layers[1].weight).toEqual({ mode: 'manual', kgPer100m: 1.25 })
        const text = render(formula)
        expect(text).toContain('(5315 ÷ 40 Ne)')
        expect(text).toContain('1.250 kg entered by hand')
    })

    it('works out monthly factory expenses and outsourced warping and sizing', () => {
        const { state, result } = savedCosting(base => ({
            ...poplin(base),
            overheadMode: 'monthly_expenses',
            overheadOverridePerM: null,
            overheadItems: [{ id: 'rent', label: 'Rent', monthlyAmount: 300000, category: 'rent', isPreset: false, isLocked: false, source: 'manual' }],
            monthlyOutputM: 100000,
            warpingMode: 'outsourced',
            warpingRatePerKg: 12,
            sizingMode: 'outsourced',
            sizingRatePerKg: 8,
        }))
        const formula = buildSavedCostingFormula(result, state)
        expect(formula.overhead).toEqual({ perM: 3, monthlyTotal: 300000, monthlyOutputM: 100000 })
        expect(formula.warpingSizing).toMatchObject({ inHouse: false, warpingRatePerKg: 12, sizingRatePerKg: 8 })
        expect(formula.warpingSizing.warpKgPer100m).toBeCloseTo(formula.layers[0].weight.kgPer100m * 1.08, 9)
        const text = render(formula)
        expect(text).toContain('₹3,00,000 a month ÷ 1,00,000 m a month=₹3.00/m')
        expect(text).toContain('× (₹12/kg warping + ₹8/kg sizing) ÷ 100')
    })

    it('shows the saved figure alone when the saved inputs no longer give it', () => {
        const { state, result } = savedCosting(poplin)
        const tampered = {
            ...result,
            audit: { ...result.audit!, warp: { ...result.audit!.warp, layers: [{ ...result.audit!.warp.layers[0], ratePerKg: 999 }] } },
        }
        const formula = buildSavedCostingFormula(tampered, { ...state, perPickCostPaisa: 0.2 })
        expect(formula.layers[0].costFromRate).toBe(false)
        expect(formula.weaving).toEqual({ perM: result.breakdown.weaveCostPerM, picks: null, paisePerPick: null })
        const text = render(formula)
        expect(text).not.toContain('₹999/kg')
        expect(text).toContain('as saved=₹6.50/m')
    })

    it('keeps the yarn totals as saved for a version without per-layer detail', () => {
        const { result } = savedCosting(poplin)
        const formula = buildSavedCostingFormula({ ...result, audit: undefined }, null)
        expect(formula.layers).toEqual([])
        expect(formula.yarnBasePerM).toBeNull()
        expect(formula.weaving.picks).toBeNull()
        expect(formula.warpingSizing.inHouse).toBe(false)
        const text = render(formula)
        expect(text).toContain(savedCostingFormulaText.en.noLayers)
        expect(text).toContain(`Warp yarnas saved=₹${result.breakdown.warpCostPerM.toFixed(2)}/m`)
    })

    it('renders in Hindi and Gujarati', () => {
        const { state, result } = savedCosting(poplin)
        const formula = buildSavedCostingFormula(result, state)
        expect(render(formula, 'hi')).toContain('5,200 तार')
        expect(render(formula, 'gu')).toContain('5,200 તાર')
    })

    it('has every label in English, Hindi and Gujarati with the same placeholders', () => {
        const keys = Object.keys(savedCostingFormulaText.en).sort() as Array<keyof typeof savedCostingFormulaText.en>
        for (const language of ['hi', 'gu'] as const) {
            expect(Object.keys(savedCostingFormulaText[language]).sort()).toEqual(keys)
            for (const key of keys) {
                const placeholders = (text: string) => text.match(/\{\w+\}/g)?.sort() ?? []
                expect(placeholders(savedCostingFormulaText[language][key]), `${language}.${key}`).toEqual(placeholders(savedCostingFormulaText.en[key]))
            }
        }
    })
})

describe('selling price sum', () => {
    it('divides the cost by what is left after the margin', () => {
        const { result } = savedCosting(poplin)
        expect(sellingPriceFormula(result)).toEqual({ costPerM: result.productionCostPerM, transportPerM: null, commissionPct: null, marginPct: 10 })
    })

    it('adds transport and takes commission off the share', () => {
        const { result } = savedCosting(base => ({ ...poplin(base), commissionPct: 2, transportPerM: 1 }))
        expect(sellingPriceFormula(result)).toMatchObject({ transportPerM: 1, commissionPct: 2, marginPct: 10 })
    })

    it('has no sum for a price the saved figures do not give', () => {
        const { result } = savedCosting(poplin)
        expect(sellingPriceFormula({ ...result, suggestedSellingPricePerM: result.suggestedSellingPricePerM + 1 })).toBeNull()
    })
})
