import { z } from 'zod'

export const BILLING_METRIC_VERSION = 'admin-collections-v1'
export const ADMIN_REPORTING_ZONE = 'Asia/Kolkata'
const DAY_MS = 86_400_000
const instant = z.string().datetime({ offset: true })
const cursorSchema = z.object({ at: instant, id: z.string().uuid() }).strict()

export const paymentQuerySchema = z.object({
    from: instant.optional(), to: instant.optional(),
    timezone: z.enum(['Asia/Kolkata', 'UTC']).default(ADMIN_REPORTING_ZONE),
    currency: z.literal('INR').default('INR'),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().max(240).optional(),
}).strict()

export type PaymentPeriod = { from: string; to: string; timezone: string; currency: 'INR'; limit: number; cursor: { at: string; id: string } | null }

export function parsePaymentPeriod(input: unknown, now = new Date()): PaymentPeriod {
    const value = paymentQuerySchema.parse(input)
    const to = value.to ? new Date(value.to) : now
    const from = value.from ? new Date(value.from) : new Date(to.getTime() - 30 * DAY_MS)
    if (to.getTime() > now.getTime() || from >= to || to.getTime() - from.getTime() > 366 * DAY_MS) {
        throw new Error('Invalid reporting period')
    }
    let cursor = null
    if (value.cursor) {
        try { cursor = cursorSchema.parse(JSON.parse(Buffer.from(value.cursor, 'base64url').toString('utf8'))) }
        catch { throw new Error('Invalid ledger cursor') }
    }
    return { ...value, from: from.toISOString(), to: to.toISOString(), cursor }
}

export type BillingFact = {
    id: string; kind: 'capture' | 'refund'; provider: string; providerAccountId: string;
    providerObjectId: string; orgId: string | null; paymentReference: string | null;
    currency: string; amountMinor: string; taxMinor: string | null; occurredAt: string | null;
    recordedAt: string; timeBasis: 'provider_verified' | 'local_recorded' | 'unknown';
    mode: 'live' | 'test' | 'unknown'; verificationState: 'verified' | 'unverified' | 'conflict';
    cohort: 'production' | 'test' | 'demo' | 'internal' | 'unclassified';
    planAtSale: string | null; purchaseType: string | null; evidenceRef: string | null;
}

export type BillingCoverage = {
    provider: string; providerAccountId: string; mode: 'live' | 'test' | 'unknown'; currency: string;
    periodStart: string; periodEnd: string; captureState: 'complete' | 'partial' | 'unknown';
    refundState: 'complete' | 'partial' | 'unknown'; checkedAt: string; conflictsCount: number;
}

/** Coverage must join without gaps. A single complete row is not evidence for an uncovered interval. */
export function intervalCovered(rows: BillingCoverage[], from: string, to: string, kind: 'capture' | 'refund'): boolean {
    const start = Date.parse(from), end = Date.parse(to)
    const relevant = rows.filter(row => row.mode === 'live' && row.currency === 'INR'
        && Date.parse(row.periodStart) < end && Date.parse(row.periodEnd) > start)
    // No supersession authority exists in v1. A contradictory reconciliation
    // cannot disappear because an older complete row also covers the interval.
    if (relevant.some(row => row.conflictsCount > 0)) return false
    const spans = relevant.filter(row => row.conflictsCount === 0
        && (kind === 'capture' ? row.captureState : row.refundState) === 'complete')
        .map(row => [Date.parse(row.periodStart), Date.parse(row.periodEnd)])
        .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
        .sort((a, b) => a[0] - b[0])
    let coveredTo = start
    for (const [a, b] of spans) {
        if (a > coveredTo) break
        if (b > coveredTo) coveredTo = b
        if (coveredTo >= end) return true
    }
    return false
}

