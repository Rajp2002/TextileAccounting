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
import { useUserProfile } from '@/hooks/use-user-profile'
import { RoleBanner } from '@/components/RoleBanner'

// ─── Utility ─────────────────────────────────────────────────────────────────

function getCurrentShift(): 'day' | 'night' {
    const hour = new Date().getHours()
    return hour >= 6 && hour < 18 ? 'day' : 'night'
}

function getTodayString() {
    return format(new Date(), 'yyyy-MM-dd')
}

function getRemainingCorrectionMinutes(expiresAt: string | null) {
    if (!expiresAt) return 0
    const remainingMs = new Date(expiresAt).getTime() - Date.now()
    return Math.max(0, Math.ceil(remainingMs / 60000))
}

function formatShortDate(date: string | null | undefined) {
    if (!date) return null
    const parsed = new Date(`${date}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return null
    return format(parsed, 'dd MMM')
}

function formatMeters(value: number | null | undefined) {
    const meters = Math.max(Number(value ?? 0), 0)
    if (meters >= 1000) return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)}k m`
    return `${Math.round(meters)} m`
}

function formatLoomName(name: string) {
    return name.replace(/^Machine\b/i, 'Loom')
}

interface ReadinessIssue {
    id: string
    label: string
    count: number
    tone: 'blocker' | 'warning'
}

function ShiftReadinessPanel({
    issues,
    validEntryCount,
    machineCount,
}: {
    issues: ReadinessIssue[]
    validEntryCount: number
    machineCount: number
}) {
    const blockerCount = issues.filter((issue) => issue.tone === 'blocker').reduce((sum, issue) => sum + issue.count, 0)
    const totalIssueCount = issues.reduce((sum, issue) => sum + issue.count, 0)

    return (
        <div className={cn(
            "rounded-xl border px-4 py-3 shadow-sm transition-colors",
            issues.length === 0
                ? "border-success-soft bg-success-soft"
                : blockerCount > 0
                    ? "border-warning-soft bg-warning-soft"
                    : "border-info-soft bg-info-soft"
        )}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className={cn(
                        "text-[11px] font-semibold uppercase tracking-wide",
                        issues.length === 0 ? "text-success" : blockerCount > 0 ? "text-warning" : "text-info"
                    )}>
                        Shift readiness
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                        {issues.length === 0
                            ? "Ready to submit when meter entries are done"
                            : `${blockerCount || totalIssueCount} item${(blockerCount || totalIssueCount) === 1 ? '' : 's'} need attention`}
                    </p>
                </div>
                <Badge variant={issues.length === 0 ? "success" : blockerCount > 0 ? "warning" : "info"} className="shrink-0 text-xs">
                    {validEntryCount}/{machineCount} logs
                </Badge>
            </div>

            {issues.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {issues.map((issue) => (
                        <span
                            key={issue.id}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border bg-white/70 px-2.5 py-1 text-xs font-semibold",
                                issue.tone === 'blocker'
                                    ? "border-warning-soft text-warning"
                                    : "border-info-soft text-info"
                            )}
                        >
                            <AlertCircle className="h-3 w-3" />
                            {issue.count} {issue.label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Status Badge Component ──────────────────────────────────────────────────

function MachineStatusBadge({ status }: { status: 'running' | 'idle' | 'maintenance' }) {
    switch (status) {
        case 'running':
            return (
                <Badge variant="success">
                    Running
                </Badge>
            )
        case 'maintenance':
            return (
                <Badge variant="warning">
                    Maintenance
                </Badge>
            )
        default:
            return (
                <Badge variant="outline">
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
    producedMeters: number
    onProducedMetersChange: (v: number) => void
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
    producedMeters,
    onProducedMetersChange,
    onStatusClick,
    onAssignmentChange,
    isSyncing,
    isSaved,
}: MachineUnifiedRowProps) {
    const { t } = useTranslation()
    const workerId = assignment?.worker_id?.toString() ?? ''
    const orderId = assignment?.order_id ?? ''
    const status = (machine.machine_status || 'idle') as 'running' | 'idle' | 'maintenance'

    const selectedTarget = orders.find((o) => o.id === orderId)
    const isMaintenance = status === 'maintenance'
    const deadlineLabel = selectedTarget ? formatShortDate(selectedTarget.deadline) : null

    return (
        <div className={cn(
            "relative flex flex-col lg:flex-row items-stretch gap-0 overflow-hidden rounded-2xl border border-hairline bg-surface shadow-[var(--shadow-card)] transition-all duration-200 hover:border-hairline-strong",
            isMaintenance && "opacity-75"
        )}>
            {/* Status Strip & Detail Trigger (Header on mobile, side strip on desktop) */}
            <button
                onClick={() => onStatusClick(machine)}
                className={cn(
                    "relative flex flex-row lg:flex-col w-full lg:w-16 shrink-0 items-center justify-between lg:justify-center gap-1.5 border-b lg:border-b-0 lg:border-r border-hairline transition-all hover:bg-surface-soft p-3 lg:p-1",
                    status === 'running' ? "bg-success-soft/50" : status === 'maintenance' ? "bg-warning-soft/60" : "bg-surface-soft/50",
                    isSyncing && "animate-pulse"
                )}
            >
                {/* Left Status Bar (Desktop only) */}
                <div className={cn(
                    "absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full hidden lg:block",
                    status === 'running' ? "bg-success" :
                    status === 'maintenance' ? "bg-warning" :
                    "bg-hairline-strong"
                )} />

                <div className="flex flex-row lg:flex-col items-center justify-between lg:justify-center w-full px-1">
                    <div className="flex items-center gap-2 lg:flex-col lg:gap-1">
                        <p className="text-sm font-semibold leading-none text-ink lg:text-[10px]">
                            {formatLoomName(machine.name)}
                        </p>
                        <div className="lg:hidden">
                            <MachineStatusBadge status={status} />
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {isSyncing ? (
                            <Loader2 className="h-4 w-4 animate-spin text-saffron" />
                        ) : isSaved ? (
                            <div className="rounded-full bg-success p-0.5 shadow-sm animate-in zoom-in duration-300">
                                 <Check className="h-3 w-3 text-white stroke-[4px]" />
                            </div>
                        ) : (
                            <div className={cn(
                                "w-2.5 h-2.5 rounded-full hidden lg:block",
                                status === 'running' ? "bg-success" :
                                status === 'maintenance' ? "bg-warning" :
                                "bg-hairline-strong"
                            )} />
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground/35 lg:hidden" />
                    </div>
                </div>
            </button>

            {/* Assignments Section */}
            <div className="flex-1 min-w-0 p-4 lg:p-3 py-4 flex flex-col justify-center gap-3 lg:gap-2">
                {/* Worker Dropdown */}
                <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 lg:h-6 lg:w-6 shrink-0 items-center justify-center rounded-md bg-saffron-soft/70">
                        <Users className="h-4 w-4 lg:h-3.5 lg:w-3.5 text-saffron-deep" />
                    </div>
                    <Select
                        value={workerId}
                        onValueChange={(val) => onAssignmentChange(machine.id, parseInt(val), orderId || null)}
                    >
                        <SelectTrigger className="h-11 lg:h-9 max-w-full truncate border border-hairline lg:border-none bg-surface lg:bg-transparent px-3 lg:p-0 text-sm font-semibold shadow-none transition-colors hover:text-saffron-deep focus:ring-0">
                            <SelectValue placeholder={t('production.no_worker')} />
                        </SelectTrigger>
                        <SelectContent>
                            {workers.map((w) => (
                                <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Cost Analysis / Quality Dropdown */}
                <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 lg:h-6 lg:w-6 shrink-0 items-center justify-center rounded-md bg-surface-soft">
                        <Package className="h-4 w-4 lg:h-3.5 lg:w-3.5 text-muted-foreground" />
                    </div>
                    <Select
                        value={orderId}
                        onValueChange={(val) => onAssignmentChange(machine.id, workerId ? parseInt(workerId) : null, val)}
                    >
                        <SelectTrigger className="h-11 lg:h-9 max-w-full truncate border border-hairline lg:border-none bg-surface lg:bg-transparent px-3 lg:p-0 text-sm font-medium leading-tight text-muted-foreground shadow-none transition-colors hover:text-ink focus:ring-0">
                            <SelectValue placeholder="Select cost analysis / quality" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                            {orders.map((o) => (
                                <SelectItem key={o.id} value={o.id}>
                                    <span className="font-bold">{o.quality_label || o.party_name}</span>
                                    <span className="ml-1 opacity-60">— {o.market_run_id ? 'Market Run' : o.party_name}</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {selectedTarget && (
                    <div className="ml-10 lg:ml-8 flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <span className="rounded-full bg-surface-soft px-2.5 py-1 lg:py-0.5">
                            {formatMeters(selectedTarget.remaining_meters)} left
                        </span>
                        {deadlineLabel && (
                            <span className="rounded-full bg-surface-soft px-2.5 py-1 lg:py-0.5">
                                Due {deadlineLabel}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Production Input (The Quick Log) */}
            <div className={cn(
                "flex flex-col lg:flex-row w-full lg:w-auto items-center justify-center border-t lg:border-t-0 lg:border-l border-hairline bg-surface-soft/35 p-4 lg:p-3",
                (!workerId || !orderId) && "opacity-55"
            )}>
                <div className="flex w-full flex-col items-center gap-3 lg:gap-2">
                    {(!workerId || !orderId) ? (
                        <div className="flex h-11 lg:h-12 flex-col items-center justify-center px-1 text-center text-xs font-semibold leading-tight text-muted-foreground/70 animate-in fade-in duration-500">
                             {!workerId ? t('production.no_worker') : 'Select cost analysis / quality'}
                             <AlertCircle className="h-4 w-4 mt-1 opacity-40" />
                        </div>
                    ) : (
                        <>
                            <div className={cn(
                                "group/input flex items-center overflow-hidden rounded-lg border bg-surface transition-all duration-200 w-full lg:w-auto h-11 lg:h-9",
                                producedMeters > 0 ? "border-saffron ring-4 ring-saffron/10" : "border-hairline shadow-sm"
                            )}>
                                <Input
                                    type="number"
                                    inputMode="decimal"
                                    pattern="[0-9]*"
                                    placeholder="0"
                                    value={producedMeters || ''}
                                    onChange={(e) => onProducedMetersChange(Number(e.target.value))}
                                    className="h-full flex-1 border-none bg-transparent p-0 text-center font-mono text-lg font-semibold focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                            </div>
                            <div className="flex w-full flex-col items-center gap-2 lg:gap-1">
                                <div className="flex max-w-full items-center gap-1 rounded-full border border-hairline bg-surface px-2.5 py-1 lg:py-0.5 shadow-sm">
                                    <span className="text-center text-xs font-semibold uppercase tracking-wide leading-tight text-saffron-deep">
                                        {t('floor.meter.shiftProduction')}
                                    </span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Detail Sheet Indicator (Desktop only) */}
            <button
                onClick={() => onStatusClick(machine)}
                className="absolute right-2 top-2 p-1 text-muted-foreground/35 transition-colors hover:text-saffron-deep hidden lg:block"
                title="Loom details"
            >
                <ChevronRight className="h-4 w-4" />
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
            toast.success(`Loom status updated to ${status}`)
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
                    <p className="text-2xl font-semibold text-ink">{formatLoomName(machine.name)}</p>
                    <MachineStatusBadge status={machine.machine_status || 'idle'} />
                </div>
                <SheetDescription>
                    Manage loom status and record breakdown notes for this shift.
                </SheetDescription>
            </SheetHeader>

            <div className="py-6 space-y-8">
                {/* Status Toggle Buttons */}
                <div className="space-y-3">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Change status</Label>
                    <div className="grid grid-cols-3 gap-2">
                        <Button
                            variant="outline"
                            className={cn(
                                "h-16 flex flex-col gap-1 border font-semibold",
                                machine.machine_status === 'running' && "border-success-soft bg-success-soft text-success"
                            )}
                            onClick={() => handleStatusUpdate('running')}
                            disabled={saving}
                        >
                            <Check className="h-5 w-5" />
                            <span className="text-xs">Running</span>
                        </Button>
                        <Button
                            variant="outline"
                            className={cn(
                                "h-16 flex flex-col gap-1 border font-semibold",
                                machine.machine_status === 'idle' && "border-hairline-strong bg-surface-soft text-ink"
                            )}
                            onClick={() => handleStatusUpdate('idle')}
                            disabled={saving}
                        >
                            <Moon className="h-5 w-5" />
                            <span className="text-xs">Idle</span>
                        </Button>
                        <Button
                            variant="outline"
                            className={cn(
                                "h-16 flex flex-col gap-1 border font-semibold",
                                machine.machine_status === 'maintenance' && "border-warning-soft bg-warning-soft text-warning"
                            )}
                            onClick={() => handleStatusUpdate('maintenance')}
                            disabled={saving}
                        >
                            <Settings className="h-5 w-5" />
                            <span className="text-xs">Service</span>
                        </Button>
                    </div>
                </div>

                {/* Categories Toggles */}
                <div className="space-y-3">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Breakdown category</Label>
                    <div className="flex flex-wrap gap-2">
                        {categories.map((cat) => {
                            const Icon = cat.icon
                            const active = category === cat.id
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setCategory(active ? null : cat.id)}
                                    className={cn(
                                        "flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-all",
                                        active
                                            ? "border-saffron-soft bg-saffron-soft text-saffron-deep"
                                            : "border-hairline text-muted-foreground hover:border-saffron-soft hover:text-saffron-deep"
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
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reason / supervisor note</Label>
                    <div className="relative">
                        <textarea
                            className="h-32 w-full resize-none rounded-lg border border-hairline bg-surface p-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-saffron/20"
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
                    className="h-12 w-full gap-2 font-semibold"
                    disabled={saving}
                    onClick={handleSaveBreakdown}
                >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save and close
                </Button>
            </SheetFooter>
        </>
    )
}

// ─── MAIN DASHBOARD ──────────────────────────────────────────────────────────────

export default function UnifiedDashboard() {
    const { t } = useTranslation()
    const { data: userProfile } = useUserProfile()
    const [date, setDate] = useState(getTodayString())
    const [shift, setShift] = useState<'day' | 'night'>(getCurrentShift())
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [copying, setCopying] = useState(false)
    const submitLockRef = useRef(false)

    const [machines, setMachines] = useState<any[]>([])
    const [workers, setWorkers] = useState<any[]>([])
    const [orders, setOrders] = useState<any[]>([])
    const [assignments, setAssignments] = useState<any[]>([])

    // Bulk Entry state
    const [productionMeters, setProductionMeters] = useState<Record<string, number>>({})
    const [correctionWindowExpiresAt, setCorrectionWindowExpiresAt] = useState<string | null>(null)
    const [, setCountdownTick] = useState(0)

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

    // Save to localStorage whenever production metre drafts change
    useEffect(() => {
        if (loading) return // Prevent overwriting drafts during transitions
        const key = `production_meters_${date}_${shift}`
        if (Object.keys(productionMeters).length > 0) localStorage.setItem(key, JSON.stringify(productionMeters))
        else localStorage.removeItem(key)
    }, [productionMeters, date, shift, loading])

    useEffect(() => {
        if (!correctionWindowExpiresAt) return

        const interval = window.setInterval(() => {
            setCountdownTick((prev) => prev + 1)
        }, 30000)

        return () => window.clearInterval(interval)
    }, [correctionWindowExpiresAt])

    const fetchData = useCallback(async () => {
        setLoading(true)
        const data = await getShiftSetupData(date, shift)
        setMachines(data.machines)
        setWorkers(data.workers)
        setOrders(data.orders)
        setAssignments(data.assignments)
        setCorrectionWindowExpiresAt(data.latestSubmittedAt
            ? new Date(new Date(data.latestSubmittedAt).getTime() + 30 * 60 * 1000).toISOString()
            : null
        )

        const existingProductionMeters = (data.existingLogs ?? []).reduce((acc: Record<string, number>, log: any) => {
            if (typeof log.meters === 'number') {
                acc[log.machine_id] = log.meters
            }
            return acc
        }, {})

        const cached = localStorage.getItem(`production_meters_${date}_${shift}`)
        if (cached) {
            try {
                setProductionMeters(JSON.parse(cached))
            } catch (error) {
                console.error('Failed to parse cached production metre drafts', error)
                setProductionMeters(existingProductionMeters)
            }
        } else {
            setProductionMeters(existingProductionMeters)
        }
        setLoading(false)
    }, [date, shift])

    useEffect(() => { fetchData() }, [fetchData])

    const resetShiftDraftState = () => {
        setLoading(true)
        setProductionMeters({})
        setCorrectionWindowExpiresAt(null)
        setShowDuplicateDialog(false)
        setDuplicateAccessCode('')
    }

    const handleDateChange = (nextDate: string) => {
        if (nextDate === date) return
        resetShiftDraftState()
        setDate(nextDate)
    }

    const handleShiftChange = (nextShift: 'day' | 'night') => {
        if (nextShift === shift) return
        resetShiftDraftState()
        setShift(nextShift)
    }

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
            if (workerId || orderId) {
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

            // Clear meters locally if worker or order was unassigned
            if (!workerId || !orderId) {
                setProductionMeters(prev => {
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
        if (submitLockRef.current || submitting) return

        if (loading) {
            toast.error('Shift data is still loading. Please try again in a moment.')
            return
        }

        const assignedMachines = machines.filter((m) =>
            assignments.some((a) => a.machine_id === m.id && a.worker_id)
        )

        const entries = assignedMachines
            .map((m) => {
                const assignment = assignments.find((a) => a.machine_id === m.id)
                const metersProduced = productionMeters[m.id] ?? 0
                return {
                    machine_id: m.id,
                    worker_id: assignment?.worker_id,
                    order_id: assignment?.order_id ?? null,
                    meters: metersProduced,
                    opening_meter_reading: 0,
                    closing_meter_reading: metersProduced,
                    counter_was_reset: false,
                    shift,
                    date,
                    rate_per_m: assignment?.rate_per_m,
                    zero_meter_reason: [assignment?.breakdown_category, assignment?.breakdown_notes].filter(Boolean).join(': ') || null,
                }
            })
            .filter((e) => e.worker_id && e.order_id && (e.meters > 0 || Boolean(e.zero_meter_reason)))

        const negativeMeters = Object.values(productionMeters).filter((meters) => meters < 0)
        if (negativeMeters.length > 0) {
            toast.error('Production metres cannot be negative.')
            return
        }

        if (entries.length === 0) {
            // Check if any machines HAVE readings but were filtered out due to missing order
            const machinesWithMetersButNoOrder = machines.filter(m =>
                (productionMeters[m.id] ?? 0) > 0 && !assignments.find(a => a.machine_id === m.id)?.order_id
            )

            if (machinesWithMetersButNoOrder.length > 0) {
                toast.error(`Cannot log production for ${machinesWithMetersButNoOrder.length} looms: no cost analysis or quality is assigned.`)
            } else {
                toast.error('No valid production metres found. Ensure both a worker and a cost analysis or quality are assigned to each loom.')
            }
            return
        }

        submitLockRef.current = true
        setSubmitting(true)
        try {
            const res = await bulkLogProduction(entries, code)

            if (!res?.success) {
                const message = res?.message || res?.error || "Could not save production log."
                const err = new Error(message) as Error & { code?: string }
                err.code = res?.error
                throw err
            }

            toast.success(`Shift meters logged (${res.logged} looms)`)
            setProductionMeters({}) // Reset inputs after success
            localStorage.removeItem(`production_meters_${date}_${shift}`) // Clear cache
            setShowDuplicateDialog(false)
            setDuplicateAccessCode('')
            setCorrectionWindowExpiresAt(res.correctionWindowExpiresAt ?? null)
            fetchData()
        } catch (error: unknown) {
            console.error('Failed to submit production logs:', error)
            const message = error instanceof Error ? error.message : ''
            const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
            if (code === 'DUPLICATE_LOG_DETECTED' || message === 'DUPLICATE_LOG_DETECTED') {
                setShowDuplicateDialog(true)
            } else {
                toast.error(message || 'Could not save production log. Your entry is still saved as a draft. Check your connection and try again.')
            }
        } finally {
            setSubmitting(false)
            submitLockRef.current = false
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
    const loggedMetersCount = Object.keys(productionMeters).filter((machineId) => (productionMeters[machineId] ?? 0) > 0).length
    const validEntryCount = machines.filter((machine) => {
        const assignment = assignments.find((a) => a.machine_id === machine.id)
        return Boolean(
            assignment?.worker_id &&
            assignment?.order_id &&
            (productionMeters[machine.id] ?? 0) > 0
        )
    }).length
    const readinessChecks: ReadinessIssue[] = [
        {
            id: 'missing-worker',
            label: 'without worker',
            count: machines.filter((machine) => {
                const assignment = assignments.find((a) => a.machine_id === machine.id)
                const hasMeters = (productionMeters[machine.id] ?? 0) > 0
                return (machine.machine_status === 'running' || hasMeters) && !assignment?.worker_id
            }).length,
            tone: 'blocker',
        },
        {
            id: 'missing-order',
            label: 'without order',
            count: machines.filter((machine) => {
                const assignment = assignments.find((a) => a.machine_id === machine.id)
                const hasMeters = (productionMeters[machine.id] ?? 0) > 0
                return (machine.machine_status === 'running' || hasMeters) && !assignment?.order_id
            }).length,
            tone: 'blocker',
        },
        {
            id: 'running-no-reading',
            label: 'running no metres',
            count: machines.filter((machine) => machine.machine_status === 'running' && (productionMeters[machine.id] ?? 0) <= 0).length,
            tone: 'warning',
        },
        {
            id: 'maintenance-note',
            label: 'service no note',
            count: machines.filter((machine) => {
                if (machine.machine_status !== 'maintenance') return false
                const assignment = assignments.find((a) => a.machine_id === machine.id)
                return !assignment?.breakdown_category && !assignment?.breakdown_notes
            }).length,
            tone: 'warning',
        },
    ]
    const readinessIssues = readinessChecks.filter((issue) => issue.count > 0)
    const remainingCorrectionMinutes = getRemainingCorrectionMinutes(correctionWindowExpiresAt)
    const correctionBannerText = remainingCorrectionMinutes > 0
        ? t('floor.correction.windowOpen').replace('{minutes}', remainingCorrectionMinutes.toString())
        : t('floor.correction.windowClosed')

    return (
        <div
            ref={containerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="flex min-h-[90vh] select-none flex-col pb-32"
        >
            {/* Pull to Refresh Indicator */}
            <div
                className="ptr-indicator overflow-hidden transition-[height] duration-200"
                style={{ height: `${pullDistance}px`, opacity: pullDistance / 60 }}
            >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-saffron-deep">
                    <Loader2 className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                    {isRefreshing ? 'Updating...' : 'Pull to refresh'}
                </div>
            </div>

            {/* Header - Sticky with safe padding */}
            <div className="sticky top-0 z-30 rounded-b-xl border border-t-0 border-hairline bg-canvas/95 px-4 py-4 pt-safe shadow-[var(--shadow-card)] backdrop-blur-md md:top-4 md:rounded-xl md:border">
                <div className="max-w-6xl mx-auto space-y-4">
                    {userProfile?.role === 'owner' && (
                        <RoleBanner href="/owner/analytics" />
                    )}

                    {correctionWindowExpiresAt && (
                        <div className={cn(
                            "rounded-xl border px-4 py-3 text-sm font-medium shadow-sm",
                            remainingCorrectionMinutes > 0
                                ? "border-success-soft bg-success-soft text-success"
                                : "border-warning-soft bg-warning-soft text-warning"
                        )}>
                            {correctionBannerText}
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-normal text-ink">Shift Meter Log</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary">
                                    {assignedCount}/{machines.length} assigned
                                </Badge>
                                {loggedMetersCount > 0 && (
                                    <Badge variant="brand" className="shadow-sm animate-in fade-in zoom-in duration-300">
                                        {loggedMetersCount} meter entries
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 gap-2 px-4 text-xs"
                            onClick={handleCopyPrevious}
                            disabled={copying || assignments.length > 0}
                        >
                            {copying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                            Copy previous
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        <Input
                            type="date"
                            value={date}
                            onChange={(e) => handleDateChange(e.target.value)}
                            className="h-11 flex-1 rounded-lg bg-surface text-sm font-semibold"
                        />
                        <div className="flex shrink-0 rounded-lg border border-hairline bg-surface-soft p-1">
                            <button
                                onClick={() => handleShiftChange('day')}
                                className={cn(
                                    "flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold transition-all duration-150",
                                    shift === 'day' ? "bg-surface text-saffron-deep shadow-sm ring-1 ring-hairline" : "text-muted-foreground hover:text-ink"
                                )}
                            >
                                <Sun className="h-4 w-4" /> Day
                            </button>
                            <button
                                onClick={() => handleShiftChange('night')}
                                className={cn(
                                    "flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold transition-all duration-150",
                                    shift === 'night' ? "bg-loom text-white shadow-sm" : "text-muted-foreground hover:text-ink"
                                )}
                            >
                                <Moon className="h-4 w-4" /> Night
                            </button>
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                        {t('floor.meter.counterHelper')}
                    </p>

                    <ShiftReadinessPanel
                        issues={readinessIssues}
                        validEntryCount={validEntryCount}
                        machineCount={machines.length}
                    />
                </div>
            </div>

            {/* Machine List - Responsive Grid */}
            <div className="mx-auto w-full max-w-6xl px-1 py-6 md:px-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                {loading ? (
                    <div className="col-span-full flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-hairline bg-surface/70 py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-saffron" />
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Syncing floor data...</p>
                    </div>
                ) : machines.length === 0 ? (
                    <div className="col-span-full rounded-xl border border-dashed border-hairline bg-surface/70 py-20 text-center">
                        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                        <p className="font-semibold text-ink">No looms found</p>
                        <p className="mt-1 text-xs text-muted-foreground">Activate looms in setup before logging shift meters.</p>
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
                                producedMeters={productionMeters[machine.id] ?? 0}
                                onProducedMetersChange={(v) => setProductionMeters(prev => ({ ...prev, [machine.id]: v }))}
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

            <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center border-t border-border bg-canvas/76 p-4 backdrop-blur-xl pb-floating-button md:left-[248px] md:p-6">
                <div className="flex w-full max-w-xl gap-3">
                    <Button
                        className="h-14 flex-1 gap-3 rounded-xl text-base font-semibold"
                        onClick={() => handleBulkSubmit()}
                        disabled={loading || submitting || validEntryCount === 0}
                    >
                        {loading || submitting ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                            <ClipboardList className="h-6 w-6" />
                        )}
                        Save shift logs {validEntryCount > 0 && `(${validEntryCount})`}
                    </Button>
                </div>
            </div>

            {/* Machine Detail Sheet */}
            <Sheet open={!!selectedMachine} onOpenChange={() => setSelectedMachine(null)}>
                <SheetContent side="bottom" className="max-h-[95vh] overflow-y-auto rounded-t-xl border-t border-hairline bg-surface px-6 pb-12 pt-8">
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
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-warning">
                            <AlertTriangle className="h-5 w-5" /> Existing logs found
                        </DialogTitle>
                        <DialogDescription>
                            Some looms already have production logs for this shift. Overwriting them requires an owner access code.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Access code</Label>
                            <Input
                                placeholder="Enter 6-digit code"
                                value={duplicateAccessCode}
                                onChange={(e) => setDuplicateAccessCode(e.target.value.toUpperCase())}
                                className="h-12 rounded-lg text-center font-mono text-xl font-semibold tracking-[0.5em]"
                                maxLength={6}
                            />
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-10 w-full gap-2 font-semibold text-saffron-deep"
                            onClick={handleRequestCode}
                            disabled={requestingCode}
                        >
                            {requestingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                            Request Code from Owner
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button
                            className="h-12 w-full rounded-lg font-semibold"
                            disabled={loading || duplicateAccessCode.length < 6 || submitting}
                            onClick={() => handleBulkSubmit(duplicateAccessCode)}
                        >
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Authorize and overwrite
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}
