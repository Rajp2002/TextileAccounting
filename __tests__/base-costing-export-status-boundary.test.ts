import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(path, 'utf8')

describe('Base costing export status boundary', () => {
  it('keeps sent status rendering behind the quotation record guard', () => {
    const quotesClient = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')
    const exportDialog = read('components/estimator/CostingExportDialog.tsx')

    // Phase 3H: the quotation workflow is retired, so Saved Costings no longer
    // wires a mark-as-sent handler into the export dialog.
    expect(quotesClient).not.toContain('onMarkAsSent')
    expect(exportDialog).toContain('const savedQuotation = Boolean(sourceQuoteId && sourceRecordKind === \'quotation\')')
    // The owner approved removing "Mark as sent" (2026-09-27): no screen wires a
    // handler, so the button did nothing for legacy draft quotations.
    expect(exportDialog).not.toContain('Mark as sent')
    expect(exportDialog).not.toContain('canMarkSent')
    expect(exportDialog).toContain('PDF sharing does not confirm delivery.')
    expect(exportDialog).toContain('Share PDF')
    expect(exportDialog).toContain('Download PDF')
  })
})
