import { describe, expect, it } from 'vitest'
import { makeDefaultEstimateState, type WarpRow, type WeftRow } from '@/lib/estimator'
import {
    rateBookDefaultsFromProfile,
    resolveReopenedQualityState,
    type SavedQualityCostingReuse,
    type SavedQualityTemplateInput,
} from '@/lib/saved-costings'

// Reopening a saved quality: the fabric comes from the quality, every rate the
// Rate Book holds from the Rate Book, and the rest from the latest costing.

const warp = (overrides: Partial<WarpRow> = {}): WarpRow => ({
    id: 'w', label: '75D Poly', calcDenier: 75, beamEnds: 4800, yarnRate: 130, gstPct: 5, shortagePct: null, ...overrides,
})
const weft = (overrides: Partial<WeftRow> = {}): WeftRow => ({
    id: 'f', label: '75D Poly', picks: 60, reedSpace: 120, calcDenier: 75, yarnRate: 120, gstPct: 5, shortagePct: null, ...overrides,
})

const template = (overrides: Partial<SavedQualityTemplateInput> = {}): SavedQualityTemplateInput => ({
    warp_rows: [warp()],
    weft_rows: [weft()],
    per_pick_cost_paise: 18,
    tape_length_m: 5000,
    warp_crimp_pct: 3,
    yarn_shortage_pct: 1,
    loom_type: 'rapier' as const,
    loom_rpm: 300,
    loom_power_kw: 2,
    hours_per_shift: 10,
    sizing_mode: 'in_house' as const,
    latest_costing_reuse: costing(),
    ...overrides,
})

function costing(overrides: Partial<SavedQualityCostingReuse> = {}): SavedQualityCostingReuse {
    return {
        version_number: 2,
        warp_rows: [warp({ yarnRate: 99, gstPct: 12, shortagePct: 4, crimpPct: 6 })],
        weft_rows: [weft({ gstPct: 12 })],
        per_pick_cost_paise: 22,
        yarn_shortage_pct: 2,
        warp_crimp_pct: 4,
        tape_length_m: 4000,
        loom_type: 'water_jet',
        estimator_rpm: 600,
        estimator_power_kw: 4,
        hours_per_shift: 8,
        sizing_mode: 'outsourced',
        warping_rate_per_kg: 3,
        sizing_rate_per_kg: 9,
        winding_rate_per_kg: 1,
        processing_rate_per_m: 5,
        finishing_rate_per_m: 2,
        transport_per_m: 0.5,
        commission_pct: 2,
        profit_margin_pct: 15,
        order_quantity_m: 1000,
        overhead_override_per_m: null,
        overhead_mode: 'monthly_expenses',
        warping_mode: 'in_house',
        ...overrides,
    }
}

const open = (tpl: SavedQualityTemplateInput, rateBook = {}) =>
    resolveReopenedQualityState(makeDefaultEstimateState(), tpl, rateBook)

describe('rateBookDefaultsFromProfile', () => {
    it('maps the seven Rate Book fields and keeps a real zero', () => {
        expect(rateBookDefaultsFromProfile({
            warping_rate_per_kg: '2.5',
            sizing_rate_per_kg: 3,
            winding_rate_per_kg: 1,
            default_processing_rate_per_m: 4,
            default_finishing_rate_per_m: 5,
            default_transport_per_m: 6,
            default_commission_pct: 0,
        })).toEqual({
            warpingRatePerKg: 2.5,
            sizingRatePerKg: 3,
            windingRatePerKg: 1,
            processingRatePerM: 4,
            finishingRatePerM: 5,
            transportPerM: 6,
            commissionPct: 0,
        })
    })

    it('omits missing and non-numeric values', () => {
        expect(rateBookDefaultsFromProfile({ default_commission_pct: 0, sizing_rate_per_kg: null, warping_rate_per_kg: 'x' }))
            .toEqual({ commissionPct: 0 })
        expect(rateBookDefaultsFromProfile(null)).toEqual({})
        expect(rateBookDefaultsFromProfile(undefined)).toEqual({})
    })
})

