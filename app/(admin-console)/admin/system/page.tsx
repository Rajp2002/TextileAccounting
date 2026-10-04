import { getAdminSystem } from '@/lib/admin/system'
import { ReportHeader, ReportLink, ReportSurface, ReportTime, SourceUnavailable } from '@/components/admin/report-ui'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export default async function SystemPage() {
    let report
    try { report = await getAdminSystem() } catch { return <><ReportHeader title="System">Failures affecting customer work, with protected references.</ReportHeader><SourceUnavailable/></> }
    return <><ReportHeader title="System">Follow the evidence behind failed work. No automatic repair or payment retry runs from this view.</ReportHeader>
        <ReportSurface><div className="border-b border-hairline p-5"><h2 className="font-semibold">Checkout readiness · {report.readiness.mode}</h2><p className="mt-2 text-sm leading-6 text-body">{report.readiness.message}</p></div>
            {report.signals.map(signal => <section key={signal.key} className="border-b border-hairline last:border-b-0"><div className="p-5"><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="font-semibold">{signal.label}</h2><p className="font-mono text-sm">{signal.count === null ? 'Unavailable' : `${signal.count} observed`}</p></div><p className="mt-2 text-sm leading-6 text-body">{signal.detail}</p></div>
                {signal.items.length > 0 && <ul className="divide-y divide-hairline border-t border-hairline">{signal.items.map(item => <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-5"><div><p className="text-sm font-medium">{item.reason}</p><p className="mt-1 text-xs text-subtle"><ReportTime value={item.observedAt}/></p></div><ReportLink href={item.href}>Inspect reference</ReportLink></li>)}</ul>}
            </section>)}
            <div className="grid gap-6 border-t border-hairline p-5 sm:grid-cols-2">{[['Workflow monitoring', report.monitoring.detail], ['Synthetic workflow check', report.syntheticCheck.detail], ['Last successful backup', report.backup.detail], ['Last successful restore test', report.restore.detail]].map(([label, detail]) => <div key={label}><h2 className="text-sm font-semibold">{label} · unavailable</h2><p className="mt-2 text-sm leading-6 text-body">{detail}</p></div>)}</div>
        </ReportSurface><p className="mt-4 text-xs leading-6 text-subtle">As of <ReportTime value={report.asOf}/> · {report.coverage}</p></>
}
