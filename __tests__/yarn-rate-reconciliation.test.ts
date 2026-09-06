import { describe, expect, it } from 'vitest'
import type { WarpRow, WeftRow } from '../lib/estimator'
import {
    applyYarnRateToTemplate,
    collectYarnRateCandidates,
    detectTemplateYarnRenames,
    formatYarnRateUsageNotes,
    getMissingYarnRateCandidates,
    getOrphanedYarnRateIds,
    getYarnRateConflicts,
    normalizeYarnName,
} from '../lib/yarn-rate-reconciliation'

function warp(id: string, label: string, yarnRate: number): WarpRow {
    return {
        id,
        label,
        calcDenier: 75,
        beamEnds: 3200,
        yarnRate,
        gstPct: 5,
        shortagePct: 0,
    }
}

function weft(id: string, label: string, yarnRate: number): WeftRow {
    return {
        id,
        label,
        picks: 60,
        reedSpace: 150,
        calcDenier: 75,
        yarnRate,
        gstPct: 5,
        shortagePct: 0,
    }
}

const templates = [
    {
        id: 'quality-a',
        name: 'Assam Silk',
        discoverySource: 'saved_quality' as const,
        warp_rows: [warp('warp-a', '30/1000  MUALTI', 322)],
        weft_rows: [weft('weft-a', '190 SLUB', 240)],
    },
    {
        id: 'quality-b',
        name: 'Assam Silk Fine',
        discoverySource: 'saved_quality' as const,
        warp_rows: [warp('warp-b', ' 30/1000 MUALTI ', 335)],
        weft_rows: [weft('weft-b', '190 slub', 240)],
    },
]

