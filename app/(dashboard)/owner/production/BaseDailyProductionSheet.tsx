'use client'

import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import Link from 'next/link'
import { baseProductionHref, validBaseDate, type BaseProductionNavigation } from '@/lib/base-production-navigation'
import { baseProductionDraftKey, parseBaseProductionDraft } from '@/lib/base-production-draft'
import { baseProductionAuditChanges } from '@/lib/base-production-audit'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/context'
import { AlertTriangle, CheckCircle2, ChevronDown, ClipboardList, FileClock, Loader2, Lock, LockOpen, Plus, Save, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
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
    navigation = {},
}: {
    initialData: BaseProductionInitialData
    onAddWorker: () => void
    onAddMachine: () => void
    navigation?: BaseProductionNavigation
}) {
    const router = useRouter()
    const { tx } = useTranslation()
    const [productionDate, setProductionDate] = useState(navigation.date ?? initialData.today)
    const [shift, setShift] = useState<'day' | 'night'>(navigation.shift ?? 'day')
    const [rows, setRows] = useState<Record<string, DraftRow>>({})
    const [requestId, setRequestId] = useState(newClientRequestId)
    const [isSaving, setIsSaving] = useState(false)
    const [unlockedBatchId, setUnlockedBatchId] = useState<string | null>(null)
    const [isUnlockDialogOpen, setIsUnlockDialogOpen] = useState(false)
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
    const [correctionReason, setCorrectionReason] = useState('')
    const [isPayrollExpanded, setIsPayrollExpanded] = useState(false)
    const [draftStatus, setDraftStatus] = useState<'none' | 'local' | 'error' | 'conflict'>('none')
    const [draftReset, setDraftReset] = useState(0)
    const selectedEntry = initialData.entries.find((entry) => entry.id === navigation.entry)
    const focusedWorker = selectedEntry?.worker_id ?? navigation.worker
    const draftKey = initialData.actorId ? baseProductionDraftKey(initialData.orgId, initialData.actorId, productionDate, shift) : null

    useEffect(() => {
        const date = selectedEntry?.production_date ?? navigation.date
        setProductionDate(date && date <= initialData.today ? date : initialData.today)
        setShift(selectedEntry?.shift ?? navigation.shift ?? 'day')
    }, [selectedEntry?.production_date, selectedEntry?.shift, navigation.date, navigation.shift, initialData.today])

    useEffect(() => {
        if (draftStatus !== 'error') return
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
        window.addEventListener('beforeunload', warn)
        return () => window.removeEventListener('beforeunload', warn)
    }, [draftStatus])

    useEffect(() => {
        const frame = requestAnimationFrame(() => document.querySelector('[data-base-highlight="true"]')?.scrollIntoView({ block: 'center' }))
        return () => cancelAnimationFrame(frame)
    }, [focusedWorker, navigation.job, productionDate, shift])

    function changeSelection(date: string, nextShift: 'day' | 'night') {
        if (!validBaseDate(date) || date > initialData.today || isSaving) return
        if (draftStatus === 'error' && !window.confirm(tx('This draft could not be saved on this device. Discard these unsaved changes?'))) return
        setProductionDate(date)
        setShift(nextShift)
        window.history.replaceState(null, '', baseProductionHref({ ...navigation, date, shift: nextShift, entry: undefined }))
    }

    function openSetup() {
        if (draftStatus === 'error' && !window.confirm(tx('This draft could not be saved on this device. Discard these unsaved changes?'))) return
        const params = new URLSearchParams({ shift, returnTo: baseProductionHref({ ...navigation, date: productionDate, shift }) })
        if (focusedWorker) params.set('worker', focusedWorker)
        router.push(`/owner/operations?${params}`)
    }

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
    const currentBatchRevisions = useMemo(
        () => currentBatch ? initialData.batchRevisions.filter((revision) => revision.batch_id === currentBatch.id) : [],
        [currentBatch, initialData.batchRevisions],
    )
    const correctionCount = currentBatchRevisions.filter((revision) => revision.change_kind === 'corrected').length
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
                .filter((settlement) => settlement.status !== 'reversed' && settlement.period_end >= productionDate)
                .map((settlement) => settlement.worker_id),
        ),
        [initialData.settlements, productionDate],
    )
    const isCurrentBatchLocked = Boolean(
        sheetWorkers.length > 0 && sheetWorkers.every((worker) => settledWorkerIds.has(worker.id)),
    )
    const isSavedBatchProtected = Boolean(
        currentBatch
        && !isCurrentBatchLocked
        && unlockedBatchId !== currentBatch.id,
    )
    const areInputsDisabled = isSaving || isCurrentBatchLocked || isSavedBatchProtected || draftStatus === 'conflict'

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

        const batchEntryIds = new Set(currentBatchEntries.map(entry => entry.id))
        const savedAllocationsByMachine = new Map(initialData.allocations
            .filter(allocation => batchEntryIds.has(allocation.entry_id))
            .map(allocation => [allocation.machine_id, allocation]))
        const savedMachineIds = new Set(savedAllocationsByMachine.keys())

        return initialData.machines
            .filter((machine) => machine.is_active || savedMachineIds.has(machine.id))
            .map((machine): MachineContext => {
                // A saved record must show its historical worker, job and rate,
                // even after Setup is changed or the assignment is retired.
                const saved = savedAllocationsByMachine.get(machine.id)
                if (saved) return {
                    machineId: machine.id,
                    machineLabel: saved.machine_label,
                    machineType: machine.machine_type,
                    assignmentId: saved.assignment_id,
                    workerId: saved.worker_id,
                    workerName: workerById.get(saved.worker_id)?.name ?? 'Worker',
                    jobId: saved.job_id,
                    jobLabel: saved.job_label,
                    ratePerMeter: saved.worker_rate_snapshot,
                    rateSource: 'costing',
                }
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

        const baseline = Object.fromEntries(sheetWorkers.map((worker) => {
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
        }))
        setDraftStatus('none')
        setCorrectionReason('')
        try {
            const draft = draftKey ? parseBaseProductionDraft(localStorage.getItem(draftKey)) : null
            if (draft && currentBatch?.client_request_id === draft.requestId) {
                localStorage.removeItem(draftKey!)
            } else if (draft) {
                setRows({ ...baseline, ...draft.rows })
                setRequestId(draft.requestId)
                setCorrectionReason(draft.reason)
                setDraftStatus(draft.revision === (currentBatch?.updated_at ?? null) ? 'local' : 'conflict')
                return
            }
        } catch { setDraftStatus('error') }
        setRows(baseline)
        setRequestId(newClientRequestId())
    }, [allocationsByEntry, contextsByWorker, currentBatchEntries, sheetWorkers, draftKey, currentBatch?.client_request_id, currentBatch?.updated_at, draftReset])

    useEffect(() => {
        setUnlockedBatchId(null)
    }, [productionDate, shift])

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
    const unmatchedDraftMeters = Object.entries(rows).some(([workerId, row]) => {
        if (row.status !== 'entered') return false
        const contexts = contextsByWorker.get(workerId) ?? []
        return (!sheetWorkers.some(worker => worker.id === workerId) && parseMeters(row.meters) > 0)
            || Object.entries(row.machineMeters).some(([key, value]) => parseMeters(value) > 0 && !contexts.some(context => contextKey(context) === key))
    })

    function updateRow(workerId: string, update: Partial<DraftRow>) {
        const previous = rows[workerId] ?? { meters: '', status: 'blank' as const, machineMeters: {}, savedUnallocatedMeters: null }
        const next = { ...rows, [workerId]: { ...previous, ...update } }
        const nextRequestId = newClientRequestId()
        setRows(next)
        setRequestId(nextRequestId)
        try {
            if (!draftKey) throw new Error('Draft owner is unavailable')
            localStorage.setItem(draftKey, JSON.stringify({ version: 1, revision: currentBatch?.updated_at ?? null, requestId: nextRequestId, reason: correctionReason, rows: next }))
            setDraftStatus('local')
        } catch { setDraftStatus('error') }
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

    function handleMachineMetersKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
        if (event.key !== 'Enter') return
        const fields = Array.from(document.querySelectorAll<HTMLInputElement>('[data-base-machine-meters]:not(:disabled)'))
        const currentIndex = fields.indexOf(event.currentTarget)
        const nextField = fields[currentIndex + 1]
        if (!nextField) return
        event.preventDefault()
        nextField.focus()
        nextField.select()
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
        if (draftStatus === 'conflict' || unmatchedDraftMeters) {
            toast.error('Review the changed shift or assignments before saving. Your local draft is retained.')
            return
        }
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
                expectedUpdatedAt: currentBatch?.updated_at ?? null,
                correctionReason: currentBatch ? correctionReason : undefined,
                entries: sheetWorkers.map((worker) => {
                    const row = getRow(worker.id)
                    const contexts = contextsByWorker.get(worker.id) ?? []
                    const totalMeters = getRowTotal(worker.id)
                    return {
                        workerId: worker.id,
                        notes: currentBatchEntries.find(entry => entry.worker_id === worker.id)?.notes ?? undefined,
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
            setCorrectionReason('')
            if (draftKey) {
                try { localStorage.removeItem(draftKey) } catch { /* The stored request ID is recognized on restore. */ }
            }
            setDraftStatus('none')
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

    if (navigation.entry && (!selectedEntry || !selectedEntry.batch_id)) {
        return <Card><CardHeader><CardTitle>{selectedEntry ? 'Legacy production record' : 'Record not found'}</CardTitle><CardDescription>{selectedEntry ? 'This older worker total has no machine sheet. Its saved production and pay remain included.' : 'This record is unavailable in your workspace.'}</CardDescription></CardHeader><CardContent className="space-y-3">{selectedEntry && <p>{workerById.get(selectedEntry.worker_id)?.name ?? 'Worker'} · {formatDateOnly(selectedEntry.production_date)} · {formatMeters(selectedEntry.meters)} · saved rate ₹{selectedEntry.worker_rate_snapshot.toFixed(2)}/m</p>}<Button asChild variant="outline"><Link href="/owner/production">Open daily production</Link></Button></CardContent></Card>
    }

    return (
        <div className="space-y-4">
            {unmatchedDraftMeters && <p role="alert" className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">Some draft metres no longer match the current worker assignments. Restore the assignment in Setup or discard the local draft before saving; no metres have been silently removed.</p>}
            {navigation.job && <p className="rounded-lg border border-saffron/30 bg-saffron-soft p-3 text-sm">Selected job: <strong>{jobById.get(navigation.job)?.quality_label ?? 'Unavailable job'}</strong>. Its machine rows are highlighted; the full shift stays visible.</p>}
            {draftStatus !== 'none' && <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm"><p>{draftStatus === 'local' ? 'Draft saved on this device. Save the shift to confirm production and pay.' : draftStatus === 'conflict' ? 'The saved shift changed after this draft. Your local draft is retained; reload the saved version before editing.' : 'Draft could not be saved on this device. Keep this page open and save the shift before leaving.'}</p><Button variant="outline" size="sm" onClick={() => { if (!window.confirm(tx('Discard this local draft and load the saved shift?'))) return; try { if (draftKey) localStorage.removeItem(draftKey); setDraftReset(value => value + 1) } catch { toast.error('The draft could not be cleared.') } }}>Discard local draft</Button></div>}
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
                            <Input id="base-daily-date" type="date" max={initialData.today} value={productionDate} disabled={isSaving} onChange={(event) => changeSelection(event.target.value, shift)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="base-daily-shift">Shift</Label>
                            <Select value={shift} disabled={isSaving} onValueChange={(value) => changeSelection(productionDate, value as 'day' | 'night')}>
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
                                ? 'All worker entries on this sheet are settled and protected.'
                                : isSavedBatchProtected
                                    ? 'Editing is locked to prevent accidental changes.'
                                    : 'Correction mode is active. Review every changed value before saving.'}
                        </span>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                        {currentBatchRevisions.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => setIsHistoryDialogOpen(true)}>
                                <FileClock className="h-4 w-4" /> {correctionCount > 0 ? `${correctionCount} ${correctionCount === 1 ? 'correction' : 'corrections'}` : 'Saved receipt'}
                            </Button>
                        )}
                        {isSavedBatchProtected && (
                            <Button variant="outline" size="sm" className="border-warning/40" onClick={() => setIsUnlockDialogOpen(true)}>
                                <LockOpen className="h-4 w-4" /> Edit saved log
                            </Button>
                        )}
                    </div>
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
                            <CardDescription className="hidden sm:block">Each machine row is the source entry. Worker pay is calculated automatically from the saved job rate. Press Enter to move to the next machine.</CardDescription>
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
                                        <div key={context.machineId} data-base-highlight={context.workerId === focusedWorker || context.jobId === navigation.job} className="data-[base-highlight=true]:bg-saffron-soft data-[base-highlight=true]:ring-1 data-[base-highlight=true]:ring-inset data-[base-highlight=true]:ring-saffron grid grid-cols-[minmax(0,1fr)_112px] gap-x-3 gap-y-2 px-3 py-3 [contain-intrinsic-size:104px] [content-visibility:auto] md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.25fr)_150px] md:items-center md:px-4 md:py-4">
                                            <div className="min-w-0"><p className="truncate font-semibold text-ink">{context.machineLabel}</p><p className="truncate text-xs text-muted-foreground">{context.machineType.replaceAll('_', ' ')}<span className="md:hidden"> · {context.workerName}{settledWorkerIds.has(context.workerId!) && <span className="block font-semibold">Paid · protected</span>}</span></p></div>
                                            <div className="hidden text-sm text-body md:block"><span className="font-semibold text-ink">{context.workerName}</span><p className="text-xs text-muted-foreground">{settledWorkerIds.has(context.workerId!) ? 'Paid · protected' : toWorkerStatusLabel(row.status)}</p></div>
                                            <div className="min-w-0 md:col-auto">
                                                <div className="flex min-w-0 items-center gap-2"><Badge variant={context.jobId ? 'secondary' : 'warning'} className="max-w-full truncate">{context.jobLabel ?? 'Job not assigned'}</Badge>{context.jobId && <span className="hidden shrink-0 text-xs font-semibold text-body sm:inline">₹{context.ratePerMeter.toFixed(2)}/m</span>}</div>
                                                    {!context.jobId && <Button variant="link" size="sm" onClick={openSetup}>Assign a production job</Button>}
                                            </div>
                                            <Input
                                                aria-label={`${context.machineLabel} ${context.workerName} metres`}
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                inputMode="decimal"
                                                placeholder="Metres"
                                                data-base-machine-meters
                                                value={value}
                                                disabled={row.status === 'zero' || row.status === 'absent' || areInputsDisabled || settledWorkerIds.has(context.workerId!) || !context.jobId}
                                                onChange={(event) => handleMachineMetersChange(context, event.target.value)}
                                                onKeyDown={handleMachineMetersKeyDown}
                                                onFocus={(event) => event.currentTarget.select()}
                                                className="row-span-2 row-start-1 h-11 self-center text-right text-base font-semibold md:col-auto md:row-auto md:h-10 md:text-sm"
                                            />
                                        </div>
                                    )
                                })}
                                {unassignedMachines.map((context) => (
                                    <div key={context.machineId} className="flex items-start gap-2 bg-warning/5 px-4 py-4 text-sm">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                                        <div><p className="font-semibold text-ink">{context.machineLabel} has no worker for this shift</p><p className="text-xs text-body">Assign a worker before entering production so the metres can flow into payroll.</p><Button variant="outline" size="sm" className="mt-2" onClick={openSetup}>Assign worker in Setup</Button></div>
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
                                        <Select value={row.status} onValueChange={(value) => handleStatusChange(worker.id, value as BaseDailyProductionStatus)} disabled={areInputsDisabled || settledWorkerIds.has(worker.id)}>
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
                                            disabled={row.status === 'zero' || row.status === 'absent' || areInputsDisabled || settledWorkerIds.has(worker.id)}
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
                            <p className="text-xs text-body">{summary.outstanding_count} not entered · {summary.zero_count} zero · {summary.absent_count} absent</p>
                        </div>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving || areInputsDisabled || unmatchedDraftMeters || invalidEnteredCount > 0 || summary.entered_count + summary.zero_count + summary.absent_count === 0} className="min-w-[132px] sm:min-w-[210px]">
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
                    <div className="space-y-2">
                        <Label htmlFor="base-correction-reason">Reason for correction</Label>
                        <Textarea
                            id="base-correction-reason"
                            value={correctionReason}
                            onChange={(event) => setCorrectionReason(event.target.value)}
                            maxLength={240}
                            placeholder="Example: Meter reading corrected from the paper shift register"
                            autoFocus
                        />
                        <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                            <span>This explanation stays with the production record.</span>
                            <span>{correctionReason.length}/240</span>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsUnlockDialogOpen(false)}>Keep locked</Button>
                        <Button
                            disabled={correctionReason.trim().length < 3}
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

            <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Production audit trail</DialogTitle>
                        <DialogDescription>
                            Permanent receipts for {formatDateOnly(productionDate)} · {shift === 'day' ? 'Day' : 'Night'} shift. Corrections never overwrite their explanation.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                        {currentBatchRevisions.map((revision) => {
                            const beforeMeters = revision.before_snapshot?.total_meters ?? null
                            const afterMeters = revision.after_snapshot.total_meters
                            const delta = beforeMeters === null ? null : afterMeters - beforeMeters
                            return (
                                <div key={revision.id} className="rounded-lg border border-hairline p-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-ink">{revision.change_kind === 'created' ? 'Original production saved' : `Correction ${revision.revision_number}`}</p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(revision.changed_at)}</p>
                                        </div>
                                        <Badge variant={revision.change_kind === 'created' ? 'secondary' : 'warning'}>{revision.change_kind === 'created' ? 'Original' : 'Corrected'}</Badge>
                                    </div>
                                    {revision.correction_reason && <p className="mt-3 text-sm leading-relaxed text-body">{revision.correction_reason}</p>}
                                    <p className="mt-1 text-xs text-muted-foreground">Changed by {revision.changed_by === initialData.actorId ? 'you' : revision.changed_by ? `owner ${revision.changed_by.slice(0, 8)}` : 'an earlier owner'}</p>
                                    {baseProductionAuditChanges(revision.before_snapshot, revision.after_snapshot).map(change => <div key={change.key} className="mt-2 rounded-md border border-hairline p-2 text-xs"><p className="font-semibold">{workerById.get(change.line.workerId)?.name ?? 'Worker'} · {change.line.machine}{change.line.job ? ` · ${change.line.job}` : ''}</p><p>Metres: {formatMeters(change.before?.meters ?? 0)} → {formatMeters(change.after?.meters ?? 0)}</p><p>Rate: ₹{(change.before?.rate ?? 0).toFixed(2)}/m → ₹{(change.after?.rate ?? 0).toFixed(2)}/m</p><p>Earnings: ₹{(change.before?.pay ?? 0).toFixed(2)} → ₹{(change.after?.pay ?? 0).toFixed(2)}</p><p>Status: {change.before?.status ?? 'Not recorded'} → {change.after?.status ?? 'Removed'}</p></div>)}
                                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-surface-soft px-2.5 py-2 text-xs text-body">
                                        {beforeMeters === null
                                            ? <span><strong className="text-ink">{formatMeters(afterMeters)}</strong> recorded</span>
                                            : <span><strong className="text-ink">{formatMeters(beforeMeters)}</strong> → <strong className="text-ink">{formatMeters(afterMeters)}</strong></span>}
                                        {delta !== null && <span className={delta === 0 ? 'text-muted-foreground' : delta > 0 ? 'text-success' : 'text-warning'}>{delta === 0 ? 'No total change' : `${delta > 0 ? '+' : ''}${formatMeters(delta)}`}</span>}
                                        <span>{revision.after_snapshot.entered_count} produced · {revision.after_snapshot.zero_count} zero · {revision.after_snapshot.absent_count} absent</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)}>Close</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function formatDateTime(value: string) {
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
    }).format(new Date(value))
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
