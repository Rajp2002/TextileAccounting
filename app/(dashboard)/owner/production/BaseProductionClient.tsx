'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    CheckCircle2,
    ClipboardList,
    Clock3,
    Edit3,
    HardHat,
    History,
    IndianRupee,
    Loader2,
    Plus,
    ReceiptText,
    RotateCcw,
    Settings2,
    Users,
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
import { trackPlanEvent } from '@/lib/plan-analytics'
import {
    calculateBaseJobSummary,
    calculateBaseEntryGrossPay,
    type BasePayrollPaymentMode,
    type BaseProductionMachine,
    type BaseProductionJobStatus,
    type BaseProductionWorker,
    type BaseWorkerShiftAvailability,
} from '@/lib/base-production-core'

import {
    createBaseProductionJob,
    createBaseProductionMachine,
    createBaseProductionWorker,
    createBaseWorkerAdvance,
    settleBaseWorkerPayroll,
    updateBaseProductionJobStatus,
    updateBaseProductionMachine,
    updateBaseProductionWorker,
} from './actions'
import BaseAssignmentWorkspace from './BaseAssignmentWorkspace'
import BaseDailyProductionSheet from './BaseDailyProductionSheet'
import BasePayrollRecords from './BasePayrollRecords'
import type { BaseProductionInitialData } from './loaders'

type DialogName = 'worker' | 'machine' | 'job' | 'advance' | null

type WorkerDraft = {
    name: string
    shiftAvailability: BaseWorkerShiftAvailability
    isActive: boolean
}

type MachineDraft = {
    name: string
    machineType: 'jacquard' | 'power_loom' | 'rapier' | 'water_jet' | 'air_jet' | 'circular' | 'other'
    customLabel: string
    isActive: boolean
}

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

function emptyWorkerDraft(): WorkerDraft {
    return { name: '', shiftAvailability: 'both', isActive: true }
}

function emptyMachineDraft(): MachineDraft {
    return { name: '', machineType: 'other', customLabel: '', isActive: true }
}

