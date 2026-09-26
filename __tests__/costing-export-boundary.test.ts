import { describe, expect, it } from 'vitest'
import { calcFullTotals } from '@/lib/estimator'
import {
    buildCostingPrintHtml,
    buildQuotationShareMessage,
    createCostingExportModel,
    validateCostingExportInput,
    type CostingExportOptions,
} from '@/lib/estimator-export'
import { F1, f1State } from './fixtures/costing-characterization'

// Refactor Package 1A, C-INV-23: a customer quotation shows the quoted price,
// quantity and value only. Existing tests check that internal labels are
// absent; these check that internal amounts cannot leak either.

const state = f1State()
const model = createCostingExportModel({
    qualityLabel: '60 GSM Georgette',
    createdAt: '2026-09-26T06:00:00.000Z',
    state,
    totals: calcFullTotals(state),
})

const base: CostingExportOptions = {
    mode: 'customer',
    businessName: 'Test Weaving Works',
    customerName: 'Test Party',
    validUntil: '2026-10-31',
    notes: '',
    showGstNote: true,
    documentReference: 'Q-TEST-1',
}

// The document formats rupees as "Rs " + en-IN digits with two decimals.
const rs = (value: number) => `Rs ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const internalAmounts = {
    productionCostPerM: rs(F1.result.productionCostPerM),
    breakEvenPricePerM: rs(F1.result.breakEvenPricePerM),
    landedCostPerM: rs(F1.result.landedCostPerM),
    commissionPerM: rs(F1.result.commissionPerM),
    profitPerM: rs(F1.result.profitPerM),
    expectedProfitTotal: rs(F1.result.expectedProfitTotal).replace(/\.00$/, ''),
    weavePerM: rs(9.6),
    overheadPerM: rs(2),
}

describe('customer versus internal export boundary (Package 1A)', () => {
    it('INVARIANT: the export model carries the independently derived F1 values', () => {
        expect(model).toMatchObject({
            productionCostPerM: F1.result.productionCostPerM,
            suggestedSellingPricePerM: F1.result.suggestedSellingPricePerM,
            breakEvenPricePerM: F1.result.breakEvenPricePerM,
            landedCostPerM: F1.result.landedCostPerM,
            marginPct: F1.result.actualMarginPct,
            expectedProfit: F1.result.expectedProfitTotal,
            quantityM: 5000,
        })
        expect(validateCostingExportInput(model, base)).toEqual([])
    })

    it('INVARIANT C-INV-23: the customer document shows price, quantity and value but no internal amount', () => {
        const html = buildCostingPrintHtml(model, base)
        expect(html).toContain(`${rs(F1.result.suggestedSellingPricePerM)}/m`)
        expect(html).toContain(rs(F1.result.totalOrderValue))
        for (const [name, amount] of Object.entries(internalAmounts)) {
            expect(html, `${name} (${amount}) must not appear in a customer quotation`).not.toContain(amount)
        }
    })

    it('INVARIANT C-INV-23: the internal cost sheet does show the internal amounts', () => {
        const html = buildCostingPrintHtml(model, { ...base, mode: 'internal' })
        expect(html).toContain(internalAmounts.productionCostPerM)
        expect(html).toContain(internalAmounts.breakEvenPricePerM)
        expect(html).toContain('Rs 18,850')
    })

    it('INVARIANT C-INV-23: the quotation share message carries the price and no cost figure', () => {
        const message = buildQuotationShareMessage(model, base)
        expect(message).toContain(`Price: ${rs(F1.result.suggestedSellingPricePerM)}/m`)
        for (const amount of Object.values(internalAmounts)) expect(message).not.toContain(amount)
    })
})