describe('saved-quality yarn rate reconciliation', () => {
    it('matches yarn names case-insensitively and ignores repeated whitespace', () => {
        expect(normalizeYarnName('  30/1000  MUALTI ')).toBe('30/1000 mualti')
        expect(collectYarnRateCandidates(templates).map(candidate => candidate.yarnName)).toEqual([
            '190 SLUB',
            '30/1000 MUALTI',
        ])
    })

    it('discovers one rate-book candidate per yarn across warp and weft layers', () => {
        const missing = getMissingYarnRateCandidates(templates, [
            { name: '190 Slub', category: 'yarn_weft' },
        ])
        expect(missing).toHaveLength(1)
        expect(missing[0]).toMatchObject({
            yarnName: '30/1000 MUALTI',
            category: 'yarn_warp',
            currentValue: 322,
        })
    })

    it('keeps the initial discovery source and lists every fabric using the yarn', () => {
        const candidate = collectYarnRateCandidates(templates).find(item => item.yarnName === '30/1000 MUALTI')

        expect(candidate).toMatchObject({
            discoverySource: 'saved_quality',
            fabricNames: ['Assam Silk', 'Assam Silk Fine'],
            usageNotes: 'Used in: Assam Silk, Assam Silk Fine',
            savedQualityCount: 2,
        })
        expect(formatYarnRateUsageNotes(['Assam Silk', 'Assam Silk', '  Assam Silk Fine  '])).toBe('Used in: Assam Silk, Assam Silk Fine')
    })

    it('discovers yarn rates from standalone saved costing snapshots', () => {
        const savedCosting = {
            id: 'costing:costing-a',
            name: 'Unsaved-quality costing',
            discoverySource: 'saved_costing' as const,
            warp_rows: [warp('warp-costing', '40 POLY', 185)],
            weft_rows: [weft('weft-costing', '60 VISCOSE', 210)],
        }

        expect(getMissingYarnRateCandidates([savedCosting], [])).toMatchObject([
            { yarnName: '40 POLY', category: 'yarn_warp', currentValue: 185, savedQualityCount: 0 },
            { yarnName: '60 VISCOSE', category: 'yarn_weft', currentValue: 210, savedQualityCount: 0 },
        ])
    })

    it('flags different quality rates for the same named yarn with their locations', () => {
        const conflicts = getYarnRateConflicts(templates)
        expect(conflicts).toHaveLength(1)
        expect(conflicts[0].rates).toEqual([322, 335])
        expect(conflicts[0].usages.map(usage => usage.templateName)).toEqual(['Assam Silk', 'Assam Silk Fine'])
    })

    it('does not treat an older saved-costing snapshot as a Saved Quality conflict', () => {
        const sources = [
            {
                id: 'quality-current',
                name: 'Same Quality',
                discoverySource: 'saved_quality' as const,
                weft_rows: [weft('weft-current', 'Weft Yarn 150D', 240)],
            },
            {
                id: 'costing-old',
                name: 'Same Quality',
                discoverySource: 'saved_costing' as const,
                weft_rows: [weft('weft-old', 'Weft Yarn 150D', 220)],
            },
        ]

        expect(collectYarnRateCandidates(sources)[0].conflict?.rates).toEqual([220, 240])
        expect(getYarnRateConflicts(sources)).toEqual([])
    })

    it('applies the chosen rate to every matching warp and weft layer only', () => {
        const updated = applyYarnRateToTemplate({
            warp_rows: [warp('warp-a', '30/1000 MUALTI', 322), warp('warp-other', '30 CHIKU', 110)],
            weft_rows: [weft('weft-a', '30/1000 mualti', 335)],
        }, '30/1000 MUALTI', 330)

        expect(updated.changed).toBe(true)
        expect(updated.warpRows.map(row => row.yarnRate)).toEqual([330, 110])
        expect(updated.weftRows[0].yarnRate).toBe(330)
    })

    describe('yarn rename reconciliation on template update', () => {
        it('emits rename action when a yarn in a saved quality is renamed and not used elsewhere', () => {
            const oldWarpRows = [warp('row-1', 'warp yarn', 107)]
            const newWarpRows = [warp('row-1', '75 D jury', 115)]

            const actions = detectTemplateYarnRenames({
                oldWarpRows,
                newWarpRows,
                otherTemplates: [],
                savedCostings: [],
                existingRates: [{ name: 'warp yarn', category: 'yarn_warp' }],
            })

            expect(actions).toEqual([
                {
                    kind: 'rename',
                    category: 'yarn_warp',
                    oldNormalizedName: 'warp yarn',
                    newName: '75 D jury',
                    newNormalizedName: '75 d jury',
                    newRate: 115,
                },
            ])
        })

        it('does not rename old yarn if it is still used in another active template', () => {
            const oldWarpRows = [warp('row-1', 'warp yarn', 107)]
            const newWarpRows = [warp('row-1', '75 D jury', 115)]

            const actions = detectTemplateYarnRenames({
                oldWarpRows,
                newWarpRows,
                otherTemplates: [
                    { warp_rows: [warp('other-row', 'warp yarn', 107)] },
                ],
                savedCostings: [],
                existingRates: [{ name: 'warp yarn', category: 'yarn_warp' }],
            })

            expect(actions).toEqual([])
        })

        it('does not rename old yarn if it is still used in a saved costing snapshot', () => {
            const oldWarpRows = [warp('row-1', 'warp yarn', 107)]
            const newWarpRows = [warp('row-1', '75 D jury', 115)]

            const actions = detectTemplateYarnRenames({
                oldWarpRows,
                newWarpRows,
                otherTemplates: [],
                savedCostings: [
                    { warp_rows: [warp('costing-row', 'warp yarn', 107)] },
                ],
                existingRates: [{ name: 'warp yarn', category: 'yarn_warp' }],
            })

            expect(actions).toEqual([])
        })

        it('emits delete_orphan when new yarn already exists in Rate Book and old yarn is unused', () => {
            const oldWarpRows = [warp('row-1', 'warp yarn', 107)]
            const newWarpRows = [warp('row-1', '75 D jury', 115)]

            const actions = detectTemplateYarnRenames({
                oldWarpRows,
                newWarpRows,
                otherTemplates: [],
                savedCostings: [],
                existingRates: [
                    { name: 'warp yarn', category: 'yarn_warp' },
                    { name: '75 D jury', category: 'yarn_warp' },
                ],
            })

            expect(actions).toEqual([
                {
                    kind: 'delete_orphan',
                    category: 'yarn_warp',
                    oldNormalizedName: 'warp yarn',
                },
            ])
        })

        it('emits delete_orphan when a yarn row is removed from the quality and used nowhere else', () => {
            const oldWeftRows = [weft('row-1', '150D Roto', 120), weft('row-2', 'Zari Gold', 450)]
            const newWeftRows = [weft('row-1', '150D Roto', 120)]

            const actions = detectTemplateYarnRenames({
                oldWeftRows,
                newWeftRows,
                otherTemplates: [],
                savedCostings: [],
                existingRates: [
                    { name: '150D Roto', category: 'yarn_weft' },
                    { name: 'Zari Gold', category: 'yarn_weft' },
                ],
            })

            expect(actions).toEqual([
                {
                    kind: 'delete_orphan',
                    category: 'yarn_weft',
                    oldNormalizedName: 'zari gold',
                },
            ])
        })
    })

    describe('orphaned yarn rate detection', () => {
        it('identifies unreviewed auto-discovered rates with zero usages', () => {
            const rates = [
                { id: 'rate-1', name: 'warp yarn', category: 'yarn_warp', source: 'Saved quality', apply_as_default: false },
                { id: 'rate-2', name: '75 D jury', category: 'yarn_warp', source: 'Saved quality', apply_as_default: false },
                { id: 'rate-3', name: 'Cotton 40s', category: 'yarn_warp', source: 'Supplier A', apply_as_default: false },
                { id: 'rate-4', name: 'Default Warp', category: 'yarn_warp', source: 'Saved quality', apply_as_default: true },
            ]
            const activeTemplates = [
                {
                    id: 'tpl-1',
                    name: 'Fabric 1',
                    warp_rows: [warp('w-1', '75 D jury', 115)],
                },
            ]

            const orphanIds = getOrphanedYarnRateIds({
                rates,
                templates: activeTemplates,
                costings: [],
            })

            // Only rate-1 is an orphaned Saved Quality rate
            expect(orphanIds).toEqual(['rate-1'])
        })
    })
})
