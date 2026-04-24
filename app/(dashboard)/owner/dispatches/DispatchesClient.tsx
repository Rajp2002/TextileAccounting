'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import {
    Truck,
    CheckCircle2,
    AlertTriangle,
    Search,
    ArrowRight,
    Calendar,
    ExternalLink,
    Layers,
    User,
    ChevronDown,
    Package,
    Hash,
    Clock,
    CircleDot,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Dispatch {
    id: string
    dispatch_number: number
    qty_meters_sent: number
    qty_meters_received: number | null
    status: 'in_transit' | 'delivered' | 'disputed'
    dispatched_at: string
    received_at: string | null
    notes: string | null
    orders: {
        id: string
        party_name: string
        quality_label: string | null
        tracking_token: string
        total_target_meters: number
        status: string
    }
}

interface OrderGroup {
    orderId: string
    partyName: string
    qualityLabel: string | null
    trackingToken: string
    totalTargetMeters: number
    orderStatus: string
    dispatches: Dispatch[]
    totalDispatched: number
    totalReceived: number
    shortage: number
    hasInTransit: boolean
    hasDisputed: boolean
}

interface DispatchesClientProps {
    initialDispatches: Dispatch[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getStatusConfig = (status: string) => {
    switch (status) {
        case 'delivered':
            return {
                label: 'Delivered',
                icon: CheckCircle2,
                className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
                dotColor: 'bg-emerald-500',
                barColor: 'bg-emerald-500',
            }
        case 'disputed':
            return {
                label: 'Disputed',
                icon: AlertTriangle,
                className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
                dotColor: 'bg-rose-500',
                barColor: 'bg-rose-500',
            }
        default:
            return {
                label: 'In Transit',
                icon: Truck,
                className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
                dotColor: 'bg-amber-500',
                barColor: 'bg-amber-400',
            }
    }
}

const getOrderStatusBadge = (group: OrderGroup) => {
    if (group.hasDisputed) return { label: 'Has Dispute', color: 'bg-rose-500' }
    if (group.hasInTransit) return { label: 'In Transit', color: 'bg-amber-500' }
    return { label: 'All Delivered', color: 'bg-emerald-500' }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DispatchBatchRow({ dispatch }: { dispatch: Dispatch }) {
    const status = getStatusConfig(dispatch.status)
    const shortage = dispatch.qty_meters_received !== null
        ? Number(dispatch.qty_meters_sent) - Number(dispatch.qty_meters_received)
        : 0

    return (
        <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700 transition-all"
        >
            {/* Batch number + status */}
            <div className="flex items-center gap-3 min-w-[160px]">
                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", status.dotColor)} />
                <div>
                    <p className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Batch #{dispatch.dispatch_number}</p>
                    <Badge className={cn("mt-0.5 text-[10px] font-bold px-2 py-0 rounded-full border", status.className)}>
                        <status.icon className="h-2.5 w-2.5 mr-1" />
                        {status.label}
                    </Badge>
                </div>
            </div>

            {/* Qty */}
            <div className="flex items-center gap-6 flex-1">
                <div>
                    <p className="text-[10px] font-black text-muted-foreground/70 uppercase tracking-wider">Sent</p>
                    <p className="text-sm font-black tabular-nums">{Number(dispatch.qty_meters_sent).toFixed(2)}<span className="text-[10px] ml-0.5 font-bold text-muted-foreground">m</span></p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30" />
                <div>
                    <p className="text-[10px] font-black text-muted-foreground/70 uppercase tracking-wider">Received</p>
                    {dispatch.qty_meters_received !== null ? (
                        <p className={cn("text-sm font-black tabular-nums", shortage > 0.01 ? "text-rose-600" : "text-emerald-600")}>
                            {Number(dispatch.qty_meters_received).toFixed(2)}<span className="text-[10px] ml-0.5 font-bold opacity-60">m</span>
                        </p>
                    ) : (
                        <p className="text-sm font-black text-muted-foreground/40 italic">Pending</p>
                    )}
                </div>
                {shortage > 0.01 && (
                    <div className="border-l border-zinc-200 dark:border-zinc-700 pl-4">
                        <p className="text-[10px] font-black text-rose-500 uppercase tracking-wider">Shortage</p>
                        <p className="text-sm font-black text-rose-600 tabular-nums">-{shortage.toFixed(2)}<span className="text-[10px] ml-0.5 font-bold opacity-70">m</span></p>
                    </div>
                )}
            </div>

            {/* Dates */}
            <div className="flex flex-col items-end gap-1 text-right">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                    <Calendar className="h-3 w-3 text-primary/40" />
                    {format(new Date(dispatch.dispatched_at), 'dd MMM yyyy')}
                </div>
                {dispatch.received_at && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600/70">
                        <CheckCircle2 className="h-3 w-3" />
                        {format(new Date(dispatch.received_at), 'dd MMM yyyy')}
                    </div>
                )}
            </div>
        </motion.div>
    )
}

function OrderGroupCard({
    group,
    statusFilter,
}: {
    group: OrderGroup
    statusFilter: 'all' | 'in_transit' | 'delivered' | 'disputed'
}) {
    const [expanded, setExpanded] = useState(false)

    const dispatchedPct = group.totalTargetMeters > 0
        ? Math.min(100, (group.totalDispatched / group.totalTargetMeters) * 100)
        : 0
    const remaining = Math.max(0, group.totalTargetMeters - group.totalDispatched)
    const orderBadge = getOrderStatusBadge(group)

    // Filter individual dispatches per status filter (for the dropdown)
    const visibleDispatches = statusFilter === 'all'
        ? group.dispatches
        : group.dispatches.filter(d => d.status === statusFilter)

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.22 }}
        >
            <Card className="border-none shadow-[0_4px_24px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_32px_rgb(0,0,0,0.08)] transition-all duration-300 bg-white dark:bg-zinc-900/60 overflow-hidden">
                {/* Accent bar */}
                <div className={cn("h-1 w-full", orderBadge.color)} />

