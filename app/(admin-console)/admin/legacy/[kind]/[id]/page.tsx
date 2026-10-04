import { notFound } from 'next/navigation'
import { requireFounderPage } from '@/lib/admin/founder'
import { AdminError } from '@/lib/admin/errors'
import { getLegacyRecord, LEGACY_REGISTERS, listLegacyDpaBindings } from '@/lib/admin/legacy-read'
import { LegacyLimits, LegacyRecordDetail } from '@/components/admin/legacy-records'
import { AdminFreshness, AdminPageHeader, AdminSurface, AdminUnavailable } from '@/components/admin/primitives'
import { ReportLink, ReportTime } from '@/components/admin/report-ui'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export default async function LegacyDetailPage({ params, searchParams }: { params: Promise<{ kind: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    await requireFounderPage()
    const { kind, id } = await params
    let record
    try { record = await getLegacyRecord(kind, id) }
    catch (error) {
        if (error instanceof AdminError && (error.status === 404 || error.status === 400)) notFound()
        return <><AdminPageHeader title="Formal record" description="Read-only review of retained source evidence."/><AdminUnavailable description={error instanceof AdminError ? error.publicMessage : 'This source is unavailable.'}/><LegacyLimits/></>
    }
    let bindings: Awaited<ReturnType<typeof listLegacyDpaBindings>> | undefined, bindingsUnavailable = false
    if (record.kind === 'dpas') {
        const values = await searchParams
        try { bindings = await listLegacyDpaBindings(id, values.bindingsCursor ? { cursor: typeof values.bindingsCursor === 'string' ? values.bindingsCursor : '\u0000' } : {}) }
        catch { bindingsUnavailable = true }
    }
    return <><AdminPageHeader title={record.title} description={`${LEGACY_REGISTERS[record.kind].label} · retained record`} action={<ReportLink href={`/admin/legacy?kind=${record.kind}`}>Back to register</ReportLink>}/><LegacyRecordDetail record={record}/><AdminFreshness asOf={record.asOf}/>
        {record.kind === 'dpas' && <section className="mt-6" aria-label="Factory agreement records"><h2 className="mb-3 text-base font-semibold">Factory agreement records</h2>{bindingsUnavailable ? <AdminUnavailable description="Agreement bindings could not be established. No zero or signature coverage has been assumed."/> : bindings && <AdminSurface><ul className="divide-y divide-hairline">{bindings.items.map(binding => <li key={binding.id} className="p-5"><p className="text-sm font-medium">{binding.state ?? 'State not recorded'}</p><p className="mt-1 text-sm text-subtle">Signed as recorded: <ReportTime value={binding.signedAt}/></p>{binding.orgId && <ReportLink href={`/admin/factories/${binding.orgId}`}>Factory {binding.orgId}</ReportLink>}<p className="break-all text-xs text-subtle">Binding {binding.id}</p></li>)}</ul>{!bindings.items.length && <p className="p-5 text-sm text-subtle">No matching retained bindings in this source.</p>}<div className="flex flex-wrap gap-4 border-t border-hairline px-5 py-3">{bindings.nextCursor && <ReportLink href={`/admin/legacy/dpas/${id}?bindingsCursor=${encodeURIComponent(bindings.nextCursor)}`}>Next binding page</ReportLink>}<ReportLink href={`/admin/legacy/dpas/${id}`}>First binding page</ReportLink></div></AdminSurface>}</section>}
        <LegacyLimits/>
    </>
}
