import { describe, expect, it } from 'vitest'
import type { WarpRow, WeftRow } from '../lib/estimator'
import {
    applyYarnRateToTemplate,
    collectYarnRateCandidates,
    formatYarnRateUsageNotes,
    getMissingYarnRateCandidates,
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
        })
        expect(formatYarnRateUsageNotes(['Assam Silk', 'Assam Silk', '  Assam Silk Fine  '])).toBe('Used in: Assam Silk, Assam Silk Fine')
    })

    it('discovers yarn rates from standalone saved costing snapshots', () => {
        const savedCosting = {
            id: 'costing:costing-a',
            name: 'Unsaved-quality costing',
            warp_rows: [warp('warp-costing', '40 POLY', 185)],
            weft_rows: [weft('weft-costing', '60 VISCOSE', 210)],
        }

        expect(getMissingYarnRateCandidates([savedCosting], [])).toMatchObject([
            { yarnName: '40 POLY', category: 'yarn_warp', currentValue: 185 },
            { yarnName: '60 VISCOSE', category: 'yarn_weft', currentValue: 210 },
        ])
    })

    it('flags different quality rates for the same named yarn with their locations', () => {
        const conflicts = getYarnRateConflicts(templates)
        expect(conflicts).toHaveLength(1)
        expect(conflicts[0].rates).toEqual([322, 335])
        expect(conflicts[0].usages.map(usage => usage.templateName)).toEqual(['Assam Silk', 'Assam Silk Fine'])
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
})
