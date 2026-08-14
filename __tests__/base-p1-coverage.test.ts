import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Base P1 production coverage contracts', () => {
    it('documents the linked-yarn rename policy and keeps mobile archive reachable', () => {
        const rates = read('app/(dashboard)/owner/rates/RatesClient.tsx')

        expect(rates).toContain('Linked-yarn rename policy:')
        expect(rates).toContain('add a new rate with the replacement name and update saved qualities intentionally')
        expect(rates).toContain('disabled={Boolean(draft.id)}')
        expect(rates).toContain("aria-label={`${archived ? 'Restore rate' : 'Archive rate'} ${rate.name}`}")
        expect(rates).toContain('Archive rate')
    })

    it('keeps warp/weft blend add-remove controls and optional section activation explicit', () => {
        const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
        const settings = read('components/settings/factory-cost-profile.tsx')

        expect(estimator).toContain("case 'ADD_WARP_ROW'")
        expect(estimator).toContain("case 'ADD_WEFT_ROW'")
        expect(estimator).toContain("if (state.warpRows.length <= 1) return state")
        expect(estimator).toContain("if (state.weftRows.length <= 1) return state")
        expect(estimator).toContain('aria-label={`Remove ${title}`}')
        expect(estimator).toContain("t('estimator.warp.add_blend')")
        expect(estimator).toContain("t('estimator.weft.add_weft')")
        expect(estimator).toContain("type: 'ENABLE_SECTION'")
        expect(settings).toContain('function OptionalAssumptionDisclosure')
        expect(settings).toContain('onCheckedChange={onEnabledChange}')
        expect(settings).toContain('enabled_sections: sections')
    })

    it('exposes costing archive and restore in the Base quality library', () => {
        const quotes = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')
        const actions = read('app/(dashboard)/owner/estimator/actions.ts')

        expect(quotes).toContain('onToggleArchived: (quote: QuoteRow) => void')
        expect(quotes).toContain('onToggleArchived={requestArchiveState}')
        expect(quotes).toContain("latest.is_archived ? 'Restore snapshot' : 'Archive snapshot'")
        expect(quotes).toContain("record.is_archived ? 'Restore snapshot' : 'Archive snapshot'")
        expect(quotes).toContain('Boolean(quote.is_archived) === showArchived')
        expect(actions).toContain('updateSavedCostingLibraryState')
        expect(actions).toContain('This costing changed in another tab. Refresh Saved Costings and try again.')
    })
})
