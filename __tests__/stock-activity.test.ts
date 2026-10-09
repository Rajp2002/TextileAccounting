import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { ACTIVITY_DAYS, activitySince, balanceTrail, groupByIndiaDay, indiaDate, indiaDayStart, lastsFor, totalsSince, trailPath, weekSince, type ActivityRow } from '@/lib/stock-activity'
import { fabricActivityBucket } from '@/lib/quality-stock'
import { yarnActivityBucket, yarnFeeds, type YarnQuality } from '@/lib/yarn-stock'

const read = (file: string) => readFileSync(file, 'utf8')
// 10 Oct 2026, 1:30 AM in India: still 9 Oct in UTC, so day bounds must follow India, not the server clock.
const NOW = new Date('2026-10-09T20:00:00Z')
const row = (id: string, itemId: string, kind: string, delta: number, balanceAfter: number, createdAt: string): ActivityRow => ({ id, itemId, kind, delta, balanceAfter, createdAt })

describe('India day windows', () => {
    it('starts today and the window at India midnight', () => {
        expect(indiaDayStart(0, NOW)).toBe('2026-10-09T18:30:00.000Z')
        expect(weekSince(NOW)).toBe('2026-10-03T18:30:00.000Z')
        expect(activitySince(NOW)).toBe(indiaDayStart(ACTIVITY_DAYS - 1, NOW))
        expect(indiaDate('2026-10-09T19:00:00Z')).toBe('2026-10-10')
    })
})

describe('week totals', () => {
    const rows = [
        row('a', 'q1', 'production', 125, 860, '2026-10-09T13:10:00Z'),
        row('b', 'q1', 'dispatch', -295, 735, '2026-10-07T05:50:00Z'),
        row('c', 'q2', 'correction', -18, 718, '2026-10-06T11:45:00Z'),
        row('d', 'q1', 'production', 320, 820, '2026-10-02T13:30:00Z'),
    ]

    it('buckets fabric movements since the start of the week and skips older ones', () => {
        expect(totalsSince(rows, weekSince(NOW), fabricActivityBucket)).toEqual({ woven: 125, dispatched: -295, adjusted: -18 })
    })

    it('counts production use, older dispatch use and receipts for yarn', () => {
        expect(yarnActivityBucket('production_consumption')).toBe('used')
        expect(yarnActivityBucket('dispatch')).toBe('used')
        expect(yarnActivityBucket('receipt')).toBe('received')
        expect(yarnActivityBucket('audit_adjustment')).toBe('adjusted')
        expect(fabricActivityBucket('production_reversal')).toBe('woven')
        expect(fabricActivityBucket('unknown')).toBeNull()
    })
})

describe('balance trail', () => {
    it('starts from the balance before the first movement and ends at the current balance now', () => {
        const rows = [row('b', 'q1', 'dispatch', -295, 735, '2026-10-07T05:50:00Z'), row('a', 'q1', 'production', 125, 860, '2026-10-09T13:10:00Z')]
        const trail = balanceTrail(rows, 'q1', 860, activitySince(NOW), NOW)
        expect(trail.map(point => point.v)).toEqual([1030, 735, 860, 860])
        expect(trail[0].t).toBe(Date.parse(activitySince(NOW)))
        expect(trail.at(-1)!.t).toBe(NOW.getTime())
    })

    it('stays flat for an item with no movements in the window', () => {
        expect(balanceTrail([], 'q9', 40, activitySince(NOW), NOW).map(point => point.v)).toEqual([40, 40])
    })

    it('draws a stepped path from zero to the peak inside the view box', () => {
        const { line, area } = trailPath([{ t: 0, v: 50 }, { t: 50, v: 100 }, { t: 100, v: 100 }], 300, 56)
        expect(line).toBe('M0 29 H150 V4 H300 V4 H300')
        expect(area).toBe(`${line} V56 H0 Z`)
        expect(trailPath([], 300, 56)).toEqual({ line: '', area: '' })
    })
})

describe('recent movements by day', () => {
    it('groups newest-first rows by India date', () => {
        const days = groupByIndiaDay([
            { id: '3', created_at: '2026-10-09T19:00:00Z' },
            { id: '2', created_at: '2026-10-09T10:00:00Z' },
            { id: '1', created_at: '2026-10-08T10:00:00Z' },
        ])
        expect(days.map(day => [day.date, day.rows.map(r => r.id)])).toEqual([['2026-10-10', ['3']], ['2026-10-09', ['2']], ['2026-10-08', ['1']]])
    })
})

describe('how long yarn lasts', () => {
    it('reads days, weeks or months at the daily use', () => {
        expect(lastsFor(11.94, 2.81)).toEqual({ unit: 'days', count: 4 })
        expect(lastsFor(87.13, 2.01)).toEqual({ unit: 'weeks', count: 6 })
        expect(lastsFor(165.64, 1.0)).toEqual({ unit: 'months', count: 6 })
        expect(lastsFor(0.5, 2)).toEqual({ unit: 'underDay', count: 0 })
        expect(lastsFor(100, 0)).toBeNull()
    })

    it('lists each fabric that draws on a yarn, with its role', () => {
        const qualities: YarnQuality[] = [
            { id: 'q1', quality_label: 'D.345', quality_key: 'd.345', meters: 860, costing_id: 'c1', version: 1, recipe: [{ yarn_name: 'jari', yarn_key: 'jari', kg_per_100m: 5.87, role: 'warp' }, { yarn_name: '40 span', yarn_key: '40 span', kg_per_100m: 4.19, role: 'weft' }] },
            { id: 'q2', quality_label: 'Plain', quality_key: 'plain', meters: 0, costing_id: null, version: 0, recipe: null },
        ]
        expect(yarnFeeds('jari', qualities)).toEqual([{ qualityId: 'q1', quality: 'D.345', role: 'warp', kgPer100m: 5.87 }])
        expect(yarnFeeds('cotton', qualities)).toEqual([])
    })
})

describe('server reads', () => {
    it('reads activity only for the stock pages, alongside the board, scoped to the owner org', () => {
        const fabric = read('app/(dashboard)/owner/stock/actions.ts')
        expect(fabric).toContain("from('quality_stock_movements')")
        expect(fabric).toContain(".eq('org_id', orgId).gte('created_at', activitySince())")
        expect(fabric).toContain('parsed.data.activity === true && !parsed.data.qualityId && !parsed.data.cursor')
        expect(fabric).toContain('Promise.all([')
        const yarn = read('app/(dashboard)/owner/stock/yarn-actions.ts')
        expect(yarn).toContain("from('yarn_stock_movements')")
        expect(yarn).toContain('parsed.data.activity === true && !parsed.data.asOf && !parsed.data.yarnId && !parsed.data.cursor')
        expect(read('app/(dashboard)/owner/stock/page.tsx')).toContain('getQualityStockBoard({ activity: true })')
        expect(read('app/(dashboard)/owner/stock/yarn/page.tsx')).toContain('getYarnStockBoard({ activity: true })')
        // Dispatches only needs the quality list.
        expect(read('app/(dashboard)/owner/dispatches/page.tsx')).toContain('getQualityStockBoard(),')
    })
})
