import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildCostingResult, calcFullTotals } from '@/lib/estimator'
import {
    buildCostingPrintHtml,
    buildQuotationShareMessage,
    createCostingExportModel,
    describeDocumentSource,
} from '@/lib/estimator-export'
import { BASE_PLAN_PHRASES } from '@/lib/i18n/base-plan-phrases'
import { f1State } from './fixtures/costing-characterization'

// LT06 (LC39, LC41): the export says what it is built from, and the customer
// file and share text carry only customer fields.

const interpolate = (text: string, values: Record<string, string | number>) =>
    text.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match))

describe('describeDocumentSource', () => {
    const saved = { kind: 'saved' as const, qualityLabel: 'Poplin 58"', version: 3, savedAt: '2026-10-04T06:30:00.000Z' }

    it('names the saved costing, its version and save date', () => {
        const customer = describeDocumentSource(saved, 'customer')
        expect(interpolate(customer.text, customer.values)).toBe('Customer quotation · based on Poplin 58" costing v3 · saved 4 Oct 2026')
        const internal = describeDocumentSource(saved, 'internal')
        expect(interpolate(internal.text, internal.values)).toBe('Internal cost sheet · based on Poplin 58" costing v3 · saved 4 Oct 2026')
    })

    it('says plainly when the document comes from unsaved working inputs', () => {
        expect(describeDocumentSource({ kind: 'working' }, 'internal').text).toBe('Internal estimate · unsaved working inputs')
        expect(describeDocumentSource({ kind: 'working' }, 'customer').text).toBe('Customer quotation · unsaved working inputs')
    })

    it('has Hindi and Gujarati for each source line', () => {
        for (const kind of ['saved', 'working'] as const) {
            for (const mode of ['customer', 'internal'] as const) {
                const { text } = describeDocumentSource(kind === 'saved' ? saved : { kind }, mode)
                expect(BASE_PLAN_PHRASES.hi[text], text).toBeTruthy()
                expect(BASE_PLAN_PHRASES.gu[text], text).toBeTruthy()
            }
        }
    })
})

describe('the export dialog shows the source from its callers', () => {
    const dialog = readFileSync('components/estimator/CostingExportDialog.tsx', 'utf8')
    const estimator = readFileSync('app/(dashboard)/owner/estimator/EstimatorClient.tsx', 'utf8')
    const quotes = readFileSync('app/(dashboard)/owner/quotes/QuotesClient.tsx', 'utf8')

    it('renders the line for the current mode', () => {
        expect(dialog).toContain('data-document-source')
        expect(dialog).toContain('describeDocumentSource(documentSource, mode)')
    })

    it('passes the saved receipt or the working inputs from the estimator', () => {
        expect(estimator).toContain("documentSource={exportSavedCosting && lastSavedCosting ? { kind: 'saved', qualityLabel: lastSavedCosting.model.qualityLabel, version: lastSavedCosting.version, savedAt: lastSavedCosting.savedAt } : { kind: 'working' }}")
    })

    it('passes the saved row from Saved Costings', () => {
        expect(quotes).toContain("documentSource={{ kind: 'saved', qualityLabel: quoteToExport.quality_label ?? exportModel?.qualityLabel ?? '', version: Number(quoteToExport.version_number ?? 1), savedAt: quoteToExport.created_at }}")
    })

    it('never sends internal notes to the customer file', () => {
        expect(dialog).toContain("notes: mode === 'customer' ? customerTerms : internalNotes")
    })
})

describe('customer output carries only customer fields', () => {
    const estimate = f1State()
    const totals = calcFullTotals(estimate)
    const model = createCostingExportModel({ state: estimate, totals, result: buildCostingResult(estimate, totals), qualityLabel: 'F1 Shirting', createdAt: '2026-10-04T00:00:00Z' })
    const options = { mode: 'customer' as const, businessName: 'Acme', customerName: 'Buyer', validUntil: '2026-11-01', notes: 'Delivery in 3 weeks', showGstNote: false, documentReference: 'F1 · v1' }
    // The document's own format (lib/estimator-export.ts money()).
    const money = (value: number) => `Rs ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    it('keeps cost values, yarn names and rates out of the customer file', () => {
        const html = buildCostingPrintHtml(model, options)
        for (const value of [model.productionCostPerM, model.breakEvenPricePerM, model.landedCostPerM]) {
            expect(html).not.toContain(money(value))
        }
        for (const row of [...estimate.warpRows, ...estimate.weftRows]) {
            if (row.label) expect(html).not.toContain(row.label)
            expect(html).not.toContain(`${row.yarnRate}/kg`)
        }
        expect(html).toContain(money(model.suggestedSellingPricePerM))
    })

    it('builds share text from an allowlist of customer lines', () => {
        const lines = buildQuotationShareMessage(model, options).split('\n')
        expect(lines.map(line => line.split(':')[0].split(' ')[0])).toEqual(['Quotation', 'For', 'Quality', 'Price', 'Quantity', 'Valid', 'PDF'])
        expect(lines.join('\n')).not.toContain(money(model.productionCostPerM))
        expect(lines.join('\n')).not.toMatch(/margin|profit|break-even|cost/i)
    })
})
