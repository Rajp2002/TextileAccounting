import { getAdminAudit } from '@/lib/admin/audit'
import { ReportHeader, ReportLink, ReportSurface, ReportTime, SourceUnavailable } from '@/components/admin/report-ui'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const query = Object.fromEntries(Object.entries(await searchParams).filter(([, value]) => value !== undefined))
    let report
    try { report = await getAdminAudit(query) } catch { return <><ReportHeader title="Audit">Founder reads and changes, with safe before/after fields.</ReportHeader><SourceUnavailable title="Audit history could not be loaded"/></> }
    return <><ReportHeader title="Audit">Immutable administrative events. Ticket bodies, credentials, and complete customer records are excluded.</ReportHeader><ReportSurface>
        {report.items.length === 0 ? <p className="p-6 text-sm text-body">No earlier founder events are recorded. This read is itself audited.</p> : <ol className="divide-y divide-hairline">{report.items.map(event => <li key={event.id} className="p-5"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-medium">{event.action} · {event.outcome}</p><p className="text-xs text-subtle"><ReportTime value={event.occurred_at}/></p></div><p className="mt-2 break-all text-sm text-body">{event.target_type} / {event.target_id}</p><p className="mt-1 break-all text-xs text-subtle">Actor {event.actor_id ?? 'Pseudonymized'} · Request {event.request_id}{event.reason_code ? ` · ${event.reason_code}` : ''}</p>
            {(event.before_safe || event.after_safe) && <details className="mt-3"><summary className="cursor-pointer py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-saffron">Safe change values</summary><div className="mt-2 grid gap-3 sm:grid-cols-2"><pre className="overflow-x-auto rounded-lg border border-hairline p-3 text-xs">{JSON.stringify(event.before_safe, null, 2)}</pre><pre className="overflow-x-auto rounded-lg border border-hairline p-3 text-xs">{JSON.stringify(event.after_safe, null, 2)}</pre></div></details>}</li>)}</ol>}
        {report.nextCursor && <div className="border-t border-hairline px-5"><ReportLink href={`/admin/audit?${new URLSearchParams({ cursor: report.nextCursor, limit: String(query.limit ?? 25) })}`}>Older events</ReportLink></div>}
    </ReportSurface><p className="mt-4 text-xs text-subtle">As of <ReportTime value={report.asOf}/></p></>
}
