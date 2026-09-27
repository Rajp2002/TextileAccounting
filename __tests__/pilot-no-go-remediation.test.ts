import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { orderSavedCostingsForComparison } from '../lib/saved-costings'

const root = process.cwd()
const read = (path: string) => readFileSync(`${root}/${path}`, 'utf8')

describe('pilot no-go remediation', () => {
  it('keeps the estimator wizard strict while allowing Lite Settings to save without capacity reference data', () => {
    const wizard = read('app/(dashboard)/owner/estimator/FactoryCostWizard.tsx')
    const actions = read('app/(dashboard)/owner/estimator/actions.ts')

    expect(wizard).toContain('disabled={!capacityInputsReady}')
    expect(wizard).toContain('Enter at least one loom before continuing.')
    expect(wizard).toContain('Enter the standard monthly production used for costing before continuing.')
    expect(wizard).toContain('Enter standard monthly production before reviewing cost')
    expect(actions).toContain('The first-run estimator wizard and production-capable workflows')
    expect(actions).toContain('requireCapacity !== false')
    expect(actions).toContain('Enter at least one loom before saving the monthly factory baseline.')
    expect(actions).toContain('Enter positive working days before saving the monthly factory baseline.')
    expect(actions).toContain('Enter positive daily output per loom before saving the monthly factory baseline.')
  })

  it('keeps comparison direction stable when the user selects New before Old', () => {
    const selectedInReverse = [
      { id: 'new', created_at: '2026-08-02T00:00:00.000Z', version_number: 2 },
      { id: 'old', created_at: '2026-08-01T00:00:00.000Z', version_number: 1 },
    ]

    expect(orderSavedCostingsForComparison(selectedInReverse).map(item => item.id)).toEqual(['old', 'new'])
    expect(read('app/(dashboard)/owner/quotes/QuotesClient.tsx')).toContain('Change is calculated as New minus Old.')
    expect(read('app/(dashboard)/owner/quotes/QuotesClient.tsx')).toContain('Old snapshot')
    expect(read('app/(dashboard)/owner/quotes/QuotesClient.tsx')).toContain('New snapshot')
  })

  it('makes applied waste distinct from the configured default', () => {
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

    expect(estimator).toContain('Default weft waste')
    expect(estimator).toContain('Applied to pricing:')
    expect(estimator).not.toContain('Effective Weft Waste')
  })

  it('gives drafts, quotation status, and updates explicit user-facing controls', () => {
    const autosave = read('hooks/useAutosave.ts')
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const quotes = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')
    const actions = read('app/(dashboard)/owner/estimator/actions.ts')

    expect(autosave).toContain('renameDraft')
    expect(estimator).toContain('aria-label="Restore draft"')
    expect(estimator).toContain('Resume')
    expect(estimator).not.toContain('/> Rename')
    expect(estimator).toContain('> <span>Discard</span></button>')
    // Phase 3H retired the quotation status history and status controls.
    expect(actions).not.toContain('export async function getQuoteStatusHistory')
    expect(quotes).not.toContain('Quotation history')
    expect(quotes).not.toContain('Quotation marked as')
  })

  it('avoids persistent update interruptions and UTC date drift in Rate Book', () => {
    const notice = read('components/pwa-update-notice.tsx')
    const rates = read('app/(dashboard)/owner/rates/RatesClient.tsx')

    expect(notice).toContain('duration: 12000')
    expect(notice).not.toContain('duration: Infinity')
    expect(rates).toContain('getSuratTodayString()')
    expect(rates).not.toContain('new Date().toISOString().slice(0, 10)')
    expect(rates).toContain('Archiving “${pendingRateName}”…')
  })
})
