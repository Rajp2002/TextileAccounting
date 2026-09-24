'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import Link from 'next/link'
import { baseProductionHref, validBaseDate, type BaseProductionNavigation } from '@/lib/base-production-navigation'
import { baseProductionDraftKey, parseBaseProductionDraft } from '@/lib/base-production-draft'
import { baseProductionAuditChanges } from '@/lib/base-production-audit'
import { buildMachineCollectionSheet, compareMachineLabels, machineReadingState, machineWorkerStatus, summarizeMachineRegister } from '@/lib/base-machine-register'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/context'
import { AlertTriangle, ArrowUpRight, CheckCircle2, ChevronDown, Clock3, ClipboardList, FileClock, Loader2, Lock, LockOpen, Plus, Printer, Save, Users } from 'lucide-react'

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
    onOpenHistory,
    navigation = {},
}: {
    initialData: BaseProductionInitialData
    onAddWorker: () => void
    onAddMachine: () => void
    onOpenHistory: () => void
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
    const [showPending, setShowPending] = useState(false)
    const [pendingMachineIds, setPendingMachineIds] = useState<string[]>([])
    const [isReviewOpen, setIsReviewOpen] = useState(false)
    const sheetRef = useRef<HTMLDivElement>(null)
    const [toolbarBounds, setToolbarBounds] = useState<{ left: number; width: number } | null>(null)
    const [draftStatus, setDraftStatus] = useState<'none' | 'local' | 'error' | 'conflict'>('none')
    const [draftReset, setDraftReset] = useState(0)
    const selectedEntry = initialData.entries.find((entry) => entry.id === navigation.entry)
    const focusedWorker = selectedEntry?.worker_id ?? navigation.worker
    const draftKey = initialData.actorId ? baseProductionDraftKey(initialData.orgId, initialData.actorId, productionDate, shift) : null

    useEffect(() => {
        const sheet = sheetRef.current
        if (!sheet) return
        const measure = () => {
            const { left, width } = sheet.getBoundingClientRect()
            setToolbarBounds(previous => previous?.left === left && previous.width === width ? previous : { left, width })
        }
        const observer = new ResizeObserver(measure)
        observer.observe(sheet)
        window.addEventListener('resize', measure)
        measure()
        return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
    }, [])

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
        setShowPending(false)
        setIsReviewOpen(false)
        window.history.replaceState(null, '', baseProductionHref({ ...navigation, date, shift: nextShift, entry: undefined }))
    }

    function openConfiguration() {
        if (draftStatus === 'error' && !window.confirm(tx('This draft could not be saved on this device. Discard these unsaved changes?'))) return
        const params = new URLSearchParams({ shift, returnTo: baseProductionHref({ ...navigation, date: productionDate, shift }) })
        if (focusedWorker) params.set('worker', focusedWorker)
        router.push(`/owner/assignments?${params}`)
    }

    function openMachineJobs() {
        if (draftStatus === 'error' && !window.confirm(tx('This draft could not be saved on this device. Discard these unsaved changes?'))) return
        router.push(`${baseProductionHref({ tab: 'jobs', returnTo: baseProductionHref({ ...navigation, date: productionDate, shift }) })}#machine-jobs`)
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
        const savedWorkerIds = new Set([...currentBatchEntries.map((entry) => entry.worker_id), ...(currentBatch?.machine_records ?? []).map(record => record.worker_id)])
        return initialData.workers.filter((worker) => (
            (worker.pay_type !== 'fixed_monthly' && worker.is_active && (worker.shift_availability === 'both' || worker.shift_availability === shift))
            || savedWorkerIds.has(worker.id)
            || assignedWorkerIds.has(worker.id)
        ))
    }, [assignedWorkerIds, currentBatch, currentBatchEntries, initialData.workers, shift])
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
        const registerByMachine = new Map((currentBatch?.machine_records ?? []).map(record => [record.machine_id, record]))

        return initialData.machines
            .filter((machine) => machine.is_active || savedMachineIds.has(machine.id) || registerByMachine.has(machine.id))
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
                const jobContext = currentJobContexts.get(machine.id)
                const record = registerByMachine.get(machine.id)
                if (record) return {
                    machineId: machine.id, machineLabel: record.machine_label, machineType: machine.machine_type,
                    assignmentId: null, workerId: record.worker_id,
                    workerName: workerById.get(record.worker_id)?.name ?? 'Worker',
                    jobId: record.job_id ?? jobContext?.jobId ?? null, jobLabel: record.job_label ?? jobContext?.jobLabel ?? null,
                    ratePerMeter: record.job_id ? jobById.get(record.job_id)?.worker_rate_per_meter ?? 0 : jobContext?.ratePerMeter ?? 0,
                    rateSource: 'costing',
                }
                const assignment = currentAssignments.get(machine.id)
                const worker = assignment ? workerById.get(assignment.worker_id) ?? null : null
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
            .sort(compareMachineLabels)
    }, [currentBatch, currentBatchEntries, initialData, jobById, productionDate, shift, workerById])

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
            const savedRecords = (currentBatch?.machine_records ?? []).filter(record => record.worker_id === worker.id)
            for (const context of contexts) {
                const record = savedRecords.find(record => record.machine_id === context.machineId)
                if (record?.state === 'not_running' || (savedRecords.length === 0 && existing?.entry_status === 'zero')) {
                    machineMeters[contextKey(context)] = '0'
                }
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
    }, [allocationsByEntry, contextsByWorker, currentBatchEntries, sheetWorkers, draftKey, currentBatch?.client_request_id, currentBatch?.updated_at, currentBatch?.machine_records, draftReset])

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
                return machineReadingState(enteredMeters, row.status) === 'invalid' || (parseMeters(enteredMeters) > 0 && !context.jobId)
            })
        }).length
    const unmatchedDraftMeters = Object.entries(rows).some(([workerId, row]) => {
        const contexts = contextsByWorker.get(workerId) ?? []
        return (!sheetWorkers.some(worker => worker.id === workerId) && parseMeters(row.meters) > 0)
            || Object.entries(row.machineMeters).some(([key, value]) => value.trim() !== '' && !contexts.some(context => contextKey(context) === key))
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
        if (!context.workerId || areInputsDisabled || settledWorkerIds.has(context.workerId)) return
        const current = getRow(context.workerId)
        const machineMeters = { ...current.machineMeters, [contextKey(context)]: value }
        updateRow(context.workerId, {
            machineMeters,
            status: machineWorkerStatus(Object.values(machineMeters)),
        })
    }

    function handleMachineMetersKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
        if (event.key !== 'Enter' && event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        const fields = Array.from(document.querySelectorAll<HTMLInputElement>('[data-base-machine-meters]:not(:disabled)')).filter(field => field.getClientRects().length > 0)
        const currentIndex = fields.indexOf(event.currentTarget)
        const nextField = fields[currentIndex + (event.key === 'ArrowUp' || event.shiftKey ? -1 : 1)]
        event.preventDefault()
        if (!nextField) return
        nextField.focus()
        nextField.select()
    }

    function handleStatusChange(workerId: string, value: BaseDailyProductionStatus) {
        const current = getRow(workerId)
        if (value !== 'entered' && getRowTotal(workerId) > 0 && !window.confirm(tx('Clear all production for this worker? This affects every assigned machine.'))) return
        updateRow(workerId, {
            status: value,
            meters: value === 'entered' ? current.meters : '',
            machineMeters: value === 'entered' ? current.machineMeters : value === 'zero'
                ? Object.fromEntries((contextsByWorker.get(workerId) ?? []).map(context => [contextKey(context), '0'])) : {},
        })
    }

    async function handleSave(confirmed = false) {
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
        if (invalidEnteredCount > 0 || registerSummary.invalid > 0) {
            toast.error('Enter positive metres for every produced machine, and assign a costing before saving.')
            return
        }
        if (summary.entered_count + summary.zero_count + summary.absent_count === 0) {
            toast.error('Enter production or mark at least one worker zero or absent.')
            return
        }
        if (!confirmed && (registerSummary.pending > 0 || summary.outstanding_count > 0)) {
            setIsReviewOpen(true)
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
                        machineRecords: contexts.map(context => ({
                            machineId: context.machineId,
                            state: machineReadingState(row.machineMeters[contextKey(context)], row.status) as 'entered' | 'pending' | 'not_running' | 'absent',
                        })),
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
            setIsReviewOpen(false)
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

    const assignedWorkers = sheetWorkers.filter((worker) => (contextsByWorker.get(worker.id) ?? []).length > 0)
    const unassignedWorkers = sheetWorkers.filter((worker) => (contextsByWorker.get(worker.id) ?? []).length === 0)
    const machineState = (context: MachineContext) => context.workerId
        ? machineReadingState(getRow(context.workerId).machineMeters[contextKey(context)], getRow(context.workerId).status)
        : 'pending' as const
    const registerSummary = summarizeMachineRegister(machineContexts.map(machineState))

    function togglePending() {
        setPendingMachineIds(machineContexts.filter(context => machineState(context) === 'pending' || machineState(context) === 'invalid').map(context => context.machineId))
        setShowPending(!showPending)
    }

    function discardDraft() {
        if (!window.confirm(tx('Discard this local draft and load the saved shift?'))) return
        try {
            if (draftKey) localStorage.removeItem(draftKey)
            setDraftReset(value => value + 1)
        } catch { toast.error('The draft could not be cleared.') }
    }

    function printCollectionSheet() {
        const popup = window.open('', '_blank', 'width=900,height=700')
        if (!popup) { toast.error('Allow pop-ups to open the printable collection sheet.'); return }
        popup.opener = null
        popup.document.open()
        popup.document.write(buildMachineCollectionSheet({
            factory: initialData.factoryName || 'Weavly', date: formatDateOnly(productionDate),
            shift: shift === 'day' ? 'Day' : 'Night', machines: machineContexts,
        }))
        popup.document.close()
        popup.document.getElementById('print-sheet')?.addEventListener('click', () => popup.print())
    }

    if (navigation.entry && (!selectedEntry || !selectedEntry.batch_id)) {
        return (
            <div className="space-y-4">
                <h1 className="text-xl font-black tracking-tight text-ink sm:text-2xl">Daily sheet</h1>
                <Card>
                    <CardHeader>
                        <CardTitle>{selectedEntry ? 'Legacy production record' : 'Record not found'}</CardTitle>
                        <CardDescription>{selectedEntry ? 'This older worker total has no machine sheet. Its saved production and pay remain included.' : 'This record is unavailable in your workspace.'}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {selectedEntry && <p>{workerById.get(selectedEntry.worker_id)?.name ?? 'Worker'} · {formatDateOnly(selectedEntry.production_date)} · {formatMeters(selectedEntry.meters)} · saved rate ₹{selectedEntry.worker_rate_snapshot.toFixed(2)}/m</p>}
                        <Button asChild variant="outline"><Link href="/owner/production">Open daily production</Link></Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="production-daily-sheet-workspace relative min-w-0 pb-28 min-[1380px]:pb-0">
            <aside aria-label="Daily sheet controls" className="production-daily-sheet-rail flex min-w-0 flex-col gap-4">
                <div className="rounded-2xl border border-hairline/80 bg-surface/95 p-4 shadow-[var(--shadow-card)] backdrop-blur-sm 2xl:p-5">
                    <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Shift details</p>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end min-[1380px]:grid-cols-1">
                        <div className="space-y-1.5">
                            <Label htmlFor="base-daily-date" className="text-xs font-bold text-body">Date</Label>
                            <Input id="base-daily-date" type="date" max={initialData.today} value={productionDate} disabled={isSaving} onChange={(event) => changeSelection(event.target.value, shift)} className="h-10 w-full rounded-xl border-hairline bg-surface text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="base-daily-shift" className="text-xs font-bold text-body">Shift</Label>
                            <Select value={shift} disabled={isSaving} onValueChange={(value) => changeSelection(productionDate, value as 'day' | 'night')}>
                                <SelectTrigger id="base-daily-shift" className="h-10 w-full rounded-xl border-hairline bg-surface text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-xl border-hairline bg-surface shadow-lg">
                                    <SelectItem value="day">Day shift</SelectItem>
                                    <SelectItem value="night">Night shift</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button variant="outline" className="h-10 rounded-xl border-hairline bg-surface font-semibold shadow-xs hover:bg-surface-soft min-[1380px]:w-full" onClick={printCollectionSheet} disabled={machineContexts.length === 0}>
                            <Printer className="h-4 w-4" /> Print sheet
                        </Button>
                    </div>
                </div>

                <div className="rounded-2xl border border-hairline/80 bg-surface/95 p-4 shadow-[var(--shadow-card)] backdrop-blur-sm 2xl:p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Shift progress</p>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black tracking-tight tabular-nums text-ink">{registerSummary.accounted}<span className="text-lg text-muted-foreground">/{registerSummary.total}</span></span>
                        <span className="text-xs font-medium text-body">machines accounted for</span>
                    </div>
                    <div role="progressbar" aria-label="Machines accounted for" aria-valuenow={registerSummary.accounted} aria-valuemin={0} aria-valuemax={Math.max(registerSummary.total, 1)} className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-soft">
                        <div className="h-full rounded-full bg-loom transition-[width]" style={{ width: `${registerSummary.total ? registerSummary.accounted / registerSummary.total * 100 : 0}%` }} />
                    </div>
                    <dl className="mt-4 grid grid-cols-2 divide-x divide-hairline border-t border-hairline pt-4">
                        <div className="pr-3"><dt className="text-xs text-muted-foreground">Pending</dt><dd className="mt-1 text-base font-bold tabular-nums text-ink">{registerSummary.pending}</dd></div>
                        <div className="pl-3"><dt className="text-xs text-muted-foreground">Production</dt><dd className="mt-1 text-base font-bold tabular-nums text-ink">{formatMeters(summary.total_meters)}</dd></div>
                    </dl>
                </div>

                <button type="button" onClick={onOpenHistory} className="production-daily-sheet-history-desktop group mt-auto w-full items-center gap-3 rounded-2xl border border-hairline/80 bg-surface/95 p-4 text-left shadow-[var(--shadow-card)] backdrop-blur-sm transition-colors hover:border-saffron hover:bg-saffron-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-saffron-soft text-saffron-deep"><Clock3 className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-ink">Recent production</span><span className="block text-xs text-body">Find a saved shift</span></span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>
            </aside>

            <div ref={sheetRef} className="flex min-w-0 flex-col 2xl:min-h-[calc(100svh-3rem)] 2xl:pb-20">
            {unmatchedDraftMeters && <p role="alert" className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">Some draft metres no longer match the current worker assignments. Restore the assignment in Machine Assignments or discard the local draft before saving; no metres have been silently removed.</p>}
            {navigation.job && <p className="rounded-lg border border-saffron/30 bg-saffron-soft p-3 text-sm">Selected job: <strong>{jobById.get(navigation.job)?.quality_label ?? 'Unavailable job'}</strong>. Its machine rows are highlighted; the full shift stays visible.</p>}
            {(draftStatus === 'error' || draftStatus === 'conflict') && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm"><p>{draftStatus === 'conflict' ? 'The saved shift changed after this draft. Your local draft is retained; reload the saved version before editing.' : 'Draft could not be saved on this device. Keep this page open and save the shift before leaving.'}</p><Button variant="outline" size="sm" onClick={discardDraft}>Discard local draft</Button></div>}
            <div className="border-b border-hairline/70 pb-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-saffron-deep">Production register</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">Daily sheet</h1>
                <p className="mt-1 text-sm text-body">Enter shift metres, not cumulative meter readings. Press Enter or ↓ to move to the next machine.</p>
            </div>

            {currentBatch && (
                <div className={`flex flex-col gap-3 rounded-2xl border px-4 py-3.5 text-xs sm:flex-row sm:items-center sm:justify-between shadow-xs ${isSavedBatchProtected ? 'border-amber-200 bg-amber-50/50' : 'border-emerald-200 bg-emerald-50/50'}`}>
                    <div className="flex items-start gap-2.5 text-body">
                        {isSavedBatchProtected ? <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />}
                        <span className="leading-relaxed">
                            <strong className="font-bold text-ink">{isCurrentBatchLocked ? 'Finalized' : registerSummary.pending > 0 ? 'Saved · incomplete' : 'Saved'}</strong> for {formatDateOnly(productionDate)} · {shift === 'day' ? 'Day' : 'Night'} shift.{' '}
                            {isCurrentBatchLocked
                                ? 'All worker entries on this sheet are settled and protected.'
                                : isSavedBatchProtected
                                    ? 'Editing is locked to prevent accidental changes.'
                                    : 'Correction mode is active. Review every changed value before saving.'}
                        </span>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                        {currentBatchRevisions.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => setIsHistoryDialogOpen(true)} className="h-8 rounded-xl border-hairline hover:bg-surface text-xs font-bold shadow-xs">
                                <FileClock className="h-4 w-4" /> {correctionCount > 0 ? `${correctionCount} ${correctionCount === 1 ? 'correction' : 'corrections'}` : 'Saved receipt'}
                            </Button>
                        )}
                        {isSavedBatchProtected && (
                            <Button variant="outline" size="sm" className="h-8 rounded-xl border-amber-300 bg-surface text-amber-900 hover:bg-amber-100 text-xs font-bold shadow-xs" onClick={() => setIsUnlockDialogOpen(true)}>
                                <LockOpen className="h-4 w-4" /> Edit saved log
                            </Button>
                        )}
                    </div>
                </div>
            )}

            <div className="flex flex-1 flex-col justify-center gap-4 py-5 2xl:py-8">
            {sheetWorkers.length === 0 ? (
                <Card className="rounded-2xl border border-hairline bg-surface shadow-xs">
                    <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                        <Users className="h-10 w-10 text-saffron-deep" />
                        <div>
                            <p className="text-base font-bold text-ink">Add a worker to record production</p>
                            <p className="mt-1 max-w-md text-sm leading-relaxed text-body">Add workers in Workers and choose which shift they are available for.</p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2 pt-2">
                            <Button onClick={onAddWorker} className="rounded-xl bg-loom text-white font-bold shadow-xs hover:bg-loom-elevated"><Plus className="h-4 w-4" /> Add worker</Button>
                            <Button variant="outline" onClick={onAddMachine} className="rounded-xl border-hairline hover:bg-surface-soft font-semibold"><Plus className="h-4 w-4" /> Add machine</Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <Card className="gap-0 overflow-hidden rounded-[22px] border border-hairline border-t-[3px] border-t-saffron-deep bg-surface p-0 shadow-lg shadow-ink/5">
                        <CardHeader className="border-b border-hairline bg-surface px-4 py-4 sm:px-5 sm:py-5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-saffron-soft text-saffron-deep"><ClipboardList className="h-5 w-5" /></span>
                                    <div>
                                        <CardTitle className="text-lg font-bold tracking-tight text-ink">Machine sheet</CardTitle>
                                        <p className="text-xs text-muted-foreground">{machineContexts.length} {machineContexts.length === 1 ? 'machine' : 'machines'} on this shift</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {draftStatus === 'local' && <Button variant="ghost" size="sm" disabled={isSaving} onClick={discardDraft} className="h-8 rounded-xl text-xs font-semibold text-muted-foreground hover:text-ink">Discard draft</Button>}
                                    {(registerSummary.pending + registerSummary.invalid > 0 || showPending) && <Button variant="outline" size="sm" aria-pressed={showPending} onClick={togglePending} className="h-8 rounded-xl border-hairline bg-surface text-xs font-semibold hover:bg-surface-soft shadow-xs">{showPending ? 'Show all machines' : `Show pending (${registerSummary.pending + registerSummary.invalid})`}</Button>}
                                </div>
                            </div>
                            <CardDescription className="text-xs text-body">Leave a reading blank if it is pending. Enter 0 if the machine did not run.</CardDescription>
                            {showPending && <p className="text-xs text-body font-medium">Showing machines that needed attention when you opened this view. Rows stay in place as you type.</p>}
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,.8fr)_145px_160px] gap-3 border-b border-hairline bg-surface-soft/70 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground md:grid">
                                <span>Machine / job</span><span>Worker</span><span className="text-right">Metres</span><span>Status / action</span>
                            </div>
                            <div role="region" aria-label="Machine readings" className="divide-y divide-hairline overflow-y-auto overscroll-contain lg:max-h-[max(14rem,calc(100svh-30rem))]">
                                {machineContexts.map((context, index) => {
                                    if (showPending && !pendingMachineIds.includes(context.machineId)) return null
                                    if (!context.workerId) return (
                                        <div key={context.machineId} className="flex flex-wrap items-center justify-between gap-3 bg-amber-50/40 px-4 py-3 text-sm">
                                            <div><p className="font-bold text-ink">{context.machineLabel}</p><p className="text-xs text-body">Pending · assign a worker before entering production.</p></div>
                                            <Button variant="outline" size="sm" onClick={openConfiguration} className="rounded-xl border-hairline bg-surface text-xs font-semibold hover:bg-surface-soft shadow-xs">Assign worker in Machine Assignments</Button>
                                        </div>
                                    )
                                    const row = getRow(context.workerId!)
                                    const value = row.machineMeters[contextKey(context)] ?? ''
                                    const state = machineState(context)
                                    const disabled = areInputsDisabled || settledWorkerIds.has(context.workerId!)
                                    return (
                                        <div key={context.machineId} data-base-highlight={context.workerId === focusedWorker || context.jobId === navigation.job} className="data-[base-highlight=true]:bg-saffron-soft/60 data-[base-highlight=true]:ring-1 data-[base-highlight=true]:ring-inset data-[base-highlight=true]:ring-saffron grid grid-cols-[minmax(0,1fr)_132px] items-center gap-x-3 gap-y-2 px-4 py-3.5 transition-colors focus-within:bg-saffron-soft/30 hover:bg-surface-soft/40 md:grid-cols-[minmax(0,1.1fr)_minmax(0,.8fr)_145px_160px] md:px-5">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-soft text-xs font-bold tabular-nums text-muted-foreground sm:flex">{String(index + 1).padStart(2, '0')}</span>
                                                <div className="min-w-0">
                                                    <p className="truncate font-bold text-ink">{context.machineLabel}</p>
                                                    <p className="truncate text-xs text-muted-foreground">{context.jobLabel ?? 'Job not assigned'}</p>
                                                    <p className="text-xs text-body md:hidden">{context.workerName}</p>
                                                </div>
                                            </div>
                                            <div className="hidden text-sm text-body md:block">
                                                <span className="font-semibold text-ink">{context.workerName}</span>
                                                {settledWorkerIds.has(context.workerId!) && <p className="text-xs text-muted-foreground">Paid · protected</p>}
                                            </div>
                                            <div className="col-start-2 row-start-1 md:col-auto md:row-auto">
                                                <Input
                                                    aria-label={`${context.machineLabel} ${context.workerName} metres`}
                                                    aria-invalid={state === 'invalid'}
                                                    aria-describedby={state === 'invalid' ? `reading-error-${context.machineId}` : undefined}
                                                    type="text"
                                                    inputMode="decimal"
                                                    enterKeyHint="next"
                                                    autoComplete="off"
                                                    placeholder="Metres"
                                                    data-base-machine-meters
                                                    value={value}
                                                    disabled={row.status === 'absent' || disabled || !context.jobId}
                                                    onChange={(event) => handleMachineMetersChange(context, event.target.value)}
                                                    onKeyDown={handleMachineMetersKeyDown}
                                                    onFocus={(event) => { event.currentTarget.select(); event.currentTarget.scrollIntoView({ block: 'nearest' }) }}
                                                    className="h-11 scroll-mb-56 scroll-mt-8 rounded-xl border-hairline bg-surface text-right text-base font-bold tabular-nums text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom md:h-10"
                                                />
                                                {state === 'invalid' && <p id={`reading-error-${context.machineId}`} className="mt-1 text-xs font-semibold text-destructive">Use 0–100,000, up to 2 decimals.</p>}
                                            </div>
                                            <div className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs md:col-span-1 md:flex-col md:items-start">
                                                <span className={`inline-flex rounded-full px-2 py-0.5 font-bold ${state === 'entered' ? 'bg-emerald-50 text-emerald-700' : state === 'pending' || state === 'invalid' ? 'bg-amber-50 text-amber-800' : 'bg-surface-soft text-body'}`}>{state === 'entered' ? 'Entered' : state === 'not_running' ? 'Not running' : state === 'absent' ? 'Worker absent' : state === 'invalid' ? 'Check reading' : 'Pending'}</span>
                                                {!disabled && row.status !== 'absent' && (
                                                    <Button type="button" variant="ghost" size="sm" aria-label={`${state === 'not_running' ? 'Clear' : 'Mark not running'} ${context.machineLabel}`} onClick={() => {
                                                        if (state === 'entered' && !window.confirm(tx('Replace this machine’s production with zero?'))) return
                                                        handleMachineMetersChange(context, state === 'not_running' ? '' : '0')
                                                    }} className="h-7 rounded-lg px-2 text-xs text-muted-foreground hover:text-ink">{state === 'not_running' ? 'Undo' : 'Not running'}</Button>
                                                )}
                                                {!context.jobId && <Button variant="link" size="sm" onClick={openMachineJobs} className="h-7 px-1 text-xs font-bold text-loom hover:underline">Assign a production job</Button>}
                                            </div>
                                        </div>
                                    )
                                })}
                                {showPending && pendingMachineIds.length === 0 && <p className="px-4 py-8 text-center text-sm text-body">All machines are accounted for.</p>}
                                {machineContexts.length === 0 && <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-sm text-body"><p>No active machines are available for this shift. Add a machine and assign a worker first.</p><Button variant="outline" size="sm" onClick={onAddMachine} className="rounded-xl border-hairline hover:bg-surface-soft font-semibold"><Plus className="h-4 w-4" /> Add machine</Button></div>}
                            </div>
                        </CardContent>
                    </Card>

                    {(assignedWorkers.length > 0 || unassignedWorkers.length > 0) && <Card className="gap-0 overflow-hidden rounded-2xl border border-hairline bg-surface p-0 shadow-xs">
                        <CardHeader className="border-b border-hairline bg-surface-soft/30 p-0">
                            <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
                                <div className="min-w-0">
                                    <CardTitle className="text-sm font-bold text-ink">Worker review</CardTitle>
                                    <CardDescription className="mt-0.5 text-xs text-muted-foreground">Check totals and pay, or mark a worker zero or absent.</CardDescription>
                                </div>
                                <Button type="button" variant="ghost" size="sm" aria-expanded={isPayrollExpanded} aria-controls="base-payroll-rollup" onClick={() => setIsPayrollExpanded((current) => !current)} className="h-8 shrink-0 rounded-xl border border-hairline bg-surface text-xs font-semibold shadow-xs hover:bg-surface-soft">
                                    {isPayrollExpanded ? 'Hide' : 'Review'}
                                    <ChevronDown className={`h-4 w-4 transition-transform ${isPayrollExpanded ? 'rotate-180' : ''}`} />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent id="base-payroll-rollup" className={`${isPayrollExpanded ? 'block' : 'hidden'} divide-y divide-hairline p-0`}>
                            {assignedWorkers.map((worker) => {
                                const row = getRow(worker.id)
                                const contexts = contextsByWorker.get(worker.id) ?? []
                                const rowTotal = getRowTotal(worker.id)
                                const rowGrossPay = getRowGrossPay(worker.id)
                                return (
                                    <div key={worker.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_150px_160px] md:items-center">
                                        <div className="min-w-0">
                                            <p className="font-bold text-ink">{worker.name}{!worker.is_active && <span className="ml-1 text-xs font-normal text-muted-foreground">· inactive</span>}</p>
                                            <p className="text-xs text-muted-foreground">{contexts.length > 0 ? `${contexts.length} machine${contexts.length === 1 ? '' : 's'} · weaver rates applied` : 'No current machine assignment'}</p>
                                        </div>
                                        <div className="text-sm text-body">{contexts.length > 0 ? contexts.map((context) => <span key={context.machineId} className="mr-1 inline-flex"><Badge variant="outline" className="border-hairline bg-surface text-xs font-semibold">{context.machineLabel}</Badge></span>) : <span className="text-xs font-semibold text-warning">Unassigned worker entry</span>}</div>
                                        <Select value={row.status} onValueChange={(value) => handleStatusChange(worker.id, value as BaseDailyProductionStatus)} disabled={areInputsDisabled || settledWorkerIds.has(worker.id)}>
                                            <SelectTrigger className="h-10 w-full rounded-xl border-hairline bg-surface text-xs font-bold text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom" aria-label={`${worker.name} status`}><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-xl border-hairline bg-surface shadow-lg">
                                                <SelectItem value="blank">Not entered</SelectItem>
                                                <SelectItem value="entered">Produced</SelectItem>
                                                <SelectItem value="zero">Zero output</SelectItem>
                                                <SelectItem value="absent">Absent / no production</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <div className="text-left md:text-right">
                                            <p className="text-sm sm:text-base font-black text-ink">{formatMeters(rowTotal)}</p>
                                            <p className="text-xs font-semibold text-muted-foreground">{formatINR(rowGrossPay)}</p>
                                        </div>
                                        {row.savedUnallocatedMeters !== null && <div className="md:col-span-4 rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs text-body"><AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-warning" /> Previously saved as {formatMeters(row.savedUnallocatedMeters)} without an exact machine split. Enter the machine allocation before saving this correction.</div>}
                                    </div>
                                )
                            })}
                            {unassignedWorkers.map((worker) => {
                                const row = getRow(worker.id)
                                return (
                                    <div key={`${worker.id}-unassigned`} className="grid gap-3 bg-amber-50/30 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_150px_160px] md:items-center">
                                        <div><p className="font-bold text-ink">{worker.name}</p><p className="text-xs text-muted-foreground">No active machine assignment · no weaver rate</p></div>
                                        <div className="flex items-start gap-2 text-xs text-body"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />Assign a machine and production job before recording output so pay and job reporting are allocated correctly.</div>
                                        <span className="text-xs font-semibold text-muted-foreground">{toWorkerStatusLabel(row.status)}</span>
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
                                            className="h-10 rounded-xl border-hairline bg-surface text-right text-sm font-bold tabular-nums text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom"
                                        />
                                    </div>
                                )
                            })}
                        </CardContent>
                    </Card>}
                </>
            )}
            </div>

            {sheetWorkers.length > 0 && (
                <div style={toolbarBounds ? { position: 'fixed', left: toolbarBounds.left, width: toolbarBounds.width } : undefined} className="sticky bottom-[calc(80px+env(safe-area-inset-bottom,0px))] z-20 flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface/95 p-3 sm:p-4 shadow-xl backdrop-blur md:bottom-3">
                    <div className="flex items-center gap-3 text-sm">
                        <div className="hidden rounded-xl border border-hairline bg-surface-soft p-2.5 text-ink sm:block"><Save className="h-4 w-4" /></div>
                        <div>
                            <p className="text-sm font-bold text-ink">{registerSummary.accounted}/{registerSummary.total} machines accounted for · {formatMeters(summary.total_meters)}</p>
                            <p role="status" className="min-h-4 text-xs font-medium text-body">
                                {draftStatus === 'local' ? 'Draft saved on this device' : currentBatch ? 'Saved shift' : 'Not submitted'}
                                {registerSummary.pending > 0 ? ` · ${registerSummary.pending} pending` : ''}
                                {registerSummary.stopped > 0 ? ` · ${registerSummary.stopped} not running` : ''}
                                {registerSummary.invalid > 0 ? ` · ${registerSummary.invalid} to check` : ''}
                            </p>
                        </div>
                    </div>
                    <Button onClick={() => handleSave()} disabled={isSaving || areInputsDisabled || unmatchedDraftMeters || invalidEnteredCount > 0 || registerSummary.invalid > 0 || summary.entered_count + summary.zero_count + summary.absent_count === 0} className="h-10 sm:h-11 min-w-[132px] sm:min-w-[160px] rounded-xl bg-loom hover:bg-loom-elevated text-white font-bold tracking-wide shadow-xs">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        <span>{isSaving ? 'Saving…' : currentBatch ? 'Save correction' : 'Save shift'}</span>
                    </Button>
                </div>
            )}
            </div>

            <button type="button" onClick={onOpenHistory} className="production-daily-sheet-history-mobile mt-4 w-full items-center gap-3 rounded-2xl border border-hairline bg-surface p-4 text-left shadow-sm transition-colors hover:border-saffron hover:bg-saffron-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron">
                <Clock3 className="h-5 w-5 shrink-0 text-saffron-deep" />
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-ink">Recent production</span><span className="block text-xs text-body">Find a saved shift</span></span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>

            <Dialog open={isReviewOpen} onOpenChange={open => { if (!isSaving) setIsReviewOpen(open) }}>
                <DialogContent className="max-w-md rounded-2xl border border-hairline bg-surface p-6 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-ink">Save an incomplete shift?</DialogTitle>
                        <DialogDescription className="text-sm text-body">{registerSummary.pending} machines and {summary.outstanding_count} worker rows still have missing readings. Blank readings stay pending, not zero. Entered production will count towards worker pay.</DialogDescription>
                    </DialogHeader>
                    <p className="rounded-xl border border-hairline bg-surface-soft/60 p-3 text-sm font-semibold text-ink">{formatDateOnly(productionDate)} · {shift === 'day' ? 'Day' : 'Night'} · {formatMeters(summary.total_meters)}</p>
                    <DialogFooter className="pt-2">
                        <Button variant="outline" disabled={isSaving} onClick={() => setIsReviewOpen(false)} className="rounded-xl border-hairline hover:bg-surface-soft font-semibold">Keep entering</Button>
                        <Button disabled={isSaving} onClick={() => handleSave(true)} className="rounded-xl bg-loom text-white font-bold shadow-xs hover:bg-loom-elevated">{isSaving ? 'Saving…' : 'Save incomplete shift'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isUnlockDialogOpen} onOpenChange={setIsUnlockDialogOpen}>
                <DialogContent className="max-w-md rounded-2xl border border-hairline bg-surface p-6 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-ink">Edit this saved production log?</DialogTitle>
                        <DialogDescription className="text-sm text-body">
                            This sheet is already saved for {formatDateOnly(productionDate)} · {shift === 'day' ? 'Day' : 'Night'} shift. Any correction can change production totals and worker payroll.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-xs leading-relaxed text-body">
                        Check the machine, worker, and metres carefully. Editing stays unlocked only for this saved shift and locks again after you save.
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="base-correction-reason" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reason for correction</Label>
                        <Textarea
                            id="base-correction-reason"
                            value={correctionReason}
                            onChange={(event) => setCorrectionReason(event.target.value)}
                            maxLength={240}
                            placeholder="Example: Meter reading corrected from the paper shift register"
                            autoFocus
                            className="rounded-xl border-hairline bg-surface text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom"
                        />
                        <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                            <span>This explanation stays with the production record.</span>
                            <span>{correctionReason.length}/240</span>
                        </div>
                    </div>
                    <DialogFooter className="pt-2">
                        <Button variant="outline" onClick={() => setIsUnlockDialogOpen(false)} className="rounded-xl border-hairline hover:bg-surface-soft font-semibold">Keep locked</Button>
                        <Button
                            disabled={correctionReason.trim().length < 3}
                            onClick={() => {
                                if (!currentBatch || isCurrentBatchLocked) return
                                setUnlockedBatchId(currentBatch.id)
                                setIsUnlockDialogOpen(false)
                            }}
                            className="rounded-xl bg-loom text-white font-bold shadow-xs hover:bg-loom-elevated"
                        >
                            <LockOpen className="h-4 w-4" /> Unlock editing
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
                <DialogContent className="max-w-lg rounded-2xl border border-hairline bg-surface p-6 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-ink">Production audit trail</DialogTitle>
                        <DialogDescription className="text-sm text-body">
                            Permanent receipts for {formatDateOnly(productionDate)} · {shift === 'day' ? 'Day' : 'Night'} shift. Corrections never overwrite their explanation.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                        {currentBatchRevisions.map((revision) => {
                            const beforeMeters = revision.before_snapshot?.total_meters ?? null
                            const afterMeters = revision.after_snapshot.total_meters
                            const delta = beforeMeters === null ? null : afterMeters - beforeMeters
                            return (
                                <div key={revision.id} className="rounded-xl border border-hairline bg-surface p-3.5 shadow-xs">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-bold text-ink">{revision.change_kind === 'created' ? 'Original production saved' : `Correction ${revision.revision_number}`}</p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(revision.changed_at)}</p>
                                        </div>
                                        <Badge variant={revision.change_kind === 'created' ? 'secondary' : 'warning'} className="font-bold text-[10px]">{revision.change_kind === 'created' ? 'Original' : 'Corrected'}</Badge>
                                    </div>
                                    {revision.correction_reason && <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-body">{revision.correction_reason}</p>}
                                    <p className="mt-1 text-xs text-muted-foreground">Changed by {revision.changed_by === initialData.actorId ? 'you' : revision.changed_by ? `owner ${revision.changed_by.slice(0, 8)}` : 'an earlier owner'}</p>
                                    {baseProductionAuditChanges(revision.before_snapshot, revision.after_snapshot).map(change => <div key={change.key} className="mt-2 rounded-lg border border-hairline bg-surface-soft/40 p-2.5 text-xs"><p className="font-bold text-ink">{workerById.get(change.line.workerId)?.name ?? 'Worker'} · {change.line.machine}{change.line.job ? ` · ${change.line.job}` : ''}</p><p className="mt-0.5 text-body">Metres: {formatMeters(change.before?.meters ?? 0)} → {formatMeters(change.after?.meters ?? 0)}</p><p className="text-body">Rate: ₹{(change.before?.rate ?? 0).toFixed(2)}/m → ₹{(change.after?.rate ?? 0).toFixed(2)}/m</p><p className="text-body">Earnings: ₹{(change.before?.pay ?? 0).toFixed(2)} → ₹{(change.after?.pay ?? 0).toFixed(2)}</p><p className="text-body">Status: {change.before?.status ?? 'Not recorded'} → {change.after?.status ?? 'Removed'}</p></div>)}
                                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-surface-soft px-3 py-2 text-xs text-body font-medium">
                                        {beforeMeters === null
                                            ? <span><strong className="font-black text-ink">{formatMeters(afterMeters)}</strong> recorded</span>
                                            : <span><strong className="font-black text-ink">{formatMeters(beforeMeters)}</strong> → <strong className="font-black text-ink">{formatMeters(afterMeters)}</strong></span>}
                                        {delta !== null && <span className={delta === 0 ? 'text-muted-foreground font-bold' : delta > 0 ? 'text-success font-bold' : 'text-warning font-bold'}>{delta === 0 ? 'No total change' : `${delta > 0 ? '+' : ''}${formatMeters(delta)}`}</span>}
                                        <span>{revision.after_snapshot.entered_count} produced · {revision.after_snapshot.zero_count} zero · {revision.after_snapshot.absent_count} absent</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <DialogFooter className="pt-2"><Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)} className="rounded-xl border-hairline hover:bg-surface-soft font-semibold">Close</Button></DialogFooter>
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