function emptyJobDraft(today: string, costingId = ''): JobDraft {
    return {
        costingId,
        targetMeters: '',
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
}: {
    initialData: BaseProductionInitialData
    initialCostingId?: string | null
    view?: 'production' | 'operations' | 'payroll'
}) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState(view === 'operations' ? 'assignments' : view === 'payroll' ? 'pay' : 'production')
    const [dialog, setDialog] = useState<DialogName>(null)
    const [pendingAction, setPendingAction] = useState<string | null>(null)
    const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null)
    const [editingMachineId, setEditingMachineId] = useState<string | null>(null)
    const [settlingWorkerId, setSettlingWorkerId] = useState<string | null>(null)
    const [paymentMode, setPaymentMode] = useState<BasePayrollPaymentMode>('cash')
    const [workerDraft, setWorkerDraft] = useState<WorkerDraft>(emptyWorkerDraft)
    const [machineDraft, setMachineDraft] = useState<MachineDraft>(emptyMachineDraft)
    const [jobDraft, setJobDraft] = useState<JobDraft>(() => emptyJobDraft(initialData.today, initialCostingId ?? ''))
    const [advanceDraft, setAdvanceDraft] = useState<AdvanceDraft>(emptyAdvanceDraft)

    const workerById = useMemo(
        () => new Map(initialData.workers.map((worker) => [worker.id, worker])),
        [initialData.workers],
    )
    const jobById = useMemo(
        () => new Map(initialData.jobs.map((job) => [job.id, job])),
        [initialData.jobs],
    )
    const jobSummaries = useMemo(
        () => new Map(initialData.jobs.map((job) => [job.id, calculateBaseJobSummary(job, initialData.entries, initialData.allocations)])),
        [initialData.allocations, initialData.entries, initialData.jobs],
    )
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
    const activeMachines = initialData.machines.filter((machine) => machine.is_active)
    const activeAssignments = initialData.assignments.filter((assignment) => assignment.active)

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

    function openNewWorker() {
        setEditingWorkerId(null)
        setWorkerDraft(emptyWorkerDraft())
        setDialog('worker')
    }

    function openNewMachine() {
        setEditingMachineId(null)
        setMachineDraft(emptyMachineDraft())
        setDialog('machine')
    }

    function openEditMachine(machine: BaseProductionMachine) {
        setEditingMachineId(machine.id)
        setMachineDraft({
            name: machine.name,
            machineType: machine.machine_type as MachineDraft['machineType'],
            customLabel: machine.custom_label ?? '',
            isActive: machine.is_active,
        })
        setDialog('machine')
    }

    function openEditWorker(worker: BaseProductionWorker) {
        setEditingWorkerId(worker.id)
        setWorkerDraft({
            name: worker.name,
            shiftAvailability: worker.shift_availability,
            isActive: worker.is_active,
        })
        setDialog('worker')
    }

    function openNewJob() {
        setJobDraft(emptyJobDraft(initialData.today, initialCostingId ?? ''))
        setDialog('job')
    }

    function openAdvance(workerId = activeWorkers[0]?.id ?? '') {
        setAdvanceDraft(emptyAdvanceDraft(workerId))
        setDialog('advance')
    }

    function openOperations() {
        router.push('/owner/operations')
    }

    function openRecord() {
        if (activeWorkers.length === 0) {
            toast.info('Add and assign a worker in Setup before recording production.')
            openOperations()
            return
        }

        setActiveTab('production')
    }

    function closeDialog() {
        setDialog(null)
    }

    function handleWorkerSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!workerDraft.name.trim()) {
            toast.error('Enter a worker name.')
            return
        }

        if (editingWorkerId) {
            void runAction(
                'worker-update',
                () => updateBaseProductionWorker({
                    workerId: editingWorkerId,
                    name: workerDraft.name,
                    shiftAvailability: workerDraft.shiftAvailability,
                    isActive: workerDraft.isActive,
                }),
                'Worker updated.',
                closeDialog,
            )
            return
        }

        void runAction(
            'worker-create',
            () => createBaseProductionWorker({ name: workerDraft.name, shiftAvailability: workerDraft.shiftAvailability }),
            'Worker added.',
            closeDialog,
        )
    }

    function handleMachineSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (editingMachineId) {
            void runAction(
                'machine-update',
                () => updateBaseProductionMachine({
                    machineId: editingMachineId,
                    name: machineDraft.name,
                    machineType: machineDraft.machineType,
                    customLabel: machineDraft.customLabel,
                    isActive: machineDraft.isActive,
                }),
                'Machine updated.',
                closeDialog,
            )
            return
        }

        void runAction(
            'machine-create',
            () => createBaseProductionMachine({
                name: machineDraft.name,
                machineType: machineDraft.machineType,
                customLabel: machineDraft.customLabel,
            }),
            'Machine added.',
            closeDialog,
        )
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
                if (initialData.machines.length === 0) openOperations()
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
        if (!settlingWorkerId) return
        void runAction(
            `settle-${settlingWorkerId}`,
            () => settleBaseWorkerPayroll({ workerId: settlingWorkerId, paymentMode }),
            'Worker payroll marked as paid.',
            () => setSettlingWorkerId(null),
        )
    }

    return (
        <div className="space-y-5 pb-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-saffron-deep">Weavly Base</p>
                    <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
                        {view === 'operations' ? 'Setup' : view === 'payroll' ? 'Payroll' : 'Production'}
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-body">
                        {view === 'operations'
                            ? 'Set up machines, workers, and their current shift assignments.'
                            : view === 'payroll'
                                ? 'Review piece-rate earnings, worker advances, and settle the current pay period.'
                                : 'Create production jobs from saved costings and record daily machine metres.'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {view === 'operations' && (
                        <>
                            <Button onClick={openNewMachine}><Plus className="h-4 w-4" /> Add machine</Button>
                            <Button variant="outline" onClick={openNewWorker}><Plus className="h-4 w-4" /> Add worker</Button>
                        </>
                    )}
                    {view === 'payroll' && (
                        <Button
                            variant={activeTab === 'history' ? 'default' : 'outline'}
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

            {!(view === 'payroll' && activeTab === 'history') && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {view === 'production' && <>
                    <SummaryCard label="Open jobs" value={String(openJobs)} detail="Planned or active" icon={<ClipboardList className="h-4 w-4" />} />
                    <SummaryCard label="Produced this period" value={formatMeters(producedThisPeriod)} detail={`${formatDateOnly(initialData.payrollPeriod.start)} – ${formatDateOnly(initialData.payrollPeriod.end)}`} icon={<CheckCircle2 className="h-4 w-4" />} />
                </>}
                {view === 'operations' && <>
                    <SummaryCard label="Active machines" value={String(activeMachines.length)} detail={`${initialData.machines.length} total machines`} icon={<Settings2 className="h-4 w-4" />} />
                    <SummaryCard label="Active workers" value={String(activeWorkers.length)} detail={`${initialData.workers.length} total workers`} icon={<Users className="h-4 w-4" />} />
                    <SummaryCard label="Current assignments" value={String(activeAssignments.length)} detail="Across day and night shifts" icon={<HardHat className="h-4 w-4" />} />
                </>}
                {view === 'payroll' && <>
                    <SummaryCard label="Worker payout" value={formatINR(unsettledPayable, { hideDecimals: true })} detail="Unsettled net pay" icon={<WalletCards className="h-4 w-4" />} />
                    <SummaryCard label="Outstanding advances" value={formatINR(pendingAdvances, { hideDecimals: true })} detail="Before this period’s recovery" icon={<IndianRupee className="h-4 w-4" />} />
                </>}
            </div>}

            {!(view === 'payroll' && activeTab === 'history') && <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                {view === 'production' && <TabsList className="grid h-auto w-full grid-cols-2">
                    <TabsTrigger value="jobs">Jobs</TabsTrigger>
                    <TabsTrigger value="production">Daily production</TabsTrigger>
                </TabsList>}

                {view === 'production' && <TabsContent value="jobs" className="space-y-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div>
                            <h2 className="text-lg font-bold text-ink">Production jobs</h2>
                            <p className="text-sm text-body">Each job keeps the costing economics and a simple metre target.</p>
                        </div>
                        <Button size="sm" onClick={openNewJob} disabled={initialData.costings.length === 0}>
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

                    <div className="grid gap-4 lg:grid-cols-2">
                        {initialData.jobs.map((job) => {
                            const summary = jobSummaries.get(job.id) ?? calculateBaseJobSummary(job, initialData.entries, initialData.allocations)
                            const nextStatus = getNextStatus(job.status)
                            const isJobPending = pendingAction === `job-status-${job.id}`

                            return (
                                <Card key={job.id}>
                                    <CardHeader className="border-b border-hairline/70">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <CardTitle className="truncate text-base">{job.quality_label}</CardTitle>
                                                <CardDescription className="mt-1">
                                                    {job.customer_reference || 'Internal production job'} · Start date {formatDateOnly(job.start_date)}
                                                </CardDescription>
                                            </div>
                                            <Badge variant={getStatusVariant(job.status)}>{job.status}</Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4 pt-0">
                                        <div>
                                            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-body">
                                                <span>{formatMeters(summary.produced_meters)} produced</span>
                                                <span>{formatMeters(job.target_meters)} target</span>
                                            </div>
                                            <div
                                                className="h-2 overflow-hidden rounded-full bg-surface-soft"
                                                role="progressbar"
                                                aria-label={`${summary.progress_percent}% complete`}
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                                aria-valuenow={summary.progress_percent}
                                            >
                                                <div className="h-full rounded-full bg-saffron transition-all" style={{ width: `${summary.progress_percent}%` }} />
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">{summary.progress_percent.toFixed(0)}% complete · {formatMeters(summary.remaining_meters)} remaining</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 rounded-lg bg-surface-soft/70 p-3 text-sm">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Planned cost</p>
                                                <p className="mt-1 font-bold text-ink">{formatINR(summary.planned_cost_total, { hideDecimals: true })}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Due date</p>
                                                <p className="mt-1 font-bold text-ink">{job.due_date ? formatDateOnly(job.due_date) : 'No due date'}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <Button size="sm" onClick={openRecord} disabled={job.status === 'completed' || job.status === 'cancelled'}>
                                                <ClipboardList className="h-4 w-4" /> Daily production
                                            </Button>
                                            {nextStatus && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleJobStatus(job.id, nextStatus)}
                                                    disabled={isJobPending}
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
                    <BaseDailyProductionSheet initialData={initialData} onAddWorker={openOperations} onAddMachine={openOperations} />

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base"><Clock3 className="h-4 w-4 text-saffron-deep" /> Recent production</CardTitle>
                            <CardDescription>Latest saved machine production. Worker totals and pay use the saved weaver rate for each machine allocation.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {initialData.entries.filter((entry) => entry.meters > 0 || entry.entry_status === 'zero' || entry.entry_status === 'absent').length === 0 ? (
                                <EmptyState compact title="No production recorded" description="Your saved worker totals will appear here." />
                            ) : (
                                <div className="divide-y divide-hairline rounded-lg border border-hairline">
                                    {initialData.entries.filter((entry) => entry.meters > 0 || entry.entry_status === 'zero' || entry.entry_status === 'absent').slice(0, 12).map((entry) => (
                                        <div key={entry.id} className="flex flex-col gap-1 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                                            <div className="min-w-0"><p className="truncate font-semibold text-ink">{workerById.get(entry.worker_id)?.name ?? 'Worker'} · {entry.job_label ?? jobById.get(entry.job_id)?.quality_label ?? 'Unallocated worker total'}</p><p className="text-xs text-muted-foreground">{formatDateOnly(entry.production_date)}{entry.shift ? ` · ${entry.shift} shift` : ''}{entry.machine_label ? ` · ${entry.machine_label}` : ''}</p></div>
                                            <div className="shrink-0 font-bold text-ink">{entry.entry_status === 'zero' ? '0 m' : entry.entry_status === 'absent' ? 'Absent' : `${formatMeters(entry.meters)} · ${formatINR(calculateBaseEntryGrossPay(entry, initialData.allocations.filter((allocation) => allocation.entry_id === entry.id)))}`}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>}

                {view === 'operations' && <TabsContent value="assignments" className="space-y-4">
                    <BaseAssignmentWorkspace initialData={initialData} onEditWorker={openEditWorker} onEditMachine={openEditMachine} />
                </TabsContent>}

                {view === 'payroll' && <TabsContent value="pay" className="space-y-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                        <div>
                            <h2 className="text-lg font-bold text-ink">Worker pay</h2>
                            <p className="text-sm text-body">Current period: {formatDateOnly(initialData.payrollPeriod.start)} – {formatDateOnly(initialData.payrollPeriod.end)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Select value={paymentMode} onValueChange={(value) => setPaymentMode(value as BasePayrollPaymentMode)}>
                                <SelectTrigger className="w-[170px]" aria-label="Payment mode"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="cash">Paid by cash</SelectItem><SelectItem value="bank_transfer">Bank transfer</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="cheque">Cheque</SelectItem></SelectContent>
                            </Select>
                            <Button variant="outline" onClick={openOperations}><Settings2 className="h-4 w-4" /> Manage workers</Button>
                        </div>
                    </div>

                    <Card className="border-hairline bg-surface-soft/45">
                        <CardContent className="flex items-start gap-3 py-4 text-sm">
                            <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-saffron-deep" />
                            <p className="leading-relaxed text-body">Pay uses each machine allocation’s saved weaver rate. Recovery is capped at the lower of the outstanding advance balance or 50% of gross pay; any remaining balance carries forward.</p>
                        </CardContent>
                    </Card>

                    {initialData.workers.length === 0 ? (
                        <EmptyState title="No workers yet" description="Add workers in Setup before recording metres or settling payroll." action={<Button size="sm" onClick={openOperations}><Settings2 className="h-4 w-4" /> Open Setup</Button>} />
                    ) : (
                        <div className="grid gap-4 lg:grid-cols-2">
                            {initialData.payables.map((payable) => {
                                const worker = workerById.get(payable.worker_id)
                                const settlePending = pendingAction === `settle-${payable.worker_id}`
                                return (
                                    <Card key={payable.worker_id} className={!worker?.is_active ? 'opacity-75' : undefined}>
                                        <CardHeader className="border-b border-hairline/70">
                                            <div className="flex items-start justify-between gap-3">
                                                <div><CardTitle className="text-base">{payable.worker_name}</CardTitle><CardDescription>{worker?.is_active ? `${worker.shift_availability === 'both' ? 'Day & night' : worker.shift_availability === 'day' ? 'Day' : 'Night'} shift · weaver rate applied per machine` : 'Inactive worker'}</CardDescription></div>
                                                <div className="flex items-center gap-2"><Badge variant={payable.status === 'paid' ? 'success' : 'warning'}>{payable.status === 'paid' ? 'Paid' : 'Open'}</Badge><Button variant="ghost" size="icon-xs" aria-label={`Manage ${payable.worker_name} in Setup`} onClick={openOperations}><Settings2 className="h-3.5 w-3.5" /></Button></div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4 pt-0">
                                            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                                                <Metric label="Metres" value={formatMeters(payable.meters)} />
                                                <Metric label="Gross" value={formatINR(payable.gross_pay, { hideDecimals: true })} />
                                                <Metric label="Recovery" value={formatINR(payable.advance_recovery, { hideDecimals: true })} />
                                                <Metric label="Net pay" value={formatINR(payable.net_payout, { hideDecimals: true })} emphasis />
                                            </div>
                                            <div className="rounded-lg bg-surface-soft/70 p-3 text-xs text-body">
                                                {payable.status === 'paid'
                                                    ? <>Paid on {formatDateOnly(payable.paid_at)} · {formatINR(payable.advance_recovery, { hideDecimals: true })} advance recovered.</>
                                                    : payable.pending_advance > 0
                                                        ? <>{formatINR(payable.advance_recovery, { hideDecimals: true })} advance will be recovered this period from {formatINR(payable.pending_advance, { hideDecimals: true })} pending.{payable.remaining_debt > 0 ? ` ${formatINR(payable.remaining_debt, { hideDecimals: true })} carries forward.` : ''}</>
                                                        : <>No advance to recover. Full gross pay is due this period.</>}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <Button size="sm" onClick={() => openAdvance(payable.worker_id)} disabled={!worker?.is_active}><Plus className="h-4 w-4" /> Add advance</Button>
                                                {payable.status === 'unsettled' && payable.gross_pay > 0 && <Button size="sm" variant="outline" onClick={() => setSettlingWorkerId(payable.worker_id)} disabled={settlePending}>{settlePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <WalletCards className="h-4 w-4" />} Mark paid</Button>}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </TabsContent>}
            </Tabs>}

            <Dialog open={dialog === 'machine'} onOpenChange={(open) => !open && closeDialog()}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingMachineId ? 'Edit machine' : 'Add machine'}</DialogTitle><DialogDescription>Add only the context needed for Weavly Base production. This machine record is independent of broader factory administration.</DialogDescription></DialogHeader>
                    <form className="space-y-4" onSubmit={handleMachineSubmit}>
                        <div className="space-y-2"><Label htmlFor="base-machine-name">Machine name {!editingMachineId && <span className="font-normal text-muted-foreground">(optional)</span>}</Label><Input id="base-machine-name" autoFocus value={machineDraft.name} onChange={(event) => setMachineDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Leave blank for Loom #1" required={Boolean(editingMachineId)} /></div>
                        <div className="space-y-2"><Label htmlFor="base-machine-type">Machine type</Label><Select value={machineDraft.machineType} onValueChange={(value) => setMachineDraft((current) => ({ ...current, machineType: value as MachineDraft['machineType'] }))}><SelectTrigger id="base-machine-type" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="jacquard">Jacquard</SelectItem><SelectItem value="power_loom">Power loom</SelectItem><SelectItem value="rapier">Rapier</SelectItem><SelectItem value="water_jet">Water jet</SelectItem><SelectItem value="air_jet">Air jet</SelectItem><SelectItem value="circular">Circular</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
                        <div className="space-y-2"><Label htmlFor="base-machine-label">Custom label <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="base-machine-label" value={machineDraft.customLabel} onChange={(event) => setMachineDraft((current) => ({ ...current, customLabel: event.target.value }))} placeholder="e.g. Rapier #1" /></div>
                        {editingMachineId && <label className="flex items-center gap-2 text-sm text-body"><input type="checkbox" checked={machineDraft.isActive} onChange={(event) => setMachineDraft((current) => ({ ...current, isActive: event.target.checked }))} /> Available for new assignments and daily context</label>}
                        <DialogFooter><Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button><Button type="submit" disabled={pendingAction === (editingMachineId ? 'machine-update' : 'machine-create')}>{pendingAction === (editingMachineId ? 'machine-update' : 'machine-create') ? <Loader2 className="h-4 w-4 animate-spin" /> : editingMachineId ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {editingMachineId ? 'Save changes' : 'Add machine'}</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={dialog === 'worker'} onOpenChange={(open) => !open && closeDialog()}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingWorkerId ? 'Edit worker' : 'Add worker'}</DialogTitle><DialogDescription>Pay rates come from the costing assigned to each machine. Choose when this worker is available.</DialogDescription></DialogHeader>
                    <form className="space-y-4" onSubmit={handleWorkerSubmit}>
                        <div className="space-y-2"><Label htmlFor="base-worker-name">Worker name</Label><Input id="base-worker-name" autoFocus value={workerDraft.name} onChange={(event) => setWorkerDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Ramesh" /></div>
                        <div className="space-y-2"><Label htmlFor="base-worker-shift">Shift availability</Label><Select value={workerDraft.shiftAvailability} onValueChange={(value) => setWorkerDraft((current) => ({ ...current, shiftAvailability: value as BaseWorkerShiftAvailability }))}><SelectTrigger id="base-worker-shift" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="day">Day shift</SelectItem><SelectItem value="night">Night shift</SelectItem><SelectItem value="both">Day & night</SelectItem></SelectContent></Select><p className="text-xs text-muted-foreground">You can edit this later. The assignment board only shows workers available for the selected shift.</p></div>
                        {editingWorkerId && <label className="flex items-center gap-2 text-sm text-body"><input type="checkbox" checked={workerDraft.isActive} onChange={(event) => setWorkerDraft((current) => ({ ...current, isActive: event.target.checked }))} /> Active worker</label>}
                        <DialogFooter><Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button><Button type="submit" disabled={pendingAction === 'worker-create' || pendingAction === 'worker-update'}>{pendingAction?.startsWith('worker-') ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{editingWorkerId ? 'Save changes' : 'Add worker'}</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={dialog === 'job'} onOpenChange={(open) => !open && closeDialog()}>
                <DialogContent>
                    <DialogHeader><DialogTitle>New production job</DialogTitle><DialogDescription>Start with an active saved costing. This creates a Base production job, not a formal party order.</DialogDescription></DialogHeader>
                    <form className="space-y-4" onSubmit={handleJobSubmit}>
                        <div className="space-y-2"><Label htmlFor="base-job-costing">Saved costing</Label><Select value={jobDraft.costingId} onValueChange={(value) => setJobDraft((current) => ({ ...current, costingId: value }))}><SelectTrigger id="base-job-costing" className="w-full"><SelectValue placeholder="Select a saved costing" /></SelectTrigger><SelectContent>{initialData.costings.map((costing) => <SelectItem key={costing.id} value={costing.id}>{costing.quality_label} · v{costing.version_number} · {formatINR(costing.production_cost_per_meter)}/m cost</SelectItem>)}</SelectContent></Select></div>
                        <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="base-job-target">Target metres</Label><Input id="base-job-target" type="number" min="0.01" step="0.01" inputMode="decimal" value={jobDraft.targetMeters} onChange={(event) => setJobDraft((current) => ({ ...current, targetMeters: event.target.value }))} placeholder="1000" /></div><div className="space-y-2"><Label htmlFor="base-job-start">Start date</Label><Input id="base-job-start" type="date" value={jobDraft.startDate} onChange={(event) => setJobDraft((current) => ({ ...current, startDate: event.target.value }))} /></div></div>
                        <div className="space-y-2"><Label htmlFor="base-job-due">Due date <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="base-job-due" type="date" min={jobDraft.startDate} value={jobDraft.dueDate} onChange={(event) => setJobDraft((current) => ({ ...current, dueDate: event.target.value }))} /></div>
                        <div className="space-y-2"><Label htmlFor="base-job-reference">Customer / internal reference <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="base-job-reference" value={jobDraft.customerReference} onChange={(event) => setJobDraft((current) => ({ ...current, customerReference: event.target.value }))} placeholder="e.g. Patel Traders · grey fabric" /></div>
                        <div className="space-y-2"><Label htmlFor="base-job-notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="base-job-notes" rows={2} value={jobDraft.notes} onChange={(event) => setJobDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Short job note" /></div>
                        <DialogFooter><Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button><Button type="submit" disabled={pendingAction === 'job-create'}>{pendingAction === 'job-create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create job</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={dialog === 'advance'} onOpenChange={(open) => !open && closeDialog()}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Record worker advance</DialogTitle><DialogDescription>The advance stays pending until a later Base payroll settlement recovers it.</DialogDescription></DialogHeader>
                    <form className="space-y-4" onSubmit={handleAdvanceSubmit}>
                        <div className="space-y-2"><Label htmlFor="base-advance-worker">Worker</Label><Select value={advanceDraft.workerId} onValueChange={(value) => setAdvanceDraft((current) => ({ ...current, workerId: value }))}><SelectTrigger id="base-advance-worker" className="w-full"><SelectValue placeholder="Select a worker" /></SelectTrigger><SelectContent>{activeWorkers.map((worker) => <SelectItem key={worker.id} value={worker.id}>{worker.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-2"><Label htmlFor="base-advance-amount">Amount</Label><Input id="base-advance-amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={advanceDraft.amount} onChange={(event) => setAdvanceDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" /></div>
                        <div className="space-y-2"><Label htmlFor="base-advance-description">Description <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="base-advance-description" rows={2} value={advanceDraft.description} onChange={(event) => setAdvanceDraft((current) => ({ ...current, description: event.target.value }))} placeholder="e.g. Personal advance" /></div>
                        <DialogFooter><Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button><Button type="submit" disabled={pendingAction === 'advance-create'}>{pendingAction === 'advance-create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Record advance</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmActionDialog
                open={Boolean(settlingWorkerId)}
                onOpenChange={(open) => !open && setSettlingWorkerId(null)}
                title={`Mark ${settlingWorker?.worker_name ?? 'worker'} as paid?`}
                description={settlingWorker ? `This records ${formatINR(settlingWorker.net_payout, { hideDecimals: true })} as paid for the current Base period. The action uses the production and advance records on the server.` : 'The current worker payroll will be settled.'}
                confirmLabel="Mark as paid"
                onConfirm={handleSettle}
                isLoading={pendingAction === `settle-${settlingWorkerId}`}
            />
        </div>
    )
}

function SummaryCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
    return (
        <Card className="gap-3 py-4">
            <CardContent className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span className="text-saffron-deep">{icon}</span>{label}</div>
                <p className="text-xl font-black tracking-tight text-ink">{value}</p>
                <p className="text-xs text-body">{detail}</p>
            </CardContent>
        </Card>
    )
}

function Metric({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
    return <div><p className="text-xs text-muted-foreground">{label}</p><p className={emphasis ? 'mt-1 font-black text-saffron-deep' : 'mt-1 font-bold text-ink'}>{value}</p></div>
}

function EmptyState({ title, description, action, compact = false }: { title: string; description: string; action?: React.ReactNode; compact?: boolean }) {
    return (
        <div className={`rounded-xl border border-dashed border-hairline bg-surface-soft/40 text-center ${compact ? 'p-5' : 'p-8'}`}>
            <p className="font-bold text-ink">{title}</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-body">{description}</p>
            {action && <div className="mt-4 flex justify-center">{action}</div>}
        </div>
    )
}
