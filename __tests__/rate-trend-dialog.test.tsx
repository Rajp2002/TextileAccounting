import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

const state = vi.hoisted(() => ({ language: 'en' as 'en' | 'hi' | 'gu' }))
vi.mock('@/lib/i18n/context', () => ({
    useTranslation: () => ({ language: state.language, tx: (phrase: string) => phrase, t: (key: string) => key }),
}))

import { RateTrendChart } from '../components/rates/RateTrendChart'
import { buildRateTrend, type RateTrendRow } from '../lib/rate-trend'
import { RATE_TREND_PHRASES } from '../lib/i18n/rate-trend-phrases'
import { BASE_PLAN_PHRASES } from '../lib/i18n/base-plan-phrases'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

const rows: RateTrendRow[] = [
    { id: 'c', value: 285, previous_value: 280, event_type: 'changed', effective_date: '2026-08-15', created_at: '2026-08-15T06:00:00Z', source: 'Invoice 4411' },
    { id: 'v', value: 280, previous_value: 280, event_type: 'reviewed', effective_date: '2026-07-20', created_at: '2026-07-20T06:00:00Z', source: null },
    { id: 'a', value: 280, previous_value: null, event_type: 'recorded', effective_date: '2026-07-01', created_at: '2026-07-01T06:00:00Z', source: 'Supplier call' },
]

describe('RateTrendChart', () => {
    beforeEach(() => { state.language = 'en' })

    it('renders the whole history as a labelled line chart in its final, static state on the server', () => {
        const trend = buildRateTrend(rows, '2026-10-07')!
        const html = renderToStaticMarkup(<RateTrendChart trend={trend} unit="per_kg" yarnName="30/1000 MUALTI Cotton" />)
        expect(html).toContain('role="group"')
        expect(html).toContain('Price history chart: 30/1000 MUALTI Cotton')
        // First entry, a flat run to the review, a slope up to the change, then flat to today.
        expect(html).toMatch(/<path[^>]*d="M([\d.]+),([\d.]+) L[\d.]+,\2 L[\d.]+,[\d.]+ H[\d.]+"/)
        expect(html).not.toContain('stroke-dashoffset')
    })

    it('offers every point to keyboard and screen reader users, with one tab stop and arrow keys between points', () => {
        const trend = buildRateTrend(rows, '2026-10-07')!
        const html = renderToStaticMarkup(<RateTrendChart trend={trend} unit="per_kg" yarnName="Cotton" />)
        expect(html.match(/role="button"/g)).toHaveLength(3)
        expect(html.match(/tabindex="0"/g)).toHaveLength(1)
        expect(html.match(/tabindex="-1"/g)).toHaveLength(2)
        expect(html).toMatch(/aria-label="1 Jul 2026, ₹280\.00\/kg, First entry"/)
        expect(html).toMatch(/aria-label="20 Jul 2026, ₹280\.00\/kg, Reviewed, price unchanged"/)
        expect(html).toMatch(/aria-label="15 Aug 2026, ₹285\.00\/kg, Price changed"/)
        expect(read('components/rates/RateTrendChart.tsx')).toContain("'ArrowRight'")
    })

    it('shows the key to the markers', () => {
        const trend = buildRateTrend(rows, '2026-10-07')!
        const html = renderToStaticMarkup(<RateTrendChart trend={trend} unit="per_kg" yarnName="Cotton" />)
        expect(html).toContain('Price changed')
        expect(html).toContain('Reviewed, price unchanged')
        expect(html).toContain('Current')
        const noReviews = renderToStaticMarkup(<RateTrendChart trend={buildRateTrend([rows[0], rows[2]], '2026-10-07')!} unit="per_kg" yarnName="Cotton" />)
        expect(noReviews).not.toContain('Reviewed, price unchanged')
    })

    it('labels the axis in the owner language', () => {
        state.language = 'hi'
        const trend = buildRateTrend(rows, '2026-10-07')!
        const html = renderToStaticMarkup(<RateTrendChart trend={trend} unit="per_kg" yarnName="Cotton" />)
        expect(html).toMatch(/[\u0900-\u097F]/)
        expect(html).not.toMatch(/>(Jul|Aug|Sep|Oct)</)
    })

    it('charts a yarn whose only history row is its first edit, starting from the price it had before', () => {
        const edited: RateTrendRow[] = [
            { id: 'edit', value: 125, previous_value: 118, event_type: 'changed', effective_date: '2026-10-07', created_at: '2026-10-07T06:00:00Z', source: null },
        ]
        const trend = buildRateTrend(edited, '2026-10-09')!
        const html = renderToStaticMarkup(<RateTrendChart trend={trend} unit="per_kg" yarnName="jari" />)
        expect(html.match(/role="button"/g)).toHaveLength(2)
        expect(html).toMatch(/aria-label="7 Oct 2026, ₹118\.00\/kg, Rate before first change"/)
        expect(html).toMatch(/aria-label="7 Oct 2026, ₹125\.00\/kg, Price changed"/)
        // From the old price up to the new one on the same day, then flat to today.
        expect(html).toMatch(/<path[^>]*d="M[\d.]+,[\d.]+ L[\d.]+,[\d.]+ H[\d.]+"[^>]*stroke-linejoin/)
    })

    it('shows an entry made today as a point, not a line running to the edge of the chart', () => {
        const trend = buildRateTrend([rows[2]], '2026-07-01')!
        const html = renderToStaticMarkup(<RateTrendChart trend={trend} unit="per_kg" yarnName="Cotton" />)
        expect(html).toMatch(/<path[^>]*d="M[\d.]+,[\d.]+"[^>]*stroke-linejoin/)
    })

    it('runs a single older entry flat to today', () => {
        const trend = buildRateTrend([rows[2]], '2026-10-07')!
        const html = renderToStaticMarkup(<RateTrendChart trend={trend} unit="per_kg" yarnName="Cotton" />)
        expect(html).toMatch(/<path[^>]*d="M[\d.]+,[\d.]+ H[\d.]+"[^>]*stroke-linejoin/)
    })

    it('draws a single entry without crashing', () => {
        const trend = buildRateTrend([rows[2]], '2026-07-01')!
        expect(() => renderToStaticMarkup(<RateTrendChart trend={trend} unit="per_kg" yarnName="Cotton" />)).not.toThrow()
    })
})

