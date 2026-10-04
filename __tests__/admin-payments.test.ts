import { describe, expect, it } from 'vitest'
import { formatMinor, intervalCovered, parsePaymentPeriod, summarizeBillingFacts, type BillingCoverage, type BillingFact } from '@/lib/admin/payments-domain'

const period = { from: '2026-09-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' }
const coverage: BillingCoverage = { provider: 'razorpay', providerAccountId: 'synthetic', mode: 'live', currency: 'INR', periodStart: period.from, periodEnd: period.to, captureState: 'complete', refundState: 'complete', checkedAt: period.to, conflictsCount: 0 }
const fact = (id: string, amountMinor: string, patch: Partial<BillingFact> = {}): BillingFact => ({ id, kind: 'capture', provider: 'razorpay', providerAccountId: 'synthetic', providerObjectId: id, orgId: 'synthetic-org', paymentReference: id, currency: 'INR', amountMinor, taxMinor: null, occurredAt: '2026-09-15T00:00:00.000Z', recordedAt: period.to, timeBasis: 'provider_verified', mode: 'live', verificationState: 'verified', cohort: 'production', planAtSale: 'lite', purchaseType: 'initial_purchase', evidenceRef: 'synthetic-fixture', ...patch })

describe('AD07 verified collection facts', () => {
    it('matches the specified gross/refund/net fixture and deduplicates provider identities', () => {
        const a = fact('lite', '299900'), b = fact('base', '999900'), refund = fact('refund1', '100000', { kind: 'refund' })
        const result = summarizeBillingFacts([a, b, { ...a, id: 'duplicate' }, refund, fact('test', '500000', { mode: 'test' })], [coverage], period)
        expect(result).toMatchObject({ knownGrossMinor: '1299800', knownRefundMinor: '100000', netMinor: '1199800', captureCount: 2, refundCount: 1, excludedCount: 1 })
        expect(formatMinor(result.knownGrossMinor)).toBe('₹12,998.00')
    })
    it('preserves capture facts with several partial refunds and allows negative period net', () => {
        const capture = fact('older-capture', '299900', { occurredAt: '2026-08-15T00:00:00Z' })
        const result = summarizeBillingFacts([capture, fact('partial1', '100000', { kind: 'refund' }), fact('partial2', '199900', { kind: 'refund' })], [coverage], period)
        expect(result).toMatchObject({ knownGrossMinor: '0', knownRefundMinor: '299900', netMinor: '-299900', refundCount: 2 })
        expect(summarizeBillingFacts([capture], [{ ...coverage, periodStart: '2026-08-01T00:00:00.000Z' }], { from: '2026-08-01T00:00:00.000Z', to: period.from }).knownGrossMinor).toBe('299900')
    })
    it('does not treat pending/issued local refund requests as processed refund facts', () => {
        const pending = fact('pending', '100000', { kind: 'refund', verificationState: 'unverified', timeBasis: 'local_recorded' })
        expect(summarizeBillingFacts([fact('capture', '299900'), pending], [coverage], period)).toMatchObject({ knownGrossMinor: '299900', knownRefundMinor: '0', netMinor: null, unverifiedMinor: '100000' })
    })
    it('does not infer live mode, factory classification, capture timestamp or tax', () => {
        const unknowns = [fact('mode', '1', { mode: 'unknown' }), fact('time', '2', { occurredAt: null, timeBasis: 'unknown' }), fact('unclassified', '3', { cohort: 'unclassified' }), fact('conflict', '4', { verificationState: 'conflict' })]
        expect(summarizeBillingFacts(unknowns, [coverage], period)).toMatchObject({ knownGrossMinor: '0', unverifiedMinor: '10', unverifiedCount: 4, netMinor: null })
        expect(summarizeBillingFacts([fact('known', '11800', { taxMinor: '1800' }), fact('unknown-tax', '11800')], [coverage], period)).toMatchObject({ taxExclusiveKnownMinor: '10000', taxExcludedMinor: '11800' })
    })
    it('applies half-open provider-time bounds and keeps currencies separate', () => {
        expect(summarizeBillingFacts([fact('start', '1', { occurredAt: period.from }), fact('end', '2', { occurredAt: period.to }), fact('USD', '100', { currency: 'USD' })], [coverage], period)).toMatchObject({ knownGrossMinor: '1', captureCount: 1, excludedCount: 1 })
    })
    it('handles minor units beyond Number safe precision without rounding', () => {
        expect(summarizeBillingFacts([fact('large', '9007199254740993'), fact('small', '7')], [coverage], period).knownGrossMinor).toBe('9007199254741000')
        expect(formatMinor('-100001')).toBe('−₹1,000.01')
    })
    it('makes conflicting duplicates visible instead of choosing a convenient amount', () => {
        expect(summarizeBillingFacts([fact('same', '100'), fact('same', '200')], [coverage], period)).toMatchObject({ knownGrossMinor: '0', unverifiedCount: 1, netMinor: null })
    })
})

