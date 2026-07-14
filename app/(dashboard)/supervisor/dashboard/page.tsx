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
    ChevronLeft,
    ChevronRight,
    MessageSquare,
    AlertTriangle,
    KeyRound,
    Zap,
    Pause,
} from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { subDays } from 'date-fns'
import { getCurrentSuratHour, getCurrentTimestampMs, getSuratTodayString, formatToSurat } from '@/lib/time'
import {
    getShiftSetupData,
    copyPreviousShiftAction,
    bulkLogProduction,
    updateMachineStatus,
    updateMachineBreakdown,
    requestAccessCode,
} from '../actions'
import {
    isSuspiciousProductionMeters,
    SUSPICIOUS_PRODUCTION_METERS_THRESHOLD,
    ZERO_METER_REASONS,
    ZERO_METER_REASON_LABELS,
    type ZeroMeterReason,
} from '@/lib/production-log-validation'
import {
    countRestoredUnsavedDraftMeters,
    getProductionMetersDraftKey,
    parseProductionMetersDraft,
} from '@/lib/production-drafts'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetFooter,
    SheetDescription,
    SheetTitle,
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
import { useQueryClient } from '@tanstack/react-query'
import {
    productionSubmissionMatchesPersistedState,
    runMutationWithTimeout,
} from '@/lib/mutation-outcome'

// ─── Utility ─────────────────────────────────────────────────────────────────

function getCurrentShift(): 'day' | 'night' {
    const hour = getCurrentSuratHour()
    return hour >= 6 && hour < 18 ? 'day' : 'night'
}

function getTodayString() {
    return getSuratTodayString()
}

function moveDateByDays(date: string, days: number) {
    const [year, month, day] = date.split('-').map(Number)
    const next = new Date(Date.UTC(year, month - 1, day + days))
    return next.toISOString().slice(0, 10)
}

function getRemainingCorrectionMinutes(expiresAt: string | null, nowMs: number | null) {
    if (!expiresAt) return 0
    if (!nowMs) return 0
    const remainingMs = Date.parse(expiresAt) - nowMs
    return Math.max(0, Math.ceil(remainingMs / 60000))
}

