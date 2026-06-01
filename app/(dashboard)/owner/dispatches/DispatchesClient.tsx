'use client'

import Link from 'next/link'
import { useEffect, useState, useMemo, useTransition } from 'react'
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
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/context'
import { Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
    getActiveOrders,
    getDispatchesForOrder,
    type OrderSummary,
    type DispatchSummary,
    type DispatchRow,
    type DispatchOverviewStats,
    confirmPendingSaleDispatch,
    confirmPendingSaleReceived,
    type PendingStockSale,
} from '@/app/(dashboard)/owner/orders/actions'
import { confirmDispatchReceiptByOwner } from '@/app/(dashboard)/owner/orders/actions'
import { CreateDispatchModal } from '@/components/dispatches/DispatchModals'
import { SellAndDispatchDialog } from '@/components/dispatches/SellAndDispatchDialog'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Dispatch {
    id: string
    stock_sale_id?: string | null
    dispatch_number: number
    qty_meters_sent: number
    qty_meters_received: number | null
    receipt_confirmed_by_owner: boolean
    receipt_confirmation_note: string | null
    receipt_confirmed_by: string | null
    status: 'in_transit' | 'delivered' | 'disputed'
    dispatched_at: string
    received_at: string | null
    notes: string | null
    eway_bill_number: string | null
    eway_bill_required: boolean
    vehicle_number: string | null
    transporter_name: string | null
    transporter_id: string | null
    approximate_distance_km: number | null
    eway_bill_generated_at: string | null
    hsn_code: string | null
    taxable_value: number | null
    gst_percent: number | null
    cgst_amount: number | null
    sgst_amount: number | null
    igst_amount: number | null
    total_invoice_value: number | null
    stock_sale?: {
        id: string
        sale_date: string
        meters_sold: number
        dispatched_meters: number
        pending_dispatch_meters: number
        party_name: string | null
        quality_label: string | null
    } | null
    package_lines: Array<{
        id: string
        package_no: string
        package_type: string
        units_count: number
        grade: string
        qty_meters_sent: number
        qty_meters_received: number | null
    }>
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
    remainingToDispatch: number
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
    initialOverview: DispatchOverviewStats
    initialPendingSales: PendingStockSale[]
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
    if (group.remainingToDispatch > 0.01) return { label: 'Partially Dispatched', color: 'bg-orange-500' }
    return { label: 'All Delivered', color: 'bg-emerald-500' }
}

