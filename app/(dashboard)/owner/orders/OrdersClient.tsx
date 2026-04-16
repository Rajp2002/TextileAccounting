'use client'

import { useState, useEffect, useCallback } from 'react'
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
} from 'lucide-react'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from '@/components/ui/sheet'
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
} from './actions'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

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
                                    <p className="text-[10px] text-amber-600 font-medium">{t('orders_page.on_another_order')}</p>
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

function QuoteCostBreakdown({ quote, targetMeters }: { quote: any; targetMeters: number }) {
    const landedCost = Number(quote.landed_cost_per_meter ?? 0)
    const quotePrice = Number(quote.quote_price_per_meter ?? 0)
    const marginPct  = Number(quote.intended_margin_percent ?? 0)
    const totalValue = quotePrice * targetMeters

    return (
        <div className="space-y-3">
            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Production Cost</p>
                    <p className="text-lg font-black font-mono text-slate-900">₹{landedCost.toFixed(2)}<span className="text-xs text-slate-500 font-normal">/m</span></p>
                </div>
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                    <p className="text-[10px] uppercase tracking-widest text-primary font-bold mb-1">Quote Price</p>
                    <p className="text-lg font-black font-mono text-primary">₹{quotePrice.toFixed(2)}<span className="text-xs text-primary/60 font-normal">/m</span></p>
                </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-0.5">Total Order Value</p>
                    <p className="text-xl font-black font-mono text-emerald-600">
                        ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-0.5">Margin</p>
                    <p className="text-lg font-black text-amber-600">{marginPct.toFixed(1)}%</p>
                </div>
            </div>

            {/* Cost stack pills */}
            <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Cost Stack</p>
                {quote.warp_rows?.length > 0 && (
                    <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                        <span className="text-primary font-medium">🧶 Warp Yarn</span>
                        <span className="font-mono text-slate-900">
                            ₹{((quote.warp_rows as any[]).reduce((acc: number, r: any) => {
                                const kgPer100m = (r.calcDenier * r.beamEnds) / (9000 * 1000)
                                const costPer100m = kgPer100m * r.yarnRate * (1 + r.gstPct / 100)
                                return acc + costPer100m
                            }, 0) / 100).toFixed(2)}/m
                        </span>
                    </div>
                )}
                {quote.weft_rows?.length > 0 && (
                    <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                        <span className="text-emerald-600 font-medium">🧵 Weft Yarn</span>
                        <span className="font-mono text-slate-900">
                            ₹{((quote.weft_rows as any[]).reduce((acc: number, r: any) => {
                                const kgPer100m = (r.picks * r.reedSpace * r.calcDenier) / (9000 * 100 * 100)
                                const costPer100m = kgPer100m * r.yarnRate * (1 + r.gstPct / 100)
                                return acc + costPer100m
                            }, 0) / 100).toFixed(2)}/m
                        </span>
                    </div>
                )}
                {quote.overhead_pct > 0 && (
                    <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                        <span className="text-rose-500 font-medium">🏭 Overhead</span>
                        <span className="font-mono text-slate-900">{Number(quote.overhead_pct).toFixed(1)}% effective</span>
                    </div>
                )}
                {quote.worker_rate_per_m > 0 && (
                    <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                        <span className="text-amber-500 font-medium">👷 Weaver Wage</span>
                        <span className="font-mono text-slate-900">
                            ₹{Number(quote.worker_rate_per_m).toFixed(2)}/m
                        </span>
                    </div>
                )}
                {quote.commission_pct > 0 && (
                    <div className="flex items-center justify-between text-xs py-1">
                        <span className="text-amber-600 font-medium">💼 Commission</span>
                        <span className="font-mono text-slate-900">{Number(quote.commission_pct).toFixed(1)}%</span>
                    </div>
                )}
            </div>
        </div>
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
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [editingDeadline, setEditingDeadline] = useState(false)
    const [deadlineVal, setDeadlineVal] = useState('')
    const [editingTarget, setEditingTarget] = useState(false)
    const [targetVal, setTargetVal] = useState('')
    const [savingEdit, setSavingEdit] = useState(false)

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

    const handleSaveDeadline = async () => {
        if (!orderId) return
        setSavingEdit(true)
        const res = await updateOrderDetails(orderId, { deadline: deadlineVal })
        setSavingEdit(false)
        if (res.success) { toast.success('Deadline updated'); setEditingDeadline(false); load() }
        else toast.error(res.error ?? 'Failed to update')
    }

    const handleSaveTarget = async () => {
        if (!orderId) return
        const t = Number(targetVal)
        if (!t || t <= 0) return toast.error('Invalid target')
        setSavingEdit(true)
        const res = await updateOrderDetails(orderId, { total_target_meters: t })
        setSavingEdit(false)
        if (res.success) { toast.success('Target updated'); setEditingTarget(false); load() }
        else toast.error(res.error ?? 'Failed to update')
    }

    const order   = data?.order
    const quote   = data?.quote
    const machines = data?.machines ?? []

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
                                        <span className="text-[10px] bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-full font-mono">
                                            Warp: {order.warp_instruction}
                                        </span>
                                    )}
                                    {order.weft_instruction && (
                                        <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full font-mono">
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
                                <div className="flex items-center justify-between text-[10px] text-slate-500">
                                    <span>{progress.toFixed(1)}% complete</span>
                                    {paceIndex !== null && (
                                        <span className={`font-mono font-bold flex items-center gap-1 ${paceColor(paceIndex)}`}>
                                            ⚡ {paceIndex.toFixed(2)}× pace
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Order details — editable */}
                            <div className="space-y-2">
                                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1.5">
                                    <Target className="h-3 w-3" /> Order Details
                                </p>

                                {/* Target Meters */}
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Target Meters</p>
                                        {editingTarget ? (
                                            <div className="flex items-center gap-2 mt-1">
                                                <Input
                                                    type="number"
                                                    value={targetVal}
                                                    onChange={e => setTargetVal(e.target.value)}
                                                    className="h-7 w-28 text-xs font-mono bg-white border-slate-200 text-slate-900"
                                                    autoFocus
                                                />
                                                <button onClick={handleSaveTarget} disabled={savingEdit} className="text-emerald-500 hover:text-emerald-600">
                                                    {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                </button>
                                                <button onClick={() => setEditingTarget(false)} className="text-slate-400 hover:text-slate-900">
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-base font-black font-mono text-slate-900">
                                                {target.toLocaleString('en-IN')} m
                                            </p>
                                        )}
                                    </div>
                                    {!editingTarget && (
                                        <button onClick={() => setEditingTarget(true)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Deadline */}
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                            <Calendar className="h-3 w-3" /> Deadline
                                        </p>
                                        {editingDeadline ? (
                                            <div className="flex items-center gap-2 mt-1">
                                                <Input
                                                    type="date"
                                                    value={deadlineVal}
                                                    onChange={e => setDeadlineVal(e.target.value)}
                                                    className="h-7 text-xs bg-white border-slate-200 text-slate-900"
                                                    autoFocus
                                                />
                                                <button onClick={handleSaveDeadline} disabled={savingEdit} className="text-emerald-500 hover:text-emerald-600">
                                                    {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                </button>
                                                <button onClick={() => setEditingDeadline(false)} className="text-slate-400 hover:text-slate-900">
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-base font-black font-mono text-slate-900">
                                                {format(new Date(order.deadline), 'dd MMM yyyy')}
                                            </p>
                                        )}
                                    </div>
                                    {!editingDeadline && (
                                        <button onClick={() => setEditingDeadline(true)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Worker Wage (Snapshot) */}
                                {order.worker_rate_per_m !== null && (
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                                <CircleDollarSign className="h-3 w-3" /> Worker Wage
                                            </p>
                                            <p className="text-base font-black font-mono text-slate-900">
                                                ₹{Number(order.worker_rate_per_m).toFixed(2)} /m
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Machine Assignment */}
                            <div className="space-y-2">
                                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1.5">
                                    <Server className="h-3 w-3" /> Machine Assignment
                                    {currentMachineIds.length > 0 && (
                                        <span className="text-emerald-400">
                                            · {currentMachineIds.length} running
                                        </span>
                                    )}
                                </p>
                                <MachineAssignInline
                                    orderId={order.order_id}
                                    currentMachineIds={currentMachineIds}
                                    allMachines={machines}
                                    onSuccess={() => { load(); onRefresh() }}
                                />
                            </div>

                            {/* Estimator Quote Cost Breakdown */}
                            <div className="space-y-2">
                                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1.5">
                                    <Calculator className="h-3 w-3" /> Estimator Cost Breakdown
                                </p>
                                {quote ? (
                                    <QuoteCostBreakdown quote={quote} targetMeters={target} />
                                ) : (
                                    <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 text-center">
                                        <Calculator className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                                        <p className="text-xs text-slate-500 font-medium">No estimator quote linked</p>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            Use Estimator → "Order" to create an order with a cost snapshot
                                        </p>
                                        <a
                                            href="/owner/estimator"
                                            className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 font-semibold"
                                        >
                                            Go to Estimator <ArrowUpRight className="h-3 w-3" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer actions */}
                        <div className="shrink-0 border-t border-slate-100 px-5 py-4 flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-bold"
                                onClick={handleCancel}
                            >
                                <Ban className="h-3.5 w-3.5 mr-1.5" /> Cancel Order
                            </Button>
                            <Button
                                size="sm"
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                onClick={handleComplete}
                            >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Mark Complete
                            </Button>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
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
                    {paceIndex !== null && (
                        <Badge
                            variant="outline"
                            className={`text-[10px] border-current font-mono ${paceColor(paceIndex)}`}
                        >
                            ⚡ {paceIndex.toFixed(2)}×
                        </Badge>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <MoreVertical className="h-4 w-4" />
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
                <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-[11px] font-mono space-y-0.5">
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
                <div className="flex items-center justify-between text-[10px] text-slate-500">
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
                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {order.assigned_machines_count} machine{order.assigned_machines_count > 1 ? 's' : ''} running
                    </div>
                ) : (
                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
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
                <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-[10px] border-slate-200">
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
    const [loading, setLoading] = useState(false)
    const [orders, setOrders] = useState<any[]>(initialOrders)

    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

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
    const completedOrders = orders.filter((o) => o.status === 'completed')

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
                    <h1 className="text-2xl font-black text-white tracking-tight">{t('orders_page.title')}</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        {activeOrders.length + pendingOrders.length} {t('orders_page.active_summary')} · {completedOrders.length} {t('orders_page.completed_summary')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <a href="/owner/estimator">
                        <Button
                            variant="outline"
                            className="border-slate-700 text-slate-300 hover:bg-slate-800 font-bold gap-2 hidden sm:flex"
                        >
                            <Calculator className="h-4 w-4 text-indigo-400" />
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
                        <div className="flex items-center justify-center gap-3">
                            <a href="/owner/estimator">
                                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2">
                                    <Plus className="h-4 w-4" />
                                    {t('orders_page.new_order')}
                                </Button>
                            </a>
                            <a href="/owner/estimator">
                                <Button variant="outline" className="border-slate-200 text-slate-600 hover:bg-slate-50 font-bold gap-2">
                                    <Calculator className="h-4 w-4 text-primary" />
                                    {t('orders_page.go_to_estimator')}
                                </Button>
                            </a>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

                        {/* Completed */}
                        <KanbanColumn title={t('orders_page.completed_col')} icon={CheckCircle2} count={completedOrders.length} accent="text-emerald-600">
                            {completedOrders.length === 0 ? (
                                <div className="border border-dashed border-slate-300 rounded-2xl p-6 text-center">
                                    <p className="text-xs text-slate-500">{t('orders_page.no_completed')}</p>
                                </div>
                            ) : (
                                completedOrders.slice(0, 5).map((order) => (
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
