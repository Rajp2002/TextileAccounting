'use client'

import { useCallback, useMemo, useState } from 'react'
import type { ElementType } from 'react'
import {
    BadgeIndianRupee,
    ChevronDown,
    History,
    IndianRupee,
    PackageCheck,
    Search,
    TrendingUp,
    CalendarDays,
    Clock3,
    ArrowRight,
    AlertTriangle,
    ReceiptText,
    Trophy,
    Users,
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
    CommercialPartyInsights,
    CommercialPartyInsightRow,
    CommercialPartyPeriod,
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
import { getSuratTodayString } from '@/lib/time'
import {
    getCommercialDaysLate,
    getCommercialDueBucket,
    normalizeCommercialDateOnly,
    type CommercialDueBucket,
} from '@/lib/commercials/date-buckets'

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

function paymentDetailLine(payment: CommercialPayment): string {
    const details = [
        payment.reference_number ? `Ref ${payment.reference_number}` : null,
        payment.payment_mode === 'cheque' && payment.cheque_number ? `Cheque ${payment.cheque_number}` : null,
        payment.payment_mode === 'cheque' && payment.cheque_date ? `Cheque date ${formatDate(payment.cheque_date)}` : null,
        payment.payment_mode === 'cheque' && payment.bank_name ? payment.bank_name : null,
        payment.notes || null,
    ].filter(Boolean)

    return details.join(' · ')
}

type StageFilter = 'all' | CommercialStage
type DueBucket = CommercialDueBucket
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

function createClientIdempotencyKey(prefix: string) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}:${crypto.randomUUID()}`
    }
    return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`
}

function normalizePartyName(value: string | null | undefined) {
    return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase() || 'unknown-party'
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

    if (entry.stock_source_type === 'market_run') return 'market_run'
    if (entry.stock_source_type === 'order') return 'order'
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
                    {formatDate(entry.event_date)}
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
    source_type?: 'fabric_stock_sale' | 'market_run_sale' | 'party_invoice'
    source_id?: string
    source_date?: string | null
    sale_date?: string | null
    order_id?: string | null
    party_id?: string | null
    party_name: string
    party_phone?: string | null
    party_gstin?: string | null
    quality_label: string
    reference_label?: string | null
    payment_status: 'unpaid' | 'partial' | 'paid'
    total_amount: number
    received_amount: number
    balance_amount: number
    due_date?: string | null
    credit_days?: number | null
    taka_sold?: number | null
    meters_sold?: number | null
    price_per_meter?: number | null
    cost_per_meter?: number | null
    revenue_amount?: number | null
    cost_amount?: number | null
    dispatch_status?: 'not_dispatched' | 'partially_dispatched' | 'dispatched' | 'received' | 'discrepancy' | null
    dispatched_meters?: number | null
    pending_dispatch_meters?: number | null
    booked_gross_profit?: number | null
    market_run_id?: string | null
    market_run_label?: string | null
    market_run_quality?: string | null
    order_party_name?: string | null
    order_quality_label?: string | null
    godown?: string | null
}

type CommercialGroupKind = 'market_run' | 'order' | 'sale'

interface CommercialGroup {
    id: string
    kind: CommercialGroupKind
    title: string
    subtitle: string
    receivables: Receivable[]
    entries: CommercialProfitEntry[]
    totalSales: number
    totalPaid: number
    totalBalance: number
    bookedGrossProfit: number
    metersSold: number
    earliestDueDate: string | null
    latestSaleDate: string | null
    overdueBalance: number
}

interface PartyReceivableSummary {
    partyKey: string
    partyName: string
    partyPhone: string | null
    partyGstin: string | null
    receivables: Receivable[]
    totalBalance: number
    totalSales: number
    totalPaid: number
    earliestDueDate: string | null
    overdueBalance: number
    openSalesCount: number
}

// Helper to compare date-only values as YYYY-MM-DD strings to avoid timezone drift.
function getLocalDateString(dateInput?: Date | string | null): string {
    return normalizeCommercialDateOnly(dateInput)
}

function getDueBucket(rec: Receivable, today = getSuratTodayString()): DueBucket {
    return getCommercialDueBucket(rec, today)
}

function getDaysLate(rec: Receivable, today = getSuratTodayString()): number {
    return getCommercialDaysLate(rec, today)
}

function estimateLateInterest(rec: Receivable, annualRatePct = 18): number {
    const daysLate = getDaysLate(rec)
    if (daysLate <= 0 || rec.balance_amount <= 0) return 0
    return (rec.balance_amount * (annualRatePct / 100) * daysLate) / 365
}