export type CollectionSummary = {
    knownGrossMinor: string; knownRefundMinor: string; netMinor: string | null;
    grossState: 'complete' | 'partial'; refundState: 'complete' | 'partial';
    captureCount: number; refundCount: number; unverifiedMinor: string; unverifiedCount: number;
    excludedCount: number; taxExclusiveKnownMinor: string; taxExcludedMinor: string;
}

/** Pure fixture oracle; the SQL report uses the same inclusion contract and integer arithmetic. */
export function summarizeBillingFacts(facts: BillingFact[], coverage: BillingCoverage[], period: Pick<PaymentPeriod, 'from' | 'to'>, hasUnmappedSources = false): CollectionSummary {
    let gross = BigInt(0), refunds = BigInt(0), unverified = BigInt(0), taxExclusive = BigInt(0), taxExcluded = BigInt(0)
    let captureCount = 0, refundCount = 0, unverifiedCount = 0, excludedCount = 0
    const seen = new Map<string, BillingFact>()
    const conflicting = new Set<string>()
    for (const fact of facts) {
        const key = [fact.provider, fact.providerAccountId, fact.mode, fact.kind, fact.providerObjectId].join('|')
        const prior = seen.get(key)
        if (prior && (prior.amountMinor !== fact.amountMinor || prior.occurredAt !== fact.occurredAt || prior.orgId !== fact.orgId || prior.verificationState !== fact.verificationState)) conflicting.add(key)
        else if (!prior) seen.set(key, fact)
    }
    for (const [key, fact] of seen) {
        if (fact.currency !== 'INR' || fact.mode === 'test' || ['test', 'demo', 'internal'].includes(fact.cohort)) { excludedCount++; continue }
        if (fact.occurredAt && (Date.parse(fact.occurredAt) < Date.parse(period.from) || Date.parse(fact.occurredAt) >= Date.parse(period.to))) continue
        const amount = BigInt(fact.amountMinor)
        const confirmed = !conflicting.has(key) && fact.mode === 'live' && fact.verificationState === 'verified'
            && fact.timeBasis === 'provider_verified' && fact.occurredAt && fact.cohort === 'production'
        if (!confirmed) { unverified += amount; unverifiedCount++; continue }
        const sign = fact.kind === 'capture' ? BigInt(1) : BigInt(-1)
        if (fact.kind === 'capture') { gross += amount; captureCount++ }
        else { refunds += amount; refundCount++ }
        if (fact.taxMinor !== null) taxExclusive += sign * (amount - BigInt(fact.taxMinor))
        else taxExcluded += amount
    }
    const accounts = new Set([...facts.filter(f => f.mode !== 'test').map(f => `${f.provider}|${f.providerAccountId}`), ...coverage.filter(c => c.mode === 'live').map(c => `${c.provider}|${c.providerAccountId}`)])
    const full = (kind: 'capture' | 'refund') => !hasUnmappedSources && unverifiedCount === 0 && accounts.size > 0
        && [...accounts].every(account => intervalCovered(coverage.filter(c => `${c.provider}|${c.providerAccountId}` === account), period.from, period.to, kind))
    const grossComplete = full('capture'), refundComplete = full('refund')
    return { knownGrossMinor: gross.toString(), knownRefundMinor: refunds.toString(), netMinor: grossComplete && refundComplete ? (gross - refunds).toString() : null,
        grossState: grossComplete ? 'complete' : 'partial', refundState: refundComplete ? 'complete' : 'partial', captureCount, refundCount, unverifiedMinor: unverified.toString(), unverifiedCount, excludedCount,
        taxExclusiveKnownMinor: taxExclusive.toString(), taxExcludedMinor: taxExcluded.toString() }
}

export function formatMinor(amount: string): string {
    const value = BigInt(amount), absolute = value < BigInt(0) ? -value : value
    return `${value < BigInt(0) ? '−' : ''}₹${(absolute / BigInt(100)).toLocaleString('en-IN')}.${(absolute % BigInt(100)).toString().padStart(2, '0')}`
}
