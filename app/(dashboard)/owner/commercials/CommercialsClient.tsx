'use client'

import { useCallback, useMemo, useState } from 'react'
import type { ElementType } from 'react'
import {
    BadgeIndianRupee,
    BarChart3,
    ChevronDown,
    History,
    IndianRupee,
    PackageCheck,
    Search,
    TrendingUp,
    CalendarDays,
    ArrowRight,
    AlertTriangle,
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
    CommercialPayment,
} from './actions'
import { recordCommercialPaymentAction, getCommercialPayments } from './actions'
import { useRouter } from 'next/navigation'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const PAYMENT_MODE_LABELS: Record<string, string> = {
    bank: 'Bank Transfer',
    cash: 'Cash',
    upi: 'UPI',
    cheque: 'Cheque',
    other: 'Other',
}

function getPaymentModeLabel(mode: string): string {
    return PAYMENT_MODE_LABELS[mode] ?? mode
}

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
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
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
                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{entry.reference || entry.source_label}</p>
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
                <p className="mt-1 text-xs text-muted-foreground">{margin == null ? 'booked, not received' : `${margin.toFixed(1)}% booked margin`}</p>
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
    credit_days?: number | null
    meters_sold?: number | null
    dispatch_status?: 'not_dispatched' | 'partially_dispatched' | 'dispatched' | 'received' | 'discrepancy' | null
    dispatched_meters?: number | null
    pending_dispatch_meters?: number | null
    booked_gross_profit?: number | null
    receipt_status?: 'not_confirmed' | 'matched' | 'difference_reported' | null
    receipt_difference_meters?: number | null
}

// Helper to compare dates as local YYYY-MM-DD strings to avoid timezone drift issues
function getLocalDateString(dateInput?: Date | string | null): string {
    if (!dateInput) return ''
    if (dateInput instanceof Date) {
        const y = dateInput.getFullYear()
        const m = String(dateInput.getMonth() + 1).padStart(2, '0')
        const d = String(dateInput.getDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
    }
    return dateInput.split('T')[0].split(' ')[0]
}

function getDueBucket(rec: Receivable): 'overdue' | 'due_today' | 'due_this_week' | 'upcoming' | 'paid' {
    if (rec.payment_status === 'paid' || rec.balance_amount <= 0) {
        return 'paid'
    }
    if (!rec.due_date) {
        return 'upcoming'
    }

    const todayStr = getLocalDateString(new Date())
    const dueStr = getLocalDateString(rec.due_date)

    if (dueStr < todayStr) {
        return 'overdue'
    }
    if (dueStr === todayStr) {
        return 'due_today'
    }

    const todayParts = todayStr.split('-').map(Number)
    const dueParts = dueStr.split('-').map(Number)

    const todayLocal = new Date(todayParts[0], todayParts[1] - 1, todayParts[2])
    const dueLocal = new Date(dueParts[0], dueParts[1] - 1, dueParts[2])

    const diffTime = dueLocal.getTime() - todayLocal.getTime()
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays > 0 && diffDays <= 7) {
        return 'due_this_week'
    }
    return 'upcoming'
}

function getDispatchStatusLabel(status: string | null | undefined): string {
    if (!status) return 'Unknown'
    switch (status) {
        case 'not_dispatched': return 'Not dispatched'
        case 'partially_dispatched': return 'Partially dispatched'
        case 'dispatched': return 'Dispatched'
        case 'received': return 'Received'
        case 'discrepancy': return 'Needs review'
        default: return status
    }
}

function getDispatchStatusTone(status: string | null | undefined): string {
    if (!status) return 'bg-slate-50 text-slate-700 border-slate-200'
    switch (status) {
        case 'not_dispatched': return 'bg-slate-50 text-slate-700 border-slate-200'
        case 'partially_dispatched': return 'bg-amber-50 text-amber-700 border-amber-200'
        case 'dispatched': return 'bg-blue-50 text-blue-700 border-blue-200'
        case 'received': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
        case 'discrepancy': return 'bg-rose-50 text-rose-700 border-rose-200'
        default: return 'bg-slate-50 text-slate-700 border-slate-200'
    }
}

