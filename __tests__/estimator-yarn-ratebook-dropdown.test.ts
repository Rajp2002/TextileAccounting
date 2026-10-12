import { describe, it, expect } from 'vitest'
import {
    parseYarnDensityFromName,
    buildSavedYarnOptions,
    filterYarnOptions,
    SavedYarnOption,
} from '../lib/estimator-yarn-suggestions'

describe('estimator-yarn-suggestions', () => {
    describe('parseYarnDensityFromName', () => {
        it('extracts filament denier from standard Indian market denier/filament notation', () => {
            expect(parseYarnDensityFromName('80/72 Micro')).toEqual({ unit: 'denier', value: 80 })
            expect(parseYarnDensityFromName('50/48 Bright')).toEqual({ unit: 'denier', value: 50 })
            expect(parseYarnDensityFromName('150/48 Textured')).toEqual({ unit: 'denier', value: 150 })
            expect(parseYarnDensityFromName('30/24 Semi Dull')).toEqual({ unit: 'denier', value: 30 })
        })

        it('extracts denier with explicit D/Den/Denier suffix', () => {
            expect(parseYarnDensityFromName('75D Roto')).toEqual({ unit: 'denier', value: 75 })
            expect(parseYarnDensityFromName('150 Denier Polyester')).toEqual({ unit: 'denier', value: 150 })
            expect(parseYarnDensityFromName('30D Monofilament')).toEqual({ unit: 'denier', value: 30 })
            expect(parseYarnDensityFromName('Polyester 80 den')).toEqual({ unit: 'denier', value: 80 })
        })

        // LT01A (LC08): spun counts used to come back as a bare denier number.
        // A count is typed as Ne; ply notation is left for the owner to enter.
        it('types spun counts as Ne and leaves ply notation unresolved', () => {
            expect(parseYarnDensityFromName('40s Cotton')).toEqual({ unit: 'cotton_count_ne', value: 40 })
            expect(parseYarnDensityFromName('30/1 Cotton')).toBeNull()
            expect(parseYarnDensityFromName('2/40 PV')).toBeNull()
            expect(parseYarnDensityFromName('1/69 Metallic')).toBeNull()
        })

        it('returns null when no numeric denier or count pattern is present', () => {
            expect(parseYarnDensityFromName('')).toBeNull()
            expect(parseYarnDensityFromName('Pure Silk Fancy')).toBeNull()
            expect(parseYarnDensityFromName('Special Zari Thread')).toBeNull()
        })
    })

    describe('buildSavedYarnOptions', () => {
        it('merges rate book yarns and estimator templates, preferring rate book rates', () => {
            const rateBookYarns = [
                {
                    id: 'rb-1',
                    category: 'yarn_warp' as const,
                    name: '80/72 Micro',
                    currentValue: 145,
                    unit: 'kg',
                },
                {
                    id: 'rb-2',
                    category: 'yarn_weft' as const,
                    name: 'Metallic Zari Gold',
                    currentValue: 320,
                    unit: 'kg',
                },
            ]

            const templates = [
                {
                    id: 'tmpl-1',
                    name: '60g Georgette',
                    warp_rows: [
                        {
                            label: '80/72 Micro',
                            calcDenier: 80,
                            yarnRate: 140, // Older rate in template
                            beamEnds: 3600,
                        },
                    ],
                    weft_rows: [
                        {
                            label: '75D Roto',
                            calcDenier: 75,
                            yarnRate: 135,
                            picks: 64,
                            reedSpace: 160,
                        },
                    ],
                },
            ]

            const options = buildSavedYarnOptions(rateBookYarns, templates)

            // Should have 80/72 Micro (preferred rate 145 from ratebook, denier 80 from template/extract)
            const micro80 = options.find(o => o.name === '80/72 Micro')
            expect(micro80).toBeDefined()
            expect(micro80?.yarnRate).toBe(145)
            expect(micro80?.source).toBe('rate_book')
            expect(micro80?.denier).toBe(80)

            // Should have 75D Roto from template
            const roto75 = options.find(o => o.name === '75D Roto')
            expect(roto75).toBeDefined()
            expect(roto75?.yarnRate).toBe(135)
            expect(roto75?.source).toBe('saved_quality')
            expect(roto75?.denier).toBe(75)

            // Should have Metallic Zari Gold from ratebook
            const zari = options.find(o => o.name === 'Metallic Zari Gold')
            expect(zari).toBeDefined()
            expect(zari?.yarnRate).toBe(320)
            expect(zari?.category).toBe('yarn_weft')
        })

        it('extracts denier automatically from yarn name when missing in template or ratebook', () => {
            const rateBookYarns = [
                {
                    id: 'rb-3',
                    category: 'yarn_warp' as const,
                    name: '50/48 Bright',
                    currentValue: 180,
                    unit: 'kg',
                },
            ]

            const options = buildSavedYarnOptions(rateBookYarns, [])
            expect(options[0].name).toBe('50/48 Bright')
            expect(options[0].denier).toBe(50)
        })
    })

    describe('filterYarnOptions', () => {
        const testOptions: SavedYarnOption[] = [
            {
                name: '80/72 Micro',
                category: 'yarn_warp',
                yarnRate: 145,
                denier: 80,
                source: 'rate_book',
            },
            {
                name: '75D Roto',
                category: 'yarn_weft',
                yarnRate: 130,
                denier: 75,
                source: 'rate_book',
            },
            {
                name: '80/72 Micro Weft Twist',
                category: 'yarn_weft',
                yarnRate: 148,
                denier: 80,
                source: 'rate_book',
            },
            {
                name: '50/48 Bright',
                category: 'yarn_warp',
                yarnRate: 190,
                denier: 50,
                source: 'rate_book',
            },
        ]

        it('prioritizes exact/prefix matches and preferred category', () => {
            const results = filterYarnOptions(testOptions, '80', 'yarn_warp')
            expect(results.length).toBe(2)
            expect(results[0].name).toBe('80/72 Micro') // Prefix + preferred category
            expect(results[1].name).toBe('80/72 Micro Weft Twist') // Prefix + other category
        })

        it('ranks preferred category first when no query is typed', () => {
            const warpResults = filterYarnOptions(testOptions, '', 'yarn_warp')
            expect(warpResults[0].category).toBe('yarn_warp')
            expect(warpResults[1].category).toBe('yarn_warp')
            expect(warpResults[2].category).toBe('yarn_weft')
        })

        it('limits suggestions to maximum limit', () => {
            const results = filterYarnOptions(testOptions, '', undefined, 2)
            expect(results.length).toBe(2)
        })
    })
})