const getReceiptBadge = (dispatch: Dispatch, t: (key: string) => string) => {
    if (dispatch.qty_meters_received === null) {
        return {
            label: t('dispatch.shortage.awaiting'),
            className: 'bg-amber-50 text-amber-700 border-amber-200',
        }
    }

    const variance = Number(dispatch.qty_meters_received) - Number(dispatch.qty_meters_sent)
    if (variance < -0.01) {
        return {
            label: t('dispatch.shortage.badge').replace('{amount}', Math.abs(variance).toFixed(2)),
            className: 'bg-rose-50 text-rose-700 border-rose-200',
        }
    }
    if (variance > 0.01) {
        return {
            label: t('dispatch.shortage.extra').replace('{amount}', variance.toFixed(2)),
            className: 'bg-sky-50 text-sky-700 border-sky-200',
        }
    }

    return {
        label: t('dispatch.shortage.received'),
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DispatchBatchRow({
    dispatch,
    onOwnerReceiptConfirmed,
}: {
    dispatch: Dispatch
    onOwnerReceiptConfirmed: (dispatchId: string, qtyReceived: number, note: string) => void
}) {
    const { t } = useTranslation()
    const [isReceiptSheetOpen, setIsReceiptSheetOpen] = useState(false)
    const [showExtraConfirm, setShowExtraConfirm] = useState(false)
    const [metersReceived, setMetersReceived] = useState(String(dispatch.qty_meters_sent))
    const [confirmationNote, setConfirmationNote] = useState('')
    const [isPending, startTransition] = useTransition()
    const status = getStatusConfig(dispatch.status)
    const shortage = dispatch.qty_meters_received !== null
        ? Number(dispatch.qty_meters_sent) - Number(dispatch.qty_meters_received)
        : 0
    const receiptBadge = getReceiptBadge(dispatch, t)
    const showRecordReceipt = dispatch.qty_meters_received === null

    const submitOwnerReceiptConfirm = () => {
        const qty = Number.parseFloat(metersReceived)
        if (!Number.isFinite(qty) || qty < 0) {
            toast.error(t('dispatch.receipt.metersReceived'))
            return
        }

        startTransition(async () => {
            const result = await confirmDispatchReceiptByOwner(dispatch.id, qty, confirmationNote)
            if ('error' in result) {
                toast.error(result.error)
                return
            }

            toast.success(t('dispatch.receipt.recordButton'))
            onOwnerReceiptConfirmed(dispatch.id, result.qty_received, confirmationNote)
            setIsReceiptSheetOpen(false)
            setShowExtraConfirm(false)
        })
    }

    const handleOwnerReceiptConfirm = () => {
        const qty = Number.parseFloat(metersReceived)
        if (!Number.isFinite(qty) || qty < 0) {
            toast.error(t('dispatch.receipt.metersReceived'))
            return
        }

        if (qty > Number(dispatch.qty_meters_sent)) {
            setShowExtraConfirm(true)
            return
        }

        submitOwnerReceiptConfirm()
    }

    return (
        <>
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
                    <Badge className={cn("mt-1 text-[10px] font-bold px-2 py-0 rounded-full border", receiptBadge.className)}>
                        {receiptBadge.label}
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
                {shortage < -0.01 && (
                    <div className="border-l border-zinc-200 dark:border-zinc-700 pl-4">
                        <p className="text-[10px] font-black text-sky-500 uppercase tracking-wider">Extra</p>
                        <p className="text-sm font-black text-sky-600 tabular-nums">+{Math.abs(shortage).toFixed(2)}<span className="text-[10px] ml-0.5 font-bold opacity-70">m</span></p>
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
                {showRecordReceipt && (
                    <Button
                        size="sm"
                        className="mt-2 h-8 rounded-lg bg-emerald-600 px-3 text-[11px] font-bold text-white hover:bg-emerald-500"
                        onClick={() => setIsReceiptSheetOpen(true)}
                    >
                        {t('dispatch.receipt.recordButton')}
                    </Button>
                )}
            </div>
            {dispatch.package_lines.length > 0 && (
                <div className="flex w-full flex-wrap gap-1.5 sm:col-span-full">
                    {dispatch.package_lines.map((line) => (
                        <Badge key={line.id} variant="outline" className="bg-white/70 text-[10px] font-bold text-zinc-700">
                            {line.package_no} · {Number(line.qty_meters_sent).toFixed(0)}m
                        </Badge>
                    ))}
                </div>
            )}
        </motion.div>
        <Sheet open={isReceiptSheetOpen} onOpenChange={setIsReceiptSheetOpen}>
            <SheetContent side="bottom" className="rounded-t-[28px] pb-8">
                <SheetHeader>
                    <SheetTitle>{t('dispatch.receipt.recordButton')}</SheetTitle>
                    <SheetDescription>
                        {dispatch.orders.party_name} · Batch #{dispatch.dispatch_number}
                    </SheetDescription>
                </SheetHeader>
                <div className="space-y-4 px-4">
                    <div className="space-y-2">
                        <Label>{t('dispatch.receipt.metersReceived')}</Label>
                        <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={metersReceived}
                            onChange={(event) => setMetersReceived(event.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{t('dispatch.receipt.note')}</Label>
                        <Textarea
                            value={confirmationNote}
                            onChange={(event) => setConfirmationNote(event.target.value)}
                        />
                    </div>
                </div>
                <SheetFooter>
                    <Button
                        variant="outline"
                        onClick={() => setIsReceiptSheetOpen(false)}
                        disabled={isPending}
                    >
                        {t('confirm.cancel')}
                    </Button>
                    <Button
                        className="bg-emerald-600 hover:bg-emerald-500"
                        onClick={handleOwnerReceiptConfirm}
                        disabled={isPending || metersReceived.trim() === ''}
                    >
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {t('dispatch.receipt.recordButton')}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
        <ConfirmActionDialog
            open={showExtraConfirm}
            onOpenChange={setShowExtraConfirm}
            title="Confirm extra received"
            description={`This batch was sent as ${Number(dispatch.qty_meters_sent).toFixed(2)} m and will be recorded as ${metersReceived || '0'} m received.`}
            confirmLabel="Record receipt"
            onConfirm={submitOwnerReceiptConfirm}
            isLoading={isPending}
        />
        </>
    )
}

function OrderGroupCard({
    group,
    statusFilter,
    onOwnerReceiptConfirmed,
}: {
    group: OrderGroup
    statusFilter: 'all' | 'in_transit' | 'delivered' | 'disputed'
    onOwnerReceiptConfirmed: (dispatchId: string, qtyReceived: number, note: string) => void
}) {
    const [expanded, setExpanded] = useState(false)

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

                            {/* Sale progress */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:min-w-[440px]">
                                <div>
                                    <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wider">Sale</p>
                                    <p className="text-lg font-black tabular-nums text-foreground">
                                        {group.totalTargetMeters.toFixed(0)}
                                        <span className="text-xs ml-1 font-bold text-muted-foreground">m</span>
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wider">Dispatched</p>
                                    <p className="text-lg font-black tabular-nums text-foreground">
                                        {group.totalDispatched.toFixed(0)}
                                        <span className="text-xs ml-1 font-bold text-muted-foreground">m</span>
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wider">Confirmed</p>
                                    <p className="text-lg font-black tabular-nums text-emerald-600">
                                        {group.totalReceived.toFixed(0)}
                                        <span className="text-xs ml-1 font-bold opacity-60">m</span>
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wider">Remaining</p>
                                    <p className={cn(
                                        "text-lg font-black tabular-nums",
                                        group.remainingToDispatch > 0.01 ? "text-orange-600" : "text-muted-foreground"
                                    )}>
                                        {group.remainingToDispatch.toFixed(0)}
                                        <span className="text-xs ml-1 font-bold opacity-60">m</span>
                                    </p>
                                </div>
                            </div>

                            {/* Actions + chevron */}
                            <div className="flex items-center gap-3 lg:flex-col lg:items-end">
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
                        {group.remainingToDispatch > 0.01 && (
                            <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 rounded-xl">
                                <Layers className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                                <p className="text-xs font-bold text-orange-700 dark:text-orange-300">
                                    <span className="font-black">{group.remainingToDispatch.toFixed(2)} m</span> still pending dispatch from this sale.
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
                                                <DispatchBatchRow
                                                    key={d.id}
                                                    dispatch={d}
                                                    onOwnerReceiptConfirmed={onOwnerReceiptConfirmed}
                                                />
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

function MetricCard({
    label,
    value,
    helper,
    icon: Icon,
    tone,
    badge,
}: {
    label: string
    value: string
    helper: string
    icon: typeof Truck
    tone: 'orange' | 'amber' | 'emerald' | 'rose'
    badge?: string
}) {
    const toneClasses = {
        orange: 'bg-orange-50 text-orange-600',
        amber: 'bg-amber-100 text-amber-600',
        emerald: 'bg-emerald-100 text-emerald-600',
        rose: 'bg-rose-100 text-rose-600',
    }

    return (
        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white dark:bg-zinc-900/50">
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div className={cn('p-2.5 rounded-xl', toneClasses[tone])}>
                        <Icon className="h-5 w-5" />
                    </div>
                    {badge && <Badge variant="outline" className="bg-white/70 text-[11px] font-bold">{badge}</Badge>}
                </div>
                <div className="mt-4">
                    <p className="text-sm font-bold text-muted-foreground/80 uppercase tracking-wider">{label}</p>
                    <h3 className={cn('text-2xl font-black mt-1 tabular-nums', tone === 'rose' && 'text-rose-600')}>{value}</h3>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{helper}</p>
                </div>
            </CardContent>
        </Card>
    )
}

function todayDate() {
    return new Date().toISOString().slice(0, 10)
}

export default function DispatchesClient({ initialDispatches, initialOverview, initialPendingSales = [] }: DispatchesClientProps) {
    const { t } = useTranslation()
    const [dispatches, setDispatches] = useState(initialDispatches)
    const [overview, setOverview] = useState(initialOverview)
    const [pendingSales, setPendingSales] = useState(initialPendingSales)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'in_transit' | 'delivered' | 'disputed'>('all')
    const [pendingReceiptOnly, setPendingReceiptOnly] = useState(false)
    const [sellAndDispatchOpen, setSellAndDispatchOpen] = useState(false)

    // For tab switching: 'dispatched' (default) or 'pending'
    const [activeTab, setActiveTab] = useState<'dispatched' | 'pending'>('dispatched')

    // Confirm dispatch modal states
    const [confirmingSale, setConfirmingSale] = useState<PendingStockSale | null>(null)
    const [confirmMode, setConfirmMode] = useState<'dispatch' | null>(null)
    const [dispatchDate, setDispatchDate] = useState(todayDate())
    const [transportName, setTransportName] = useState('')
    const [vehicleNumber, setVehicleNumber] = useState('')
    const [challanNumber, setChallanNumber] = useState('')
    const [dispatchMeters, setDispatchMeters] = useState('')
    const [dispatchTakas, setDispatchTakas] = useState('')
    const [dispatchNotes, setDispatchNotes] = useState('')
    const [confirmPending, startConfirmTransition] = useTransition()

    const handleConfirmDispatch = () => {
        if (!confirmingSale) return
        startConfirmTransition(async () => {
            const meters = Number.parseFloat(dispatchMeters)
            const takas = Number.parseInt(dispatchTakas, 10) || 0
            if (!Number.isFinite(meters) || meters <= 0) {
                toast.error('Dispatch meters must be a valid number greater than 0')
                return
            }
            const pendingMeters = confirmingSale.pending_dispatch_meters ?? confirmingSale.meters_sold
            if (meters > pendingMeters + 0.01) {
                toast.error(`Cannot dispatch more than remaining pending meters (${pendingMeters.toFixed(2)} m)`)
                return
            }
            const res = await confirmPendingSaleDispatch(
                confirmingSale.id,
                dispatchDate,
                transportName,
                vehicleNumber,
                challanNumber,
                meters,
                takas,
                dispatchNotes
            )

            if (!res.success) {
                toast.error(res.message || 'Failed to confirm action')
            } else {
                toast.success(`Dispatch #${res.dispatchNumber} confirmed!`)
                setConfirmingSale(null)
                setConfirmMode(null)
                // Reload the page to refresh stats and list
                window.location.reload()
            }
        })
    }

    const filteredPendingSales = useMemo(() => {
        return pendingSales.filter((sale) => {
            const searchLower = search.toLowerCase()
            return (
                !search ||
                sale.party_name.toLowerCase().includes(searchLower) ||
                sale.quality_label.toLowerCase().includes(searchLower)
            )
        })
    }, [pendingSales, search])

    // Global Modal Flow State
    const [globalModalStep, setGlobalModalStep] = useState<'idle' | 'select_order' | 'loading_summary' | 'create_dispatch'>('idle')
    const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null)
    const [dispatchSummary, setDispatchSummary] = useState<DispatchSummary | null>(null)

    const handleFetchSummary = async (orderId: string) => {
        setGlobalModalStep('loading_summary')
        const res = await getDispatchesForOrder(orderId)
        if ('error' in res) {
            toast.error(res.error)
            setGlobalModalStep('select_order')
        } else {
            if (res.available_packages.length === 0) {
                toast.error('Record a stock sale first, then dispatch the sold takas from here.')
                setGlobalModalStep('select_order')
            } else {
                setDispatchSummary(res)
                setGlobalModalStep('create_dispatch')
            }
        }
    }

    const handleOwnerReceiptConfirmed = (dispatchId: string, qtyReceived: number, note: string) => {
        setDispatches((prev) =>
            prev.map((dispatch) =>
                dispatch.id === dispatchId
                    ? {
                        ...dispatch,
                        qty_meters_received: qtyReceived,
                        status: 'delivered',
                        received_at: new Date().toISOString(),
                        receipt_confirmed_by_owner: true,
                        receipt_confirmation_note: note.trim() || null,
                    }
                    : dispatch
            )
        )
    }

    // ── Group dispatches by order or stock sale ──
    const orderGroups = useMemo<OrderGroup[]>(() => {
        const map = new Map<string, OrderGroup>()

        for (const d of dispatches) {
            const groupId = d.stock_sale?.id ?? d.stock_sale_id ?? d.orders.id
            const totalSaleMeters = Number(d.stock_sale?.meters_sold ?? d.orders.total_target_meters ?? d.qty_meters_sent)
            const pendingSaleMeters = Number(d.stock_sale?.pending_dispatch_meters ?? 0)
            if (!map.has(groupId)) {
                map.set(groupId, {
                    orderId: groupId,
                    partyName: d.stock_sale?.party_name ?? d.orders.party_name,
                    qualityLabel: d.stock_sale?.quality_label ?? d.orders.quality_label,
                    trackingToken: d.orders.tracking_token,
                    totalTargetMeters: totalSaleMeters,
                    remainingToDispatch: pendingSaleMeters,
                    orderStatus: d.orders.status,
                    dispatches: [],
                    totalDispatched: 0,
                    totalReceived: 0,
                    shortage: 0,
                    hasInTransit: false,
                    hasDisputed: false,
                })
            }
            const group = map.get(groupId)!
            group.dispatches.push(d)
            group.totalDispatched += Number(d.qty_meters_sent)
            group.totalTargetMeters = Math.max(group.totalTargetMeters, totalSaleMeters)
            group.remainingToDispatch = Math.max(group.remainingToDispatch, pendingSaleMeters)
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

            if (g.remainingToDispatch <= 0.01) {
                g.remainingToDispatch = Math.max(g.totalTargetMeters - g.totalDispatched, 0)
            }

            // Sort dispatches newest first within the group
            g.dispatches.sort((a, b) => b.dispatch_number - a.dispatch_number)
        }

        return Array.from(map.values())
    }, [dispatches])

    // ── Filter order groups ──
    const filteredGroups = useMemo(() => {
        return orderGroups.filter(g => {
            const searchLower = search.toLowerCase()
            const matchesSearch = !search ||
                g.partyName.toLowerCase().includes(searchLower) ||
                (g.qualityLabel || '').toLowerCase().includes(searchLower)

            const matchesStatus = statusFilter === 'all' ||
                g.dispatches.some(d => d.status === statusFilter)

            const matchesPendingReceipt = !pendingReceiptOnly ||
                g.dispatches.some(d => d.qty_meters_received === null)

            return matchesSearch && matchesStatus && matchesPendingReceipt
        })
    }, [orderGroups, search, statusFilter, pendingReceiptOnly])

    const inTransitCount = dispatches.filter(d => d.status === 'in_transit').length
    const inTransitMeters = dispatches
        .filter(d => d.status === 'in_transit')
        .reduce((acc, d) => acc + Number(d.qty_meters_sent), 0)
    const ewayAttention = dispatches.filter(d => d.eway_bill_required && !d.eway_bill_number)
    const ewayAttentionValue = ewayAttention.reduce((acc, d) => acc + Number(d.total_invoice_value ?? 0), 0)
    const shortageTotal = orderGroups.reduce((acc, g) => acc + g.shortage, 0)
    const shortageBatches = dispatches.filter((d) =>
        d.status === 'delivered' &&
        d.qty_meters_received !== null &&
        Number(d.qty_meters_sent) - Number(d.qty_meters_received) > 0.01
    ).length

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Dispatches</h1>
                    <p className="text-muted-foreground font-medium">Monitor fabric shipments grouped by order — track progress and verify trader confirmations.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button 
                        onClick={() => setSellAndDispatchOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2 shrink-0 h-11 px-6 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                    >
                        <Plus className="h-5 w-5" />
                        New Sell & Dispatch
                    </Button>
                    <Button 
                        variant="outline"
                        onClick={() => setGlobalModalStep('select_order')}
                        className="font-bold gap-2 shrink-0 h-11 px-6 rounded-xl shadow-sm transition-all active:scale-95"
                    >
                        <Plus className="h-5 w-5" />
                        New Dispatch
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    label="Pending Dispatch"
                    value={`${overview.pending_dispatch_meters.toLocaleString('en-IN', { maximumFractionDigits: 0 })} m`}
                    helper={`Rs. ${overview.pending_dispatch_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })} sold value`}
                    icon={Layers}
                    tone="orange"
                    badge={`${overview.pending_sales_count} sale${overview.pending_sales_count !== 1 ? 's' : ''}`}
                />
                <MetricCard
                    label="In Transit"
                    value={`${inTransitCount} batch${inTransitCount !== 1 ? 'es' : ''}`}
                    helper={`${inTransitMeters.toLocaleString('en-IN', { maximumFractionDigits: 0 })} m awaiting receipt`}
                    icon={Truck}
                    tone="amber"
                    badge={inTransitCount > 0 ? 'Active' : 'Clear'}
                />
                <MetricCard
                    label="E-Way Attention"
                    value={ewayAttention.length > 0 ? `${ewayAttention.length} need${ewayAttention.length === 1 ? 's' : ''} EWB` : 'Clear'}
                    helper={ewayAttention.length > 0 ? `Rs. ${ewayAttentionValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })} missing EWB no.` : 'No required EWB gaps'}
                    icon={CheckCircle2}
                    tone={ewayAttention.length > 0 ? 'rose' : 'emerald'}
                />
                <MetricCard
                    label="Stock Differences"
                    value={overview.open_discrepancy_count > 0 ? `${overview.open_discrepancy_count} review` : shortageTotal > 0 ? `-${shortageTotal.toFixed(2)} m` : 'Clear'}
                    helper={overview.open_discrepancy_count > 0
                        ? `${overview.open_discrepancy_meters.toFixed(2)} m shortage/excess needs review`
                        : shortageBatches > 0 ? `${shortageBatches} batch${shortageBatches !== 1 ? 'es' : ''} short` : 'No dispatch differences'}
                    icon={AlertTriangle}
                    tone={overview.open_discrepancy_count > 0 || shortageTotal > 0 ? 'rose' : 'emerald'}
                />
            </div>

            {/* Tab Switcher */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800">
                <button
                    onClick={() => setActiveTab('dispatched')}
                    className={cn(
                        "px-6 py-3 font-bold text-sm border-b-2 transition-all",
                        activeTab === 'dispatched'
                            ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-black"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                >
                    Dispatched Batches ({dispatches.length})
                </button>
                <button
                    onClick={() => setActiveTab('pending')}
                    className={cn(
                        "px-6 py-3 font-bold text-sm border-b-2 transition-all",
                        activeTab === 'pending'
                            ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-black"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                >
                    Pending Dispatches ({pendingSales.length})
                </button>
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
                {activeTab === 'dispatched' && (
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                            variant={pendingReceiptOnly ? 'default' : 'outline'}
                            onClick={() => setPendingReceiptOnly((prev) => !prev)}
                            className={cn(
                                "h-11 px-5 rounded-xl font-bold transition-all",
                                pendingReceiptOnly ? "shadow-md scale-105" : "bg-white dark:bg-zinc-900/50"
                            )}
                        >
                            {t('dispatch.filter.pendingReceipt')}
                        </Button>
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
                )}
            </div>

            {/* Order Group / Pending Sales List */}
            {activeTab === 'pending' ? (
                <div className="grid gap-4">
                    {filteredPendingSales.length > 0 ? (
                        filteredPendingSales.map((sale) => (
                            <motion.div
                                key={sale.id}
                                layout
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.97 }}
                                transition={{ duration: 0.22 }}
                            >
                                <Card className="border-none shadow-[0_4px_24px_rgb(0,0,0,0.04)] bg-white dark:bg-zinc-900/60 overflow-hidden p-5 sm:p-6 hover:shadow-[0_8px_32px_rgb(0,0,0,0.08)] transition-all duration-300">
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                                        <div className="space-y-1.5 flex-grow">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20 text-[10px] font-bold">
                                                    Pending Dispatch
                                                </Badge>
                                                <span className="text-[11px] font-bold text-muted-foreground/50">·</span>
                                                <span className="text-[11px] font-bold text-muted-foreground/60">Sold on {format(new Date(sale.sale_date), 'dd MMM yyyy')}</span>
                                            </div>
                                            <h3 className="text-lg font-black text-foreground flex items-center gap-2 mt-1">
                                                <User className="h-4 w-4 text-primary/50 flex-shrink-0" />
                                                {sale.party_name}
                                            </h3>
                                            <p className="text-sm font-bold text-muted-foreground flex items-center gap-1.5">
                                                <Layers className="h-3.5 w-3.5" />
                                                {sale.quality_label}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6 flex-grow max-w-sm">
                                            <div>
                                                <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wider">Pending Meters</p>
                                                <p className="text-base font-black tabular-nums text-foreground">
                                                    {(sale.pending_dispatch_meters ?? sale.meters_sold).toFixed(2)}
                                                    <span className="text-xs ml-1 font-bold text-muted-foreground">m</span>
                                                </p>
                                                {(sale.dispatched_meters ?? 0) > 0 && (
                                                    <p className="text-[10px] font-bold text-muted-foreground/60 mt-0.5">
                                                        Of {sale.meters_sold.toFixed(2)} m total
                                                    </p>
                                                )}
                                            </div>
                                            <div className="hidden">
                                                <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wider">Taka Count</p>
                                                <p className="text-base font-black tabular-nums text-foreground">
                                                    {sale.taka_sold ? sale.taka_sold.toFixed(0) : '-'}
                                                    <span className="text-xs ml-1 font-bold text-muted-foreground"> {sale.unit_label}</span>
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wider">Credit Days</p>
                                                <p className="text-base font-black tabular-nums text-amber-600">
                                                    {sale.credit_days}
                                                    <span className="text-xs ml-1 font-bold opacity-60">days</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 flex-wrap lg:min-w-[340px] lg:justify-end">
                                            <Button
                                                onClick={() => {
                                                    setConfirmingSale(sale)
                                                    setConfirmMode('dispatch')
                                                    setDispatchDate(todayDate())
                                                    setTransportName('')
                                                    setVehicleNumber('')
                                                    setChallanNumber('')
                                                    const pendingMeters = sale.pending_dispatch_meters ?? sale.meters_sold
                                                    setDispatchMeters(String(pendingMeters))
                                                    const avgMetersPerTaka = sale.meters_sold / (sale.taka_sold || 1)
                                                    const estimatedPendingTakas = Math.max(1, Math.round(pendingMeters / (avgMetersPerTaka || 1)))
                                                    setDispatchTakas(String(estimatedPendingTakas))
                                                    setDispatchNotes('')
                                                }}
                                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2 shrink-0 h-10 px-4 rounded-xl shadow-md transition-all active:scale-95 text-xs"
                                            >
                                                <Truck className="h-4 w-4" />
                                                Confirm Dispatch
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        ))
                    ) : (
                        <div className="py-20 text-center space-y-4">
                            <div className="inline-flex p-6 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                                <CheckCircle2 className="h-10 w-10 text-muted-foreground/30" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-foreground">No pending dispatches</h3>
                                <p className="text-muted-foreground font-medium max-w-xs mx-auto">
                                    All stock sales are fully dispatched.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid gap-4">
                    <AnimatePresence mode="popLayout">
                        {filteredGroups.length > 0 ? (
                            filteredGroups.map(group => (
                                <OrderGroupCard
                                    key={group.orderId}
                                    group={group}
                                    statusFilter={statusFilter}
                                    onOwnerReceiptConfirmed={handleOwnerReceiptConfirmed}
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
                                    <p className="text-muted-foreground font-medium max-w-xs mx-auto">
                                        {dispatches.length === 0
                                            ? 'Create a dispatch from an active order to generate a professional challan.'
                                            : 'Try adjusting your search or filters.'}
                                    </p>
                                    {dispatches.length === 0 && (
                                        <div className="pt-3">
                                            <Button variant="outline" asChild>
                                                <Link href="/owner/orders">Open Orders</Link>
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
            {/* Global Dispatch Modal Flow */}
            <GlobalDispatchModal 
                step={globalModalStep} 
                onClose={() => {
                    setGlobalModalStep('idle')
                    setSelectedOrder(null)
                    setDispatchSummary(null)
                }}
                onOrderSelected={(order) => {
                    setSelectedOrder(order)
                    handleFetchSummary(order.id)
                }}
                dispatchSummary={dispatchSummary}
                selectedOrder={selectedOrder}
                onDispatchCreated={(dispatch, trackingToken) => {
                    if (!selectedOrder) return
                    setDispatches((prev) => [
                        {
                            ...dispatch,
                            orders: {
                                id: selectedOrder.id,
                                party_name: selectedOrder.party_name,
                                quality_label: selectedOrder.quality_label,
                                tracking_token: trackingToken,
                                total_target_meters: selectedOrder.total_target_meters,
                                status: selectedOrder.status,
                            },
                        },
                        ...prev,
                    ])
                    setOverview((prev) => ({
                        ...prev,
                        pending_sales_count: Math.max(0, prev.pending_sales_count - dispatch.package_lines.length),
                        pending_dispatch_meters: Math.max(0, prev.pending_dispatch_meters - Number(dispatch.qty_meters_sent ?? 0)),
                        pending_dispatch_value: Math.max(0, prev.pending_dispatch_value - Number(dispatch.taxable_value ?? 0)),
                    }))
                }}
            />
            {sellAndDispatchOpen && (
                <SellAndDispatchDialog
                    open={sellAndDispatchOpen}
                    onOpenChange={setSellAndDispatchOpen}
                    onSuccess={(dispatchId) => {
                        setSellAndDispatchOpen(false)
                    }}
                />
            )}
            {confirmingSale && (
                <Dialog open={confirmingSale !== null} onOpenChange={(v) => { if (!v) { setConfirmingSale(null); setConfirmMode(null); } }}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Truck className="h-5 w-5 text-indigo-600" />
                                Confirm Dispatch
                            </DialogTitle>
                            <DialogDescription>
                                Confirm dispatch details for sale to <strong>{confirmingSale.party_name}</strong>.
                                Based on the dispatch date, the credit days of {confirmingSale.credit_days} days will start.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-700">Dispatch Date</Label>
                                <Input
                                    type="date"
                                    value={dispatchDate}
                                    onChange={(e) => setDispatchDate(e.target.value)}
                                    className="h-11 border-slate-200"
                                />
                            </div>
                            <div className="grid gap-3 grid-cols-2">
                                <div className="space-y-1.5 col-span-2">
                                    <Label className="text-xs font-semibold text-slate-700">Meters to Dispatch</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={dispatchMeters}
                                        onChange={(e) => {
                                            const val = e.target.value
                                            setDispatchMeters(val)
                                            const metersVal = Number(val) || 0
                                            const avgMetersPerTaka = confirmingSale.meters_sold / (confirmingSale.taka_sold || 1)
                                            const calculatedTakas = Math.max(1, Math.round(metersVal / (avgMetersPerTaka || 1)))
                                            setDispatchTakas(String(calculatedTakas))
                                        }}
                                        placeholder="e.g. 200"
                                        className="h-11 border-slate-200"
                                    />
                                    <span className="text-[10px] text-slate-500 font-medium">
                                        Remaining: {(confirmingSale.pending_dispatch_meters ?? confirmingSale.meters_sold).toFixed(2)} m
                                    </span>
                                </div>
                                <div className="hidden">
                                    <Label className="text-xs font-semibold text-slate-700">
                                        {confirmingSale.unit_label.charAt(0).toUpperCase() + confirmingSale.unit_label.slice(1)}s to Dispatch
                                    </Label>
                                    <Input
                                        type="number"
                                        step="1"
                                        min="0"
                                        value={dispatchTakas}
                                        onChange={(e) => setDispatchTakas(e.target.value)}
                                        placeholder="e.g. 4"
                                        className="h-11 border-slate-200"
                                    />
                                    <span className="text-[10px] text-slate-500 font-medium">
                                        Total sold: {confirmingSale.taka_sold} {confirmingSale.unit_label}s
                                    </span>
                                </div>
                            </div>
                            <div className="grid gap-3 grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-700">Transport</Label>
                                    <Input
                                        value={transportName}
                                        onChange={(e) => setTransportName(e.target.value)}
                                        placeholder="e.g. VRL"
                                        className="h-11 border-slate-200"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-700">Vehicle No.</Label>
                                    <Input
                                        value={vehicleNumber}
                                        onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                                        placeholder="e.g. MH04GP1234"
                                        className="h-11 border-slate-200"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-700">Challan Number</Label>
                                <Input
                                    value={challanNumber}
                                    onChange={(e) => setChallanNumber(e.target.value)}
                                    placeholder="e.g. CH-2342"
                                    className="h-11 border-slate-200"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-700">Notes</Label>
                                <Input
                                    value={dispatchNotes}
                                    onChange={(e) => setDispatchNotes(e.target.value)}
                                    placeholder="Optional notes"
                                    className="h-11 border-slate-200"
                                />
                            </div>
                        </div>
                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => { setConfirmingSale(null); setConfirmMode(null); }} disabled={confirmPending}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleConfirmDispatch}
                                disabled={confirmPending || !dispatchDate || !dispatchMeters}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2"
                            >
                                {confirmPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                                {confirmPending ? 'Confirming...' : 'Confirm Dispatch'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    )
}

function GlobalDispatchModal({
    step,
    onClose,
    onOrderSelected,
    dispatchSummary,
    selectedOrder,
    onDispatchCreated,
}: {
    step: 'idle' | 'select_order' | 'loading_summary' | 'create_dispatch'
    onClose: () => void
    onOrderSelected: (order: OrderSummary) => void
    dispatchSummary: DispatchSummary | null
    selectedOrder: OrderSummary | null
    onDispatchCreated: (dispatch: DispatchRow, trackingToken: string) => void
}) {
    const [orders, setOrders] = useState<OrderSummary[]>([])
    const [loadingOrders, setLoadingOrders] = useState(false)

    // Load active orders when step is select_order
    useEffect(() => {
        if (step === 'select_order') {
            setLoadingOrders(true)
            getActiveOrders().then(res => {
                if (res.data) setOrders(res.data)
                setLoadingOrders(false)
            })
        }
    }, [step])

    if (step === 'idle') return null

    return (
        <>
            {/* Step 1: Select Order */}
            <Dialog open={step === 'select_order'} onOpenChange={(v) => !v && onClose()}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Truck className="h-5 w-5 text-indigo-600" /> New Dispatch
                        </DialogTitle>
                        <DialogDescription>
                            Which order/party are you dispatching for?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700">Select Order</Label>
                            {loadingOrders ? (
                                <div className="flex items-center gap-2 py-2 text-slate-400">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-xs">Loading active orders...</span>
                                </div>
                            ) : orders.length === 0 ? (
                                <p className="text-xs text-rose-500 font-medium bg-rose-50 p-3 rounded-lg border border-rose-100">
                                    No active orders found. You can only dispatch for active orders.
                                </p>
                            ) : (
                                <Select onValueChange={(val) => {
                                    const order = orders.find(o => o.id === val)
                                    if (order) onOrderSelected(order)
                                }}>
                                    <SelectTrigger className="h-11 border-slate-200">
                                        <SelectValue placeholder="Choose order..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {orders.map(order => (
                                            <SelectItem key={order.id} value={order.id}>
                                                <div className="flex flex-col text-left">
                                                    <span className="font-bold">{order.party_name}</span>
                                                    <span className="text-[10px] opacity-60 uppercase font-mono">{order.quality_label || 'Unnamed Quality'}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Step 2: Loading Summary */}
            <Dialog open={step === 'loading_summary'} onOpenChange={() => {}}>
                <DialogContent className="max-w-sm text-center py-10">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Fetching pending stock dispatches</DialogTitle>
                        <DialogDescription>Loading sold stock that is pending dispatch.</DialogDescription>
                    </DialogHeader>
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mx-auto mb-4" />
                    <p className="text-sm font-bold text-slate-600">Fetching sold stock pending dispatch...</p>
                </DialogContent>
            </Dialog>

            {/* Step 3: Create Dispatch (Shared Modal) */}
            {step === 'create_dispatch' && selectedOrder && dispatchSummary && (
                <CreateDispatchModal 
                    orderId={selectedOrder.id}
                    availablePackages={dispatchSummary.available_packages}
                    onClose={onClose}
                    onCreated={async (dispatch, trackingToken, partyName, orgName) => {
                        // Handle invoice/challan PDF generation (reusing the logic from OrdersClient)
                        try {
                            const { generateChallan } = await import('@/lib/generate-challan')
                            await generateChallan({
                                org_name: orgName || 'Factory',
                                party_name: partyName || selectedOrder.party_name,
                                quality_label: selectedOrder.quality_label || null,
                                dispatch_number: dispatch.dispatch_number,
                                qty_meters_sent: Number(dispatch.qty_meters_sent),
                                total_target_meters: Number(selectedOrder.total_target_meters || 0),
                                package_lines: dispatch.package_lines.map((line) => ({
                                    package_no: line.package_no,
                                    package_type: line.package_type,
                                    units_count: line.units_count,
                                    grade: line.grade,
                                    metres: Number(line.qty_meters_sent),
                                })),
                                notes: dispatch.notes,
                                eway_bill_number: dispatch.eway_bill_number,
                                eway_bill_required: dispatch.eway_bill_required,
                                vehicle_number: dispatch.vehicle_number,
                                transporter_name: dispatch.transporter_name,
                                transporter_id: dispatch.transporter_id,
                                approximate_distance_km: dispatch.approximate_distance_km,
                                eway_bill_generated_at: dispatch.eway_bill_generated_at,
                                hsn_code: dispatch.hsn_code,
                                taxable_value: dispatch.taxable_value,
                                gst_percent: dispatch.gst_percent,
                                cgst_amount: dispatch.cgst_amount,
                                sgst_amount: dispatch.sgst_amount,
                                igst_amount: dispatch.igst_amount,
                                total_invoice_value: dispatch.total_invoice_value,
                                dispatched_at: dispatch.dispatched_at,
                                tracking_token: trackingToken,
                            })
                        } catch {
                            toast.error('Failed to generate invoice PDF')
                        }
                        onDispatchCreated(dispatch, trackingToken)
                        onClose()
                        // Next.js will revalidate the path via the server action
                    }}
                />
            )}
        </>
    )
}
