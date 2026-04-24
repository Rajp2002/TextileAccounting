'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Copy,
    Loader2,
    Users,
    Package,
    Check,
    Sun,
    Moon,
    ClipboardList,
    Save,
    AlertCircle,
    Settings,
    ChevronRight,
    ChevronUp,
    ChevronDown,
    MessageSquare,
    AlertTriangle,
    KeyRound,
} from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { format, subDays } from 'date-fns'
import {
    getShiftSetupData,
    upsertShiftAssignment,
    copyPreviousShiftAction,
    bulkLogProduction,
    updateMachineStatus,
    updateMachineBreakdown,
    requestAccessCode,
} from '../actions'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetFooter,
    SheetDescription,
} from '@/components/ui/sheet'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/context'

// ─── Utility ─────────────────────────────────────────────────────────────────

function getCurrentShift(): 'day' | 'night' {
    const hour = new Date().getHours()
    return hour >= 6 && hour < 18 ? 'day' : 'night'
}

function getTodayString() {
    return format(new Date(), 'yyyy-MM-dd')
}

// ─── Status Badge Component ──────────────────────────────────────────────────

function MachineStatusBadge({ status }: { status: 'running' | 'idle' | 'maintenance' }) {
    switch (status) {
        case 'running':
            return (
                <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white border-none text-[9px] uppercase font-black tracking-tighter">
                    Running
                </Badge>
            )
        case 'maintenance':
            return (
                <Badge className="bg-amber-500 hover:bg-amber-500 text-black border-none text-[9px] uppercase font-black tracking-tighter">
                    Service
                </Badge>
            )
        default:
            return (
                <Badge variant="outline" className="border-border text-muted-foreground text-[9px] uppercase font-black tracking-tighter">
                    Idle
                </Badge>
            )
    }
}

// ─── Unified Machine Row ──────────────────────────────────────────────────────

interface MachineUnifiedRowProps {
    machine: any
    workers: any[]
    orders: any[]
    assignment: any
    metersValue: number
    onMetersChange: (v: number) => void
    onStatusClick: (machine: any) => void
    onAssignmentChange: (machineId: string, workerId: number | null, orderId: string | null) => void
    isSyncing?: boolean
    isSaved?: boolean
}

