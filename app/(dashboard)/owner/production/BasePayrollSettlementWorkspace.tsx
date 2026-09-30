'use client'

import { useTranslation } from '@/lib/i18n/context'

import { useDeferredValue, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowRight,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Info,
    Loader2,
    Search,
    WalletCards,
    X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SwitchField } from '@/components/ui/switch-field'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatINR } from '@/lib/finance'
import {
    calculateBasePayrollPeriodSummary,
    type BasePayrollPaymentMode,
    type BasePayrollPeriod,
    type BaseProductionWorker,
    type BaseWorkerPayable,
} from '@/lib/base-production-core'
import { basePayrollReview } from '@/lib/base-payroll-review'
import {
    completeBasePayrollPeriod,
    reverseBasePayrollSettlement,
    settleBaseWorkerPayroll,
} from './actions'

type WorkerTypeFilter = 'all' | 'piece_rate' | 'fixed_monthly'

function formatDateOnly(value: string | null | undefined) {
    if (!value) return '—'
    const [year, month, day] = value.slice(0, 10).split('-').map(Number)
    if (![year, month, day].every(Number.isFinite)) return value
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
    }).format(new Date(Date.UTC(year, month - 1, day)))
}

function formatMeters(value: number) {
    return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)} m`
}

function paymentModeLabel(mode: BasePayrollPaymentMode | null | undefined) {
    if (mode === 'bank_transfer') return 'Bank transfer'
    if (mode === 'upi') return 'UPI'
    if (mode === 'cheque') return 'Cheque'
    return 'Cash'
}

export default function BasePayrollSettlementWorkspace({
    open,
    onOpenChange,
    period,
    payables: externalPayables,
    periodRecord: externalPeriodRecord,
    workers,
    readinessByWorker,
    defaultPaymentMode,
    onSuccess,
    onViewRecords,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    period: { start: string; end: string; label: string }
    payables: BaseWorkerPayable[]
    periodRecord?: BasePayrollPeriod | null
    workers: BaseProductionWorker[]
    readinessByWorker: Map<string, { issueCount: number; readyToSettle: boolean }>
    defaultPaymentMode: BasePayrollPaymentMode
    onSuccess?: () => void
    onViewRecords?: () => void
}) {
    const { t, tx } = useTranslation()
    const router = useRouter()

    // Local mutable state for optimistic live updates
    const [localPayables, setLocalPayables] = useState<BaseWorkerPayable[]>(externalPayables)
    const [localPeriodRecord, setLocalPeriodRecord] = useState<BasePayrollPeriod | null>(externalPeriodRecord ?? null)
    const [resolvedWorkerIds, setResolvedWorkerIds] = useState<string[]>(
        externalPeriodRecord?.resolved_worker_ids ?? []
    )

    // Sync when external props change and workspace is opened/closed
    const [prevExternalPayables, setPrevExternalPayables] = useState(externalPayables)
    if (externalPayables !== prevExternalPayables) {
        setPrevExternalPayables(externalPayables)
        setLocalPayables(externalPayables)
    }

    const [prevExternalPeriodRecord, setPrevExternalPeriodRecord] = useState(externalPeriodRecord)
    if (externalPeriodRecord !== prevExternalPeriodRecord) {
        setPrevExternalPeriodRecord(externalPeriodRecord)
        setLocalPeriodRecord(externalPeriodRecord ?? null)
        const externalIds = externalPeriodRecord?.resolved_worker_ids ?? []
        setResolvedWorkerIds((prev) => Array.from(new Set([...externalIds, ...prev])))
    }

    const [prevOpen, setPrevOpen] = useState(open)
    if (open !== prevOpen) {
        setPrevOpen(open)
        if (open) {
            setLocalPayables(externalPayables)
            setLocalPeriodRecord(externalPeriodRecord ?? null)
            const externalIds = externalPeriodRecord?.resolved_worker_ids ?? []
            setResolvedWorkerIds((prev) => Array.from(new Set([...externalIds, ...prev])))
        }
    }
    const workerById = useMemo(
        () => new Map(workers.map((w) => [w.id, w])),
        [workers]
    )

    // Filters
    const [typeFilter, setTypeFilter] = useState<WorkerTypeFilter>('all')
    const [outstandingOnly, setOutstandingOnly] = useState(false)
    const [search, setSearch] = useState('')
    const deferredSearch = useDeferredValue(search)

    // Expanded rows
    const [expandedWorkerIds, setExpandedWorkerIds] = useState<Set<string>>(new Set())

    // Modals
    const [payingWorkerId, setPayingWorkerId] = useState<string | null>(null)
    const [paymentMode, setPaymentMode] = useState<BasePayrollPaymentMode>(defaultPaymentMode)
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
    const [paymentNote, setPaymentNote] = useState('')
    const [isPaying, setIsPaying] = useState(false)

    // Viewing payment details & Reopening
    const [viewingWorkerId, setViewingWorkerId] = useState<string | null>(null)
    const [reopenConfirmOpen, setReopenConfirmOpen] = useState(false)
    const [reversalReason, setReversalReason] = useState('')
    const [paymentNotMade, setPaymentNotMade] = useState(false)
    const [isReversing, setIsReversing] = useState(false)

    // Completion modal & Success state
    const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false)
    const [isCompleting, setIsCompleting] = useState(false)
    const [completedSuccess, setCompletedSuccess] = useState(externalPeriodRecord?.status === 'settled')

    // Live summary computation
    const summary = useMemo(
        () =>
            calculateBasePayrollPeriodSummary({
                payables: localPayables,
                periodRecord: localPeriodRecord,
                resolvedWorkerIds,
            }),
        [localPayables, localPeriodRecord, resolvedWorkerIds]
    )

    // Filter composition
    const query = deferredSearch.trim().toLowerCase()
    const filteredPayables = useMemo(() => {
        return localPayables.filter((payable) => {
            const isResolved = (payable.gross_pay === 0 || payable.net_payout === 0) && resolvedWorkerIds.includes(payable.worker_id)
            const isPaid = payable.status === 'paid'

            // Worker type filter
            if (typeFilter === 'piece_rate' && payable.pay_type !== 'piece_rate') return false
            if (typeFilter === 'fixed_monthly' && payable.pay_type !== 'fixed_monthly') return false

            // Outstanding only filter
            if (outstandingOnly && (isPaid || isResolved)) return false

            // Search filter
            if (query && !payable.worker_name.toLowerCase().includes(query)) return false

            return true
        })
    }, [localPayables, typeFilter, outstandingOnly, query, resolvedWorkerIds])

    // Worker counts for filter badges
    const totalCount = localPayables.length
    const pieceCount = localPayables.filter((p) => p.pay_type !== 'fixed_monthly').length
    const fixedCount = localPayables.filter((p) => p.pay_type === 'fixed_monthly').length

    // Target paying worker
    const payingWorker = payingWorkerId
        ? localPayables.find((p) => p.worker_id === payingWorkerId)
        : null

    // Target viewing worker
    const viewingWorker = viewingWorkerId
        ? localPayables.find((p) => p.worker_id === viewingWorkerId)
        : null

    function toggleExpand(workerId: string) {
        setExpandedWorkerIds((current) => {
            const next = new Set(current)
            if (next.has(workerId)) next.delete(workerId)
            else next.add(workerId)
            return next
        })
    }

    // Mark Paid handler
    async function handleConfirmPayment() {
        if (!payingWorker || isPaying || payingWorker.incentive_review_ids?.length) return
        setIsPaying(true)

        const requestId = crypto.randomUUID()
        const expected = basePayrollReview(payingWorker, requestId)

        try {
            const result = await settleBaseWorkerPayroll({
                workerId: payingWorker.worker_id,
                paymentMode,
                periodEnd: payingWorker.period_end,
                note: paymentNote.trim() || undefined,
                expected,
            })

            if ('error' in result && result.error) {
                toast.error(result.error)
                return
            }

            // Optimistic update
            const settlementData = (result as { settlement?: { settlement_id?: string } })?.settlement
            const newSettlementId = settlementData?.settlement_id || requestId
            const paidAtStr = new Date().toISOString()

            setLocalPayables((current) =>
                current.map((p) =>
                    p.worker_id === payingWorker.worker_id
                        ? {
                              ...p,
                              status: 'paid' as const,
                              payment_mode: paymentMode,
                              settlement_id: newSettlementId,
                              paid_at: paidAtStr,
                              note: paymentNote.trim() || null,
                          }
                        : p
                )
            )

            toast.success(`Payment of ${formatINR(payingWorker.net_payout)} recorded for ${payingWorker.worker_name}.`)
            setPayingWorkerId(null)
            setPaymentNote('')
            onSuccess?.()
        } catch (error: unknown) {
            console.error('[settle] payment confirmation failed', error)
            toast.error((error as { message?: string } | null)?.message || 'Payment could not be recorded. Try again.')
        } finally {
            setIsPaying(false)
        }
    }

    // Resolve Zero-Pay Worker
    function handleResolveZeroWorker(workerId: string, workerName: string) {
        setResolvedWorkerIds((current) => {
            if (current.includes(workerId)) return current
            return [...current, workerId]
        })
        toast.success(`${workerName} resolved for this period (no production or salary).`)
    }

    // Reopen Payment handler
    async function handleReopenPayment() {
        if (!viewingWorker || !viewingWorker.settlement_id || isReversing || !paymentNotMade) return
        setIsReversing(true)

        try {
            const result = await reverseBasePayrollSettlement({
                settlementId: viewingWorker.settlement_id,
                reason: reversalReason.trim(),
                paymentNotMade: true,
            })

            if ('error' in result && result.error) {
                toast.error(result.error)
                return
            }

            // Update in-memory state
            setLocalPayables((current) =>
                current.map((p) =>
                    p.worker_id === viewingWorker.worker_id
                        ? {
                              ...p,
                              status: 'unsettled' as const,
                              payment_mode: null,
                              settlement_id: null,
                              paid_at: null,
                              note: null,
                          }
                        : p
                )
            )

            toast.success(`Payment reopened. ${viewingWorker.worker_name} marked outstanding.`)
            setReopenConfirmOpen(false)
            setViewingWorkerId(null)
            setReversalReason('')
            setPaymentNotMade(false)
            onSuccess?.()
        } catch (error: unknown) {
            console.error('[reopen] reversal failed', error)
            toast.error((error as { message?: string } | null)?.message || 'Payment could not be reopened.')
        } finally {
            setIsReversing(false)
        }
    }

    // Complete Payroll Period handler
    async function handleCompletePayroll() {
        if (isCompleting) return
        setIsCompleting(true)

        // Capture frozen calculation snapshot of every worker
        const snapshot = {
            period_start: period.start,
            period_end: period.end,
            completed_at: new Date().toISOString(),
            total_gross: summary.totalGross,
            total_recovery: summary.totalRecovery,
            total_net: summary.totalNet,
            total_workers: summary.totalWorkers,
            paid_workers: summary.paidWorkers,
            resolved_workers: summary.resolvedWorkers,
            workers: localPayables.map((p) => {
                const w = workerById.get(p.worker_id)
                return {
                    worker_id: p.worker_id,
                    worker_name: p.worker_name,
                    pay_type: p.pay_type,
                    role: w?.role || null,
                    gross_pay: p.gross_pay,
                    meters: p.meters,
                    salary_lines: p.salary_lines ?? [],
                    incentive_pay: p.incentive_pay ?? 0,
                    incentive_lines: p.incentive_lines ?? [],
                    pending_advance: p.pending_advance,
                    advance_recovery: p.advance_recovery,
                    net_payout: p.net_payout,
                    status: p.status,
                    payment_mode: p.payment_mode,
                    settlement_id: p.settlement_id,
                    paid_at: p.paid_at,
                    note: p.note,
                    is_resolved: resolvedWorkerIds.includes(p.worker_id),
                }
            }),
        }

        try {
            const result = await completeBasePayrollPeriod({
                periodStart: period.start,
                periodEnd: period.end,
                calculationSnapshot: snapshot,
                resolvedWorkerIds,
            })

            if ('error' in result && result.error) {
                toast.error(result.error)
                return
            }

            setLocalPeriodRecord({
                id: (result as { period?: { period_id?: string } } | null)?.period?.period_id || crypto.randomUUID(),
                period_start: period.start,
                period_end: period.end,
                status: 'settled',
                total_gross: summary.totalGross,
                total_recovery: summary.totalRecovery,
                total_net: summary.totalNet,
                total_workers: summary.totalWorkers,
                paid_workers: summary.paidWorkers,
                settled_at: new Date().toISOString(),
                settled_by: null,
                calculation_snapshot: snapshot,
                resolved_worker_ids: resolvedWorkerIds,
                notes: null,
            })

            setCompletedSuccess(true)
            setCompleteConfirmOpen(false)
            toast.success(`${period.label} payroll completely settled and preserved!`)
            onSuccess?.()
            router.refresh()
        } catch (error: unknown) {
            console.error('[complete] payroll finalization failed', error)
            toast.error((error as { message?: string } | null)?.message || 'Payroll could not be completed. Try again.')
        } finally {
            setIsCompleting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="fixed inset-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:w-[92vw] sm:max-w-6xl h-full sm:h-[90vh] sm:max-h-[920px] rounded-none sm:rounded-3xl border border-hairline bg-surface p-0 shadow-2xl flex flex-col overflow-hidden">
                {/* 1. Header */}
                <div className="sticky top-0 z-20 flex items-center justify-between border-b border-hairline bg-surface px-4 py-3 sm:px-6 sm:py-4">
                    <div className="min-w-0 flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-loom/10 text-loom">
                            <WalletCards className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <DialogTitle className="text-base sm:text-xl font-black tracking-tight text-ink">
                                    Settle payroll
                                </DialogTitle>
                                <Badge
                                    variant={
                                        summary.isSettled
                                            ? 'success'
                                            : summary.isReadyToComplete
                                              ? 'brand'
                                              : summary.status === 'in_progress'
                                                ? 'brand'
                                                : 'secondary'
                                    }
                                    className="font-bold text-[10px] uppercase tracking-wider"
                                >
                                    {summary.isSettled
                                        ? 'Settled'
                                        : summary.isReadyToComplete
                                          ? 'Ready to complete'
                                          : summary.status === 'in_progress'
                                            ? 'In progress'
                                            : 'Open'}
                                </Badge>
                            </div>
                            <DialogDescription className="mt-0.5 truncate text-xs text-muted-foreground">
                                {period.label} · {formatDateOnly(period.start)} – {formatDateOnly(period.end)} · {totalCount} workers
                            </DialogDescription>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onOpenChange(false)}
                        className="h-9 w-9 rounded-xl text-muted-foreground hover:text-ink"
                        aria-label="Close settlement workspace"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* 2. Success Banner if Period Settled */}
                {completedSuccess && (
                    <div className="bg-[var(--wv-moss-50)] border-b border-[var(--wv-moss-200)] px-4 py-3 sm:px-6 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-[var(--wv-moss-800)]">
                            <CheckCircle2 className="h-5 w-5 shrink-0" />
                            <p className="text-xs sm:text-sm font-semibold">
                                {period.label} payroll is finalized. {formatINR(summary.totalNet)} settled across {summary.totalWorkers} workers.
                            </p>
                        </div>
                        {onViewRecords && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    onOpenChange(false)
                                    onViewRecords()
                                }}
                                className="h-8 rounded-lg text-xs font-bold border-[var(--wv-moss-300)] hover:bg-[var(--wv-moss-100)]"
                            >
                                View in records
                            </Button>
                        )}
                    </div>
                )}

                {/* 3. Summary & Progress Bar */}
                <div className="border-b border-hairline bg-surface-soft/40 px-4 py-4 sm:px-6 sm:py-5">
                    <div className="grid grid-cols-3 gap-2 sm:gap-6 divide-x divide-hairline">
                        <div className="pr-2 sm:pr-4">
                            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Total payroll
                            </p>
                            <p className="mt-1 text-base sm:text-2xl font-black text-ink">
                                {formatINR(summary.totalNet, { hideDecimals: true })}
                            </p>
                            <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground">
                                {summary.totalWorkers} workers
                            </p>
                        </div>
                        <div className="px-2 sm:px-4">
                            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[var(--wv-moss-700)]">
                                Paid
                            </p>
                            <p className="mt-1 text-base sm:text-2xl font-black text-[var(--wv-moss-700)]">
                                {formatINR(summary.paidAmount, { hideDecimals: true })}
                            </p>
                            <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground">
                                {summary.paidWorkers} paid{summary.resolvedWorkers > 0 ? ` · ${summary.resolvedWorkers} resolved` : ''}
                            </p>
                        </div>
                        <div className="pl-2 sm:pl-4">
                            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Remaining
                            </p>
                            <p className="mt-1 text-base sm:text-2xl font-black text-ink">
                                {formatINR(summary.remainingAmount, { hideDecimals: true })}
                            </p>
                            <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground">
                                {summary.outstandingWorkers} outstanding
                            </p>
                        </div>
                    </div>

                    {/* Progress Track */}
                    <div className="mt-4 space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                            <span>
                                {summary.paidWorkers + summary.resolvedWorkers} of {summary.totalWorkers} workers settled{summary.resolvedWorkers > 0 ? ` (${summary.paidWorkers} paid, ${summary.resolvedWorkers} resolved)` : ''}
                            </span>
                            <span>{summary.progressPercent}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-surface-soft overflow-hidden">
                            <div
                                className="h-full bg-[var(--wv-moss-600)] transition-all duration-500 ease-out"
                                style={{ width: `${summary.progressPercent}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* 4. Controls: Type Filter, Search, Outstanding Toggle */}
                <div className="flex flex-col gap-3 border-b border-hairline bg-surface p-3 sm:px-6 sm:py-3 sm:flex-row sm:items-center sm:justify-between">
                    {/* Worker-Type Filter */}
                    <div className="inline-flex rounded-xl border border-hairline bg-surface-soft p-1">
                        <button
                            type="button"
                            onClick={() => setTypeFilter('all')}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                typeFilter === 'all'
                                    ? 'bg-loom text-white shadow-xs'
                                    : 'text-muted-foreground hover:text-ink'
                            }`}
                        >
                            All ({totalCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setTypeFilter('piece_rate')}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                typeFilter === 'piece_rate'
                                    ? 'bg-loom text-white shadow-xs'
                                    : 'text-muted-foreground hover:text-ink'
                            }`}
                        >
                            Piece Rate ({pieceCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setTypeFilter('fixed_monthly')}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                typeFilter === 'fixed_monthly'
                                    ? 'bg-loom text-white shadow-xs'
                                    : 'text-muted-foreground hover:text-ink'
                            }`}
                        >
                            Fixed Salary ({fixedCount})
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Search Input */}
                        <div className="relative flex-1 sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search worker"
                                className="h-9 pl-9 pr-3 text-xs rounded-xl border-hairline bg-surface"
                            />
                        </div>

                        {/* Outstanding Only Switch */}
                        <SwitchField className="whitespace-nowrap text-xs" checked={outstandingOnly} onCheckedChange={setOutstandingOnly}>Outstanding only</SwitchField>
                    </div>
                </div>

                {/* 5. Main Content: Worker List / Table */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
                    {filteredPayables.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <p className="text-sm font-semibold text-ink">No workers found</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {search || outstandingOnly
                                    ? 'Try clearing the search or status filter.'
                                    : 'No eligible workers for this pay period.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* Desktop Table Header */}
                            <div className="hidden lg:grid lg:grid-cols-12 gap-3 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-hairline">
                                <div className="col-span-4">Worker</div>
                                <div className="col-span-2 text-right">Gross</div>
                                <div className="col-span-2 text-right">Recovery</div>
                                <div className="col-span-2 text-right">Net Pay</div>
                                <div className="col-span-2 text-right">Action</div>
                            </div>

                            {/* Worker Rows */}
                            {filteredPayables.map((payable) => {
                                const isPaid = payable.status === 'paid'
                                const isResolved =
                                    (payable.gross_pay === 0 || payable.net_payout === 0) &&
                                    resolvedWorkerIds.includes(payable.worker_id) && !payable.incentive_review_ids?.length
                                const isExpanded = expandedWorkerIds.has(payable.worker_id)
                                const readiness = readinessByWorker.get(payable.worker_id)
                                const hasIssues = Boolean(readiness?.issueCount || payable.incentive_review_ids?.length)

                                return (
                                    <div
                                        key={payable.worker_id}
                                        className={`rounded-2xl border border-hairline transition-all overflow-hidden ${
                                            isPaid
                                                ? 'bg-surface-soft/40 border-hairline/60 opacity-90'
                                                : 'bg-surface hover:border-hairline-strong shadow-xs'
                                        }`}
                                    >
                                        {/* Main Row / Card Content */}
                                        <div className="p-3.5 sm:p-4">
                                            <div className="flex flex-col lg:grid lg:grid-cols-12 gap-3 items-start lg:items-center">
                                                {/* Column 1: Worker & Badges */}
                                                <div className="col-span-4 min-w-0 w-full lg:w-auto">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-bold text-ink text-sm sm:text-base truncate">
                                                            {payable.worker_name}
                                                        </span>
                                                        <Badge
                                                            variant="secondary"
                                                            className="font-bold text-[9px] tracking-wider uppercase px-1.5 py-0.5"
                                                        >
                                                            {payable.pay_type === 'fixed_monthly' ? 'Fixed Salary' : 'Piece Rate'}
                                                        </Badge>
                                                        {hasIssues && !isPaid && (
                                                            <Badge variant="warning" className="font-bold text-[9px]">
                                                                Review
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                                        {payable.pay_type === 'fixed_monthly'
                                                            ? 'Monthly salary'
                                                            : `${formatMeters(payable.meters)} produced`}
                                                    </p>
                                                </div>

                                                {/* Mobile Metrics Layout */}
                                                <div className="grid grid-cols-3 gap-2 w-full lg:hidden pt-2 border-t border-hairline">
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">
                                                            Gross
                                                        </p>
                                                        <p className="text-xs font-semibold text-ink">
                                                            {formatINR(payable.gross_pay, { hideDecimals: true })}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">
                                                            Recovery
                                                        </p>
                                                        <p className="text-xs font-semibold text-muted-foreground">
                                                            {payable.advance_recovery > 0
                                                                ? `-${formatINR(payable.advance_recovery, { hideDecimals: true })}`
                                                                : '—'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">
                                                            Net Pay
                                                        </p>
                                                        <p className="text-sm font-black text-ink">
                                                            {formatINR(payable.net_payout, { hideDecimals: true })}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Desktop Columns */}
                                                <div className="hidden lg:block col-span-2 text-right font-medium text-sm text-ink">
                                                    {formatINR(payable.gross_pay, { hideDecimals: true })}
                                                </div>

                                                <div className="hidden lg:block col-span-2 text-right text-sm text-muted-foreground">
                                                    {payable.advance_recovery > 0
                                                        ? `-${formatINR(payable.advance_recovery, { hideDecimals: true })}`
                                                        : '—'}
                                                </div>

                                                <div className="hidden lg:block col-span-2 text-right text-base font-black text-ink">
                                                    {formatINR(payable.net_payout, { hideDecimals: true })}
                                                </div>

                                                {/* Column 5: Action & Status */}
                                                <div className="col-span-2 w-full lg:w-auto flex items-center justify-between lg:justify-end gap-2 pt-2 lg:pt-0 border-t border-hairline lg:border-t-0">
                                                    {isPaid ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setViewingWorkerId(payable.worker_id)}
                                                            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--wv-moss-700)] hover:underline"
                                                        >
                                                            <Check className="h-4 w-4" />
                                                            <span>Paid · {paymentModeLabel(payable.payment_mode)}</span>
                                                        </button>
                                                    ) : isResolved ? (
                                                        <Badge variant="secondary" className="text-xs font-bold">
                                                            Resolved (₹0)
                                                        </Badge>
                                                    ) : payable.gross_pay === 0 ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={hasIssues || summary.isSettled}
                                                            onClick={() => handleResolveZeroWorker(payable.worker_id, payable.worker_name)}
                                                            className="h-8 rounded-xl text-xs font-bold border-hairline"
                                                        >
                                                            <span data-i18n-skip="true">{t('payroll.resolve')}</span>
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            disabled={hasIssues || summary.isSettled}
                                                            onClick={() => {
                                                                setPayingWorkerId(payable.worker_id)
                                                                setPaymentMode(defaultPaymentMode)
                                                                setPaymentDate(new Date().toISOString().slice(0, 10))
                                                                setPaymentNote('')
                                                            }}
                                                            className="h-8 sm:h-9 rounded-xl bg-loom text-white text-xs font-bold shadow-xs hover:bg-loom-elevated"
                                                        >
                                                            <span data-i18n-skip="true">{hasIssues ? t('payroll.needsReview') : t('payroll.markPaid')}</span>
                                                        </Button>
                                                    )}

                                                    <Button
                                                        variant="ghost"
                                                        size="icon-xs"
                                                        onClick={() => toggleExpand(payable.worker_id)}
                                                        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-ink"
                                                        aria-label="Toggle calculation breakdown"
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronDown className="h-4 w-4" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Provenance Breakdown */}
                                        {isExpanded && (
                                            <div className="border-t border-hairline bg-surface-soft/50 p-4 text-xs space-y-2">
                                                <p className="font-bold text-ink uppercase tracking-wider text-[10px]">
                                                    Calculation Breakdown
                                                </p>
                                                {payable.pay_type === 'fixed_monthly' ? (
                                                    <div className="space-y-1 text-body">
                                                        {payable.salary_lines?.map((line, idx) => (
                                                            <div key={idx} className="flex justify-between py-0.5">
                                                                <span>
                                                                    {formatDateOnly(line.start)} – {formatDateOnly(line.end)} ({line.days}/{line.monthDays} days @ {formatINR(line.monthlySalary)}/mo)
                                                                </span>
                                                                <span className="font-medium text-ink">{formatINR(line.grossPay)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1 text-body">
                                                        <div className="flex justify-between py-0.5">
                                                            <span>Production earnings ({formatMeters(payable.meters)})</span>
                                                            <span className="font-medium text-ink">{formatINR(payable.base_pay ?? payable.gross_pay)}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {(payable.incentive_lines ?? []).map(item => <div key={item.id} className="flex flex-wrap justify-between gap-2 py-1 text-body">
                                                    <span>{tx('Approved incentive earnings')}: {item.service_start} – {item.service_end} · {item.evidence_reference}</span>
                                                    <span className="font-medium text-ink">{formatINR(item.amount)}</span>
                                                </div>)}
                                                {payable.incentive_review_ids?.length ? <p className="text-body">{tx('Review incentives and include their complete service periods before payment.')}</p> : null}
                                                {payable.pending_advance > 0 && (
                                                    <div className="flex justify-between py-0.5 text-muted-foreground border-t border-hairline/60 pt-1">
                                                        <span>
                                                            Advance recovery (from {formatINR(payable.pending_advance)} pending, max 50% gross)
                                                        </span>
                                                        <span className="text-body font-medium">-{formatINR(payable.advance_recovery)}</span>
                                                    </div>
                                                )}

                                                <div className="flex justify-between py-1 border-t border-hairline font-bold text-ink text-sm">
                                                    <span>Net Payable</span>
                                                    <span>{formatINR(payable.net_payout)}</span>
                                                </div>

                                                {payable.note && (
                                                    <p className="text-muted-foreground italic text-[11px] pt-1">
                                                        Note: {payable.note}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* 6. Sticky Footer / Complete Payroll CTA */}
                <div className="sticky bottom-0 z-20 border-t border-hairline bg-surface px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">
                        {summary.outstandingWorkers === 0 ? (
                            <span className="text-[var(--wv-moss-700)] font-bold flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4" />
                                All {summary.totalWorkers} worker obligations resolved.
                            </span>
                        ) : (
                            <span>
                                {summary.outstandingWorkers} workers remaining · {formatINR(summary.remainingAmount)} to settle
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {summary.isSettled ? (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    onOpenChange(false)
                                    onViewRecords?.()
                                }}
                                className="rounded-xl font-bold text-xs"
                            >
                                <span data-i18n-skip="true">{t('payroll.viewSettledRecords')}</span>
                            </Button>
                        ) : (
                            <Button
                                disabled={!summary.isReadyToComplete || isCompleting}
                                onClick={() => setCompleteConfirmOpen(true)}
                                className={`rounded-xl text-xs sm:text-sm font-bold shadow-xs ${
                                    summary.isReadyToComplete
                                        ? 'bg-loom text-white hover:bg-loom-elevated'
                                        : 'bg-surface-soft text-muted-foreground border border-hairline'
                                }`}
                            >
                                <span data-i18n-skip="true">{t('payroll.completePayroll')}</span>
                                <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* --- MODALS --- */}

                {/* 1. Mark Paid Confirmation Dialog */}
                <Dialog open={Boolean(payingWorkerId)} onOpenChange={(o) => !o && !isPaying && setPayingWorkerId(null)}>
                    <DialogContent className="max-w-md rounded-2xl border border-hairline bg-surface p-6 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-ink">
                                Mark {payingWorker?.worker_name} as paid
                            </DialogTitle>
                            <DialogDescription className="text-xs text-body">
                                Record a payment made in the real world. This will update live payroll totals and preserve an audit log.
                            </DialogDescription>
                        </DialogHeader>

                        {payingWorker && (
                            <div className="space-y-4 pt-2">
                                <div className="rounded-xl border border-hairline bg-surface-soft/60 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Net amount payable
                                    </p>
                                    <p className="text-2xl font-black text-ink mt-0.5">
                                        {formatINR(payingWorker.net_payout)}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Gross {formatINR(payingWorker.gross_pay)} · Advance recovery {formatINR(payingWorker.advance_recovery)}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="payment-mode-select" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        Payment method
                                    </Label>
                                    <Select value={paymentMode} onValueChange={(val) => setPaymentMode(val as BasePayrollPaymentMode)}>
                                        <SelectTrigger id="payment-mode-select" className="h-10 rounded-xl border-hairline bg-surface">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cash">Cash</SelectItem>
                                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                            <SelectItem value="upi">UPI</SelectItem>
                                            <SelectItem value="cheque">Cheque</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="payment-date-input" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        Payment date
                                    </Label>
                                    <Input
                                        id="payment-date-input"
                                        type="date"
                                        value={paymentDate}
                                        onChange={(e) => setPaymentDate(e.target.value)}
                                        className="h-10 rounded-xl border-hairline bg-surface text-xs"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="payment-note-input" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        Note <span className="font-normal text-muted-foreground">(optional)</span>
                                    </Label>
                                    <Input
                                        id="payment-note-input"
                                        value={paymentNote}
                                        onChange={(e) => setPaymentNote(e.target.value)}
                                        placeholder="e.g. Paid in cash by owner"
                                        maxLength={240}
                                        className="h-10 rounded-xl border-hairline bg-surface text-xs"
                                    />
                                </div>

                                <DialogFooter className="pt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={isPaying}
                                        onClick={() => setPayingWorkerId(null)}
                                        className="rounded-xl border-hairline font-semibold text-xs"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        disabled={isPaying}
                                        onClick={handleConfirmPayment}
                                        className="rounded-xl bg-loom text-white font-bold text-xs hover:bg-loom-elevated"
                                    >
                                        {isPaying ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                                        <span data-i18n-skip="true">{t('payroll.confirmPayment')}</span>
                                    </Button>
                                </DialogFooter>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                {/* 2. View Payment & Reopen Dialog */}
                <Dialog open={Boolean(viewingWorkerId) && !reopenConfirmOpen} onOpenChange={(o) => !o && setViewingWorkerId(null)}>
                    <DialogContent className="max-w-md rounded-2xl border border-hairline bg-surface p-6 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-ink">
                                Payment details
                            </DialogTitle>
                            <DialogDescription className="text-xs text-body">
                                Audited settlement event for {viewingWorker?.worker_name}.
                            </DialogDescription>
                        </DialogHeader>

                        {viewingWorker && (
                            <div className="space-y-4 pt-2">
                                <div className="space-y-2.5 rounded-xl border border-hairline bg-surface-soft/60 p-4 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Worker</span>
                                        <span className="font-bold text-ink">{viewingWorker.worker_name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Amount Paid</span>
                                        <span className="font-black text-ink">{formatINR(viewingWorker.net_payout)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Payment Method</span>
                                        <span className="font-semibold text-ink">{paymentModeLabel(viewingWorker.payment_mode)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Settled At</span>
                                        <span className="font-medium text-ink">{formatDateOnly(viewingWorker.paid_at)}</span>
                                    </div>
                                    {viewingWorker.note && (
                                        <div className="flex justify-between border-t border-hairline pt-2">
                                            <span className="text-muted-foreground">Note</span>
                                            <span className="font-medium text-ink italic">{viewingWorker.note}</span>
                                        </div>
                                    )}
                                </div>

                                <DialogFooter className="pt-2 flex sm:justify-between items-center w-full">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setViewingWorkerId(null)}
                                        className="rounded-xl border-hairline font-semibold text-xs"
                                    >
                                        Close
                                    </Button>
                                    {!summary.isSettled && (
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            onClick={() => setReopenConfirmOpen(true)}
                                            className="rounded-xl text-xs font-bold"
                                        >
                                            Reopen Payment
                                        </Button>
                                    )}
                                </DialogFooter>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                {/* 3. Reopen Payment Confirmation Dialog */}
                <Dialog open={reopenConfirmOpen} onOpenChange={(o) => !o && !isReversing && setReopenConfirmOpen(false)}>
                    <DialogContent className="max-w-md rounded-2xl border border-hairline bg-surface p-6 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-ink">
                                Reopen {viewingWorker?.worker_name}&apos;s payment?
                            </DialogTitle>
                            <DialogDescription className="text-xs text-body">
                                This will mark {formatINR(viewingWorker?.net_payout ?? 0)} as outstanding again. Any advance recovery applied will be restored. The original payment event remains in audit history.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <Label htmlFor="reopen-reason" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Reason for reopening
                                </Label>
                                <Textarea
                                    id="reopen-reason"
                                    value={reversalReason}
                                    onChange={(e) => setReversalReason(e.target.value)}
                                    placeholder="Explain why this payment record is being reopened (min 3 characters)"
                                    maxLength={240}
                                    rows={2}
                                    className="rounded-xl border-hairline text-xs"
                                />
                            </div>

                            <label className="flex items-start gap-2.5 text-xs text-body cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={paymentNotMade}
                                    onChange={(e) => setPaymentNotMade(e.target.checked)}
                                    className="rounded border-hairline text-loom focus:ring-loom h-4 w-4 mt-0.5"
                                />
                                <span>I confirm that this payment was not made or was recorded by mistake.</span>
                            </label>

                            <DialogFooter className="pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isReversing}
                                    onClick={() => setReopenConfirmOpen(false)}
                                    className="rounded-xl border-hairline font-semibold text-xs"
                                >
                                    Keep Payment
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    disabled={isReversing || !paymentNotMade || reversalReason.trim().length < 3}
                                    onClick={handleReopenPayment}
                                    className="rounded-xl font-bold text-xs"
                                >
                                    {isReversing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                                    Reopen Payment
                                </Button>
                            </DialogFooter>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* 4. Complete Payroll Confirmation Dialog */}
                <Dialog open={completeConfirmOpen} onOpenChange={(o) => !o && !isCompleting && setCompleteConfirmOpen(false)}>
                    <DialogContent className="max-w-md rounded-2xl border border-hairline bg-surface p-6 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-ink">
                                <span data-i18n-skip="true">{t('payroll.completePeriodTitle', { periodLabel: period.label })}</span>
                            </DialogTitle>
                            <DialogDescription className="text-xs text-body">
                                Finalize this pay period and lock in an immutable accounting record.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 pt-2">
                            <div className="rounded-xl border border-hairline bg-surface-soft/60 p-4 text-xs space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Workers settled</span>
                                    <span className="font-bold text-ink">{summary.totalWorkers} workers</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total payroll paid</span>
                                    <span className="font-black text-ink">{formatINR(summary.totalNet)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Advance recovery</span>
                                    <span className="font-semibold text-ink">{formatINR(summary.totalRecovery)}</span>
                                </div>
                            </div>

                            <div className="rounded-xl border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] p-3 text-xs text-[var(--wv-ochre-800)] flex items-start gap-2">
                                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                                <p className="leading-relaxed">
                                    Completing this payroll creates an immutable historical snapshot. Future changes to worker salaries, rates, or production will not alter this settled pay run.
                                </p>
                            </div>

                            <DialogFooter className="pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isCompleting}
                                    onClick={() => setCompleteConfirmOpen(false)}
                                    className="rounded-xl border-hairline font-semibold text-xs"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    disabled={isCompleting}
                                    onClick={handleCompletePayroll}
                                    className="rounded-xl bg-loom text-white font-bold text-xs hover:bg-loom-elevated"
                                >
                                    {isCompleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                                    <span data-i18n-skip="true">{t('payroll.completePayroll')}</span>
                                </Button>
                            </DialogFooter>
                        </div>
                    </DialogContent>
                </Dialog>
            </DialogContent>
        </Dialog>
    )
}
