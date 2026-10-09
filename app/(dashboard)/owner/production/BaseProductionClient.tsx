'use client'
import { useLocalizedPageTitle } from '@/hooks/use-localized-page-title'
import { RouteMilestones } from '@/components/performance/route-milestones'

import Link from 'next/link'
import dynamic, { type DynamicOptionsLoadingProps } from 'next/dynamic'
import { createContext, useContext, useEffect, useMemo, useState, type ComponentType, type FormEvent } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/context'
import { useTourSample } from '@/lib/tours/sample-context'
import { tourSurfaceProps } from '@/lib/tours/sample-surface'
import { TourSampleBanner } from '@/components/tours/TourSampleBanner'
import {
    ArrowLeft,
    CheckCircle2,
    Clock3,
    Factory,
    History,
    ChevronLeft,
    ChevronRight,
    Layers,
    Loader2,
    Minus,
    Plus,
    ReceiptText,
    Settings2,
    Users,
    WalletCards,
    Wrench,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { railPrimaryAction } from '@/components/ui/rail'
import { PageHeader } from '@/components/ui/page-header'
import { PageGuide } from '@/components/tours/TourInvitation'
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
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog'
import { BulkAdjustmentDialog } from '@/components/payroll/BulkAdjustmentDialog'
import { DEDUCTION_REASONS, type DeductionReason } from '@/lib/base-bulk-adjustment'
import { formatINR } from '@/lib/finance'
import { buildBasePayrollReadiness } from '@/lib/base-payroll-readiness'
import { basePayrollReview } from '@/lib/base-payroll-review'
import { baseDailySheetHref, baseProductionHref, baseProductionTabForPath, readBaseProductionNavigation } from '@/lib/base-production-navigation'
import { trackPlanEvent } from '@/lib/plan-analytics'
import {
    buildBaseLoomOutputRows,
    calculateBaseProductionDay,
    compareBaseProductionDays,
    getBasePreviousDate,
    metersOutsideBaseJobs,
} from '@/lib/base-production-analytics'
import {
    calculateBaseEntryGrossPay,
    calculateBasePayrollPeriodSummary,
    calculateBaseWorkerPayables,
    type BasePayrollPaymentMode,
} from '@/lib/base-production-core'
import {
    type PayrollCycleRule,
    DEFAULT_MONTHLY_CYCLE_RULE,
    getPeriodContaining,
    addDays,
    formatPayrollPeriodLabel,
} from '@/lib/payroll-cycle-engine'

import {
    createBaseWorkerAdvance,
    createBaseWorkerDeduction,
    settleBaseWorkerPayroll,
} from './actions'
import BaseActiveQualities from './BaseActiveQualities'
import BaseAssignmentWorkspace from './BaseAssignmentWorkspace'
import BaseProductionLoomChart from './BaseProductionLoomChart'
import BaseDailyProductionSheet from './BaseDailyProductionSheet'
import BasePayrollReadinessPanel from './BasePayrollReadinessPanel'
import BaseWorkerIncentives from './BaseWorkerIncentives'
import type { BaseProductionInitialData } from './loaders'

// App Router's dynamic loader only supplies a loading fallback: rejected imports
// otherwise escape to the page boundary. Resolve failures to a local retry screen
// so connectivity recovery never requires throwing away the current page state.
export function payrollImportRecovery<Props extends object>(
    load: () => Promise<{ default: ComponentType<Props> }>,
    Loading: ComponentType<DynamicOptionsLoadingProps>,
    initialError: Error,
): ComponentType<Props> {
    let resolved: ComponentType<Props> | null = null
    return function PayrollImportRecovery(props: Props) {
        const [Loaded, setLoaded] = useState<ComponentType<Props> | null>(() => resolved)
        const [error, setError] = useState<Error | null>(initialError)
        const [loading, setLoading] = useState(false)
        async function retry() {
            if (loading) return
            setLoading(true)
            setError(null)
            try {
                const screen = await load()
                resolved = screen.default
                setLoaded(() => screen.default)
            } catch (failure) {
                setError(failure instanceof Error ? failure : new Error('Payroll screen could not be loaded'))
            } finally {
                setLoading(false)
            }
        }
        return Loaded ? <Loaded {...props} /> : <Loading error={error} isLoading={loading} retry={retry} />
    }
}

const BasePayrollRecords = dynamic(() => import('./BasePayrollRecords').catch(error => ({
    default: payrollImportRecovery(() => import('./BasePayrollRecords'), PayrollRecordsLoading, error),
})), { loading: PayrollRecordsLoading })
const BasePayrollSettlementWorkspace = dynamic(() => import('./BasePayrollSettlementWorkspace').catch(error => ({
    default: payrollImportRecovery(() => import('./BasePayrollSettlementWorkspace'), PayrollSettlementLoading, error),
})), { loading: PayrollSettlementLoading })

const SettlementLoadingContext = createContext<{ open: boolean; onOpenChange: (open: boolean) => void }>({ open: false, onOpenChange: () => {} })

function PayrollLoadStatus({ error, retry, settlement = false }: DynamicOptionsLoadingProps & { settlement?: boolean }) {
    const { t } = useTranslation()
    return <div className="space-y-3">
        <p role={error ? 'alert' : 'status'} className="flex items-center gap-2 text-sm text-body" data-i18n-skip="true">
            {!error && <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />}
            {error ? t('payroll.loadFailed') : t(settlement ? 'payroll.loadingSettlement' : 'payroll.loadingRecords')}
        </p>
        {error && retry && <Button variant="outline" onClick={retry} data-i18n-skip="true">{t('common.retry')}</Button>}
    </div>
}

function PayrollRecordsLoading(props: DynamicOptionsLoadingProps) {
    const { t } = useTranslation()
    return <section className="space-y-3 rounded-xl border border-hairline bg-surface p-5" aria-busy={!props.error}>
        <h2 className="text-lg font-semibold text-ink" data-i18n-skip="true">{t('payroll.payrollRecords')}</h2>
        <PayrollLoadStatus {...props} />
    </section>
}

function PayrollSettlementLoading(props: DynamicOptionsLoadingProps) {
    const { t } = useTranslation()
    const { open, onOpenChange } = useContext(SettlementLoadingContext)
    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent aria-busy={!props.error}>
            <DialogHeader>
                <DialogTitle data-i18n-skip="true">{t('payroll.settlePayroll')}</DialogTitle>
                <DialogDescription className="sr-only" data-i18n-skip="true">{t(props.error ? 'payroll.loadFailed' : 'payroll.loadingSettlement')}</DialogDescription>
            </DialogHeader>
            <PayrollLoadStatus {...props} settlement />
            <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} data-i18n-skip="true">{t('common.cancel')}</Button></DialogFooter>
        </DialogContent>
    </Dialog>
}

