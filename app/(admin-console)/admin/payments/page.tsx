import { getPaymentsReport } from '@/lib/admin/payments'
import { formatMinor } from '@/lib/admin/payments-domain'
import { ReportHeader, ReportLink, ReportSurface, ReportTime, SourceUnavailable } from '@/components/admin/report-ui'
import { PaymentFilters } from './filters'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await searchParams
    const input = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined))
    let report
    try { report = await getPaymentsReport(input) }
    catch { return <><ReportHeader title="Payments">Provider evidence, access exceptions, and manual annual renewal.</ReportHeader><SourceUnavailable title="Payment report could not be loaded">Choose a valid INR reporting period up to 366 days, or try again if the evidence source is unavailable. Customer checkout and entitlements have not changed.</SourceUnavailable></> }
    const { summary } = report
    const next = new URLSearchParams({ from: report.period.from, to: report.period.to, currency: 'INR', timezone: report.reportingZone, limit: String(input.limit ?? 25) })
    if (report.nextCursor) next.set('cursor', report.nextCursor)
    return <>
        <ReportHeader title="Payments">Confirmed collections are payment evidence. Annual access renews manually. Every amount below uses recorded integer paise.</ReportHeader>
        <ReportSurface>
            <PaymentFilters from={report.period.from} to={report.period.to} zone={report.reportingZone}/>
            <dl className="grid gap-6 border-b border-hairline p-5 sm:grid-cols-3">
                <div><dt className="text-sm text-body">{summary.grossState === 'complete' ? 'Confirmed gross collections' : 'Known confirmed captures'}</dt><dd className="mt-2 text-2xl font-semibold tracking-tight">{formatMinor(summary.knownGrossMinor)}</dd><p className="mt-1 text-xs text-subtle">{summary.captureCount} capture facts · {summary.grossState === 'complete' ? 'Complete period coverage' : 'Partial subtotal'}</p></div>
                <div><dt className="text-sm text-body">{summary.refundState === 'complete' ? 'Confirmed refunds' : 'Known processed refunds'}</dt><dd className="mt-2 text-2xl font-semibold tracking-tight">{formatMinor(summary.knownRefundMinor)}</dd><p className="mt-1 text-xs text-subtle">{summary.refundCount} refund facts · {summary.refundState === 'complete' ? 'Complete period coverage' : 'Partial subtotal'}</p></div>
                <div><dt className="text-sm text-body">Net collections</dt><dd className="mt-2 text-2xl font-semibold tracking-tight">{summary.netMinor === null ? 'Unavailable' : formatMinor(summary.netMinor)}</dd><p className="mt-1 text-xs text-subtle">Capture and processed-refund coverage required</p></div>
            </dl>
            <div className="space-y-2 border-b border-hairline p-5 text-sm leading-6 text-body">
                {report.coverageWarning && <p className="font-medium text-ink">{report.coverageWarning}</p>}
                <p>{report.exclusions}</p>
                <p>Unverified or unclassified evidence: {formatMinor(summary.unverifiedMinor)} across {summary.unverifiedCount} facts. {summary.excludedCount} test/demo/internal facts excluded.</p>
                <p>Unmapped source amounts across all retained history: {formatMinor(report.diagnostics.unmappedPaymentAmountMinor)} in payment rows and {formatMinor(report.diagnostics.unmappedRefundAmountMinor)} in refund requests. Their live mode and provider event period are unconfirmed; they are excluded from period totals.</p>
                <p>{report.taxNote} Evidenced subset: {formatMinor(summary.taxExclusiveKnownMinor)}; excluded unknown-tax amount: {formatMinor(summary.taxExcludedMinor)}.</p>
                <p>Checkout: <strong className="font-medium text-ink">{report.readiness.mode}</strong> · {report.readiness.message}</p>
            </div>
            <div className="border-b border-hairline px-5 py-4"><h2 className="font-semibold">Evidence ledger</h2><p className="mt-1 text-xs leading-5 text-subtle">All available facts in this period, including excluded evidence. Only qualifying production/live rows contribute to the confirmed subtotals. No provider payloads or credentials are shown.</p></div>
            {report.items.length === 0 ? <p className="p-6 text-sm text-body">No reporting facts are connected for this period. Historical source records have not been classified or backfilled.</p> : <ul className="divide-y divide-hairline">{report.items.map(item => <li key={item.id} className="grid gap-3 p-5 sm:grid-cols-[1fr_auto]">
                <div className="min-w-0"><p className="break-all font-medium">{item.kind === 'capture' ? 'Capture' : 'Refund'} · {item.providerObjectId}</p><p className="mt-1 text-sm text-body">{item.planAtSale ?? 'Plan not evidenced'} · {item.mode} · {item.verificationState} · {item.cohort}</p><p className="mt-1 text-xs text-subtle"><ReportTime value={item.occurredAt} zone={report.reportingZone}/> · {item.timeBasis.replaceAll('_', ' ')}</p>{item.orgId && <ReportLink href={`/admin/factories/${item.orgId}`}>View factory</ReportLink>}</div>
                <div className="sm:text-right"><p className="text-lg font-semibold">{formatMinor(item.amountMinor)}</p><p className="mt-1 text-xs text-subtle">{item.currency} · Tax {item.taxMinor === null ? 'unknown' : formatMinor(item.taxMinor)}</p></div>
            </li>)}</ul>}
            {report.nextCursor && <div className="border-t border-hairline px-5"><ReportLink href={`/admin/payments?${next}`}>Next evidence page</ReportLink></div>}
            <section id="exceptions" className="border-t border-hairline"><div className="px-5 py-4"><h2 className="font-semibold">Payment and access exceptions</h2><p className="mt-1 text-xs text-subtle">Read-only review queue. Local “issued” means a refund creation response, not completed cash movement.</p></div>
                {report.exceptions.length === 0 ? <p className="px-5 pb-5 text-sm text-body">No exceptions observed in the connected records. Unconnected history remains unknown.</p> : <ul className="divide-y divide-hairline">{report.exceptions.map(item => <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-5"><div className="max-w-3xl"><p className="font-medium">{item.reason}</p><p className="mt-1 break-all text-xs text-subtle">{item.reference} · <ReportTime value={item.observedAt} zone={report.reportingZone}/></p></div><ReportLink href={item.href}>Review evidence</ReportLink></li>)}</ul>}
            </section>
            <details className="border-t border-hairline p-5"><summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-saffron">Source provenance worksheet</summary><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">{Object.entries(report.diagnostics).map(([key, value]) => <div key={key} className="flex justify-between gap-3 border-b border-hairline pb-2"><dt className="text-body">{key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}</dt><dd className="font-mono">{typeof value === 'string' ? formatMinor(value) : value}</dd></div>)}</dl><p className="mt-4 text-xs leading-5 text-subtle">A dry read only. No provider reconciliation, projection population, access repair, capture or refund is performed.</p></details>
        </ReportSurface>
        <p className="mt-4 text-xs leading-6 text-subtle">As of <ReportTime value={report.asOf} zone={report.reportingZone}/> · {report.definitionVersion}. Bank settlement, recognized revenue, receivables, MRR and ARR are unavailable in this release.</p>
    </>
}