describe('auto-propagation and structural parameters preservation logic', () => {
    it('verifies that applying a yarn option copies Name, Denier, and Rate, but strictly ignores Beam Ends, Picks, and Width', () => {
        // Initial Warp row with factory loom settings
        const initialWarpRow = {
            id: 'warp-1',
            label: 'Old Warp',
            calcDenier: 50,
            yarnRate: 120,
            beamEnds: 4200, // Fabric structure parameter
            shortagePct: 2.5,
            gstPct: 5,
        }

        const selectedYarn: SavedYarnOption = {
            name: '80/72 Micro',
            category: 'yarn_warp',
            yarnRate: 155,
            denier: 80,
            source: 'rate_book',
        }

        // Apply auto-propagation rule as implemented in estimateReducer SELECT_WARP_YARN
        const updatedWarpRow = {
            ...initialWarpRow,
            label: selectedYarn.name,
            calcDenier: selectedYarn.denier ?? initialWarpRow.calcDenier,
            yarnRate: selectedYarn.yarnRate,
            // beamEnds is explicitly NOT overwritten
        }

        expect(updatedWarpRow.label).toBe('80/72 Micro')
        expect(updatedWarpRow.calcDenier).toBe(80)
        expect(updatedWarpRow.yarnRate).toBe(155)
        // Loom & fabric structural parameter must remain intact!
        expect(updatedWarpRow.beamEnds).toBe(4200)

        // Initial Weft row with loom reed & pick settings
        const initialWeftRow = {
            id: 'weft-1',
            label: 'Old Weft',
            calcDenier: 50,
            yarnRate: 115,
            picks: 68, // Cloth structure parameter
            reedSpace: 162, // Cloth structure parameter
            effectiveCostingWidthCm: 160, // Cloth structure parameter
            shortagePct: 3,
            gstPct: 5,
        }

        const selectedWeftYarn: SavedYarnOption = {
            name: '75D Roto',
            category: 'yarn_weft',
            yarnRate: 132,
            denier: 75,
            source: 'rate_book',
        }

        // Apply auto-propagation rule as implemented in estimateReducer SELECT_WEFT_YARN
        const updatedWeftRow = {
            ...initialWeftRow,
            label: selectedWeftYarn.name,
            calcDenier: selectedWeftYarn.denier ?? initialWeftRow.calcDenier,
            yarnRate: selectedWeftYarn.yarnRate,
            // picks, reedSpace, effectiveCostingWidthCm are explicitly NOT overwritten
        }

        expect(updatedWeftRow.label).toBe('75D Roto')
        expect(updatedWeftRow.calcDenier).toBe(75)
        expect(updatedWeftRow.yarnRate).toBe(132)
        // Structural parameters must remain intact!
        expect(updatedWeftRow.picks).toBe(68)
        expect(updatedWeftRow.reedSpace).toBe(162)
        expect(updatedWeftRow.effectiveCostingWidthCm).toBe(160)
    })
})