describe('AD07 independent coverage', () => {
    it('withholds complete totals with absent evidence, even for a measured empty projection', () => {
        expect(summarizeBillingFacts([], [], period)).toMatchObject({ knownGrossMinor: '0', knownRefundMinor: '0', grossState: 'partial', refundState: 'partial', netMinor: null })
        expect(summarizeBillingFacts([], [coverage], period)).toMatchObject({ netMinor: '0', grossState: 'complete', refundState: 'complete' })
    })
    it('requires both independent feeds, no conflicts and every known provider account', () => {
        expect(summarizeBillingFacts([fact('a', '1')], [{ ...coverage, refundState: 'unknown' }], period).netMinor).toBeNull()
        expect(summarizeBillingFacts([fact('a', '1')], [coverage], period, true).netMinor).toBeNull()
        expect(summarizeBillingFacts([fact('a', '1'), fact('b', '1', { providerAccountId: 'other' })], [coverage], period).netMinor).toBeNull()
        expect(intervalCovered([{ ...coverage, conflictsCount: 1 }], period.from, period.to, 'capture')).toBe(false)
    })
    it('joins adjacent intervals but rejects a one-millisecond gap or only partial coverage', () => {
        const midpoint = '2026-09-15T00:00:00.000Z'
        const spans = [{ ...coverage, periodEnd: midpoint }, { ...coverage, periodStart: midpoint }]
        expect(intervalCovered(spans, period.from, period.to, 'refund')).toBe(true)
        expect(intervalCovered([spans[0], { ...spans[1], periodStart: '2026-09-15T00:00:00.001Z' }], period.from, period.to, 'refund')).toBe(false)
        expect(intervalCovered([{ ...coverage, captureState: 'partial' }], period.from, period.to, 'capture')).toBe(false)
    })
    it('cannot hide conflicting overlapping coverage behind an older complete record', () => {
        const contradicted = { ...coverage, captureState: 'partial' as const, refundState: 'partial' as const, checkedAt: '2026-10-02T00:00:00Z', conflictsCount: 1 }
        expect(intervalCovered([coverage, contradicted], period.from, period.to, 'capture')).toBe(false)
        expect(intervalCovered([coverage, contradicted], period.from, period.to, 'refund')).toBe(false)
        expect(summarizeBillingFacts([fact('capture', '299900')], [coverage, contradicted], period)).toMatchObject({ grossState: 'partial', refundState: 'partial', netMinor: null })
        // Unrelated periods do not invalidate this period's evidence.
        expect(intervalCovered([coverage, { ...contradicted, periodStart: period.to, periodEnd: '2026-11-01T00:00:00Z' }], period.from, period.to, 'capture')).toBe(true)
    })
})

describe('AD07 query contracts', () => {
    const now = new Date('2026-10-04T12:00:00Z')
    it('defaults to a bounded trailing period and preserves explicit instants', () => {
        expect(parsePaymentPeriod({}, now)).toMatchObject({ from: '2026-09-04T12:00:00.000Z', to: now.toISOString(), timezone: 'Asia/Kolkata', limit: 25 })
        expect(parsePaymentPeriod({ from: '2026-09-01T05:30:00+05:30', to: period.to }, now).from).toBe(period.from)
    })
    it.each([{ limit: 101 }, { currency: 'USD' }, { sort: 'amount' }, { to: '2026-10-05T00:00:00Z' }, { from: period.to, to: period.from }, { from: '2025-01-01T00:00:00Z', to: period.to }, { cursor: 'invalid' }])('denies invalid/ambiguous queries: %j', query => {
        expect(() => parsePaymentPeriod(query, now)).toThrow()
    })
})
