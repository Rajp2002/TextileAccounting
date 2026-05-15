'use client'

import { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Plus,
    Loader2,
    Package,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Calendar,
    Target,
    MoreVertical,
    Ban,
    ChevronRight,
    X,
    Server,
    Calculator,
    TrendingUp,
    ArrowUpRight,
    Pencil,
    Check,
    CircleDollarSign,
    KeyRound,
    Lock,
    RefreshCw,
    Send,
    QrCode,
    Copy,
    Truck,
    Archive,
} from 'lucide-react'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from '@/components/ui/sheet'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { format, differenceInDays, addDays } from 'date-fns'
import {
    getOrdersWithProgress,
    updateOrderStatus,
    deleteOrder,
    getOrderWithQuote,
    assignMachinesToOrder,
    updateOrderDetails,
    requestAccessCodeAsOwner,
    getDispatchesForOrder,
    createDispatch,
    getTrackingToken,
    type DispatchRow,
    type DispatchSummary,
    type AvailableFabricPackage,
} from './actions'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { QRCodeSVG } from 'qrcode.react'
import { CostAnalysisDetails } from '@/components/cost-analysis-details'

// ─── Utility helpers ─────────────────────────────────────────────────────────

function paceColor(paceIndex: number | null) {
    if (paceIndex === null) return 'text-slate-400'
    if (paceIndex >= 1.0) return 'text-emerald-400'
    if (paceIndex >= 0.7) return 'text-amber-400'
    return 'text-rose-400'
}

function progressBarColor(pct: number) {
    if (pct >= 80) return 'bg-emerald-500'
    if (pct >= 50) return 'bg-amber-500'
    return 'bg-rose-500'
}

function daysLabel(daysRemaining: number) {
    if (daysRemaining < 0) return { text: `${Math.abs(daysRemaining)}d overdue`, cls: 'text-rose-400' }
    if (daysRemaining === 0) return { text: 'Due today', cls: 'text-amber-400' }
    if (daysRemaining <= 3) return { text: `${daysRemaining}d left`, cls: 'text-amber-400' }
    return { text: `${daysRemaining}d left`, cls: 'text-slate-400' }
}

// ─── Machine Assign Inline ───────────────────────────────────────────────────

