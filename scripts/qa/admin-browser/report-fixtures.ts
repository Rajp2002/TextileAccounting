/** Presentation-only synthetic DTOs for the loopback browser harness.
 * No authentication, service credentials, gateway calls or customer data.
 * Actual money helpers decide fixture totals; product DAL is never bypassed.
 */
import { summarizeBillingFacts, type BillingCoverage, type BillingFact } from '../../../lib/admin/payments-domain'
import type { getPaymentsReport as actualPayments } from '../../../lib/admin/payments'
import type { getAdminSystem as actualSystem } from '../../../lib/admin/system'
import type { getAdminAudit as actualAudit } from '../../../lib/admin/audit'
import type { getAdminOverview as actualOverview } from '../../../lib/admin/overview'
import { getFactorySummary } from './fixture-data'

type PaymentReport = Awaited<ReturnType<typeof actualPayments>>
type SystemReport = Awaited<ReturnType<typeof actualSystem>>
type AuditReport = Awaited<ReturnType<typeof actualAudit>>
type OverviewReport = Awaited<ReturnType<typeof actualOverview>>
const orgId = '00000000-0000-4000-8000-000000000001'
const actorId = '20000000-0000-4000-8000-000000000001'
const asOf = '2026-10-04T12:00:00.000Z'
const period = { from: '2026-09-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' }
function scenario(input: unknown) {
    return input && typeof input === 'object' && 'scenario' in input ? String(input.scenario) : 'partial'
}
function fact(id: string, amountMinor: string, patch: Partial<BillingFact> = {}): BillingFact {
    return { id, kind: 'capture', provider: 'razorpay', providerAccountId: 'synthetic-account', providerObjectId: `synthetic_${id}`, orgId,
        paymentReference: `synthetic_${id}`, currency: 'INR', amountMinor, taxMinor: null, occurredAt: '2026-09-15T00:00:00.000Z', recordedAt: asOf,
        timeBasis: 'provider_verified', mode: 'live', verificationState: 'verified', cohort: 'production', planAtSale: 'lite', purchaseType: 'initial_purchase',
        evidenceRef: 'Synthetic browser fixture evidence only', ...patch }
}
const coverage: BillingCoverage = { provider: 'razorpay', providerAccountId: 'synthetic-account', mode: 'live', currency: 'INR', periodStart: period.from,
    periodEnd: period.to, captureState: 'complete', refundState: 'complete', checkedAt: period.to, conflictsCount: 0 }

export async function getPaymentsReport(input: unknown = {}): Promise<PaymentReport> {
    const mode = scenario(input)
    if (mode === 'unavailable') throw new Error('Synthetic source unavailable')
    const facts = [fact('30000000-0000-4000-8000-000000000001', '299900'), fact('30000000-0000-4000-8000-000000000002', '999900', { planAtSale: 'base' }),
        fact('30000000-0000-4000-8000-000000000003', '100000', { kind: 'refund', purchaseType: null })]
    const rows: BillingCoverage[] = mode === 'complete' ? [coverage] : mode === 'conflict'
        ? [coverage, { ...coverage, captureState: 'partial', refundState: 'partial', checkedAt: asOf, conflictsCount: 1 }] : []
    const summary = summarizeBillingFacts(facts, rows, period)
    return { summary, items: facts, nextCursor: null, exceptions: [{ id: 'capture:synthetic', orgId, reference: 'synthetic_capture_needs_review',
        reasonCode: 'capture_entitlement_link_missing', reason: 'Verified capture has no matching entitlement link; review access evidence.', severity: 'high',
        observedAt: '2026-09-15T00:00:00.000Z', href: `/admin/factories/${orgId}` }],
        diagnostics: { sourcePayments: 2, sourceAttempts: 2, sourceRefunds: 1, unmappedPayments: mode === 'partial' ? 1 : 0, unmappedRefunds: 0,
            unmappedPaymentAmountMinor: mode === 'partial' ? '299900' : '0', unmappedRefundAmountMinor: '0', pendingRefunds: 1, issuedUnconfirmedRefunds: 1,
            failedRefunds: 0, unknownMode: mode === 'partial' ? 1 : 0, unknownTime: mode === 'partial' ? 1 : 0, conflictingFacts: 0, sourceConflicts: 0,
            orphanedPayments: 1, duplicateProviderIds: 0, unknownTax: 3 },
        coverage: rows, conflictedCoverageIntervals: mode === 'conflict' ? 1 : 0, asOf, definitionVersion: 'admin-collections-v1', reportingZone: 'Asia/Kolkata', period, currency: 'INR',
        readiness: { mode: 'blocked', code: 'gateway_not_configured', message: 'Synthetic checkout is blocked. No payment can be accepted.', checkoutEnabled: false, documentState: 'not_supported' },
        exclusions: 'Synthetic production/live facts only. Test, unknown and unclassified evidence is excluded from confirmed subtotals.',
        coverageWarning: mode === 'complete' ? null : mode === 'conflict'
            ? 'Independent reconciliation has 1 unresolved conflicting coverage intervals. Complete period totals and net collections are unavailable; older complete records do not override these conflicts.'
            : 'Known evidence is a partial subtotal. Complete period totals and net collections are unavailable until independent capture/refund coverage and legacy provenance are verified.',
        taxNote: 'Tax-exclusive amount covers only rows with evidenced tax. No tax is inferred from current prices.', unsupported: ['bank settlement', 'recognized revenue', 'receivables', 'MRR', 'ARR'],
        sourceFreshness: { state: 'current', checkedAt: asOf, evidenceCheckedAt: rows.length ? asOf : null }, defaultReportingZone: 'Asia/Kolkata', requestId: '40000000-0000-4000-8000-000000000001' }
}

