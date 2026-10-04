import Link from 'next/link'
import { listFactories } from '@/lib/admin/factories'
import { AdminEmptyState, AdminFreshness, AdminPageHeader, AdminSurface, AdminUnavailable } from '@/components/admin/primitives'
import { FactoryFiltersForm } from '@/components/admin/factory-filters'
import type { FactoryRow } from '@/lib/admin/metrics'
export const dynamic = 'force-dynamic'

function date(value: string | null) {
    return value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(value)) : 'Not observed'
}
function Access({ row }: { row: FactoryRow }) {
    return <><p className="font-medium capitalize text-ink">{row.access.effectivePlan === 'none' ? 'No access' : row.access.effectivePlan}</p>
        <p className="mt-1 text-xs text-subtle">{row.access.currentPaidTerm ? `Verified paid ${row.access.currentPaidTerm.tier} term · ends ${date(row.access.currentPaidTerm.endsAt)}` : 'No verified live current paid term'}</p>
        {(row.locked || row.ownerRevoked) && <p className="mt-1 text-xs text-warning">{row.locked ? 'Writes locked' : ''}{row.locked && row.ownerRevoked ? ' · ' : ''}{row.ownerRevoked ? 'Owner revoked' : ''}</p>}</>
}
export default async function FactoriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await searchParams
    const input = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]).filter(([, value]) => value !== undefined))
    let result: Awaited<ReturnType<typeof listFactories>>
    try { result = await listFactories(input) }
    catch { return <><AdminPageHeader title="Factories" description="A read-only view of each factory’s access, observed progress and support context."/><AdminUnavailable title="The directory could not be loaded" description="Filters may be invalid, the session may have ended, or a source is unavailable. Start a new search; no count has been assumed."/><Link href="/admin/factories" className="mt-4 inline-block text-sm underline" prefetch={false}>Start a new search</Link></> }
    const nextQuery = new URLSearchParams()
    Object.entries(result.filters).forEach(([key, value]) => { if (value !== undefined) nextQuery.set(key, String(value)) })
    if (result.nextCursor) nextQuery.set('cursor', result.nextCursor)
    return <>
        <AdminPageHeader title="Factories" description="Understand access and progress without opening private production, payroll or costing records."/>
        <AdminSurface>
            <FactoryFiltersForm filters={result.filters}/>
            <div className="border-b border-hairline px-5 py-3"><p className="text-xs text-subtle">Reporting groups in this search · before access/status filters</p><nav aria-label="Search population reporting groups" className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">{Object.entries(result.classificationCounts).map(([cohort, count]) => {
                const query = new URLSearchParams({ search: result.filters.search, cohort, sort: result.filters.sort, limit: String(result.filters.limit) })
                return <Link key={cohort} href={`/admin/factories?${query}`} className="inline-flex min-h-11 items-center gap-2 underline underline-offset-4" prefetch={false}><span className="capitalize">{cohort}</span><span>{count}</span></Link>
            })}</nav></div>
            <div className="flex flex-wrap justify-between gap-2 border-b border-hairline px-5 py-3 text-sm"><p className="font-medium text-ink">{result.totalMatching} matching {result.totalMatching === 1 ? 'factory' : 'factories'}</p><p className="text-subtle">Production totals exclude test, demo, internal and unclassified records.</p></div>
            {!result.items.length ? <AdminEmptyState title="No factories match this view" description="Missing classification stays unclassified. Missing activity means not observed in retained source records." action={<Link href="/admin/factories?cohort=unclassified" className="text-sm underline" prefetch={false}>Review unclassified factories</Link>}/>
                : <>
                    <div className="hidden overflow-x-auto lg:block"><table className="w-full text-left text-sm"><thead className="border-b border-hairline bg-surface-soft text-xs text-subtle"><tr>{['Factory', 'Access / term', 'Observed progress', 'Last outcome', 'Support', ''].map(label => <th key={label} className="px-5 py-3 font-medium">{label}</th>)}</tr></thead><tbody>
                        {result.items.map(row => <tr key={row.id} className="border-b border-hairline last:border-0"><td className="px-5 py-4 align-top"><p className="font-medium text-ink">{row.name}</p><p className="mt-1 text-xs text-subtle">Joined {date(row.joinedAt)} · {row.cohort}</p><p className="mt-1 font-mono text-[11px] text-subtle">{row.id}</p></td>
                            <td className="px-5 py-4 align-top"><Access row={row}/></td><td className="px-5 py-4 align-top text-subtle"><p>Costing: {date(row.activation.estimatorAt)}</p><p className="mt-1">Production: {date(row.activation.productionAt)}</p></td><td className="px-5 py-4 align-top text-subtle">{date(row.lastMeaningfulActivity)}<p className="mt-1 text-xs">Partial activity coverage</p></td><td className="px-5 py-4 align-top">{row.openTickets === null ? 'Unavailable' : `${row.openTickets} unresolved`}</td><td className="px-5 py-4 align-top"><Link href={`/admin/factories/${row.id}`} className="inline-flex min-h-11 items-center font-medium underline underline-offset-4" prefetch={false}>View factory</Link></td></tr>)}
                    </tbody></table></div>
                    <div className="divide-y divide-hairline lg:hidden">{result.items.map(row => <article key={row.id} className="p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-ink">{row.name}</h2><p className="mt-1 text-xs text-subtle">{row.cohort} · Joined {date(row.joinedAt)}</p></div><div className="text-right text-sm"><Access row={row}/></div></div><p className="mt-3 break-all font-mono text-xs text-subtle">{row.id}</p><p className="mt-3 text-sm text-subtle">Costing: {date(row.activation.estimatorAt)} · Production: {date(row.activation.productionAt)}</p><p className="mt-1 text-sm text-subtle">Last observed outcome: {date(row.lastMeaningfulActivity)} · {row.openTickets === null ? 'Support unavailable' : `${row.openTickets} unresolved tickets`}</p><Link href={`/admin/factories/${row.id}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium underline" prefetch={false}>View factory</Link></article>)}</div>
                </>}
            {result.nextCursor && <div className="border-t border-hairline p-5"><Link href={`/admin/factories?${nextQuery}`} className="inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-medium text-surface" prefetch={false}>Next {result.filters.limit} factories</Link></div>}
        </AdminSurface>
        <AdminFreshness asOf={result.asOf}>Definition {result.definitionVersion}</AdminFreshness>
        <p className="mt-2 text-xs leading-5 text-subtle">{result.coverage[1].detail}</p>
    </>
}
