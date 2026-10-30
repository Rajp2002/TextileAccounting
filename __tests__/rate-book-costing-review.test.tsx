import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RateBookCostingReview } from '@/components/estimator/RateBookCostingReview'
import { costingCatalogueText } from '@/lib/i18n/costing-catalogue'
import type { RateBookDriftItem } from '@/lib/yarn-rate-propagation'

const item: RateBookDriftItem = {
    id: 'costing-1', qualityLabel: 'Cotton Sheeting', partyName: null, versionNumber: 2,
    updatedAt: '2026-10-30T00:00:00Z', templateId: null,
    changes: [
        { layer: 'warp', index: 0, name: '75D Polyester', from: 113, to: 120 },
        { layer: 'weft', index: 1, name: '150D Viscose', from: 170, to: 180 },
    ],
    before: { productionCostPerM: 25.10, sellingPricePerM: 30 },
    after: { productionCostPerM: 25.59, sellingPricePerM: 31 },
}

function render(overrides: Partial<Parameters<typeof RateBookCostingReview>[0]> = {}) {
    return renderToStaticMarkup(<RateBookCostingReview
        item={item} copy={costingCatalogueText.en} warpLabel="Warp" weftLabel="Weft"
        savedMargin={12} selectable={false} selected disabled={false} onToggle={() => {}}
        {...overrides}
    />)
}

describe('yarn-rate review comparisons', () => {
    it('shows each changed yarn and the combined production cost without an extra selection for a single costing', () => {
        const html = render()
        const text = html.replace(/<[^>]+>/g, ' ')
        for (const value of ['75D Polyester', 'Warp 1', '₹113', '₹120', '150D Viscose', 'Weft 2', '₹170', '₹180', '₹25.10', '₹25.59', '+₹0.49/m', 'v2 → v3']) expect(html).toContain(value)
        expect(text).toContain('Production cost')
        expect(text).toContain('Price to keep 12.0% margin')
        expect(html).not.toContain('type="checkbox"')
    })

    it('keeps selection available in bulk review and respects saving state', () => {
        expect(render({ selectable: true })).toMatch(/type="checkbox"[^>]*checked=""/)
        expect(render({ selectable: true, selected: false, disabled: true })).toMatch(/type="checkbox"[^>]*disabled=""/)
        expect(render({ selectable: true, selected: false })).not.toContain('checked=""')
    })

    it('labels decreases and zero changes accurately and omits margin comparisons without a saved margin', () => {
        const cheaper = { ...item, after: { ...item.after, productionCostPerM: 24.61 } }
        expect(render({ item: cheaper })).toContain('−₹0.49/m')
        const equal = { ...item, after: { ...item.after, productionCostPerM: 25.104 } }
        expect(render({ item: equal })).toContain('No cost change')
        expect(render({ savedMargin: null })).not.toContain('Price to keep')
        expect(render({ savedMargin: null })).not.toContain('Margin at')
    })
})