function MachineAssignInline({
    orderId,
    currentMachineIds,
    allMachines,
    onSuccess,
}: {
    orderId: string
    currentMachineIds: string[]
    allMachines: Array<{ id: string; name: string; current_order_id: string | null }>
    onSuccess: () => void
}) {
    const { t } = useTranslation()
    const [selected, setSelected] = useState<Set<string>>(new Set(currentMachineIds))
    const [saving, setSaving] = useState(false)
    const changed = JSON.stringify(Array.from(selected).sort()) !== JSON.stringify([...currentMachineIds].sort())

    const toggle = (id: string) => {
        const next = new Set(selected)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelected(next)
    }

    const handleSave = async () => {
        setSaving(true)
        const res = await assignMachinesToOrder(orderId, Array.from(selected))
        setSaving(false)
        if (res.success) {
            toast.success(t('orders_page.machines_updated'))
            onSuccess()
        } else {
            toast.error(res.error ?? t('orders_page.failed_to_update'))
        }
    }

    if (allMachines.length === 0) {
        return (
            <p className="text-xs text-slate-500 italic py-2">
                {t('orders_page.no_active_machines')}{' '}
                <a href="/owner/machines" className="text-indigo-400 underline">{t('orders_page.machine_mgmt')}</a>.
            </p>
        )
    }

    return (
        <div className="space-y-2">
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {allMachines.map((m: any) => {
                    const isSelected = selected.has(m.id)
                    const linkedToOther = m.current_order_id && 
                                        m.current_order_id !== orderId && 
                                        m.linked_order?.status === 'active'
                    return (
                        <div
                            key={m.id}
                            onClick={() => toggle(m.id)}
                            className={cn(
                                'flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                                isSelected
                                    ? 'border-primary bg-primary/10'
                                    : 'border-slate-200 bg-slate-50 hover:border-slate-300',
                                linkedToOther && !isSelected && 'opacity-60 grayscale-[0.5]'
                            )}
                        >
                            <div className={cn(
                                'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                                isSelected ? 'bg-primary border-primary' : 'border-slate-300'
                            )}>
                                {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">{m.name}</p>
                                {linkedToOther && (
                                    <p className="text-xs text-amber-600 font-medium">{t('orders_page.on_another_order')}</p>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
            {changed && (
                <Button
                    size="sm"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    {t('orders_page.save_assignment')}
                </Button>
            )}
        </div>
    )
}

// ─── Cost Breakdown (from linked estimator quote) ─────────────────────────────

function QuoteCostBreakdown({ quote, targetMeters }: { quote: Record<string, unknown>; targetMeters: number }) {
    return (
        <CostAnalysisDetails quote={quote} targetMeters={targetMeters} title="Estimator Cost Stack" />
    )
}

// ─── Dispatch Bridge Components ──────────────────────────────────────────────

/**
 * Single dispatch card for the Weaver's internal Order Detail drawer.
 * Shows sent/received meters, status badge, and a re-print invoice button.
 */
function DispatchItemRow({
    dispatch,
    onReprint,
}: {
    dispatch: DispatchRow
    onReprint: (d: DispatchRow) => void
}) {
    const isDelivered = dispatch.status === 'delivered'
    const isInTransit = dispatch.status === 'in_transit'

    return (
        <div className={cn(
            'border rounded-xl p-3 space-y-2 transition-all',
            isDelivered ? 'bg-emerald-50 border-emerald-200' :
            isInTransit ? 'bg-amber-50/60 border-amber-200' :
            'bg-slate-50 border-slate-200'
        )}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    {isDelivered
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        : <Truck className="h-4 w-4 text-amber-600 shrink-0" />}
                    <div>
                        <p className="text-sm font-black text-slate-900">
                            Batch #{dispatch.dispatch_number}
                        </p>
                        <p className="text-xs text-slate-500 font-mono">
                            {format(new Date(dispatch.dispatched_at), 'dd MMM yyyy')}
                        </p>
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-xs font-bold font-mono text-slate-900">
                        {Number(dispatch.qty_meters_sent).toFixed(2)} m sent
                    </p>
                    {isDelivered && dispatch.qty_meters_received !== null && (
                        <p className="text-xs font-mono text-emerald-700 font-semibold">
                            {Number(dispatch.qty_meters_received).toFixed(2)} m received
                        </p>
                    )}
                    {isInTransit && (
                        <p className="text-xs text-amber-600 font-semibold">In Transit</p>
                    )}
                </div>
            </div>
            {dispatch.package_lines.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {dispatch.package_lines.map((line) => (
                        <Badge key={line.id} variant="outline" className="bg-white/70 text-xs font-bold text-slate-700">
                            {line.package_no} · {Number(line.qty_meters_sent).toFixed(0)}m
                        </Badge>
                    ))}
                </div>
            )}
            <button
                onClick={() => onReprint(dispatch)}
                className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-colors"
            >
                <QrCode className="h-3 w-3" /> Re-print Invoice
            </button>
        </div>
    )
}

/**
 * Dispatch section panel — shown inside the Order Detail drawer.
 * Shows the dispatch list, shortage row, and Create Dispatch + Share buttons.
 */
function DispatchSection({
    orderId,
    isCompleted,
    totalTargetMeters,
    onReprintChallan,
}: {
    orderId: string
    isCompleted: boolean
    totalTargetMeters: number
    onReprintChallan: (dispatch: DispatchRow, trackingToken: string, partyName: string, orgName: string, totalTarget: number) => void
}) {
    const [summary, setSummary] = useState<DispatchSummary | null>(null)
    const [loadingDispatches, setLoadingDispatches] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showShareModal, setShowShareModal] = useState(false)
    const [trackingToken, setTrackingToken] = useState<string | null>(null)
    const [trackingUrl, setTrackingUrl] = useState<string | null>(null)

    const loadDispatches = useCallback(async () => {
        const res = await getDispatchesForOrder(orderId)
        if (!('error' in res)) {
            setSummary(res)
        }
        setLoadingDispatches(false)
    }, [orderId])

    useEffect(() => {
        const timer = setTimeout(() => {
            void loadDispatches()
        }, 0)
        return () => clearTimeout(timer)
    }, [loadDispatches])

    // Realtime subscription — refreshes when Trader confirms receipt
    useEffect(() => {
        const supabase = createClient()
        const channel = supabase
            .channel(`dispatches:order:${orderId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'dispatches',
                filter: `order_id=eq.${orderId}`,
            }, () => {
                loadDispatches()
            })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [orderId, loadDispatches])

    const handleOpenShare = async () => {
        if (trackingToken && trackingUrl) { setShowShareModal(true); return }
        const res = await getTrackingToken(orderId)
        if ('error' in res) { toast.error(res.error); return }
        
        const token = (res as any).tracking_token
        const url = `${window.location.origin}/track/${token}`
        
        setTrackingToken(token)
        setTrackingUrl(url)
        setShowShareModal(true)
    }

    const handleDispatchCreated = async (newDispatch: DispatchRow, token: string, partyName: string, orgName: string) => {
        await loadDispatches()
        setShowCreateModal(false)
        // Trigger invoice/challan PDF (client-side)
        onReprintChallan(newDispatch, token, partyName, orgName, totalTargetMeters)
    }

    if (loadingDispatches) {
        return (
            <div className="flex items-center gap-2 py-4 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Loading dispatches…</span>
            </div>
        )
    }

    const hasShortage = summary && summary.shortage_meters > 0.01

    return (
        <div className="space-y-3">
            {/* Action buttons */}
            {!isCompleted && (
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2 text-xs"
                        onClick={() => setShowCreateModal(true)}
                        disabled={(summary?.available_packages.length ?? 0) <= 0}
                    >
                        <Send className="h-3.5 w-3.5" />
                        Dispatch Batch
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50 font-bold gap-2 text-xs"
                        onClick={handleOpenShare}
                    >
                        <QrCode className="h-3.5 w-3.5" />
                        Share Link
                    </Button>
                </div>
            )}

            {/* Remaining to dispatch hint */}
            {!isCompleted && summary && (
                <div className="space-y-1 text-xs text-slate-500 font-mono">
                    <p>
                        {summary.remaining_to_dispatch.toFixed(2)} m packed and available across {summary.available_packages.length} package{summary.available_packages.length !== 1 ? 's' : ''}
                    </p>
                    {summary.packages_waiting_inspection_meters > 0 && (
                        <p>{summary.packages_waiting_inspection_meters.toFixed(2)} m still waiting for inspection</p>
                    )}
                </div>
            )}

            {/* Share button for completed orders */}
            {isCompleted && (
                <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-slate-200 text-slate-700 hover:bg-slate-50 font-bold gap-2 text-xs"
                    onClick={handleOpenShare}
                >
                    <QrCode className="h-3.5 w-3.5" />
                    Share Tracking Link
                </Button>
            )}

            {/* Dispatch list */}
            {summary && summary.dispatches.length > 0 ? (
                <div className="space-y-2">
                    {summary.dispatches.map(d => (
                        <DispatchItemRow
                            key={d.id}
                            dispatch={d}
                            onReprint={(dispatch) => {
                                if (trackingToken) {
                                    onReprintChallan(dispatch, trackingToken, '', '', 0)
                                } else {
                                    getTrackingToken(orderId).then(res => {
                                        if (!('error' in res)) {
                                            setTrackingToken(res.tracking_token)
                                            onReprintChallan(dispatch, res.tracking_token, '', '', 0)
                                        }
                                    })
                                }
                            }}
                        />
                    ))}

                    {/* Shortage row — Weaver only, never on public portal */}
                    {hasShortage && (
                        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
                            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                            <div className="min-w-0">
                                <p className="text-xs font-black text-rose-700">
                                    Shortage: {summary.shortage_meters.toFixed(2)} m
                                </p>
                                <p className="text-xs text-rose-500">
                                    Sent {summary.total_sent.toFixed(2)} m · Received {summary.total_received.toFixed(2)} m
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Summary row */}
                    <div className="flex justify-between text-xs font-mono text-slate-500 px-1 pt-1 border-t border-slate-100">
                        <span>Total sent: {summary.total_sent.toFixed(2)} m</span>
                        {summary.total_received > 0 && (
                            <span className="text-emerald-600">Received: {summary.total_received.toFixed(2)} m</span>
                        )}
                    </div>
                </div>
            ) : (
                <div className="border border-dashed border-slate-300 rounded-xl p-5 text-center">
                    <Truck className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-medium">No dispatches yet</p>
                    {!isCompleted && (
                        <p className="text-xs text-slate-400 mt-1">
                            {(summary?.remaining_to_dispatch ?? 0) > 0
                                ? `${summary?.remaining_to_dispatch.toFixed(2)} m ready in packed stock`
                                : 'Create or inspect packages in Stock before dispatching'}
                        </p>
                    )}
                </div>
            )}

            {/* Create Dispatch Modal */}
            {showCreateModal && summary && (
                <CreateDispatchModal
                    orderId={orderId}
                    availablePackages={summary.available_packages}
                    onClose={() => setShowCreateModal(false)}
                    onCreated={handleDispatchCreated}
                />
            )}

            {/* Share Modal */}
            {showShareModal && trackingUrl && (
                <ShareTrackingModal
                    trackingUrl={trackingUrl}
                    trackingToken={trackingToken ?? ''}
                    onClose={() => setShowShareModal(false)}
                />
            )}
        </div>
    )
}

import { CreateDispatchModal, ShareTrackingModal } from '@/components/dispatches/DispatchModals'



// ─── Order Detail Drawer ─────────────────────────────────────────────────────

// ─── Access Code Dialog for Owner Edits ──────────────────────────────────────

function OwnerAccessCodeDialog({
    open,
    onClose,
    onVerified,
    actionLabel,
}: {
    open: boolean
    onClose: () => void
    onVerified: (code: string) => void
    actionLabel: string
}) {
    const [code, setCode] = useState('')
    const [generatingCode, setGeneratingCode] = useState(false)
    const [generatedCode, setGeneratedCode] = useState<string | null>(null)

    const handleGenerateCode = async () => {
        setGeneratingCode(true)
        const res = await requestAccessCodeAsOwner()
        setGeneratingCode(false)
        if ('error' in res && res.error) {
            toast.error(res.error)
        } else if (res.code) {
            setGeneratedCode(res.code)
            setCode(res.code) // auto-fill the input
        }
    }

    const handleClose = () => {
        setCode('')
        setGeneratedCode(null)
        onClose()
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-600">
                        <KeyRound className="h-5 w-5" /> Owner Authorisation Required
                    </DialogTitle>
                    <DialogDescription>
                        Generate a one-time access code to {actionLabel}. The code expires in 15 minutes.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <Button
                        variant="outline"
                        className="w-full gap-2 border-amber-200 text-amber-700 hover:bg-amber-50"
                        onClick={handleGenerateCode}
                        disabled={generatingCode}
                    >
                        {generatingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        {generatedCode ? 'Regenerate Code' : 'Generate Access Code'}
                    </Button>

                    {generatedCode && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center space-y-1">
                            <p className="text-xs uppercase tracking-widest text-amber-600 font-bold">Your Access Code</p>
                            <p className="text-3xl font-black font-mono tracking-[0.3em] text-amber-700">{generatedCode}</p>
                            <p className="text-xs text-amber-500">Valid for 15 minutes · Single use</p>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label className="text-xs text-slate-600 font-semibold">Enter Access Code</Label>
                        <Input
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                            placeholder="XXXXXX"
                            className="font-mono uppercase tracking-widest text-lg text-center h-12 border-slate-200"
                            maxLength={6}
                        />
                    </div>
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={handleClose}>Cancel</Button>
                    <Button
                        disabled={code.length < 6}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                        onClick={() => { onVerified(code); handleClose() }}
                    >
                        <Check className="h-4 w-4 mr-2" /> Confirm
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ─── Order Detail Drawer ─────────────────────────────────────────────────────

function OrderDetailDrawer({
    orderId,
    open,
    onClose,
    onRefresh,
}: {
    orderId: string | null
    open: boolean
    onClose: () => void
    onRefresh: () => void
}) {
    const { t } = useTranslation()
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [editingDeadline, setEditingDeadline] = useState(false)
    const [deadlineVal, setDeadlineVal] = useState('')
    const [editingTarget, setEditingTarget] = useState(false)
    const [targetVal, setTargetVal] = useState('')
    const [savingEdit, setSavingEdit] = useState(false)

    // Access code dialog state
    const [codeDialogOpen, setCodeDialogOpen] = useState(false)
    const [codeDialogAction, setCodeDialogAction] = useState<'target' | 'deadline'>('target')

    const load = useCallback(async () => {
        if (!orderId) return
        setLoading(true)
        const res = await getOrderWithQuote(orderId)
        setLoading(false)
        if ('error' in res) {
            toast.error(res.error)
            return
        }
        setData(res)
        setDeadlineVal(res.order?.deadline ?? '')
        setTargetVal(String(res.order?.total_target_meters ?? ''))
    }, [orderId])

    useEffect(() => {
        if (open && orderId) load()
        else setData(null)
    }, [open, orderId, load])

    const handleComplete = async () => {
        if (!orderId) return
        const res = await updateOrderStatus(orderId, 'completed')
        if (res.success) { toast.success('Order marked complete'); onClose(); onRefresh() }
        else toast.error(res.error ?? 'Failed to update')
    }

    const handleCancel = async () => {
        if (!orderId) return
        const res = await deleteOrder(orderId)
        if (res.success) { toast.success('Order cancelled'); onClose(); onRefresh() }
        else toast.error(res.error ?? 'Failed to cancel')
    }

    /** Called after the access-code dialog resolves with a valid code */
    const handleCodeVerified = async (accessCode: string) => {
        if (!orderId) return
        if (codeDialogAction === 'deadline') {
            await doSaveDeadline(accessCode)
        } else {
            await doSaveTarget(accessCode)
        }
    }

    const handleSaveDeadline = () => {
        setCodeDialogAction('deadline')
        setCodeDialogOpen(true)
    }

    const doSaveDeadline = async (accessCode: string) => {
        if (!orderId) return
        setSavingEdit(true)
        const res = await updateOrderDetails(orderId, { deadline: deadlineVal }, accessCode)
        setSavingEdit(false)
        if (res.success) {
            toast.success('Deadline updated')
            setEditingDeadline(false)
            load()
        } else {
            toast.error(res.error ?? 'Failed to update')
        }
    }

    const handleSaveTarget = () => {
        setCodeDialogAction('target')
        setCodeDialogOpen(true)
    }

    const doSaveTarget = async (accessCode: string) => {
        if (!orderId) return
        const t = Number(targetVal)
        if (!t || t <= 0) { toast.error('Invalid target'); return }
        setSavingEdit(true)
        const res = await updateOrderDetails(orderId, { total_target_meters: t }, accessCode)
        setSavingEdit(false)
        if (res.success) {
            if ((res as any).reactivated) {
                toast.success('Target updated · Order reactivated — machines can now be reassigned')
            } else {
                toast.success('Target updated')
            }
            setEditingTarget(false)
            load()
            onRefresh()
        } else {
            toast.error(res.error ?? 'Failed to update')
        }
    }

    const order    = data?.order
    const quote    = data?.quote
    const machines = data?.machines ?? []
    const isCompleted = order?.status === 'completed'

    const progress = Number(order?.progress_percent ?? 0)
    const daysRemaining = order ? differenceInDays(new Date(order.deadline), new Date()) : 0
    const { text: daysText, cls: daysCls } = daysLabel(daysRemaining)
    const metersProduced = Number(order?.total_meters_produced ?? 0)
    const target = Number(order?.total_target_meters ?? 0)
    const paceIndex = order?.pace_index ? Number(order.pace_index) : null
    const currentMachineIds: string[] = machines
        .filter((m: any) => m.current_order_id === orderId)
        .map((m: any) => m.id)

    return (
        <>
            <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-md bg-card border-l border-border text-slate-900 flex flex-col"
            >
                {loading || !order ? (
                    <div className="flex-1 flex items-center justify-center">
                        {loading
                            ? <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                            : <p className="text-slate-500">No data</p>
                        }
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="px-5 pt-5 pb-4 border-b border-border space-y-1 shrink-0 pt-safe">
                            <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-black text-lg text-slate-900 leading-tight truncate">
                                            {order.display_quality_name ?? order.quality_label ?? 'Unnamed'}
                                        </p>
                                        <p className="text-sm text-slate-500 truncate">{order.party_name}</p>
                                    </div>
                                </div>

                            {/* Warp / Weft spec badges */}
                            {(order.warp_instruction || order.weft_instruction) && (
                                <div className="flex gap-2 flex-wrap pt-1">
                                    {order.warp_instruction && (
                                        <span className="text-xs bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-full font-mono">
                                            Warp: {order.warp_instruction}
                                        </span>
                                    )}
                                    {order.weft_instruction && (
                                        <span className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full font-mono">
                                            Weft: {order.weft_instruction}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Scrollable body */}
                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

                            {/* Progress */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-mono font-bold text-slate-900">
                                        {metersProduced.toLocaleString('en-IN')}m
                                        <span className="text-slate-500"> / {target.toLocaleString('en-IN')}m</span>
                                    </span>
                                    <span className={`font-bold ${daysCls}`}>{daysText}</span>
                                </div>
                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${progressBarColor(progress)}`}
                                        style={{ width: `${Math.min(100, progress)}%` }}
                                    />
                                </div>
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span>{progress.toFixed(1)}% complete</span>
                                    {metersProduced === 0 ? (
                                        <span className="text-xs font-medium text-slate-400">
                                            {t('analytics.orders.card.tracking_starts')}
                                        </span>
                                    ) : paceIndex !== null && (
                                        <span className={`font-mono font-bold flex items-center gap-1 ${paceColor(paceIndex)}`}>
                                            ⚡ {paceIndex.toFixed(2)}× pace
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Order details — editable */}
                            <div className="space-y-2">
                                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1.5">
                                    <Target className="h-3 w-3" /> Order Details
                                </p>

                                {/* Target Meters */}
                                <div className={cn("border rounded-xl p-3 flex items-center justify-between gap-2", isCompleted ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200")}>
                                    <div className="min-w-0">
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5">Target Meters</p>
                                        {editingTarget ? (
                                            <div className="flex items-center gap-2 mt-1">
                                                <Input
                                                    type="number"
                                                    value={targetVal}
                                                    onChange={e => setTargetVal(e.target.value)}
                                                    className="h-11 lg:h-7 w-28 text-xs font-mono bg-white border-slate-200 text-slate-900"
                                                    autoFocus
                                                    min={Number(order?.total_meters_produced ?? 0) + 1}
                                                />
                                                <button onClick={handleSaveTarget} disabled={savingEdit} className="flex items-center justify-center h-11 w-11 lg:h-7 lg:w-7 text-emerald-500 hover:text-emerald-600" aria-label="Save target">
                                                    {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                </button>
                                                <button onClick={() => setEditingTarget(false)} className="flex items-center justify-center h-11 w-11 lg:h-7 lg:w-7 text-slate-400 hover:text-slate-900" aria-label="Cancel edit">
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-base font-black font-mono text-slate-900">
                                                {target.toLocaleString('en-IN')} m
                                            </p>
                                        )}
                                        {isCompleted && !editingTarget && (
                                            <p className="text-xs text-emerald-600 font-medium mt-0.5">Increase to reactivate order</p>
                                        )}
                                    </div>
                                    {!editingTarget && (
                                        <button
                                            onClick={() => setEditingTarget(true)}
                                            className="flex items-center justify-center h-11 w-11 lg:h-7 lg:w-7 text-slate-400 hover:text-amber-500 transition-colors"
                                            title="Requires access code"
                                            aria-label="Edit target"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Deadline */}
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                            <Calendar className="h-3 w-3" /> Deadline
                                        </p>
                                        {editingDeadline ? (
                                            <div className="flex items-center gap-2 mt-1">
                                                <Input
                                                    type="date"
                                                    value={deadlineVal}
                                                    onChange={e => setDeadlineVal(e.target.value)}
                                                    className="h-11 lg:h-7 text-xs bg-white border-slate-200 text-slate-900"
                                                    autoFocus
                                                />
                                                <button onClick={handleSaveDeadline} disabled={savingEdit} className="flex items-center justify-center h-11 w-11 lg:h-7 lg:w-7 text-emerald-500 hover:text-emerald-600" aria-label="Save deadline">
                                                    {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                </button>
                                                <button onClick={() => setEditingDeadline(false)} className="flex items-center justify-center h-11 w-11 lg:h-7 lg:w-7 text-slate-400 hover:text-slate-900" aria-label="Cancel edit">
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-base font-black font-mono text-slate-900">
                                                {format(new Date(order.deadline), 'dd MMM yyyy')}
                                            </p>
                                        )}
                                    </div>
                                    {!editingDeadline && (
                                        <button
                                            onClick={() => setEditingDeadline(true)}
                                            className="flex items-center justify-center h-11 w-11 lg:h-7 lg:w-7 text-slate-400 hover:text-amber-500 transition-colors"
                                            title="Requires access code"
                                            aria-label="Edit deadline"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Worker Wage (Snapshot) */}
                                {order.worker_rate_per_m !== null && (
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                                <CircleDollarSign className="h-3 w-3" /> Worker Wage
                                            </p>
                                            <p className="text-base font-black font-mono text-slate-900">
                                                ₹{Number(order.worker_rate_per_m).toFixed(2)} /m
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Dispatch Bridge Section */}
                            <div className="space-y-2">
                                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1.5">
                                    <Truck className="h-3 w-3" /> Dispatches
                                </p>
                                <DispatchSection
                                    orderId={order.order_id}
                                    isCompleted={isCompleted}
                                    totalTargetMeters={Number(order.total_target_meters || 0)}
                                    onReprintChallan={async (dispatch, trackingToken, partyName, orgName, totalTarget) => {
                                        try {
                                            const { generateChallan } = await import('@/lib/generate-challan')
                                            await generateChallan({
                                                org_name: orgName || 'Factory',
                                                party_name: partyName || order.party_name,
                                                quality_label: order.display_quality_name ?? order.quality_label ?? null,
                                                dispatch_number: dispatch.dispatch_number,
                                                qty_meters_sent: Number(dispatch.qty_meters_sent),
                                                total_target_meters: totalTarget || Number(order.total_target_meters || 0),
                                                package_lines: dispatch.package_lines.map((line) => ({
                                                    package_no: line.package_no,
                                                    package_type: line.package_type,
                                                    units_count: line.units_count,
                                                    grade: line.grade,
                                                    metres: Number(line.qty_meters_sent),
                                                })),
                                                notes: dispatch.notes,
                                                dispatched_at: dispatch.dispatched_at,
                                                tracking_token: trackingToken,
                                            })
                                        } catch {
                                            toast.error('Failed to generate invoice PDF')
                                        }
                                    }}
                                />
                            </div>

                            {/* Machine Assignment */}
                            <div className="space-y-2">
                                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1.5">
                                    <Server className="h-3 w-3" /> Machine Assignment
                                    {currentMachineIds.length > 0 && !isCompleted && (
                                        <span className="text-emerald-400">
                                            · {currentMachineIds.length} running
                                        </span>
                                    )}
                                </p>
                                {isCompleted ? (
                                    <div className="flex items-center gap-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4">
                                        <Lock className="h-5 w-5 text-slate-400 shrink-0" />
                                        <div>
                                            <p className="text-xs font-semibold text-slate-700">Order Completed</p>
                                            <p className="text-xs text-slate-500 mt-0.5">Increase the target above to reactivate this order and reassign machines.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <MachineAssignInline
                                        orderId={order.order_id}
                                        currentMachineIds={currentMachineIds}
                                        allMachines={machines}
                                        onSuccess={() => { load(); onRefresh() }}
                                    />
                                )}
                            </div>

                            {/* Estimator Quote Cost Breakdown */}
                            <div className="space-y-2">
                                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1.5">
                                    <Calculator className="h-3 w-3" /> Estimator Cost Breakdown
                                </p>
                                {quote ? (
                                    <QuoteCostBreakdown quote={quote} targetMeters={target} />
                                ) : (
                                    <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 text-center">
                                        <Calculator className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                                        <p className="text-xs text-slate-500 font-medium">No estimator quote linked</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Save the quote in Estimator, accept it in Quote History, then convert it into a live order
                                        </p>
                                        <a
                                            href="/owner/estimator"
                                            className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-semibold"
                                        >
                                            Go to Estimator <ArrowUpRight className="h-3 w-3" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer actions */}
                        <div className="shrink-0 border-t border-slate-100 px-5 py-4 flex gap-2">
                            {!isCompleted && (
                                <>
                                    <Button
                                        variant="outline"
                                        className="h-11 lg:h-9 flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-bold"
                                        onClick={handleCancel}
                                    >
                                        <Ban className="h-3.5 w-3.5 mr-1.5" /> Cancel Order
                                    </Button>
                                    <Button
                                        className="h-11 lg:h-9 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                        onClick={handleComplete}
                                    >
                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Mark Complete
                                    </Button>
                                </>
                            )}
                            {isCompleted && (
                                <div className="flex-1 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                    <p className="text-xs font-semibold text-emerald-700">Order completed · Increase target to continue production</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>

        {/* Access Code Dialog */}
            <OwnerAccessCodeDialog
                open={codeDialogOpen}
                onClose={() => setCodeDialogOpen(false)}
                onVerified={handleCodeVerified}
                actionLabel={codeDialogAction === 'target' ? 'update the target meters' : 'update the deadline'}
            />
        </>
    )
}

// ─── Order Card ───────────────────────────────────────────────────────────────

interface OrderCardProps {
    order: any
    onSelect: (id: string) => void
    onComplete: (id: string) => void
    onCancel: (id: string) => void
}

function OrderCard({ order, onSelect, onComplete, onCancel }: OrderCardProps) {
    const { t } = useTranslation()
    const daysRemaining = differenceInDays(new Date(order.deadline), new Date())
    const { text: daysText, cls: daysCls } = daysLabel(daysRemaining)
    const progress = Number(order.progress_percent ?? 0)
    const paceIndex = order.pace_index ? Number(order.pace_index) : null
    const metersProduced = Number(order.total_meters_produced ?? 0)
    const target = Number(order.total_target_meters)
    const hasQuote = Boolean(order.has_quote) // if we add this to view later

    return (
        <div
            className="bg-card border border-border shadow-sm rounded-2xl p-4 space-y-3 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group"
            onClick={() => onSelect(order.order_id)}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-base leading-tight truncate">
                        {order.display_quality_name ?? order.quality_label ?? 'Unnamed Quality'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{order.party_name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {metersProduced === 0 ? (
                        <Badge variant="outline" className="text-xs border-slate-200 text-slate-400 font-medium whitespace-nowrap">
                            {t('analytics.orders.card.tracking_starts')}
                        </Badge>
                    ) : paceIndex !== null && (
                        <Badge
                            variant="outline"
                            className={`text-xs border-current font-mono ${paceColor(paceIndex)}`}
                        >
                            ⚡ {paceIndex.toFixed(2)}×
                        </Badge>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 lg:h-7 lg:w-7 text-slate-400 hover:text-slate-700 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                                aria-label="Order actions"
                            >
                                <MoreVertical className="h-5 w-5 lg:h-4 lg:w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white border-slate-200 text-slate-900 shadow-md">
                            <DropdownMenuItem
                                className="text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50 cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); onComplete(order.order_id) }}
                            >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Mark Completed
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-rose-600 focus:text-rose-700 focus:bg-rose-50 cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); onCancel(order.order_id) }}
                            >
                                <Ban className="h-4 w-4 mr-2" />
                                Cancel Order
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Floor Instructions */}
            {(order.warp_instruction || order.weft_instruction) && (
                <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-xs font-mono space-y-0.5">
                    {order.warp_instruction && (
                        <div className="flex gap-2">
                            <span className="text-slate-500 shrink-0">Warp:</span>
                            <span className="text-slate-700 truncate">{order.warp_instruction}</span>
                        </div>
                    )}
                    {order.weft_instruction && (
                        <div className="flex gap-2">
                            <span className="text-slate-500 shrink-0">Weft:</span>
                            <span className="text-slate-700 truncate">{order.weft_instruction}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Progress bar */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-900">
                        {metersProduced.toLocaleString('en-IN')}m
                        <span className="text-slate-500"> / {target.toLocaleString('en-IN')}m</span>
                    </span>
                    <span className={`font-bold ${daysCls}`}>{daysText}</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${progressBarColor(progress)}`}
                        style={{ width: `${Math.min(100, progress)}%` }}
                    />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{progress.toFixed(1)}% complete</span>
                    <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        {(target - metersProduced).toLocaleString('en-IN')}m remaining
                    </span>
                </div>
            </div>

            {/* Footer: machines + open arrow */}
            <div className="flex items-center justify-between">
                {order.assigned_machines_count > 0 ? (
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {order.assigned_machines_count} machine{order.assigned_machines_count > 1 ? 's' : ''} running
                    </div>
                ) : (
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300" />
                        No machines assigned
                    </div>
                )}
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" />
            </div>
        </div>
    )
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({
    title,
    icon: Icon,
    count,
    children,
    accent,
}: {
    title: string
    icon: React.ElementType
    count: number
    children: React.ReactNode
    accent: string
}) {
    return (
        <div className="flex-1 min-w-0">
            <div className={`flex items-center gap-2 mb-3 px-1`}>
                <Icon className={`h-4 w-4 ${accent}`} />
                <h2 className="text-sm font-bold text-slate-900">{title}</h2>
                <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-xs border-slate-200">
                    {count}
                </Badge>
            </div>
            <div className="space-y-3">{children}</div>
        </div>
    )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export function OrdersClient({ initialOrders }: { initialOrders: any[] }) {
    const { t } = useTranslation()
    const searchParams = useSearchParams()
    const [loading, setLoading] = useState(false)
    const [orders, setOrders] = useState<any[]>(initialOrders)

    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

    // Auto-open drawer if ?orderId= is in URL (e.g. from Start Party Order redirect)
    const hasAutoOpened = useRef(false)
    useEffect(() => {
        if (hasAutoOpened.current) return
        const urlOrderId = searchParams.get('orderId')
        const wasCreated  = searchParams.get('created') === '1'
        if (urlOrderId) {
            hasAutoOpened.current = true
            // eslint-disable-next-line react-hooks/exhaustive-deps
            setSelectedOrderId(urlOrderId)
            if (wasCreated) {
                toast.success('Party order started! Assign machines to begin production.')
            }
        }
    }, [searchParams])

    const fetchOrders = useCallback(async () => {
        // Suppress loading flicker if we already have data
        if (orders.length === 0) setLoading(true)
        const res = await getOrdersWithProgress()
        if (res.data) setOrders(res.data)
        setLoading(false)
    }, [orders.length])

    // Notice we do NOT fetch on mount unless initialOrders is empty, we only rely on real-time subscriptions now and hydrate with SSR.
    // useEffect(() => { fetchOrders() }, [fetchOrders])

    // Real-time subscription
    useEffect(() => {
        const supabase = createClient()
        const channel = supabase
            .channel('orders-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'production_logs' }, fetchOrders)
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [fetchOrders])

    const handleComplete = async (id: string) => {
        const res = await updateOrderStatus(id, 'completed')
        if (res.success) { toast.success(t('orders_page.order_marked_complete')); fetchOrders() }
        else toast.error(res.error ?? t('orders_page.failed_to_update'))
    }

    const handleCancel = async (id: string) => {
        const res = await deleteOrder(id)
        if (res.success) { toast.success(t('orders_page.order_cancelled')); fetchOrders() }
        else toast.error(res.error ?? t('orders_page.failed_to_update'))
    }

    // Split orders by phase
    const pendingOrders = orders.filter(
        (o) => o.status === 'active' && o.assigned_machines_count === 0 && Number(o.total_meters_produced) === 0
    )
    const activeOrders = orders.filter(
        (o) => o.status === 'active' && (o.assigned_machines_count > 0 || Number(o.total_meters_produced) > 0)
    )
    if (loading) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        )
    }

    return (
        <div className="space-y-6 pt-2">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t('orders_page.title')}</h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">
                        {activeOrders.length + pendingOrders.length} {t('orders_page.active_summary')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <a href="/owner/archive">
                        <Button
                            variant="outline"
                            className="border-slate-200 text-slate-600 hover:bg-slate-50 font-bold gap-2 hidden sm:flex"
                        >
                            <Archive className="h-4 w-4 text-slate-500" />
                            Archive
                        </Button>
                    </a>
                    <a href="/owner/estimator">
                        <Button
                            variant="outline"
                            className="border-slate-200 text-slate-600 hover:bg-slate-50 font-bold gap-2 hidden sm:flex"
                        >
                            <Calculator className="h-4 w-4 text-indigo-500" />
                            {t('orders_page.estimator_btn')}
                        </Button>
                    </a>
                    <a href="/owner/estimator">
                        <Button
                            className="bg-indigo-600 hover:bg-indigo-500 font-bold gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            {t('orders_page.new_order')}
                        </Button>
                    </a>
                </div>
            </div>

            {/* Kanban */}
            <div>
                {orders.length === 0 ? (
                    <div className="text-center py-24 space-y-4">
                        <Package className="h-12 w-12 text-slate-700 mx-auto" />
                        <div>
                            <p className="text-slate-400 font-medium">{t('orders_page.no_orders_yet')}</p>
                            <p className="text-slate-600 text-sm mt-1">
                                {t('orders_page.create_or_estimator')}
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-4">
                            <a href="/owner/estimator" className="w-full sm:w-auto">
                                <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2">
                                    <Plus className="h-4 w-4" />
                                    {t('orders_page.new_order')}
                                </Button>
                            </a>
                            <a href="/owner/estimator" className="w-full sm:w-auto">
                                <Button variant="outline" className="w-full sm:w-auto border-slate-200 text-slate-600 hover:bg-slate-50 font-bold gap-2">
                                    <Calculator className="h-4 w-4 text-primary" />
                                    {t('orders_page.go_to_estimator')}
                                </Button>
                            </a>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Pending Setup */}
                        <KanbanColumn title={t('orders_page.pending_setup')} icon={Clock} count={pendingOrders.length} accent="text-slate-500">
                            {pendingOrders.length === 0 ? (
                                <div className="border border-dashed border-slate-300 rounded-2xl p-6 text-center">
                                    <p className="text-xs text-slate-500">{t('orders_page.no_pending')}</p>
                                </div>
                            ) : (
                                pendingOrders.map((order) => (
                                    <OrderCard
                                        key={order.order_id}
                                        order={order}
                                        onSelect={setSelectedOrderId}
                                        onComplete={handleComplete}
                                        onCancel={handleCancel}
                                    />
                                ))
                            )}
                        </KanbanColumn>

                        {/* In Production */}
                        <KanbanColumn title={t('orders_page.in_production')} icon={Package} count={activeOrders.length} accent="text-primary">
                            {activeOrders.length === 0 ? (
                                <div className="border border-dashed border-slate-300 rounded-2xl p-6 text-center">
                                    <p className="text-xs text-slate-500">{t('orders_page.no_in_production')}</p>
                                </div>
                            ) : (
                                activeOrders.map((order) => (
                                    <OrderCard
                                        key={order.order_id}
                                        order={order}
                                        onSelect={setSelectedOrderId}
                                        onComplete={handleComplete}
                                        onCancel={handleCancel}
                                    />
                                ))
                            )}
                        </KanbanColumn>

                    </div>
                )}
            </div>



            {/* Order Detail Drawer */}
            <OrderDetailDrawer
                orderId={selectedOrderId}
                open={Boolean(selectedOrderId)}
                onClose={() => setSelectedOrderId(null)}
                onRefresh={fetchOrders}
            />
        </div>
    )
}
