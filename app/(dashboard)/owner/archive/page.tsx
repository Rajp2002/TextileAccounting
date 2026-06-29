import Link from 'next/link'
import { Archive, ArrowUpRight, CheckCircle2, Package, Store, Truck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getArchivedDispatchGroups, getArchivedOrders, type ArchivedDispatchGroup } from '../orders/actions'
import { getMarketRuns } from '../estimator/actions'
import { formatDateOnly } from '@/lib/format'
import { getMarketRunDisplayStatus } from '@/lib/market-runs'

export const dynamic = 'force-dynamic'

type ArchivedOrder = {
    order_id: string
    party_name: string
    display_quality_name?: string | null
    quality_label?: string | null
    total_target_meters: number
    total_meters_produced: number
    deadline: string
    progress_percent: number
}

type MarketRunSummary = {
    market_run_id: string
    fabric_label: string
    quality_label: string | null
    status: 'production' | 'in_godown' | 'partially_sold' | 'sold_out' | 'closed'
    target_meters: number
    total_meters_produced: number
    total_meters_sold: number
    meters_in_godown: number
    total_revenue: number
    total_profit: number
    created_at: string
}

function fmtMeters(value: number) {
    return `${Number(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}m`
}

function fmtMoney(value: number) {
    return `₹${Number(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function formatDate(value: string) {
    return formatDateOnly(value, { day: '2-digit', month: 'short', year: 'numeric' })
}

function EmptyArchive() {
    return (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Archive className="mx-auto mb-3 h-9 w-9 text-slate-400" />
            <p className="text-sm font-bold text-slate-900">Archive is empty</p>
            <p className="mt-1 text-sm text-slate-500">
                Completed orders, closed or sold-out market runs, and finished dispatches will appear here.
            </p>
        </div>
    )
}

function OrderArchiveCard({ order }: { order: ArchivedOrder }) {
    const quality = order.display_quality_name ?? order.quality_label ?? 'Unnamed order'

    return (
        <Link href={`/owner/orders?orderId=${order.order_id}`}>
            <Card className="border-slate-200 transition-colors hover:border-indigo-300 hover:bg-indigo-50/30">
                <CardContent className="flex items-start justify-between gap-4 p-4">
                    <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-black text-slate-900">{quality}</p>
                            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                                Completed
                            </Badge>
                        </div>
                        <p className="text-sm font-medium text-slate-500">{order.party_name}</p>
                        <p className="mt-2 text-xs text-slate-500">
                            {fmtMeters(order.total_meters_produced)} produced of {fmtMeters(order.total_target_meters)} target
                            {' · '}Due {formatDate(order.deadline)}
                        </p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />
                </CardContent>
            </Card>
        </Link>
    )
}

function MarketRunArchiveCard({ run }: { run: MarketRunSummary }) {
    const displayStatus = getMarketRunDisplayStatus({
        storedStatus: run.status,
        producedQuantity: run.total_meters_produced,
        availableQuantity: run.meters_in_godown,
        soldQuantity: run.total_meters_sold,
    })
    const statusLabel = displayStatus === 'closed' ? 'Closed' : 'Sold out'

    return (
        <Link href={`/owner/archive/market-runs/${run.market_run_id}`}>
            <Card className="border-slate-200 transition-colors hover:border-violet-300 hover:bg-violet-50/30">
                <CardContent className="flex items-start justify-between gap-4 p-4">
                    <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-black text-slate-900">{run.fabric_label}</p>
                            <Badge className="border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-50">
                                {statusLabel}
                            </Badge>
                            {run.quality_label && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                                    {run.quality_label}
                                </span>
                            )}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                            {fmtMeters(run.total_meters_produced)} produced · {fmtMeters(run.total_meters_sold)} sold
                            {' · '}Started {formatDate(run.created_at)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-700">
                            Revenue {fmtMoney(run.total_revenue)} · Profit {fmtMoney(run.total_profit)}
                        </p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />
                </CardContent>
            </Card>
        </Link>
    )
}

function getDispatchSourceHref(group: ArchivedDispatchGroup) {
    if (!group.sourceId) return null
    if (group.sourceType === 'market_run') {
        return group.sourceIsActive
            ? `/owner/market-runs/${group.sourceId}`
            : `/owner/archive/market-runs/${group.sourceId}`
    }
    if (group.sourceType === 'order') return `/owner/orders?orderId=${group.sourceId}`
    return null
}

function DispatchArchiveCard({ group }: { group: ArchivedDispatchGroup }) {
    const href = getDispatchSourceHref(group)
    const sourceLabel = group.sourceType === 'market_run'
        ? 'Market run'
        : group.sourceType === 'order'
            ? 'Order'
            : 'Stock sale'
    const statusLabel = group.sourceIsActive ? 'Active source' : group.sourceStatus ?? 'Archived'
    const activeSourceLabel = group.sourceType === 'market_run' ? 'Active run' : 'Active order'
    const card = (
        <Card className="border-slate-200 transition-colors hover:border-emerald-300 hover:bg-emerald-50/30">
            <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black text-slate-900">{group.partyName}</p>
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                            Finished dispatch
                        </Badge>
                        <Badge className="border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-50">
                            {group.batchCount} batch{group.batchCount !== 1 ? 'es' : ''}
                        </Badge>
                        {group.sourceIsActive && (
                            <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                                {activeSourceLabel}
                            </Badge>
                        )}
                    </div>
                    <p className="text-sm font-medium text-slate-500">
                        {group.qualityLabel ?? group.sourceLabel}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                        {sourceLabel}: {group.sourceLabel} · {statusLabel}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                        <div>
                            <p className="font-bold uppercase tracking-wide text-slate-400">Sale</p>
                            <p className="font-black text-slate-900">{fmtMeters(group.totalSaleMeters)}</p>
                        </div>
                        <div>
                            <p className="font-bold uppercase tracking-wide text-slate-400">Dispatched</p>
                            <p className="font-black text-slate-900">{fmtMeters(group.totalDispatchedMeters)}</p>
                        </div>
                        <div>
                            <p className="font-bold uppercase tracking-wide text-slate-400">Confirmed</p>
                            <p className="font-black text-emerald-700">{fmtMeters(group.totalConfirmedMeters)}</p>
                        </div>
                        <div>
                            <p className="font-bold uppercase tracking-wide text-slate-400">Last dispatch</p>
                            <p className="font-black text-slate-900">{formatDate(group.lastDispatchedAt)}</p>
                        </div>
                    </div>
                </div>
                {href && <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />}
            </CardContent>
        </Card>
    )

    return href ? <Link href={href}>{card}</Link> : card
}

export default async function ArchivePage() {
    const [ordersResult, runsResult, dispatchGroupsResult] = await Promise.all([
        getArchivedOrders(),
        getMarketRuns({ includeArchived: true }),
        getArchivedDispatchGroups(),
    ])

    const archivedOrders = (ordersResult.data ?? []) as ArchivedOrder[]
    const archivedRuns = ((runsResult.data ?? []) as MarketRunSummary[]).filter((run) => {
        const displayStatus = getMarketRunDisplayStatus({
            storedStatus: run.status,
            producedQuantity: run.total_meters_produced,
            availableQuantity: run.meters_in_godown,
            soldQuantity: run.total_meters_sold,
        })
        return ['sold_out', 'closed'].includes(displayStatus)
    })
    const archivedDispatchGroups = dispatchGroupsResult.data ?? []

    const hasError = ordersResult.error || runsResult.error || dispatchGroupsResult.error
    const totalItems = archivedOrders.length + archivedRuns.length + archivedDispatchGroups.length

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-900">Archive</h1>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                        Closed production history stays accessible without crowding active work.
                    </p>
                </div>
                <div className="hidden items-center gap-2 sm:flex">
                    <Button asChild variant="outline" className="gap-2">
                        <Link href="/owner/orders">
                            <Package className="h-4 w-4" />
                            Orders
                        </Link>
                    </Button>
                    <Button asChild variant="outline" className="gap-2">
                        <Link href="/owner/market-runs">
                            <Store className="h-4 w-4" />
                            Market Runs
                        </Link>
                    </Button>
                </div>
            </div>

            {hasError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
                    {ordersResult.error ?? runsResult.error ?? dispatchGroupsResult.error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="border-slate-200">
                    <CardContent className="p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Archived items</p>
                        <p className="mt-1 text-2xl font-black text-slate-900">{totalItems}</p>
                    </CardContent>
                </Card>
                <Card className="border-slate-200">
                    <CardContent className="p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Orders</p>
                        <p className="mt-1 text-2xl font-black text-slate-900">{archivedOrders.length}</p>
                    </CardContent>
                </Card>
                <Card className="border-slate-200">
                    <CardContent className="p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Market runs</p>
                        <p className="mt-1 text-2xl font-black text-slate-900">{archivedRuns.length}</p>
                    </CardContent>
                </Card>
                <Card className="border-slate-200">
                    <CardContent className="p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Dispatches</p>
                        <p className="mt-1 text-2xl font-black text-slate-900">{archivedDispatchGroups.length}</p>
                    </CardContent>
                </Card>
            </div>

            {totalItems === 0 ? (
                <EmptyArchive />
            ) : (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <section className="rounded-xl border border-slate-200 bg-white">
                        <div className="border-b border-slate-100 px-5 py-4">
                            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                Completed orders
                            </h2>
                        </div>
                        <div className="space-y-3 p-4">
                            {archivedOrders.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                                    No completed orders yet.
                                </p>
                            ) : (
                                archivedOrders.map((order) => (
                                    <OrderArchiveCard key={order.order_id} order={order} />
                                ))
                            )}
                        </div>
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white">
                        <div className="border-b border-slate-100 px-5 py-4">
                            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                                <Store className="h-4 w-4 text-violet-600" />
                                Closed market runs
                            </h2>
                        </div>
                        <div className="space-y-3 p-4">
                            {archivedRuns.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                                    No closed or sold-out market runs yet.
                                </p>
                            ) : (
                                archivedRuns.map((run) => (
                                    <MarketRunArchiveCard key={run.market_run_id} run={run} />
                                ))
                            )}
                        </div>
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white xl:col-span-2">
                        <div className="border-b border-slate-100 px-5 py-4">
                            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                                <Truck className="h-4 w-4 text-emerald-600" />
                                Completed dispatches
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 gap-3 p-4 xl:grid-cols-2">
                            {archivedDispatchGroups.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 xl:col-span-2">
                                    No fully confirmed dispatch groups yet.
                                </p>
                            ) : (
                                archivedDispatchGroups.map((group) => (
                                    <DispatchArchiveCard key={group.id} group={group} />
                                ))
                            )}
                        </div>
                    </section>
                </div>
            )}
        </div>
    )
}
