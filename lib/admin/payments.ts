import 'server-only'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBillingReadiness } from '@/lib/billing-readiness'
import { BILLING_DOCUMENT_POLICY } from '@/lib/billing-document-policy'
import { adminRecordAudit, requireFounder } from './founder'
import { ApiError } from './errors'
import { ADMIN_REPORTING_ZONE, BILLING_METRIC_VERSION, intervalCovered, parsePaymentPeriod, type BillingCoverage, type BillingFact, type CollectionSummary } from './payments-domain'

export type PaymentException = { id: string; orgId: string | null; reference: string; reasonCode: string; reason: string; severity: 'high' | 'normal'; observedAt: string; href: string }
export type ProvenanceDiagnostics = Record<'sourcePayments' | 'sourceAttempts' | 'sourceRefunds' | 'unmappedPayments' | 'unmappedRefunds' | 'pendingRefunds' | 'issuedUnconfirmedRefunds' | 'failedRefunds' | 'unknownMode' | 'unknownTime' | 'conflictingFacts' | 'sourceConflicts' | 'orphanedPayments' | 'duplicateProviderIds' | 'unknownTax', number> & { unmappedPaymentAmountMinor: string; unmappedRefundAmountMinor: string }
type Input = { summary: Omit<CollectionSummary, 'netMinor' | 'grossState' | 'refundState'>; coverage: BillingCoverage[]; accounts: { provider: string; providerAccountId: string }[]; ledger: BillingFact[]; diagnostics: ProvenanceDiagnostics; exceptions: PaymentException[]; asOf: string }

export async function getPaymentsReport(query: unknown = {}) {
    const principal = await requireFounder()
    const requestId = randomUUID()
    let period
    try { period = parsePaymentPeriod(query) }
    catch { throw new ApiError('INVALID_QUERY', 400, 'Choose an INR period up to 366 days ending no later than now.', undefined, requestId) }
    const { data, error } = await createAdminClient().rpc('admin_billing_report_input', {
        p_actor_id: principal.userId, p_session_id: principal.sessionId, p_from: period.from, p_to: period.to,
        p_currency: period.currency, p_limit: period.limit, p_cursor_at: period.cursor?.at ?? null, p_cursor_id: period.cursor?.id ?? null,
    })
    if (error || !data) throw new ApiError('SOURCE_UNAVAILABLE', 503, 'Payment evidence is unavailable. Customer billing has not changed.', undefined, requestId)
    const input = data as Input
    const hasUnmapped = input.diagnostics.unmappedPayments > 0 || input.diagnostics.unmappedRefunds > 0 || input.diagnostics.sourceConflicts > 0 || input.summary.unverifiedCount > 0
    const complete = (kind: 'capture' | 'refund') => !hasUnmapped && input.accounts.length > 0 && input.accounts.every(account => intervalCovered(
        input.coverage.filter(c => c.provider === account.provider && c.providerAccountId === account.providerAccountId), period.from, period.to, kind,
    ))
    const grossComplete = complete('capture'), refundComplete = complete('refund')
    const summary: CollectionSummary = { ...input.summary, grossState: grossComplete ? 'complete' : 'partial', refundState: refundComplete ? 'complete' : 'partial',
        netMinor: grossComplete && refundComplete ? (BigInt(input.summary.knownGrossMinor) - BigInt(input.summary.knownRefundMinor)).toString() : null }
    const hasMore = input.ledger.length > period.limit
    const items = input.ledger.slice(0, period.limit), last = items.at(-1)
    const readiness = getBillingReadiness()
    const conflictedCoverageIntervals = input.coverage.filter(row => row.mode === 'live' && row.conflictsCount > 0).length
    await adminRecordAudit(principal, 'payments.read', 'billing_report', 'INR', requestId, { after: { count: items.length, mode: readiness.mode } })
    return { summary, items, nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ at: last.recordedAt, id: last.id })).toString('base64url') : null,
        exceptions: input.exceptions, diagnostics: input.diagnostics, coverage: input.coverage, conflictedCoverageIntervals,
        asOf: input.asOf, definitionVersion: BILLING_METRIC_VERSION, reportingZone: period.timezone, period: { from: period.from, to: period.to }, currency: 'INR',
        readiness: { mode: readiness.mode, code: readiness.code, message: readiness.publicMessage, checkoutEnabled: readiness.canCreateOrder, documentState: BILLING_DOCUMENT_POLICY.state },
        exclusions: 'Confirmed totals include production-classified factories and verified live provider capture/processed-refund times only. Unknown provenance and unclassified factories are excluded.',
        coverageWarning: grossComplete && refundComplete ? null : conflictedCoverageIntervals > 0
            ? `Independent reconciliation has ${conflictedCoverageIntervals} unresolved conflicting coverage intervals. Complete period totals and net collections are unavailable; older complete records do not override these conflicts.`
            : 'Known evidence is a partial subtotal. Complete period totals and net collections are unavailable until independent capture/refund coverage and legacy provenance are verified.',
        taxNote: 'Tax-exclusive amount covers only rows with evidenced tax. No tax is inferred from current prices.',
        unsupported: ['bank settlement', 'recognized revenue', 'receivables', 'MRR', 'ARR'],
        sourceFreshness: { state: 'current' as const, checkedAt: input.asOf, evidenceCheckedAt: input.coverage.map(c => c.checkedAt).sort().at(-1) ?? null },
        defaultReportingZone: ADMIN_REPORTING_ZONE, requestId }
}

/** A bounded read-only worksheet. It never contacts a gateway or populates the projection. */
export async function getBillingProvenanceDryRun() {
    await requireFounder()
    const report = await getPaymentsReport({ limit: 1 })
    return { asOf: report.asOf, diagnostics: report.diagnostics, coverage: report.coverage, mutationCount: 0 as const,
        detail: 'Existing local ledgers are inspected only. Mode, capture/refund time and tax require explicit evidence; no classifications or financial facts were written.' }
}
