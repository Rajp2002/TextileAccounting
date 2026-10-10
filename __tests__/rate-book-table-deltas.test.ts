import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    getRatePriceDelta,
    type RatePriceDelta,
} from '../lib/cost-rates'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Rate Book P2: getRatePriceDelta calculation & formatting', () => {
    it('handles initial rates when previous_value is null or undefined', () => {
        const deltaNull = getRatePriceDelta(162, null)
        expect(deltaNull).toEqual({
            difference: 0,
            percentChange: null,
            direction: 'initial',
            formattedDifference: 'Initial rate',
            formattedPercent: null,
            previousValueFormatted: null,
        } satisfies RatePriceDelta)

        const deltaUndefined = getRatePriceDelta(235, undefined)
        expect(deltaUndefined.direction).toBe('initial')
        expect(deltaUndefined.formattedDifference).toBe('Initial rate')
        expect(deltaUndefined.previousValueFormatted).toBeNull()
    })

    it('calculates price increase with positive difference, percent, and currency format', () => {
        // ₹158 -> ₹162 (+₹4.00, +2.53% -> '+2.5%')
        const delta = getRatePriceDelta(162, 158, 'per_kg')
        expect(delta.direction).toBe('increased')
        expect(delta.difference).toBe(4)
        expect(delta.percentChange).toBeCloseTo(2.53, 2)
        expect(delta.formattedDifference).toBe('+₹4.00/kg')
        expect(delta.formattedPercent).toBe('+2.5%')
        expect(delta.previousValueFormatted).toBe('₹158.00/kg')
    })

    it('calculates price decrease with negative difference, percent, and currency format', () => {
        // ₹140 -> ₹138 (-₹2.00, -1.43% -> '-1.4%')
        const delta = getRatePriceDelta(138, 140, 'per_kg')
        expect(delta.direction).toBe('decreased')
        expect(delta.difference).toBe(-2)
        expect(delta.percentChange).toBeCloseTo(-1.43, 2)
        expect(delta.formattedDifference).toBe('-₹2.00/kg')
        expect(delta.formattedPercent).toBe('-1.4%')
        expect(delta.previousValueFormatted).toBe('₹140.00/kg')
    })

    it('detects unchanged rates when current_value matches previous_value', () => {
        const delta = getRatePriceDelta(150, 150, 'per_kg')
        expect(delta.direction).toBe('unchanged')
        expect(delta.difference).toBe(0)
        expect(delta.percentChange).toBe(0)
        expect(delta.formattedDifference).toBe('Unchanged')
        expect(delta.formattedPercent).toBeNull()
        expect(delta.previousValueFormatted).toBe('₹150.00/kg')
    })

    it('supports alternative units like per_m and percent cleanly', () => {
        const deltaM = getRatePriceDelta(15, 12, 'per_m')
        expect(deltaM.formattedDifference).toBe('+₹3.00/m')
        expect(deltaM.previousValueFormatted).toBe('₹12.00/m')

        const deltaPct = getRatePriceDelta(5, 7, 'percent')
        expect(deltaPct.formattedDifference).toBe('-2.00%')
        expect(deltaPct.previousValueFormatted).toBe('7.00%')
    })
})

describe('Rate Book board: one card per yarn in RatesClient.tsx', () => {
    const client = read('app/(dashboard)/owner/rates/RatesClient.tsx')
    const card = client.slice(client.indexOf('const renderYarnCard = '), client.indexOf('<PlanAnalyticsBeacon'))

    it('replaces the five-column table and the separate phone card with one card for every width', () => {
        expect(client).not.toContain('<colgroup>')
        expect(client).not.toContain("tx('Current Rate & Trend')")
        expect(client).not.toContain('lg:hidden')
        expect((client.match(/data-ratebook-field="yarnRow"/g) || []).length).toBe(1)
        expect(client).toContain("const yarnCardGrid = 'grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr))]'")
    })

    it('groups the board into Warp and Weft sections with their counts', () => {
        expect(client).toContain('(categoryFilter === \'all\' || tourStep !== null ? YARN_CATEGORIES : [categoryFilter])')
        expect(client).toContain("{section.category === 'yarn_warp' ? copy.warp : copy.weft}")
        expect(client).toContain('{section.rates.map(rate => renderYarnCard(rate, false))}')
    })

    it('reads the price large, its change in words and its trail as a small stepped line', () => {
        expect(card).toContain('{amount}<span className="ml-1 text-base font-medium tracking-normal text-muted-foreground">{suffix}</span>')
        expect(card).toContain('<PriceChange rate={rate} copy={copy} language={language} />')
        expect(card).toContain('priceTrail(rate.price_points ?? [], Number(rate.current_value), todayDate)')
        expect(card).toContain('<PriceTrailSpark trail={trail}')
        const change = client.slice(client.indexOf('function PriceChange('), client.indexOf('export default function RatesClient'))
        expect(change).toContain("delta.direction === 'initial'")
        expect(change).toContain("delta.direction === 'unchanged'")
        expect(change).toContain("rose ? '↑' : '↓'")
    })

    it('keeps PriceDeltaBadge for the quick edit preview', () => {
        expect(client).toContain('function PriceDeltaBadge(')
        expect(client).toContain('<PriceDeltaBadge')
        expect(client).toContain('TrendingUp')
        expect(client).toContain('TrendingDown')
        expect(client).toContain('Minus')
    })

    it('asks a due card to confirm its price instead of showing a status badge', () => {
        expect(card).toContain('fillCopy(copy.stillPrice, { price: formatRateValue(rate.current_value, rate.unit) })')
        expect(card).toContain("due ? 'border-[var(--wv-ochre-200)] bg-[color-mix(in_oklab,var(--wv-ochre-50)_55%,var(--color-surface))]'")
        expect(client).not.toContain('<StatusBadge')
    })
})