export async function getAdminSystem(input: unknown = {}): Promise<SystemReport> {
    if (scenario(input) === 'unavailable') throw new Error('Synthetic source unavailable')
    return { asOf, requestId: '40000000-0000-4000-8000-000000000002', readiness: { mode: 'blocked', code: 'gateway_not_configured', message: 'Synthetic checkout is blocked. No payment can be accepted.' },
        signals: [
            { key: 'billing_events', label: 'Payment events awaiting processing', state: 'observed', count: 1, checkedAt: asOf, latestAt: '2026-10-03T12:00:00.000Z',
                detail: 'Retained processing/failed webhook records. This read never retries an event or repairs access.', items: [{ id: 'billing_events:synthetic_failed', orgId: null,
                    observedAt: '2026-10-03T12:00:00.000Z', reason: 'Payment event failed processing.', severity: 'high', href: '/admin/payments' }] },
            { key: 'security_incidents', label: 'Open high-impact security incidents', state: 'observed', count: 0, checkedAt: asOf, latestAt: null,
                detail: 'Safe references from the current incident register; formal operations retain their separate process.', items: [] },
            { key: 'exports', label: 'Recorded export failures', state: 'unavailable', count: null, checkedAt: asOf, latestAt: null,
                detail: 'Source unavailable. This signal cannot establish health.', items: [] },
        ], monitoring: { state: 'unavailable', detail: 'Workflow success rate, request volume and p95 latency are not connected to a verified monitoring feed.' },
        syntheticCheck: { state: 'unavailable', detail: 'An authorized representative login/read/write check is not connected.' },
        backup: { state: 'unavailable', lastSuccessfulAt: null, detail: 'Backup status source not connected.' }, restore: { state: 'unavailable', lastSuccessfulTestAt: null, detail: 'Restore-test evidence source not connected.' },
        coverage: 'These are current reads of retained registers. No failures, or no traffic, does not establish a healthy service.' }
}

export async function getAdminAudit(input: unknown = {}): Promise<AuditReport> {
    if (scenario(input) === 'unavailable') throw new Error('Synthetic source unavailable')
    return { asOf, requestId: '40000000-0000-4000-8000-000000000003', nextCursor: null,
        items: [{ id: '50000000-0000-4000-8000-000000000001', occurred_at: '2026-10-04T11:00:00.000Z', actor_id: actorId, session_hash: null,
            action: 'support.status', target_type: 'support_ticket', target_id: '60000000-0000-4000-8000-000000000001', outcome: 'success', reason_code: null,
            before_safe: { status: 'new', version: 1 }, after_safe: { status: 'in_progress', version: 2 }, request_id: '40000000-0000-4000-8000-000000000004' }] }
}

export async function getAdminOverview(input: unknown = {}): Promise<OverviewReport> {
    if (scenario(input) === 'unavailable') throw new Error('Synthetic source unavailable')
    const payment = await getPaymentsReport(input), system = await getAdminSystem(input)
    const factorySummary = await getFactorySummary()
    const support = { asOf, unanswered: 1, needsReply: 2, overduePromises: 1, overdueFollowUps: 1, reopened: 0, waitingOnFix: 1, critical: 0, attention: [] }
    return { factories: { state: 'available', value: factorySummary }, support: { state: 'available', value: support }, payments: { state: 'available', value: payment }, paidPlans: { state: 'available', value: { goLiveAt: null, endingIn14Days: 0, endingIn30Days: 0, alreadyEnded: 0, readiness: { mode: 'test', missing: [] } } }, system: { state: 'available', value: system },
        attention: [
            { id: 'payment:synthetic', target: 'synthetic_capture_needs_review', reason: 'Verified capture has no matching entitlement link; review access evidence.', observedAt: '2026-10-01T12:00:00.000Z',
                ageSeconds: 259200, severity: 'high', owner: 'Founder', nextAction: 'Review evidence and factory access state.', href: '/admin/payments', group: 'payments' },
            { id: 'support:promise', target: 'Synthetic production setup question', reason: 'Promised customer update overdue', observedAt: '2026-10-03T12:00:00.000Z', ageSeconds: 86400,
                severity: 'normal', owner: 'Founder', nextAction: 'Send an in-app progress update.', href: '/admin/support/60000000-0000-4000-8000-000000000001', group: 'support', supportRank: 1,
                dueLabel: 'Promised customer update due', dueAt: '2026-10-03T12:00:00.000Z' },
            { id: 'support:followup', target: 'Synthetic customer input outstanding', reason: 'Internal customer follow-up due', observedAt: '2026-10-03T13:00:00.000Z', ageSeconds: 82800,
                severity: 'normal', owner: 'Founder', nextAction: 'Check whether the requested setup details were supplied.', href: '/admin/support/60000000-0000-4000-8000-000000000002', group: 'support', supportRank: 2,
                dueLabel: 'Internal customer follow-up due', dueAt: '2026-10-03T13:00:00.000Z' },
        ], attentionLimit: 100, asOf, definitionVersion: 'admin-today-v1', reportingZone: 'Asia/Kolkata', requestId: '40000000-0000-4000-8000-000000000005',
        activation: { state: 'unavailable', detail: 'Activation-gap queues need complete prerequisite and event coverage. No missing history is treated as inactivity.' },
        sourceFreshness: ['factories', 'support', 'payments', 'system'].map(source => ({ source, state: 'available' as const, asOf })) }
}