type BaseProductionView = 'production' | 'operations' | 'payroll'

// The shared production client also serves daily entry and assignments. Keep
// payroll's full-history calculations dormant until the payroll view needs them.
export function useBasePayrollForView(view: BaseProductionView, initialData: BaseProductionInitialData, period: { start: string; end: string }) {
    const { workers, entries, allocations, incentives, advances, settlements, payrollPeriods, today } = initialData
    return useMemo(() => {
        if (view !== 'payroll') return null
        const cutoff = period.end < today ? period.end : today
        const payables = calculateBaseWorkerPayables({
            workers, entries, allocations, incentives: incentives ?? [], advances, settlements, periodEnd: cutoff,
        })
        const periodRecord = (payrollPeriods ?? []).find(record => record.period_start === period.start && record.period_end === period.end) ?? null
        return {
            payables,
            periodRecord,
            summary: calculateBasePayrollPeriodSummary({ payables, periodRecord: periodRecord ?? undefined }),
            readiness: buildBasePayrollReadiness({ payables, entries, allocations }),
        }
    }, [view, workers, entries, allocations, incentives, advances, settlements, payrollPeriods, today, period.start, period.end])
}

const NO_PAYABLES: ReturnType<typeof calculateBaseWorkerPayables> = []

type DialogName = 'job' | 'advance' | 'deduction' | null

type AdvanceDraft = {
    workerId: string
    amount: string
    description: string
}

