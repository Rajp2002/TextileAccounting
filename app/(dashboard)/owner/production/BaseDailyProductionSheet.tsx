'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, ChevronDown, ClipboardList, Loader2, Lock, LockOpen, Plus, Save, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatINR } from '@/lib/finance'
import {
    calculateBaseDailyProductionSummary,
    type BaseDailyProductionStatus,
} from '@/lib/base-production-core'
import type { BaseProductionInitialData } from './loaders'
import { saveBaseDailyProductionBatch } from './actions'

type DraftRow = {
    meters: string
    status: BaseDailyProductionStatus
    machineMeters: Record<string, string>
    savedUnallocatedMeters: number | null
}

type MachineContext = {
    machineId: string
    machineLabel: string
    machineType: string
    assignmentId: string | null
    workerId: string | null
    workerName: string | null
    jobId: string | null
    jobLabel: string | null
    ratePerMeter: number
    rateSource: 'costing'
}

function newClientRequestId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
        const random = Math.floor(Math.random() * 16)
        const value = character === 'x' ? random : (random & 0x3) | 0x8
        return value.toString(16)
    })
}

function formatMeters(value: number) {
    return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)} m`
}

function formatDateOnly(value: string) {
    const [year, month, day] = value.split('-').map(Number)
    if (![year, month, day].every(Number.isFinite)) return value
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
    }).format(new Date(Date.UTC(year, month - 1, day)))
}

function getActionError(result: unknown) {
    if (!result || typeof result !== 'object' || !('error' in result)) return null
    const error = (result as { error?: unknown }).error
    return typeof error === 'string' ? error : 'The daily production sheet could not be saved.'
}

function toDraftStatus(value: unknown): BaseDailyProductionStatus {
    return value === 'entered' || value === 'zero' || value === 'absent' ? value : 'blank'
}

function contextKey(context: Pick<MachineContext, 'machineId' | 'jobId'>) {
    return `${context.machineId}:${context.jobId ?? 'unassigned'}`
}

function parseMeters(value: string | number | null | undefined) {
    const numeric = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0
}

function isContextValidForDate(
    effectiveFrom: string,
    effectiveTo: string | null,
    productionDate: string,
) {
    return effectiveFrom <= productionDate && (!effectiveTo || effectiveTo >= productionDate)
}

export default function BaseDailyProductionSheet({
    initialData,
    onAddWorker,
    onAddMachine,
}: {
    initialData: BaseProductionInitialData
    onAddWorker: () => void
    onAddMachine: () => void
}) {
    const router = useRouter()
    const [productionDate, setProductionDate] = useState(initialData.today)
    const [shift, setShift] = useState<'day' | 'night'>('day')
    const [rows, setRows] = useState<Record<string, DraftRow>>({})
    const [requestId, setRequestId] = useState(newClientRequestId)
    const [isSaving, setIsSaving] = useState(false)
    const [unlockedBatchId, setUnlockedBatchId] = useState<string | null>(null)
    const [isUnlockDialogOpen, setIsUnlockDialogOpen] = useState(false)
    const [isPayrollExpanded, setIsPayrollExpanded] = useState(false)

    const jobById = useMemo(
        () => new Map(initialData.jobs.map((job) => [job.id, job])),
        [initialData.jobs],
    )
    const workerById = useMemo(
        () => new Map(initialData.workers.map((worker) => [worker.id, worker])),
        [initialData.workers],
    )
    const currentBatch = useMemo(
        () => initialData.dailyBatches.find((batch) => batch.production_date === productionDate && batch.shift === shift) ?? null,
        [initialData.dailyBatches, productionDate, shift],
    )
    const currentBatchEntries = useMemo(
        () => currentBatch ? initialData.entries.filter((entry) => entry.batch_id === currentBatch.id) : [],
        [currentBatch, initialData.entries],
    )
    const assignedWorkerIds = useMemo(
        () => new Set(initialData.assignments
            .filter((assignment) => assignment.shift === shift && assignment.active && isContextValidForDate(assignment.effective_from, assignment.effective_to, productionDate))
            .map((assignment) => assignment.worker_id)),
        [initialData.assignments, productionDate, shift],
    )
    const sheetWorkers = useMemo(() => {
        const savedWorkerIds = new Set(currentBatchEntries.map((entry) => entry.worker_id))
        return initialData.workers.filter((worker) => (
            (worker.is_active && (worker.shift_availability === 'both' || worker.shift_availability === shift))
            || savedWorkerIds.has(worker.id)
            || assignedWorkerIds.has(worker.id)
        ))
    }, [assignedWorkerIds, currentBatchEntries, initialData.workers, shift])
    const settledWorkerIds = useMemo(
        () => new Set(
            initialData.settlements
                .filter((settlement) => settlement.period_start <= productionDate && settlement.period_end >= productionDate)
                .map((settlement) => settlement.worker_id),
        ),
        [initialData.settlements, productionDate],
    )
    const isCurrentBatchLocked = Boolean(
        currentBatch?.status === 'finalized'
        || currentBatchEntries.some((entry) => settledWorkerIds.has(entry.worker_id)),
    )
    const isSavedBatchProtected = Boolean(
        currentBatch
        && !isCurrentBatchLocked
        && unlockedBatchId !== currentBatch.id,
    )
    const areInputsDisabled = isCurrentBatchLocked || isSavedBatchProtected

    const allocationsByEntry = useMemo(() => {
        const map = new Map<string, typeof initialData.allocations>()
        for (const allocation of initialData.allocations) {
            const current = map.get(allocation.entry_id) ?? []
            current.push(allocation)
            map.set(allocation.entry_id, current)
        }
        return map
    }, [initialData])

    const machineContexts = useMemo(() => {
        const currentJobContexts = new Map<string, { effectiveFrom: string; jobId: string; jobLabel: string; ratePerMeter: number }>()
        for (const context of initialData.machineJobContexts) {
            if (!context.active || !isContextValidForDate(context.effective_from, context.effective_to, productionDate)) continue
            const job = jobById.get(context.job_id)
            if (!job || job.status === 'cancelled') continue
            const existing = currentJobContexts.get(context.machine_id)
            if (!existing || context.effective_from > existing.effectiveFrom) {
                currentJobContexts.set(context.machine_id, {
                    effectiveFrom: context.effective_from,
                    jobId: job.id,
                    jobLabel: job.quality_label,
                    ratePerMeter: job.worker_rate_per_meter > 0 ? job.worker_rate_per_meter : 0,
                })
            }
        }

        const currentAssignments = new Map<string, typeof initialData.assignments[number]>()
        for (const assignment of initialData.assignments) {
            if (assignment.shift !== shift || !assignment.active || !isContextValidForDate(assignment.effective_from, assignment.effective_to, productionDate)) continue
            const existing = currentAssignments.get(assignment.machine_id)
            if (!existing || assignment.effective_from > existing.effective_from) currentAssignments.set(assignment.machine_id, assignment)
        }

        const savedMachineIds = new Set(
            initialData.allocations
                .filter((allocation) => currentBatchEntries.some((entry) => entry.id === allocation.entry_id))
                .map((allocation) => allocation.machine_id),
        )

        return initialData.machines
            .filter((machine) => machine.is_active || savedMachineIds.has(machine.id))
            .map((machine): MachineContext => {
                const assignment = currentAssignments.get(machine.id)
                const worker = assignment ? workerById.get(assignment.worker_id) ?? null : null
                const jobContext = currentJobContexts.get(machine.id)
                return {
                    machineId: machine.id,
                    machineLabel: machine.custom_label || machine.name,
                    machineType: machine.machine_type,
                    assignmentId: assignment?.id ?? null,
                    workerId: worker?.id ?? null,
                    workerName: worker?.name ?? null,
                    jobId: jobContext?.jobId ?? null,
                    jobLabel: jobContext?.jobLabel ?? null,
                    ratePerMeter: jobContext?.ratePerMeter ?? 0,
                    rateSource: 'costing',
                }
            })
            .sort((a, b) => a.machineLabel.localeCompare(b.machineLabel))
    }, [currentBatchEntries, initialData, jobById, productionDate, shift, workerById])

    const contextsByWorker = useMemo(() => {
        const map = new Map<string, MachineContext[]>()
        for (const context of machineContexts) {
            if (!context.workerId) continue
            const current = map.get(context.workerId) ?? []
            current.push(context)
            map.set(context.workerId, current)
        }
        return map
    }, [machineContexts])

    useEffect(() => {
        const existingByWorker = new Map(currentBatchEntries.map((entry) => [entry.worker_id, entry]))

        setRows(Object.fromEntries(sheetWorkers.map((worker) => {
            const existing = existingByWorker.get(worker.id)
            const contexts = contextsByWorker.get(worker.id) ?? []
            const existingAllocations = existing ? allocationsByEntry.get(existing.id) ?? [] : []
            const machineMeters: Record<string, string> = {}

            for (const allocation of existingAllocations) {
                machineMeters[`${allocation.machine_id}:${allocation.job_id}`] = String(allocation.meters)
            }

            const historicalContextMatches = existing?.machine_id && existing.job_id
                ? contexts.some((context) => context.machineId === existing.machine_id && context.jobId === existing.job_id)
                : !existing?.machine_id && !existing?.job_id && contexts.length === 1 && Boolean(contexts[0].jobId)
            const canCarrySingleHistoricalTotal = Boolean(
                existing
                && existing.entry_status === 'entered'
                && existing.meters > 0
                && existingAllocations.length === 0
                && contexts.length === 1
                && contexts[0].jobId
                && historicalContextMatches,
            )

            if (canCarrySingleHistoricalTotal) {
                machineMeters[contextKey(contexts[0])] = String(existing!.meters)
            }

            const hasUnallocatedHistoricalTotal = Boolean(
                existing
                && existing.entry_status === 'entered'
                && existing.meters > 0
                && existingAllocations.length === 0
                && !canCarrySingleHistoricalTotal,
            )

            return [worker.id, {
                status: toDraftStatus(existing?.entry_status),
                meters: contexts.length > 0 ? '' : existing?.entry_status === 'entered' ? String(existing.meters) : '',
                machineMeters,
                savedUnallocatedMeters: hasUnallocatedHistoricalTotal ? existing!.meters : null,
            }]
        })))
    }, [allocationsByEntry, contextsByWorker, currentBatchEntries, sheetWorkers])

    function getRow(workerId: string): DraftRow {
        return rows[workerId] ?? { meters: '', status: 'blank', machineMeters: {}, savedUnallocatedMeters: null }
    }

    function getRowTotal(workerId: string) {
        const row = getRow(workerId)
        const contexts = contextsByWorker.get(workerId) ?? []
        if (contexts.length === 0) return row.status === 'entered' ? parseMeters(row.meters) : 0
        return contexts.reduce((total, context) => total + parseMeters(row.machineMeters[contextKey(context)]), 0)
    }

    function getRowGrossPay(workerId: string) {
        const row = getRow(workerId)
        const contexts = contextsByWorker.get(workerId) ?? []
        if (contexts.length === 0) return 0
        return contexts.reduce((total, context) => total + parseMeters(row.machineMeters[contextKey(context)]) * context.ratePerMeter, 0)
    }

    const summary = calculateBaseDailyProductionSummary(sheetWorkers.map((worker) => {
        const row = getRow(worker.id)
        return {
            worker_id: worker.id,
            status: row.status,
            meters: row.status === 'entered' ? getRowTotal(worker.id) : row.status === 'zero' || row.status === 'absent' ? 0 : null,
        }
    }))

    const invalidEnteredCount = sheetWorkers.filter((worker) => {
            const row = getRow(worker.id)
            if (row.status !== 'entered') return false
            const contexts = contextsByWorker.get(worker.id) ?? []
            if (contexts.length === 0) return parseMeters(row.meters) <= 0
            if (getRowTotal(worker.id) <= 0) return true
            if (row.savedUnallocatedMeters !== null && getRowTotal(worker.id) <= 0) return true
            return contexts.some((context) => {
                const enteredMeters = row.machineMeters[contextKey(context)]?.trim()
                return Boolean(enteredMeters) && !context.jobId
            })
        }).length

    function updateRow(workerId: string, update: Partial<DraftRow>) {
        setRows((current) => {
            const previous = current[workerId] ?? { meters: '', status: 'blank' as const, machineMeters: {}, savedUnallocatedMeters: null }
            return { ...current, [workerId]: { ...previous, ...update } }
        })
    }

    function handleUnassignedMetersChange(workerId: string, value: string) {
        const current = getRow(workerId)
        updateRow(workerId, {
            meters: value,
            status: value.trim() ? 'entered' : current.status === 'entered' ? 'blank' : current.status,
        })
    }

    function handleMachineMetersChange(context: MachineContext, value: string) {
        if (!context.workerId) return
        const current = getRow(context.workerId)
        const machineMeters = { ...current.machineMeters, [contextKey(context)]: value }
        const hasAnyMeters = Object.values(machineMeters).some((candidate) => candidate.trim().length > 0)
        updateRow(context.workerId, {
            machineMeters,
            status: hasAnyMeters ? 'entered' : current.status === 'entered' ? 'blank' : current.status,
        })
    }

    function handleStatusChange(workerId: string, value: BaseDailyProductionStatus) {
        const current = getRow(workerId)
        updateRow(workerId, {
            status: value,
            meters: value === 'entered' ? current.meters : '',
            machineMeters: value === 'entered' ? current.machineMeters : {},
        })
    }

    async function handleSave() {
        if (isSaving) return
        if (isCurrentBatchLocked) {
            toast.error('This production sheet is finalized and cannot be changed.')
            return
        }
        if (isSavedBatchProtected) {
            toast.error('Unlock the saved production log before making a correction.')
            return
        }
        if (invalidEnteredCount > 0) {
            toast.error('Enter positive metres for every produced machine, and assign a costing before saving.')
            return
        }
        if (summary.entered_count + summary.zero_count + summary.absent_count === 0) {
            toast.error('Enter production or mark at least one worker zero or absent.')
            return
        }

        setIsSaving(true)
        try {
            const result = await saveBaseDailyProductionBatch({
                productionDate,
                shift,
                clientRequestId: requestId,
                entries: sheetWorkers.map((worker) => {
                    const row = getRow(worker.id)
                    const contexts = contextsByWorker.get(worker.id) ?? []
                    const totalMeters = getRowTotal(worker.id)
                    return {
                        workerId: worker.id,
                        meters: row.status === 'blank' ? null : row.status === 'entered' ? Number(totalMeters.toFixed(2)) : 0,
                        status: row.status,
                        allocations: row.status === 'entered'
                            ? contexts
                                .filter((context) => context.jobId && parseMeters(row.machineMeters[contextKey(context)]) > 0)
                                .map((context) => ({
                                    machineId: context.machineId,
                                    jobId: context.jobId!,
                                    meters: Number(parseMeters(row.machineMeters[contextKey(context)]).toFixed(2)),
                                }))
                            : [],
                    }
                }),
            })
            const error = getActionError(result)
            if (error) {
                toast.error(error)
                return
            }

            const summaryData = (result as { summary?: { total_meters?: number; idempotent?: boolean } }).summary
            toast.success(summaryData?.idempotent ? 'This shift was already saved.' : `Shift saved · ${formatMeters(Number(summaryData?.total_meters ?? summary.total_meters))}`)
            setUnlockedBatchId(null)
            setRequestId(newClientRequestId())
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'The daily production sheet could not be saved.')
        } finally {
            setIsSaving(false)
        }
    }

    const assignedMachineContexts = machineContexts.filter((context) => context.workerId)
    const unassignedMachines = machineContexts.filter((context) => !context.workerId)
    const assignedWorkers = sheetWorkers.filter((worker) => (contextsByWorker.get(worker.id) ?? []).length > 0)
    const unassignedWorkers = sheetWorkers.filter((worker) => (contextsByWorker.get(worker.id) ?? []).length === 0)

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-ink">Daily machine production</h2>
                    <p className="mt-0.5 text-sm text-body">Enter metres once per machine. Worker, job, and rate stay in sync with Setup.</p>
                </div>
                <Button variant="outline" size="sm" className="hidden shrink-0 sm:inline-flex" onClick={onAddWorker}>
                    <Plus className="h-4 w-4" /> Add worker
                </Button>
            </div>

            <Card className="border-saffron/20 bg-saffron-soft/25">
                <CardContent className="flex flex-col gap-3 py-3 sm:flex-row sm:items-end sm:justify-between sm:py-4">
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="base-daily-date">Date</Label>
                            <Input id="base-daily-date" type="date" max={initialData.today} value={productionDate} onChange={(event) => setProductionDate(event.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="base-daily-shift">Shift</Label>
                            <Select value={shift} onValueChange={(value) => setShift(value as 'day' | 'night')}>
                                <SelectTrigger id="base-daily-shift"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="day">Day shift</SelectItem>
                                    <SelectItem value="night">Night shift</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-saffron/15 rounded-lg border border-saffron/15 bg-surface/65 px-1 py-2 text-sm sm:min-w-[360px] sm:border-0 sm:bg-transparent sm:p-0">
                        <Stat label="Machines" value={`${assignedMachineContexts.length}/${machineContexts.length}`} />
                        <Stat label="Workers" value={`${summary.entered_count}/${sheetWorkers.length}`} />
                        <Stat label="Total" value={formatMeters(summary.total_meters)} />
                    </div>
                </CardContent>
            </Card>

            {currentBatch && (
                <div className={`flex flex-col gap-3 rounded-lg border px-3 py-3 text-xs sm:flex-row sm:items-center sm:justify-between ${isSavedBatchProtected ? 'border-warning/30 bg-warning/5' : 'border-success/25 bg-success/5'}`}>
                    <div className="flex items-start gap-2 text-body">
                        {isSavedBatchProtected ? <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
                        <span>
                            {isCurrentBatchLocked ? 'Finalized' : 'Saved'} for {formatDateOnly(productionDate)} · {shift === 'day' ? 'Day' : 'Night'} shift.{' '}
                            {isCurrentBatchLocked
                                ? 'Corrections are locked because the sheet is finalized or worker pay is settled.'
                                : isSavedBatchProtected
                                    ? 'Editing is locked to prevent accidental changes.'
                                    : 'Correction mode is active. Review every changed value before saving.'}
                        </span>
                    </div>
                    {isSavedBatchProtected && (
                        <Button variant="outline" size="sm" className="shrink-0 border-warning/40" onClick={() => setIsUnlockDialogOpen(true)}>
                            <LockOpen className="h-4 w-4" /> Edit saved log
                        </Button>
                    )}
                </div>
            )}

            {sheetWorkers.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                        <Users className="h-8 w-8 text-saffron-deep" />
                        <div>
                            <p className="font-bold text-ink">Add a worker to record production</p>
                            <p className="mt-1 max-w-md text-sm leading-relaxed text-body">Add workers in Setup and choose which shift they are available for.</p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2"><Button onClick={onAddWorker}><Plus className="h-4 w-4" /> Add worker</Button><Button variant="outline" onClick={onAddMachine}><Plus className="h-4 w-4" /> Add machine</Button></div>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <Card>
                        <CardHeader className="border-b border-hairline/70 pb-3 sm:pb-5">
                            <CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4 text-saffron-deep" /> Machine sheet</CardTitle>
                            <CardDescription className="hidden sm:block">Each machine row is the source entry. Worker pay is calculated automatically from the saved job rate.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.25fr)_150px] gap-3 border-b border-hairline bg-surface-soft/50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground md:grid">
                                <span>Machine</span><span>Assigned worker</span><span>Job / weaver rate</span><span className="text-right">Metres</span>
                            </div>
                            <div className="divide-y divide-hairline">
                                {assignedMachineContexts.map((context) => {
                                    const row = getRow(context.workerId!)
                                    const value = row.machineMeters[contextKey(context)] ?? ''
                                    return (
                                        <div key={context.machineId} className="grid grid-cols-[minmax(0,1fr)_112px] gap-x-3 gap-y-2 px-3 py-3 [contain-intrinsic-size:104px] [content-visibility:auto] md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.25fr)_150px] md:items-center md:px-4 md:py-4">
                                            <div className="min-w-0"><p className="truncate font-semibold text-ink">{context.machineLabel}</p><p className="truncate text-xs text-muted-foreground">{context.machineType.replaceAll('_', ' ')}<span className="md:hidden"> · {context.workerName}</span></p></div>
                                            <div className="hidden text-sm text-body md:block"><span className="font-semibold text-ink">{context.workerName}</span><p className="text-xs text-muted-foreground">{toWorkerStatusLabel(row.status)}</p></div>
                                            <div className="min-w-0 md:col-auto">
                                                <div className="flex min-w-0 items-center gap-2"><Badge variant={context.jobId ? 'secondary' : 'warning'} className="max-w-full truncate">{context.jobLabel ?? 'Job not assigned'}</Badge>{context.jobId && <span className="hidden shrink-0 text-xs font-semibold text-body sm:inline">₹{context.ratePerMeter.toFixed(2)}/m</span>}</div>
                                                {!context.jobId && <p className="mt-1 text-xs font-medium text-warning">Assign a production job before entering metres.</p>}
                                            </div>
                                            <Input
                                                aria-label={`${context.machineLabel} ${context.workerName} metres`}
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                inputMode="decimal"
                                                placeholder="Metres"
                                                value={value}
                                                disabled={row.status === 'zero' || row.status === 'absent' || areInputsDisabled || !context.jobId}
                                                onChange={(event) => handleMachineMetersChange(context, event.target.value)}
                                                className="row-span-2 row-start-1 h-11 self-center text-right text-base font-semibold md:col-auto md:row-auto md:h-10 md:text-sm"
                                            />
                                        </div>
                                    )
                                })}
                                {unassignedMachines.map((context) => (
                                    <div key={context.machineId} className="flex items-start gap-2 bg-warning/5 px-4 py-4 text-sm">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                                        <div><p className="font-semibold text-ink">{context.machineLabel} has no worker for this shift</p><p className="text-xs text-body">Assign a worker before entering production so the metres can flow into payroll.</p></div>
                                    </div>
                                ))}
                                {machineContexts.length === 0 && <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm text-body"><p>No active machines are available for this shift. Add a machine and assign a worker first.</p><Button variant="outline" size="sm" onClick={onAddMachine}><Plus className="h-4 w-4" /> Add machine</Button></div>}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="border-b border-hairline/70 pb-3 sm:pb-5">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <CardTitle className="text-base">Worker payroll roll-up</CardTitle>
                                    <p className="mt-1 text-xs font-medium text-body md:hidden">{formatMeters(summary.total_meters)} · {summary.entered_count} recorded · {summary.outstanding_count} pending</p>
                                </div>
                                <Button type="button" variant="ghost" size="sm" className="md:hidden" aria-expanded={isPayrollExpanded} aria-controls="base-payroll-rollup" onClick={() => setIsPayrollExpanded((current) => !current)}>
                                    {isPayrollExpanded ? 'Hide' : 'Review'}
                                    <ChevronDown className={`h-4 w-4 transition-transform ${isPayrollExpanded ? 'rotate-180' : ''}`} />
                                </Button>
                            </div>
                            <CardDescription className="hidden md:block">Calculated from the machine metres above. Use zero or absent only when a worker has no production this shift.</CardDescription>
                        </CardHeader>
                        <CardContent id="base-payroll-rollup" className={`${isPayrollExpanded ? 'block' : 'hidden'} divide-y divide-hairline p-0 md:block`}>
                            {assignedWorkers.map((worker) => {
                                const row = getRow(worker.id)
                                const contexts = contextsByWorker.get(worker.id) ?? []
                                const rowTotal = getRowTotal(worker.id)
                                const rowGrossPay = getRowGrossPay(worker.id)
                                return (
                                    <div key={worker.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_150px_160px] md:items-center">
                                        <div className="min-w-0"><p className="font-semibold text-ink">{worker.name}{!worker.is_active && <span className="ml-1 text-xs font-normal text-muted-foreground">· inactive</span>}</p><p className="text-xs text-muted-foreground">{contexts.length > 0 ? `${contexts.length} machine${contexts.length === 1 ? '' : 's'} · weaver rates applied` : 'No current machine assignment'}</p></div>
                                        <div className="text-sm text-body">{contexts.length > 0 ? contexts.map((context) => <span key={context.machineId} className="mr-1 inline-flex"><Badge variant="outline">{context.machineLabel}</Badge></span>) : <span className="text-warning">Unassigned worker entry</span>}</div>
                                        <Select value={row.status} onValueChange={(value) => handleStatusChange(worker.id, value as BaseDailyProductionStatus)} disabled={areInputsDisabled}>
                                            <SelectTrigger className="w-full" aria-label={`${worker.name} status`}><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="blank">Not entered</SelectItem>
                                                <SelectItem value="entered">Produced</SelectItem>
                                                <SelectItem value="zero">Zero output</SelectItem>
                                                <SelectItem value="absent">Absent / no production</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <div className="text-left md:text-right"><p className="font-bold text-ink">{formatMeters(rowTotal)}</p><p className="text-xs text-body">{formatINR(rowGrossPay)}</p></div>
                                        {row.savedUnallocatedMeters !== null && <div className="md:col-span-4 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-body"><AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-warning" /> Previously saved as {formatMeters(row.savedUnallocatedMeters)} without an exact machine split. Enter the machine allocation before saving this correction.</div>}
                                    </div>
                                )
                            })}
                            {unassignedWorkers.map((worker) => {
                                const row = getRow(worker.id)
                                return (
                                    <div key={`${worker.id}-unassigned`} className="grid gap-3 bg-warning/5 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_150px_160px] md:items-center">
                                        <div><p className="font-semibold text-ink">{worker.name}</p><p className="text-xs text-muted-foreground">No active machine assignment · no weaver rate</p></div>
                                        <div className="flex items-start gap-2 text-xs text-body"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />Assign a machine and production job before recording output so pay and job reporting are allocated correctly.</div>
                                        <span className="text-xs text-muted-foreground">{toWorkerStatusLabel(row.status)}</span>
                                        <Input
                                            aria-label={`${worker.name} unassigned metres`}
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            inputMode="decimal"
                                            placeholder="Metres"
                                            value={row.meters}
                                            disabled={row.status === 'zero' || row.status === 'absent' || areInputsDisabled}
                                            onChange={(event) => handleUnassignedMetersChange(worker.id, event.target.value)}
                                            className="text-right font-semibold"
                                        />
                                    </div>
                                )
                            })}
                        </CardContent>
                    </Card>
                </>
            )}

            {sheetWorkers.length > 0 && (
                <div className="sticky bottom-2 z-10 flex items-center justify-between gap-3 rounded-xl border border-saffron/30 bg-surface/95 p-2.5 shadow-[var(--shadow-panel)] backdrop-blur sm:p-3">
                    <div className="flex items-center gap-3 text-sm">
                        <div className="hidden rounded-lg bg-saffron-soft p-2 text-saffron-deep sm:block"><Save className="h-4 w-4" /></div>
                        <div>
                            <p className="whitespace-nowrap font-bold text-ink">{formatMeters(summary.total_meters)} · {summary.entered_count}/{sheetWorkers.length}</p>
                            <p className="hidden text-xs text-body sm:block">{summary.outstanding_count} not entered · {summary.zero_count} zero · {summary.absent_count} absent</p>
                        </div>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving || areInputsDisabled || invalidEnteredCount > 0 || summary.entered_count + summary.zero_count + summary.absent_count === 0} className="min-w-[132px] sm:min-w-[210px]">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        <span className="sm:hidden">{isSaving ? 'Saving…' : currentBatch ? 'Save correction' : 'Save shift'}</span>
                        <span className="hidden sm:inline">{isSaving ? 'Saving machine sheet…' : currentBatch ? 'Save production correction' : 'Save machine production'}</span>
                    </Button>
                </div>
            )}

            <Dialog open={isUnlockDialogOpen} onOpenChange={setIsUnlockDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit this saved production log?</DialogTitle>
                        <DialogDescription>
                            This sheet is already saved for {formatDateOnly(productionDate)} · {shift === 'day' ? 'Day' : 'Night'} shift. Any correction can change production totals and worker payroll.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-3 text-sm text-body">
                        Check the machine, worker, and metres carefully. Editing stays unlocked only for this saved shift and locks again after you save.
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsUnlockDialogOpen(false)}>Keep locked</Button>
                        <Button
                            onClick={() => {
                                if (!currentBatch || isCurrentBatchLocked) return
                                setUnlockedBatchId(currentBatch.id)
                                setIsUnlockDialogOpen(false)
                            }}
                        >
                            <LockOpen className="h-4 w-4" /> Unlock editing
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function toWorkerStatusLabel(status: BaseDailyProductionStatus) {
    if (status === 'entered') return 'Production entered'
    if (status === 'zero') return 'Zero output'
    if (status === 'absent') return 'Absent / no production'
    return 'Not entered'
}

function Stat({ label, value }: { label: string; value: string }) {
    return <div className="px-2 text-center sm:px-0 sm:text-left"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-bold text-ink">{value}</p></div>
}
