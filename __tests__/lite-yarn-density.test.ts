import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getEffectiveYarnDenier, type WarpRow, type WeftRow } from '@/lib/estimator'
import {
    applyYarnSuggestionToRow,
    buildSavedYarnOptions,
    parseYarnDensityFromName,
    type SavedYarnOption,
} from '@/lib/estimator-yarn-suggestions'

// LT01A (LC08): a yarn name may suggest a density only with an explicit unit.
// 40 Ne is 5315 / 40 = 132.875 denier under the existing conversion; it is
// never 40 denier. Ply and other fractions are left for the owner to enter.

const denierRow = (overrides: Partial<WarpRow> = {}): WarpRow => ({
    id: 'warp-1', label: 'Old warp', calcDenier: 75, beamEnds: 4200, yarnRate: 120, gstPct: 5, shortagePct: 2.5,
    linearDensityUnit: 'denier', cottonCountNe: null, ...overrides,
})
const neWeftRow = (overrides: Partial<WeftRow> = {}): WeftRow => ({
    id: 'weft-1', label: 'Old weft', calcDenier: 177.16666666666666, picks: 68, reedSpace: 162, effectiveCostingWidthCm: 160,
    yarnRate: 115, gstPct: 5, shortagePct: 3, linearDensityUnit: 'cotton_count_ne', cottonCountNe: 30, ...overrides,
})
const option = (overrides: Partial<SavedYarnOption>): SavedYarnOption => ({
    name: 'Yarn', category: 'yarn_warp', denier: 0, density: null, yarnRate: 150, source: 'rate_book', ...overrides,
})

describe('parseYarnDensityFromName', () => {
    it('reads explicit cotton count as Ne, never as denier', () => {
        expect(parseYarnDensityFromName('40 Ne')).toEqual({ unit: 'cotton_count_ne', value: 40 })
        expect(parseYarnDensityFromName('40s Cotton')).toEqual({ unit: 'cotton_count_ne', value: 40 })
        expect(parseYarnDensityFromName("30's PC")).toEqual({ unit: 'cotton_count_ne', value: 30 })
        expect(parseYarnDensityFromName('Combed 60Ne')).toEqual({ unit: 'cotton_count_ne', value: 60 })
    })

    it('reads explicit denier and denier/filament notation as denier', () => {
        expect(parseYarnDensityFromName('75D Roto')).toEqual({ unit: 'denier', value: 75 })
        expect(parseYarnDensityFromName('Polyester 80 den')).toEqual({ unit: 'denier', value: 80 })
        expect(parseYarnDensityFromName('150 Denier Polyester')).toEqual({ unit: 'denier', value: 150 })
        expect(parseYarnDensityFromName('80/72 Micro')).toEqual({ unit: 'denier', value: 80 })
        expect(parseYarnDensityFromName('50/48 Bright')).toEqual({ unit: 'denier', value: 50 })
    })

    it('leaves ply, count/ply and bare numbers unresolved', () => {
        expect(parseYarnDensityFromName('2/40 PV')).toBeNull()
        expect(parseYarnDensityFromName('30/1 Cotton')).toBeNull()
        expect(parseYarnDensityFromName('40/2 Cotton')).toBeNull()
        expect(parseYarnDensityFromName('1/69 Metallic')).toBeNull()
        expect(parseYarnDensityFromName('Viscose 120')).toBeNull()
        expect(parseYarnDensityFromName('')).toBeNull()
        expect(parseYarnDensityFromName('Special Zari Thread')).toBeNull()
    })
})

describe('buildSavedYarnOptions carries a typed density', () => {
    it('types Rate Book names and leaves ambiguous ones without a density', () => {
        const options = buildSavedYarnOptions([
            { id: 'rb-1', name: '40s Cotton', category: 'yarn_warp', currentValue: 260 },
            { id: 'rb-2', name: '2/40 PV', category: 'yarn_weft', currentValue: 210 },
            { id: 'rb-3', name: '80/72 Micro', category: 'yarn_warp', currentValue: 145 },
        ], [])
        const byName = Object.fromEntries(options.map(entry => [entry.name, entry]))
        expect(byName['40s Cotton'].density).toEqual({ unit: 'cotton_count_ne', value: 40 })
        expect(byName['40s Cotton'].denier).toBe(132.875)
        expect(byName['2/40 PV'].density).toBeNull()
        expect(byName['2/40 PV'].denier).toBe(0)
        expect(byName['80/72 Micro'].density).toEqual({ unit: 'denier', value: 80 })
    })

    it('keeps a saved recipe value in its own unit, even when the Rate Book has the same name', () => {
        const options = buildSavedYarnOptions(
            [{ id: 'rb-1', name: '2/40 PV', category: 'yarn_warp', currentValue: 215 }],
            [{
                id: 'q-1', name: 'Shirting',
                warp_rows: [{ label: '2/40 PV', calcDenier: 265.75, linearDensityUnit: 'cotton_count_ne', cottonCountNe: 20, yarnRate: 205 }],
                weft_rows: [{ label: 'Weft 75D', calcDenier: 75, linearDensityUnit: 'denier', yarnRate: 140 }],
            }],
        )
        const pv = options.find(entry => entry.name === '2/40 PV')!
        expect(pv.density).toEqual({ unit: 'cotton_count_ne', value: 20 })
        expect(pv.yarnRate).toBe(215)
        expect(options.find(entry => entry.name === 'Weft 75D')!.density).toEqual({ unit: 'denier', value: 75 })
    })

    it('does not invent a density for a recipe row that has none', () => {
        const [entry] = buildSavedYarnOptions([], [{ name: 'Q', warp_rows: [{ label: '30/1 Cotton', calcDenier: 0, yarnRate: 200 }] }])
        expect(entry.density).toBeNull()
        expect(entry.denier).toBe(0)
    })
})

