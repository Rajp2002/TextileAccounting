'use client'

import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    ArrowRight,
    CheckCircle2,
    ClipboardList,
    Clock3,
    Edit3,
    HardHat,
    IndianRupee,
    Loader2,
    Plus,
    ReceiptText,
    RotateCcw,
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
import {
    calculateBaseJobSummary,
    type BasePayrollPaymentMode,
    type BaseProductionJobStatus,
    type BaseProductionWorker,
} from '@/lib/base-production-core'

import {
    createBaseProductionJob,
    createBaseProductionWorker,
    createBaseWorkerAdvance,
    recordBaseProduction,
    settleBaseWorkerPayroll,
    updateBaseProductionJobStatus,
    updateBaseProductionWorker,
} from './actions'
import type { BaseProductionInitialData } from './loaders'

type DialogName = 'worker' | 'job' | 'advance' | null

type WorkerDraft = {
    name: string
    ratePerMeter: string
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

type RecordDraft = {
    jobId: string
    workerId: string
    productionDate: string
    meters: string
    notes: string
}

type AdvanceDraft = {
    workerId: string
    amount: string
    description: string
}

function newClientRequestId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
        const random = Math.floor(Math.random() * 16)
        const value = character === 'x' ? random : (random & 0x3) | 0x8
        return value.toString(16)
    })
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
    return { name: '', ratePerMeter: '', isActive: true }
}