function MachineUnifiedRow({
    machine,
    workers,
    orders,
    assignment,
    metersValue,
    onMetersChange,
    onStatusClick,
    onAssignmentChange,
    isSyncing,
    isSaved,
}: MachineUnifiedRowProps) {
    const { t } = useTranslation()
    const workerId = assignment?.worker_id?.toString() ?? ''
    const orderId = assignment?.order_id ?? ''
    const status = (machine.machine_status || 'idle') as 'running' | 'idle' | 'maintenance'

    const selectedOrder = orders.find((o) => o.id === orderId)
    const isMaintenance = status === 'maintenance'

    return (
        <div className={cn(
            "relative flex items-stretch gap-0 bg-card border border-border shadow-sm rounded-2xl overflow-hidden transition-all duration-200",
            isMaintenance && "opacity-75 grayscale-[0.5]"
        )}>
            {/* Status Strip & Detail Trigger */}
            <button 
                onClick={() => onStatusClick(machine)}
                className={cn(
                    "w-14 xs:w-16 shrink-0 flex flex-col items-center justify-center gap-1.5 border-r border-border hover:bg-muted/30 transition-all relative",
                    status === 'running' ? "bg-emerald-50/40" : status === 'maintenance' ? "bg-amber-50/40" : "bg-muted/10",
                    isSyncing && "animate-pulse"
                )}
            >
                {/* Left Status Bar */}
                <div className={cn(
                    "absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full",
                    status === 'running' ? "bg-emerald-500 shadow-[2px_0_10px_rgba(16,185,129,0.3)]" : 
                    status === 'maintenance' ? "bg-amber-500 shadow-[2px_0_10px_rgba(245,158,11,0.3)]" : 
                    "bg-slate-300"
                )} />

                <div className="flex flex-col items-center px-1">
                    <p className="text-[10px] xs:text-xs font-black tracking-tight text-foreground/80 leading-none mb-1">
                        {machine.name.replace('Machine ', 'M-')}
                    </p>
                    {isSyncing ? (
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    ) : isSaved ? (
                        <div className="bg-emerald-500 rounded-full p-0.5 animate-in zoom-in duration-300 shadow-sm">
                             <Check className="h-2.5 w-2.5 text-white stroke-[4px]" />
                        </div>
                    ) : (
                        <div className={cn(
                            "w-2 h-2 rounded-full",
                            status === 'running' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : 
                            status === 'maintenance' ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : 
                            "bg-slate-300"
                        )} />
                    )}
                </div>
            </button>

            {/* Assignments Section */}
            <div className="flex-1 min-w-0 p-3 py-4 flex flex-col justify-center gap-2">
                {/* Worker Dropdown */}
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                        <Users className="h-3.5 w-3.5 text-primary/70" />
                    </div>
                    <Select 
                        value={workerId} 
                        onValueChange={(val) => onAssignmentChange(machine.id, parseInt(val), orderId || null)}
                    >
                        <SelectTrigger className="h-auto border-none bg-transparent p-0 text-[13px] font-extrabold shadow-none focus:ring-0 truncate max-w-full hover:text-primary transition-colors">
                            <SelectValue placeholder={t('production.no_worker')} />
                        </SelectTrigger>
                        <SelectContent>
                            {workers.map((w) => (
                                <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Order Dropdown */}
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Package className="h-3.5 w-3.5 text-muted-foreground/70" />
                    </div>
                    <Select 
                        value={orderId} 
                        onValueChange={(val) => onAssignmentChange(machine.id, workerId ? parseInt(workerId) : null, val)}
                    >
                        <SelectTrigger className="h-auto border-none bg-transparent p-0 text-[11px] font-bold text-muted-foreground shadow-none focus:ring-0 truncate max-w-full leading-tight hover:text-foreground transition-colors">
                            <SelectValue placeholder={t('production.link_order')} />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                            {orders.map((o) => (
                                <SelectItem key={o.id} value={o.id}>
                                    <span className="font-bold">{o.quality_label}</span>
                                    <span className="ml-1 opacity-60">— {o.party_name}</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Production Input (The Quick Log) */}
            <div className={cn(
                "w-28 xs:w-32 shrink-0 flex items-center justify-center p-3 pb-5 border-l border-border bg-muted/5",
                !workerId && "opacity-30 grayscale pointer-events-none"
            )}>
                <div className="relative w-full">
                    <div className={cn(
                        "flex items-center bg-background border-2 rounded-2xl overflow-hidden transition-all duration-300 group/input",
                        metersValue > 0 ? "border-primary shadow-[0_8px_20px_-6px_rgba(255,87,34,0.25)] ring-4 ring-primary/5" : "border-border shadow-sm"
                    )}>
                        <Input
                            type="number"
                            inputMode="decimal"
                            pattern="[0-9]*"
                            placeholder="0"
                            value={metersValue || ''}
                            onChange={(e) => onMetersChange(Number(e.target.value))}
                            className="h-10 xs:h-12 flex-1 border-none bg-transparent text-lg xs:text-xl font-black text-center font-mono focus-visible:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-card border border-border px-2 py-0.5 rounded-full shadow-sm">
                        <span className="text-[9px] font-black text-primary uppercase tracking-widest leading-none">
                            {t('production.meters')}
                        </span>
                    </div>
                </div>
            </div>
            
            {/* Detail Sheet Indicator */}
            <button 
                onClick={() => onStatusClick(machine)}
                className="absolute right-0 top-0 p-1 text-muted-foreground/30 hover:text-primary transition-colors"
                title="Machine Details"
            >
                <ChevronRight className="h-3 w-3" />
            </button>
        </div>
    )
}

// ─── Machine Detail Content (Slide-out) ─────────────────────────────────────────

function MachineDetailSheet({ 
    machine, 
    date,
    shift,
    onClose, 
    onStatusChange,
    initialCategory,
    initialNotes,
}: { 
    machine: any, 
    date: string,
    shift: 'day' | 'night',
    onClose: () => void, 
    onStatusChange: (status: 'running' | 'idle' | 'maintenance') => void,
    initialCategory?: string | null,
    initialNotes?: string
}) {
    const [notes, setNotes] = useState(initialNotes || '')
    const [category, setCategory] = useState<string | null>(initialCategory || null)
    const [saving, setSaving] = useState(false)

    const categories = [
        { id: 'warp', label: 'Warp Break', icon: AlertTriangle },
        { id: 'mech', label: 'Mechanical', icon: Settings },
        { id: 'elec', label: 'Electrical', icon: Sun },
    ]

    const handleStatusUpdate = async (status: 'running' | 'idle' | 'maintenance') => {
        setSaving(true)
        const res = await updateMachineStatus(machine.id, status)
        if (res.success) {
            onStatusChange(status)
            toast.success(`Machine status updated to ${status}`)
        } else {
            toast.error(res.error)
        }
        setSaving(false)
    }

    const handleSaveBreakdown = async () => {
        setSaving(true)
        const res = await updateMachineBreakdown({
            machineId: machine.id,
            date,
            shift,
            category,
            notes
        })
        setSaving(false)
        if (res.success) {
            toast.success("Breakdown details saved")
            onClose()
        } else {
            toast.error(res.error)
        }
    }

    return (
        <>
            <SheetHeader>
                <div className="flex items-center gap-3">
                    <p className="text-2xl font-black text-foreground">{machine.name}</p>
                    <MachineStatusBadge status={machine.machine_status || 'idle'} />
                </div>
                <SheetDescription>
                    Manage status and record detailed breakdown notes for this machine.
                </SheetDescription>
            </SheetHeader>

            <div className="py-6 space-y-8">
                {/* Status Toggle Buttons */}
                <div className="space-y-3">
                    <Label className="text-xs uppercase font-black tracking-widest text-muted-foreground">Change Status</Label>
                    <div className="grid grid-cols-3 gap-2">
                        <Button 
                            variant="outline" 
                            className={cn(
                                "h-16 flex flex-col gap-1 border-2 font-black",
                                machine.machine_status === 'running' && "border-emerald-500 bg-emerald-50 text-emerald-700"
                            )}
                            onClick={() => handleStatusUpdate('running')}
                            disabled={saving}
                        >
                            <Check className="h-5 w-5" />
                            <span className="text-[10px]">RUNNING</span>
                        </Button>
                        <Button 
                            variant="outline" 
                            className={cn(
                                "h-16 flex flex-col gap-1 border-2 font-black",
                                machine.machine_status === 'idle' && "border-slate-400 bg-slate-50 text-slate-700"
                            )}
                            onClick={() => handleStatusUpdate('idle')}
                            disabled={saving}
                        >
                            <Moon className="h-5 w-5" />
                            <span className="text-[10px]">IDLE</span>
                        </Button>
                        <Button 
                            variant="outline" 
                            className={cn(
                                "h-16 flex flex-col gap-1 border-2 font-black",
                                machine.machine_status === 'maintenance' && "border-amber-500 bg-amber-50 text-amber-700"
                            )}
                            onClick={() => handleStatusUpdate('maintenance')}
                            disabled={saving}
                        >
                            <Settings className="h-5 w-5" />
                            <span className="text-[10px]">SERVICE</span>
                        </Button>
                    </div>
                </div>

                {/* Categories Toggles */}
                <div className="space-y-3">
                    <Label className="text-xs uppercase font-black tracking-widest text-muted-foreground">Breakdown Category</Label>
                    <div className="flex flex-wrap gap-2">
                        {categories.map((cat) => {
                            const Icon = cat.icon
                            const active = category === cat.id
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setCategory(active ? null : cat.id)}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-2 rounded-full border-2 text-xs font-bold transition-all",
                                        active 
                                            ? "bg-primary border-primary text-white shadow-lg" 
                                            : "border-border text-muted-foreground hover:border-primary/50"
                                    )}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {cat.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Notes Input */}
                <div className="space-y-3">
                    <Label className="text-xs uppercase font-black tracking-widest text-muted-foreground">Other / Comments</Label>
                    <div className="relative">
                        <textarea
                            className="w-full h-32 p-3 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                            placeholder="Add specific details (e.g., waiting for spare parts)..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                        <MessageSquare className="absolute right-3 bottom-3 h-4 w-4 text-muted-foreground/30" />
                    </div>
                </div>
            </div>

            <SheetFooter>
                <Button 
                    className="w-full bg-primary hover:bg-primary/90 font-black h-12 gap-2" 
                    disabled={saving}
                    onClick={handleSaveBreakdown}
                >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save & Close
                </Button>
            </SheetFooter>
        </>
    )
}

// ─── MAIN DASHBOARD ──────────────────────────────────────────────────────────────

export default function UnifiedDashboard() {
    const { t } = useTranslation()
    const [date, setDate] = useState(getTodayString())
    const [shift, setShift] = useState<'day' | 'night'>(getCurrentShift())
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [copying, setCopying] = useState(false)

    const [machines, setMachines] = useState<any[]>([])
    const [workers, setWorkers] = useState<any[]>([])
    const [orders, setOrders] = useState<any[]>([])
    const [assignments, setAssignments] = useState<any[]>([])

    // Bulk Entry state
    const [meters, setMeters] = useState<Record<string, number>>({})
    
    // Optimistic / Sync markers
    const [syncingState, setSyncingState] = useState<Record<string, 'syncing' | 'saved' | null>>({})
    
    // Detail Sheet state
    const [selectedMachine, setSelectedMachine] = useState<any | null>(null)

    // Duplicate Guard State
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
    const [duplicateAccessCode, setDuplicateAccessCode] = useState('')
    const [requestingCode, setRequestingCode] = useState(false)

    // ─── Pull to Refresh Logic ────────────────────────────────────────────────
    const [pullDistance, setPullDistance] = useState(0)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const touchStartRef = useRef<number | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const handleTouchStart = (e: React.TouchEvent) => {
        if (typeof window !== 'undefined' && window.scrollY === 0) {
            touchStartRef.current = e.touches[0].clientY
        }
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStartRef.current !== null && !isRefreshing) {
            const currentY = e.touches[0].clientY
            const distance = currentY - touchStartRef.current
            
            if (distance > 0) {
                // Resistance logic for the pull
                const pull = Math.min(distance * 0.4, 80)
                setPullDistance(pull)
                
                // If we've pulled enough, we can prevent default scrolling
                if (pull > 20) {
                    // Note: We can't actually preventDefault in passive listeners, 
                    // but visual feedback is enough for this implementation.
                }
            }
        }
    }

    const handleTouchEnd = async () => {
        if (pullDistance > 60 && !isRefreshing) {
            setIsRefreshing(true)
            setPullDistance(40) // Keep visible while loading
            await fetchData()
            setTimeout(() => {
                setIsRefreshing(false)
                setPullDistance(0)
            }, 600)
        } else {
            setPullDistance(0)
        }
        touchStartRef.current = null
    }

    // Load meter entries from localStorage for offline recovery
    useEffect(() => {
        const cached = localStorage.getItem(`meters_${date}_${shift}`)
        if (cached) {
            try {
                setMeters(JSON.parse(cached))
            } catch (e) {
                console.error('Failed to parse cached meters', e)
            }
        }
    }, [date, shift])

    // Save to localStorage whenever meters change
    useEffect(() => {
        if (Object.keys(meters).length > 0) {
            localStorage.setItem(`meters_${date}_${shift}`, JSON.stringify(meters))
        }
    }, [meters, date, shift])

    const fetchData = useCallback(async () => {
        setLoading(true)
        const data = await getShiftSetupData(date, shift)
        setMachines(data.machines)
        setWorkers(data.workers)
        setOrders(data.orders)
        setAssignments(data.assignments)
        setLoading(false)
    }, [date, shift])

    useEffect(() => { fetchData() }, [fetchData])

    // Update assignment (optimistic)
    const handleAssignmentChange = async (machineId: string, workerId: number | null, orderId: string | null) => {
        // Mark as syncing
        setSyncingState(prev => ({ ...prev, [machineId]: 'syncing' }))

        // Find existing record to get current rate
        const existing = assignments.find(a => a.machine_id === machineId)
        const currentOrder = orders.find(o => o.id === orderId)
        const machine = machines.find(m => m.id === machineId)
        
        const rate = existing?.rate_per_m 
            ?? currentOrder?.worker_rate_per_m 
            ?? machine?.default_rate_per_m 
            ?? 1.5

        // OPTIMISTIC UPDATE: Update the local assignments list immediately
        const originalAssignments = [...assignments]
        setAssignments(prev => {
            const next = prev.filter(a => a.machine_id !== machineId)
            if (workerId) {
                next.push({ 
                    machine_id: machineId, 
                    worker_id: workerId, 
                    order_id: orderId, 
                    rate_per_m: rate,
                    breakdown_category: existing?.breakdown_category,
                    breakdown_notes: existing?.breakdown_notes
                })
            }
            return next
        })

        const res = await upsertShiftAssignment({
            date,
            shift,
            machine_id: machineId,
            worker_id: workerId,
            order_id: orderId,
            rate_per_m: rate,
        })

        if (res.success) {
            setSyncingState(prev => ({ ...prev, [machineId]: 'saved' }))
            // Clear the "saved" checkmark after 3 seconds
            setTimeout(() => {
                setSyncingState(prev => ({ ...prev, [machineId]: null }))
            }, 3000)

            // Clear meters locally if worker was unassigned
            if (!workerId) {
                setMeters(prev => {
                    const next = { ...prev }
                    delete next[machineId]
                    return next
                })
            }
        } else {
            // ROLLBACK on error
            setAssignments(originalAssignments)
            setSyncingState(prev => ({ ...prev, [machineId]: null }))
            toast.error(res.error)
        }
    }

    const handleBulkSubmit = async (code: string = '') => {
        const assignedMachines = machines.filter((m) =>
            assignments.some((a) => a.machine_id === m.id && a.worker_id)
        )

        const entries = assignedMachines
            .map((m) => {
                const assignment = assignments.find((a) => a.machine_id === m.id)
                return {
                    machine_id: m.id,
                    worker_id: assignment?.worker_id,
                    order_id: assignment?.order_id ?? null,
                    meters: meters[m.id] ?? 0,
                    shift,
                    date,
                    rate_per_m: assignment?.rate_per_m,
                }
            })
            .filter((e) => e.worker_id && e.order_id && e.meters > 0)

        if (entries.length === 0) {
            toast.error('No valid production entries found. Ensure both a worker and an order are assigned to each machine.')
            return
        }

        setSubmitting(true)
        const res = await bulkLogProduction(entries, code)
        setSubmitting(false)

        if (res.success) {
            toast.success(`✅ Production Logged! (${res.logged} machines)`)
            setMeters({}) // Reset inputs after success
            localStorage.removeItem(`meters_${date}_${shift}`) // Clear cache
            setShowDuplicateDialog(false)
            setDuplicateAccessCode('')
        } else if (res.error === 'DUPLICATE_LOG_DETECTED') {
            setShowDuplicateDialog(true)
        } else {
            toast.error(res.error)
        }
    }

    const handleRequestCode = async () => {
        setRequestingCode(true)
        try {
            const result = await requestAccessCode()
            if (result.error) throw new Error(result.error)
            toast.success(t('auth.code_requested_success') || 'Request sent to owner via WhatsApp')
        } catch (error: any) {
            toast.error(error.message || 'Failed to request code')
        } finally {
            setRequestingCode(false)
        }
    }

    const handleCopyPrevious = async () => {
        const sourceDate = format(subDays(new Date(date), 1), 'yyyy-MM-dd')
        setCopying(true)
        const res = await copyPreviousShiftAction(date, shift, sourceDate, shift)
        setCopying(false)
        if (res.success) {
            toast.success(`Copied ${res.copied} assignments!`)
            fetchData()
        } else {
            toast.error(res.error)
        }
    }

    const assignedCount = assignments.filter((a) => a.worker_id).length
    const loggedMetersCount = Object.keys(meters).length

    return (
        <div 
            ref={containerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="flex flex-col min-h-[90vh] pb-32 select-none bg-grid-pattern"
        >
            {/* Pull to Refresh Indicator */}
            <div 
                className="ptr-indicator overflow-hidden transition-[height] duration-200"
                style={{ height: `${pullDistance}px`, opacity: pullDistance / 60 }}
            >
                <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest">
                    <Loader2 className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                    {isRefreshing ? 'Updating...' : 'Pull to Refresh'}
                </div>
            </div>

            {/* Header - Sticky with safe padding */}
            <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 py-4 pt-safe shadow-sm">
                <div className="max-w-6xl mx-auto space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-black text-foreground tracking-tight">Shift Dashboard</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-[10px] font-bold h-5 bg-muted/50 border-none">
                                    {assignedCount}/{machines.length} Assigned
                                </Badge>
                                {loggedMetersCount > 0 && (
                                    <Badge className="bg-primary text-white text-[10px] font-bold h-5 border-none shadow-sm animate-in fade-in zoom-in duration-300">
                                        {loggedMetersCount} Meter Entries
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 border-border bg-white text-[10px] font-black gap-2 shadow-sm rounded-xl px-4 hover:bg-muted/50 hover:text-primary transition-all active:scale-95"
                            onClick={handleCopyPrevious}
                            disabled={copying || assignments.length > 0}
                        >
                            {copying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                            COPY YEST.
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        <Input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="flex-1 h-12 bg-muted/30 border-border text-sm font-bold rounded-xl focus:ring-primary/20"
                        />
                        <div className="flex p-1 bg-muted/40 rounded-2xl border border-border shrink-0 backdrop-blur-sm">
                            <button
                                onClick={() => setShift('day')}
                                className={cn(
                                    "flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black transition-all duration-300",
                                    shift === 'day' ? "bg-white text-orange-500 shadow-md ring-1 ring-black/5" : "text-muted-foreground opacity-60 hover:opacity-100"
                                )}
                            >
                                <Sun className={cn("h-4 w-4", shift === 'day' && "animate-pulse")} /> DAY
                            </button>
                            <button
                                onClick={() => setShift('night')}
                                className={cn(
                                    "flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black transition-all duration-300",
                                    shift === 'night' ? "bg-[#1A1A1B] text-indigo-400 shadow-md ring-1 ring-white/5" : "text-muted-foreground opacity-60 hover:opacity-100"
                                )}
                            >
                                <Moon className={cn("h-4 w-4", shift === 'night' && "animate-pulse")} /> NIGHT
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Machine List - Responsive Grid */}
            <div className="px-4 py-6 max-w-6xl mx-auto w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-xs font-black text-muted-foreground uppercase">Syncing Floor Data...</p>
                    </div>
                ) : machines.length === 0 ? (
                    <div className="text-center py-20 bg-muted/20 border-2 border-dashed border-border rounded-3xl">
                        <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <p className="text-foreground font-black uppercase">No Machines Found</p>
                        <p className="text-muted-foreground text-xs mt-1">Activate machines in the Owner app first.</p>
                    </div>
                ) : (
                    machines.map((machine) => {
                        const assignment = assignments.find((a) => a.machine_id === machine.id)
                        return (
                            <MachineUnifiedRow
                                key={machine.id}
                                machine={machine}
                                workers={workers}
                                orders={orders}
                                assignment={assignment}
                                metersValue={meters[machine.id] ?? 0}
                                onMetersChange={(v) => setMeters(prev => ({ ...prev, [machine.id]: v }))}
                                onStatusClick={setSelectedMachine}
                                onAssignmentChange={handleAssignmentChange}
                                isSyncing={syncingState[machine.id] === 'syncing'}
                                isSaved={syncingState[machine.id] === 'saved'}
                            />
                        )
                    })
                )}
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 md:left-[260px] p-4 md:p-6 bg-background/40 backdrop-blur-xl border-t border-border flex justify-center z-40 pb-floating-button">
                <Button
                    className="w-full max-w-lg h-14 bg-primary hover:bg-primary/90 text-white font-black text-lg rounded-2xl shadow-[0_12px_24px_-8px_#FF572280] gap-3 active:scale-[0.98] transition-all"
                    onClick={() => handleBulkSubmit()}
                    disabled={submitting || loggedMetersCount === 0}
                >
                    {submitting ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                        <ClipboardList className="h-6 w-6" />
                    )}
                    SUBMIT SHIFT LOGS {loggedMetersCount > 0 && `(${loggedMetersCount})`}
                </Button>
            </div>

            {/* Machine Detail Sheet */}
            <Sheet open={!!selectedMachine} onOpenChange={() => setSelectedMachine(null)}>
                <SheetContent side="bottom" className="rounded-t-[32px] max-h-[95vh] overflow-y-auto border-t-2 border-primary/20 bg-background pt-8 px-6 pb-12">
                    {selectedMachine && (() => {
                        const assignment = assignments.find(a => a.machine_id === selectedMachine.id)
                        return (
                            <MachineDetailSheet 
                                machine={selectedMachine} 
                                date={date}
                                shift={shift}
                                onClose={() => setSelectedMachine(null)}
                                initialCategory={assignment?.breakdown_category}
                                initialNotes={assignment?.breakdown_notes}
                                onStatusChange={(status) => {
                                    // Update local machine status optimistically
                                    setMachines(prev => prev.map(m => 
                                        m.id === selectedMachine.id ? { ...m, machine_status: status } : m
                                    ))
                                }}
                            />
                        )
                    })()}
                </SheetContent>
            </Sheet>

            {/* Duplicate Log Warning Dialog */}
            <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
                <DialogContent className="rounded-3xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600">
                            <AlertTriangle className="h-5 w-5" /> Existing Logs Found
                        </DialogTitle>
                        <DialogDescription>
                            Some machines already have production logs for this shift. Overwriting them requires an owner's access code.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Access Code</Label>
                            <Input
                                placeholder="ENTER 6-DIGIT CODE"
                                value={duplicateAccessCode}
                                onChange={(e) => setDuplicateAccessCode(e.target.value.toUpperCase())}
                                className="h-12 text-center font-mono text-xl tracking-[0.5em] font-black rounded-xl border-2"
                                maxLength={6}
                            />
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-primary font-bold gap-2 hover:bg-primary/5 h-10"
                            onClick={handleRequestCode}
                            disabled={requestingCode}
                        >
                            {requestingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                            Request Code from Owner
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button
                            className="w-full h-12 bg-primary hover:bg-primary/90 font-black rounded-xl"
                            disabled={duplicateAccessCode.length < 6 || submitting}
                            onClick={() => handleBulkSubmit(duplicateAccessCode)}
                        >
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            AUTHORIZE & OVERWRITE
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