function getReceiptDifferenceWarning(rec: Receivable): string | null {
    if (rec.receipt_status !== 'difference_reported' || rec.receipt_difference_meters == null) return null
    const diff = Number(rec.receipt_difference_meters)
    if (!Number.isFinite(diff) || Math.abs(diff) <= 0.01) return null
    return `Receipt difference reported: ${Math.abs(diff).toLocaleString('en-IN', { maximumFractionDigits: 2 })}m ${diff < 0 ? 'short' : 'extra'}`
}

interface CommercialsClientProps {
    initialData: CommercialsData
    initialReceivables: Receivable[]
    collectedThisMonth: number
}

export default function CommercialsClient({ initialData, initialReceivables, collectedThisMonth }: CommercialsClientProps) {
    const router = useRouter()
    const [query, setQuery] = useState('')
    const [stage, setStage] = useState<StageFilter>('all')
    const [source, setSource] = useState<SourceFilter>('all')
    const [activeTab, setActiveTab] = useState('overview')

    const [dueTab, setDueTab] = useState<'all' | 'overdue' | 'due_today' | 'due_this_week' | 'upcoming' | 'paid'>('all')
    const [receivableSearch, setReceivableSearch] = useState('')

    // Payment Dialog State
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
    const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null)
    const [paymentAmount, setPaymentAmount] = useState('')
    const [paymentMode, setPaymentMode] = useState('bank')
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
    const [reference, setReference] = useState('')
    const [notes, setNotes] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Payment History State
    const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
    const [paymentHistoryCache, setPaymentHistoryCache] = useState<Record<string, CommercialPayment[]>>({})
    const [loadingHistoryId, setLoadingHistoryId] = useState<string | null>(null)

    const resetPaymentForm = () => {
        setPaymentAmount('')
        setPaymentMode('bank')
        setPaymentDate(new Date().toISOString().split('T')[0])
        setReference('')
        setNotes('')
        setSelectedReceivable(null)
    }

    const togglePaymentHistory = useCallback(async (receivableId: string) => {
        if (expandedHistoryId === receivableId) {
            setExpandedHistoryId(null)
            return
        }
        setExpandedHistoryId(receivableId)
        if (paymentHistoryCache[receivableId]) return
        setLoadingHistoryId(receivableId)
        try {
            const result = await getCommercialPayments(receivableId)
            if ('data' in result) {
                setPaymentHistoryCache((prev) => ({ ...prev, [receivableId]: result.data }))
            }
        } catch {
            toast.error('Failed to load payment history')
        } finally {
            setLoadingHistoryId(null)
        }
    }, [expandedHistoryId, paymentHistoryCache])

    const handleRecordPayment = async () => {
        if (!selectedReceivable) return
        
        const amount = parseFloat(paymentAmount)
        if (isNaN(amount) || amount <= 0) {
            toast.error('Please enter a valid amount')
            return
        }

        if (amount > selectedReceivable.balance_amount) {
            toast.error('Payment amount cannot exceed the balance amount')
            return
        }

        setIsSubmitting(true)
        try {
            const result = await recordCommercialPaymentAction({
                receivableId: selectedReceivable.id,
                amount,
                paymentDate,
                paymentMode,
                referenceNumber: reference || undefined,
                notes: notes || undefined,
            })

            if ('error' in result) {
                toast.error(result.error)
            } else {
                toast.success('Payment recorded successfully')
                setIsPaymentDialogOpen(false)
                resetPaymentForm()
                router.refresh()
            }
        } catch {
            toast.error('Failed to record payment')
        } finally {
            setIsSubmitting(false)
        }
    }

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
        let totalToCollect = 0
        let overdue = 0
        let dueThisWeek = 0

        initialReceivables.forEach((rec) => {
            const bucket = getDueBucket(rec)
            if (rec.balance_amount > 0) {
                totalToCollect += rec.balance_amount

                if (bucket === 'overdue') {
                    overdue += rec.balance_amount
                } else if (bucket === 'due_today' || bucket === 'due_this_week') {
                    dueThisWeek += rec.balance_amount
                }
            }
        })

        return {
            totalToCollect,
            overdue,
            dueThisWeek,
        }
    }, [initialReceivables])

    const filteredReceivables = useMemo(() => {
        const needle = receivableSearch.trim().toLowerCase()
        return initialReceivables.filter((rec) => {
            const bucket = getDueBucket(rec)
            const matchesBucket = dueTab === 'all' || bucket === dueTab
            const haystack = `${rec.party_name} ${rec.quality_label} ${rec.payment_status}`.toLowerCase()
            return matchesBucket && (!needle || haystack.includes(needle))
        })
    }, [initialReceivables, dueTab, receivableSearch])

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
                    <TabsTrigger value="profit_entries">Booked Gross Profit ({initialData.entries.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        <MetricCard
                            label="Total to Collect"
                            value={money(receivablesSummary.totalToCollect)}
                            helper="Unpaid balance amount"
                            icon={BadgeIndianRupee}
                            tone="bg-violet-50 text-violet-700"
                        />
                        <MetricCard
                            label="Collected This Month"
                            value={money(collectedThisMonth)}
                            helper="Payment received this month"
                            icon={IndianRupee}
                            tone="bg-emerald-50 text-emerald-700"
                        />
                        <MetricCard
                            label="Overdue"
                            value={money(receivablesSummary.overdue)}
                            helper="Due before today"
                            icon={CalendarDays}
                            tone="bg-rose-50 text-rose-700"
                        />
                        <MetricCard
                            label="Due This Week"
                            value={money(receivablesSummary.dueThisWeek)}
                            helper="Due in next 7 days"
                            icon={CalendarDays}
                            tone="bg-amber-50 text-amber-700"
                        />
                        <MetricCard
                            label="Booked Gross Profit"
                            value={money(initialData.summary.realized_profit)}
                            helper={initialData.summary.realized_margin_pct == null ? 'No realized sales yet' : `${initialData.summary.realized_margin_pct.toFixed(1)}% gross margin`}
                            icon={TrendingUp}
                            tone="bg-teal-50 text-teal-700"
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
                                value={receivableSearch}
                                onChange={(e) => setReceivableSearch(e.target.value)}
                                placeholder="Search party, quality..."
                                className="pl-10"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(['all', 'overdue', 'due_today', 'due_this_week', 'upcoming', 'paid'] as const).map((tab) => {
                                const label = tab === 'all' ? 'All' : tab.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                                const count = initialReceivables.filter(r => tab === 'all' || getDueBucket(r) === tab).length
                                return (
                                    <Button
                                        key={tab}
                                        variant={dueTab === tab ? 'default' : 'outline'}
                                        onClick={() => setDueTab(tab)}
                                        className="h-11 min-h-11 lg:h-9 lg:min-h-9 capitalize text-xs font-bold"
                                    >
                                        {label} ({count})
                                    </Button>
                                )
                            })}
                        </div>
                    </div>

                    <Card className="border-border/60">
                        <CardContent className="p-0">
                            {filteredReceivables.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <BadgeIndianRupee className="mb-3 h-10 w-10 text-muted-foreground/70" />
                                    <p className="text-lg font-bold text-foreground">No receivables found</p>
                                    <p className="text-sm text-muted-foreground mt-1">Sales will automatically create receivables here.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Mobile Cards */}
                                    <div className="lg:hidden space-y-4 p-4">
                                        {filteredReceivables.map((rec) => (
                                            <Card key={rec.id} className="border-border/60 shadow-sm rounded-2xl overflow-hidden">
                                                <CardContent className="p-4 space-y-3">
                                                    {getReceiptDifferenceWarning(rec) && (
                                                        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                                                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                                            {getReceiptDifferenceWarning(rec)}
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="font-bold text-foreground text-base">{rec.party_name}</p>
                                                            <p className="text-xs text-muted-foreground">{rec.quality_label}</p>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1.5">
                                                            <Badge variant="outline" className={cn('capitalize font-bold text-xs', 
                                                                rec.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                                rec.payment_status === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                'bg-rose-50 text-rose-700 border-rose-200'
                                                            )}>
                                                                {rec.payment_status}
                                                            </Badge>
                                                            {rec.dispatch_status && (
                                                                <Badge variant="outline" className={cn('font-bold text-xs w-fit capitalize', getDispatchStatusTone(rec.dispatch_status))}>
                                                                    {getDispatchStatusLabel(rec.dispatch_status)}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-3 gap-2 text-xs py-2 border-y border-border/40">
                                                        <div>
                                                            <p className="text-muted-foreground uppercase text-[10px] font-bold">Total</p>
                                                            <p className="font-semibold text-foreground mt-0.5">{money(rec.total_amount)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground uppercase text-[10px] font-bold">Received</p>
                                                            <p className="font-semibold text-emerald-600 mt-0.5">{money(rec.received_amount)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground uppercase text-[10px] font-bold">Balance</p>
                                                            <p className="font-bold text-rose-600 mt-0.5">{money(rec.balance_amount)}</p>
                                                        </div>
                                                    </div>

                                                    {/* Meters tracking (stock sales only) */}
                                                    {rec.meters_sold != null && (
                                                        <div className="grid grid-cols-3 gap-2 text-[10px] py-2 border-b border-border/40 bg-muted/20 px-2 rounded-lg">
                                                            <div>
                                                                <p className="text-muted-foreground uppercase font-bold">Sold</p>
                                                                <p className="font-semibold text-foreground mt-0.5">{meters(rec.meters_sold)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-muted-foreground uppercase font-bold">Dispatched</p>
                                                                <p className="font-semibold text-blue-600 mt-0.5">{meters(rec.dispatched_meters ?? 0)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-muted-foreground uppercase font-bold">Pending</p>
                                                                <p className="font-semibold text-amber-600 mt-0.5">{meters(rec.pending_dispatch_meters ?? 0)}</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                                                        <div className="font-semibold text-muted-foreground space-y-1">
                                                            <div className="flex items-center gap-1">
                                                                <CalendarDays className="h-3.5 w-3.5" />
                                                                {rec.due_date ? (
                                                                    <span>Due: {new Date(rec.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                                ) : (
                                                                    <span>No due date</span>
                                                                )}
                                                            </div>
                                                            {rec.credit_days != null && (
                                                                <p className="text-[10px] text-muted-foreground/80">Credit terms: {rec.credit_days} days</p>
                                                            )}
                                                            {rec.booked_gross_profit != null && (
                                                                <p className="text-[10px] text-emerald-600 font-bold">Booked Gross Profit: {money(rec.booked_gross_profit)}</p>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            {rec.received_amount > 0 && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-9 min-h-9 gap-1 text-xs font-bold text-muted-foreground"
                                                                    onClick={() => togglePaymentHistory(rec.id)}
                                                                >
                                                                    <History className="h-3 w-3" />
                                                                    History
                                                                    <ChevronDown className={cn('h-3 w-3 transition-transform', expandedHistoryId === rec.id && 'rotate-180')} />
                                                                </Button>
                                                            )}
                                                            {rec.balance_amount > 0 && (
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    className="h-9 min-h-9 gap-1 text-xs font-bold"
                                                                    onClick={() => {
                                                                        setSelectedReceivable(rec)
                                                                        setPaymentAmount(rec.balance_amount.toString())
                                                                        setIsPaymentDialogOpen(true)
                                                                    }}
                                                                >
                                                                    Record Payment <ArrowRight className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Payment History Accordion */}
                                                    {expandedHistoryId === rec.id && (
                                                        <div className="mt-2 border-t border-border/40 pt-3">
                                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Payment History</p>
                                                            {loadingHistoryId === rec.id ? (
                                                                <p className="text-xs text-muted-foreground animate-pulse">Loading...</p>
                                                            ) : (paymentHistoryCache[rec.id] ?? []).length === 0 ? (
                                                                <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    {(paymentHistoryCache[rec.id] ?? []).map((p) => (
                                                                        <div key={p.id} className="flex items-start justify-between gap-2 text-xs bg-muted/30 rounded-lg px-3 py-2">
                                                                            <div className="space-y-0.5">
                                                                                <p className="font-semibold text-foreground">
                                                                                    {new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                                </p>
                                                                                <p className="text-[10px] text-muted-foreground">{getPaymentModeLabel(p.payment_mode)}</p>
                                                                                {p.reference_number && <p className="text-[10px] text-muted-foreground">Ref: {p.reference_number}</p>}
                                                                                {p.notes && <p className="text-[10px] text-muted-foreground italic">{p.notes}</p>}
                                                                            </div>
                                                                            <p className="font-bold text-emerald-600 whitespace-nowrap">{money(p.amount)}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>

                                    {/* Desktop Table */}
                                    <div className="hidden lg:block overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
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
                                                {filteredReceivables.map((rec) => (
                                                    <tr key={rec.id} className="group">
                                                        <td className="px-4 py-3" colSpan={7}>
                                                            <div className="flex items-center hover:bg-muted/30 -mx-4 -my-3 px-4 py-3">
                                                                {/* Party / Quality */}
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-bold text-foreground">{rec.party_name}</p>
                                                                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                                        <span className="text-xs text-muted-foreground">{rec.quality_label}</span>
                                                                        {rec.credit_days != null && (
                                                                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                                                {rec.credit_days} days credit
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {rec.booked_gross_profit != null && (
                                                                        <p className="text-[10px] text-emerald-600 font-bold mt-1">
                                                                            Booked Gross Profit: {money(rec.booked_gross_profit)}
                                                                        </p>
                                                                    )}
                                                                    {getReceiptDifferenceWarning(rec) && (
                                                                        <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-rose-600">
                                                                            <AlertTriangle className="h-3 w-3" />
                                                                            {getReceiptDifferenceWarning(rec)}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                {/* Status */}
                                                                <div className="w-28 px-2">
                                                                    <div className="flex flex-col gap-1.5">
                                                                        <Badge variant="outline" className={cn('capitalize font-bold w-fit text-xs', 
                                                                            rec.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                                            rec.payment_status === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                            'bg-rose-50 text-rose-700 border-rose-200'
                                                                        )}>
                                                                            {rec.payment_status}
                                                                        </Badge>
                                                                        {rec.dispatch_status && (
                                                                            <Badge variant="outline" className={cn('font-bold w-fit text-[10px] px-1.5 py-0 capitalize', getDispatchStatusTone(rec.dispatch_status))}>
                                                                                {getDispatchStatusLabel(rec.dispatch_status)}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {/* Total */}
                                                                <div className="w-24 text-right px-2">
                                                                    <p className="font-semibold text-foreground">{money(rec.total_amount)}</p>
                                                                    {rec.meters_sold != null && (
                                                                        <p className="text-[10px] text-muted-foreground mt-0.5">Sold: {meters(rec.meters_sold)}</p>
                                                                    )}
                                                                </div>
                                                                {/* Received */}
                                                                <div className="w-24 text-right px-2">
                                                                    <p className="text-emerald-600 font-medium">{money(rec.received_amount)}</p>
                                                                    {rec.dispatched_meters != null && (
                                                                        <p className="text-[10px] text-blue-600 mt-0.5">Sent: {meters(rec.dispatched_meters)}</p>
                                                                    )}
                                                                </div>
                                                                {/* Balance */}
                                                                <div className="w-24 text-right px-2">
                                                                    <p className="font-bold text-rose-600">{money(rec.balance_amount)}</p>
                                                                    {rec.pending_dispatch_meters != null && (
                                                                        <p className="text-[10px] text-amber-600 mt-0.5">Pend: {meters(rec.pending_dispatch_meters)}</p>
                                                                    )}
                                                                </div>
                                                                {/* Due Date */}
                                                                <div className="w-28 px-2">
                                                                    {rec.due_date ? (
                                                                        <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
                                                                            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                                                                            {new Date(rec.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                        </div>
                                                                    ) : <span className="text-muted-foreground">—</span>}
                                                                </div>
                                                                {/* Actions */}
                                                                <div className="w-auto text-right flex items-center gap-1 justify-end">
                                                                    {rec.received_amount > 0 && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="gap-1 text-xs font-bold h-9 min-h-9 text-muted-foreground"
                                                                            onClick={() => togglePaymentHistory(rec.id)}
                                                                        >
                                                                            <History className="h-3 w-3" />
                                                                            <ChevronDown className={cn('h-3 w-3 transition-transform', expandedHistoryId === rec.id && 'rotate-180')} />
                                                                        </Button>
                                                                    )}
                                                                    {rec.balance_amount > 0 && (
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            size="sm" 
                                                                            className="gap-1 text-xs font-bold h-9 min-h-9"
                                                                            onClick={() => {
                                                                                setSelectedReceivable(rec)
                                                                                setPaymentAmount(rec.balance_amount.toString())
                                                                                setIsPaymentDialogOpen(true)
                                                                            }}
                                                                        >
                                                                            Record Payment <ArrowRight className="h-3 w-3" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Payment History Expandable Row */}
                                                            {expandedHistoryId === rec.id && (
                                                                <div className="mt-2 border-t border-border/30 pt-3 pb-1">
                                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Payment History</p>
                                                                    {loadingHistoryId === rec.id ? (
                                                                        <p className="text-xs text-muted-foreground animate-pulse">Loading...</p>
                                                                    ) : (paymentHistoryCache[rec.id] ?? []).length === 0 ? (
                                                                        <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
                                                                    ) : (
                                                                        <div className="grid gap-1.5">
                                                                            {(paymentHistoryCache[rec.id] ?? []).map((p) => (
                                                                                <div key={p.id} className="flex items-center justify-between gap-4 text-xs bg-muted/30 rounded-lg px-4 py-2">
                                                                                    <div className="flex items-center gap-4">
                                                                                        <span className="font-semibold text-foreground">
                                                                                            {new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                                        </span>
                                                                                        <span className="text-muted-foreground">{getPaymentModeLabel(p.payment_mode)}</span>
                                                                                        {p.reference_number && <span className="text-muted-foreground">Ref: {p.reference_number}</span>}
                                                                                        {p.notes && <span className="text-muted-foreground italic">{p.notes}</span>}
                                                                                    </div>
                                                                                    <span className="font-bold text-emerald-600 whitespace-nowrap">{money(p.amount)}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
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
                                <>
                                    {/* Mobile Cards */}
                                    <div className="lg:hidden space-y-4 p-4">
                                        {filtered.map((entry) => {
                                            const margin = entry.revenue_amount > 0
                                                ? (entry.gross_profit_amount / entry.revenue_amount) * 100
                                                : null
                                            return (
                                                <Card key={`${entry.source_kind}-${entry.source_id}`} className="border-border/60 shadow-sm rounded-2xl overflow-hidden">
                                                    <CardContent className="p-4 space-y-3">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <p className="font-bold text-foreground text-sm">
                                                                    {new Date(entry.event_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground mt-0.5">{entry.reference || entry.source_label}</p>
                                                            </div>
                                                            <div className="flex flex-col items-end gap-1">
                                                                <Badge variant="outline" className={cn('font-bold text-xs', sourceTone(entry))}>
                                                                    {displaySourceLabel(entry)}
                                                                </Badge>
                                                                <Badge variant="outline" className={cn('font-bold capitalize text-xs', stageBadge(entry.stage))}>
                                                                    {entry.stage}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="text-sm font-semibold text-foreground">
                                                            {entry.quality_label}
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-border/40">
                                                            <div>
                                                                <p className="text-muted-foreground uppercase text-xs font-bold">Quantity</p>
                                                                <p className="font-semibold text-foreground mt-0.5">{entry.quantity_label || meters(entry.meters_sold)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-muted-foreground uppercase text-xs font-bold">Rate / m</p>
                                                                <p className="font-semibold text-foreground mt-0.5">{money(entry.price_per_meter, 2)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-muted-foreground uppercase text-xs font-bold">Revenue</p>
                                                                <p className="font-semibold text-foreground mt-0.5">{money(entry.revenue_amount)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-muted-foreground uppercase text-xs font-bold">Booked Gross Profit</p>
                                                                <p className={cn('font-bold mt-0.5', entry.gross_profit_amount >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                                                                    {entry.gross_profit_amount >= 0 ? '+' : ''}{money(entry.gross_profit_amount)}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground mt-0.5">{margin == null ? '—' : `${margin.toFixed(1)}% margin`}</p>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )
                                        })}
                                    </div>

                                    {/* Desktop Table */}
                                    <div className="hidden lg:block overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                                                <tr>
                                                    <th className="px-4 py-3 font-bold">Date</th>
                                                    <th className="px-4 py-3 font-bold">Source</th>
                                                    <th className="px-4 py-3 text-right font-bold">Quantity</th>
                                                    <th className="px-4 py-3 text-right font-bold">Rate / m</th>
                                                    <th className="px-4 py-3 text-right font-bold">Revenue</th>
                                                    <th className="px-4 py-3 text-right font-bold">Booked Gross Profit</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/40">
                                                {filtered.map((entry) => (
                                                    <EntryRow key={`${entry.source_kind}-${entry.source_id}`} entry={entry} />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
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

            {/* Record Payment Dialog */}
            <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Record Payment</DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            Record a payment received for this receivable.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedReceivable && (
                        <div className="space-y-4 py-2">
                            {/* Context */}
                            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2">
                                <p className="font-bold text-foreground">{selectedReceivable.party_name}</p>
                                <p className="text-xs text-muted-foreground">{selectedReceivable.quality_label}</p>
                                <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                                    <div>
                                        <p className="text-muted-foreground font-semibold">Total</p>
                                        <p className="font-bold text-foreground">{money(selectedReceivable.total_amount)}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground font-semibold">Received</p>
                                        <p className="font-bold text-emerald-600">{money(selectedReceivable.received_amount)}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground font-semibold">Balance</p>
                                        <p className="font-bold text-rose-600">{money(selectedReceivable.balance_amount)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Form Fields */}
                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="amount" className="text-sm font-semibold">Payment Amount</Label>
                                        <button
                                            type="button"
                                            className="text-xs font-semibold text-orange-600 hover:text-orange-700 hover:underline"
                                            onClick={() => setPaymentAmount(selectedReceivable.balance_amount.toString())}
                                        >
                                            Use full balance: {money(selectedReceivable.balance_amount)}
                                        </button>
                                    </div>
                                    <Input
                                        id="amount"
                                        type="number"
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        placeholder="Enter amount"
                                        className="h-11 min-h-11 lg:h-9 lg:min-h-9"
                                        max={selectedReceivable.balance_amount}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="paymentMode" className="text-sm font-semibold">Payment Mode</Label>
                                    <Select value={paymentMode} onValueChange={setPaymentMode}>
                                        <SelectTrigger className="h-11 min-h-11 lg:h-9 lg:min-h-9">
                                            <SelectValue placeholder="Select mode" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="bank">Bank Transfer</SelectItem>
                                            <SelectItem value="cash">Cash</SelectItem>
                                            <SelectItem value="upi">UPI</SelectItem>
                                            <SelectItem value="cheque">Cheque</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="paymentDate" className="text-sm font-semibold">Payment Date</Label>
                                    <Input
                                        id="paymentDate"
                                        type="date"
                                        value={paymentDate}
                                        onChange={(e) => setPaymentDate(e.target.value)}
                                        className="h-11 min-h-11 lg:h-9 lg:min-h-9"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="reference" className="text-sm font-semibold">Reference / Trxn ID (Optional)</Label>
                                    <Input
                                        id="reference"
                                        value={reference}
                                        onChange={(e) => setReference(e.target.value)}
                                        placeholder="e.g. UTR number"
                                        className="h-11 min-h-11 lg:h-9 lg:min-h-9"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="notes" className="text-sm font-semibold">Notes (Optional)</Label>
                                    <Textarea
                                        id="notes"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Add any details..."
                                        className="resize-none"
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end mt-4">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsPaymentDialogOpen(false)
                                resetPaymentForm()
                            }}
                            className="h-11 min-h-11 lg:h-9 lg:min-h-9 w-full sm:w-auto"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRecordPayment}
                            disabled={isSubmitting}
                            className="h-11 min-h-11 lg:h-9 lg:min-h-9 w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white"
                        >
                            {isSubmitting ? 'Recording...' : 'Record Payment'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
