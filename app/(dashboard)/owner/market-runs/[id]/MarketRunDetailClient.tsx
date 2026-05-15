'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    ArrowLeft,
    TrendingUp,
    Package,
    Warehouse,
    Store,
    Tag,
    Archive,
    Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { updateMarketRunStatus } from '../../estimator/actions'
import { getMarketRunDisplayStatus } from '@/lib/market-runs'
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
    const router = useRouter()
    const [submitting, setSubmitting] = useState(false)
    const [closeDialogOpen, setCloseDialogOpen] = useState(false)

    const derivedStatus = getMarketRunDisplayStatus({
        storedStatus: run.status,
        producedQuantity: run.total_meters_produced,
        availableQuantity: run.meters_in_godown,
        soldQuantity: run.total_meters_sold
    })
    const status = STATUS_CONFIG[derivedStatus] ?? STATUS_CONFIG.production
    const marginPct = run.total_revenue > 0
        ? ((run.total_profit / run.total_revenue) * 100).toFixed(1)
        : '0.0'

    const availableGodown = Math.max(0, run.meters_in_godown)

    const handleCloseRun = async () => {
        setSubmitting(true)
        const res = await updateMarketRunStatus(run.market_run_id, 'closed')
        setSubmitting(false)

        if (res.error) toast.error(res.error)
        else {
            setCloseDialogOpen(false)
            toast.success(tx('Market run closed'))
            router.refresh()
        }
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
                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${status.color}`}>
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
                            <Button variant="outline" asChild className="h-11 gap-2 lg:h-9">
                                <Link href={`/owner/orders?orderId=${run.order_id}`}>
                                    <Package className="h-4 w-4" />
                                    Floor Order
                                </Link>
                            </Button>
                        )}
                        {run.status !== 'closed' && (
                            <Button variant="secondary" onClick={() => setCloseDialogOpen(true)} disabled={submitting} className="h-11 lg:h-9">
                                Mark Closed
                            </Button>
                        )}
                        <Button asChild className="h-11 gap-2 shadow-md shadow-primary/20 lg:h-9">
                            <Link href="/owner/stock">
                                <Store className="h-4 w-4" />
                                Manage Stock
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>

            {derivedStatus === 'sold_out' && run.status !== 'closed' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-full">
                            <Store className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-emerald-800">All stock from this market run has been sold.</p>
                            <p className="text-xs text-emerald-700">Mark this market run as closed?</p>
                        </div>
                    </div>
                    <Button variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0" onClick={() => setCloseDialogOpen(true)} disabled={submitting}>
                        Mark Closed
                    </Button>
                </div>
            )}

            <Dialog open={closeDialogOpen} onOpenChange={(open) => !submitting && setCloseDialogOpen(open)}>
                <DialogContent className="max-w-[calc(100%-2rem)] rounded-[1.35rem] p-0 sm:max-w-md" showCloseButton={false}>
                    <div className="border-b border-hairline bg-surface-soft/55 px-5 py-4">
                        <DialogHeader className="text-left">
                            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-saffron-soft text-saffron-deep">
                                <Archive className="h-5 w-5" />
                            </div>
                            <DialogTitle className="text-xl font-black tracking-tight">
                                Close market run?
                            </DialogTitle>
                            <DialogDescription className="text-sm text-body">
                                This will archive {run.fabric_label} and remove it from active market run work.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="space-y-3 px-5 py-4">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-xl border border-hairline bg-canvas px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Produced</p>
                                <p className="mt-1 text-lg font-black text-ink">{fmtM(run.total_meters_produced)}</p>
                            </div>
                            <div className="rounded-xl border border-hairline bg-canvas px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stock Left</p>
                                <p className="mt-1 text-lg font-black text-saffron-deep">{fmtM(availableGodown)}</p>
                            </div>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            The run history, sales, and profit trail stay available for review after closing.
                        </p>
                    </div>

                    <DialogFooter className="grid grid-cols-2 gap-2 border-t border-hairline bg-canvas px-5 py-4 sm:grid-cols-2">
                        <Button variant="outline" onClick={() => setCloseDialogOpen(false)} disabled={submitting} className="h-11">
                            Cancel
                        </Button>
                        <Button onClick={handleCloseRun} disabled={submitting} className="h-11 bg-ink text-white hover:bg-loom-elevated">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                            Close Run
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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

            {/* Guidance Card */}
            <Card className="border-orange-100 bg-orange-50/70">
                <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-full">
                            <Store className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-orange-800">Selling & Dispatching This Fabric</p>
                            <p className="text-xs text-stone-700 max-w-2xl">
                                Fabric produced from this Market Run is managed in Stock/Godown. To sell or dispatch it, open Stock and use Sell & Dispatch on the produced taka. Commercials will update from the completed sale.
                            </p>
                        </div>
                    </div>
                    <Button asChild className="h-11 gap-2 bg-orange-600 hover:bg-orange-700 text-white shrink-0 lg:h-9">
                        <Link href="/owner/stock">
                            <Store className="h-4 w-4" />
                            View Stock
                        </Link>
                    </Button>
                </CardContent>
            </Card>

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
                    <>
                        {/* Mobile Card List */}
                        <div className="md:hidden space-y-3">
                            {initialSales.map((sale) => {
                                const profitPerM = sale.price_per_meter - sale.cost_per_meter
                                const totalProfit = profitPerM * sale.meters_sold
                                return (
                                    <div key={sale.id} className="border border-border/60 rounded-xl p-4 bg-surface space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-bold text-foreground">{sale.parties.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(sale.sale_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                    {sale.invoice_id && ' · Ledger Linked'}
                                                </p>
                                            </div>
                                            <Badge variant="outline" className={
                                                sale.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                sale.status === 'dispatched' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            }>
                                                {sale.status === 'pending' ? 'Pending' : 
                                                 sale.status === 'dispatched' ? 'Dispatched' : 'Settled'}
                                            </Badge>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                            <div>
                                                <p className="text-muted-foreground font-medium mb-0.5">Meters</p>
                                                <p className="font-bold text-foreground">{fmtM(sale.meters_sold)}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground font-medium mb-0.5">Price/m</p>
                                                <p className="font-bold text-foreground">₹{Number(sale.price_per_meter).toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground font-medium mb-0.5">Profit/m</p>
                                                <p className={`font-bold ${profitPerM >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {profitPerM > 0 ? '+' : ''}₹{profitPerM.toFixed(2)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground font-medium mb-0.5">Total Profit</p>
                                                <p className={`font-bold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {totalProfit > 0 ? '+' : ''}{fmt(totalProfit)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs uppercase tracking-wider text-muted-foreground font-bold border-b border-border">
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
                                                        <span className="block text-xs text-muted-foreground font-normal mt-0.5">
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
                    </>
                )}
            </div>

        </div>
    )
}
