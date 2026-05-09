'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { makeDefaultEstimateState } from '@/lib/estimator'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { convertAcceptedQuoteToOrder, updateQuoteStatus } from '../estimator/actions'
import { toast } from 'sonner'
import { addDays, format } from 'date-fns'
import {
    History,
    CheckCircle2,
    XCircle,
    Send,
    FileText,
    ArrowRight,
    Loader2,
    Package,
} from 'lucide-react'

const STATUS_CONFIG = {
    draft:    { label: 'Draft',    color: 'bg-slate-100 text-slate-700 border-slate-200' },
    sent:     { label: 'Sent',     color: 'bg-blue-50 text-blue-700 border-blue-200' },
    accepted: { label: 'Accepted', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rejected: { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200' },
}

type QuoteStatus = keyof typeof STATUS_CONFIG
type QuoteDraftState = ReturnType<typeof makeDefaultEstimateState>
type QuoteLinkedOrder = {
    id: string
    status: string
    warp_instruction?: string | null
    weft_instruction?: string | null
}

type QuoteRow = {
    id: string
    status: QuoteStatus
    party_name: string
    quality_label: string | null
    quote_price_per_meter: number
    landed_cost_per_meter: number
    intended_margin_percent: number
    created_at: string
    meters: number
    snapshot_data?: QuoteDraftState
    warp_instruction?: string | null
    weft_instruction?: string | null
    warp_rows?: QuoteDraftState['warpRows']
    weft_rows?: QuoteDraftState['weftRows']
    tape_length_m?: number | null
    per_pick_cost_paise?: number | null
    warping_rate_per_kg?: number | null
    sizing_rate_per_kg?: number | null
    winding_rate_per_kg?: number | null
    processing_rate_per_m?: number | null
    finishing_rate_per_m?: number | null
    yarn_shortage_pct?: number | null
    warp_crimp_pct?: number | null
    overhead_items?: QuoteDraftState['overheadItems']
    monthly_output_m?: number | null
    overhead_override_per_m?: number | null
    overhead_pct?: number | null
    commission_pct?: number | null
    transport_per_m?: number | null
    profit_margin_pct?: number | null
    enabled_sections?: QuoteDraftState['enabledSections']
    loom_type?: QuoteDraftState['loomType']
    estimator_rpm?: number | null
    estimator_power_kw?: number | null
    hours_per_shift?: number | null
    sizing_mode?: QuoteDraftState['sizingMode']
    orders?: QuoteLinkedOrder | QuoteLinkedOrder[] | null
}

function getLinkedOrder(quote: QuoteRow) {
    return Array.isArray(quote.orders) ? quote.orders[0] : quote.orders
}

function buildDraftStateFromQuote(quote: QuoteRow): QuoteDraftState {
    if (quote.snapshot_data) return quote.snapshot_data

    const base = makeDefaultEstimateState()
    return {
        ...base,
        warpRows: Array.isArray(quote.warp_rows) && quote.warp_rows.length > 0 ? quote.warp_rows : base.warpRows,
        weftRows: Array.isArray(quote.weft_rows) && quote.weft_rows.length > 0 ? quote.weft_rows : base.weftRows,
        tapeLengthM: Number(quote.tape_length_m ?? base.tapeLengthM),
        perPickCostPaisa: Number(quote.per_pick_cost_paise ?? base.perPickCostPaisa),
        warpingRatePerKg: Number(quote.warping_rate_per_kg ?? base.warpingRatePerKg),
        sizingRatePerKg: Number(quote.sizing_rate_per_kg ?? base.sizingRatePerKg),
        windingRatePerKg: Number(quote.winding_rate_per_kg ?? base.windingRatePerKg),
        processingRatePerM: Number(quote.processing_rate_per_m ?? base.processingRatePerM),
        finishingRatePerM: Number(quote.finishing_rate_per_m ?? base.finishingRatePerM),
        yarnShortagePct: Number(quote.yarn_shortage_pct ?? base.yarnShortagePct),
        warpCrimpPct: Number(quote.warp_crimp_pct ?? base.warpCrimpPct),
        overheadItems: Array.isArray(quote.overhead_items) ? quote.overhead_items : base.overheadItems,
        monthlyOutputM: Number(quote.monthly_output_m ?? base.monthlyOutputM),
        overheadOverridePerM: quote.overhead_override_per_m != null ? Number(quote.overhead_override_per_m) : base.overheadOverridePerM,
        overheadPct: Number(quote.overhead_pct ?? base.overheadPct),
        commissionPct: Number(quote.commission_pct ?? base.commissionPct),
        transportPerM: Number(quote.transport_per_m ?? base.transportPerM),
        profitPct: Number(quote.profit_margin_pct ?? quote.intended_margin_percent ?? base.profitPct),
        orderQuantityM: Number(quote.meters ?? 0) || null,
        enabledSections: quote.enabled_sections ?? base.enabledSections,
        loomType: quote.loom_type ?? base.loomType,
        loomRpm: quote.estimator_rpm != null ? Number(quote.estimator_rpm) : base.loomRpm,
        loomPowerKw: quote.estimator_power_kw != null ? Number(quote.estimator_power_kw) : base.loomPowerKw,
        loomRpmIsCustomised: quote.estimator_rpm != null,
        loomPowerKwIsCustomised: quote.estimator_power_kw != null,
        hoursPerShift: Number(quote.hours_per_shift ?? base.hoursPerShift),
        sizingMode: quote.sizing_mode ?? base.sizingMode,
        isConfigured: true,
    }
}

export default function QuotesClient({ initialQuotes, initialStatus, orgId, userId }: { initialQuotes: QuoteRow[], initialStatus?: string, orgId: string, userId: string }) {
    const router = useRouter()
    const [quotes, setQuotes] = useState<QuoteRow[]>(initialQuotes)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [filterStatus, setFilterStatus] = useState<string>(initialStatus || 'all')
    const [quoteToConvert, setQuoteToConvert] = useState<QuoteRow | null>(null)
    const [convertMeters, setConvertMeters] = useState('')
    const [convertDeadline, setConvertDeadline] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
    const [convertNotes, setConvertNotes] = useState('')

    const filteredQuotes = filterStatus === 'all'
        ? quotes
        : quotes.filter(q => q.status === filterStatus)

    const handleStatusChange = async (id: string, newStatus: 'draft' | 'sent' | 'accepted' | 'rejected') => {
        setUpdatingId(id)
        const res = await updateQuoteStatus(id, newStatus)
        setUpdatingId(null)
        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success(`Quote marked as ${newStatus}`)
            setQuotes(prev => prev.map(q => q.id === id ? { ...q, status: newStatus } : q))
        }
    }

    const openConvertDialog = (quote: QuoteRow) => {
        setQuoteToConvert(quote)
        const suggestedMeters = Number(quote.meters ?? 0)
        setConvertMeters(suggestedMeters > 0 ? String(suggestedMeters) : '')
        setConvertDeadline(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
        setConvertNotes('')
    }

    const handleConvertAcceptedQuote = async () => {
        if (!quoteToConvert) return

        const meters = Number(convertMeters)
        if (!Number.isFinite(meters) || meters <= 0) {
            toast.error('Enter a valid order quantity before creating the active order')
            return
        }

        setUpdatingId(quoteToConvert.id)
        const res = await convertAcceptedQuoteToOrder({
            quoteId: quoteToConvert.id,
            total_target_meters: meters,
            deadline: convertDeadline,
            notes: convertNotes.trim() || undefined,
        })
        setUpdatingId(null)

        if ('error' in res) {
            toast.error(res.error)
            return
        }

        toast.success('Accepted quote converted into an active order')
        setQuoteToConvert(null)
        router.push(`/owner/orders?orderId=${res.orderId}`)
    }

    const handleReEstimate = (quote: QuoteRow) => {
        try {
            const draftKey = `weavly-estimator-draft-${orgId}-${userId}`
            const linkedOrder = getLinkedOrder(quote)
            const newDraft = {
                state: buildDraftStateFromQuote(quote),
                partyName: quote.party_name || '',
                qualityLabel: quote.quality_label || '',
                warpInstruction: quote.warp_instruction || linkedOrder?.warp_instruction || '',
                weftInstruction: quote.weft_instruction || linkedOrder?.weft_instruction || '',
            }
            localStorage.setItem(draftKey, JSON.stringify(newDraft))
            toast.success('Quote snapshot restored')
            router.push('/owner/estimator')
        } catch (e) {
            toast.error('Failed to restore snapshot')
            console.error(e)
        }
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <History className="h-6 w-6 text-indigo-500" />
                        Quote History
                    </h1>
                    <p className="text-sm text-slate-500 font-medium">Move quotes from draft to sent, manually accept them, then create active orders.</p>
                </div>
                <div className="flex gap-2 p-1 bg-white border border-slate-200 rounded-lg shadow-sm w-full sm:w-auto overflow-x-auto">
                    {['all', 'draft', 'sent', 'accepted', 'rejected'].map(s => (
                        <button
                            key={s}
                            onClick={() => {
                                setFilterStatus(s)
                                router.replace(`/owner/quotes${s !== 'all' ? `?status=${s}` : ''}`)
                            }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md capitalize whitespace-nowrap transition-all ${
                                filterStatus === s
                                    ? 'bg-slate-900 text-white shadow-md'
                                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {filteredQuotes.length === 0 ? (
                <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
                    <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                        <div className="p-3 bg-white rounded-full shadow-sm shadow-slate-200/50">
                            <FileText className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-bold text-slate-600">No quotes found</p>
                        <p className="text-xs text-slate-500 max-w-xs">{
                            filterStatus === 'all'
                                ? "You haven't saved any quotes from the estimator yet."
                                : `No quotes with status "${filterStatus}".`
                        }</p>
                        {filterStatus !== 'all' && (
                            <Button variant="link" size="sm" onClick={() => setFilterStatus('all')} className="mt-2 text-indigo-600 font-bold">
                                Clear filters
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredQuotes.map(quote => {
                        const linkedOrder = getLinkedOrder(quote)
                        const canCreateOrder = quote.status === 'accepted' && !linkedOrder

                        return (
                            <Card key={quote.id} className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow relative group">
                                <CardContent className="p-5 flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="space-y-1 w-full min-w-0 pr-2">
                                            <h3 className="text-lg font-black text-slate-900 truncate tracking-tight">
                                                {quote.party_name}
                                            </h3>
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none truncate">
                                                {quote.quality_label}
                                            </p>
                                        </div>
                                        <Badge variant="outline" className={`${STATUS_CONFIG[quote.status as keyof typeof STATUS_CONFIG]?.color} capitalize font-bold`}>
                                            {quote.status}
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Quoted Cost</p>
                                            <p className="text-base font-black font-mono text-indigo-600">₹{Number(quote.quote_price_per_meter).toFixed(2)}/m</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Margin</p>
                                            <p className="text-base font-black font-mono text-emerald-600">
                                                {Number(quote.intended_margin_percent).toFixed(1)}%
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Production Cost</p>
                                            <p className="text-xs font-bold font-mono text-slate-600 mt-0.5">₹{Number(quote.landed_cost_per_meter).toFixed(2)}/m</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Date</p>
                                            <p className="text-xs font-bold text-slate-600 mt-0.5">{format(new Date(quote.created_at), 'MMM d, yyyy')}</p>
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-4 border-t border-slate-100 space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-1">
                                                {updatingId === quote.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                                                ) : (
                                                    <>
                                                        {quote.status === 'draft' && (
                                                            <button onClick={() => handleStatusChange(quote.id, 'sent')} className="p-1.5 rounded-md hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="Mark as Sent">
                                                                <Send className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                        {quote.status === 'sent' && (
                                                            <>
                                                                <button onClick={() => handleStatusChange(quote.id, 'accepted')} className="p-1.5 rounded-md hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors" title="Mark as Accepted">
                                                                    <CheckCircle2 className="h-4 w-4" />
                                                                </button>
                                                                <button onClick={() => handleStatusChange(quote.id, 'rejected')} className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Mark as Rejected">
                                                                    <XCircle className="h-4 w-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                            {linkedOrder && (
                                                <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">
                                                    Order #{linkedOrder.id.split('-')[0]}
                                                    {linkedOrder.status === 'completed' && <CheckCircle2 className="h-3 w-3 ml-1" />}
                                                </Badge>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 ml-auto"
                                                onClick={() => handleReEstimate(quote)}
                                            >
                                                Re-estimate
                                                <ArrowRight className="h-3 w-3 ml-1" />
                                            </Button>
                                        </div>

                                        {canCreateOrder && (
                                            <Button
                                                size="sm"
                                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
                                                onClick={() => openConvertDialog(quote)}
                                            >
                                                <Package className="h-4 w-4" />
                                                Create Active Order
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            <Dialog open={!!quoteToConvert} onOpenChange={(open) => !open && setQuoteToConvert(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-emerald-600" />
                            Create active order from accepted quote
                        </DialogTitle>
                        <DialogDescription>
                            This is the only production entry point now. The quote stays accepted and becomes linked to the new live order.
                        </DialogDescription>
                    </DialogHeader>

                    {quoteToConvert && (
                        <div className="space-y-4 py-2">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-sm font-black text-slate-900">{quoteToConvert.party_name}</p>
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-1">{quoteToConvert.quality_label}</p>
                                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <p className="text-slate-400 uppercase tracking-wider font-bold">Quote Price</p>
                                        <p className="font-mono font-black text-indigo-600">₹{Number(quoteToConvert.quote_price_per_meter).toFixed(2)}/m</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 uppercase tracking-wider font-bold">Quoted Qty</p>
                                        <p className="font-mono font-black text-slate-900">{Number(quoteToConvert.meters ?? 0).toLocaleString('en-IN')} m</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase font-black text-slate-500">Total metres</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={convertMeters}
                                        onChange={event => setConvertMeters(event.target.value)}
                                        className="font-mono font-bold"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase font-black text-slate-500">Deadline</Label>
                                    <Input
                                        type="date"
                                        value={convertDeadline}
                                        onChange={event => setConvertDeadline(event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-black text-slate-500">Order notes</Label>
                                <Textarea
                                    value={convertNotes}
                                    onChange={event => setConvertNotes(event.target.value)}
                                    placeholder="Optional production instructions for the floor"
                                    className="resize-none h-20 text-xs"
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setQuoteToConvert(null)}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={handleConvertAcceptedQuote}
                            disabled={!quoteToConvert || updatingId === quoteToConvert.id}
                        >
                            {quoteToConvert && updatingId === quoteToConvert.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Package className="h-4 w-4 mr-2" />
                            )}
                            Create active order
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
