import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { LEGACY_REGISTERS, type LegacyRecord, type LegacyRegister, type listLegacyRecords } from '@/lib/admin/legacy-read'
import { AdminEmptyState, AdminFreshness, AdminSurface } from './primitives'
import { ReportLink, ReportTime } from './report-ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function legacyListHref(filters: { kind: LegacyRegister; state: string; search: string; limit: number }, cursor?: string | null) {
    const query = new URLSearchParams({ kind: filters.kind, state: filters.state, search: filters.search, limit: String(filters.limit) })
    if (cursor) query.set('cursor', cursor)
    return `/admin/legacy?${query}`
}

export function LegacyLimits() {
    return <aside className="mt-6 border-l-2 border-hairline-strong pl-4 text-sm leading-6 text-subtle" aria-label="Formal record limits">
        <p className="font-medium text-ink">Read-only review</p>
        <p>These retained records support investigation. Recorded documents, deadlines and assessment labels do not establish current legal policy, compliance or system health. They do not set a customer support SLA.</p>
        <p className="mt-2">Resolution, incident changes, signing, proof downloads, exports, lockdown and external delivery require an approved operational owner and separate secure workflow. Those controls remain disabled. Existing published privacy and recovery contact routes remain available.</p>
    </aside>
}

export function LegacyList({ report }: { report: Awaited<ReturnType<typeof listLegacyRecords>> }) {
    const definition = LEGACY_REGISTERS[report.kind]
    return <>
        <nav className="mb-5 flex flex-wrap gap-x-5 gap-y-1" aria-label="Formal registers">{Object.entries(LEGACY_REGISTERS).map(([kind, value]) => <Link key={kind} href={`/admin/legacy?kind=${kind}`} prefetch={false} aria-current={kind === report.kind ? 'page' : undefined} className={`inline-flex min-h-11 items-center border-b-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron ${kind === report.kind ? 'border-ink font-semibold text-ink' : 'border-transparent text-subtle hover:text-ink'}`}>{value.label}</Link>)}</nav>
        <AdminSurface aria-label={definition.label}>
            <form className="grid gap-3 border-b border-hairline p-5 sm:grid-cols-[minmax(12rem,1fr)_minmax(10rem,14rem)_auto]" action="/admin/legacy" method="get">
                <input type="hidden" name="kind" value={report.kind}/><input type="hidden" name="limit" value={report.filters.limit}/>
                <div><label className="mb-2 block text-sm font-medium" htmlFor="legacy-search">{definition.searchLabel}</label><Input id="legacy-search" name="search" defaultValue={report.filters.search} maxLength={160} className="h-11" placeholder={`Search ${definition.searchLabel.toLowerCase()}`}/></div>
                <div><label className="mb-2 block text-sm font-medium" htmlFor="legacy-state">Recorded state</label><div className="relative"><select id="legacy-state" name="state" defaultValue={report.filters.state} className="h-11 w-full appearance-none rounded-lg border border-hairline-strong bg-surface pl-3 pr-10 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron"><option value="all">All states</option>{definition.states.map(state => <option key={state} value={state}>{state.replaceAll('_', ' ')}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-3.5 size-4 text-subtle"/></div></div>
                <div className="flex flex-wrap items-end gap-3"><Button className="min-h-11" type="submit">Apply filters</Button><ReportLink href={`/admin/legacy?kind=${report.kind}`}>Clear</ReportLink></div>
            </form>
            {report.items.length ? <ul className="divide-y divide-hairline">{report.items.map(item => <li key={item.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0"><p className="break-words text-sm font-semibold text-ink">{item.title}</p><p className="mt-1 text-sm text-body">{item.state.replaceAll('_', ' ')} · {item.context}</p><p className="mt-2 break-all text-xs text-subtle">Record {item.id}</p><p className="mt-1 text-xs text-subtle">Recorded <ReportTime value={item.recordedAt}/></p></div>
                <div className="self-center"><ReportLink href={`/admin/legacy/${report.kind}/${item.id}`}>Inspect record</ReportLink></div>
            </li>)}</ul> : <AdminEmptyState title="No matching retained records" description="This source returned an empty matching page. It does not establish compliance or rule out incidents outside this register."/>}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-5 py-3"><p className="text-xs text-subtle">{report.items.length} records on this page · limit {report.filters.limit}</p><div className="flex gap-4">{report.nextCursor && <ReportLink href={legacyListHref(report.filters, report.nextCursor)}>Next page</ReportLink>}<ReportLink href={legacyListHref(report.filters)}>Start again</ReportLink></div></div>
        </AdminSurface>
        <AdminFreshness asOf={report.asOf}/><p className="mt-2 text-xs leading-5 text-subtle">{report.coverage}</p>
    </>
}

export function LegacyRecordDetail({ record }: { record: LegacyRecord }) {
    return <AdminSurface aria-label="Retained record details">
        <div className="border-b border-hairline p-5"><p className="break-all text-xs text-subtle">Record {record.id}</p><p className="mt-2 text-sm font-medium">State as recorded: {record.state.replaceAll('_', ' ')}</p><p className="mt-2 text-sm text-subtle">Created <ReportTime value={record.recordedAt}/></p>{record.orgId && <ReportLink href={`/admin/factories/${record.orgId}`}>Factory {record.orgId}</ReportLink>}</div>
        <dl className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2">{record.fields.map(field => <div key={field.label} className="min-w-0"><dt className="text-xs font-medium text-subtle">{field.label}</dt><dd className="mt-1 break-words text-sm text-ink">{field.format === 'instant' ? <ReportTime value={field.value}/> : field.value ?? 'Not recorded'}</dd></div>)}</dl>
        <div className="divide-y divide-hairline border-t border-hairline">{record.texts.map(section => <section key={section.label} className="p-5"><h2 className="text-sm font-semibold text-ink">{section.label}</h2>{section.truncated && <p className="mt-2 text-xs text-warning">Showing the first 10,000 characters. The source record is unchanged; full text requires the approved record-access process.</p>}<p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-body">{section.value ?? 'Not recorded'}</p></section>)}</div>
    </AdminSurface>
}
