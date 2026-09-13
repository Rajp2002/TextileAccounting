'use client'
import { useLocalizedPageTitle } from '@/hooks/use-localized-page-title'

import Link from 'next/link'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/context'
import {
    ArrowLeft,
    CheckCircle2,
    ClipboardList,
    Clock3,
    History,
    ChevronLeft,
    ChevronRight,
    IndianRupee,
    Loader2,
    Plus,
    ReceiptText,
    RotateCcw,
    Settings2,
    WalletCards,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog'
import { formatINR } from '@/lib/finance'
import { buildBasePayrollReadiness } from '@/lib/base-payroll-readiness'
import { calculateBaseJobSummaries } from '@/lib/base-job-summaries'
import { basePayrollReview } from '@/lib/base-payroll-review'
import { baseProductionHref, readBaseProductionNavigation } from '@/lib/base-production-navigation'
import { trackPlanEvent } from '@/lib/plan-analytics'
import {
    calculateBaseJobSummary,
    calculateBaseEntryGrossPay,
    calculateBasePayrollPeriodSummary,
    getMonthPayrollBounds,
    getAdjacentMonthKey,
    type BasePayrollPaymentMode,
    type BaseProductionCosting,
    type BaseProductionJobStatus,
    type BasePayrollPeriod,
} from '@/lib/base-production-core'

import {
    createBaseProductionJob,
    createBaseWorkerAdvance,
    settleBaseWorkerPayroll,
    updateBaseProductionJobStatus,
} from './actions'
import BaseAssignmentWorkspace from './BaseAssignmentWorkspace'
import BaseMachineJobs from './BaseMachineJobs'
import BaseDailyProductionSheet from './BaseDailyProductionSheet'
import BasePayrollReadinessPanel from './BasePayrollReadinessPanel'
import BasePayrollRecords from './BasePayrollRecords'
import BasePayrollSettlementWorkspace from './BasePayrollSettlementWorkspace'
import type { BaseProductionInitialData } from './loaders'

type DialogName = 'job' | 'advance' | null

type JobDraft = {
    costingId: string
    targetMeters: string
    startDate: string
    dueDate: string
    customerReference: string
    notes: string
}

type AdvanceDraft = {
    workerId: string
    amount: string
    description: string
}

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

function getStatusVariant(status: BaseProductionJobStatus): 'brand' | 'warning' | 'success' | 'secondary' {
    if (status === 'active') return 'brand'
    if (status === 'completed') return 'success'
    if (status === 'cancelled') return 'secondary'
    return 'warning'
}

function getNextStatus(status: BaseProductionJobStatus): BaseProductionJobStatus | null {
    if (status === 'planned') return 'active'
    if (status === 'active') return 'completed'
    if (status === 'completed' || status === 'cancelled') return 'active'
    return null
}

function getStatusActionLabel(status: BaseProductionJobStatus) {
    if (status === 'planned') return 'Start job'
    if (status === 'active') return 'Mark complete'
    return 'Reopen job'
}

function getActionError(result: unknown) {
    if (!result || typeof result !== 'object' || !('error' in result)) return null
    const error = (result as { error?: unknown }).error
    return typeof error === 'string' ? error : 'The action could not be completed.'
}

function costingTargetMeters(costing: BaseProductionCosting | undefined) {
    return costing?.order_quantity_m && costing.order_quantity_m > 0 ? String(costing.order_quantity_m) : ''
}

function emptyJobDraft(today: string, costingId = '', targetMeters = ''): JobDraft {
    return {
        costingId,
        targetMeters,
        startDate: today,
        dueDate: '',
        customerReference: '',
        notes: '',
    }
}

function emptyAdvanceDraft(workerId = ''): AdvanceDraft {
    return { workerId, amount: '', description: '' }
}

export default function BaseProductionClient({
    initialData,
    initialCostingId = null,
    view = 'production',
    tourMetadata,
}: {
    initialData: BaseProductionInitialData
    initialCostingId?: string | null
    view?: 'production' | 'operations' | 'payroll'
    tourMetadata?: Record<string, unknown>
}) {
    const router = useRouter()
    const { tx } = useTranslation()
    useLocalizedPageTitle(view === 'operations' ? `${tx('Worker–Machine Assignments')} | Weavly` : null)
    const searchParams = useSearchParams()
    const navigation = readBaseProductionNavigation(searchParams)
    const [activeTab, setActiveTab] = useState(view === 'operations' ? 'assignments' : view === 'payroll' ? 'pay' : 'production')
    const [productionSearch, setProductionSearch] = useState('')
    const [historyCount, setHistoryCount] = useState(12)
    const [payrollSearch, setPayrollSearch] = useState('')
    const [payrollFilter, setPayrollFilter] = useState('all')

    useEffect(() => {
        if (view === 'production') setActiveTab(navigation.tab ?? 'production')
    }, [navigation.tab, navigation.date, navigation.shift, navigation.entry, view])
    const [dialog, setDialog] = useState<DialogName>(null)
    const [pendingAction, setPendingAction] = useState<string | null>(null)
    const [settlingWorkerId, setSettlingWorkerId] = useState<string | null>(null)
    const [settlementRequestId, setSettlementRequestId] = useState('')
    const [paymentMode, setPaymentMode] = useState<BasePayrollPaymentMode>('cash')
    const [jobDraft, setJobDraft] = useState<JobDraft>(() => emptyJobDraft(initialData.today, initialCostingId ?? ''))
    const [advanceDraft, setAdvanceDraft] = useState<AdvanceDraft>(emptyAdvanceDraft)
    const [workspaceOpen, setWorkspaceOpen] = useState(false)
    const [selectedMonthKey, setSelectedMonthKey] = useState(() => initialData.payrollPeriod.start.slice(0, 7))

    const activePeriodBounds = useMemo(() => {
        const defaultKey = initialData.payrollPeriod.start.slice(0, 7)
        if (selectedMonthKey === defaultKey) {
            return initialData.payrollPeriod
        }
        return getMonthPayrollBounds(`${selectedMonthKey}-01`)
    }, [selectedMonthKey, initialData.payrollPeriod])

    const activePeriodRecord = useMemo(() => {
        return (initialData.payrollPeriods || []).find(
            (p) => p.period_start === activePeriodBounds.start && p.period_end === activePeriodBounds.end
        ) || null
    }, [initialData.payrollPeriods, activePeriodBounds])

    const activePeriodSummary = useMemo(() => {
        return calculateBasePayrollPeriodSummary({
            payables: initialData.payables,
            periodRecord: activePeriodRecord ?? undefined,
        })
    }, [initialData.payables, activePeriodRecord])

    const activeMonthLabel = useMemo(() => {
        const [yearStr, monthStr] = selectedMonthKey.split('-')
        const year = Number(yearStr)
        const month = Number(monthStr)
        if (!year || !month) return selectedMonthKey
        return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
    }, [selectedMonthKey])

    const workerById = useMemo(
        () => new Map(initialData.workers.map((worker) => [worker.id, worker])),
        [initialData.workers],
    )
    const jobById = useMemo(
        () => new Map(initialData.jobs.map((job) => [job.id, job])),
        [initialData.jobs],
    )
    const jobSummaries = useMemo(
        () => calculateBaseJobSummaries(initialData.jobs, initialData.entries, initialData.allocations),
        [initialData.allocations, initialData.entries, initialData.jobs],
    )
    const productionAllocationLabels = useMemo(() => {
        const labels = new Map<string, string[]>()
        for (const allocation of initialData.allocations) {
            const current = labels.get(allocation.entry_id) ?? []
            current.push(`${allocation.machine_label} ${allocation.job_label}`)
            labels.set(allocation.entry_id, current)
        }
        return labels
    }, [initialData.allocations])
    const visibleProduction = initialData.entries.filter(entry => {
        if (!(entry.meters > 0 || entry.entry_status === 'zero' || entry.entry_status === 'absent')) return false
        const labels = [entry.production_date, entry.shift, entry.machine_label, entry.job_label,
            workerById.get(entry.worker_id)?.name, jobById.get(entry.job_id)?.quality_label,
            ...(productionAllocationLabels.get(entry.id) ?? [])]
        return labels.join(' ').toLocaleLowerCase().includes(productionSearch.trim().toLocaleLowerCase())
    })
    const activeJobs = initialData.jobs.filter((job) => job.status === 'planned' || job.status === 'active')
    const activeWorkers = initialData.workers.filter((worker) => worker.is_active)
    const producedThisPeriod = initialData.entries
        .filter((entry) => entry.production_date >= initialData.payrollPeriod.start && entry.production_date <= initialData.payrollPeriod.end)
        .reduce((total, entry) => total + entry.meters, 0)
    const openJobs = activeJobs.length
    const pendingAdvances = initialData.payables.reduce((total, payable) => total + payable.pending_advance, 0)
    const unsettledPayable = initialData.payables
        .filter((payable) => payable.status === 'unsettled')
        .reduce((total, payable) => total + payable.net_payout, 0)
    const settlingWorker = initialData.payables.find((payable) => payable.worker_id === settlingWorkerId)
    const payrollReadiness = useMemo(() => buildBasePayrollReadiness({
        payables: initialData.payables,
        entries: initialData.entries,
        allocations: initialData.allocations,
    }), [initialData.allocations, initialData.entries, initialData.payables])
    const readinessByWorker = useMemo(
        () => new Map(payrollReadiness.workers.map((worker) => [worker.workerId, worker])),
        [payrollReadiness.workers],
    )
    const visiblePayables = initialData.payables.filter(payable => {
                                if (!payable.worker_name.toLocaleLowerCase().includes(payrollSearch.trim().toLocaleLowerCase())) return false
                                const readiness = readinessByWorker.get(payable.worker_id)
                                return payrollFilter === 'all' || (payrollFilter === 'ready' && readiness?.readyToSettle) || (payrollFilter === 'review' && Boolean(readiness?.issueCount)) || (payrollFilter === 'paid' && payable.status === 'paid') || (payrollFilter === 'empty' && payable.gross_pay === 0)
                            })
    const settlingReadiness = settlingWorkerId ? readinessByWorker.get(settlingWorkerId) : null

    useEffect(() => {
        trackPlanEvent('production_viewed', { surface: 'base_production_core' })
    }, [])

    async function runAction(
        key: string,
        operation: () => Promise<unknown>,
        successMessage: string,
        onSuccess?: () => void,
    ) {
        if (pendingAction) return
        setPendingAction(key)

        try {
            const result = await operation()
            const error = getActionError(result)
            if (error) {
                toast.error(error)
                return
            }

            toast.success(successMessage)
            trackPlanEvent('production_activity', { action: key })
            if (key === 'job-create') {
                trackPlanEvent('production_created', { source: 'saved_costing' })
                trackPlanEvent('production_created_from_costing', {})
            } else if (key.startsWith('job-status-')) {
                trackPlanEvent('production_status_updated', { action: successMessage })
                if (successMessage === 'Job marked complete.') trackPlanEvent('production_completed', {})
            } else if (key.startsWith('daily-')) {
                trackPlanEvent('production_quantity_updated', {})
            }
            onSuccess?.()
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'The action could not be completed.')
        } finally {
            setPendingAction(null)
        }
    }

    function openNewJob() {
        const costing = initialData.costings.find((item) => item.id === initialCostingId)
        setJobDraft(emptyJobDraft(initialData.today, initialCostingId ?? '', costingTargetMeters(costing)))
        setDialog('job')
    }

    function openAdvance(workerId = activeWorkers[0]?.id ?? '') {
        setAdvanceDraft(emptyAdvanceDraft(workerId))
        setDialog('advance')
    }

    function openSetup(add?: 'worker' | 'machine', workerId?: string) {
        const params = new URLSearchParams({ returnTo: view === 'payroll' ? '/owner/payroll' : baseProductionHref(navigation) })
        if (add) { params.set('add', add); params.set('section', add === 'machine' ? 'machines' : 'workers') }
        if (workerId) params.set('worker', workerId)
        if (add === 'machine') params.set('register', 'base')
        params.delete('section')
        router.push(`/owner/${add === 'machine' ? 'machines' : 'workers'}?${params}`)
    }

    function openRecord(jobId?: string) {
        if (activeWorkers.length === 0) {
            toast.info('Add a worker in Workers, then assign them in Machine Assignments before recording production.')
            openSetup()
            return
        }

        router.push(baseProductionHref({ job: jobId, returnTo: '/owner/production?tab=jobs' }))
        setActiveTab('production')
    }

    function closeDialog() {
        setDialog(null)

    }

    function handleJobSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const targetMeters = Number.parseFloat(jobDraft.targetMeters)
        if (!jobDraft.costingId || !Number.isFinite(targetMeters) || targetMeters <= 0) {
            toast.error('Choose a costing and enter a target greater than 0.')
            return
        }

        void runAction(
            'job-create',
            () => createBaseProductionJob({
                costingId: jobDraft.costingId,
                targetMeters,
                startDate: jobDraft.startDate,
                dueDate: jobDraft.dueDate,
                customerReference: jobDraft.customerReference,
                notes: jobDraft.notes,
            }),
            'Production job created.',
            () => {
                closeDialog()
                if (initialData.machines.length === 0) openSetup('machine')
            },
        )
    }

    function handleAdvanceSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const amount = Number.parseFloat(advanceDraft.amount)
        if (!advanceDraft.workerId || !Number.isFinite(amount) || amount <= 0) {
            toast.error('Choose a worker and enter an advance greater than 0.')
            return
        }

        void runAction(
            'advance-create',
            () => createBaseWorkerAdvance({
                workerId: advanceDraft.workerId,
                amount,
                description: advanceDraft.description,
            }),
            'Advance recorded.',
            closeDialog,
        )
    }

    function handleJobStatus(jobId: string, status: BaseProductionJobStatus) {
        void runAction(
            `job-status-${jobId}`,
            () => updateBaseProductionJobStatus({ jobId, status }),
            status === 'completed' ? 'Job marked complete.' : status === 'active' ? 'Job is active.' : 'Job reopened.',
        )
    }

    function handleSettle() {
        if (!settlingWorkerId || !settlingWorker) return
        if (settlingReadiness?.issueCount) {
            toast.error('Resolve the payroll readiness issues before marking this worker paid.')
            return
        }
        void runAction(
            `settle-${settlingWorkerId}`,
            () => settleBaseWorkerPayroll({ workerId: settlingWorkerId, paymentMode, periodEnd: settlingWorker.period_end, expected: basePayrollReview(settlingWorker, settlementRequestId) }),
            'Worker payroll marked as paid.',
            () => setSettlingWorkerId(null),
        )
    }

    return (
        <div className={`space-y-5 pb-8 ${view === 'operations' ? 'configuration-page-frame' : ''}`}>
            {navigation.returnTo && (
                <Button asChild variant="outline" size="sm" className="h-9 rounded-xl border-hairline bg-surface text-ink shadow-xs hover:border-hairline-strong hover:bg-surface-soft hover:text-ink">
                    <Link href={navigation.returnTo} className="inline-flex items-center gap-1.5">
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to previous workspace</span>
                    </Link>
                </Button>
            )}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-saffron-deep">Weavly Base</p>
                    <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
                        {view === 'operations' ? 'Worker–Machine Assignments' : view === 'payroll' ? 'Payroll' : 'Production'}
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-body">
                        {view === 'operations'
                            ? 'Assign workers to machines and manage existing assignments.'
                            : view === 'payroll'
                                ? 'Review piece-rate earnings, staff salaries, worker advances, and settle the current pay period.'
                                : 'Create production jobs from saved costings and record daily machine metres.'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {view === 'payroll' && (
                        <Button
                            variant="outline"
                            className={activeTab === 'history' ? 'rounded-xl border-loom bg-loom text-white shadow-xs hover:bg-loom-elevated hover:text-white' : 'rounded-xl border-hairline bg-surface text-ink shadow-xs hover:border-hairline-strong hover:bg-surface-soft'}
                            onClick={() => setActiveTab(activeTab === 'history' ? 'pay' : 'history')}
                        >
                            <History className="h-4 w-4" />
                            {activeTab === 'history' ? 'Current payroll' : 'Payroll records'}
                        </Button>
                    )}
                </div>
            </div>

            {view === 'payroll' && activeTab === 'history' && (
                <BasePayrollRecords initialData={initialData} onBack={() => setActiveTab('pay')} />
            )}

            {view === 'production' && (
                <Card className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
                    <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 sm:divide-x divide-hairline">
                        <div className="p-4 sm:p-5">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                                <span>Open jobs</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-black tracking-tight text-ink">{openJobs}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Planned or active</p>
                        </div>
                        <div className="p-4 sm:p-5">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                <span>Produced this period</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-black tracking-tight text-ink">{formatMeters(producedThisPeriod)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{formatDateOnly(initialData.payrollPeriod.start)} – {formatDateOnly(initialData.payrollPeriod.end)}</p>
                        </div>
                    </div>
                </Card>
            )}

            {view === 'payroll' && activeTab !== 'history' && (
                <Card className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
                    <div className="flex flex-col gap-4 border-b border-hairline bg-surface-soft/40 p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center rounded-xl border border-hairline bg-surface p-0.5 shadow-xs">
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() => setSelectedMonthKey((curr) => getAdjacentMonthKey(curr, -1))}
                                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-ink"
                                    aria-label="Previous month"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <div className="px-2.5 py-1 text-sm font-bold text-ink sm:text-base">
                                    {activeMonthLabel}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() => setSelectedMonthKey((curr) => getAdjacentMonthKey(curr, 1))}
                                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-ink"
                                    aria-label="Next month"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>

                            <span className="text-xs font-medium text-muted-foreground">
                                {formatDateOnly(activePeriodBounds.start)} – {formatDateOnly(activePeriodBounds.end)}
                            </span>

                            {activePeriodSummary.status === 'settled' ? (
                                <Badge className="bg-emerald-600 font-bold text-xs text-white">
                                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Settled
                                </Badge>
                            ) : activePeriodSummary.status === 'ready_to_complete' ? (
                                <Badge className="bg-loom font-bold text-xs text-white">
                                    Ready to Complete
                                </Badge>
                            ) : activePeriodSummary.status === 'in_progress' ? (
                                <Badge variant="warning" className="font-bold text-xs">
                                    In Progress ({activePeriodSummary.paidWorkers}/{activePeriodSummary.totalWorkers})
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="font-bold text-xs">
                                    Open
                                </Badge>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                onClick={() => setWorkspaceOpen(true)}
                                className="h-10 rounded-xl bg-loom px-4 font-bold text-white shadow-xs hover:bg-loom-elevated"
                            >
                                <WalletCards className="mr-2 h-4 w-4" />
                                {activePeriodSummary.status === 'settled'
                                    ? 'View Settled Payroll'
                                    : activePeriodSummary.status === 'ready_to_complete'
                                        ? 'Complete Payroll →'
                                        : activePeriodSummary.status === 'in_progress'
                                            ? 'Continue Settlement →'
                                            : 'Settle Payroll →'}
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 divide-y divide-hairline sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
                        <div className="p-4 sm:p-5">
                            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                <ReceiptText className="h-4 w-4 text-muted-foreground" />
                                <span>Total Payroll</span>
                            </div>
                            <p className="text-xl font-black tracking-tight text-ink sm:text-2xl">
                                {formatINR(activePeriodSummary.totalGross, { hideDecimals: true })}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {formatINR(activePeriodSummary.totalRecovery, { hideDecimals: true })} recovery · {formatINR(activePeriodSummary.totalNet, { hideDecimals: true })} net
                            </p>
                        </div>

                        <div className="p-4 sm:p-5">
                            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                <span>Paid so far</span>
                            </div>
                            <p className="text-xl font-black tracking-tight text-emerald-600 sm:text-2xl">
                                {formatINR(activePeriodSummary.totalPaid, { hideDecimals: true })}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {activePeriodSummary.paidWorkers} of {activePeriodSummary.totalWorkers} workers settled
                            </p>
                        </div>

                        <div className="p-4 sm:p-5">
                            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                <Clock3 className="h-4 w-4 text-muted-foreground" />
                                <span>Remaining to settle</span>
                            </div>
                            <p className={`text-xl font-black tracking-tight sm:text-2xl ${activePeriodSummary.totalRemaining > 0 ? 'text-saffron-deep' : 'text-ink'}`}>
                                {formatINR(activePeriodSummary.totalRemaining, { hideDecimals: true })}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {activePeriodSummary.outstandingWorkers} workers outstanding
                            </p>
                        </div>
                    </div>

                    <div className="border-t border-hairline bg-surface-soft/30 px-4 py-3 sm:px-5">
                        <div className="flex items-center justify-between text-xs font-semibold text-body mb-1.5">
                            <span>Settlement Progress</span>
                            <span className="font-bold text-ink">{activePeriodSummary.progressPercent}% settled</span>
                        </div>
                        <div
                            className="h-2 w-full overflow-hidden rounded-full bg-surface-soft border border-hairline"
                            role="progressbar"
                            aria-valuenow={activePeriodSummary.progressPercent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                        >
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                    activePeriodSummary.progressPercent === 100 ? 'bg-emerald-600' : 'bg-saffron'
                                }`}
                                style={{ width: `${activePeriodSummary.progressPercent}%` }}
                            />
                        </div>
                    </div>
                </Card>
            )}

            {view === 'operations' && <BaseAssignmentWorkspace key={`${initialData.orgId}:${navigation.worker ?? "all"}:${navigation.machine ?? "all"}:${navigation.shift ?? "day"}`} initialData={initialData} focusWorkerId={searchParams.get("worker") ?? undefined} focusMachineId={searchParams.get("machine") ?? undefined} initialShift={navigation.shift} tourMetadata={tourMetadata} />}

            {(view === 'production' || (view === 'payroll' && activeTab !== 'history')) && <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                {view === 'production' && <TabsList className="grid h-11 w-full max-w-md grid-cols-2 rounded-xl border border-hairline bg-surface-soft p-1 shadow-xs">
                    <TabsTrigger value="jobs" className="rounded-lg text-xs sm:text-sm font-bold data-[state=active]:bg-loom data-[state=active]:text-white data-[state=active]:shadow-xs text-muted-foreground hover:text-ink transition-all">Jobs</TabsTrigger>
                    <TabsTrigger value="production" className="rounded-lg text-xs sm:text-sm font-bold data-[state=active]:bg-loom data-[state=active]:text-white data-[state=active]:shadow-xs text-muted-foreground hover:text-ink transition-all">Daily production</TabsTrigger>
                </TabsList>}

                {view === 'production' && <TabsContent value="jobs" className="space-y-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div>
                            <h2 className="text-lg font-bold text-ink">Production jobs</h2>
                            <p className="text-sm text-muted-foreground">Each job keeps the costing economics and a simple metre target.</p>
                        </div>
                        <Button size="sm" onClick={openNewJob} disabled={initialData.costings.length === 0} className="h-10 px-4 rounded-xl bg-loom text-white font-bold shadow-xs hover:bg-loom-elevated">
                            <Plus className="h-4 w-4" /> New job
                        </Button>
                    </div>

                    {initialData.costings.length === 0 && (
                        <EmptyState
                            title="Save a costing first"
                            description="A Base production job starts from an active saved costing, so the planned economics stay visible."
                            action={<Button asChild size="sm"><Link href="/owner/estimator">Create a costing</Link></Button>}
                        />
                    )}

                    {initialData.jobs.length === 0 && initialData.costings.length > 0 && (
                        <EmptyState
                            title="No production jobs yet"
                            description="Create the first job from a costing when you are ready to start recording output."
                            action={<Button size="sm" onClick={openNewJob}><Plus className="h-4 w-4" /> Create job</Button>}
                        />
                    )}

                    <BaseMachineJobs initialData={initialData} />

                    <div className="grid gap-4 lg:grid-cols-2">
                        {initialData.jobs.map((job) => {
                            const summary = jobSummaries.get(job.id) ?? calculateBaseJobSummary(job, initialData.entries, initialData.allocations)
                            const nextStatus = getNextStatus(job.status)
                            const isJobPending = pendingAction === `job-status-${job.id}`

                            return (
                                <Card key={job.id} className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs hover:border-hairline-strong transition-all">
                                    <CardHeader className="border-b border-hairline bg-surface-soft/40 p-4 sm:p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <CardTitle className="truncate text-base font-bold text-ink">{job.quality_label}</CardTitle>
                                                <CardDescription className="mt-1 text-xs text-muted-foreground">
                                                    {job.customer_reference || 'Internal production job'} · Start date {formatDateOnly(job.start_date)}
                                                </CardDescription>
                                            </div>
                                            <Badge variant={getStatusVariant(job.status)} className="capitalize font-bold text-[10px]">{job.status}</Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4 p-4 sm:p-5 pt-4">
                                        <div>
                                            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-body">
                                                <span>{formatMeters(summary.produced_meters)} produced</span>
                                                <span className="font-bold text-ink">{formatMeters(job.target_meters)} target</span>
                                            </div>
                                            <div
                                                className="h-2 overflow-hidden rounded-full bg-surface-soft border border-hairline"
                                                role="progressbar"
                                                aria-label={`${summary.progress_percent}% complete`}
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                                aria-valuenow={summary.progress_percent}
                                            >
                                                <div className="h-full rounded-full bg-saffron transition-all duration-500" style={{ width: `${Math.min(100, summary.progress_percent)}%` }} />
                                            </div>
                                            <p className="mt-1.5 text-xs text-muted-foreground">
                                                {summary.progress_percent.toFixed(0)}% complete · {summary.excess_meters > 0 ? `${formatMeters(summary.excess_meters)} excess` : `${formatMeters(summary.remaining_meters)} remaining`}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 rounded-xl border border-hairline bg-surface-soft/60 p-3.5 text-sm">
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Planned cost</p>
                                                <p className="mt-1 text-base font-black text-ink">{formatINR(summary.planned_cost_total, { hideDecimals: true })}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Due date</p>
                                                <p className="mt-1 text-base font-black text-ink">{job.due_date ? formatDateOnly(job.due_date) : 'No due date'}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 pt-1">
                                            <Button size="sm" onClick={() => openRecord(job.id)} disabled={job.status === 'completed' || job.status === 'cancelled'} className="h-9 rounded-xl bg-loom text-white text-xs font-bold shadow-xs hover:bg-loom-elevated">
                                                <ClipboardList className="h-4 w-4" /> Daily production
                                            </Button>
                                            {nextStatus && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleJobStatus(job.id, nextStatus)}
                                                    disabled={isJobPending}
                                                    className="h-9 rounded-xl border-hairline bg-surface text-ink text-xs font-bold hover:bg-surface-soft shadow-xs"
                                                >
                                                    {isJobPending ? <Loader2 className="h-4 w-4 animate-spin" /> : nextStatus === 'active' && job.status !== 'planned' ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                                                    {getStatusActionLabel(job.status)}
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </TabsContent>}

                {view === 'production' && <TabsContent value="production" className="space-y-4">
                    <BaseDailyProductionSheet initialData={initialData} navigation={navigation} onAddWorker={() => openSetup('worker')} onAddMachine={() => openSetup('machine')} />

                    <Card className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
                        <CardHeader className="border-b border-hairline p-4 sm:p-5">
                            <CardTitle className="flex items-center gap-2 text-base font-bold text-ink"><Clock3 className="h-4 w-4 text-muted-foreground" /> Recent production</CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">Latest saved machine production. Worker totals and pay use the saved weaver rate for each machine allocation.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-5 space-y-3">
                            <div>
                                <Label htmlFor="base-production-search" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Find date, worker, machine, or job</Label>
                                <Input id="base-production-search" className="mt-1.5 h-10 sm:h-11 rounded-xl border border-hairline bg-surface text-ink shadow-xs" value={productionSearch} onChange={event => { setProductionSearch(event.target.value); setHistoryCount(12) }} placeholder="Search production history" />
                            </div>
                            {visibleProduction.length === 0 ? (
                                <EmptyState compact title="No production recorded" description="Your saved worker totals will appear here." />
                            ) : (
                                <div className="divide-y divide-hairline rounded-xl border border-hairline bg-surface overflow-hidden">
                                    {visibleProduction.slice(0, historyCount).map((entry) => {
                                        const isLegacyWorkerTotal = entry.meters > 0 && entry.allocation_mode !== 'machine_breakdown' && !entry.machine_id
                                        return (
                                            <div key={entry.id} className="flex flex-col gap-2 p-3 sm:p-3.5 text-sm sm:flex-row sm:items-center sm:justify-between hover:bg-surface-soft/40 transition-colors">
                                                <div className="min-w-0">
                                                    <p className="truncate font-bold text-ink">{workerById.get(entry.worker_id)?.name ?? 'Worker'} · {entry.job_label ?? jobById.get(entry.job_id)?.quality_label ?? (isLegacyWorkerTotal ? 'Legacy worker total' : 'Production')}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">{formatDateOnly(entry.production_date)}{entry.shift ? ` · ${entry.shift} shift` : ''}{entry.machine_label ? ` · ${entry.machine_label}` : ''}{isLegacyWorkerTotal ? ' · payroll included at saved rate' : ''}</p>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <div className="font-black text-ink">{entry.entry_status === 'zero' ? '0 m' : entry.entry_status === 'absent' ? 'Absent' : `${formatMeters(entry.meters)} · ${formatINR(calculateBaseEntryGrossPay(entry, initialData.allocations.filter((allocation) => allocation.entry_id === entry.id)))}`}</div>
                                                    <Button asChild variant="outline" size="sm" className="h-8 rounded-lg border-hairline bg-surface text-xs font-medium hover:bg-surface-soft"><Link href={baseProductionHref({ date: entry.production_date, shift: entry.shift, entry: entry.id, worker: entry.worker_id })}>View log</Link></Button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                            {visibleProduction.length > historyCount && (
                                <Button variant="outline" className="w-full h-10 rounded-xl border-hairline bg-surface text-xs font-bold shadow-xs hover:bg-surface-soft" onClick={() => setHistoryCount(count => count + 24)}>
                                    Show more production ({visibleProduction.length - historyCount} remaining)
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>}

                {view === 'payroll' && <TabsContent value="pay" className="space-y-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                        <div>
                            <h2 className="text-lg font-bold text-ink">Worker pay</h2>
                            <p className="text-sm text-body">Outstanding earnings through {formatDateOnly(initialData.payrollPeriod.end)}. Earlier unpaid work is included.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Select value={paymentMode} onValueChange={(value) => setPaymentMode(value as BasePayrollPaymentMode)}>
                                <SelectTrigger className="w-[170px]" aria-label="Payment mode"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="cash">Paid by cash</SelectItem><SelectItem value="bank_transfer">Bank transfer</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="cheque">Cheque</SelectItem></SelectContent>
                            </Select>
                            <Button variant="outline" onClick={() => openSetup()}><Settings2 className="h-4 w-4" /> Manage workers</Button>
                        </div>
                    </div>

                    <BasePayrollReadinessPanel readiness={payrollReadiness} />
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div><Label htmlFor="base-payroll-search" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Find worker</Label><Input id="base-payroll-search" className="mt-1 h-10 sm:h-11 rounded-xl border-hairline bg-surface text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom" value={payrollSearch} onChange={event => setPayrollSearch(event.target.value)} placeholder="Worker name" /></div>
                        <div><Label htmlFor="base-payroll-filter" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment status</Label><Select value={payrollFilter} onValueChange={setPayrollFilter}><SelectTrigger id="base-payroll-filter" className="mt-1 h-10 sm:h-11 rounded-xl border-hairline bg-surface text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl border-hairline bg-surface shadow-lg"><SelectItem value="all">All workers</SelectItem><SelectItem value="ready">Ready to pay</SelectItem><SelectItem value="review">Needs review</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="empty">No earnings</SelectItem></SelectContent></Select></div>
                    </div>

                    <Card className="rounded-2xl border border-hairline bg-surface shadow-xs">
                        <CardContent className="flex items-start gap-3 p-4 sm:p-5 text-sm">
                            <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-saffron-deep" />
                            <p className="leading-relaxed text-xs sm:text-sm text-body">Piece-rate pay uses saved machine rates. Fixed salaries accrue by calendar day, including joining/leaving dates and effective-dated salary changes. Recovery is capped at the lower of the outstanding advance balance or 50% of gross pay; any remaining balance carries forward.</p>
                        </CardContent>
                    </Card>

                    {initialData.workers.length === 0 ? (
                        <EmptyState title="No workers yet" description="Add workers in Workers before recording metres or settling payroll." action={<Button size="sm" onClick={() => openSetup()} className="rounded-xl bg-loom text-white font-bold shadow-xs hover:bg-loom-elevated"><Settings2 className="h-4 w-4" /> Manage workers</Button>} />
                    ) : visiblePayables.length === 0 ? (
                        <EmptyState title="No matching workers" description="Try another name or payment status." action={<Button variant="outline" onClick={() => { setPayrollSearch(''); setPayrollFilter('all') }} className="rounded-xl border-hairline hover:bg-surface-soft font-semibold">Clear filters</Button>} />
                    ) : (
                        <div className="grid gap-4 lg:grid-cols-2">
                            {visiblePayables.map((payable) => {
                                const worker = workerById.get(payable.worker_id)
                                const workerReadiness = readinessByWorker.get(payable.worker_id)
                                const settlePending = pendingAction === `settle-${payable.worker_id}`
                                return (
                                    <Card key={payable.worker_id} className={`rounded-2xl border border-hairline bg-surface shadow-xs overflow-hidden transition-all ${!worker?.is_active ? 'opacity-75' : 'hover:border-hairline-strong'}`}>
                                        <CardHeader className="border-b border-hairline bg-surface-soft/40 p-4 sm:p-5">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <CardTitle className="truncate text-base font-bold text-ink">{payable.worker_name}</CardTitle>
                                                    <CardDescription className="mt-1 text-xs text-muted-foreground">{worker?.pay_type === 'fixed_monthly' ? `${worker.role || 'Staff'} · Fixed monthly salary${worker.is_active ? '' : ' · Inactive'}` : worker?.is_active ? `${worker.shift_availability === 'both' ? 'Day & night' : worker.shift_availability === 'day' ? 'Day' : 'Night'} shift · weaver rate applied per machine` : 'Inactive worker'}</CardDescription>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {workerReadiness?.issueCount ? <Badge variant="warning" className="font-bold text-[10px]">Review</Badge> : null}
                                                    <Badge variant={payable.status === 'paid' ? 'success' : 'warning'} className="font-bold text-[10px]">{payable.status === 'paid' ? 'Paid' : 'Open'}</Badge>
                                                    <Button variant="ghost" size="icon-xs" aria-label={`Manage ${payable.worker_name} in Workers`} onClick={() => openSetup(undefined, payable.worker_id)} className="h-7 w-7 rounded-lg text-muted-foreground hover:text-ink"><Settings2 className="h-3.5 w-3.5" /></Button>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4 p-4 sm:p-5">
                                            <p className="text-xs font-semibold text-muted-foreground">{formatDateOnly(payable.period_start)} – {formatDateOnly(payable.period_end)}</p>
                                            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                                                <Metric label={payable.pay_type === 'fixed_monthly' ? 'Pay basis' : 'Metres'} value={payable.pay_type === 'fixed_monthly' ? 'Monthly salary' : formatMeters(payable.meters)} />
                                                <Metric label="Gross" value={formatINR(payable.gross_pay, { hideDecimals: true })} />
                                                <Metric label="Recovery" value={formatINR(payable.advance_recovery, { hideDecimals: true })} />
                                                <Metric label="Net pay" value={formatINR(payable.net_payout, { hideDecimals: true })} emphasis />
                                            </div>
                                            <div className="rounded-xl border border-hairline bg-surface-soft/60 p-3 text-xs leading-relaxed text-body">
                                                {payable.pay_type === 'fixed_monthly' && payable.status !== 'paid' && <div className="mb-2 space-y-1">{payable.salary_lines?.map(line => <p key={line.start}>{formatDateOnly(line.start)} – {formatDateOnly(line.end)}: {formatINR(line.monthlySalary)} × {line.days}/{line.monthDays} days = {formatINR(line.grossPay)}</p>)}</div>}
                                                {payable.status === 'paid'
                                                    ? <>Paid on {formatDateOnly(payable.paid_at)} · {formatINR(payable.advance_recovery, { hideDecimals: true })} advance recovered.</>
                                                    : payable.pending_advance > 0
                                                        ? <>{formatINR(payable.advance_recovery, { hideDecimals: true })} advance will be recovered this period from {formatINR(payable.pending_advance, { hideDecimals: true })} pending.{payable.remaining_debt > 0 ? ` ${formatINR(payable.remaining_debt, { hideDecimals: true })} carries forward.` : ''}</>
                                                        : <>No advance to recover. Full gross pay is due this period.</>}
                                            </div>
                                            {workerReadiness && workerReadiness.verifiedLineCount > 0 && (
                                                <p className="flex items-center gap-1.5 text-xs font-medium text-success"><CheckCircle2 className="h-3.5 w-3.5" /> {workerReadiness.verifiedLineCount} earning {workerReadiness.verifiedLineCount === 1 ? 'line' : 'lines'} reconciled{workerReadiness.legacyLineCount > 0 ? ` · ${workerReadiness.legacyLineCount} legacy` : ''}</p>
                                            )}
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                <Button size="sm" onClick={() => openAdvance(payable.worker_id)} disabled={!worker?.is_active} className="h-9 rounded-xl border-hairline bg-surface text-ink text-xs font-bold hover:bg-surface-soft shadow-xs"><Plus className="h-4 w-4" /> Add advance</Button>
                                                {payable.status === 'unsettled' && payable.gross_pay > 0 && <Button size="sm" variant="outline" onClick={() => { setSettlementRequestId(crypto.randomUUID()); setSettlingWorkerId(payable.worker_id) }} disabled={settlePending || Boolean(workerReadiness?.issueCount)} className="h-9 rounded-xl bg-loom text-white text-xs font-bold shadow-xs hover:bg-loom-elevated">{settlePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <WalletCards className="h-4 w-4" />} {workerReadiness?.issueCount ? 'Review before paying' : 'Mark paid'}</Button>}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </TabsContent>}
            </Tabs>}

            <Dialog open={dialog === 'job'} onOpenChange={(open) => !open && closeDialog()}>
                <DialogContent className="max-w-lg rounded-2xl border border-hairline bg-surface p-6 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-ink">New production job</DialogTitle>
                        <DialogDescription className="text-sm text-body">Start with an active saved costing. This creates a Base production job, not a formal party order.</DialogDescription>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={handleJobSubmit}>
                        <div className="space-y-2">
                            <Label htmlFor="base-job-costing" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Saved costing</Label>
                            <Select value={jobDraft.costingId} onValueChange={(value) => setJobDraft((current) => ({ ...current, costingId: value, targetMeters: costingTargetMeters(initialData.costings.find((costing) => costing.id === value)) }))}>
                                <SelectTrigger id="base-job-costing" className="h-10 sm:h-11 w-full rounded-xl border-hairline bg-surface text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom"><SelectValue placeholder="Select a saved costing" /></SelectTrigger>
                                <SelectContent className="rounded-xl border-hairline bg-surface shadow-lg">{initialData.costings.map((costing) => <SelectItem key={costing.id} value={costing.id}>{costing.quality_label} · v{costing.version_number} · {formatINR(costing.production_cost_per_meter)}/m cost</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="base-job-target" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Target metres</Label>
                                <Input id="base-job-target" type="number" min="0.01" step="0.01" inputMode="decimal" value={jobDraft.targetMeters} onChange={(event) => setJobDraft((current) => ({ ...current, targetMeters: event.target.value }))} placeholder="1000" className="h-10 sm:h-11 rounded-xl border-hairline bg-surface text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom" />
                                <p className="text-xs text-muted-foreground">Prefilled from the costing quantity when available; adjust for this production run.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="base-job-start" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Start date</Label>
                                <Input id="base-job-start" type="date" value={jobDraft.startDate} onChange={(event) => setJobDraft((current) => ({ ...current, startDate: event.target.value }))} className="h-10 sm:h-11 rounded-xl border-hairline bg-surface text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="base-job-due" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Due date <span className="font-normal text-muted-foreground">(optional)</span></Label>
                            <Input id="base-job-due" type="date" min={jobDraft.startDate} value={jobDraft.dueDate} onChange={(event) => setJobDraft((current) => ({ ...current, dueDate: event.target.value }))} className="h-10 sm:h-11 rounded-xl border-hairline bg-surface text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="base-job-reference" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Customer / internal reference <span className="font-normal text-muted-foreground">(optional)</span></Label>
                            <Input id="base-job-reference" value={jobDraft.customerReference} onChange={(event) => setJobDraft((current) => ({ ...current, customerReference: event.target.value }))} placeholder="e.g. Patel Traders · grey fabric" className="h-10 sm:h-11 rounded-xl border-hairline bg-surface text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="base-job-notes" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
                            <Textarea id="base-job-notes" rows={2} value={jobDraft.notes} onChange={(event) => setJobDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Short job note" className="rounded-xl border-hairline bg-surface text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom" />
                        </div>
                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl border-hairline hover:bg-surface-soft font-semibold">Cancel</Button>
                            <Button type="submit" disabled={pendingAction === 'job-create'} className="rounded-xl bg-loom text-white font-bold shadow-xs hover:bg-loom-elevated">
                                {pendingAction === 'job-create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create job
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={dialog === 'advance'} onOpenChange={(open) => !open && closeDialog()}>
                <DialogContent className="max-w-md rounded-2xl border border-hairline bg-surface p-6 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-ink">Record worker advance</DialogTitle>
                        <DialogDescription className="text-sm text-body">The advance stays pending until a later Base payroll settlement recovers it.</DialogDescription>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={handleAdvanceSubmit}>
                        <div className="space-y-2">
                            <Label htmlFor="base-advance-worker" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Worker</Label>
                            <Select value={advanceDraft.workerId} onValueChange={(value) => setAdvanceDraft((current) => ({ ...current, workerId: value }))}>
                                <SelectTrigger id="base-advance-worker" className="h-10 sm:h-11 w-full rounded-xl border-hairline bg-surface text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom"><SelectValue placeholder="Select a worker" /></SelectTrigger>
                                <SelectContent className="rounded-xl border-hairline bg-surface shadow-lg">{activeWorkers.map((worker) => <SelectItem key={worker.id} value={worker.id}>{worker.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="base-advance-amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount</Label>
                            <Input id="base-advance-amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={advanceDraft.amount} onChange={(event) => setAdvanceDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" className="h-10 sm:h-11 rounded-xl border-hairline bg-surface text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="base-advance-description" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
                            <Textarea id="base-advance-description" rows={2} value={advanceDraft.description} onChange={(event) => setAdvanceDraft((current) => ({ ...current, description: event.target.value }))} placeholder="e.g. Personal advance" className="rounded-xl border-hairline bg-surface text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom" />
                        </div>
                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl border-hairline hover:bg-surface-soft font-semibold">Cancel</Button>
                            <Button type="submit" disabled={pendingAction === 'advance-create'} className="rounded-xl bg-loom text-white font-bold shadow-xs hover:bg-loom-elevated">
                                {pendingAction === 'advance-create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Record advance
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmActionDialog
                open={Boolean(settlingWorkerId)}
                onOpenChange={(open) => !open && setSettlingWorkerId(null)}
                title={`Mark ${settlingWorker?.worker_name ?? 'worker'} as paid?`}
                description={settlingWorker ? `Record ${formatINR(settlingWorker.net_payout)} paid for ${formatDateOnly(settlingWorker.period_start)} – ${formatDateOnly(settlingWorker.period_end)}. Gross ${formatINR(settlingWorker.gross_pay)}, advance recovery ${formatINR(settlingWorker.advance_recovery)}. This records a payment; it does not send money. This worker’s production and rates will be protected. Unpaid workers on the same shift can still be corrected.` : 'The current worker payroll will be settled.'}
                confirmLabel="Mark as paid"
                onConfirm={handleSettle}
                isLoading={pendingAction === `settle-${settlingWorkerId}`}
            />

            {view === 'payroll' && (
                <BasePayrollSettlementWorkspace
                    open={workspaceOpen}
                    onOpenChange={setWorkspaceOpen}
                    period={{
                        start: activePeriodBounds.start,
                        end: activePeriodBounds.end,
                        label: activeMonthLabel,
                    }}
                    payables={initialData.payables}
                    periodRecord={activePeriodRecord}
                    workers={initialData.workers}
                    readinessByWorker={readinessByWorker}
                    defaultPaymentMode={paymentMode}
                    onSuccess={() => {
                        router.refresh()
                    }}
                    onViewRecords={() => {
                        setActiveTab('history')
                    }}
                />
            )}
        </div>
    )
}

function Metric({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
    return <div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className={emphasis ? 'mt-1 text-sm sm:text-base font-black text-saffron-deep' : 'mt-1 text-sm sm:text-base font-black text-ink'}>{value}</p></div>
}

function EmptyState({ title, description, action, compact = false }: { title: string; description: string; action?: React.ReactNode; compact?: boolean }) {
    return (
        <div className={`rounded-2xl border border-dashed border-hairline bg-surface-soft/40 text-center ${compact ? 'p-5' : 'p-8'}`}>
            <p className="font-bold text-ink">{title}</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-body">{description}</p>
            {action && <div className="mt-4 flex justify-center">{action}</div>}
        </div>
    )
}