describe('Rate Book price-history wiring', () => {
    const rates = read('app/(dashboard)/owner/rates/RatesClient.tsx')
    const dialog = read('components/rates/RateTrendDialog.tsx')
    const chart = read('components/rates/RateTrendChart.tsx')

    it('makes the rate and trend area a real button on the yarn card', () => {
        const cell = rates.slice(rates.indexOf('<div data-ratebook-field="rateAndTrend"'), rates.indexOf('<div data-ratebook-field="linkedQualitiesPopover">'))
        expect(cell).toContain('<button')
        expect(cell).toContain('type="button"')
        expect(cell).toContain("openHistory(rate, 'trend')")
        expect(cell).toContain("tx('View price history')")
        expect(cell).toContain('<PriceChange rate={rate}')
        expect(rates.match(/data-ratebook-field="rateAndTrend"/g)).toHaveLength(1)
    })

    it('opens the price-history chart from the Activity button as well as the price', () => {
        const actions = rates.slice(rates.indexOf("{tx('Edit rate')}"), rates.indexOf("{tx('Activity')}"))
        expect(actions).toContain("openHistory(rate, 'trend')")
        expect(actions).not.toMatch(/openHistory\(rate\)/)
    })

    it('opens the trend modal or the activity sheet from one shared history fetch', () => {
        expect(rates).toContain("useState<'activity' | 'trend'>('activity')")
        expect(rates).toMatch(/<Sheet open=\{Boolean\(historyRate\) && historyMode === 'activity'\}/)
        expect(rates).toContain('<RateTrendDialog')
        expect(rates).toContain("historyMode === 'trend'")
        expect(rates).toContain("setHistoryMode('activity')")
        expect(rates.match(/getCostRateHistory\(/g)).toHaveLength(1)
    })

    it('keeps the sample row on its existing toast instead of fetching history', () => {
        const openHistory = rates.slice(rates.indexOf('const openHistory'), rates.indexOf('const handleArchive'))
        expect(openHistory.indexOf('isSampleRecordId(rate.id)')).toBeGreaterThan(-1)
        expect(openHistory.indexOf('isSampleRecordId(rate.id)')).toBeLessThan(openHistory.indexOf('getCostRateHistory'))
    })

    it('titles the modal with the yarn name and fits the axis to the history via the shared maths', () => {
        expect(dialog).toContain('<DialogTitle')
        expect(dialog).toContain('rate.name')
        expect(dialog).toContain('buildRateTrend(')
        expect(dialog).toContain('getSuratTodayString()')
        expect(dialog).toContain('onOpenActivity')
        expect(chart).toContain('buildYAxis(')
        expect(chart).toContain('buildTimeTicks(')
        expect(chart).toContain('buildLinePath(')
    })

    it('draws the line on only when motion is allowed, and leaves it static afterwards', () => {
        expect(chart).toContain('prefers-reduced-motion: reduce')
        expect(chart).toContain('requestAnimationFrame')
        expect(chart).toContain('cancelAnimationFrame')
        expect(chart).toContain('getPointAtLength')
        expect(chart).toContain("strokeDasharray = 'none'")
    })

    it('adds no charting dependency', () => {
        const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> }
        expect(Object.keys(pkg.dependencies).filter(name => /chart|d3|visx|victory|nivo/i.test(name))).toEqual([])
    })
})

describe('price-history translations', () => {
    // Already translated elsewhere in the app, so not repeated in the phrase file.
    const translatedElsewhere = new Set(['Current', 'Close', 'Rate'])
    const literalsIn = (file: string) => [...read(file).matchAll(/\btx\('((?:[^'\\]|\\.)+)'\)/g)].map(match => match[1].replace(/\\'/g, "'"))
    const literals = [...new Set([
        ...literalsIn('components/rates/RateTrendDialog.tsx'),
        ...literalsIn('components/rates/RateTrendChart.tsx'),
        'View price history',
    ])]

    it('guards the strings it is meant to guard', () => {
        expect(literals).toEqual(expect.arrayContaining(['View price history', 'Price history', 'Since first entry', 'Full activity', 'First entry', 'Price changes']))
        expect(read('app/(dashboard)/owner/rates/RatesClient.tsx')).toContain("tx('View price history')")
    })

    it.each(['hi', 'gu'] as const)('has a non-empty %s translation for every new string', language => {
        for (const phrase of literals.filter(literal => !translatedElsewhere.has(literal))) {
            expect(RATE_TREND_PHRASES[language][phrase], `${language}: ${phrase}`).toBeTruthy()
            expect(BASE_PLAN_PHRASES[language][phrase], `${language} is registered: ${phrase}`).toBe(RATE_TREND_PHRASES[language][phrase])
        }
    })
})
