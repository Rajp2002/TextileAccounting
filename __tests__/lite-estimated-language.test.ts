import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BASE_PLAN_PHRASES } from '@/lib/i18n/base-plan-phrases'
import { buildCostingResult, calcFullTotals } from '@/lib/estimator'
import { buildCostingPrintHtml, createCostingExportModel } from '@/lib/estimator-export'
import { f1State } from './fixtures/costing-characterization'

// LT05 (LC13): a live or saved costing is an estimate. "Actual margin" and
// "Costing valid" claimed realised profit and verified inputs.

const estimator = readFileSync('app/(dashboard)/owner/estimator/EstimatorClient.tsx', 'utf8')
const quotes = readFileSync('app/(dashboard)/owner/quotes/QuotesClient.tsx', 'utf8')

describe('estimated economics wording', () => {
    it('labels the live margin as an estimate at the shown price', () => {
        expect(estimator).not.toContain('Actual margin')
        expect(estimator.match(/>Estimated margin at this price</g)?.length).toBeGreaterThanOrEqual(1)
    })

    it('says an estimate is ready for review instead of calling the costing valid', () => {
        expect(estimator).not.toContain("label: 'Costing valid'")
        expect(estimator).toContain("label: 'Estimate ready for review'")
    })

    it('labels the saved comparison margin as estimated', () => {
        expect(quotes).not.toContain("label: 'Actual margin'")
        expect(quotes).toContain("label: 'Estimated margin'")
    })

    it('uses the same label on the internal cost sheet and keeps margins off the customer quotation', () => {
        const estimate = f1State()
        const totals = calcFullTotals(estimate)
        const model = createCostingExportModel({ state: estimate, totals, result: buildCostingResult(estimate, totals), qualityLabel: 'F1', createdAt: '2026-10-04T00:00:00Z' })
        const internal = buildCostingPrintHtml(model!, { mode: 'internal', businessName: 'Acme', customerName: '', validUntil: '', notes: '', showGstNote: false })
        const customer = buildCostingPrintHtml(model!, { mode: 'customer', businessName: 'Acme', customerName: 'Buyer', validUntil: '2026-11-01', notes: '', showGstNote: false })
        expect(internal).toContain('Estimated margin at this price')
        expect(internal).not.toContain('Actual margin')
        expect(customer).not.toContain('Estimated margin')
        expect(customer).not.toContain('Actual margin')
    })

    it('has Hindi and Gujarati for each new label', () => {
        for (const phrase of ['Estimated margin at this price', 'Estimated margin', 'Estimate ready for review']) {
            expect(BASE_PLAN_PHRASES.hi[phrase], phrase).toBeTruthy()
            expect(BASE_PLAN_PHRASES.gu[phrase], phrase).toBeTruthy()
        }
        expect(BASE_PLAN_PHRASES.hi['Actual margin']).toBeUndefined()
    })
})