function emptyJobDraft(today: string): JobDraft {
    return {
        costingId: '',
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

export default function BaseProductionClient({ initialData }: { initialData: BaseProductionInitialData }) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState('jobs')
    const [dialog, setDialog] = useState<DialogName>(null)
    const [pendingAction, setPendingAction] = useState<string | null>(null)
    const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null)
    const [settlingWorkerId, setSettlingWorkerId] = useState<string | null>(null)
    const [paymentMode, setPaymentMode] = useState<BasePayrollPaymentMode>('cash')
    const [workerDraft, setWorkerDraft] = useState<WorkerDraft>(emptyWorkerDraft)
    const [jobDraft, setJobDraft] = useState<JobDraft>(() => emptyJobDraft(initialData.today))
    const [advanceDraft, setAdvanceDraft] = useState<AdvanceDraft>(emptyAdvanceDraft)
    const [recordDraft, setRecordDraft] = useState<RecordDraft>({
        jobId: initialData.jobs.find((job) => job.status === 'planned' || job.status === 'active')?.id ?? '',
        workerId: initialData.workers.find((worker) => worker.is_active)?.id ?? '',
        productionDate: initialData.today,
        meters: '',
        notes: '',
    })
    const [recordRequestId, setRecordRequestId] = useState(newClientRequestId)

    const workerById = useMemo(
        () => new Map(initialData.workers.map((worker) => [worker.id, worker])),
        [initialData.workers],
    )
    const jobById = useMemo(
        () => new Map(initialData.jobs.map((job) => [job.id, job])),
        [initialData.jobs],
    )
    const jobSummaries = useMemo(
        () => new Map(initialData.jobs.map((job) => [job.id, calculateBaseJobSummary(job, initialData.entries)])),
        [initialData.entries, initialData.jobs],
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

    function openEditWorker(worker: BaseProductionWorker) {
        setEditingWorkerId(worker.id)
        setWorkerDraft({
            name: worker.name,
            ratePerMeter: String(worker.rate_per_meter),
            isActive: worker.is_active,
        })
        setDialog('worker')
    }

    function openNewJob() {
        setJobDraft(emptyJobDraft(initialData.today))
        setDialog('job')
    }

    function openAdvance(workerId = activeWorkers[0]?.id ?? '') {
        setAdvanceDraft(emptyAdvanceDraft(workerId))
        setDialog('advance')
    }

    function openRecord(jobId?: string) {
        setRecordDraft((current) => ({
            ...current,
            jobId: jobId ?? current.jobId ?? activeJobs[0]?.id ?? '',
            workerId: current.workerId || activeWorkers[0]?.id || '',
            productionDate: current.productionDate || initialData.today,
        }))
        setActiveTab('production')
    }

    function closeDialog() {
        setDialog(null)
    }

    function handleWorkerSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const ratePerMeter = Number.parseFloat(workerDraft.ratePerMeter)
        if (!workerDraft.name.trim() || !Number.isFinite(ratePerMeter) || ratePerMeter < 0) {
            toast.error('Enter a worker name and a valid rate per metre.')
            return
        }

        if (editingWorkerId) {
            void runAction(
                'worker-update',
                () => updateBaseProductionWorker({
                    workerId: editingWorkerId,
                    name: workerDraft.name,
                    ratePerMeter,
                    isActive: workerDraft.isActive,
                }),
                'Worker updated.',
                closeDialog,
            )
            return
        }

        void runAction(
            'worker-create',
            () => createBaseProductionWorker({ name: workerDraft.name, ratePerMeter }),
            'Worker added.',
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
            closeDialog,
        )
    }

    function handleRecordSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const meters = Number.parseFloat(recordDraft.meters)
        if (!recordDraft.jobId || !recordDraft.workerId || !Number.isFinite(meters) || meters <= 0) {
            toast.error('Choose a job, choose a worker, and enter metres greater than 0.')
            return
        }

        void runAction(
            'production-record',
            () => recordBaseProduction({
                jobId: recordDraft.jobId,
                workerId: recordDraft.workerId,
                productionDate: recordDraft.productionDate,
                meters,
                notes: recordDraft.notes,
                clientRequestId: recordRequestId,
            }),
            'Production recorded.',
            () => {
                setRecordDraft((current) => ({ ...current, meters: '', notes: '' }))
                setRecordRequestId(newClientRequestId())
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
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-saffron-deep">Base Production Core</p>
                    <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">Production</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-body">
                        Turn a saved costing into a simple job, record metres, and keep piece-rate worker pay clear.
                        You are recording production as the owner for now.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={openNewJob} disabled={initialData.costings.length === 0}>
                        <Plus className="h-4 w-4" />
                        New production job
                    </Button>
                    <Button variant="outline" onClick={() => openRecord()}>
                        <ClipboardList className="h-4 w-4" />
                        Record metres
                    </Button>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label="Open jobs" value={String(openJobs)} detail="Planned or active" icon={<ClipboardList className="h-4 w-4" />} />
                <SummaryCard label="Produced this period" value={formatMeters(producedThisPeriod)} detail={`${formatDateOnly(initialData.payrollPeriod.start)} – ${formatDateOnly(initialData.payrollPeriod.end)}`} icon={<CheckCircle2 className="h-4 w-4" />} />
                <SummaryCard label="Worker payout" value={formatINR(unsettledPayable, { hideDecimals: true })} detail="Unsettled net pay" icon={<WalletCards className="h-4 w-4" />} />
                <SummaryCard label="Pending advances" value={formatINR(pendingAdvances, { hideDecimals: true })} detail="Before capped recovery" icon={<IndianRupee className="h-4 w-4" />} />
            </div>

            <Card className="border-saffron/20 bg-saffron-soft/30">
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-lg bg-saffron-soft p-2 text-saffron-deep">
                            <HardHat className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-ink">Keep the Base workflow small</p>
                            <p className="mt-1 text-xs leading-relaxed text-body">
                                This workspace covers jobs, owner-entered metres, piece-rate workers, advances, and basic settlement only.
                                Orders, stock, looms, supervisor access, and advanced payroll remain in the Full Suite.
                            </p>
                        </div>
                    </div>
                    <Link href="/owner/estimator" className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-saffron-deep hover:underline">
                        Open cost estimates <ArrowRight className="h-4 w-4" />
                    </Link>
                </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid h-auto w-full grid-cols-3">
                    <TabsTrigger value="jobs">Jobs</TabsTrigger>
                    <TabsTrigger value="production">Record</TabsTrigger>
                    <TabsTrigger value="pay">Worker pay</TabsTrigger>
                </TabsList>

                <TabsContent value="jobs" className="space-y-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div>
                            <h2 className="text-lg font-bold text-ink">Production jobs</h2>
                            <p className="text-sm text-body">Each job keeps the costing economics and a simple metre target.</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={openNewJob} disabled={initialData.costings.length === 0}>
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
                            const summary = jobSummaries.get(job.id) ?? calculateBaseJobSummary(job, initialData.entries)
                            const nextStatus = getNextStatus(job.status)
                            const isJobPending = pendingAction === `job-status-${job.id}`

                            return (
                                <Card key={job.id}>
                                    <CardHeader className="border-b border-hairline/70">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <CardTitle className="truncate text-base">{job.quality_label}</CardTitle>
                                                <CardDescription className="mt-1">
                                                    {job.customer_reference || 'Internal production job'} · Started {formatDateOnly(job.start_date)}
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
                                                <p className="mt-1 font-bold text-ink">{formatDateOnly(job.due_date)}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <Button size="sm" onClick={() => openRecord(job.id)} disabled={job.status === 'completed' || job.status === 'cancelled'}>
                                                <ClipboardList className="h-4 w-4" /> Record metres
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
                </TabsContent>

                <TabsContent value="production" className="space-y-4">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4 text-saffron-deep" /> Record production</CardTitle>
                                <CardDescription>Enter the metres produced by one worker. The current worker rate is saved with the entry.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {activeJobs.length === 0 || activeWorkers.length === 0 ? (
                                    <EmptyState
                                        compact
                                        title={activeJobs.length === 0 ? 'Create an active job first' : 'Add an active worker first'}
                                        description={activeJobs.length === 0 ? 'Production entries need a planned or active job.' : 'Production entries need a piece-rate worker.'}
                                        action={activeJobs.length === 0
                                            ? <Button size="sm" onClick={openNewJob} disabled={initialData.costings.length === 0}>Create job</Button>
                                            : <Button size="sm" onClick={openNewWorker}><Plus className="h-4 w-4" /> Add worker</Button>}
                                    />
                                ) : (
                                    <form className="space-y-4" onSubmit={handleRecordSubmit}>
                                        <div className="space-y-2">
                                            <Label htmlFor="base-record-job">Production job</Label>
                                            <Select value={recordDraft.jobId} onValueChange={(value) => setRecordDraft((current) => ({ ...current, jobId: value }))}>
                                                <SelectTrigger id="base-record-job" className="w-full"><SelectValue placeholder="Select a job" /></SelectTrigger>
                                                <SelectContent>
                                                    {activeJobs.map((job) => <SelectItem key={job.id} value={job.id}>{job.quality_label} · {formatMeters(job.target_meters)}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="base-record-worker">Worker</Label>
                                            <Select value={recordDraft.workerId} onValueChange={(value) => setRecordDraft((current) => ({ ...current, workerId: value }))}>
                                                <SelectTrigger id="base-record-worker" className="w-full"><SelectValue placeholder="Select a worker" /></SelectTrigger>
                                                <SelectContent>
                                                    {activeWorkers.map((worker) => <SelectItem key={worker.id} value={worker.id}>{worker.name} · {formatINR(worker.rate_per_meter)}/m</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="space-y-2"><Label htmlFor="base-record-date">Production date</Label><Input id="base-record-date" type="date" max={initialData.today} value={recordDraft.productionDate} onChange={(event) => setRecordDraft((current) => ({ ...current, productionDate: event.target.value }))} /></div>
                                            <div className="space-y-2"><Label htmlFor="base-record-meters">Metres produced</Label><Input id="base-record-meters" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0.00" value={recordDraft.meters} onChange={(event) => setRecordDraft((current) => ({ ...current, meters: event.target.value }))} /></div>
                                        </div>
                                        <div className="space-y-2"><Label htmlFor="base-record-notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="base-record-notes" rows={2} placeholder="Any short production note" value={recordDraft.notes} onChange={(event) => setRecordDraft((current) => ({ ...current, notes: event.target.value }))} /></div>
                                        <Button type="submit" disabled={pendingAction === 'production-record'}>{pendingAction === 'production-record' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />} Save production</Button>
                                    </form>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base"><Clock3 className="h-4 w-4 text-saffron-deep" /> Recent production</CardTitle>
                                <CardDescription>Latest owner-entered production records across Base jobs.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {initialData.entries.length === 0 ? (
                                    <EmptyState compact title="No production recorded" description="Your saved entries will appear here." />
                                ) : (
                                    <div className="divide-y divide-hairline rounded-lg border border-hairline">
                                        {initialData.entries.slice(0, 12).map((entry) => (
                                            <div key={entry.id} className="flex flex-col gap-1 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                                                <div className="min-w-0"><p className="truncate font-semibold text-ink">{workerById.get(entry.worker_id)?.name ?? 'Worker'} · {jobById.get(entry.job_id)?.quality_label ?? 'Job'}</p><p className="text-xs text-muted-foreground">{formatDateOnly(entry.production_date)}</p></div>
                                                <div className="shrink-0 font-bold text-ink">{formatMeters(entry.meters)} <span className="text-xs font-normal text-muted-foreground">· {formatINR(entry.meters * entry.worker_rate_snapshot)}</span></div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="pay" className="space-y-4">
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
                            <Button variant="outline" onClick={() => openAdvance()} disabled={activeWorkers.length === 0}><Plus className="h-4 w-4" /> Add advance</Button>
                            <Button variant="outline" onClick={openNewWorker}><Plus className="h-4 w-4" /> Add worker</Button>
                        </div>
                    </div>

                    <Card className="border-hairline bg-surface-soft/45">
                        <CardContent className="flex items-start gap-3 py-4 text-sm">
                            <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-saffron-deep" />
                            <p className="leading-relaxed text-body">Pay is calculated from the rate saved when production was recorded. Advance recovery is capped at 50% of gross pay, and the unpaid balance carries forward. Fixed salary, statutory deductions, payslips, and WhatsApp remain Full Suite features.</p>
                        </CardContent>
                    </Card>

                    {initialData.workers.length === 0 ? (
                        <EmptyState title="No piece-rate workers yet" description="Add the workers whose metres you want to record and settle." action={<Button size="sm" onClick={openNewWorker}><Plus className="h-4 w-4" /> Add worker</Button>} />
                    ) : (
                        <div className="grid gap-4 lg:grid-cols-2">
                            {initialData.payables.map((payable) => {
                                const worker = workerById.get(payable.worker_id)
                                const settlePending = pendingAction === `settle-${payable.worker_id}`
                                return (
                                    <Card key={payable.worker_id} className={!worker?.is_active ? 'opacity-75' : undefined}>
                                        <CardHeader className="border-b border-hairline/70">
                                            <div className="flex items-start justify-between gap-3">
                                                <div><CardTitle className="text-base">{payable.worker_name}</CardTitle><CardDescription>{worker?.is_active ? `₹${worker.rate_per_meter.toFixed(2)}/m current rate` : 'Inactive worker'}</CardDescription></div>
                                                <div className="flex items-center gap-2"><Badge variant={payable.status === 'paid' ? 'success' : 'warning'}>{payable.status === 'paid' ? 'Paid' : 'Open'}</Badge><Button variant="ghost" size="icon-xs" aria-label={`Edit ${payable.worker_name}`} onClick={() => worker && openEditWorker(worker)}><Edit3 className="h-3.5 w-3.5" /></Button></div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4 pt-0">
                                            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                                                <Metric label="Metres" value={formatMeters(payable.meters)} />
                                                <Metric label="Gross" value={formatINR(payable.gross_pay, { hideDecimals: true })} />
                                                <Metric label="Advance" value={formatINR(payable.advance_recovery, { hideDecimals: true })} />
                                                <Metric label="Net pay" value={formatINR(payable.net_payout, { hideDecimals: true })} emphasis />
                                            </div>
                                            <div className="rounded-lg bg-surface-soft/70 p-3 text-xs text-body">
                                                {payable.status === 'paid'
                                                    ? <>Paid on {formatDateOnly(payable.paid_at)} · {formatINR(payable.advance_recovery, { hideDecimals: true })} advance recovered.</>
                                                    : <>Up to {formatINR(payable.max_advance_recovery, { hideDecimals: true })} can be recovered this period. Pending advance balance: {formatINR(payable.pending_advance, { hideDecimals: true })}{payable.remaining_debt > 0 ? ` · ${formatINR(payable.remaining_debt, { hideDecimals: true })} carries forward.` : ''}</>}
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
                </TabsContent>
            </Tabs>

            <Dialog open={dialog === 'worker'} onOpenChange={(open) => !open && closeDialog()}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingWorkerId ? 'Edit worker' : 'Add piece-rate worker'}</DialogTitle><DialogDescription>Only the name and metre rate are needed for the Base workflow. Past production keeps its saved rate.</DialogDescription></DialogHeader>
                    <form className="space-y-4" onSubmit={handleWorkerSubmit}>
                        <div className="space-y-2"><Label htmlFor="base-worker-name">Worker name</Label><Input id="base-worker-name" autoFocus value={workerDraft.name} onChange={(event) => setWorkerDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Ramesh" /></div>
                        <div className="space-y-2"><Label htmlFor="base-worker-rate">Rate per metre</Label><Input id="base-worker-rate" type="number" min="0" step="0.01" inputMode="decimal" value={workerDraft.ratePerMeter} onChange={(event) => setWorkerDraft((current) => ({ ...current, ratePerMeter: event.target.value }))} placeholder="0.00" /></div>
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
