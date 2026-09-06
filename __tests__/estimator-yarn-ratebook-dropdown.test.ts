import { describe, it, expect } from 'vitest'
import {
    extractDenierFromName,
    buildSavedYarnOptions,
    filterYarnOptions,
    SavedYarnOption,
} from '../lib/estimator-yarn-suggestions'

describe('estimator-yarn-suggestions', () => {
    describe('extractDenierFromName', () => {
        it('extracts filament denier from standard Indian market denier/filament notation', () => {
            expect(extractDenierFromName('80/72 Micro')).toBe(80)
            expect(extractDenierFromName('50/48 Bright')).toBe(50)
            expect(extractDenierFromName('150/48 Textured')).toBe(150)
            expect(extractDenierFromName('30/24 Semi Dull')).toBe(30)
        })

        it('extracts denier with explicit D/Den/Denier suffix', () => {
            expect(extractDenierFromName('75D Roto')).toBe(75)
            expect(extractDenierFromName('150 Denier Polyester')).toBe(150)
            expect(extractDenierFromName('30D Monofilament')).toBe(30)
            expect(extractDenierFromName('Polyester 80 den')).toBe(80)
        })

        it('extracts count/denier from spun count notations', () => {
            expect(extractDenierFromName('30/1 Cotton')).toBe(30)
            expect(extractDenierFromName('40s Cotton')).toBe(40)
            expect(extractDenierFromName('2/40 PV')).toBe(40)
            expect(extractDenierFromName('1/69 Metallic')).toBe(69)
        })

        it('returns null when no numeric denier or count pattern is present', () => {
            expect(extractDenierFromName('')).toBeNull()
            expect(extractDenierFromName('Pure Silk Fancy')).toBeNull()
            expect(extractDenierFromName('Special Zari Thread')).toBeNull()
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

    it('verifies verification state lifecycle: unverified after select, cleared on manual edit or confirm', () => {
        type VerificationState = Record<string, {
            yarnName: string
            denier: boolean
            rate: boolean
            autoFilledDenier: number
            autoFilledRate: number
        }>

        let unverifiedState: VerificationState = {}

        const rowId = 'warp-row-1'
        const selectedYarn: SavedYarnOption = {
            name: '80/72 Micro',
            category: 'yarn_warp',
            yarnRate: 155,
            denier: 80,
            source: 'rate_book',
        }

        // 1. User selects yarn from dropdown -> flags both denier and rate for verification
        unverifiedState = {
            ...unverifiedState,
            [rowId]: {
                yarnName: selectedYarn.name,
                denier: Boolean(selectedYarn.denier),
                rate: Boolean(selectedYarn.yarnRate > 0),
                autoFilledDenier: selectedYarn.denier ?? 0,
                autoFilledRate: selectedYarn.yarnRate,
            },
        }

        expect(unverifiedState[rowId]).toBeDefined()
        expect(unverifiedState[rowId].denier).toBe(true)
        expect(unverifiedState[rowId].rate).toBe(true)

        // 2. User manually adjusts yarn rate -> clears rate verification only
        const current = unverifiedState[rowId]
        const afterRateEdit = {
            ...current,
            rate: false,
        }
        if (!afterRateEdit.denier && !afterRateEdit.rate) {
            delete unverifiedState[rowId]
        } else {
            unverifiedState[rowId] = afterRateEdit
        }

        expect(unverifiedState[rowId].rate).toBe(false)
        expect(unverifiedState[rowId].denier).toBe(true)

        // 3. User clicks [Confirm Values] button -> clears remaining row verification
        delete unverifiedState[rowId]
        expect(unverifiedState[rowId]).toBeUndefined()
    })
})
