'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    TrendingUp, Warehouse, ArrowRight, Plus,
    AlertCircle, BarChart3, Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getMarketRunDisplayStatus } from '@/lib/market-runs'

// ─── Types ────────────────────────────────────────────────────────────────────

type MarketRunSummary = {
    market_run_id:        string
    org_id:               string
    fabric_label:         string
    quality_label:        string | null
    target_meters:        number
    cost_per_meter:       number
    status:               'production' | 'in_godown' | 'partially_sold' | 'sold_out' | 'closed'
    total_meters_produced: number
    total_meters_sold:    number
    meters_in_godown:     number
    total_revenue:        number
    total_cost_on_sold:   number
    total_profit:         number
    sales_count:          number
    order_id:             string | null
    created_at:           string
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<MarketRunSummary['status'], { label: string; color: string; dot: string }> = {
    production:     { label: 'In Production', color: 'bg-blue-50 text-blue-700 border-blue-200',   dot: 'bg-blue-500' },
    in_godown:      { label: 'In Godown',     color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    partially_sold: { label: 'Partially Sold',color: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
    sold_out:       { label: 'Sold Out',      color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    closed:         { label: 'Closed',        color: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-400' },
}

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` }
function fmtM(n: number) { return `${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}m` }

// ─── Run Card ─────────────────────────────────────────────────────────────────

function RunCard({ run }: { run: MarketRunSummary }) {
    const derivedStatus = getMarketRunDisplayStatus({
        storedStatus: run.status,
        producedQuantity: run.total_meters_produced,
        availableQuantity: run.meters_in_godown,
        soldQuantity: run.total_meters_sold
    })
    const status = STATUS_CONFIG[derivedStatus] ?? STATUS_CONFIG.production
    const productionPct = run.target_meters > 0
        ? Math.min(100, (run.total_meters_produced / run.target_meters) * 100)
        : 0
    const soldPct = run.total_meters_produced > 0
        ? Math.min(100, (run.total_meters_sold / run.total_meters_produced) * 100)
        : 0
    const marginPct = run.total_revenue > 0
        ? ((run.total_profit / run.total_revenue) * 100).toFixed(1)
        : '—'

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
        >
            <Link href={`/owner/market-runs/${run.market_run_id}`}>
                <Card className="group border border-border/60 hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden">
                    <CardContent className="p-0">
                        {/* Header */}
                        <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-border/40">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="text-sm font-bold text-foreground truncate">{run.fabric_label}</span>
                                    {run.quality_label && (
                                        <span className="text-[10px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                                            {run.quality_label}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Target: <span className="font-semibold text-foreground">{fmtM(run.target_meters)}</span>
                                    {' · '}Cost: <span className="font-semibold text-foreground">₹{Number(run.cost_per_meter).toFixed(2)}/m</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${status.color}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                                    {status.label}
                                </span>
                                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                            </div>
                        </div>

                        {/* Metrics row */}
                        <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
                            {/* Production */}
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Produced</p>
                                <p className="text-sm font-bold text-foreground">{fmtM(run.total_meters_produced)}</p>
                                <div className="mt-1.5 h-1 rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-blue-400 transition-all"
                                        style={{ width: `${productionPct}%` }}
                                    />
                                </div>
                            </div>

                            {/* In Godown */}
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">In Godown</p>
                                <p className="text-sm font-bold text-amber-600">{fmtM(Math.max(0, run.meters_in_godown))}</p>
                                <div className="mt-1.5 h-1 rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-amber-400 transition-all"
                                        style={{ width: `${100 - soldPct}%` }}
                                    />
                                </div>
                            </div>

                            {/* Profit */}
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Total Profit</p>
                                <p className={`text-sm font-bold ${run.total_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {fmt(run.total_profit)}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {marginPct !== '—' ? `${marginPct}% margin` : 'No sales yet'}
                                </p>
                            </div>

                            {/* Sales */}
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Sales</p>
                                <p className="text-sm font-bold text-foreground">{run.sales_count}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {fmtM(run.total_meters_sold)} sold
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </Link>
        </motion.div>
    )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center text-center py-20 px-8"
        >
            <div className="w-16 h-16 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center mb-4">
                <Layers className="h-7 w-7 text-violet-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">No market runs yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
                Start a market run to keep looms productive when client orders are light, then manage physical takas from Stock.
            </p>
            <Button onClick={onNew} className="gap-2">
                <Plus className="h-4 w-4" />
                New Market Run
            </Button>
        </motion.div>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MarketRunsClient({
    initialRuns,
    fetchError,
}: {
    initialRuns: MarketRunSummary[]
    fetchError?: string
}) {
    const router = useRouter()
    const [filter, setFilter] = useState<'all' | 'active' | 'selling' | 'done'>('all')

    const goToEstimator = () => router.push('/owner/estimator?mode=market')

    const FILTERS = [
        { key: 'all',     label: 'All' },
        { key: 'active',  label: 'In Production' },
        { key: 'selling', label: 'In Stock' },
        { key: 'done',    label: 'Completed' },
    ] as const

    const filtered = initialRuns.filter(r => {
        const derivedStatus = getMarketRunDisplayStatus({
            storedStatus: r.status,
            producedQuantity: r.total_meters_produced,
            availableQuantity: r.meters_in_godown,
            soldQuantity: r.total_meters_sold
        })
        if (filter === 'all')     return true
        if (filter === 'active')  return derivedStatus === 'production'
        if (filter === 'selling') return ['in_godown', 'partially_sold'].includes(derivedStatus)
        if (filter === 'done')    return ['sold_out', 'closed'].includes(derivedStatus)
        return true
    })

    // Summary stats
    const totalProfit   = initialRuns.reduce((s, r) => s + Number(r.total_profit ?? 0), 0)
    const inGodown      = initialRuns.reduce((s, r) => s + Math.max(0, Number(r.meters_in_godown ?? 0)), 0)
    const activeRuns    = initialRuns.filter(r => {
        const derivedStatus = getMarketRunDisplayStatus({
            storedStatus: r.status,
            producedQuantity: r.total_meters_produced,
            availableQuantity: r.meters_in_godown,
            soldQuantity: r.total_meters_sold
        })
        return derivedStatus === 'production'
    }).length

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-foreground">Market Runs</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Plan speculative grey fabric production, then manage finished takas from Stock
                    </p>
                </div>
                <Button onClick={goToEstimator} className="gap-2 shrink-0">
                    <Plus className="h-4 w-4" />
                    New Run
                </Button>
            </div>

            {/* Summary cards */}
            {initialRuns.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Card className="border-border/50">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-lg bg-blue-50">
                                    <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
                                </div>
                                <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Active</span>
                            </div>
                            <p className="text-2xl font-black text-foreground">{activeRuns}</p>
                            <p className="text-[11px] text-muted-foreground">loom runs in production</p>
                        </CardContent>
                    </Card>
                    <Card className="border-border/50">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-lg bg-amber-50">
                                    <Warehouse className="h-3.5 w-3.5 text-amber-600" />
                                </div>
                                <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Godown</span>
                            </div>
                            <p className="text-2xl font-black text-foreground">{fmtM(inGodown)}</p>
                            <p className="text-[11px] text-muted-foreground">tracked in Stock</p>
                        </CardContent>
                    </Card>
                    <Card className="border-border/50 col-span-2 sm:col-span-1">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-lg bg-emerald-50">
                                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                                </div>
                                <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Profit</span>
                            </div>
                            <p className={`text-2xl font-black ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {fmt(totalProfit)}
                            </p>
                            <p className="text-[11px] text-muted-foreground">total across all runs</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Error */}
            {fetchError && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {fetchError}
                </div>
            )}

            {/* Filter tabs */}
            {initialRuns.length > 0 && (
                <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 w-fit">
                    {FILTERS.map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 ${
                                filter === f.key
                                    ? 'bg-white text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            )}

            {/* List */}
            {initialRuns.length === 0 ? (
                <EmptyState onNew={goToEstimator} />
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                    No runs match this filter.
                </div>
            ) : (
                <div className="space-y-3">
                    <AnimatePresence initial={false}>
                        {filtered.map(run => (
                            <RunCard key={run.market_run_id} run={run} />
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    )
}
