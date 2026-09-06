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

describe('Rate Book P2: 5-Column Streamlined Table Layout in RatesClient.tsx', () => {
    const client = read('app/(dashboard)/owner/rates/RatesClient.tsx')

    it('uses a 5-column colgroup totaling 100% width with 24% yarn name column', () => {
        expect(client).toContain('<col className="w-[24%]" />')
        expect(client).toContain('<col className="w-[18%]" />')
        expect(client).toContain('<col className="w-[22%]" />')

        // 7-column old widths must not be present
        expect(client).not.toContain('<col className="w-[13%]" />')
        expect(client).not.toContain('<col className="w-[11%]" />')
        expect(client).not.toContain('<col className="w-[10%]" />')
        expect(client).not.toContain('<col className="w-[15%]" />')
        expect(client).not.toContain('<col className="w-[23%]" />')
    })

    it('has 5 consolidated headers', () => {
        expect(client).toContain("tx('Yarn / Quality')")
        expect(client).toContain("tx('Current Rate & Trend')")
        expect(client).toContain("tx('Review Status')")
        expect(client).toContain("tx('Source & Linked Qualities')")
        expect(client).toContain("tx('Actions')")
    })

    it('integrates PriceDeltaBadge in both desktop table and mobile card', () => {
        expect(client).toContain('function PriceDeltaBadge(')
        expect(client).toContain('<PriceDeltaBadge currentValue={rate.current_value} previousValue={rate.previous_value} unit={rate.unit} />')
        expect(client).toContain('TrendingUp')
        expect(client).toContain('TrendingDown')
        expect(client).toContain('Minus')
    })

    it('replaces bulky two-box mobile card rate layout with inline price & delta badge', () => {
        // Old separate "Previous rate" box in mobile cards is removed
        expect(client).not.toContain('<p className="text-[10px] font-bold uppercase tracking-wide text-subtle">Previous rate</p>')
        // New inline baseline layout is present
        expect(client).toContain('font-mono text-xl font-black tracking-tight text-ink')
        expect(client).toContain('Effective {formatDateOnly(rate.effective_date')
    })
})