type DeductionDraft = {
    workerId: string
    amount: string
    reason: DeductionReason
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

function getActionError(result: unknown) {
    if (!result || typeof result !== 'object' || !('error' in result)) return null
    const error = (result as { error?: unknown }).error
    return typeof error === 'string' ? error : 'The action could not be completed.'
}

function emptyAdvanceDraft(workerId = ''): AdvanceDraft {
    return { workerId, amount: '', description: '' }
}

function emptyDeductionDraft(workerId = ''): DeductionDraft {
    return { workerId, amount: '', reason: 'Mistake / Damage', description: '' }
}

export default function BaseProductionClient({
    initialData,
    initialCostingId = null,
    view = 'production',
    tourMetadata,
}: {
    initialData: BaseProductionInitialData
    initialCostingId?: string | null
    view?: BaseProductionView
    tourMetadata?: Record<string, unknown>
}) {
    const router = useRouter()
    const pathname = usePathname()
    const { tx, t } = useTranslation()
    const tourSample = useTourSample()
    const payrollTourStep = useTourSample('payroll')?.step
    const surface = tourSurfaceProps(Boolean(tourSample))
    useLocalizedPageTitle(view === 'operations' ? `${tx('Worker–Machine Assignments')} | Weavly` : null)
    const searchParams = useSearchParams()
    const navigation = readBaseProductionNavigation(searchParams)
    const [payrollTab, setPayrollTab] = useState('pay')
    // Records open on the newest period, or on the one just reviewed in the settlement workspace.
    const [recordsPeriodStart, setRecordsPeriodStart] = useState<string | undefined>()
    const tourShowsRecords = payrollTourStep === 'pra-records' || payrollTourStep === 'pra-export' || payrollTourStep === 'pra-correct'
    const activeTab = view === 'production' ? baseProductionTabForPath(pathname) : tourShowsRecords ? 'history' : payrollTab
    const isDailySheetView = view === 'production' && activeTab === 'production'
    const [isActivateModalOpen, setIsActivateModalOpen] = useState(Boolean(initialCostingId))
    const [productionSearch, setProductionSearch] = useState('')
    const [historyCount, setHistoryCount] = useState(12)
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)
    const [payrollSearch, setPayrollSearch] = useState('')
    const [payrollFilter, setPayrollFilter] = useState('all')

    const [openDialog, setDialog] = useState<DialogName>(null)
    const dialog: DialogName = payrollTourStep === 'pra-advance' ? 'advance' : payrollTourStep === 'pra-deduction' ? 'deduction' : openDialog
    const [pendingAction, setPendingAction] = useState<string | null>(null)
    const [settlingWorkerId, setSettlingWorkerId] = useState<string | null>(null)
    const [settlementRequestId, setSettlementRequestId] = useState('')
    const [paymentMode, setPaymentMode] = useState<BasePayrollPaymentMode>('cash')
    const [advanceDraft, setAdvanceDraft] = useState<AdvanceDraft>(() => emptyAdvanceDraft(tourSample ? initialData.workers[0]?.id : ''))
    const [deductionDraft, setDeductionDraft] = useState<DeductionDraft>(() => emptyDeductionDraft(tourSample ? initialData.workers[0]?.id : ''))
    const [bulkOpen, setBulkOpen] = useState(false)
    const [workspaceOpened, setWorkspaceOpen] = useState(false)
    const workspaceOpen = workspaceOpened || payrollTourStep === 'pr-settle' || payrollTourStep === 'pr-paid' || payrollTourStep === 'pr-complete'
    const [workspaceHasOpened, setWorkspaceHasOpened] = useState(workspaceOpen)
    // Retain optimistic payment progress and nested dialog state after closing.
    // Tour-driven opens use the same first-mount boundary as a user action.
    if (workspaceOpen && !workspaceHasOpened) setWorkspaceHasOpened(true)
    const activeCycleRule = useMemo<PayrollCycleRule>(() => {
        return initialData.payrollCycleConfig?.rule ?? DEFAULT_MONTHLY_CYCLE_RULE
    }, [initialData.payrollCycleConfig])

    const [activePeriod, setActivePeriod] = useState<{ start: string; end: string }>(() => initialData.payrollPeriod)
    const activePeriodBounds = activePeriod

    const handlePreviousPeriod = () => {
        const prev = getPeriodContaining(addDays(activePeriod.start, -1), activeCycleRule)
        setActivePeriod({ start: prev.start, end: prev.end })
    }

    const handleNextPeriod = () => {
        const next = getPeriodContaining(addDays(activePeriod.end, 1), activeCycleRule)
        setActivePeriod({ start: next.start, end: next.end })
    }

    const payrollCutoff = activePeriodBounds.end < initialData.today ? activePeriodBounds.end : initialData.today
    const payroll = useBasePayrollForView(view, initialData, activePeriodBounds)
    const periodPayables = payroll?.payables ?? NO_PAYABLES
    const activePeriodRecord = payroll?.periodRecord ?? null
    const activePeriodSummary = payroll?.summary

    const activePeriodLabel = formatPayrollPeriodLabel(activePeriod.start, activePeriod.end)

    const workerById = useMemo(
        () => new Map(initialData.workers.map((worker) => [worker.id, worker])),
        [initialData.workers],
    )
    const jobById = useMemo(
        () => new Map(initialData.jobs.map((job) => [job.id, job])),
        [initialData.jobs],
    )
    const productionHistoryIndex = useMemo(() => {
        const labels = new Map<string, string[]>()
        const allocations = new Map<string, BaseProductionInitialData['allocations']>()
        if (!isHistoryOpen) return { labels, allocations }
        for (const allocation of initialData.allocations) {
            const current = labels.get(allocation.entry_id) ?? []
            current.push(`${allocation.machine_label} ${allocation.job_label}`)
            labels.set(allocation.entry_id, current)
            const entryAllocations = allocations.get(allocation.entry_id) ?? []
            entryAllocations.push(allocation)
            allocations.set(allocation.entry_id, entryAllocations)
        }
        return { labels, allocations }
    }, [initialData.allocations, isHistoryOpen])
    const visibleProduction = useMemo(() => {
        if (!isHistoryOpen) return []
        const query = productionSearch.trim().toLocaleLowerCase()
        return initialData.entries.filter(entry => {
            if (!(entry.meters > 0 || entry.entry_status === 'zero' || entry.entry_status === 'absent')) return false
            if (!query) return true
            const labels = [entry.production_date, entry.shift, entry.machine_label, entry.job_label,
                workerById.get(entry.worker_id)?.name, jobById.get(entry.job_id)?.quality_label,
                ...(productionHistoryIndex.labels.get(entry.id) ?? [])]
            return labels.join(' ').toLocaleLowerCase().includes(query)
        })
    }, [initialData.entries, isHistoryOpen, productionSearch, workerById, jobById, productionHistoryIndex])
    const activeJobs = useMemo(
        () => initialData.jobs.filter((job) => job.status === 'planned' || job.status === 'active'),
        [initialData.jobs]
    )
    const activeWorkers = useMemo(
        () => initialData.workers.filter((worker) => worker.is_active),
        [initialData.workers]
    )
    const activeMachines = useMemo(
        () => initialData.machines.filter((machine) => machine.is_active),
        [initialData.machines]
    )
    const runningJobIdByMachineId = useMemo(() => {
        const map = new Map<string, string>()
        for (const context of initialData.machineJobContexts) {
            if (!context.active || context.effective_from > initialData.today || (context.effective_to && context.effective_to < initialData.today)) continue
            const job = jobById.get(context.job_id)
            if (job && (job.status === 'planned' || job.status === 'active') && !map.has(context.machine_id)) {
                map.set(context.machine_id, job.id)
            }
        }
        return map
    }, [initialData.machineJobContexts, jobById, initialData.today])
    const runningMachineIds = useMemo(() => new Set(runningJobIdByMachineId.keys()), [runningJobIdByMachineId])
    const runningMachinesCount = activeMachines.filter(m => runningMachineIds.has(m.id)).length
    const availableMachinesCount = Math.max(0, activeMachines.length - runningMachinesCount)
    // Today's output comes from the daily sheets this page already loads, attributed the way job progress is.
    const todayProduction = useMemo(() => calculateBaseProductionDay({
        date: initialData.today,
        entries: initialData.entries,
        allocations: initialData.allocations,
        batches: initialData.dailyBatches,
    }), [initialData.today, initialData.entries, initialData.allocations, initialData.dailyBatches])
    const yesterdayProduction = useMemo(() => calculateBaseProductionDay({
        date: getBasePreviousDate(initialData.today),
        entries: initialData.entries,
        allocations: initialData.allocations,
        batches: initialData.dailyBatches,
    }), [initialData.today, initialData.entries, initialData.allocations, initialData.dailyBatches])
    const yesterdayComparison = useMemo(
        () => compareBaseProductionDays(todayProduction, yesterdayProduction),
        [todayProduction, yesterdayProduction],
    )
    const loomOutputRows = useMemo(() => buildBaseLoomOutputRows({
        machines: initialData.machines,
        runningJobIdByMachineId,
        jobLabelById: new Map(initialData.jobs.map((job) => [job.id, job.quality_label])),
        today: todayProduction,
        yesterday: yesterdayProduction,
    }), [initialData.machines, initialData.jobs, runningJobIdByMachineId, todayProduction, yesterdayProduction])
    const retiredQualityMeters = useMemo(
        () => metersOutsideBaseJobs(todayProduction, activeJobs.map((job) => job.id)),
        [todayProduction, activeJobs],
    )
    const assignedWorkerIds = useMemo(() => {
        const set = new Set<string>()
        for (const assignment of initialData.assignments) {
            if (assignment.active && assignment.effective_from <= initialData.today && (!assignment.effective_to || assignment.effective_to >= initialData.today)) {
                set.add(assignment.worker_id)
            }
        }
        return set
    }, [initialData.assignments, initialData.today])
    const settlingWorker = periodPayables.find((payable) => payable.worker_id === settlingWorkerId)
    const payrollReadiness = payroll?.readiness
    const readinessByWorker = useMemo(
        () => new Map(payrollReadiness?.workers.map((worker) => [worker.workerId, worker])),
        [payrollReadiness],
    )
    const visiblePayables = periodPayables.filter(payable => {
                                if (!payable.worker_name.toLocaleLowerCase().includes(payrollSearch.trim().toLocaleLowerCase())) return false
                                const readiness = readinessByWorker.get(payable.worker_id)
                                return payrollFilter === 'all' || (payrollFilter === 'ready' && readiness?.readyToSettle) || (payrollFilter === 'review' && Boolean(readiness?.issueCount)) || (payrollFilter === 'paid' && payable.status === 'paid') || (payrollFilter === 'empty' && payable.gross_pay === 0)
                            })
    const settlingReadiness = settlingWorkerId ? readinessByWorker.get(settlingWorkerId) : null

    useEffect(() => {
        if (tourSample) return // a tour sample is not a page view
        trackPlanEvent('production_viewed', { surface: 'base_production_core' })
    }, [tourSample])

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

    function openAdvance(workerId = activeWorkers[0]?.id ?? '') {
        setAdvanceDraft(emptyAdvanceDraft(workerId))
        setDialog('advance')
    }

    function openDeduction(workerId = activeWorkers[0]?.id ?? '') {
        setDeductionDraft(emptyDeductionDraft(workerId))
        setDialog('deduction')
    }

    function openSetup(add?: 'worker' | 'machine', workerId?: string) {
        const params = new URLSearchParams({ returnTo: view === 'payroll' ? '/owner/payroll' : baseProductionTabForPath(pathname) === 'production' ? baseDailySheetHref(navigation) : baseProductionHref(navigation) })
        if (add) { params.set('add', add); params.set('section', add === 'machine' ? 'machines' : 'workers') }
        if (workerId) params.set('worker', workerId)
        if (add === 'machine') params.set('register', 'base')
        params.delete('section')
        router.push(`/owner/${add === 'machine' ? 'machines' : 'workers'}?${params}`)
    }

    function closeDialog() {
        setDialog(null)

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

    function handleDeductionSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const amount = Number.parseFloat(deductionDraft.amount)
        if (!deductionDraft.workerId || !Number.isFinite(amount) || amount <= 0) {
            toast.error('Choose a worker and enter a deduction greater than 0.')
            return
        }

        void runAction(
            'deduction-create',
            () => createBaseWorkerDeduction({
                workerId: deductionDraft.workerId,
                amount,
                reason: deductionDraft.reason,
                description: deductionDraft.description,
            }),
            'Deduction recorded.',
            closeDialog,
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
        <div className={`${isDailySheetView ? 'space-y-4' : 'space-y-5'} ${view === 'payroll' ? 'payroll-workspace-shell pb-10' : 'pb-8'} ${view === 'production' && !isDailySheetView ? 'production-overview-workspace' : ''} ${view === 'operations' ? 'configuration-page-frame' : ''}`}>
            <RouteMilestones route={view === 'payroll' ? '/owner/payroll' : view === 'operations' ? '/owner/assignments' : isDailySheetView ? '/owner/production/daily-sheet' : '/owner/production'} shellVisible primaryUsable />
            <TourSampleBanner />
            {navigation.returnTo && (
                <Button asChild variant="outline" size="sm" className="h-9 rounded-xl border-hairline bg-surface text-ink shadow-xs hover:border-hairline-strong hover:bg-surface-soft hover:text-ink">
                    <Link href={navigation.returnTo} className="inline-flex items-center gap-1.5">
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to previous workspace</span>
                    </Link>
                </Button>
            )}
            {(view === 'production' || view === 'payroll') && !isDailySheetView && <PageHeader
                title={view === 'payroll' ? 'Payroll' : 'Production'}
                description={view === 'payroll' ? <span className="sr-only">Review earnings and settle worker pay for each period.</span> : undefined}
                actions={<>
                    <PageGuide />
                    {view === 'production' && activeTab === 'jobs' && (
                        <Button data-tour-anchor="production.activate" onClick={() => setIsActivateModalOpen(true)} className={railPrimaryAction}>
                            <Plus className="size-4" aria-hidden="true" />
                            <span data-i18n-skip="true">{t('production.activateQuality')}</span>
                        </Button>
                    )}
                    {view === 'payroll' && activeTab === 'history' && (
                        <Button variant="outline" className="h-10 rounded-lg px-4" onClick={() => setPayrollTab('pay')}>
                            <WalletCards className="h-4 w-4" /> Current payroll
                        </Button>
                    )}
                    {view === 'payroll' && activeTab !== 'history' && (
                        <Button data-tour-anchor="payroll.records" variant="outline" className="h-10 rounded-lg px-4" onClick={() => { setRecordsPeriodStart(undefined); setPayrollTab('history') }}>
                            <History className="size-4" aria-hidden="true" /> <span data-i18n-skip="true">{t('payroll.payrollRecords')}</span>
                        </Button>
                    )}
                    {view === 'payroll' && activeTab !== 'history' && activePeriodSummary && (
                        <Button data-tour-anchor="payroll.settle" onClick={() => setWorkspaceOpen(true)} className={railPrimaryAction}>
                            <WalletCards className="size-4" aria-hidden="true" />
                            <span data-i18n-skip="true">{activePeriodSummary.status === 'settled'
                                ? t('payroll.viewSettledPayroll')
                                : activePeriodSummary.status === 'ready_to_complete'
                                    ? t('payroll.completePayrollRail')
                                    : activePeriodSummary.status === 'in_progress'
                                        ? t('payroll.continueSettlement')
                                        : t('payroll.settlePayroll')}</span>
                        </Button>
                    )}
                </>}
            />}

            {view === 'payroll' && activeTab !== 'history' && activePeriodSummary && (
                <div data-payroll-tour="period" role="group" aria-label="Payroll period and settlement" className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <div className="flex h-11 items-center rounded-lg border border-hairline bg-surface-soft/35 p-0.5 sm:w-72" role="group" aria-label="Payroll period selector">
                            <Button variant="ghost" size="icon-xs" onClick={handlePreviousPeriod} className="h-10 w-9 shrink-0 rounded-lg text-subtle hover:text-ink" aria-label="Previous payroll period">
                                <ChevronLeft className="size-[1.125rem]" />
                            </Button>
                            <span className="min-w-0 flex-1 truncate px-1 text-center text-sm font-semibold text-ink">{activePeriodLabel}</span>
                            <Button variant="ghost" size="icon-xs" onClick={handleNextPeriod} className="h-10 w-9 shrink-0 rounded-lg text-subtle hover:text-ink" aria-label="Next payroll period">
                                <ChevronRight className="size-[1.125rem]" />
                            </Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-subtle">{formatDateOnly(activePeriodBounds.start)} – {formatDateOnly(activePeriodBounds.end)}</span>
                            {activePeriodSummary.status === 'settled' ? (
                                <Badge variant="success" className="text-xs font-semibold">Settled</Badge>
                            ) : activePeriodSummary.status === 'ready_to_complete' ? (
                                <Badge variant="brand" className="text-xs font-semibold">Ready to complete</Badge>
                            ) : activePeriodSummary.status === 'in_progress' ? (
                                <Badge variant="warning" className="text-xs font-semibold">In progress · {activePeriodSummary.paidWorkers}/{activePeriodSummary.totalWorkers}</Badge>
                            ) : (
                                <Badge variant="secondary" className="text-xs font-semibold">Open</Badge>
                            )}
                        </div>
                    </div>
                    <Button data-payroll-bulk-pill type="button" variant="outline" className="min-h-[44px] rounded-lg px-4" onClick={() => setBulkOpen(true)}>
                        <Users className="size-4" aria-hidden="true" />
                        <span data-i18n-skip="true">{tx('Bulk advance / deduction')}</span>
                    </Button>
                </div>
            )}

            {view === 'payroll' && activeTab === 'history' && (
                <BasePayrollRecords initialData={initialData} initialPeriodStart={recordsPeriodStart} onBack={() => setPayrollTab('pay')} />
            )}

            {view === 'production' && !isDailySheetView && (
                <Card data-production-tour="overview" className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
                    <div className="grid grid-cols-2 divide-y sm:grid-cols-4 sm:divide-y-0 sm:divide-x divide-hairline">
                        <div className="p-4 sm:p-5">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                <Layers className="h-4 w-4 text-muted-foreground" />
                                <span>Active Qualities</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-black tracking-tight text-ink">{activeJobs.length}</p>
                            <p className="mt-1 text-xs text-muted-foreground">In active production</p>
                        </div>
                        <div className="p-4 sm:p-5">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                <Factory className="h-4 w-4 text-[var(--wv-moss-700)]" />
                                <span>Machines Running</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-black tracking-tight text-ink">
                                {runningMachinesCount} <span className="text-sm font-semibold text-muted-foreground">/ {activeMachines.length}</span>
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {activeMachines.length > 0 ? Math.round((runningMachinesCount / activeMachines.length) * 100) : 0}% capacity
                            </p>
                        </div>
                        <div className="p-4 sm:p-5">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span>Workers Assigned</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-black tracking-tight text-ink">{assignedWorkerIds.size}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Operating looms</p>
                        </div>
                        <div className="p-4 sm:p-5">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                <Wrench className="h-4 w-4 text-muted-foreground" />
                                <span>Looms Available</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-black tracking-tight text-ink">{availableMachinesCount}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Ready for quality</p>
                        </div>
                    </div>
                </Card>
            )}

            {view === 'payroll' && activeTab !== 'history' && activePeriodSummary && (
                <Card className="gap-0 overflow-hidden rounded-2xl border border-hairline bg-surface py-0 shadow-[var(--shadow-card)]">
                    <div className="grid grid-cols-1 divide-y divide-hairline sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
                        <div className="p-4">
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

                        <div className="p-4">
                            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-success">
                                <CheckCircle2 className="h-4 w-4 text-success" />
                                <span>Paid so far</span>
                            </div>
                            <p className="text-xl font-black tracking-tight text-success sm:text-2xl">
                                {formatINR(activePeriodSummary.totalPaid, { hideDecimals: true })}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {activePeriodSummary.paidWorkers} of {activePeriodSummary.totalWorkers} workers settled
                            </p>
                        </div>

                        <div className="p-4">
                            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                <Clock3 className="h-4 w-4 text-muted-foreground" />
                                <span>Remaining to settle</span>
                            </div>
                            <p className={`text-xl font-black tracking-tight sm:text-2xl ${activePeriodSummary.totalRemaining > 0 ? 'text-warning' : 'text-ink'}`}>
                                {formatINR(activePeriodSummary.totalRemaining, { hideDecimals: true })}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {activePeriodSummary.outstandingWorkers} workers outstanding
                            </p>
                        </div>
                    </div>

                    <div className="border-t border-hairline bg-surface-soft/25 px-4 py-2.5">
                        <div className="mb-1 flex items-center justify-between text-xs font-semibold text-body">
                            <span>Settlement Progress</span>
                            <span className="font-bold text-ink">{activePeriodSummary.progressPercent}% settled</span>
                        </div>
                        <div
                            className="h-1.5 w-full overflow-hidden rounded-full border border-hairline bg-surface-soft"
                            role="progressbar"
                            aria-valuenow={activePeriodSummary.progressPercent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                        >
                            <div
                                className={`ui-meter-fill h-full rounded-full ${
                                    activePeriodSummary.progressPercent === 100 ? 'bg-success' : 'bg-saffron'
                                }`}
                                style={{ width: `${activePeriodSummary.progressPercent}%` }}
                            />
                        </div>
                    </div>
                </Card>
            )}

            {view === 'operations' && <BaseAssignmentWorkspace key={`${initialData.orgId}:${navigation.worker ?? "all"}:${navigation.machine ?? "all"}:${navigation.shift ?? "day"}`} initialData={initialData} focusWorkerId={searchParams.get("worker") ?? undefined} focusMachineId={searchParams.get("machine") ?? undefined} initialShift={navigation.shift} tourMetadata={tourMetadata} />}

            {(view === 'production' || (view === 'payroll' && activeTab !== 'history')) && <div className="space-y-4">
                {view === 'production' && activeTab === 'jobs' && (
                    <BaseActiveQualities
                        jobs={initialData.jobs}
                        costings={initialData.costings}
                        machines={initialData.machines}
                        machineJobContexts={initialData.machineJobContexts}
                        today={initialData.today}
                        todayMetersByJobId={todayProduction.metersByJobId}
                        todayEntered={todayProduction.hasSavedSheet}
                        onViewHistory={() => router.push('/owner/production/daily-sheet')}
                        isActivateModalOpen={isActivateModalOpen}
                        onOpenActivateModalChange={setIsActivateModalOpen}
                    />
                )}

                {view === 'production' && activeTab === 'jobs' && (
                    <BaseProductionLoomChart
                        rows={loomOutputRows}
                        today={todayProduction}
                        comparison={yesterdayComparison}
                        otherQualityMeters={retiredQualityMeters}
                        dailySheetHref="/owner/production/daily-sheet"
                    />
                )}

                {view === 'production' && activeTab === 'production' && <div>
                    <BaseDailyProductionSheet initialData={initialData} navigation={navigation} onAddWorker={() => openSetup('worker')} onAddMachine={() => openSetup('machine')} onOpenHistory={() => setIsHistoryOpen(true)} />

                    <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                        <DialogContent className="flex max-h-[min(85svh,820px)] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl border-hairline bg-surface p-0 sm:max-w-3xl">
                            <DialogHeader className="shrink-0 border-b border-hairline px-5 py-5 pr-14 sm:px-6">
                                <DialogTitle className="text-xl font-bold tracking-tight text-ink">Recent production</DialogTitle>
                                <DialogDescription>Find a saved shift by date, worker, machine, or job.</DialogDescription>
                            </DialogHeader>
                            <div className="shrink-0 border-b border-hairline bg-surface-soft/40 px-5 py-4 sm:px-6">
                                <Label htmlFor="base-production-search" className="text-xs font-bold text-body">Search production</Label>
                                <Input id="base-production-search" className="mt-1.5 h-10 rounded-xl border border-hairline bg-surface text-ink shadow-xs" value={productionSearch} onChange={event => { setProductionSearch(event.target.value); setHistoryCount(12) }} placeholder="Date, worker, machine, or job" />
                            </div>
                            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
                                {visibleProduction.length === 0 ? (
                                    <EmptyState compact title="No production recorded" description="Your saved worker totals will appear here." />
                                ) : (
                                    <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface">
                                        {visibleProduction.slice(0, historyCount).map((entry) => {
                                            const isLegacyWorkerTotal = entry.meters > 0 && entry.allocation_mode !== 'machine_breakdown' && !entry.machine_id
                                            return (
                                                <div key={entry.id} className="flex flex-col gap-2 p-3 text-sm transition-colors hover:bg-surface-soft/40 sm:flex-row sm:items-center sm:justify-between sm:p-3.5">
                                                    <div className="min-w-0">
                                                        <p className="truncate font-bold text-ink">{workerById.get(entry.worker_id)?.name ?? 'Worker'} · {entry.job_label ?? jobById.get(entry.job_id)?.quality_label ?? (isLegacyWorkerTotal ? 'Legacy worker total' : 'Production')}</p>
                                                        <p className="mt-0.5 text-xs text-muted-foreground">{formatDateOnly(entry.production_date)}{entry.shift ? ` · ${entry.shift} shift` : ''}{entry.machine_label ? ` · ${entry.machine_label}` : ''}{isLegacyWorkerTotal ? ' · payroll included at saved rate' : ''}</p>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-3">
                                                        <div className="font-black text-ink">{entry.entry_status === 'zero' ? '0 m' : entry.entry_status === 'absent' ? 'Absent' : `${formatMeters(entry.meters)} · ${formatINR(calculateBaseEntryGrossPay(entry, productionHistoryIndex.allocations.get(entry.id) ?? []))}`}</div>
                                                        <Button asChild variant="outline" size="sm" className="h-8 rounded-lg border-hairline bg-surface text-xs font-medium hover:bg-surface-soft"><Link onClick={() => setIsHistoryOpen(false)} href={baseDailySheetHref({ date: entry.production_date, shift: entry.shift, entry: entry.id, worker: entry.worker_id })}>View log</Link></Button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                                {visibleProduction.length > historyCount && (
                                    <Button variant="outline" className="h-10 w-full rounded-xl border-hairline bg-surface text-xs font-bold shadow-xs hover:bg-surface-soft" onClick={() => setHistoryCount(count => count + 24)}>
                                        Show more production ({visibleProduction.length - historyCount} remaining)
                                    </Button>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>}

                {view === 'payroll' && <div className="space-y-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div className="min-w-0">
                            <h2 className="text-lg font-semibold text-ink">Worker pay</h2>
                            <p className="mt-0.5 max-w-[21rem] text-xs leading-relaxed text-body">Outstanding earnings through {formatDateOnly(payrollCutoff)}. Earlier unpaid work is included.</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <Select value={paymentMode} onValueChange={(value) => setPaymentMode(value as BasePayrollPaymentMode)}>
                                <SelectTrigger className="h-10 w-[150px] rounded-xl border-hairline bg-surface shadow-xs" aria-label="Payment mode"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="cash">Paid by cash</SelectItem><SelectItem value="bank_transfer">Bank transfer</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="cheque">Cheque</SelectItem></SelectContent>
                            </Select>
                            <BaseWorkerIncentives key={searchParams.get('incentive') ?? 'all'} focusIncentiveId={searchParams.get('incentive')} workers={initialData.workers} incentives={initialData.incentives ?? []} today={initialData.today} periodStart={activePeriodBounds.start} />
                            <Button variant="outline" onClick={() => openSetup()} className="h-10 rounded-xl border-hairline bg-surface shadow-xs"><Settings2 className="h-4 w-4" /> Manage workers</Button>
                        </div>
                    </div>

                    {payrollReadiness && <BasePayrollReadinessPanel readiness={payrollReadiness} />}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div><Label htmlFor="base-payroll-search" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Find worker</Label><Input id="base-payroll-search" className="mt-1 h-10 sm:h-11 rounded-xl border-hairline bg-surface text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom" value={payrollSearch} onChange={event => setPayrollSearch(event.target.value)} placeholder="Worker name" /></div>
                        <div><Label htmlFor="base-payroll-filter" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment status</Label><Select value={payrollFilter} onValueChange={setPayrollFilter}><SelectTrigger id="base-payroll-filter" className="mt-1 h-10 sm:h-11 rounded-xl border-hairline bg-surface text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl border-hairline bg-surface shadow-lg"><SelectItem value="all">All workers</SelectItem><SelectItem value="ready">Ready to pay</SelectItem><SelectItem value="review">Needs review</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="empty">No earnings</SelectItem></SelectContent></Select></div>
                    </div>

                    {initialData.workers.length === 0 ? (
                        <EmptyState title="No workers yet" description="Add workers in Workers before recording metres or settling payroll." action={<Button size="sm" variant="saffron" onClick={() => openSetup()} className="rounded-xl font-bold"><Settings2 className="h-4 w-4" /> Manage workers</Button>} />
                    ) : visiblePayables.length === 0 ? (
                        <EmptyState title="No matching workers" description="Try another name or payment status." action={<Button variant="outline" onClick={() => { setPayrollSearch(''); setPayrollFilter('all') }} className="rounded-xl border-hairline hover:bg-surface-soft font-semibold">Clear filters</Button>} />
                    ) : (
                        <div data-payroll-tour="earnings" className="grid gap-4 lg:grid-cols-2">
                            {visiblePayables.map((payable, index) => {
                                const worker = workerById.get(payable.worker_id)
                                const workerReadiness = readinessByWorker.get(payable.worker_id)
                                const settlePending = pendingAction === `settle-${payable.worker_id}`
                                const workerPendingItems = (initialData.advances || []).filter(
                                    (item) => item.worker_id === payable.worker_id && item.status === 'pending'
                                )
                                const pendingDeductions = workerPendingItems.filter(
                                    (item) => item.description?.startsWith('[Deduction') || item.description?.toLowerCase().startsWith('deduction:')
                                )
                                const pendingAdvances = workerPendingItems.filter(
                                    (item) => !pendingDeductions.includes(item)
                                )
                                return (
                                    <Card key={payable.worker_id} className={`gap-0 overflow-hidden rounded-2xl border border-hairline bg-surface py-0 shadow-[var(--shadow-card)] transition-all ${!worker?.is_active ? 'opacity-75' : 'hover:border-hairline-strong hover:shadow-[var(--shadow-panel)]'}`}>
                                        <CardHeader className="border-b border-hairline bg-surface-soft/30 p-4">
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
                                        <CardContent className="space-y-3.5 p-4">
                                            <p className="text-xs font-semibold text-muted-foreground">{formatDateOnly(payable.period_start)} – {formatDateOnly(payable.period_end)}</p>
                                            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                                                <Metric label={payable.pay_type === 'fixed_monthly' ? 'Pay basis' : 'Metres'} value={payable.pay_type === 'fixed_monthly' ? 'Monthly salary' : formatMeters(payable.meters)} />
                                                <Metric label="Gross" value={formatINR(payable.gross_pay, { hideDecimals: true })} />
                                                <Metric label="Recovery" value={formatINR(payable.advance_recovery, { hideDecimals: true })} />
                                                <Metric label="Net pay" value={formatINR(payable.net_payout, { hideDecimals: true })} emphasis />
                                            </div>
                                            <div data-payroll-tour={index === 0 ? 'recovery' : undefined} className="rounded-xl border border-hairline/70 bg-surface-soft/55 p-3 text-xs leading-relaxed text-body">
                                                {payable.pay_type === 'fixed_monthly' && payable.status !== 'paid' && <div className="mb-2 space-y-1">{payable.salary_lines?.map(line => <p key={line.start}>{formatDateOnly(line.start)} – {formatDateOnly(line.end)}: {formatINR(line.monthlySalary)} × {line.days}/{line.monthDays} days = {formatINR(line.grossPay)}</p>)}</div>}
                                                {(payable.incentive_pay ?? 0) > 0 && <p className="mb-2">{tx('Approved incentive earnings')}: {formatINR(payable.incentive_pay ?? 0)}</p>}
                                                {payable.incentive_review_ids?.length ? <p className="mb-2">{tx('Review incentives and include their complete service periods before payment.')}</p> : null}
                                                {payable.status === 'paid'
                                                    ? <>Paid on {formatDateOnly(payable.paid_at)} · {formatINR(payable.advance_recovery, { hideDecimals: true })} advance recovered.</>
                                                    : payable.pending_advance > 0
                                                        ? pendingDeductions.length > 0 && pendingAdvances.length === 0
                                                            ? <>{formatINR(payable.advance_recovery, { hideDecimals: true })} deduction will be recovered this period from {formatINR(payable.pending_advance, { hideDecimals: true })} pending.{payable.remaining_debt > 0 ? ` ${formatINR(payable.remaining_debt, { hideDecimals: true })} carries forward.` : ''}</>
                                                            : pendingDeductions.length > 0 && pendingAdvances.length > 0
                                                                ? <>{formatINR(payable.advance_recovery, { hideDecimals: true })} advance/deduction will be recovered this period from {formatINR(payable.pending_advance, { hideDecimals: true })} pending.{payable.remaining_debt > 0 ? ` ${formatINR(payable.remaining_debt, { hideDecimals: true })} carries forward.` : ''}</>
                                                                : <>{formatINR(payable.advance_recovery, { hideDecimals: true })} advance will be recovered this period from {formatINR(payable.pending_advance, { hideDecimals: true })} pending.{payable.remaining_debt > 0 ? ` ${formatINR(payable.remaining_debt, { hideDecimals: true })} carries forward.` : ''}</>
                                                        : <>No advance to recover. Full gross pay is due this period.</>}
                                                {pendingDeductions.length > 0 && payable.status !== 'paid' && (
                                                    <div className="mt-2 flex flex-wrap gap-1.5 pt-1.5 border-t border-hairline/60">
                                                        {pendingDeductions.map((deduction) => {
                                                            const match = deduction.description?.match(/\[Deduction:\s*([^\]]+)\]\s*(.*)/)
                                                            const label = match ? `${match[1]}${match[2] ? ` · ${match[2]}` : ''}` : deduction.description?.replace(/^\[Deduction\]\s*/, '') || 'Deduction'
                                                            return (
                                                                <Badge
                                                                    variant="warning"
                                                                    key={deduction.id}
                                                                    className="gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium"
                                                                    title={deduction.description || undefined}
                                                                >
                                                                    <span>-{formatINR(deduction.amount - deduction.recovered_amount, { hideDecimals: true })}</span>
                                                                    <span className="truncate max-w-[160px]">({label})</span>
                                                                </Badge>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                            {workerReadiness && workerReadiness.verifiedLineCount > 0 && (
                                                <p className="flex items-center gap-1.5 text-xs font-medium text-success"><CheckCircle2 className="h-3.5 w-3.5" /> {workerReadiness.verifiedLineCount} earning {workerReadiness.verifiedLineCount === 1 ? 'line' : 'lines'} reconciled{workerReadiness.legacyLineCount > 0 ? ` · ${workerReadiness.legacyLineCount} legacy` : ''}</p>
                                            )}
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                <Button size="sm" variant="secondary" onClick={() => openAdvance(payable.worker_id)} disabled={!worker?.is_active} className="h-9 rounded-xl text-xs font-bold"><Plus className="h-4 w-4" /> <span data-i18n-skip="true">{t('payroll.addAdvance')}</span></Button>
                                                <Button size="sm" variant="secondary" onClick={() => openDeduction(payable.worker_id)} disabled={!worker?.is_active} className="h-9 rounded-xl text-xs font-bold"><Minus className="h-4 w-4" /> <span data-i18n-skip="true">{t('payroll.addDeduction')}</span></Button>
                                                {payable.status === 'unsettled' && payable.gross_pay > 0 && <Button size="sm" variant="saffron" onClick={() => { setSettlementRequestId(crypto.randomUUID()); setSettlingWorkerId(payable.worker_id) }} disabled={settlePending || Boolean(workerReadiness?.issueCount)} className="h-9 rounded-xl text-xs font-bold">{settlePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <WalletCards className="h-4 w-4" />} <span data-i18n-skip="true">{workerReadiness?.issueCount ? t('payroll.reviewBeforePaying') : t('payroll.markPaidCard')}</span></Button>}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                    <p className="sr-only">Piece-rate pay uses saved machine rates. Fixed salaries accrue by calendar day, including joining/leaving dates and effective-dated salary changes. Recovery is capped at the lower of the outstanding advance balance or 50% of gross pay; any remaining balance carries forward.</p>
                </div>}
            </div>}


            <Dialog open={dialog === 'advance'} onOpenChange={(open) => !open && closeDialog()} {...surface.root}>
                <DialogContent className="max-w-md rounded-2xl border border-hairline bg-surface p-6 shadow-2xl" {...surface.content}>
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-ink">Record worker advance</DialogTitle>
                        <DialogDescription className="text-sm text-body">The advance stays pending until a later Base payroll settlement recovers it.</DialogDescription>
                    </DialogHeader>
                    <form data-payroll-tour="advance" className="space-y-4" onSubmit={handleAdvanceSubmit}>
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

            <Dialog open={dialog === 'deduction'} onOpenChange={(open) => !open && closeDialog()} {...surface.root}>
                <DialogContent className="max-w-md rounded-2xl border border-hairline bg-surface p-6 shadow-2xl" {...surface.content}>
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-ink">Record worker deduction</DialogTitle>
                        <DialogDescription className="text-sm text-body">Record a deduction for mistakes, damages, water/facility access, or other charges. It will be deducted during payroll settlement.</DialogDescription>
                    </DialogHeader>
                    <form data-payroll-tour="deduction" className="space-y-4" onSubmit={handleDeductionSubmit}>
                        <div className="space-y-2">
                            <Label htmlFor="base-deduction-worker" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Worker</Label>
                            <Select value={deductionDraft.workerId} onValueChange={(value) => setDeductionDraft((current) => ({ ...current, workerId: value }))}>
                                <SelectTrigger id="base-deduction-worker" className="h-10 sm:h-11 w-full rounded-xl border-hairline bg-surface text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom"><SelectValue placeholder="Select a worker" /></SelectTrigger>
                                <SelectContent className="rounded-xl border-hairline bg-surface shadow-lg">{activeWorkers.map((worker) => <SelectItem key={worker.id} value={worker.id}>{worker.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="base-deduction-reason" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reason / Category</Label>
                            <Select value={deductionDraft.reason} onValueChange={(value) => setDeductionDraft((current) => ({ ...current, reason: value as DeductionReason }))}>
                                <SelectTrigger id="base-deduction-reason" className="h-10 sm:h-11 w-full rounded-xl border-hairline bg-surface text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom"><SelectValue placeholder="Select a reason" /></SelectTrigger>
                                <SelectContent className="rounded-xl border-hairline bg-surface shadow-lg">
                                    {DEDUCTION_REASONS.map((reason) => (
                                        <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="base-deduction-amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount</Label>
                            <Input id="base-deduction-amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={deductionDraft.amount} onChange={(event) => setDeductionDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" className="h-10 sm:h-11 rounded-xl border-hairline bg-surface text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="base-deduction-description" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
                            <Textarea id="base-deduction-description" rows={2} value={deductionDraft.description} onChange={(event) => setDeductionDraft((current) => ({ ...current, description: event.target.value }))} placeholder="e.g. Cut piece on Loom 4, Water bill for September" className="rounded-xl border-hairline bg-surface text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom" />
                        </div>
                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl border-hairline hover:bg-surface-soft font-semibold">Cancel</Button>
                            <Button type="submit" disabled={pendingAction === 'deduction-create'} className="rounded-xl bg-loom text-white font-bold shadow-xs hover:bg-loom-elevated">
                                {pendingAction === 'deduction-create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Minus className="h-4 w-4" />} Record deduction
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {view === 'payroll' && (
                <BulkAdjustmentDialog
                    open={bulkOpen}
                    onOpenChange={setBulkOpen}
                    workers={initialData.workers}
                    onSaved={() => router.refresh()}
                />
            )}

            <ConfirmActionDialog
                open={Boolean(settlingWorkerId)}
                onOpenChange={(open) => !open && setSettlingWorkerId(null)}
                title={`Mark ${settlingWorker?.worker_name ?? 'worker'} as paid?`}
                description={settlingWorker ? `Record ${formatINR(settlingWorker.net_payout)} paid for ${formatDateOnly(settlingWorker.period_start)} – ${formatDateOnly(settlingWorker.period_end)}. Gross ${formatINR(settlingWorker.gross_pay)}, advance recovery ${formatINR(settlingWorker.advance_recovery)}. This records a payment; it does not send money. This worker’s production and rates will be protected. Unpaid workers on the same shift can still be corrected.` : 'The current worker payroll will be settled.'}
                confirmLabel="Mark as paid"
                onConfirm={handleSettle}
                isLoading={pendingAction === `settle-${settlingWorkerId}`}
            />

            {view === 'payroll' && workspaceHasOpened && <SettlementLoadingContext.Provider value={{ open: workspaceOpen, onOpenChange: setWorkspaceOpen }}>
                <BasePayrollSettlementWorkspace
                    open={workspaceOpen}
                    onOpenChange={setWorkspaceOpen}
                    period={{
                        start: activePeriodBounds.start,
                        end: activePeriodBounds.end,
                        label: activePeriodLabel,
                    }}
                    payables={periodPayables}
                    periodRecord={activePeriodRecord}
                    today={initialData.today}
                    workers={initialData.workers}
                    readinessByWorker={readinessByWorker}
                    defaultPaymentMode={paymentMode}
                    onSuccess={() => {
                        router.refresh()
                    }}
                    onViewRecords={() => {
                        setRecordsPeriodStart(activePeriod.start)
                        setPayrollTab('history')
                    }}
                />
            </SettlementLoadingContext.Provider>}
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
