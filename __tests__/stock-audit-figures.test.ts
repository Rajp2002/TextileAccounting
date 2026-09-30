import { describe, expect, it } from 'vitest'
import { auditVariance, formatAuditQuantity } from '../lib/inventory-audit'

// PI-06: the adjustment the owner is shown must be the one the database applies. The database computes
// round(physical - stock as of the audit date, unit scale); auditVariance is the same figure on the client.
describe('audit variance shown to the owner', () => {
    it('is the counted figure minus the system figure, at the unit scale', () => {
        expect(auditVariance(96, 100, 2)).toBe(-4)
        expect(auditVariance(118, 120.5, 2)).toBe(-2.5)
        expect(auditVariance(73.5, 74, 3)).toBe(-0.5)
        expect(auditVariance(130, 120, 2)).toBe(10)
    })

    it('is null while nothing is counted', () => {
        expect(auditVariance(null, 100, 2)).toBeNull()
        expect(auditVariance(undefined, 100, 2)).toBeNull()
    })

    it('does not leak binary floating point noise', () => {
        expect(auditVariance(0.3, 0.1, 3)).toBe(0.2)
        expect(auditVariance(1.1, 1.0, 3)).toBe(0.1)
    })

    it('rounds like the database, half away from zero, so shown and applied cannot differ in the last digit', () => {
        expect(auditVariance(100.005, 100, 2)).toBe(0.01)
        expect(auditVariance(99.995, 100, 2)).toBe(-0.01)
        expect(auditVariance(96.004, 100, 2)).toBe(-4)
    })
})

describe('audit quantities in each language', () => {
    it('keeps Indian digit grouping and Latin digits in English, Hindi and Gujarati', () => {
        for (const language of ['en', 'hi', 'gu'] as const) {
            expect(formatAuditQuantity(1234567.891, language, 3)).toBe('12,34,567.891')
            expect(formatAuditQuantity(120.5, language, 2)).toBe('120.50')
        }
    })

    it('can show a sign for variances', () => {
        expect(formatAuditQuantity(-2.5, 'en', 2, { signed: true })).toBe('-2.50')
        expect(formatAuditQuantity(4, 'hi', 2, { signed: true })).toBe('+4.00')
        expect(formatAuditQuantity(0, 'gu', 2, { signed: true })).toBe('0.00')
    })
})