describe('resolveReopenedQualityState', () => {
    it('lets a Rate Book default beat the latest costing, and falls back to the costing', () => {
        const state = open(template(), { sizingRatePerKg: 11 })
        expect(state.sizingRatePerKg).toBe(11)
        expect(state.commissionPct).toBe(2)
        expect(state.warpingRatePerKg).toBe(3)
    })

    it('treats a Rate Book default of 0 as a real default', () => {
        expect(open(template(), { commissionPct: 0 }).commissionPct).toBe(0)
    })

    it('takes every Rate Book field from the Rate Book when it has them', () => {
        const state = open(template(), {
            warpingRatePerKg: 1, sizingRatePerKg: 2, windingRatePerKg: 3,
            processingRatePerM: 4, finishingRatePerM: 5, transportPerM: 6, commissionPct: 7,
        })
        expect([
            state.warpingRatePerKg, state.sizingRatePerKg, state.windingRatePerKg,
            state.processingRatePerM, state.finishingRatePerM, state.transportPerM, state.commissionPct,
        ]).toEqual([1, 2, 3, 4, 5, 6, 7])
    })

    it('takes the other inputs from the latest costing, not the quality', () => {
        const state = open(template())
        expect(state.perPickCostPaisa).toBe(22)
        expect(state.yarnShortagePct).toBe(2)
        expect(state.warpCrimpPct).toBe(4)
        expect(state.tapeLengthM).toBe(4000)
        expect(state.hoursPerShift).toBe(8)
        expect(state.sizingMode).toBe('outsourced')
        expect(state.loomType).toBe('water_jet')
        expect(state.loomRpm).toBe(600)
        expect(state.loomPowerKw).toBe(4)
        expect(state.profitPct).toBe(15)
        expect(state.orderQuantityM).toBe(1000)
    })

    it('keeps the fabric and the Rate Book yarn rates from the quality', () => {
        const state = open(template())
        expect(state.warpRows[0]).toMatchObject({ beamEnds: 4800, calcDenier: 75, yarnRate: 130 })
        expect(state.weftRows[0]).toMatchObject({ picks: 60, yarnRate: 120 })
    })

    it('copies per-layer GST, wastage and crimp from the costing when the fabric matches', () => {
        const state = open(template())
        expect(state.warpRows[0]).toMatchObject({ gstPct: 12, shortagePct: 4, crimpPct: 6 })
        expect(state.weftRows[0].gstPct).toBe(12)
    })

    it('uses the quality rows for per-layer values when the costing has a different fabric', () => {
        const state = open(template({
            latest_costing_reuse: costing({ weft_rows: [weft({ gstPct: 12 }), weft({ label: 'Zari', gstPct: 12 })] }),
        }))
        expect(state.warpRows[0]).toMatchObject({ gstPct: 5, shortagePct: null })
        expect(state.weftRows).toHaveLength(1)
        expect(state.weftRows[0].gstPct).toBe(5)
    })

    it('uses the quality for everything when it has no costing, and still applies the Rate Book', () => {
        const state = open(template({ latest_costing_reuse: null }), { sizingRatePerKg: 11 })
        expect(state.perPickCostPaisa).toBe(18)
        expect(state.tapeLengthM).toBe(5000)
        expect(state.loomType).toBe('rapier')
        expect(state.loomRpm).toBe(300)
        expect(state.sizingRatePerKg).toBe(11)
    })

    it('takes the overhead from the latest costing, not the quality', () => {
        const state = open(template({
            overhead_override_per_m: 3,
            latest_costing_reuse: costing({ overhead_override_per_m: 5, overhead_mode: 'direct' }),
        }))
        expect(state.overheadMode).toBe('direct')
        expect(state.overheadOverridePerM).toBe(5)
    })

    it('uses the quality overhead only when there is no costing', () => {
        const state = open(template({ overhead_override_per_m: 3, latest_costing_reuse: null }))
        expect(state.overheadMode).toBe('direct')
        expect(state.overheadOverridePerM).toBe(3)
    })

    it('builds a legacy quality without warp_rows from its columns', () => {
        const state = open(template({
            latest_costing_reuse: null,
            warp_rows: null,
            weft_rows: null,
            beam_ends: 4000,
            ppi: 70,
            default_yarn_rate: 111,
        }))
        expect(state.warpRows).toHaveLength(1)
        expect(state.warpRows[0]).toMatchObject({ beamEnds: 4000, yarnRate: 111 })
        expect(state.weftRows[0].picks).toBe(70)
    })

    it('gives the opened rows fresh ids', () => {
        const state = open(template())
        expect(state.warpRows[0].id).not.toBe('w')
        expect(state.weftRows[0].id).not.toBe('f')
    })
})
