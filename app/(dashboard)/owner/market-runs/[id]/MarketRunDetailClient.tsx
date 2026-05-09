'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
    ArrowLeft,
    TrendingUp,
    Package,
    Warehouse,
    Store,
    Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { updateMarketRunStatus } from '../../estimator/actions'
import { useTranslation } from '@/lib/i18n/context'

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
    stock_lot_count?:     number
    created_at:           string
}

type MarketRunSale = {
    id:              string
    market_run_id:   string
    party_id:        string
    invoice_id:      string | null
    meters_sold:     number
    price_per_meter: number
    cost_per_meter:  number
    status:          'pending' | 'dispatched' | 'settled'
    sale_date:       string
    notes:           string | null
    parties:         { id: string; name: string; phone: string | null }
}

const STATUS_CONFIG: Record<MarketRunSummary['status'], { label: string; color: string; dot: string }> = {
    production:     { label: 'In Production', color: 'bg-blue-50 text-blue-700 border-blue-200',   dot: 'bg-blue-500' },
    in_godown:      { label: 'In Godown',     color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    partially_sold: { label: 'Partially Sold',color: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
    sold_out:       { label: 'Sold Out',      color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    closed:         { label: 'Closed',        color: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-400' },
}

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` }
function fmtM(n: number) { return `${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}m` }

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MarketRunDetailClient({
    run,
    initialSales,
}: {
    run: MarketRunSummary
    initialSales: MarketRunSale[]
}) {
    const { tx } = useTranslation()
    const [submitting, setSubmitting] = useState(false)

    const status = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.production
    const marginPct = run.total_revenue > 0
        ? ((run.total_profit / run.total_revenue) * 100).toFixed(1)
        : '0.0'

    const availableGodown = Math.max(0, run.meters_in_godown)

    const handleCloseRun = async () => {
        if (!confirm(tx('Are you sure you want to mark this run as closed? It will be archived.'))) return
        
        setSubmitting(true)
        const res = await updateMarketRunStatus(run.market_run_id, 'closed')
        setSubmitting(false)

        if (res.error) toast.error(res.error)
        else toast.success(tx('Market run closed'))
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header & Navigation */}
            <div>
                <Link href="/owner/market-runs" className="inline-flex items-center text-xs font-bold text-muted-foreground hover:text-foreground mb-3 transition-colors">
                    <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to Market Runs
                </Link>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                                {run.fabric_label}
                            </h1>
                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${status.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                                {status.label}
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {run.quality_label && <span className="font-semibold text-foreground mr-2">{run.quality_label}</span>}
                            Created {new Date(run.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {run.order_id && (
                            <Button variant="outline" size="sm" asChild className="gap-2">
                                <Link href={`/owner/orders/${run.order_id}`}>
                                    <Package className="h-4 w-4" />
                                    Floor Order
                                </Link>
                            </Button>
                        )}
                        {run.status !== 'closed' && (
                            <Button variant="secondary" size="sm" onClick={handleCloseRun} disabled={submitting}>
                                Mark Closed
                            </Button>
                        )}
                        <Button asChild className="gap-2 shadow-md shadow-primary/20">
                            <Link href="/owner/stock">
                                <Store className="h-4 w-4" />
                                Manage Stock
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Metrics Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border-border/50">
                    <CardContent className="p-4 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 rounded-lg bg-slate-100">
                                <Package className="h-3.5 w-3.5 text-slate-600" />
                            </div>
                            <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Target / Produced</span>
                        </div>
                        <div>
                            <p className="text-2xl font-black text-foreground">{fmtM(run.total_meters_produced)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">of {fmtM(run.target_meters)} target</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className={`border-border/50 ${availableGodown > 0 ? 'bg-amber-50/30' : ''}`}>
                    <CardContent className="p-4 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 rounded-lg bg-amber-100">
                                <Warehouse className="h-3.5 w-3.5 text-amber-700" />
                            </div>
                            <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Stock Remaining</span>
                        </div>
                        <div>
                            <p className="text-2xl font-black text-amber-700">{fmtM(availableGodown)}</p>
                            <p className="text-xs text-amber-700/70 mt-0.5">sellable via stock lots</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/50">
                    <CardContent className="p-4 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 rounded-lg bg-blue-50">
                                <Tag className="h-3.5 w-3.5 text-blue-600" />
                            </div>
                            <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Unit Cost</span>
                        </div>
                        <div>
                            <p className="text-2xl font-black text-foreground">₹{Number(run.cost_per_meter).toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">fixed production cost / m</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className={`border-border/50 ${run.total_profit > 0 ? 'bg-emerald-50/30 border-emerald-100' : ''}`}>
                    <CardContent className="p-4 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 rounded-lg bg-emerald-100">
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-700" />
                            </div>
                            <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Total Profit</span>
                        </div>
                        <div>
                            <p className={`text-2xl font-black ${run.total_profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                {fmt(run.total_profit)}
                            </p>
                            <p className="text-xs text-emerald-700/70 mt-0.5">{marginPct}% blended margin</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Sales List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold tracking-tight">Run Profit Trail</h2>
                </div>

                {initialSales.length === 0 ? (
                    <div className="text-center py-16 px-4 border border-dashed border-border rounded-xl bg-muted/20">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                            <Store className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <h3 className="text-base font-bold text-foreground">No direct trader invoices</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
                            Sell and adjust physical takas from Stock. This run summary will still reflect market-run stock sales.
                        </p>
                        <Button variant="outline" asChild>
                            <Link href="/owner/stock">Open Stock</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold border-b border-border">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Date</th>
                                    <th className="px-4 py-3 font-semibold">Direct Trader Invoice</th>
                                    <th className="px-4 py-3 font-semibold text-right">Meters</th>
                                    <th className="px-4 py-3 font-semibold text-right">Price/m</th>
                                    <th className="px-4 py-3 font-semibold text-right">Profit/m</th>
                                    <th className="px-4 py-3 font-semibold text-right">Total Profit</th>
                                    <th className="px-4 py-3 font-semibold text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {initialSales.map((sale) => {
                                    const profitPerM = sale.price_per_meter - sale.cost_per_meter
                                    const totalProfit = profitPerM * sale.meters_sold
                                    return (
                                        <tr key={sale.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                                {new Date(sale.sale_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap font-bold text-foreground">
                                                {sale.parties.name}
                                                {sale.invoice_id && (
                                                    <span className="block text-[10px] text-muted-foreground font-normal mt-0.5">
                                                        Ledger Linked
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right font-medium">
                                                {fmtM(sale.meters_sold)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-foreground">
                                                ₹{Number(sale.price_per_meter).toFixed(2)}
                                            </td>
                                            <td className={`px-4 py-3 whitespace-nowrap text-right font-semibold ${profitPerM >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {profitPerM > 0 ? '+' : ''}₹{profitPerM.toFixed(2)}
                                            </td>
                                            <td className={`px-4 py-3 whitespace-nowrap text-right font-bold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {totalProfit > 0 ? '+' : ''}{fmt(totalProfit)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                <Badge variant="outline" className={
                                                    sale.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    sale.status === 'dispatched' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                }>
                                                    {sale.status === 'pending' ? 'Pending' : 
                                                     sale.status === 'dispatched' ? 'Dispatched' : 'Settled'}
                                                </Badge>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

        </div>
    )
}
