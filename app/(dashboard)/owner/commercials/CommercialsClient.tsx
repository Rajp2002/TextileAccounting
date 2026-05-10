'use client'

import { useMemo, useState } from 'react'
import type { ElementType } from 'react'
import {
    BadgeIndianRupee,
    BarChart3,
    FileText,
    IndianRupee,
    PackageCheck,
    Search,
    TrendingUp,
    CalendarDays,
    ArrowRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type {
    CommercialProfitEntry,
    CommercialsData,
    CommercialSourceKind,
    CommercialStage,
} from './actions'

type StageFilter = 'all' | CommercialStage
type SourceFilter =
    | 'all'
    | CommercialSourceKind
    | 'stock_sale_market_run'
    | 'stock_sale_order'
    | 'stock_sale_manual'

function money(value: number, digits = 0) {
    return `₹${Number(value || 0).toLocaleString('en-IN', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    })}`
}

function meters(value: number) {
    return `${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}m`
}

function MetricCard({
    label,
    value,
    helper,
    icon: Icon,
    tone,
}: {
    label: string
    value: string
    helper: string
    icon: ElementType
    tone: string
}) {
    return (
        <Card className="border-border/60 shadow-sm">
            <CardContent className="p-4">
                <div className="flex items-center gap-2">
                    <div className={cn('rounded-lg p-1.5', tone)}>
                        <Icon className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                </div>
                <p className="mt-3 text-2xl font-black tabular-nums text-foreground">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
            </CardContent>
        </Card>
    )
}

function stageBadge(stage: CommercialStage) {
    return stage === 'realized'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-amber-50 text-amber-700 border-amber-200'
}

function stockSaleOrigin(entry: CommercialProfitEntry) {
    if (entry.source_kind !== 'stock_sale') return null

    const label = entry.source_label.toLowerCase()
    if (label.includes('market run')) return 'market_run'
    if (label.includes('order')) return 'order'
    return 'manual'
}

function displaySourceLabel(entry: CommercialProfitEntry) {
    if (entry.source_kind === 'stock_sale') {
        const origin = stockSaleOrigin(entry)
        if (origin === 'market_run') return 'Market-Run Stock'
        if (origin === 'order') return 'Order Stock'
        return 'Godown Stock'
    }

    switch (entry.source_kind) {
        case 'order_invoice':
            return 'Order Invoice'
        case 'order_quote':
            return 'Expected Order'
        case 'market_run_sale':
            return 'Direct Market Sale'
        default:
            return entry.source_kind
    }
}

function sourceTone(entry: CommercialProfitEntry) {
    if (entry.source_kind === 'stock_sale') {
        const origin = stockSaleOrigin(entry)
        if (origin === 'market_run') return 'bg-violet-50 text-violet-700 border-violet-200'
        if (origin === 'order') return 'bg-blue-50 text-blue-700 border-blue-200'
        return 'bg-slate-50 text-slate-700 border-slate-200'
    }

    switch (entry.source_kind) {
        case 'order_invoice':
            return 'bg-blue-50 text-blue-700 border-blue-200'
        case 'order_quote':
            return 'bg-amber-50 text-amber-700 border-amber-200'
        case 'market_run_sale':
            return 'bg-violet-50 text-violet-700 border-violet-200'
        default:
            return 'bg-slate-50 text-slate-700 border-slate-200'
    }
}

function matchesSourceFilter(entry: CommercialProfitEntry, source: SourceFilter) {
    if (source === 'all') return true
    if (source === 'stock_sale_market_run') return entry.source_kind === 'stock_sale' && stockSaleOrigin(entry) === 'market_run'
    if (source === 'stock_sale_order') return entry.source_kind === 'stock_sale' && stockSaleOrigin(entry) === 'order'
    if (source === 'stock_sale_manual') return entry.source_kind === 'stock_sale' && stockSaleOrigin(entry) === 'manual'
    return entry.source_kind === source
}

function EntryRow({ entry }: { entry: CommercialProfitEntry }) {
    const margin = entry.revenue_amount > 0
        ? (entry.gross_profit_amount / entry.revenue_amount) * 100
        : null

    return (
        <tr className="hover:bg-muted/30">
            <td className="px-4 py-3 align-top">
                <p className="font-semibold text-foreground">
                    {new Date(entry.event_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{entry.reference || entry.source_label}</p>
            </td>
            <td className="px-4 py-3 align-top">
                <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className={cn('font-bold', sourceTone(entry))}>
                        {displaySourceLabel(entry)}
                    </Badge>
                    <Badge variant="outline" className={cn('font-bold capitalize', stageBadge(entry.stage))}>
                        {entry.stage}
                    </Badge>
                </div>
                <p className="mt-2 font-black text-foreground">{entry.quality_label}</p>
            </td>
            <td className="px-4 py-3 text-right align-top">
                <p className="font-bold text-foreground">{entry.quantity_label || meters(entry.meters_sold)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{meters(entry.meters_sold)}</p>
            </td>
            <td className="px-4 py-3 text-right align-top">
                <p className="font-bold text-foreground">{money(entry.price_per_meter, 2)}</p>
                <p className="mt-1 text-xs text-muted-foreground">cost {money(entry.cost_per_meter, 2)}</p>
            </td>
            <td className="px-4 py-3 text-right align-top">
                <p className="font-bold text-foreground">{money(entry.revenue_amount)}</p>
                <p className="mt-1 text-xs text-muted-foreground">cost {money(entry.cost_amount)}</p>
            </td>
            <td className="px-4 py-3 text-right align-top">
                <p className={cn('font-black', entry.gross_profit_amount >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                    {entry.gross_profit_amount >= 0 ? '+' : ''}{money(entry.gross_profit_amount)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{margin == null ? '—' : `${margin.toFixed(1)}% margin`}</p>
            </td>
        </tr>
    )
}

interface Receivable {
    id: string
    party_name: string
    quality_label: string
    payment_status: 'unpaid' | 'partial' | 'paid'
    total_amount: number
    received_amount: number
    balance_amount: number
    due_date?: string | null
}

interface CommercialsClientProps {
    initialData: CommercialsData
    initialReceivables: Receivable[]
}

export default function CommercialsClient({ initialData, initialReceivables }: CommercialsClientProps) {
    const [query, setQuery] = useState('')
    const [stage, setStage] = useState<StageFilter>('all')
    const [source, setSource] = useState<SourceFilter>('all')
    const [activeTab, setActiveTab] = useState('overview')

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase()
        return initialData.entries.filter((entry) => {
            const matchesStage = stage === 'all' || entry.stage === stage
            const matchesSource = matchesSourceFilter(entry, source)
            const haystack = `${entry.quality_label} ${entry.source_label} ${entry.reference || ''}`.toLowerCase()
            return matchesStage && matchesSource && (!needle || haystack.includes(needle))
        })
    }, [initialData.entries, query, source, stage])

    const filteredSummary = useMemo(() => {
        return filtered.reduce((acc, entry) => {
            acc.revenue += entry.revenue_amount
            acc.cost += entry.cost_amount
            acc.profit += entry.gross_profit_amount
            return acc
        }, { revenue: 0, cost: 0, profit: 0 })
    }, [filtered])

    const sourceFilters: Array<{ key: SourceFilter; label: string }> = [
        { key: 'all', label: 'All' },
        { key: 'order_invoice', label: 'Order Invoices' },
        { key: 'stock_sale', label: 'All Stock Sales' },
        { key: 'stock_sale_market_run', label: 'Market-Run Stock' },
        { key: 'stock_sale_order', label: 'Order Stock' },
        { key: 'stock_sale_manual', label: 'Manual Stock' },
        { key: 'market_run_sale', label: 'Direct Market Sales' },
        { key: 'order_quote', label: 'Expected Orders' },
    ]

    // Calculate Receivables Summary
    const receivablesSummary = useMemo(() => {
        return initialReceivables.reduce((acc, rec) => {
            acc.total += rec.total_amount
            acc.received += rec.received_amount
            acc.balance += rec.balance_amount
            if (rec.payment_status === 'unpaid' || rec.payment_status === 'partial') {
                acc.moneyToCollect += rec.balance_amount
                // Check if overdue
                if (rec.due_date && new Date(rec.due_date) < new Date()) {
                    acc.overdue += rec.balance_amount
                }
            }
            return acc
        }, { total: 0, received: 0, balance: 0, moneyToCollect: 0, overdue: 0 })
    }, [initialReceivables])

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground">Commercials</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Profit tracking, receivables, and payment collection.</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="receivables">Receivables ({initialReceivables.length})</TabsTrigger>
                    <TabsTrigger value="profit_entries">Profit Entries ({initialData.entries.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <MetricCard
                            label="Realized Revenue"
                            value={money(initialData.summary.realized_revenue)}
                            helper={`${money(initialData.summary.realized_cost)} production cost`}
                            icon={IndianRupee}
                            tone="bg-blue-50 text-blue-600"
                        />
                        <MetricCard
                            label="Realized Profit"
                            value={money(initialData.summary.realized_profit)}
                            helper={initialData.summary.realized_margin_pct == null ? 'No realized sales yet' : `${initialData.summary.realized_margin_pct.toFixed(1)}% gross margin`}
                            icon={TrendingUp}
                            tone="bg-emerald-50 text-emerald-700"
                        />
                        <MetricCard
                            label="Money to Collect"
                            value={money(receivablesSummary.moneyToCollect)}
                            helper={`${money(receivablesSummary.overdue)} overdue`}
                            icon={BadgeIndianRupee}
                            tone="bg-violet-50 text-violet-700"
                        />
                        <MetricCard
                            label="Expected Profit"
                            value={money(initialData.summary.expected_profit)}
                            helper={`${money(initialData.summary.expected_revenue)} expected revenue`}
                            icon={FileText}
                            tone="bg-amber-50 text-amber-700"
                        />
                    </div>

                    <Card className="border-border/60">
                        <CardContent className="p-6 flex flex-col items-center justify-center text-center py-12">
                            <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/70" />
                            <p className="text-lg font-bold text-foreground">Commercials Dashboard</p>
                            <p className="text-sm text-muted-foreground mt-1">Use the tabs above to view detailed Receivables and Profit Entries.</p>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="receivables" className="space-y-6">
                    <div className="flex flex-col gap-3 lg:flex-row">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search party, quality..."
                                className="pl-10"
                            />
                        </div>
                    </div>

                    <Card className="border-border/60">
                        <CardContent className="p-0">
                            {initialReceivables.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <BadgeIndianRupee className="mb-3 h-10 w-10 text-muted-foreground/70" />
                                    <p className="text-lg font-bold text-foreground">No receivables found</p>
                                    <p className="text-sm text-muted-foreground mt-1">Sales will automatically create receivables here.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                                            <tr>
                                                <th className="px-4 py-3 font-bold">Party / Quality</th>
                                                <th className="px-4 py-3 font-bold">Status</th>
                                                <th className="px-4 py-3 text-right font-bold">Total</th>
                                                <th className="px-4 py-3 text-right font-bold">Received</th>
                                                <th className="px-4 py-3 text-right font-bold">Balance</th>
                                                <th className="px-4 py-3 font-bold">Due Date</th>
                                                <th className="px-4 py-3 text-right font-bold">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/40">
                                            {initialReceivables.map((rec) => (
                                                <tr key={rec.id} className="hover:bg-muted/30">
                                                    <td className="px-4 py-3">
                                                        <p className="font-bold text-foreground">{rec.party_name}</p>
                                                        <p className="text-xs text-muted-foreground">{rec.quality_label}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant="outline" className={cn('capitalize font-bold', 
                                                            rec.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                            rec.payment_status === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                            'bg-rose-50 text-rose-700 border-rose-200'
                                                        )}>
                                                            {rec.payment_status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold">{money(rec.total_amount)}</td>
                                                    <td className="px-4 py-3 text-right text-emerald-600">{money(rec.received_amount)}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-rose-600">{money(rec.balance_amount)}</td>
                                                    <td className="px-4 py-3">
                                                        {rec.due_date ? (
                                                            <div className="flex items-center gap-1 text-xs font-semibold">
                                                                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                                                                {new Date(rec.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                            </div>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Button variant="ghost" size="sm" className="gap-1 text-xs">
                                                            Record Payment <ArrowRight className="h-3 w-3" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="profit_entries" className="space-y-6">
                    <div className="flex flex-col gap-3 lg:flex-row">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search quality, reference, source..."
                                className="pl-10"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(['all', 'realized', 'expected'] as StageFilter[]).map((item) => (
                                <Button
                                    key={item}
                                    variant={stage === item ? 'default' : 'outline'}
                                    onClick={() => setStage(item)}
                                    className="capitalize"
                                >
                                    {item}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {sourceFilters.map((item) => (
                            <Button
                                key={item.key}
                                variant={source === item.key ? 'default' : 'outline'}
                                onClick={() => setSource(item.key)}
                            >
                                {item.label}
                            </Button>
                        ))}
                    </div>

                    <Card className="border-border/60">
                        <CardContent className="p-0">
                            {filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <PackageCheck className="mb-3 h-10 w-10 text-muted-foreground/70" />
                                    <p className="text-lg font-bold text-foreground">No commercial entries found</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                                            <tr>
                                                <th className="px-4 py-3 font-bold">Date</th>
                                                <th className="px-4 py-3 font-bold">Source</th>
                                                <th className="px-4 py-3 text-right font-bold">Quantity</th>
                                                <th className="px-4 py-3 text-right font-bold">Rate / m</th>
                                                <th className="px-4 py-3 text-right font-bold">Revenue</th>
                                                <th className="px-4 py-3 text-right font-bold">Gross Profit</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/40">
                                            {filtered.map((entry) => (
                                                <EntryRow key={`${entry.source_kind}-${entry.source_id}`} entry={entry} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="grid gap-3 md:grid-cols-3">
                        <Card className="border-border/60">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2">
                                    <BadgeIndianRupee className="h-4 w-4 text-muted-foreground" />
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Filtered Revenue</p>
                                </div>
                                <p className="mt-3 text-xl font-black text-foreground">{money(filteredSummary.revenue)}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-border/60">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2">
                                    <PackageCheck className="h-4 w-4 text-muted-foreground" />
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Filtered Cost</p>
                                </div>
                                <p className="mt-3 text-xl font-black text-foreground">{money(filteredSummary.cost)}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-border/60">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Filtered Margin</p>
                                </div>
                                <p className={cn('mt-3 text-xl font-black', filteredSummary.profit >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                                    {filteredSummary.revenue > 0 ? `${((filteredSummary.profit / filteredSummary.revenue) * 100).toFixed(1)}%` : '—'}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