                <CardContent className="p-0">
                    {/* ── Order summary row (clickable) ── */}
                    <button
                        onClick={() => setExpanded(prev => !prev)}
                        className="w-full text-left p-5 sm:p-6 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/20 transition-colors group"
                    >
                        <div className="flex flex-col lg:flex-row lg:items-center gap-5">

                            {/* Party & Quality */}
                            <div className="flex-1 space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className={cn("w-2 h-2 rounded-full", orderBadge.color)} />
                                    <span className="text-[11px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{orderBadge.label}</span>
                                    <span className="text-[11px] font-bold text-muted-foreground/50">·</span>
                                    <span className="text-[11px] font-bold text-muted-foreground/60">{group.dispatches.length} batch{group.dispatches.length !== 1 ? 'es' : ''}</span>
                                </div>
                                <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                                    <User className="h-4 w-4 text-primary/50 flex-shrink-0" />
                                    {group.partyName}
                                </h3>
                                {group.qualityLabel && (
                                    <p className="text-sm font-bold text-muted-foreground flex items-center gap-1.5">
                                        <Layers className="h-3.5 w-3.5" />
                                        {group.qualityLabel}
                                    </p>
                                )}
                            </div>

                            {/* Progress section */}
                            <div className="flex-1 space-y-3 max-w-sm">
                                {/* Numbers row */}
                                <div className="flex items-end justify-between gap-4">
                                    <div>
                                        <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wider">Dispatched</p>
                                        <p className="text-xl font-black tabular-nums text-foreground">
                                            {group.totalDispatched.toFixed(0)}
                                            <span className="text-xs ml-1 font-bold text-muted-foreground">m</span>
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wider">Remaining</p>
                                        <p className={cn(
                                            "text-xl font-black tabular-nums",
                                            remaining > 0 ? "text-amber-500" : "text-emerald-500"
                                        )}>
                                            {remaining.toFixed(0)}
                                            <span className="text-xs ml-1 font-bold opacity-60">m</span>
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wider">Target</p>
                                        <p className="text-xl font-black tabular-nums text-muted-foreground">
                                            {group.totalTargetMeters.toFixed(0)}
                                            <span className="text-xs ml-1 font-bold opacity-60">m</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div className="relative h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                    <motion.div
                                        className={cn(
                                            "absolute left-0 top-0 bottom-0 rounded-full",
                                            group.hasDisputed ? "bg-rose-400" : group.hasInTransit ? "bg-amber-400" : "bg-emerald-500"
                                        )}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${dispatchedPct}%` }}
                                        transition={{ duration: 0.7, ease: "easeOut" }}
                                    />
                                </div>
                                <p className="text-[10px] font-bold text-muted-foreground/60 text-right">
                                    {dispatchedPct.toFixed(1)}% dispatched
                                </p>
                            </div>

                            {/* Actions + chevron */}
                            <div className="flex items-center gap-3 lg:flex-col lg:items-end lg:min-w-[160px]">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 font-bold text-primary hover:bg-primary/5 rounded-xl text-xs shrink-0"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        window.open(`/track/${group.trackingToken}`, '_blank')
                                    }}
                                >
                                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                                    Track Portal
                                </Button>
                                <div className={cn(
                                    "p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 transition-transform duration-300",
                                    expanded && "rotate-180"
                                )}>
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                </div>
                            </div>
                        </div>

                        {/* Shortage banner (only if relevant) */}
                        {group.shortage > 0.01 && (
                            <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-xl">
                                <AlertTriangle className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
                                <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                                    Shortage of <span className="font-black">{group.shortage.toFixed(2)} m</span> across delivered batches
                                </p>
                            </div>
                        )}
                    </button>

                    {/* ── Expanded dispatch list ── */}
                    <AnimatePresence>
                        {expanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.28, ease: 'easeInOut' }}
                                className="overflow-hidden"
                            >
                                <div className="px-5 sm:px-6 pb-5 space-y-2.5 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                                    <p className="text-[11px] font-black text-muted-foreground/50 uppercase tracking-widest mb-3">
                                        Dispatch Batches ({visibleDispatches.length})
                                    </p>
                                    <AnimatePresence>
                                        {visibleDispatches.length > 0 ? (
                                            visibleDispatches.map(d => (
                                                <DispatchBatchRow key={d.id} dispatch={d} />
                                            ))
                                        ) : (
                                            <div className="py-6 text-center text-sm font-medium text-muted-foreground/50">
                                                No batches match the current filter.
                                            </div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </CardContent>
            </Card>
        </motion.div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DispatchesClient({ initialDispatches }: DispatchesClientProps) {
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'in_transit' | 'delivered' | 'disputed'>('all')

    // ── Group dispatches by order ──
    const orderGroups = useMemo<OrderGroup[]>(() => {
        const map = new Map<string, OrderGroup>()

        for (const d of initialDispatches) {
            const oid = d.orders.id
            if (!map.has(oid)) {
                map.set(oid, {
                    orderId: oid,
                    partyName: d.orders.party_name,
                    qualityLabel: d.orders.quality_label,
                    trackingToken: d.orders.tracking_token,
                    totalTargetMeters: Number(d.orders.total_target_meters),
                    orderStatus: d.orders.status,
                    dispatches: [],
                    totalDispatched: 0,
                    totalReceived: 0,
                    shortage: 0,
                    hasInTransit: false,
                    hasDisputed: false,
                })
            }
            const group = map.get(oid)!
            group.dispatches.push(d)
            group.totalDispatched += Number(d.qty_meters_sent)
            if (d.status === 'delivered') group.totalReceived += Number(d.qty_meters_received ?? 0)
            if (d.status === 'in_transit') group.hasInTransit = true
            if (d.status === 'disputed') group.hasDisputed = true
        }

        // Compute shortage
        for (const g of map.values()) {
            g.shortage = g.dispatches
                .filter(d => d.status === 'delivered' && d.qty_meters_received !== null)
                .reduce((acc, d) => {
                    const diff = Number(d.qty_meters_sent) - Number(d.qty_meters_received!)
                    return acc + (diff > 0.01 ? diff : 0)
                }, 0)

            // Sort dispatches newest first within the group
            g.dispatches.sort((a, b) => b.dispatch_number - a.dispatch_number)
        }

        return Array.from(map.values())
    }, [initialDispatches])

    // ── Filter order groups ──
    const filteredGroups = useMemo(() => {
        return orderGroups.filter(g => {
            const searchLower = search.toLowerCase()
            const matchesSearch = !search ||
                g.partyName.toLowerCase().includes(searchLower) ||
                (g.qualityLabel || '').toLowerCase().includes(searchLower)

            const matchesStatus = statusFilter === 'all' ||
                g.dispatches.some(d => d.status === statusFilter)

            return matchesSearch && matchesStatus
        })
    }, [orderGroups, search, statusFilter])

    // ── Summary stats (across all dispatches) ──
    const totalSent = initialDispatches.reduce((acc, d) => acc + Number(d.qty_meters_sent), 0)
    const totalReceived = initialDispatches.reduce((acc, d) => acc + Number(d.qty_meters_received || 0), 0)
    const inTransitCount = initialDispatches.filter(d => d.status === 'in_transit').length
    const shortageTotal = orderGroups.reduce((acc, g) => acc + g.shortage, 0)

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Dispatches</h1>
                <p className="text-muted-foreground font-medium">Monitor fabric shipments grouped by order — track progress and verify trader confirmations.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white dark:bg-zinc-900/50">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="p-2.5 bg-primary/10 rounded-xl">
                                <Layers className="h-5 w-5 text-primary" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <p className="text-sm font-bold text-muted-foreground/80 uppercase tracking-wider">Total Sent</p>
                            <h3 className="text-2xl font-black mt-1 tabular-nums">{totalSent.toLocaleString()} m</h3>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white dark:bg-zinc-900/50">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <p className="text-sm font-bold text-muted-foreground/80 uppercase tracking-wider">Confirmed Received</p>
                            <h3 className="text-2xl font-black mt-1 tabular-nums">{totalReceived.toLocaleString()} m</h3>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white dark:bg-zinc-900/50">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="p-2.5 bg-amber-100 dark:bg-amber-500/20 rounded-xl">
                                <Truck className="h-5 w-5 text-amber-600" />
                            </div>
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Active</Badge>
                        </div>
                        <div className="mt-4">
                            <p className="text-sm font-bold text-muted-foreground/80 uppercase tracking-wider">In Transit</p>
                            <h3 className="text-2xl font-black mt-1 tabular-nums">{inTransitCount} Batches</h3>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white dark:bg-zinc-900/50">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="p-2.5 bg-rose-100 dark:bg-rose-500/20 rounded-xl">
                                <AlertTriangle className="h-5 w-5 text-rose-600" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <p className="text-sm font-bold text-muted-foreground/80 uppercase tracking-wider">Total Shortage</p>
                            <h3 className="text-2xl font-black mt-1 tabular-nums text-rose-600">-{shortageTotal.toFixed(2)} m</h3>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by party or quality..."
                        className="pl-10 h-11 bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm font-medium"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    {(['all', 'in_transit', 'delivered', 'disputed'] as const).map((status) => (
                        <Button
                            key={status}
                            variant={statusFilter === status ? 'default' : 'outline'}
                            onClick={() => setStatusFilter(status)}
                            className={cn(
                                "h-11 px-5 rounded-xl font-bold capitalize transition-all",
                                statusFilter === status ? "shadow-md scale-105" : "bg-white dark:bg-zinc-900/50"
                            )}
                        >
                            {status.replace('_', ' ')}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Order Group List */}
            <div className="grid gap-4">
                <AnimatePresence mode="popLayout">
                    {filteredGroups.length > 0 ? (
                        filteredGroups.map(group => (
                            <OrderGroupCard
                                key={group.orderId}
                                group={group}
                                statusFilter={statusFilter}
                            />
                        ))
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="py-20 text-center space-y-4"
                        >
                            <div className="inline-flex p-6 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                                <Truck className="h-10 w-10 text-muted-foreground/30" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-foreground">No dispatches found</h3>
                                <p className="text-muted-foreground font-medium max-w-xs mx-auto">Try adjusting your search or filters.</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
