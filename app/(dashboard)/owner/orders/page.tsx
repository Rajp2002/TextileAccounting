'use client'

import { useState, useEffect, useCallback } from 'react'
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
    ArrowRight,
    Calendar,
    Target,
    ChevronRight,
    MoreVertical,
    Pencil,
    Ban,
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
    createFlatOrder,
    updateOrderStatus,
    deleteOrder,
} from './actions'
import { createClient } from '@/lib/supabase/client'

// ─── Utility helpers ────────────────────────────────────────────────────────

function paceColor(paceIndex: number | null, progressPct: number) {
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

// ─── Order Card ──────────────────────────────────────────────────────────────

interface OrderCardProps {
    order: any
    onComplete: (id: string) => void
    onCancel: (id: string) => void
}

function OrderCard({ order, onComplete, onCancel }: OrderCardProps) {
    const daysRemaining = differenceInDays(new Date(order.deadline), new Date())
    const { text: daysText, cls: daysCls } = daysLabel(daysRemaining)
    const progress = Number(order.progress_percent ?? 0)
    const paceIndex = order.pace_index ? Number(order.pace_index) : null
    const metersProduced = Number(order.total_meters_produced ?? 0)
    const target = Number(order.total_target_meters)

    return (
        <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-4 space-y-3 hover:border-slate-600 transition-colors">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-base leading-tight truncate">
                        {order.display_quality_name ?? order.quality_label ?? 'Unnamed Quality'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{order.party_name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {paceIndex !== null && (
                        <Badge
                            variant="outline"
                            className={`text-[10px] border-current font-mono ${paceColor(paceIndex, progress)}`}
                        >
                            ⚡ {paceIndex.toFixed(2)}×
                        </Badge>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-white">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700 text-white">
                            <DropdownMenuItem
                                className="text-emerald-400 focus:text-emerald-400 focus:bg-emerald-950/40 cursor-pointer"
                                onClick={() => onComplete(order.order_id)}
                            >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Mark Completed
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-rose-400 focus:text-rose-400 focus:bg-rose-950/40 cursor-pointer"
                                onClick={() => onCancel(order.order_id)}
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
                <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-700/50 text-[11px] font-mono space-y-1">
                    {order.warp_instruction && (
                        <div className="flex gap-2">
                            <span className="text-slate-500 shrink-0">Warp:</span>
                            <span className="text-slate-300">{order.warp_instruction}</span>
                        </div>
                    )}
                    {order.weft_instruction && (
                        <div className="flex gap-2">
                            <span className="text-slate-500 shrink-0">Weft:</span>
                            <span className="text-slate-300">{order.weft_instruction}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Progress bar */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-white">
                        {metersProduced.toLocaleString('en-IN')}m
                        <span className="text-slate-500"> / {target.toLocaleString('en-IN')}m</span>
                    </span>
                    <span className={`font-bold ${daysCls}`}>{daysText}</span>
                </div>
                <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden">
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

            {/* Assigned machines */}
            {order.assigned_machines_count > 0 && (
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {order.assigned_machines_count} machine{order.assigned_machines_count > 1 ? 's' : ''} running
                </div>
            )}
        </div>
    )
}

// ─── Column ──────────────────────────────────────────────────────────────────

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
                <h2 className="text-sm font-bold text-white">{title}</h2>
                <Badge variant="secondary" className="bg-slate-800 text-slate-400 text-[10px] border-slate-700">
                    {count}
                </Badge>
            </div>
            <div className="space-y-3">{children}</div>
        </div>
    )
}

// ─── New Order Sheet ─────────────────────────────────────────────────────────

function NewOrderSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
    const [loading, setLoading] = useState(false)
    const [partyName, setPartyName] = useState('')
    const [qualityLabel, setQualityLabel] = useState('')
    const [warpInstruction, setWarpInstruction] = useState('')
    const [weftInstruction, setWeftInstruction] = useState('')
    const [targetMeters, setTargetMeters] = useState(10000)
    const [deadline, setDeadline] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))

    const handleCreate = async () => {
        if (!partyName.trim()) return toast.error('Party name is required')
        if (!qualityLabel.trim()) return toast.error('Quality label is required')
        setLoading(true)
        const res = await createFlatOrder({
            party_name: partyName.trim(),
            quality_label: qualityLabel.trim(),
            warp_instruction: warpInstruction.trim() || undefined,
            weft_instruction: weftInstruction.trim() || undefined,
            total_target_meters: targetMeters,
            start_date: new Date().toISOString().split('T')[0],
            deadline,
        })
        setLoading(false)
        if (res.success) {
            toast.success('Order created!')
            setPartyName('')
            setQualityLabel('')
            setWarpInstruction('')
            setWeftInstruction('')
            setTargetMeters(10000)
            onClose()
            onCreated()
        } else {
            toast.error(res.error ?? 'Failed to create order')
        }
    }

    return (
        <Sheet open={open} onOpenChange={onClose}>
            <SheetContent side="bottom" className="bg-slate-900 border-slate-700 text-white rounded-t-2xl max-h-[92vh] overflow-y-auto">
                <SheetHeader className="pb-4">
                    <SheetTitle className="text-white flex items-center gap-2">
                        <Package className="h-5 w-5 text-indigo-400" />
                        New Floor Order
                    </SheetTitle>
                </SheetHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
                                Party Name *
                            </Label>
                            <Input
                                placeholder="e.g. Sundaram Textiles"
                                value={partyName}
                                onChange={(e) => setPartyName(e.target.value)}
                                className="h-12 bg-slate-800 border-slate-600 text-white"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
                                Quality Label *
                            </Label>
                            <Input
                                placeholder="e.g. Canvas Shine"
                                value={qualityLabel}
                                onChange={(e) => setQualityLabel(e.target.value)}
                                className="h-12 bg-slate-800 border-slate-600 text-white"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
                                Warp Spec
                            </Label>
                            <Input
                                placeholder="50/48 + 70/36"
                                value={warpInstruction}
                                onChange={(e) => setWarpInstruction(e.target.value)}
                                className="h-12 bg-slate-800 border-slate-600 text-white text-sm font-mono"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
                                Weft Spec
                            </Label>
                            <Input
                                placeholder="50/48"
                                value={weftInstruction}
                                onChange={(e) => setWeftInstruction(e.target.value)}
                                className="h-12 bg-slate-800 border-slate-600 text-white text-sm font-mono"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
                                Target Meters
                            </Label>
                            <Input
                                type="number"
                                value={targetMeters}
                                onChange={(e) => setTargetMeters(Number(e.target.value))}
                                className="h-12 font-mono font-bold text-center bg-slate-800 border-slate-600 text-white"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[11px] uppercase tracking-widest font-bold text-slate-400 flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Deadline
                            </Label>
                            <Input
                                type="date"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                                className="h-12 bg-slate-800 border-slate-600 text-white"
                            />
                        </div>
                    </div>
                </div>
                <SheetFooter className="pt-6 gap-3">
                    <Button
                        variant="outline"
                        className="flex-1 border-slate-700 text-slate-400"
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 font-bold"
                        onClick={handleCreate}
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                        Create Order
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function OrdersPage() {
    const [loading, setLoading] = useState(true)
    const [orders, setOrders] = useState<any[]>([])
    const [showNewOrder, setShowNewOrder] = useState(false)

    const fetchOrders = useCallback(async () => {
        const res = await getOrdersWithProgress()
        if (res.data) setOrders(res.data)
        setLoading(false)
    }, [])

    useEffect(() => { fetchOrders() }, [fetchOrders])

    // Real-time subscription
    useEffect(() => {
        const supabase = createClient()
        const channel = supabase
            .channel('orders-realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'orders',
            }, fetchOrders)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'production_logs',
            }, fetchOrders)
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [fetchOrders])

    const handleComplete = async (id: string) => {
        const res = await updateOrderStatus(id, 'completed')
        if (res.success) { toast.success('Order marked complete'); fetchOrders() }
        else toast.error(res.error ?? 'Failed to update')
    }

    const handleCancel = async (id: string) => {
        const res = await deleteOrder(id)
        if (res.success) { toast.success('Order cancelled'); fetchOrders() }
        else toast.error(res.error ?? 'Failed to update')
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
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <div className="px-4 pt-6 pb-4 border-b border-slate-800">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-black text-white">Orders</h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {activeOrders.length + pendingOrders.length} active · {completedOrders.length} completed
                        </p>
                    </div>
                    <Button
                        className="bg-indigo-600 hover:bg-indigo-500 font-bold gap-2 h-10"
                        onClick={() => setShowNewOrder(true)}
                    >
                        <Plus className="h-4 w-4" />
                        New Order
                    </Button>
                </div>
            </div>

            {/* Kanban */}
            <div className="px-4 py-5 max-w-5xl mx-auto">
                {orders.length === 0 ? (
                    <div className="text-center py-24 space-y-4">
                        <Package className="h-12 w-12 text-slate-700 mx-auto" />
                        <div>
                            <p className="text-slate-400 font-medium">No orders yet</p>
                            <p className="text-slate-600 text-sm mt-1">
                                Create your first order or convert a quote from the Estimator
                            </p>
                        </div>
                        <Button
                            className="bg-indigo-600 hover:bg-indigo-500 font-bold gap-2"
                            onClick={() => setShowNewOrder(true)}
                        >
                            <Plus className="h-4 w-4" />
                            New Order
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Pending Setup */}
                        <KanbanColumn
                            title="Pending Setup"
                            icon={Clock}
                            count={pendingOrders.length}
                            accent="text-slate-400"
                        >
                            {pendingOrders.length === 0 ? (
                                <div className="border border-dashed border-slate-700 rounded-2xl p-6 text-center">
                                    <p className="text-xs text-slate-600">No pending orders</p>
                                </div>
                            ) : (
                                pendingOrders.map((order) => (
                                    <OrderCard
                                        key={order.order_id}
                                        order={order}
                                        onComplete={handleComplete}
                                        onCancel={handleCancel}
                                    />
                                ))
                            )}
                        </KanbanColumn>

                        {/* In Production */}
                        <KanbanColumn
                            title="In Production"
                            icon={Package}
                            count={activeOrders.length}
                            accent="text-indigo-400"
                        >
                            {activeOrders.length === 0 ? (
                                <div className="border border-dashed border-slate-700 rounded-2xl p-6 text-center">
                                    <p className="text-xs text-slate-600">No orders in production</p>
                                </div>
                            ) : (
                                activeOrders.map((order) => (
                                    <OrderCard
                                        key={order.order_id}
                                        order={order}
                                        onComplete={handleComplete}
                                        onCancel={handleCancel}
                                    />
                                ))
                            )}
                        </KanbanColumn>

                        {/* Completed */}
                        <KanbanColumn
                            title="Completed"
                            icon={CheckCircle2}
                            count={completedOrders.length}
                            accent="text-emerald-400"
                        >
                            {completedOrders.length === 0 ? (
                                <div className="border border-dashed border-slate-700 rounded-2xl p-6 text-center">
                                    <p className="text-xs text-slate-600">No completed orders yet</p>
                                </div>
                            ) : (
                                completedOrders.slice(0, 5).map((order) => (
                                    <OrderCard
                                        key={order.order_id}
                                        order={order}
                                        onComplete={handleComplete}
                                        onCancel={handleCancel}
                                    />
                                ))
                            )}
                        </KanbanColumn>
                    </div>
                )}
            </div>

            <NewOrderSheet
                open={showNewOrder}
                onClose={() => setShowNewOrder(false)}
                onCreated={fetchOrders}
            />
        </div>
    )
}
