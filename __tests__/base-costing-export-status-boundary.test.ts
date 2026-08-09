import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { canUseQuotationLifecycle } from '../lib/costing-workspace'

const read = (path: string) => readFileSync(path, 'utf8')

describe('Base costing export status boundary', () => {
  it('recognises quotation lifecycle only for Full Suite quotation records', () => {
    expect(canUseQuotationLifecycle('costing', true)).toBe(false)
    expect(canUseQuotationLifecycle('quotation', false)).toBe(false)
    expect(canUseQuotationLifecycle('quotation', true)).toBe(true)
  })

  it('keeps sent status wiring and rendering behind the quotation record guard', () => {
    const quotesClient = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')
    const exportDialog = read('components/estimator/CostingExportDialog.tsx')

    expect(quotesClient).toContain("quoteToExport.record_kind === 'quotation'")
    expect(quotesClient).toContain('canUseQuotationLifecycle(quoteToExport.record_kind, canUseQuotationWorkflow)')
    expect(exportDialog).toContain('const savedQuotation = Boolean(sourceQuoteId && sourceRecordKind === \'quotation\')')
    expect(exportDialog).toContain('const canMarkSent = savedQuotation')
    expect(exportDialog).toContain('Share PDF')
    expect(exportDialog).toContain('Download PDF')
  })
})