function getCollectionStatusMeta(rec: Receivable): { label: string; className: string } {
    const bucket = getDueBucket(rec)

    if (bucket === 'paid') {
        return { label: 'Paid', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
    }

    if (bucket === 'overdue') {
        const daysLate = getDaysLate(rec)
        return {
            label: daysLate > 0 ? `${daysLate}d late` : 'Overdue',
            className: 'border-rose-200 bg-rose-50 text-rose-700',
        }
    }

    if (bucket === 'due_today') {
        return { label: 'Due today', className: 'border-amber-200 bg-amber-50 text-amber-700' }
    }

    if (bucket === 'due_this_week') {
        return { label: 'Due this week', className: 'border-amber-200 bg-amber-50 text-amber-700' }
    }

    return { label: 'On credit', className: 'border-slate-200 bg-slate-50 text-slate-700' }
}

function getCollectionSourceLabel(rec: Receivable): string {
    return rec.market_run_label
        || rec.order_quality_label
        || rec.godown
        || rec.reference_label
        || 'Stock sale'
}

function getReceivableQuantityLabel(rec: Receivable): string | null {
    if (Number(rec.meters_sold ?? 0) > 0) return meters(rec.meters_sold ?? 0)
    if (Number(rec.taka_sold ?? 0) > 0) return `${Number(rec.taka_sold).toLocaleString('en-IN')} taka`
    return null
}

function compareCollectionPriority(a: Receivable, b: Receivable): number {
    const rank: Record<DueBucket, number> = {
        overdue: 0,
        due_today: 1,
        due_this_week: 2,
        upcoming: 3,
        paid: 4,
    }
    const bucketCompare = rank[getDueBucket(a)] - rank[getDueBucket(b)]
    if (bucketCompare !== 0) return bucketCompare

    const dueCompare = (getLocalDateString(a.due_date) || '9999-12-31').localeCompare(getLocalDateString(b.due_date) || '9999-12-31')
    if (dueCompare !== 0) return dueCompare

    return Number(b.balance_amount ?? 0) - Number(a.balance_amount ?? 0)
}

function formatDate(value?: string | null) {
    if (!value) return 'No date'
    const [year, month, day] = normalizeCommercialDateOnly(value).split('-').map(Number)
    if (![year, month, day].every(Number.isFinite)) return 'No date'
    return new Date(year, month - 1, day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getReceivableGroupMeta(rec: Receivable) {
    if (rec.market_run_id) {
        return {
            id: `market_run:${rec.market_run_id}`,
            kind: 'market_run' as const,
            title: rec.market_run_label || rec.market_run_quality || 'Market run',
            subtitle: `Market run sale${rec.godown ? ` · ${rec.godown}` : ''}`,
        }
    }

    if (rec.order_id) {
        return {
            id: `order:${rec.order_id}`,
            kind: 'order' as const,
            title: rec.order_party_name || rec.party_name || 'Order',
            subtitle: rec.order_quality_label || rec.quality_label || 'Order sale',
        }
    }

    return {
        id: `${rec.source_type || 'sale'}:${rec.source_id || rec.id}`,
        kind: 'sale' as const,
        title: rec.party_name || 'Stock sale',
        subtitle: rec.quality_label || rec.reference_label || 'Commercial sale',
    }
}

function getEntryGroupId(entry: CommercialProfitEntry) {
    return `${entry.source_kind}:${entry.source_id}`
}

function buildCommercialGroups(receivables: Receivable[], entries: CommercialProfitEntry[]): CommercialGroup[] {
    const groups = new Map<string, CommercialGroup>()
    const entryBySource = new Map(entries.map((entry) => [getEntryGroupId(entry), entry]))

    receivables.forEach((rec) => {
        const meta = getReceivableGroupMeta(rec)
        const existing = groups.get(meta.id)
        const entry = rec.source_id && rec.source_type === 'fabric_stock_sale'
            ? entryBySource.get(`stock_sale:${rec.source_id}`)
            : rec.source_id
                ? entryBySource.get(`${rec.source_type}:${rec.source_id}`)
                : undefined

        const group = existing ?? {
            id: meta.id,
            kind: meta.kind,
            title: meta.title,
            subtitle: meta.subtitle,
            receivables: [],
            entries: [],
            totalSales: 0,
            totalPaid: 0,
            totalBalance: 0,
            bookedGrossProfit: 0,
            metersSold: 0,
            earliestDueDate: null,
            latestSaleDate: null,
            overdueBalance: 0,
        }

        group.receivables.push(rec)
        if (entry && !group.entries.some((item) => getEntryGroupId(item) === getEntryGroupId(entry))) {
            group.entries.push(entry)
        }
        groups.set(meta.id, group)
    })

    entries.forEach((entry) => {
        const alreadyGrouped = Array.from(groups.values()).some((group) =>
            group.entries.some((item) => getEntryGroupId(item) === getEntryGroupId(entry))
        )
        if (alreadyGrouped) return

        const id = getEntryGroupId(entry)
        groups.set(id, {
            id,
            kind: entry.source_kind === 'order_invoice' || entry.source_kind === 'order_quote' ? 'order' : 'sale',
            title: entry.source_label || entry.quality_label,
            subtitle: entry.reference || entry.quality_label,
            receivables: [],
            entries: [entry],
            totalSales: 0,
            totalPaid: 0,
            totalBalance: 0,
            bookedGrossProfit: 0,
            metersSold: 0,
            earliestDueDate: null,
            latestSaleDate: null,
            overdueBalance: 0,
        })
    })

    return Array.from(groups.values())
        .map((group) => {
            const receivableSales = group.receivables.reduce((sum, rec) => sum + Number(rec.total_amount ?? 0), 0)
            const entrySales = group.entries.reduce((sum, entry) => sum + Number(entry.revenue_amount ?? 0), 0)
            const receivableProfit = group.receivables.reduce((sum, rec) => sum + Number(rec.booked_gross_profit ?? 0), 0)
            const entryProfit = group.entries.reduce((sum, entry) => sum + Number(entry.gross_profit_amount ?? 0), 0)
            const dueDates = group.receivables.map((rec) => rec.due_date).filter(Boolean).sort() as string[]
            const saleDates = [
                ...group.receivables.map((rec) => rec.sale_date || rec.source_date).filter(Boolean),
                ...group.entries.map((entry) => entry.event_date).filter(Boolean),
            ].sort() as string[]

            return {
                ...group,
                totalSales: receivableSales || entrySales,
                totalPaid: group.receivables.reduce((sum, rec) => sum + Number(rec.received_amount ?? 0), 0),
                totalBalance: group.receivables.reduce((sum, rec) => sum + Number(rec.balance_amount ?? 0), 0),
                bookedGrossProfit: receivableProfit || entryProfit,
                metersSold: group.receivables.reduce((sum, rec) => sum + Number(rec.meters_sold ?? 0), 0)
                    || group.entries.reduce((sum, entry) => sum + Number(entry.meters_sold ?? 0), 0),
                earliestDueDate: dueDates[0] ?? null,
                latestSaleDate: saleDates.at(-1) ?? null,
                overdueBalance: group.receivables.reduce((sum, rec) => getDueBucket(rec) === 'overdue' ? sum + Number(rec.balance_amount ?? 0) : sum, 0),
            }
        })
        .sort((a, b) => {
            if (a.overdueBalance !== b.overdueBalance) return b.overdueBalance - a.overdueBalance
            return (b.latestSaleDate || '').localeCompare(a.latestSaleDate || '')
        })
}

function buildPartyReceivableSummaries(receivables: Receivable[]): PartyReceivableSummary[] {
    const parties = new Map<string, PartyReceivableSummary>()

    receivables
        .filter((rec) => Number(rec.balance_amount ?? 0) > 0)
        .forEach((rec) => {
            const displayName = rec.party_name?.trim() || 'Unknown Party'
            const key = rec.party_id ? `id:${rec.party_id}` : normalizePartyName(displayName)
            const existing = parties.get(key) ?? {
                partyKey: key,
                partyName: displayName,
                partyPhone: rec.party_phone?.trim() || null,
                partyGstin: rec.party_gstin?.trim() || null,
                receivables: [],
                totalBalance: 0,
                totalSales: 0,
                totalPaid: 0,
                earliestDueDate: null,
                overdueBalance: 0,
                openSalesCount: 0,
            }

            existing.receivables.push(rec)
            existing.partyPhone ||= rec.party_phone?.trim() || null
            existing.partyGstin ||= rec.party_gstin?.trim() || null
            existing.totalBalance += Number(rec.balance_amount ?? 0)
            existing.totalSales += Number(rec.total_amount ?? 0)
            existing.totalPaid += Number(rec.received_amount ?? 0)
            existing.openSalesCount += 1
            if (getDueBucket(rec) === 'overdue') {
                existing.overdueBalance += Number(rec.balance_amount ?? 0)
            }

            if (rec.due_date && (!existing.earliestDueDate || getLocalDateString(rec.due_date) < getLocalDateString(existing.earliestDueDate))) {
                existing.earliestDueDate = rec.due_date
            }

            parties.set(key, existing)
        })

    return Array.from(parties.values())
        .map((party) => ({
            ...party,
            receivables: party.receivables.sort((a, b) => {
                const aOverdue = getDueBucket(a) === 'overdue' ? 1 : 0
                const bOverdue = getDueBucket(b) === 'overdue' ? 1 : 0
                if (aOverdue !== bOverdue) return bOverdue - aOverdue
                return (getLocalDateString(a.due_date) || '9999-12-31').localeCompare(getLocalDateString(b.due_date) || '9999-12-31')
            }),
        }))
        .sort((a, b) => {
            if (a.overdueBalance !== b.overdueBalance) return b.overdueBalance - a.overdueBalance
            const dueCompare = (a.earliestDueDate || '9999-12-31').localeCompare(b.earliestDueDate || '9999-12-31')
            if (dueCompare !== 0) return dueCompare
            return b.totalBalance - a.totalBalance
        })
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

interface CommercialsClientProps {
    initialData: CommercialsData
    initialReceivables: Receivable[]
    collectedThisMonth: number
    partyInsights: CommercialPartyInsights
}

function CommercialGroupCard({
    group,
    expanded,
    onToggle,
    onRecordPayment,
    onToggleHistory,
    expandedHistoryId,
    paymentHistoryCache,
    loadingHistoryId,
}: {
    group: CommercialGroup
    expanded: boolean
    onToggle: () => void
    onRecordPayment: (rec: Receivable) => void
    onToggleHistory: (receivableId: string) => void
    expandedHistoryId: string | null
    paymentHistoryCache: Record<string, CommercialPayment[]>
    loadingHistoryId: string | null
}) {
    const groupTone = group.kind === 'market_run'
        ? 'bg-violet-50 text-violet-700 border-violet-200'
        : group.kind === 'order'
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-slate-50 text-slate-700 border-slate-200'
    const groupLabel = group.kind === 'market_run' ? 'Market Run' : group.kind === 'order' ? 'Order' : 'Stock Sale'

    return (
        <Card className="overflow-hidden border-border/60 bg-white/90 shadow-sm @container">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full flex-col gap-4 p-4 text-left transition hover:bg-muted/20 @2xl:flex-row @2xl:items-center @2xl:justify-between"
            >
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cn('font-bold', groupTone)}>{groupLabel}</Badge>
                        {group.overdueBalance > 0 && (
                            <Badge variant="outline" className="border-rose-200 bg-rose-50 font-bold text-rose-700">
                                Overdue {money(group.overdueBalance)}
                            </Badge>
                        )}
                    </div>
                    <p className="mt-2 truncate text-base font-black text-foreground">{group.title}</p>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                        {group.subtitle} · {group.receivables.length || group.entries.length} sale{(group.receivables.length || group.entries.length) === 1 ? '' : 's'} · {meters(group.metersSold)}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 @2xl:w-[460px] @2xl:shrink-0">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bill Amount</p>
                        <p className="mt-1 font-black text-foreground">{money(group.totalSales)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Paid</p>
                        <p className="mt-1 font-black text-emerald-700">{money(group.totalPaid)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Balance</p>
                        <p className="mt-1 font-black text-rose-700">{money(group.totalBalance)}</p>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Booked Profit</p>
                            <p className={cn('mt-1 font-black', group.bookedGrossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                                {group.bookedGrossProfit >= 0 ? '+' : ''}{money(group.bookedGrossProfit)}
                            </p>
                        </div>
                        <ChevronDown className={cn('mt-4 h-4 w-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
                    </div>
                </div>
            </button>

            {expanded && (
                <div className="border-t border-border/50 bg-stone-50/50 p-4">
                    <div className="mb-4 grid gap-2 md:grid-cols-3">
                        <div className="rounded-xl border border-border/60 bg-white p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Credit Deadline</p>
                            <p className="mt-1 text-sm font-black text-foreground">{formatDate(group.earliestDueDate)}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-white p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Collection Status</p>
                            <p className="mt-1 text-sm font-black text-foreground">{group.totalBalance <= 0 ? 'Fully paid' : `${money(group.totalBalance)} left`}</p>
                        </div>
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Late Interest Cue</p>
                            <p className="mt-1 text-xs font-semibold text-amber-900">Estimate at 18% yearly after due date. Treat as negotiable, not auto-posted.</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {group.receivables.map((rec) => {
                            const daysLate = getDaysLate(rec)
                            const lateInterest = estimateLateInterest(rec)
                            const paymentHistory = paymentHistoryCache[rec.id] ?? []

                            return (
                                <div key={rec.id} className="rounded-xl border border-border/60 bg-white p-4">
                                    <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr_auto] lg:items-start">
                                        <div>
                                            <p className="font-black text-foreground">{rec.party_name}</p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                {rec.quality_label} · Sold {formatDate(rec.sale_date || rec.source_date)}
                                            </p>
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                <Badge variant="outline" className={cn('font-bold capitalize',
                                                    rec.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    rec.payment_status === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    'bg-rose-50 text-rose-700 border-rose-200'
                                                )}>{rec.payment_status}</Badge>
                                                {rec.dispatch_status && (
                                                    <Badge variant="outline" className={cn('font-bold capitalize', getDispatchStatusTone(rec.dispatch_status))}>
                                                        {getDispatchStatusLabel(rec.dispatch_status)}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <p className="font-bold uppercase tracking-wider text-muted-foreground">Metres Sold</p>
                                                <p className="mt-1 font-black text-foreground">{meters(rec.meters_sold ?? 0)}</p>
                                            </div>
                                            <div>
                                                <p className="font-bold uppercase tracking-wider text-muted-foreground">Quote</p>
                                                <p className="mt-1 font-black text-foreground">{money(rec.price_per_meter ?? 0, 2)}/m</p>
                                            </div>
                                            <div>
                                                <p className="font-bold uppercase tracking-wider text-muted-foreground">Cost</p>
                                                <p className="mt-1 font-semibold text-muted-foreground">{money(rec.cost_per_meter ?? 0, 2)}/m</p>
                                            </div>
                                            <div>
                                                <p className="font-bold uppercase tracking-wider text-muted-foreground">Profit</p>
                                                <p className={cn('mt-1 font-black', Number(rec.booked_gross_profit ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                                                    {money(rec.booked_gross_profit ?? 0)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <p className="font-bold uppercase tracking-wider text-muted-foreground">Sale</p>
                                                <p className="mt-1 font-black text-foreground">{money(rec.total_amount)}</p>
                                            </div>
                                            <div>
                                                <p className="font-bold uppercase tracking-wider text-muted-foreground">Paid</p>
                                                <p className="mt-1 font-black text-emerald-700">{money(rec.received_amount)}</p>
                                            </div>
                                            <div>
                                                <p className="font-bold uppercase tracking-wider text-muted-foreground">Left</p>
                                                <p className="mt-1 font-black text-rose-700">{money(rec.balance_amount)}</p>
                                            </div>
                                            <div>
                                                <p className="font-bold uppercase tracking-wider text-muted-foreground">Due</p>
                                                <p className="mt-1 font-black text-foreground">{formatDate(rec.due_date)}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                                            {rec.received_amount > 0 && (
                                                <Button variant="outline" size="sm" className="h-9 min-h-9 gap-1 text-xs font-bold" onClick={() => onToggleHistory(rec.id)}>
                                                    <History className="h-3 w-3" />
                                                    History
                                                </Button>
                                            )}
                                            {rec.balance_amount > 0 && (
                                                <Button size="sm" className="h-9 min-h-9 gap-1 text-xs font-bold" onClick={() => onRecordPayment(rec)}>
                                                    Record Payment
                                                    <ArrowRight className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {(rec.credit_days != null || daysLate > 0) && (
                                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                            {rec.credit_days != null && (
                                                <span className="rounded-lg bg-muted px-2 py-1 font-semibold text-muted-foreground">{rec.credit_days} days credit</span>
                                            )}
                                            {daysLate > 0 && (
                                                <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 font-bold text-rose-700">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    {daysLate}d late · estimated interest {money(lateInterest)}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {expandedHistoryId === rec.id && (
                                        <div className="mt-3 border-t border-border/40 pt-3">
                                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment History</p>
                                            {loadingHistoryId === rec.id ? (
                                                <p className="text-xs text-muted-foreground">Loading...</p>
                                            ) : paymentHistory.length === 0 ? (
                                                <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
                                            ) : (
                                                <div className="grid gap-1.5">
                                                    {paymentHistory.map((payment) => (
                                                        <div key={payment.id} className="flex items-start justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs">
                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="font-semibold text-foreground">{formatDate(payment.payment_date)}</span>
                                                                    <span className="text-muted-foreground">{getPaymentModeLabel(payment.payment_mode)}</span>
                                                                </div>
                                                                {paymentDetailLine(payment) && (
                                                                    <p className="mt-0.5 break-words text-[11px] text-muted-foreground">{paymentDetailLine(payment)}</p>
                                                                )}
                                                            </div>
                                                            <span className="shrink-0 font-black text-emerald-700">{money(payment.amount)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        {group.receivables.length === 0 && group.entries.map((entry) => (
                            <div key={getEntryGroupId(entry)} className="rounded-xl border border-border/60 bg-white p-4">
                                <div className="grid gap-3 md:grid-cols-5">
                                    <div className="md:col-span-2">
                                        <p className="font-black text-foreground">{entry.source_label}</p>
                                        <p className="text-xs text-muted-foreground">{entry.quality_label} · {formatDate(entry.event_date)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Metres Sold</p>
                                        <p className="font-black">{meters(entry.meters_sold)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sale</p>
                                        <p className="font-black">{money(entry.revenue_amount)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gross Profit</p>
                                        <p className={cn('font-black', entry.gross_profit_amount >= 0 ? 'text-emerald-700' : 'text-rose-700')}>{money(entry.gross_profit_amount)}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </Card>
    )
}

function PartiesOwingPanel({
    parties,
    expandedPartyKey,
    onToggleParty,
    onRecordPayment,
    onToggleHistory,
    expandedHistoryId,
    paymentHistoryCache,
    loadingHistoryId,
}: {
    parties: PartyReceivableSummary[]
    expandedPartyKey: string | null
    onToggleParty: (partyKey: string) => void
    onRecordPayment: (rec: Receivable) => void
    onToggleHistory: (receivableId: string) => void
    expandedHistoryId: string | null
    paymentHistoryCache: Record<string, CommercialPayment[]>
    loadingHistoryId: string | null
}) {
    const totalOwed = parties.reduce((sum, party) => sum + party.totalBalance, 0)

    return (
        <Card className="border-border/60 bg-white/95 shadow-sm lg:sticky lg:top-4">
            <CardContent className="p-0">
                <div className="border-b border-border/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <div className="rounded-lg bg-violet-50 p-1.5 text-violet-700">
                                <Users className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-foreground">Parties Owing</p>
                                <p className="text-xs text-muted-foreground">{parties.length} open parties</p>
                            </div>
                        </div>
                        <p className="text-sm font-black text-rose-700">{money(totalOwed)}</p>
                    </div>
                </div>

                {parties.length === 0 ? (
                    <div className="p-6 text-center">
                        <BadgeIndianRupee className="mx-auto mb-2 h-8 w-8 text-muted-foreground/70" />
                        <p className="text-sm font-bold text-foreground">No open dues</p>
                        <p className="mt-1 text-xs text-muted-foreground">Parties with unpaid balances will appear here.</p>
                    </div>
                ) : (
                    <div className="max-h-[680px] divide-y divide-border/40 overflow-y-auto">
                        {parties.map((party) => {
                            const expanded = expandedPartyKey === party.partyKey
                            const partyDetail = [party.partyPhone, party.partyGstin].filter(Boolean).join(' · ')

                            return (
                                <div key={party.partyKey}>
                                    <button
                                        type="button"
                                        className="w-full p-4 text-left transition hover:bg-muted/25"
                                        onClick={() => onToggleParty(party.partyKey)}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-black text-foreground">{party.partyName}</p>
                                                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                                    {party.openSalesCount} open sale{party.openSalesCount === 1 ? '' : 's'} · due {formatDate(party.earliestDueDate)}
                                                </p>
                                                {partyDetail && (
                                                    <p className="mt-1 truncate text-[11px] font-semibold text-muted-foreground">{partyDetail}</p>
                                                )}
                                            </div>
                                            <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
                                        </div>
                                        <div className="mt-3 flex items-center justify-between gap-3">
                                            <p className="text-lg font-black text-rose-700">{money(party.totalBalance)}</p>
                                            {party.overdueBalance > 0 ? (
                                                <Badge variant="outline" className="border-rose-200 bg-rose-50 font-bold text-rose-700">
                                                    {money(party.overdueBalance)} overdue
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="border-amber-200 bg-amber-50 font-bold text-amber-700">
                                                    On credit
                                                </Badge>
                                            )}
                                        </div>
                                    </button>

                                    {expanded && (
                                        <div className="space-y-2 bg-stone-50/70 px-3 pb-3">
                                            {party.receivables.map((rec) => {
                                                const daysLate = getDaysLate(rec)
                                                const paymentHistory = paymentHistoryCache[rec.id] ?? []

                                                return (
                                                    <div key={rec.id} className="rounded-xl border border-border/60 bg-white p-3">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-xs font-black text-foreground">{rec.quality_label}</p>
                                                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                                                    {meters(rec.meters_sold ?? 0)} · {money(rec.price_per_meter ?? 0, 2)}/m
                                                                </p>
                                                            </div>
                                                            <p className="shrink-0 text-sm font-black text-rose-700">{money(rec.balance_amount)}</p>
                                                        </div>

                                                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                                                            <div>
                                                                <p className="font-bold uppercase tracking-wider text-muted-foreground">Sale</p>
                                                                <p className="font-semibold text-foreground">{money(rec.total_amount)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="font-bold uppercase tracking-wider text-muted-foreground">Paid</p>
                                                                <p className="font-semibold text-emerald-700">{money(rec.received_amount)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="font-bold uppercase tracking-wider text-muted-foreground">Due</p>
                                                                <p className="font-semibold text-foreground">{formatDate(rec.due_date)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="font-bold uppercase tracking-wider text-muted-foreground">Source</p>
                                                                <p className="truncate font-semibold text-foreground">
                                                                    {rec.market_run_label || rec.order_quality_label || rec.godown || 'Stock sale'}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {daysLate > 0 && (
                                                            <p className="mt-2 inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700">
                                                                <AlertTriangle className="h-3 w-3" />
                                                                {daysLate}d late
                                                            </p>
                                                        )}

                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            {rec.received_amount > 0 && (
                                                                <Button variant="outline" size="sm" className="h-8 min-h-8 gap-1 text-xs font-bold" onClick={() => onToggleHistory(rec.id)}>
                                                                    <History className="h-3 w-3" />
                                                                    History
                                                                </Button>
                                                            )}
                                                            <Button size="sm" className="h-8 min-h-8 gap-1 text-xs font-bold" onClick={() => onRecordPayment(rec)}>
                                                                Record
                                                                <ArrowRight className="h-3 w-3" />
                                                            </Button>
                                                        </div>

                                                        {expandedHistoryId === rec.id && (
                                                            <div className="mt-3 border-t border-border/40 pt-2">
                                                                {loadingHistoryId === rec.id ? (
                                                                    <p className="text-xs text-muted-foreground">Loading...</p>
                                                                ) : paymentHistory.length === 0 ? (
                                                                    <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
                                                                ) : (
                                                                    <div className="space-y-1.5">
                                                                        {paymentHistory.map((payment) => (
                                                                            <div key={payment.id} className="flex items-start justify-between gap-2 rounded-lg bg-muted/30 px-2 py-1.5 text-[11px]">
                                                                                <div className="min-w-0">
                                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                                        <span className="font-semibold text-foreground">{formatDate(payment.payment_date)}</span>
                                                                                        <span className="text-muted-foreground">{getPaymentModeLabel(payment.payment_mode)}</span>
                                                                                    </div>
                                                                                    {paymentDetailLine(payment) && (
                                                                                        <p className="mt-0.5 break-words text-muted-foreground">{paymentDetailLine(payment)}</p>
                                                                                    )}
                                                                                </div>
                                                                                <span className="shrink-0 font-black text-emerald-700">{money(payment.amount)}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function CollectionFocusPanel({
    receivables,
    onRecordPayment,
    onToggleHistory,
    expandedHistoryId,
    paymentHistoryCache,
    loadingHistoryId,
}: {
    receivables: Receivable[]
    onRecordPayment: (rec: Receivable) => void
    onToggleHistory: (receivableId: string) => void
    expandedHistoryId: string | null
    paymentHistoryCache: Record<string, CommercialPayment[]>
    loadingHistoryId: string | null
}) {
    const openReceivables = receivables
        .filter((rec) => Number(rec.balance_amount ?? 0) > 0)
        .sort(compareCollectionPriority)
    const overdueTotal = openReceivables.reduce((sum, rec) => getDueBucket(rec) === 'overdue' ? sum + Number(rec.balance_amount ?? 0) : sum, 0)
    const dueSoonTotal = openReceivables.reduce((sum, rec) => {
        const bucket = getDueBucket(rec)
        return bucket === 'due_today' || bucket === 'due_this_week' ? sum + Number(rec.balance_amount ?? 0) : sum
    }, 0)
    const laterTotal = openReceivables.reduce((sum, rec) => getDueBucket(rec) === 'upcoming' ? sum + Number(rec.balance_amount ?? 0) : sum, 0)
    const visibleReceivables = openReceivables.slice(0, 6)

    return (
        <Card className="@container border-border/60 bg-white/95 shadow-sm">
            <CardContent className="p-0">
                <div className="border-b border-border/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <div className="rounded-lg bg-rose-50 p-1.5 text-rose-700">
                                <Clock3 className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-foreground">Collect First</p>
                                <p className="text-xs text-muted-foreground">{openReceivables.length} open sale{openReceivables.length === 1 ? '' : 's'}</p>
                            </div>
                        </div>
                        <p className="text-sm font-black text-rose-700">
                            {money(openReceivables.reduce((sum, rec) => sum + Number(rec.balance_amount ?? 0), 0))}
                        </p>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                            <p className="font-bold uppercase tracking-wider text-rose-700">Overdue</p>
                            <p className="mt-1 font-black text-rose-800">{money(overdueTotal)}</p>
                        </div>
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                            <p className="font-bold uppercase tracking-wider text-amber-700">7 days</p>
                            <p className="mt-1 font-black text-amber-800">{money(dueSoonTotal)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="font-bold uppercase tracking-wider text-slate-600">Later</p>
                            <p className="mt-1 font-black text-slate-800">{money(laterTotal)}</p>
                        </div>
                    </div>
                </div>

                {visibleReceivables.length === 0 ? (
                    <div className="p-6 text-center">
                        <BadgeIndianRupee className="mx-auto mb-2 h-8 w-8 text-muted-foreground/70" />
                        <p className="text-sm font-bold text-foreground">No open balances</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/40">
                        {visibleReceivables.map((rec) => {
                            const status = getCollectionStatusMeta(rec)
                            const paymentHistory = paymentHistoryCache[rec.id] ?? []
                            const quantityLabel = getReceivableQuantityLabel(rec)

                            return (
                                <div key={rec.id} className="p-4">
                                    <div className="grid gap-3 @lg:grid-cols-[minmax(0,1fr)_auto] @lg:items-start">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="truncate text-sm font-black text-foreground">{rec.party_name}</p>
                                                <Badge variant="outline" className={cn('font-bold', status.className)}>
                                                    {status.label}
                                                </Badge>
                                            </div>
                                            <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                                {[rec.quality_label, quantityLabel, `due ${formatDate(rec.due_date)}`].filter(Boolean).join(' · ')}
                                            </p>
                                            <p className="mt-0.5 truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                {getCollectionSourceLabel(rec)}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 @lg:justify-end">
                                            <p className="mr-1 text-lg font-black text-rose-700">{money(rec.balance_amount)}</p>
                                            {rec.received_amount > 0 && (
                                                <Button variant="outline" size="sm" className="h-8 min-h-8 gap-1 text-xs font-bold" onClick={() => onToggleHistory(rec.id)}>
                                                    <History className="h-3 w-3" />
                                                    History
                                                </Button>
                                            )}
                                            <Button size="sm" className="h-8 min-h-8 gap-1 text-xs font-bold" onClick={() => onRecordPayment(rec)}>
                                                Record
                                                <ArrowRight className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>

                                    {expandedHistoryId === rec.id && (
                                        <div className="mt-3 border-t border-border/40 pt-3">
                                            {loadingHistoryId === rec.id ? (
                                                <p className="text-xs text-muted-foreground">Loading...</p>
                                            ) : paymentHistory.length === 0 ? (
                                                <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
                                            ) : (
                                                <div className="grid gap-1.5">
                                                    {paymentHistory.map((payment) => (
                                                        <div key={payment.id} className="flex items-start justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs">
                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="font-semibold text-foreground">{formatDate(payment.payment_date)}</span>
                                                                    <span className="text-muted-foreground">{getPaymentModeLabel(payment.payment_mode)}</span>
                                                                </div>
                                                                {paymentDetailLine(payment) && (
                                                                    <p className="mt-0.5 break-words text-[11px] text-muted-foreground">{paymentDetailLine(payment)}</p>
                                                                )}
                                                            </div>
                                                            <span className="shrink-0 font-black text-emerald-700">{money(payment.amount)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function ProfitSnapshotPanel({ data }: { data: CommercialsData }) {
    const margin = data.summary.realized_margin_pct
    const snapshotItems = [
        { label: 'Booked revenue', value: money(data.summary.realized_revenue), tone: 'text-foreground' },
        { label: 'Fabric cost', value: money(data.summary.realized_cost), tone: 'text-foreground' },
        {
            label: 'Booked profit',
            value: `${data.summary.realized_profit >= 0 ? '+' : ''}${money(data.summary.realized_profit)}`,
            tone: data.summary.realized_profit >= 0 ? 'text-emerald-700' : 'text-rose-700',
        },
        { label: 'Margin', value: margin == null ? '—' : `${margin.toFixed(1)}%`, tone: margin == null || margin >= 0 ? 'text-emerald-700' : 'text-rose-700' },
    ]

    return (
        <Card className="border-border/60 bg-white/95 shadow-sm">
            <CardContent className="p-4">
                <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700">
                        <ReceiptText className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-black text-foreground">Profit Snapshot</p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                    {snapshotItems.map((item) => (
                        <div key={item.label} className="rounded-lg border border-border/60 bg-stone-50/50 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                            <p className={cn('mt-1 text-base font-black tabular-nums', item.tone)}>{item.value}</p>
                        </div>
                    ))}
                </div>

                {(data.summary.expected_revenue > 0 || data.summary.expected_profit !== 0) && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="font-bold uppercase tracking-wider text-amber-800">Expected orders</span>
                            <span className={cn('font-black', data.summary.expected_profit >= 0 ? 'text-amber-900' : 'text-rose-700')}>
                                {data.summary.expected_profit >= 0 ? '+' : ''}{money(data.summary.expected_profit)}
                            </span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

const leaderboardPeriods: Array<{ value: CommercialPartyPeriod; label: string }> = [
    { value: '7d', label: '7D' },
    { value: '30d', label: '30D' },
    { value: 'year', label: 'Year' },
    { value: 'all', label: 'All' },
]

function PartyStatLine({ row, rank }: { row: CommercialPartyInsightRow; rank: number }) {
    const identityLine = [row.phone, row.gstin, row.defaultCreditDays == null ? null : `${row.defaultCreditDays}d credit`]
        .filter(Boolean)
        .join(' · ')

    return (
        <div className="rounded-lg border border-border/60 bg-white px-3 py-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-700">
                            {rank}
                        </span>
                        <p className="truncate text-sm font-black text-foreground">{row.partyName}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {meters(row.metersSold)} · {row.salesCount} sale{row.salesCount === 1 ? '' : 's'} · Last sale {formatDate(row.lastSaleDate)}
                    </p>
                    {identityLine && (
                        <p className="mt-1 truncate text-[11px] font-semibold text-muted-foreground">{identityLine}</p>
                    )}
                </div>
                <p className={cn('shrink-0 text-sm font-black tabular-nums', row.bookedGrossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                    {row.bookedGrossProfit >= 0 ? '+' : ''}{money(row.bookedGrossProfit)}
                </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div>
                    <p className="font-bold uppercase tracking-wider text-muted-foreground">Revenue</p>
                    <p className="mt-0.5 font-black text-foreground">{money(row.revenue)}</p>
                </div>
                <div>
                    <p className="font-bold uppercase tracking-wider text-muted-foreground">Margin</p>
                    <p className={cn('mt-0.5 font-black', row.marginPct == null || row.marginPct >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                        {row.marginPct == null ? '—' : `${row.marginPct.toFixed(1)}%`}
                    </p>
                </div>
                <div>
                    <p className="font-bold uppercase tracking-wider text-muted-foreground">Open</p>
                    <p className={cn('mt-0.5 font-black', row.outstanding > 0 ? 'text-rose-700' : 'text-foreground')}>
                        {money(row.outstanding)}
                    </p>
                </div>
                <div>
                    <p className="font-bold uppercase tracking-wider text-muted-foreground">Overdue</p>
                    <p className={cn('mt-0.5 font-black', row.overdue > 0 ? 'text-rose-700' : 'text-foreground')}>
                        {money(row.overdue)}
                    </p>
                </div>
            </div>
        </div>
    )
}

function PartyLeaderboardPanel({ insights }: { insights: CommercialPartyInsights }) {
    const [period, setPeriod] = useState<CommercialPartyPeriod>('30d')
    const rows = insights.leaderboards[period] ?? []

    return (
        <Card className="border-border/60 bg-white/95 shadow-sm">
            <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <div className="rounded-lg bg-indigo-50 p-1.5 text-indigo-700">
                            <Trophy className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-black text-foreground">Top Parties</p>
                            <p className="text-xs text-muted-foreground">Ranked by booked gross profit</p>
                        </div>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-1 rounded-lg border border-border/60 bg-slate-50 p-1">
                    {leaderboardPeriods.map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            onClick={() => setPeriod(item.value)}
                            className={cn(
                                'h-8 rounded-md text-xs font-black transition',
                                period === item.value ? 'bg-white text-slate-950 shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                <div className="mt-4 space-y-2">
                    {rows.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border/70 px-3 py-6 text-center">
                            <p className="text-sm font-bold text-foreground">No party sales yet</p>
                            <p className="mt-1 text-xs text-muted-foreground">Saved parties will rank here after sales are booked.</p>
                        </div>
                    ) : (
                        rows.slice(0, 5).map((row, index) => (
                            <PartyStatLine key={row.partyKey} row={row} rank={index + 1} />
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

function PartiesDirectory({ insights }: { insights: CommercialPartyInsights }) {
    const [search, setSearch] = useState('')
    const rows = useMemo(() => {
        const needle = search.trim().toLowerCase()
        if (!needle) return insights.parties
        return insights.parties.filter((row) => {
            return [
                row.partyName,
                row.phone ?? '',
                row.gstin ?? '',
                row.isSavedParty ? 'saved' : 'legacy',
            ].join(' ').toLowerCase().includes(needle)
        })
    }, [insights.parties, search])

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 className="text-xl font-black text-foreground">Parties</h2>
                    <p className="text-sm text-muted-foreground">Saved party records with sales, profit, meters, and open dues.</p>
                </div>
                <div className="relative w-full lg:w-80">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search party, phone, GSTIN..."
                        className="pl-9"
                    />
                </div>
            </div>

            <Card className="overflow-hidden border-border/60 bg-white/95 shadow-sm">
                <CardContent className="p-0">
                    {rows.length === 0 ? (
                        <div className="px-4 py-12 text-center">
                            <Users className="mx-auto h-8 w-8 text-muted-foreground" />
                            <p className="mt-3 text-lg font-bold text-foreground">No parties found</p>
                            <p className="mt-1 text-sm text-muted-foreground">Parties are created when a stock sale is saved.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/60">
                            {rows.map((row) => (
                                <div key={row.partyKey} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(220px,1.3fr)_repeat(5,minmax(100px,1fr))] lg:items-center">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="truncate text-sm font-black text-foreground">{row.partyName}</p>
                                            <Badge variant="outline" className={cn('text-[10px] font-black', row.isSavedParty ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600')}>
                                                {row.isSavedParty ? 'Saved' : 'Legacy'}
                                            </Badge>
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {row.phone || 'No phone'}{row.gstin ? ` · ${row.gstin}` : ''}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Revenue</p>
                                        <p className="mt-1 font-black text-foreground">{money(row.revenue)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Profit</p>
                                        <p className={cn('mt-1 font-black', row.bookedGrossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                                            {row.bookedGrossProfit >= 0 ? '+' : ''}{money(row.bookedGrossProfit)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Metres Sold</p>
                                        <p className="mt-1 font-black text-foreground">{meters(row.metersSold)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Open</p>
                                        <p className={cn('mt-1 font-black', row.outstanding > 0 ? 'text-rose-700' : 'text-foreground')}>
                                            {money(row.outstanding)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Last Sale</p>
                                        <p className="mt-1 font-black text-foreground">{formatDate(row.lastSaleDate)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export default function CommercialsClient({ initialData, initialReceivables, collectedThisMonth, partyInsights }: CommercialsClientProps) {
    const router = useRouter()
    const [query, setQuery] = useState('')
    const [stage, setStage] = useState<StageFilter>('all')
    const [source, setSource] = useState<SourceFilter>('all')
    const [activeTab, setActiveTab] = useState('overview')
    const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
    const [expandedPartyKey, setExpandedPartyKey] = useState<string | null>(null)

    const [dueTab, setDueTab] = useState<'all' | DueBucket>('all')
    const [receivableSearch, setReceivableSearch] = useState('')

    // Payment Dialog State
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
    const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null)
    const [paymentAmount, setPaymentAmount] = useState('')
    const [paymentMode, setPaymentMode] = useState('bank')
    const [paymentDate, setPaymentDate] = useState(getSuratTodayString())
    const [reference, setReference] = useState('')
    const [chequeNumber, setChequeNumber] = useState('')
    const [chequeDate, setChequeDate] = useState(getSuratTodayString())
    const [bankName, setBankName] = useState('')
    const [notes, setNotes] = useState('')
    const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState(() => createClientIdempotencyKey('commercial-payment'))
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Payment History State
    const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
    const [paymentHistoryCache, setPaymentHistoryCache] = useState<Record<string, CommercialPayment[]>>({})
    const [loadingHistoryId, setLoadingHistoryId] = useState<string | null>(null)

    const resetPaymentForm = () => {
        setPaymentAmount('')
        setPaymentMode('bank')
        setPaymentDate(getSuratTodayString())
        setReference('')
        setChequeNumber('')
        setChequeDate(getSuratTodayString())
        setBankName('')
        setNotes('')
        setPaymentIdempotencyKey(createClientIdempotencyKey('commercial-payment'))
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

        if (paymentMode === 'cheque' && (!chequeNumber.trim() || !chequeDate || !bankName.trim())) {
            toast.error('Cheque number, cheque date, and bank name are required')
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
                chequeNumber: paymentMode === 'cheque' ? chequeNumber.trim() : undefined,
                chequeDate: paymentMode === 'cheque' ? chequeDate : undefined,
                bankName: paymentMode === 'cheque' ? bankName.trim() : undefined,
                notes: notes || undefined,
                idempotencyKey: paymentIdempotencyKey,
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

    const openPaymentDialog = (rec: Receivable) => {
        setSelectedReceivable(rec)
        setPaymentAmount(rec.balance_amount.toString())
        setPaymentMode('bank')
        setPaymentDate(getSuratTodayString())
        setReference('')
        setChequeNumber('')
        setChequeDate(getSuratTodayString())
        setBankName('')
        setNotes('')
        setPaymentIdempotencyKey(createClientIdempotencyKey('commercial-payment'))
        setIsPaymentDialogOpen(true)
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
        { key: 'stock_sale', label: 'Stock Sales' },
        { key: 'stock_sale_market_run', label: 'From Market Runs' },
        { key: 'stock_sale_order', label: 'From Orders' },
        { key: 'stock_sale_manual', label: 'Manual Stock' },
        { key: 'order_invoice', label: 'Billed Orders' },
        { key: 'order_quote', label: 'Expected Orders' },
        { key: 'market_run_sale', label: 'Direct Market Sales' },
    ]

    const commercialGroups = useMemo(() => {
        return buildCommercialGroups(initialReceivables, initialData.entries)
    }, [initialData.entries, initialReceivables])

    const collectionGroups = useMemo(() => {
        return commercialGroups.filter((group) => group.receivables.length > 0)
    }, [commercialGroups])

    const filteredGroups = useMemo(() => {
        const needle = receivableSearch.trim().toLowerCase()
        return collectionGroups.filter((group) => {
            const matchesBucket = dueTab === 'all' || group.receivables.some((rec) => getDueBucket(rec) === dueTab)
            const haystack = [
                group.title,
                group.subtitle,
                ...group.receivables.flatMap((rec) => [rec.party_name, rec.quality_label, rec.payment_status]),
                ...group.entries.flatMap((entry) => [entry.source_label, entry.quality_label, entry.reference ?? '']),
            ].join(' ').toLowerCase()
            return matchesBucket && (!needle || haystack.includes(needle))
        })
    }, [collectionGroups, dueTab, receivableSearch])

    const partySummaries = useMemo(() => {
        return buildPartyReceivableSummaries(initialReceivables)
    }, [initialReceivables])

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
                    <h1 className="text-3xl font-black tracking-tight text-foreground">Party Ledger</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Party dues, collection priority, and booked profit.</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="overview">Collect</TabsTrigger>
                    <TabsTrigger value="receivables">Sales ({collectionGroups.length})</TabsTrigger>
                    <TabsTrigger value="parties">Parties ({partyInsights.parties.length})</TabsTrigger>
                    <TabsTrigger value="profit_entries">Profit Ledger ({initialData.entries.length})</TabsTrigger>
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

                    <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)] 2xl:grid-cols-[420px_minmax(0,1fr)_360px]">
                        <PartiesOwingPanel
                            parties={partySummaries}
                            expandedPartyKey={expandedPartyKey}
                            onToggleParty={(partyKey) => setExpandedPartyKey(expandedPartyKey === partyKey ? null : partyKey)}
                            onRecordPayment={openPaymentDialog}
                            onToggleHistory={togglePaymentHistory}
                            expandedHistoryId={expandedHistoryId}
                            paymentHistoryCache={paymentHistoryCache}
                            loadingHistoryId={loadingHistoryId}
                        />

                        <div className="space-y-4">
                            <CollectionFocusPanel
                                receivables={initialReceivables}
                                onRecordPayment={openPaymentDialog}
                                onToggleHistory={togglePaymentHistory}
                                expandedHistoryId={expandedHistoryId}
                                paymentHistoryCache={paymentHistoryCache}
                                loadingHistoryId={loadingHistoryId}
                            />
                            <ProfitSnapshotPanel data={initialData} />
                        </div>

                        <div className="xl:col-span-2 2xl:col-span-1">
                            <PartyLeaderboardPanel insights={partyInsights} />
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="parties" className="space-y-6">
                    <PartiesDirectory insights={partyInsights} />
                </TabsContent>

                <TabsContent value="receivables" className="space-y-6">
                    <div className="flex flex-col gap-3 lg:flex-row">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={receivableSearch}
                                onChange={(e) => setReceivableSearch(e.target.value)}
                                placeholder="Search party, quality, sale..."
                                className="pl-10"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(['all', 'overdue', 'due_today', 'due_this_week', 'upcoming', 'paid'] as const).map((tab) => {
                                const label = tab === 'all'
                                    ? 'All Sales'
                                    : tab === 'due_today'
                                        ? 'Today'
                                        : tab === 'due_this_week'
                                            ? 'This Week'
                                            : tab === 'upcoming'
                                                ? 'Later'
                                                : tab.charAt(0).toUpperCase() + tab.slice(1)
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

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                        <div className="space-y-3">
                            {filteredGroups.length === 0 ? (
                                <Card className="border-border/60">
                                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                        <BadgeIndianRupee className="mb-3 h-10 w-10 text-muted-foreground/70" />
                                        <p className="text-lg font-bold text-foreground">No commercial groups found</p>
                                        <p className="mt-1 text-sm text-muted-foreground">Sales will automatically create receivables here.</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                filteredGroups.map((group) => (
                                    <CommercialGroupCard
                                        key={group.id}
                                        group={group}
                                        expanded={expandedGroupId === group.id}
                                        onToggle={() => setExpandedGroupId(expandedGroupId === group.id ? null : group.id)}
                                        onRecordPayment={openPaymentDialog}
                                        onToggleHistory={togglePaymentHistory}
                                        expandedHistoryId={expandedHistoryId}
                                        paymentHistoryCache={paymentHistoryCache}
                                        loadingHistoryId={loadingHistoryId}
                                    />
                                ))
                            )}
                        </div>

                        <PartiesOwingPanel
                            parties={partySummaries}
                            expandedPartyKey={expandedPartyKey}
                            onToggleParty={(partyKey) => setExpandedPartyKey(expandedPartyKey === partyKey ? null : partyKey)}
                            onRecordPayment={openPaymentDialog}
                            onToggleHistory={togglePaymentHistory}
                            expandedHistoryId={expandedHistoryId}
                            paymentHistoryCache={paymentHistoryCache}
                            loadingHistoryId={loadingHistoryId}
                        />
                    </div>

                    <Card className="hidden border-border/60">
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
                                                                    <span>Due: {formatDate(rec.due_date)}</span>
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
                                                                                    {formatDate(p.payment_date)}
                                                                                </p>
                                                                                <p className="text-[10px] text-muted-foreground">{getPaymentModeLabel(p.payment_mode)}</p>
                                                                                {paymentDetailLine(p) && (
                                                                                    <p className="text-[10px] text-muted-foreground">{paymentDetailLine(p)}</p>
                                                                                )}
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
                                                                            {formatDate(rec.due_date)}
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
                                                                                            {formatDate(p.payment_date)}
                                                                                        </span>
                                                                                        <span className="text-muted-foreground">{getPaymentModeLabel(p.payment_mode)}</span>
                                                                                        {paymentDetailLine(p) && (
                                                                                            <span className="text-muted-foreground">{paymentDetailLine(p)}</span>
                                                                                        )}
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
                                                                    {formatDate(entry.event_date)}
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

                                {paymentMode === 'cheque' && (
                                    <div className="grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3 sm:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="chequeNumber" className="text-sm font-semibold">Cheque Number</Label>
                                            <Input
                                                id="chequeNumber"
                                                value={chequeNumber}
                                                onChange={(e) => setChequeNumber(e.target.value)}
                                                placeholder="Enter cheque no."
                                                className="h-11 min-h-11 lg:h-9 lg:min-h-9"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="chequeDate" className="text-sm font-semibold">Cheque Date</Label>
                                            <Input
                                                id="chequeDate"
                                                type="date"
                                                value={chequeDate}
                                                onChange={(e) => setChequeDate(e.target.value)}
                                                className="h-11 min-h-11 lg:h-9 lg:min-h-9"
                                            />
                                        </div>
                                        <div className="space-y-1.5 sm:col-span-2">
                                            <Label htmlFor="bankName" className="text-sm font-semibold">Bank Name</Label>
                                            <Input
                                                id="bankName"
                                                value={bankName}
                                                onChange={(e) => setBankName(e.target.value)}
                                                placeholder="Enter bank name"
                                                className="h-11 min-h-11 lg:h-9 lg:min-h-9"
                                            />
                                        </div>
                                    </div>
                                )}

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
