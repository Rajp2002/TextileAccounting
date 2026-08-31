import { describe, expect, it } from 'vitest'
import {
    isWarpRowFilled,
    isWeftRowFilled,
    DEFAULT_WARP_ROW,
    DEFAULT_WEFT_ROW,
    type WarpRow,
    type WeftRow,
} from '../lib/estimator'

describe('Warp & Weft Component Completion Validation', () => {
    describe('isWarpRowFilled', () => {
        it('returns false for default empty warp row', () => {
            const row: WarpRow = {
                ...DEFAULT_WARP_ROW,
                id: 'warp-1',
                calcDenier: 0,
                beamEnds: 0,
                yarnRate: 0,
            }
            expect(isWarpRowFilled(row)).toBe(false)
        })

        it('returns false when yarn rate is missing or zero', () => {
            const row: WarpRow = {
                ...DEFAULT_WARP_ROW,
                id: 'warp-1',
                calcDenier: 75,
                beamEnds: 3200,
                yarnRate: 0,
            }
            expect(isWarpRowFilled(row)).toBe(false)
        })

        it('returns false when denier or beam ends are missing in formula mode', () => {
            const rowNoEnds: WarpRow = {
                ...DEFAULT_WARP_ROW,
                id: 'warp-1',
                calcDenier: 75,
                beamEnds: 0,
                yarnRate: 110,
            }
            expect(isWarpRowFilled(rowNoEnds)).toBe(false)

            const rowNoDenier: WarpRow = {
                ...DEFAULT_WARP_ROW,
                id: 'warp-1',
                calcDenier: 0,
                beamEnds: 3200,
                yarnRate: 110,
            }
            expect(isWarpRowFilled(rowNoDenier)).toBe(false)
        })

        it('returns true when all required formula fields are filled', () => {
            const row: WarpRow = {
                ...DEFAULT_WARP_ROW,
                id: 'warp-1',
                label: 'Warp yarn',
                calcDenier: 75,
                beamEnds: 3200,
                yarnRate: 110,
                shortagePct: 20,
                gstPct: 5,
            }
            expect(isWarpRowFilled(row)).toBe(true)
        })

        it('returns true when using cotton count with positive value', () => {
            const row: WarpRow = {
                ...DEFAULT_WARP_ROW,
                id: 'warp-1',
                linearDensityUnit: 'cotton_count_ne',
                cottonCountNe: 40,
                calcDenier: 0,
                beamEnds: 3200,
                yarnRate: 250,
            }
            expect(isWarpRowFilled(row)).toBe(true)
        })

        it('correctly validates manual mode warp rows', () => {
            const rowManualIncomplete: WarpRow = {
                ...DEFAULT_WARP_ROW,
                id: 'warp-1',
                calculationMode: 'manual',
                manualKgPer100m: 0,
                yarnRate: 110,
            }
            expect(isWarpRowFilled(rowManualIncomplete)).toBe(false)

            const rowManualComplete: WarpRow = {
                ...DEFAULT_WARP_ROW,
                id: 'warp-1',
                calculationMode: 'manual',
                manualKgPer100m: 3.25,
                yarnRate: 110,
            }
            expect(isWarpRowFilled(rowManualComplete)).toBe(true)
        })

        it('handles null / undefined safely', () => {
            expect(isWarpRowFilled(null)).toBe(false)
            expect(isWarpRowFilled(undefined)).toBe(false)
        })
    })

    describe('isWeftRowFilled', () => {
        it('returns false for default empty weft row', () => {
            const row: WeftRow = {
                ...DEFAULT_WEFT_ROW,
                id: 'weft-1',
                picks: 0,
                effectiveCostingWidthCm: 0,
                reedSpace: 0,
                calcDenier: 0,
                yarnRate: 0,
            }
            expect(isWeftRowFilled(row)).toBe(false)
        })

        it('returns false when picks, width, denier or rate are missing in formula mode', () => {
            const base: WeftRow = {
                ...DEFAULT_WEFT_ROW,
                id: 'weft-1',
                picks: 68,
                effectiveCostingWidthCm: 160,
                calcDenier: 75,
                yarnRate: 110,
            }
            expect(isWeftRowFilled(base)).toBe(true)

            expect(isWeftRowFilled({ ...base, picks: 0 })).toBe(false)
            expect(isWeftRowFilled({ ...base, effectiveCostingWidthCm: 0, reedSpace: 0 })).toBe(false)
            expect(isWeftRowFilled({ ...base, calcDenier: 0 })).toBe(false)
            expect(isWeftRowFilled({ ...base, yarnRate: 0 })).toBe(false)
        })

        it('recognizes reedSpace as fallback for width when effectiveCostingWidthCm is not set', () => {
            const rowWithReedSpace: WeftRow = {
                ...DEFAULT_WEFT_ROW,
                id: 'weft-1',
                picks: 68,
                reedSpace: 160,
                effectiveCostingWidthCm: 0,
                calcDenier: 75,
                yarnRate: 110,
            }
            expect(isWeftRowFilled(rowWithReedSpace)).toBe(true)
        })

        it('correctly validates manual mode weft rows', () => {
            const rowManualIncomplete: WeftRow = {
                ...DEFAULT_WEFT_ROW,
                id: 'weft-1',
                calculationMode: 'manual',
                picks: 68,
                manualKgPer100m: 0,
                yarnRate: 110,
            }
            expect(isWeftRowFilled(rowManualIncomplete)).toBe(false)

            const rowManualNoPicks: WeftRow = {
                ...DEFAULT_WEFT_ROW,
                id: 'weft-1',
                calculationMode: 'manual',
                picks: 0,
                manualKgPer100m: 2.75,
                yarnRate: 110,
            }
            expect(isWeftRowFilled(rowManualNoPicks)).toBe(false)

            const rowManualComplete: WeftRow = {
                ...DEFAULT_WEFT_ROW,
                id: 'weft-1',
                calculationMode: 'manual',
                picks: 68,
                manualKgPer100m: 2.75,
                yarnRate: 110,
            }
            expect(isWeftRowFilled(rowManualComplete)).toBe(true)
        })

        it('handles null / undefined safely', () => {
            expect(isWeftRowFilled(null)).toBe(false)
            expect(isWeftRowFilled(undefined)).toBe(false)
        })
    })
})
