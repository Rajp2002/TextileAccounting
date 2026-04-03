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
    ChevronDown,
    Check,
    Sun,
    Moon,
    ClipboardList,
    RotateCcw,
    Save,
    AlertCircle,
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
} from '../actions'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from '@/components/ui/sheet'

// ─── Utility ─────────────────────────────────────────────────────────────────

function getCurrentShift(): 'day' | 'night' {
    const hour = new Date().getHours()
    // Day shift: 06:00 – 18:00, Night shift: 18:00 – 06:00
    return hour >= 6 && hour < 18 ? 'day' : 'night'
}

function getTodayString() {
    return format(new Date(), 'yyyy-MM-dd')
}

// ─── Machine Assignment Row ───────────────────────────────────────────────────

interface MachineRowProps {
    machine: any
    workers: any[]
    orders: any[]
    assignment: any
    onSave: (machineId: string, workerId: number | null, orderId: string | null, rate: number) => Promise<void>
    logMode: boolean
    metersValue: number
    onMetersChange: (v: number) => void
}

function MachineRow({
    machine,
    workers,
    orders,
    assignment,
    onSave,
    logMode,
    metersValue,
    onMetersChange,
}: MachineRowProps) {
    const [workerId, setWorkerId] = useState<string>(assignment?.worker_id?.toString() ?? '')
    const [orderId, setOrderId] = useState<string>(assignment?.order_id ?? '')
    const [rate, setRate] = useState<number>(
        assignment?.rate_per_m ?? Number(machine.default_rate_per_m ?? 1.5)
    )
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    // Sync when assignment changes (e.g. after copy)
    useEffect(() => {
        setWorkerId(assignment?.worker_id?.toString() ?? '')
        setOrderId(assignment?.order_id ?? '')
        setRate(assignment?.rate_per_m ?? Number(machine.default_rate_per_m ?? 1.5))
    }, [assignment, machine])

    const handleSave = async () => {
        setSaving(true)
        await onSave(
            machine.id,
            workerId ? parseInt(workerId) : null,
            orderId || null,
            rate
        )
        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    const selectedOrder = orders.find((o) => o.id === orderId)

    if (logMode) {
        return (
            <div className="flex items-center gap-3 bg-slate-800/70 border border-slate-700/50 rounded-xl p-3">
                {/* Machine name */}
                <div className="w-16 shrink-0">
                    <p className="text-xs font-bold text-white truncate">{machine.name}</p>
                    {assignment?.worker_id && (
                        <p className="text-[10px] text-slate-500 truncate">
                            {workers.find((w) => w.id === assignment.worker_id)?.name ?? '—'}
                        </p>
                    )}
                </div>

                {/* Order context */}
                {selectedOrder && (
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-slate-500 truncate">
                            {selectedOrder.quality_label ?? selectedOrder.party_name}
                        </p>
                    </div>
                )}

                {/* Meter input — large numpad style */}
                <div className="w-28 shrink-0">
                    <div className="relative">
                        <Input
                            type="number"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="0"
                            value={metersValue || ''}
                            onChange={(e) => onMetersChange(Number(e.target.value))}
                            className="h-14 text-2xl font-black text-center font-mono bg-slate-900 border-slate-600 text-white focus:border-indigo-500"
                        />
                        <span className="absolute right-2 bottom-1 text-[9px] text-slate-600">m</span>
                    </div>
                </div>
                {/* Rate display */}
                <div className="w-14 text-right shrink-0">
                    <p className="text-[10px] text-slate-500">Rate</p>
                    <p className="text-xs font-mono font-bold text-slate-300">₹{rate}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-slate-800/70 border border-slate-700/50 rounded-xl p-3 space-y-2.5">
            {/* Machine name */}
            <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white">{machine.name}</p>
                {saved && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Saved
                    </span>
                )}
            </div>

            {/* Worker select */}
            <div>
                <Label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1 block">
                    Worker
                </Label>
                <Select value={workerId} onValueChange={setWorkerId}>
                    <SelectTrigger className="h-11 bg-slate-900 border-slate-600 text-white text-sm">
                        <SelectValue placeholder="Assign worker…" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-white max-h-52">
                        {workers.map((w) => (
                            <SelectItem
                                key={w.id}
                                value={w.id.toString()}
                                className="focus:bg-slate-700 focus:text-white"
                            >
                                {w.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Order select */}
            <div>
                <Label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1 block">
                    Order
                </Label>
                <Select value={orderId} onValueChange={setOrderId}>
                    <SelectTrigger className="h-11 bg-slate-900 border-slate-600 text-white text-sm">
                        <SelectValue placeholder="Assign order…" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-white max-h-52">
                        {orders.map((o) => (
                            <SelectItem
                                key={o.id}
                                value={o.id}
                                className="focus:bg-slate-700 focus:text-white"
                            >
                                <span className="font-medium">{o.quality_label ?? 'Unnamed'}</span>
                                <span className="text-slate-400 text-xs ml-1">— {o.party_name}</span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {selectedOrder?.warp_instruction && (
                    <p className="text-[10px] text-slate-500 font-mono mt-1">
                        Warp: {selectedOrder.warp_instruction}
                        {selectedOrder.weft_instruction && (
                            <> · Weft: {selectedOrder.weft_instruction}</>
                        )}
                    </p>
                )}
            </div>

            {/* Rate + Save */}
            <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                    <Label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                        Rate (₹/m)
                    </Label>
                    <Input
                        type="number"
                        step={0.05}
                        value={rate}
                        onChange={(e) => setRate(Number(e.target.value))}
                        className="h-10 font-mono text-center bg-slate-900 border-slate-600 text-white text-sm"
                    />
                </div>
                <Button
                    className="h-10 bg-indigo-600 hover:bg-indigo-500 font-bold shrink-0 px-4"
                    onClick={handleSave}
                    disabled={saving || !workerId}
                >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
            </div>
        </div>
    )
}

// ─── Log Production Sheet ─────────────────────────────────────────────────────

function LogProductionSheet({
    open,
    onClose,
    machines,
    workers,
    orders,
    assignments,
    date,
    shift,
    onLogged,
}: {
    open: boolean
    onClose: () => void
    machines: any[]
    workers: any[]
    orders: any[]
    assignments: any[]
    date: string
    shift: 'day' | 'night'
    onLogged: () => void
}) {
    const [meters, setMeters] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(false)

    // Only machines that have an assignment
    const assignedMachines = machines.filter((m) =>
        assignments.some((a) => a.machine_id === m.id && a.worker_id)
    )

    const handleSubmit = async () => {
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
                    rate_per_m: assignment?.rate_per_m ?? Number(m.default_rate_per_m ?? 1.5),
                }
            })
            .filter((e) => e.worker_id && e.meters > 0)

        if (entries.length === 0) {
            toast.error('No meter readings entered')
            return
        }

        setLoading(true)
        const res = await bulkLogProduction(entries)
        setLoading(false)

        if (res.success) {
            toast.success(`✅ Logged production for ${res.logged} machine${(res.logged ?? 0) > 1 ? 's' : ''}`)
            setMeters({})
            onClose()
            onLogged()
        } else {
            toast.error(res.error ?? 'Failed to log production')
        }
    }

    const totalMeters = Object.values(meters).reduce((sum, v) => sum + (v ?? 0), 0)
    const totalWages = assignedMachines.reduce((sum, m) => {
        const assignment = assignments.find((a) => a.machine_id === m.id)
        const rate = assignment?.rate_per_m ?? Number(m.default_rate_per_m ?? 1.5)
        return sum + (meters[m.id] ?? 0) * rate
    }, 0)

    return (
        <Sheet open={open} onOpenChange={onClose}>
            <SheetContent
                side="bottom"
                className="bg-slate-900 border-slate-700 text-white rounded-t-2xl max-h-[92vh] overflow-y-auto"
            >
                <SheetHeader className="pb-3">
                    <SheetTitle className="text-white flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-indigo-400" />
                        Log Shift Production
                    </SheetTitle>
                    <p className="text-xs text-slate-500">
                        Enter meters produced per machine for the{' '}
                        <span className="text-white font-bold">{shift}</span> shift on{' '}
                        <span className="text-white font-bold">{format(new Date(date), 'dd MMM')}</span>
                    </p>
                </SheetHeader>

                {/* Totals strip */}
                {totalMeters > 0 && (
                    <div className="flex gap-3 bg-slate-800 rounded-xl p-3 mb-4">
                        <div className="flex-1 text-center">
                            <p className="text-[10px] text-slate-500">Total Meters</p>
                            <p className="text-xl font-black font-mono text-white">{totalMeters.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="w-px bg-slate-700" />
                        <div className="flex-1 text-center">
                            <p className="text-[10px] text-slate-500">Labor Liability</p>
                            <p className="text-xl font-black font-mono text-emerald-400">₹{totalWages.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                        </div>
                    </div>
                )}

                <div className="space-y-2 pb-4">
                    {assignedMachines.length === 0 ? (
                        <div className="text-center py-10">
                            <AlertCircle className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                            <p className="text-slate-500 text-sm">No machines assigned for this shift yet.</p>
                            <p className="text-slate-600 text-xs">Go back and assign workers first.</p>
                        </div>
                    ) : (
                        assignedMachines.map((m) => {
                            const assignment = assignments.find((a) => a.machine_id === m.id)
                            return (
                                <MachineRow
                                    key={m.id}
                                    machine={m}
                                    workers={workers}
                                    orders={orders}
                                    assignment={assignment}
                                    onSave={async () => {}}
                                    logMode
                                    metersValue={meters[m.id] ?? 0}
                                    onMetersChange={(v) =>
                                        setMeters((prev) => ({ ...prev, [m.id]: v }))
                                    }
                                />
                            )
                        })
                    )}
                </div>

                <SheetFooter className="gap-3 pt-2">
                    <Button
                        variant="outline"
                        className="flex-1 border-slate-700 text-slate-400"
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 font-bold gap-2"
                        onClick={handleSubmit}
                        disabled={loading || totalMeters === 0}
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <ClipboardList className="h-4 w-4" />
                        )}
                        Submit {totalMeters > 0 ? `(${totalMeters.toLocaleString('en-IN')}m)` : ''}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function ShiftSetupPage() {
    const today = getTodayString()
    const defaultShift = getCurrentShift()

    const [date, setDate] = useState(today)
    const [shift, setShift] = useState<'day' | 'night'>(defaultShift)
    const [loading, setLoading] = useState(true)
    const [copying, setCopying] = useState(false)
    const [showLogSheet, setShowLogSheet] = useState(false)

    const [machines, setMachines] = useState<any[]>([])
    const [workers, setWorkers] = useState<any[]>([])
    const [orders, setOrders] = useState<any[]>([])
    const [assignments, setAssignments] = useState<any[]>([])

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

    const handleSaveAssignment = async (
        machineId: string,
        workerId: number | null,
        orderId: string | null,
        rate: number
    ) => {
        const res = await upsertShiftAssignment({
            date,
            shift,
            machine_id: machineId,
            worker_id: workerId,
            order_id: orderId,
            rate_per_m: rate,
        })
        if (res.success) {
            // Optimistic: update local assignment
            setAssignments((prev) => {
                const next = prev.filter((a) => a.machine_id !== machineId)
                if (workerId) {
                    next.push({
                        machine_id: machineId,
                        worker_id: workerId,
                        order_id: orderId,
                        rate_per_m: rate,
                    })
                }
                return next
            })
        } else {
            toast.error(res.error ?? 'Failed to save assignment')
        }
    }

    const handleCopyPrevious = async () => {
        // Determine source: previous calendar day, same shift
        const sourceDate = format(subDays(new Date(date), 1), 'yyyy-MM-dd')
        const sourceShift = shift
        setCopying(true)
        const res = await copyPreviousShiftAction(date, shift, sourceDate, sourceShift)
        setCopying(false)
        if (res.success) {
            toast.success(`Copied ${res.copied} assignments from yesterday's ${shift} shift`)
            fetchData()
        } else {
            toast.error(res.error ?? 'No previous shift data found')
        }
    }

    const assignedCount = assignments.filter((a) => a.worker_id).length

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3">
                <div className="max-w-2xl mx-auto space-y-3">
                    {/* Title + Copy */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-lg font-black text-white">Shift Setup</h1>
                            <p className="text-xs text-slate-500">
                                {assignedCount}/{machines.length} machines assigned
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-slate-700 text-slate-300 hover:text-white text-xs gap-1.5"
                                onClick={handleCopyPrevious}
                                disabled={copying}
                            >
                                {copying ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                )}
                                Copy Yesterday
                            </Button>
                            <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-500 font-bold text-xs gap-1.5"
                                onClick={() => setShowLogSheet(true)}
                                disabled={assignedCount === 0}
                            >
                                <ClipboardList className="h-3.5 w-3.5" />
                                Log Meters
                            </Button>
                        </div>
                    </div>

                    {/* Date + Shift selector */}
                    <div className="flex gap-2">
                        <Input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="flex-1 h-10 bg-slate-800 border-slate-700 text-white text-sm"
                        />
                        <Button
                            variant={shift === 'day' ? 'default' : 'outline'}
                            size="sm"
                            className={`h-10 gap-1.5 ${shift === 'day' ? 'bg-amber-500 hover:bg-amber-400 text-white border-none' : 'border-slate-700 text-slate-400'}`}
                            onClick={() => setShift('day')}
                        >
                            <Sun className="h-3.5 w-3.5" /> Day
                        </Button>
                        <Button
                            variant={shift === 'night' ? 'default' : 'outline'}
                            size="sm"
                            className={`h-10 gap-1.5 ${shift === 'night' ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-none' : 'border-slate-700 text-slate-400'}`}
                            onClick={() => setShift('night')}
                        >
                            <Moon className="h-3.5 w-3.5" /> Night
                        </Button>
                    </div>
                </div>
            </div>

            {/* Machine list */}
            <div className="px-4 py-4 max-w-2xl mx-auto space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                    </div>
                ) : machines.length === 0 ? (
                    <div className="text-center py-20 space-y-2">
                        <p className="text-slate-400">No active machines found.</p>
                        <p className="text-slate-600 text-sm">Add machines in the owner dashboard first.</p>
                    </div>
                ) : (
                    machines.map((machine) => {
                        const assignment = assignments.find((a) => a.machine_id === machine.id)
                        return (
                            <MachineRow
                                key={machine.id}
                                machine={machine}
                                workers={workers}
                                orders={orders}
                                assignment={assignment}
                                onSave={handleSaveAssignment}
                                logMode={false}
                                metersValue={0}
                                onMetersChange={() => {}}
                            />
                        )
                    })
                )}
            </div>

            <LogProductionSheet
                open={showLogSheet}
                onClose={() => setShowLogSheet(false)}
                machines={machines}
                workers={workers}
                orders={orders}
                assignments={assignments}
                date={date}
                shift={shift}
                onLogged={fetchData}
            />
        </div>
    )
}