function formatShortDate(date: string | null | undefined) {
    if (!date) return null
    const parsed = new Date(`${date}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return null
    return formatToSurat(parsed, 'dd MMM')
}

function formatMeters(value: number | null | undefined) {
    const meters = Math.max(Number(value ?? 0), 0)
    if (meters >= 1000) return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)}k m`
    return `${Math.round(meters)} m`
}

function formatLoomName(name: string) {
    return name.replace(/^Machine\b/i, 'Loom')
}

const PRODUCTION_LOG_FALLBACK_ERROR = 'Could not save production log. Your entry is still saved as a draft. Check your connection and try again.'

interface ReadinessIssue {
    id: string
    label: string
    count: number
    tone: 'blocker' | 'warning'
}

type MachineStatus = 'running' | 'idle' | 'maintenance'

type ShiftMachine = {
    id: string
    name: string
    status: string
    machine_status: MachineStatus | null
    default_rate_per_m?: number | null
    current_order_id?: string | null
}

type ShiftWorker = {
    id: number
    name: string
}

type ShiftOrder = {
    id: string
    quality_label: string | null
    party_name: string
    deadline: string
    market_run_id?: string | null
    remaining_meters: number
}

type ShiftAssignment = {
    id: string | null
    machine_id: string
    worker_id: number | null
    operator_assignment_id?: string | null
    operator_worker_type?: 'meter_worker' | 'fixed_worker' | null
    meter_worker_id?: number | null
    fixed_worker_id?: number | null
    operator_name?: string | null
    operator_pay_mode?: 'per_meter' | 'fixed_monthly' | 'fixed_daily' | 'fixed_shift' | null
    operator_rate?: number | null
    machine_type?: string | null
    order_id: string | null
    rate_per_m: number
    breakdown_category: string | null
    breakdown_notes: string | null
}

type ShiftExistingLog = {
    id: number
    machine_id: string
    worker_id?: number | null
    meters: number
    submitted_at: string | null
    zero_meter_reason: string | null
}

type RestoredDraftInfo = {
    count: number
}

type LargeMeterEntry = {
    machineId: string
    machineName: string
    meters: number
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
    machine: ShiftMachine
    workers: ShiftWorker[]
    orders: ShiftOrder[]
    assignment: ShiftAssignment | undefined
    producedMeters: number
    onProducedMetersChange: (v: number) => void
    onStatusClick: (machine: ShiftMachine) => void
    isSyncing?: boolean
    isSaved?: boolean
    loggingMode: 'production' | 'downtime'
    onLoggingModeChange: (mode: 'production' | 'downtime') => void
    downtimeReason: string
    onDowntimeReasonChange: (reason: string) => void
    downtimeNote: string
    onDowntimeNoteChange: (note: string) => void
    existingLog?: ShiftExistingLog
}

function MachineUnifiedRow({
    machine,
    workers,
    orders,
    assignment,
    producedMeters,
    onProducedMetersChange,
    onStatusClick,
    isSyncing,
    isSaved,
    loggingMode,
    onLoggingModeChange,
    downtimeReason,
    onDowntimeReasonChange,
    downtimeNote,
    onDowntimeNoteChange,
    existingLog,
}: MachineUnifiedRowProps) {
    const { t } = useTranslation()
    const workerId = assignment?.worker_id?.toString() ?? ''
    const hasOperator = Boolean(assignment?.operator_assignment_id || assignment?.worker_id || assignment?.fixed_worker_id || assignment?.meter_worker_id)
    const operatorName = assignment?.operator_name
        || workers.find((w) => w.id.toString() === workerId)?.name
        || ''
    const orderId = assignment?.order_id ?? ''
    const status = (machine.machine_status || 'idle') as 'running' | 'idle' | 'maintenance'

    const selectedTarget = orders.find((o) => o.id === orderId)
    const isMaintenance = status === 'maintenance'
    const isDowntime = loggingMode === 'downtime'
    const deadlineLabel = selectedTarget ? formatShortDate(selectedTarget.deadline) : null

    const getDowntimeLabel = (reasonStr: string | null) => {
        if (!reasonStr) return 'Downtime'
        const parts = reasonStr.split(':')
        const code = parts[0].trim()
        const label = ZERO_METER_REASON_LABELS[code as ZeroMeterReason] || code
        if (parts.length > 1) {
            const detail = parts.slice(1).join(':').trim()
            if (detail) {
                return `${label} (${detail})`
            }
        }
        return label
    }

    return (
        <div className={cn(
            "relative flex flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-[var(--shadow-card)] transition-all duration-200 hover:border-hairline-strong",
            isMaintenance && !isDowntime && "opacity-75"
        )}>
            {existingLog && (
                <div className="bg-success-soft/30 border-b border-success-soft text-success text-[13px] font-semibold px-4 py-2.5 flex items-center justify-between animate-in fade-in slide-in-from-top duration-300">
                    <span className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 stroke-[3px]" />
                        {existingLog.meters > 0
                            ? `Already logged: ${existingLog.meters} m`
                            : `Already logged: Downtime (${getDowntimeLabel(existingLog.zero_meter_reason)})`}
                    </span>
                    <span className="text-[10px] text-success/70 font-normal">
                        {existingLog.submitted_at && `at ${formatToSurat(new Date(existingLog.submitted_at), 'h:mm a')}`}
                    </span>
                </div>
            )}

            <div className="relative flex flex-col lg:flex-row items-stretch gap-0 flex-1">
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

                {/* Assignments + Mode Toggle Section */}
                <div className="flex-1 min-w-0 p-4 lg:p-3 py-4 flex flex-col justify-center gap-3 lg:gap-2">
                    {/* Production / Downtime Toggle */}
                    <div className="flex rounded-lg border border-hairline bg-surface-soft p-0.5">
                        <button
                            onClick={() => onLoggingModeChange('production')}
                            className={cn(
                                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150",
                                !isDowntime
                                    ? "bg-surface text-saffron-deep shadow-sm ring-1 ring-hairline"
                                    : "text-muted-foreground hover:text-ink"
                            )}
                        >
                            <Zap className="h-3.5 w-3.5" /> Production
                        </button>
                        <button
                            onClick={() => onLoggingModeChange('downtime')}
                            className={cn(
                                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150",
                                isDowntime
                                    ? "bg-warning-soft text-warning shadow-sm ring-1 ring-warning-soft"
                                    : "text-muted-foreground hover:text-ink"
                            )}
                        >
                            <Pause className="h-3.5 w-3.5" /> Downtime
                        </button>
                    </div>

                    {!isDowntime && (
                        <>
                            {/* Worker Display */}
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="flex h-8 w-8 lg:h-6 lg:w-6 shrink-0 items-center justify-center rounded-md bg-saffron-soft/70">
                                    <Users className="h-4 w-4 lg:h-3.5 lg:w-3.5 text-saffron-deep" />
                                </div>
                                <span className="truncate text-sm font-semibold text-ink">
                                    {operatorName || t('production.no_worker')}
                                </span>
                            </div>

                            {/* Cost Analysis / Quality Display */}
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="flex h-8 w-8 lg:h-6 lg:w-6 shrink-0 items-center justify-center rounded-md bg-surface-soft">
                                    <Package className="h-4 w-4 lg:h-3.5 lg:w-3.5 text-muted-foreground" />
                                </div>
                                <span className="truncate text-sm font-medium leading-tight text-muted-foreground">
                                    {selectedTarget ? (
                                        <>
                                            <span className="font-semibold text-ink">{selectedTarget.quality_label || selectedTarget.party_name}</span>
                                            <span className="ml-1 text-xs opacity-75">— {selectedTarget.market_run_id ? 'Market Run' : selectedTarget.party_name}</span>
                                        </>
                                    ) : (
                                        "No cost analysis / quality"
                                    )}
                                </span>
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
                        </>
                    )}

                    {isDowntime && (
                        <>
                            {/* Downtime Reason Dropdown */}
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="flex h-8 w-8 lg:h-6 lg:w-6 shrink-0 items-center justify-center rounded-md bg-warning-soft/70">
                                    <Pause className="h-4 w-4 lg:h-3.5 lg:w-3.5 text-warning" />
                                </div>
                                <Select
                                    value={downtimeReason}
                                    onValueChange={onDowntimeReasonChange}
                                >
                                    <SelectTrigger className="h-11 lg:h-9 max-w-full truncate border border-hairline bg-surface px-3 text-sm font-semibold shadow-none transition-colors focus:ring-0">
                                        <SelectValue placeholder="Select downtime reason" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ZERO_METER_REASONS.map((reason) => (
                                            <SelectItem key={reason} value={reason}>
                                                {ZERO_METER_REASON_LABELS[reason]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Note input for "other" reason */}
                            {downtimeReason === 'other' && (
                                <div className="ml-10 lg:ml-8">
                                    <Input
                                        placeholder="Describe the reason…"
                                        value={downtimeNote}
                                        onChange={(e) => onDowntimeNoteChange(e.target.value)}
                                        className="h-10 text-sm"
                                    />
                                </div>
                            )}

                            {/* Optional worker/order in downtime (collapsed) */}
                            <div className="ml-10 lg:ml-8 flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                <span className="rounded-full bg-warning-soft/60 px-2.5 py-1 lg:py-0.5 text-warning">
                                    0 m — downtime
                                </span>
                                {hasOperator && (
                                    <span className="rounded-full bg-surface-soft px-2.5 py-1 lg:py-0.5">
                                        {operatorName || 'Worker'}
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Production Input (The Quick Log) — only shown in production mode */}
                {!isDowntime && (
                    <div className={cn(
                        "flex flex-col lg:flex-row w-full lg:w-auto items-center justify-center border-t lg:border-t-0 lg:border-l border-hairline bg-surface-soft/35 p-4 lg:p-3",
                        (!hasOperator || !orderId) && "opacity-55"
                    )}>
                        <div className="flex w-full flex-col items-center gap-3 lg:gap-2">
                            {(!hasOperator || !orderId) ? (
                                <div className="flex h-11 lg:h-12 flex-col items-center justify-center px-1 text-center text-xs font-semibold leading-tight text-muted-foreground/70 animate-in fade-in duration-500">
                                     {!hasOperator ? t('production.no_worker') : 'Select cost analysis / quality'}
                                     <AlertCircle className="h-4 w-4 mt-1 opacity-40" />
                                </div>
                            ) : (
                                <>
                                    <div className={cn(
                                        "group/input flex h-11 w-full items-center overflow-hidden rounded-lg border bg-surface transition-all duration-200 lg:h-9 lg:w-auto",
                                        producedMeters > 0 ? "border-saffron ring-4 ring-saffron/10" : "border-hairline shadow-sm"
                                    )}>
                                        <Input
                                            aria-label={`${formatLoomName(machine.name)} shift production metres`}
                                            type="number"
                                            inputMode="decimal"
                                            pattern="[0-9]*"
                                            placeholder="0"
                                            value={producedMeters || ''}
                                            onChange={(e) => onProducedMetersChange(Number(e.target.value))}
                                            className="h-full min-w-0 flex-1 border-none bg-transparent py-0 pl-6 pr-1 text-center font-mono text-lg font-semibold focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                        />
                                        <span className="pr-3 text-xs font-bold text-muted-foreground">m</span>
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
                )}

                {/* Detail Sheet Indicator (Desktop only) */}
                <button
                    onClick={() => onStatusClick(machine)}
                    className="absolute right-2 top-2 p-1 text-muted-foreground/35 transition-colors hover:text-saffron-deep hidden lg:block"
                    title="Loom details"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
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
    machine: ShiftMachine,
    date: string,
    shift: 'day' | 'night',
    onClose: () => void,
    onStatusChange: (status: MachineStatus) => void,
    initialCategory?: string | null,
    initialNotes?: string | null
}) {
    const [notes, setNotes] = useState(initialNotes ?? '')
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
                    <SheetTitle className="text-2xl font-semibold text-ink">
                        {formatLoomName(machine.name)}
                    </SheetTitle>
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
    const queryClient = useQueryClient()
    const [date, setDate] = useState(getTodayString())
    const [shift, setShift] = useState<'day' | 'night'>('day')
    const profileOrgId = userProfile?.org_id ?? null
    const profileUserId = userProfile?.userId ?? null
    const selectedDraftKey = profileOrgId && profileUserId
        ? getProductionMetersDraftKey({ orgId: profileOrgId, userId: profileUserId, date, shift })
        : null
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [copying, setCopying] = useState(false)
    const submitLockRef = useRef(false)
    const fetchRequestRef = useRef(0)
    const selectedDraftKeyRef = useRef(selectedDraftKey)
    selectedDraftKeyRef.current = selectedDraftKey

    const [machines, setMachines] = useState<ShiftMachine[]>([])
    const [workers, setWorkers] = useState<ShiftWorker[]>([])
    const [orders, setOrders] = useState<ShiftOrder[]>([])
    const [assignments, setAssignments] = useState<ShiftAssignment[]>([])
    const [existingLogs, setExistingLogs] = useState<ShiftExistingLog[]>([])

    // Bulk Entry state
    const [productionMeters, setProductionMeters] = useState<Record<string, number>>({})
    const [productionMetersDraftKey, setProductionMetersDraftKey] = useState<string | null>(null)
    const [restoredDraftInfo, setRestoredDraftInfo] = useState<RestoredDraftInfo | null>(null)
    const [largeMeterEntries, setLargeMeterEntries] = useState<LargeMeterEntry[]>([])
    const [largeMeterPendingCode, setLargeMeterPendingCode] = useState('')
    const [largeMeterConfirmationKey, setLargeMeterConfirmationKey] = useState<string | null>(null)
    const [showLargeMeterDialog, setShowLargeMeterDialog] = useState(false)
    const [correctionWindowExpiresAt, setCorrectionWindowExpiresAt] = useState<string | null>(null)
    const [correctionClockMs, setCorrectionClockMs] = useState<number | null>(null)

    // Optimistic / Sync markers
    const [syncingState] = useState<Record<string, 'syncing' | 'saved' | null>>({})

    // Detail Sheet state
    const [selectedMachine, setSelectedMachine] = useState<ShiftMachine | null>(null)

    // Duplicate Guard State
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
    const [duplicateAccessCode, setDuplicateAccessCode] = useState('')
    const [requestingCode, setRequestingCode] = useState(false)

    // Downtime / Production mode per machine
    const [loggingModes, setLoggingModes] = useState<Record<string, 'production' | 'downtime'>>({})
    const [downtimeReasons, setDowntimeReasons] = useState<Record<string, string>>({})
    const [downtimeNotes, setDowntimeNotes] = useState<Record<string, string>>({})

    // ─── Pull to Refresh Logic ────────────────────────────────────────────────
    const [pullDistance, setPullDistance] = useState(0)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const touchStartRef = useRef<number | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setShift(getCurrentShift())
    }, [])

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
        if (!selectedDraftKey) return
        if (productionMetersDraftKey !== selectedDraftKey) return
        if (Object.keys(productionMeters).length > 0) localStorage.setItem(selectedDraftKey, JSON.stringify(productionMeters))
        else localStorage.removeItem(selectedDraftKey)
    }, [productionMeters, productionMetersDraftKey, selectedDraftKey, loading])

    useEffect(() => {
        if (!correctionWindowExpiresAt) {
            setCorrectionClockMs(null)
            return
        }

        setCorrectionClockMs(getCurrentTimestampMs())
        const interval = window.setInterval(() => {
            setCorrectionClockMs(getCurrentTimestampMs())
        }, 30000)

        return () => window.clearInterval(interval)
    }, [correctionWindowExpiresAt])

    const fetchData = useCallback(async () => {
        const requestId = fetchRequestRef.current + 1
        fetchRequestRef.current = requestId
        const requestedDate = date
        const requestedShift = shift
        const requestedDraftKey = selectedDraftKey

        setLoading(true)
        const data = await getShiftSetupData(requestedDate, requestedShift)

        if (fetchRequestRef.current !== requestId) return
        if (selectedDraftKeyRef.current !== requestedDraftKey) return

        setMachines(data.machines)
        setWorkers(data.workers)
        setOrders(data.orders)
        setAssignments(data.assignments)
        setExistingLogs(data.existingLogs ?? [])
        setCorrectionWindowExpiresAt(data.latestSubmittedAt
            ? new Date(new Date(data.latestSubmittedAt).getTime() + 30 * 60 * 1000).toISOString()
            : null
        )

        const existingProductionMeters = (data.existingLogs ?? []).reduce((acc: Record<string, number>, log: ShiftExistingLog) => {
            if (typeof log.meters === 'number') {
                acc[log.machine_id] = log.meters
            }
            return acc
        }, {})

        const draftKey = requestedDraftKey
        const cached = draftKey ? localStorage.getItem(draftKey) : null
        if (cached) {
            try {
                const restoredMeters = parseProductionMetersDraft(cached)
                setProductionMeters(restoredMeters)
                setProductionMetersDraftKey(draftKey)
                const unsavedCount = countRestoredUnsavedDraftMeters(restoredMeters, existingProductionMeters)
                setRestoredDraftInfo(unsavedCount > 0 ? { count: unsavedCount } : null)
            } catch (error) {
                console.error('Failed to parse cached production metre drafts', error)
                setProductionMeters(existingProductionMeters)
                setProductionMetersDraftKey(draftKey)
                setRestoredDraftInfo(null)
            }
        } else {
            setProductionMeters(existingProductionMeters)
            setProductionMetersDraftKey(draftKey)
            setRestoredDraftInfo(null)
        }

        // Auto-map machine status to downtime mode defaults
        const initialModes: Record<string, 'production' | 'downtime'> = {}
        const initialReasons: Record<string, string> = {}
        for (const m of data.machines) {
            if (m.machine_status === 'maintenance') {
                initialModes[m.id] = 'downtime'
                initialReasons[m.id] = 'maintenance'
            } else if (m.machine_status === 'idle') {
                initialModes[m.id] = 'downtime'
                initialReasons[m.id] = 'machine_idle'
            } else {
                initialModes[m.id] = 'production'
            }
        }
        setLoggingModes(initialModes)
        setDowntimeReasons(initialReasons)
        setDowntimeNotes({})

        setLoading(false)
    }, [date, shift, selectedDraftKey])

    useEffect(() => { fetchData() }, [fetchData])

    const resetShiftDraftState = (nextDate: string, nextShift: 'day' | 'night') => {
        setLoading(true)
        setProductionMeters({})
        setProductionMetersDraftKey(profileOrgId && profileUserId
            ? getProductionMetersDraftKey({ orgId: profileOrgId, userId: profileUserId, date: nextDate, shift: nextShift })
            : null
        )
        setRestoredDraftInfo(null)
        setLargeMeterEntries([])
        setLargeMeterPendingCode('')
        setLargeMeterConfirmationKey(null)
        setShowLargeMeterDialog(false)
        setCorrectionWindowExpiresAt(null)
        setShowDuplicateDialog(false)
        setDuplicateAccessCode('')
        setLoggingModes({})
        setDowntimeReasons({})
        setDowntimeNotes({})
        setExistingLogs([])
    }

    const handleDateChange = (nextDate: string) => {
        if (nextDate === date) return
        resetShiftDraftState(nextDate, shift)
        setDate(nextDate)
    }

    const handleShiftChange = (nextShift: 'day' | 'night') => {
        if (nextShift === shift) return
        resetShiftDraftState(date, nextShift)
        setShift(nextShift)
    }



    const handleBulkSubmit = async (
        code: string = '',
        options: { confirmedLargeMeters?: boolean } = {}
    ) => {
        if (submitLockRef.current || submitting) return

        if (loading) {
            toast.error('Shift data is still loading. Please try again in a moment.')
            return
        }

        // Build production entries (mode === 'production' with meters > 0)
        const productionEntries = machines
            .filter((m) => (loggingModes[m.id] ?? 'production') === 'production')
            .map((m) => {
                const assignment = assignments.find((a) => a.machine_id === m.id)
                const metersProduced = productionMeters[m.id] ?? 0
                return {
                    machine_id: m.id,
                    worker_id: assignment?.worker_id ?? null,
                    operator_assignment_id: assignment?.operator_assignment_id ?? null,
                    operator_worker_type: assignment?.operator_worker_type ?? null,
                    meter_worker_id: assignment?.meter_worker_id ?? null,
                    fixed_worker_id: assignment?.fixed_worker_id ?? null,
                    operator_pay_mode: assignment?.operator_pay_mode ?? null,
                    operator_rate: assignment?.operator_rate ?? assignment?.rate_per_m ?? null,
                    machine_type: assignment?.machine_type ?? null,
                    order_id: assignment?.order_id ?? null,
                    meters: metersProduced,
                    opening_meter_reading: 0,
                    closing_meter_reading: metersProduced,
                    counter_was_reset: false,
                    shift,
                    date,
                    rate_per_m: assignment?.rate_per_m,
                    zero_meter_reason: null as string | null,
                    zero_meter_note: null as string | null,
                }
            })
            .filter((e) => (e.operator_assignment_id || e.worker_id) && e.order_id && e.meters > 0)

        // Build downtime entries (mode === 'downtime' with valid reason)
        const downtimeEntries = machines
            .filter((m) => loggingModes[m.id] === 'downtime')
            .map((m) => {
                const assignment = assignments.find((a) => a.machine_id === m.id)
                const reason = downtimeReasons[m.id] ?? ''
                const note = downtimeNotes[m.id] ?? ''
                return {
                    machine_id: m.id,
                    worker_id: assignment?.worker_id ?? null,
                    operator_assignment_id: assignment?.operator_assignment_id ?? null,
                    operator_worker_type: assignment?.operator_worker_type ?? null,
                    meter_worker_id: assignment?.meter_worker_id ?? null,
                    fixed_worker_id: assignment?.fixed_worker_id ?? null,
                    operator_pay_mode: assignment?.operator_pay_mode ?? null,
                    operator_rate: assignment?.operator_rate ?? assignment?.rate_per_m ?? null,
                    machine_type: assignment?.machine_type ?? null,
                    order_id: assignment?.order_id ?? null,
                    meters: 0,
                    opening_meter_reading: 0,
                    closing_meter_reading: 0,
                    counter_was_reset: false,
                    shift,
                    date,
                    rate_per_m: 0,
                    zero_meter_reason: reason || null,
                    zero_meter_note: (reason === 'other' ? note : null) as string | null,
                }
            })
            .filter((e) => {
                const reason = e.zero_meter_reason?.trim()
                if (!reason) return false
                if (reason === 'other' && !e.zero_meter_note?.trim()) return false
                return true
            })

        const entries = [...productionEntries, ...downtimeEntries]

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

        const suspiciousEntries = productionEntries
            .filter((entry) => isSuspiciousProductionMeters(entry.meters))
            .map((entry) => ({
                machineId: entry.machine_id,
                machineName: formatLoomName(machines.find((machine) => machine.id === entry.machine_id)?.name ?? 'Loom'),
                meters: entry.meters,
            }))
        const suspiciousKey = `${date}_${shift}:${suspiciousEntries
            .map((entry) => `${entry.machineId}:${entry.meters}`)
            .sort()
            .join('|')}`

        if (
            suspiciousEntries.length > 0 &&
            !options.confirmedLargeMeters &&
            largeMeterConfirmationKey !== suspiciousKey
        ) {
            setLargeMeterEntries(suspiciousEntries)
            setLargeMeterPendingCode(code)
            setShowLargeMeterDialog(true)
            return
        }

        if (suspiciousEntries.length > 0 && options.confirmedLargeMeters) {
            setLargeMeterConfirmationKey(suspiciousKey)
            setShowLargeMeterDialog(false)
        }

        submitLockRef.current = true
        setSubmitting(true)
        try {
            const outcome = await runMutationWithTimeout(() => bulkLogProduction(entries, code))
            let res

            if (outcome.status === 'unknown') {
                toast.warning('Connection timed out. The save outcome is unknown. Checking the server before retrying…')
                const reconciled = await getShiftSetupData(date, shift)
                const committed = productionSubmissionMatchesPersistedState(entries, reconciled.existingLogs ?? [])

                if (!committed) {
                    await fetchData()
                    toast.warning('We could not confirm whether this shift was saved. Do not submit it again yet; refresh and check the shift first.')
                    return
                }

                res = {
                    success: true as const,
                    logged: reconciled.existingLogs?.length ?? entries.length,
                    correctionWindowExpiresAt: reconciled.latestSubmittedAt
                        ? new Date(new Date(reconciled.latestSubmittedAt).getTime() + 30 * 60 * 1000).toISOString()
                        : null,
                }
                toast.success('The response timed out, but the shift was saved. Server state has been reconciled.')
            } else {
                res = outcome.value
            }

            if (!res?.success) {
                const message = res?.message || res?.error || "Could not save production log."
                const err = new Error(message) as Error & { code?: string }
                err.code = res?.error
                throw err
            }

            if (outcome.status === 'completed') {
                toast.success(`Metres Produced This Shift saved (${res.logged} looms)`)
            }
            setProductionMeters({}) // Reset inputs after success
            setRestoredDraftInfo(null)
            setLargeMeterEntries([])
            setLargeMeterPendingCode('')
            setLargeMeterConfirmationKey(null)
            setShowLargeMeterDialog(false)
            if (selectedDraftKey) localStorage.removeItem(selectedDraftKey) // Clear cache
            setShowDuplicateDialog(false)
            setDuplicateAccessCode('')
            setCorrectionWindowExpiresAt(res.correctionWindowExpiresAt ?? null)
            void queryClient.invalidateQueries({ queryKey: ['payroll_meter'] })
            void queryClient.invalidateQueries({ queryKey: ['payroll_fixed'] })
            fetchData()
        } catch (error: unknown) {
            console.error('Failed to submit production logs:', error)
            const message = error instanceof Error ? error.message : ''
            const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
            if (code === 'DUPLICATE_LOG_DETECTED' || message === 'DUPLICATE_LOG_DETECTED') {
                setShowDuplicateDialog(true)
            } else if (error instanceof Error) {
                toast.error(error.message || PRODUCTION_LOG_FALLBACK_ERROR)
            } else {
                toast.error(PRODUCTION_LOG_FALLBACK_ERROR)
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
            if (result.delivery === 'manual_owner_handoff') {
                toast.info(t('auth.code_manual_fallback'))
            } else {
                toast.success(t('auth.code_requested_success'))
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to request code')
        } finally {
            setRequestingCode(false)
        }
    }

    const handleCopyPrevious = async () => {
        const sourceDate = formatToSurat(subDays(new Date(date), 1), 'yyyy-MM-dd')
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

    const assignedCount = assignments.filter((a) => a.operator_assignment_id || a.worker_id).length
    const loggedMetersCount = Object.keys(productionMeters).filter((machineId) => (productionMeters[machineId] ?? 0) > 0).length
    const validEntryCount = machines.filter((machine) => {
        const mode = loggingModes[machine.id] ?? 'production'
        if (mode === 'downtime') {
            const reason = downtimeReasons[machine.id]?.trim()
            if (!reason) return false
            if (reason === 'other' && !downtimeNotes[machine.id]?.trim()) return false
            return true
        }
        // Production mode
        const assignment = assignments.find((a) => a.machine_id === machine.id)
        return Boolean(
            (assignment?.operator_assignment_id || assignment?.worker_id) &&
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
                return (machine.machine_status === 'running' || hasMeters) && !(assignment?.operator_assignment_id || assignment?.worker_id)
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
    const remainingCorrectionMinutes = getRemainingCorrectionMinutes(correctionWindowExpiresAt, correctionClockMs)
    const correctionBannerText = remainingCorrectionMinutes > 0
        ? t('floor.correction.windowOpen').replace('{minutes}', remainingCorrectionMinutes.toString())
        : t('floor.correction.windowClosed')
    const hasShiftSetup = assignedCount > 0
    const pendingEntryCount = Math.max(machines.length - validEntryCount, 0)
    const saveHelperText = loading
        ? 'Loading shift data...'
        : validEntryCount === 0
            ? 'Add Metres Produced This Shift or downtime reasons to save.'
            : pendingEntryCount > 0
                ? `${validEntryCount} ready, ${pendingEntryCount} pending`
                : 'All loom entries ready'

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

                    {restoredDraftInfo && (
                        <div className="rounded-xl border border-info-soft bg-info-soft px-4 py-3 text-sm font-medium text-info shadow-sm">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                <div>
                                    <p className="font-semibold">Restored unsaved draft</p>
                                    <p className="mt-1 text-xs font-medium leading-5 text-info/85">
                                        {restoredDraftInfo.count} shift-meter {restoredDraftInfo.count === 1 ? 'entry was' : 'entries were'} restored from this device and have not been saved yet.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold leading-tight tracking-normal text-ink">Metres Produced This Shift</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary">
                                    {assignedCount}/{machines.length} assigned
                                </Badge>
                                {loggedMetersCount > 0 && (
                                    <Badge variant="brand" className="shadow-sm animate-in fade-in zoom-in duration-300">
                                        {loggedMetersCount} shift-production entries
                                    </Badge>
                                )}
                            </div>
                        </div>
                        {hasShiftSetup ? (
                            <Badge variant="success" className="h-10 gap-1.5 px-3 text-xs">
                                <Check className="h-3.5 w-3.5" />
                                Setup ready
                            </Badge>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-10 gap-2 px-4 text-xs"
                                onClick={handleCopyPrevious}
                                disabled={copying}
                            >
                                {copying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                                Copy previous
                            </Button>
                        )}
                    </div>

                    <div className="grid gap-2 xs:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="flex min-w-0 items-center gap-1">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                aria-label="Previous production day"
                                className="h-11 w-11 shrink-0"
                                onClick={() => handleDateChange(moveDateByDays(date, -1))}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Input
                                aria-label="Production date"
                                type="date"
                                max={getTodayString()}
                                value={date}
                                onChange={(e) => handleDateChange(e.target.value)}
                                className="h-11 min-w-0 flex-1 rounded-lg bg-surface text-sm font-semibold"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                aria-label="Next production day"
                                className="h-11 w-11 shrink-0"
                                disabled={date >= getTodayString()}
                                onClick={() => handleDateChange(moveDateByDays(date, 1))}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
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
                        <p className="mt-1 text-xs text-muted-foreground">Activate looms in setup before recording Metres Produced This Shift.</p>
                    </div>
                ) : (
                    machines.map((machine) => {
                        const assignment = assignments.find((a) => a.machine_id === machine.id)
                        const existingLog = existingLogs.find((l) => l.machine_id === machine.id)
                        return (
                            <MachineUnifiedRow
                                key={machine.id}
                                machine={machine}
                                workers={workers}
                                orders={orders}
                                assignment={assignment}
                                producedMeters={productionMeters[machine.id] ?? 0}
                                onProducedMetersChange={(v) => {
                                    setProductionMetersDraftKey(selectedDraftKey)
                                    setProductionMeters(prev => ({ ...prev, [machine.id]: v }))
                                }}
                                onStatusClick={setSelectedMachine}
                                isSyncing={syncingState[machine.id] === 'syncing'}
                                isSaved={syncingState[machine.id] === 'saved'}
                                loggingMode={loggingModes[machine.id] ?? 'production'}
                                onLoggingModeChange={(mode) => setLoggingModes(prev => ({ ...prev, [machine.id]: mode }))}
                                downtimeReason={downtimeReasons[machine.id] ?? ''}
                                onDowntimeReasonChange={(reason) => setDowntimeReasons(prev => ({ ...prev, [machine.id]: reason }))}
                                downtimeNote={downtimeNotes[machine.id] ?? ''}
                                onDowntimeNoteChange={(note) => setDowntimeNotes(prev => ({ ...prev, [machine.id]: note }))}
                                existingLog={existingLog}
                            />
                        )
                    })
                )}
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center border-t border-border bg-canvas/76 p-4 backdrop-blur-xl pb-floating-button md:left-[248px] md:p-6">
                <div className="flex w-full max-w-xl flex-col gap-2">
                    <div className="flex items-center justify-between px-1 text-xs font-semibold text-body">
                        <span>{saveHelperText}</span>
                        {!loading && machines.length > 0 && (
                            <span className="text-muted-foreground">{validEntryCount}/{machines.length}</span>
                        )}
                    </div>
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
                        {validEntryCount > 0 ? `Save shift logs (${validEntryCount})` : 'Save shift logs'}
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

            {/* Suspicious Large Meter Confirmation Dialog */}
            <Dialog open={showLargeMeterDialog} onOpenChange={setShowLargeMeterDialog}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-warning">
                            <AlertTriangle className="h-5 w-5" /> Confirm large shift production
                        </DialogTitle>
                        <DialogDescription>
                            One or more loom totals are at least {SUSPICIOUS_PRODUCTION_METERS_THRESHOLD.toLocaleString('en-IN')} m for this shift. This is allowed, but confirm the totals before saving.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 rounded-lg border border-warning-soft bg-warning-soft/60 p-3">
                        {largeMeterEntries.map((entry) => (
                            <div key={entry.machineId} className="flex items-center justify-between gap-3 text-sm">
                                <span className="font-semibold text-ink">{entry.machineName}</span>
                                <span className="font-mono font-semibold text-warning">{entry.meters.toLocaleString('en-IN')} m</span>
                            </div>
                        ))}
                    </div>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button
                            variant="outline"
                            className="h-11 flex-1 rounded-lg font-semibold"
                            onClick={() => setShowLargeMeterDialog(false)}
                        >
                            Review totals
                        </Button>
                        <Button
                            className="h-11 flex-1 rounded-lg font-semibold"
                            disabled={submitting}
                            onClick={() => handleBulkSubmit(largeMeterPendingCode, { confirmedLargeMeters: true })}
                        >
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                            Confirm and save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