describe('applyYarnSuggestionToRow', () => {
    it('puts a Ne suggestion into a denier row with the matching unit and effective density', () => {
        const row = applyYarnSuggestionToRow(denierRow(), option({ name: '40s Cotton', density: { unit: 'cotton_count_ne', value: 40 }, denier: 132.875 }))
        expect(row).toMatchObject({ label: '40s Cotton', linearDensityUnit: 'cotton_count_ne', cottonCountNe: 40, yarnRate: 150 })
        expect(getEffectiveYarnDenier(row)).toBe(132.875)
        expect(row.calcDenier).toBe(132.875)
    })

    it('replaces the count of an existing Ne row', () => {
        const row = applyYarnSuggestionToRow(neWeftRow(), option({ density: { unit: 'cotton_count_ne', value: 40 }, denier: 132.875 }))
        expect(row.cottonCountNe).toBe(40)
        expect(getEffectiveYarnDenier(row)).toBe(132.875)
    })

    it('clears stale Ne context when a denier yarn is chosen', () => {
        const row = applyYarnSuggestionToRow(neWeftRow(), option({ name: '75D Roto', density: { unit: 'denier', value: 75 }, denier: 75 }))
        expect(row).toMatchObject({ linearDensityUnit: 'denier', cottonCountNe: null, calcDenier: 75 })
    })

    it('clears the previous density when the suggestion has none, so it cannot pass as complete', () => {
        const fromDenier = applyYarnSuggestionToRow(denierRow(), option({ name: '2/40 PV', density: null, denier: 0 }))
        expect(getEffectiveYarnDenier(fromDenier)).toBe(0)
        expect(fromDenier.label).toBe('2/40 PV')
        const fromNe = applyYarnSuggestionToRow(neWeftRow(), option({ name: '2/40 PV', density: null, denier: 0 }))
        expect(getEffectiveYarnDenier(fromNe)).toBe(0)
        expect(fromNe.cottonCountNe).toBeNull()
    })

    it('leaves construction and allowance fields untouched', () => {
        const weft = applyYarnSuggestionToRow(neWeftRow(), option({ density: { unit: 'denier', value: 75 }, denier: 75, yarnRate: 0 }))
        expect(weft).toMatchObject({ picks: 68, reedSpace: 162, effectiveCostingWidthCm: 160, shortagePct: 3, gstPct: 5, yarnRate: 115 })
        const warp = applyYarnSuggestionToRow(denierRow({ shortagePct: 0 }), option({ density: { unit: 'denier', value: 80 }, denier: 80 }))
        expect(warp).toMatchObject({ beamEnds: 4200, shortagePct: 0, gstPct: 5 })
    })
})

describe('estimator reducer uses the typed application', () => {
    const source = readFileSync('app/(dashboard)/owner/estimator/EstimatorClient.tsx', 'utf8')

    it('routes both yarn selections through applyYarnSuggestionToRow', () => {
        const warpCase = source.slice(source.indexOf("case 'SELECT_WARP_YARN':"), source.indexOf("case 'REMOVE_WARP_ROW':"))
        const weftCase = source.slice(source.indexOf("case 'SELECT_WEFT_YARN':"), source.indexOf("case 'REMOVE_WEFT_ROW':"))
        expect(warpCase).toContain('applyYarnSuggestionToRow(r, action.yarn)')
        expect(weftCase).toContain('applyYarnSuggestionToRow(r, action.yarn)')
        expect(warpCase).not.toContain('r.calcDenier')
        expect(weftCase).not.toContain('r.calcDenier')
    })
})
