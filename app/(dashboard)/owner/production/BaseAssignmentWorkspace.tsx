'use client'

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BriefcaseBusiness, Check, Edit3, Link2, Loader2, Search, Unlink, Users, Wrench } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { BaseProductionMachine, BaseProductionShift, BaseProductionWorker, BaseWorkerMachineAssignment } from '@/lib/base-production-core'
import {
    removeBaseWorkerMachineAssignment,
    setBaseMachineJobContext,
    upsertBaseWorkerMachineAssignment,
} from './actions'
import type { BaseProductionInitialData } from './loaders'

function formatMachineType(value: string) {
    return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getActionError(result: unknown) {
    if (!result || typeof result !== 'object' || !('error' in result)) return null
    const error = (result as { error?: unknown }).error
    return typeof error === 'string' ? error : 'The assignment action could not be completed.'
}

function isEffectiveOnDate(effectiveFrom: string, effectiveTo: string | null, date: string) {
    return effectiveFrom <= date && (!effectiveTo || effectiveTo >= date)
}

function machineLabel(machine: BaseProductionMachine) {
    return machine.custom_label || machine.name
}

function formatWorkerShift(value: BaseProductionWorker['shift_availability']) {
    if (value === 'both') return 'Day & night'
    return value === 'day' ? 'Day shift' : 'Night shift'
}

type ConnectorPoint = { x: number; y: number }
type ConnectorPositions = {
    workers: Record<string, ConnectorPoint>
    machines: Record<string, ConnectorPoint>
}

function connectorPath(from: ConnectorPoint, to: ConnectorPoint, lane: number) {
    const distance = Math.max(48, to.x - from.x)
    const bend = Math.max(28, distance * 0.38)
    const laneOffset = lane * 7
    return `M ${from.x} ${from.y} C ${from.x + bend} ${from.y + laneOffset}, ${to.x - bend} ${to.y + laneOffset}, ${to.x} ${to.y}`
}

export default function BaseAssignmentWorkspace({
    initialData,
    onEditWorker,
    onEditMachine,
}: {
    initialData: BaseProductionInitialData
    onEditWorker: (worker: BaseProductionWorker) => void
    onEditMachine: (machine: BaseProductionMachine) => void
}) {
    const router = useRouter()
    const [shift, setShift] = useState<BaseProductionShift>('day')
    const [workerSearch, setWorkerSearch] = useState('')
    const [selectedMachineTypes, setSelectedMachineTypes] = useState<string[]>([])
    const [showInactive, setShowInactive] = useState(false)
    const [draggingWorkerId, setDraggingWorkerId] = useState<string | null>(null)
    const [dragPoint, setDragPoint] = useState<ConnectorPoint | null>(null)
    const [hoveredMachineId, setHoveredMachineId] = useState<string | null>(null)
    const [connectorPositions, setConnectorPositions] = useState<ConnectorPositions>({ workers: {}, machines: {} })
    const [pickerWorkerId, setPickerWorkerId] = useState<string | null>(null)
    const [pendingKey, setPendingKey] = useState<string | null>(null)
    const boardRef = useRef<HTMLDivElement>(null)

    const workerById = useMemo(
        () => new Map(initialData.workers.map((worker) => [worker.id, worker])),
        [initialData.workers],
    )
    const machineById = useMemo(
        () => new Map(initialData.machines.map((machine) => [machine.id, machine])),
        [initialData.machines],
    )
    const currentAssignments = useMemo(
        () => initialData.assignments.filter((assignment) => assignment.shift === shift && assignment.active && isEffectiveOnDate(assignment.effective_from, assignment.effective_to, initialData.today)),
        [initialData.assignments, initialData.today, shift],
    )
    const assignmentByWorker = useMemo(() => {
        const result = new Map<string, typeof currentAssignments>()
        for (const assignment of currentAssignments) {
            result.set(assignment.worker_id, [...(result.get(assignment.worker_id) ?? []), assignment])
        }
        return result
    }, [currentAssignments])
    const assignmentByMachine = useMemo(
        () => new Map(currentAssignments.map((assignment) => [assignment.machine_id, assignment])),
        [currentAssignments],
    )
    const activeJobs = useMemo(
        () => initialData.jobs.filter((job) => job.status === 'planned' || job.status === 'active'),
        [initialData.jobs],
    )
    const activeJobIds = useMemo(() => new Set(activeJobs.map((job) => job.id)), [activeJobs])
    const currentJobByMachine = useMemo(() => {
        const result = new Map<string, string>()
        for (const context of initialData.machineJobContexts) {
            if (!context.active || !isEffectiveOnDate(context.effective_from, context.effective_to, initialData.today)) continue
            if (!activeJobIds.has(context.job_id)) continue
            if (!result.has(context.machine_id)) result.set(context.machine_id, context.job_id)
        }
        return result
    }, [activeJobIds, initialData.machineJobContexts, initialData.today])

    const visibleWorkers = useMemo(() => initialData.workers.filter((worker) => {
        if (!showInactive && !worker.is_active) return false
        const isAvailable = worker.shift_availability === 'both' || worker.shift_availability === shift
        if (!isAvailable && !assignmentByWorker.has(worker.id)) return false
        return worker.name.toLowerCase().includes(workerSearch.trim().toLowerCase())
    }), [assignmentByWorker, initialData.workers, shift, showInactive, workerSearch])
    const machineTypes = useMemo(() => Array.from(new Set(
        initialData.machines
            .filter((machine) => showInactive || machine.is_active)
            .map((machine) => machine.machine_type),
    )).sort((left, right) => formatMachineType(left).localeCompare(formatMachineType(right))), [initialData.machines, showInactive])
    const visibleMachines = useMemo(() => initialData.machines.filter((machine) => {
        if (!showInactive && !machine.is_active) return false
        return selectedMachineTypes.length === 0 || selectedMachineTypes.includes(machine.machine_type)
    }), [initialData.machines, selectedMachineTypes, showInactive])
    const selectableMachines = useMemo(
        () => initialData.machines.filter((machine) => machine.is_active && (selectedMachineTypes.length === 0 || selectedMachineTypes.includes(machine.machine_type))),
        [initialData.machines, selectedMachineTypes],
    )
    const pickerWorker = pickerWorkerId ? workerById.get(pickerWorkerId) : null

    const updateConnectorPositions = useCallback(() => {
        const board = boardRef.current
        if (!board) return
        const boardRect = board.getBoundingClientRect()
        const workers: Record<string, ConnectorPoint> = {}
        const machines: Record<string, ConnectorPoint> = {}

        board.querySelectorAll<HTMLElement>('[data-worker-handle]').forEach((node) => {
            const id = node.dataset.workerHandle
            if (!id) return
            const rect = node.getBoundingClientRect()
            workers[id] = { x: rect.right - boardRect.left, y: rect.top + rect.height / 2 - boardRect.top }
        })
        board.querySelectorAll<HTMLElement>('[data-machine-handle]').forEach((node) => {
            const id = node.dataset.machineHandle
            if (!id) return
            const rect = node.getBoundingClientRect()
            machines[id] = { x: rect.left - boardRect.left, y: rect.top + rect.height / 2 - boardRect.top }
        })
        setConnectorPositions({ workers, machines })
    }, [])

    useLayoutEffect(() => {
        updateConnectorPositions()
        const board = boardRef.current
        if (!board || typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(updateConnectorPositions)
        observer.observe(board)
        window.addEventListener('resize', updateConnectorPositions)
        return () => {
            observer.disconnect()
            window.removeEventListener('resize', updateConnectorPositions)
        }
    }, [currentAssignments, updateConnectorPositions, visibleMachines, visibleWorkers])

    function boardPoint(clientX: number, clientY: number) {
        const rect = boardRef.current?.getBoundingClientRect()
        return rect ? { x: clientX - rect.left, y: clientY - rect.top } : null
    }

    function machineAtPoint(clientX: number, clientY: number) {
        const target = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-machine-node]')
        const machineId = target?.dataset.machineNode ?? null
        return machineId && machineById.get(machineId)?.is_active ? machineId : null
    }

    function handleConnectorPointerDown(event: ReactPointerEvent<HTMLElement>, workerId: string) {
        if (pendingKey || !workerById.get(workerId)?.is_active) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        setDraggingWorkerId(workerId)
        setDragPoint(boardPoint(event.clientX, event.clientY))
    }

    function handleConnectorPointerMove(event: ReactPointerEvent<HTMLElement>) {
        if (!draggingWorkerId) return
        event.preventDefault()
        setDragPoint(boardPoint(event.clientX, event.clientY))
        setHoveredMachineId(machineAtPoint(event.clientX, event.clientY))
    }

    function finishConnectorDrag(event: ReactPointerEvent<HTMLElement>) {
        if (!draggingWorkerId) return
        const workerId = draggingWorkerId
        const machineId = machineAtPoint(event.clientX, event.clientY)
        setDraggingWorkerId(null)
        setDragPoint(null)
        setHoveredMachineId(null)
        if (machineId) void handleAssign(workerId, machineId)
    }

    function toggleMachineType(machineType: string) {
        setSelectedMachineTypes((current) => current.includes(machineType)
            ? current.filter((value) => value !== machineType)
            : [...current, machineType])
    }

    async function handleAssign(workerId: string, machineId: string, replaceExisting = false) {
        const key = `assign-${workerId}-${machineId}`
        if (pendingKey) return
        const previousAssignment = assignmentByMachine.get(machineId)
        setPendingKey(key)
        try {
            let result = await upsertBaseWorkerMachineAssignment({
                workerId,
                machineId,
                shift,
                effectiveFrom: initialData.today,
                replaceExisting,
            })
            const conflict = result && typeof result === 'object' && 'conflict' in result && (result as { conflict?: boolean }).conflict
            if (conflict && !replaceExisting) {
                const currentWorker = (result as { currentWorkerName?: string }).currentWorkerName ?? 'Another worker'
                const confirmed = window.confirm(`${currentWorker} is already assigned to this machine for the ${shift} shift. Replace that primary assignment?`)
                if (!confirmed) return
                result = await upsertBaseWorkerMachineAssignment({
                    workerId,
                    machineId,
                    shift,
                    effectiveFrom: initialData.today,
                    replaceExisting: true,
                })
            }
            const error = getActionError(result)
            if (error) {
                toast.error(error)
                return
            }
            const assignmentId = result && typeof result === 'object' && 'assignmentId' in result
                ? (result as { assignmentId?: string | null }).assignmentId
                : null
            const changedAssignment = Boolean(assignmentId && (!previousAssignment || previousAssignment.worker_id !== workerId))
            toast.success(conflict ? 'Primary worker replaced.' : 'Worker assigned.', changedAssignment && assignmentId ? {
                action: {
                    label: 'Undo',
                    onClick: () => void handleUndoAssignment(assignmentId, previousAssignment),
                },
            } : undefined)
            setPickerWorkerId(null)
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'The assignment action could not be completed.')
        } finally {
            setPendingKey(null)
            setDraggingWorkerId(null)
        }
    }

    async function handleUndoAssignment(
        assignmentId: string,
        previousAssignment: BaseWorkerMachineAssignment | undefined,
    ) {
        if (pendingKey) return
        setPendingKey(`undo-${assignmentId}`)
        try {
            const removeResult = await removeBaseWorkerMachineAssignment({ assignmentId })
            const removeError = getActionError(removeResult)
            if (removeError) {
                toast.error(removeError)
                return
            }

            if (previousAssignment) {
                const restoreResult = await upsertBaseWorkerMachineAssignment({
                    workerId: previousAssignment.worker_id,
                    machineId: previousAssignment.machine_id,
                    shift: previousAssignment.shift,
                    effectiveFrom: previousAssignment.effective_from,
                    replaceExisting: true,
                })
                const restoreError = getActionError(restoreResult)
                if (restoreError) {
                    toast.error(restoreError)
                    return
                }
            }

            toast.success(previousAssignment ? 'Previous assignment restored.' : 'Assignment undone.')
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'The assignment could not be undone.')
        } finally {
            setPendingKey(null)
        }
    }

    async function handleRemove(assignmentId: string) {
        if (pendingKey) return
        setPendingKey(`remove-${assignmentId}`)
        try {
            const result = await removeBaseWorkerMachineAssignment({ assignmentId })
            const error = getActionError(result)
            if (error) {
                toast.error(error)
                return
            }
            toast.success('Assignment removed.')
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'The assignment could not be removed.')
        } finally {
            setPendingKey(null)
        }
    }

    async function handleContextChange(machineId: string, value: string) {
        if (pendingKey) return
        setPendingKey(`context-${machineId}`)
        try {
            const result = await setBaseMachineJobContext({
                machineId,
                jobId: value === 'none' ? null : value,
                effectiveFrom: initialData.today,
            })
            const error = getActionError(result)
            if (error) {
                toast.error(error)
                return
            }
            toast.success(value === 'none' ? 'Job context cleared.' : 'Machine job context saved.')
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Machine job context could not be saved.')
        } finally {
            setPendingKey(null)
        }
    }

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-bold text-ink">Worker and machine assignments</h2>
                <p className="text-sm text-body">Set the current context once. Daily production will show it automatically.</p>
            </div>

            <Card className="border-saffron/20 bg-saffron-soft/20">
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-sm font-bold text-ink">Primary meter worker · {shift === 'day' ? 'Day' : 'Night'} shift</p>
                        <p className="mt-1 text-xs leading-relaxed text-body">A worker can connect to more than one machine. Each machine has one primary Base worker for this shift.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Label htmlFor="base-assignment-shift" className="text-xs">View shift</Label>
                        <Select value={shift} onValueChange={(value) => setShift(value as BaseProductionShift)}>
                            <SelectTrigger id="base-assignment-shift" className="w-[140px]"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="day">Day shift</SelectItem><SelectItem value="night">Night shift</SelectItem></SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-sm text-body"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} /> Show inactive records</label>
                <Badge variant="secondary"><Link2 className="h-3 w-3" /> {currentAssignments.length} current assignment{currentAssignments.length === 1 ? '' : 's'}</Badge>
            </div>

            <Card className="hidden overflow-hidden md:block">
                <CardHeader className="border-b border-hairline/70">
                    <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4 text-saffron-deep" /> Connect workers to machines</CardTitle>
                    <CardDescription>Drag a worker connector onto a machine. The line follows your pointer, then reroutes automatically after saving. Assign remains available for keyboard use.</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                    <div className="mb-3 grid grid-cols-2 gap-4">
                        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={workerSearch} onChange={(event) => setWorkerSearch(event.target.value)} placeholder="Search workers" className="pl-9" /></div>
                        <MachineTypeFilters machineTypes={machineTypes} selected={selectedMachineTypes} onToggle={toggleMachineType} onShowAll={() => setSelectedMachineTypes([])} />
                    </div>
                    <div ref={boardRef} className={`relative grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-16 ${draggingWorkerId ? 'select-none' : ''}`}>
                        <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" aria-hidden="true">
                            {visibleWorkers.flatMap((worker) => (assignmentByWorker.get(worker.id) ?? []).map((assignment, assignmentIndex) => {
                                const from = connectorPositions.workers[worker.id]
                                const to = connectorPositions.machines[assignment.machine_id]
                                if (!from || !to) return null
                                const lane = ((visibleWorkers.indexOf(worker) + assignmentIndex) % 5) - 2
                                return <path key={assignment.id} d={connectorPath(from, to, lane)} fill="none" stroke="rgb(224 122 47 / 0.58)" strokeWidth="2.25" strokeLinecap="round" />
                            }))}
                            {draggingWorkerId && dragPoint && connectorPositions.workers[draggingWorkerId] && (
                                <path d={connectorPath(connectorPositions.workers[draggingWorkerId], dragPoint, 0)} fill="none" stroke="rgb(224 122 47 / 0.95)" strokeWidth="3" strokeLinecap="round" strokeDasharray="7 5" />
                            )}
                        </svg>
                        <div className="relative z-10 space-y-3">
                            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted-foreground"><span>Workers</span><Users className="h-4 w-4" /></div>
                            {visibleWorkers.length === 0 ? <EmptyInline label="No workers match this view." /> : visibleWorkers.map((worker) => {
                                const assignments = assignmentByWorker.get(worker.id) ?? []
                                return (
                                    <div key={worker.id} className={`flex min-h-[76px] items-center justify-between gap-3 rounded-xl border bg-surface px-3 py-3 shadow-xs transition-colors ${draggingWorkerId === worker.id ? 'border-saffron bg-saffron-soft/40 shadow-sm' : 'border-hairline'}`}>
                                        <div className="min-w-0"><p className="truncate font-semibold text-ink">{worker.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatWorkerShift(worker.shift_availability)}{worker.is_active ? '' : ' · inactive'}</p><div className="mt-1 flex flex-wrap gap-1">{assignments.map((assignment) => <Badge key={assignment.id} variant="brand">{machineLabel(machineById.get(assignment.machine_id) ?? { id: '', name: 'Machine', machine_type: 'other', custom_label: null, is_active: true })}</Badge>)}</div></div>
                                        <div className="flex shrink-0 items-center gap-1.5"><Button variant="ghost" size="icon-xs" aria-label={`Edit ${worker.name}`} onClick={() => onEditWorker(worker)}><Edit3 className="h-4 w-4" /></Button><Button size="sm" variant="outline" onClick={() => setPickerWorkerId(worker.id)} disabled={!worker.is_active}>Assign</Button><span role="button" tabIndex={-1} data-worker-handle={worker.id} onPointerDown={(event) => handleConnectorPointerDown(event, worker.id)} onPointerMove={handleConnectorPointerMove} onPointerUp={finishConnectorDrag} onPointerCancel={finishConnectorDrag} className="flex h-9 w-9 touch-none cursor-grab items-center justify-center rounded-full border-2 border-saffron/70 bg-saffron-soft text-saffron-deep shadow-sm transition-transform hover:scale-105 active:cursor-grabbing" title={worker.is_active ? `Drag ${worker.name} to a machine` : 'Inactive workers cannot be assigned'} aria-label={worker.is_active ? `Drag ${worker.name} to a machine` : `${worker.name} is inactive`}><Link2 className="h-4 w-4" /></span></div>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="relative z-10 space-y-3">
                            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted-foreground"><span>Machines</span><Wrench className="h-4 w-4" /></div>
                            {visibleMachines.length === 0 ? <EmptyInline label="No machines match this view." /> : visibleMachines.map((machine) => {
                                const assignment = assignmentByMachine.get(machine.id)
                                const worker = assignment ? workerById.get(assignment.worker_id) : null
                                const jobId = currentJobByMachine.get(machine.id) ?? 'none'
                                const pending = pendingKey === `context-${machine.id}`
                                return (
                                    <div key={machine.id} data-machine-node={machine.id} className={`min-h-[76px] rounded-xl border bg-surface px-3 py-3 shadow-xs transition-all ${hoveredMachineId === machine.id ? 'scale-[1.01] border-saffron bg-saffron-soft/45 shadow-md ring-2 ring-saffron/20' : draggingWorkerId && machine.is_active ? 'border-saffron/55 bg-saffron-soft/20' : 'border-hairline'}`}>
                                        <div className="flex items-start justify-between gap-2"><span data-machine-handle={machine.id} className={`-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-saffron-deep transition-colors ${hoveredMachineId === machine.id ? 'border-saffron bg-saffron text-white' : 'border-saffron/60 bg-saffron-soft'}`} title={machine.is_active ? 'Drop a worker here' : 'Inactive machines cannot be assigned'} aria-label={machine.is_active ? `Drop a worker on ${machineLabel(machine)}` : `${machineLabel(machine)} is inactive`}><Link2 className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><p className="truncate font-semibold text-ink">{machineLabel(machine)}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatMachineType(machine.machine_type)}{machine.is_active ? '' : ' · inactive'}</p></div><div className="flex items-center gap-2">{worker ? <Badge variant="success"><Check className="h-3 w-3" /> {worker.name}</Badge> : <Badge variant="warning">Unassigned</Badge>}<Button variant="ghost" size="icon-xs" aria-label={`Edit ${machineLabel(machine)}`} onClick={() => onEditMachine(machine)}><Edit3 className="h-4 w-4" /></Button></div></div>
                                        <div className="mt-2 flex items-center gap-2"><BriefcaseBusiness className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><Select value={jobId} onValueChange={(value) => void handleContextChange(machine.id, value)} disabled={pending || !machine.is_active}><SelectTrigger aria-label={`Production job for ${machineLabel(machine)}`} className="h-8 min-w-0 flex-1 text-xs"><SelectValue placeholder="No active job context" /></SelectTrigger><SelectContent><SelectItem value="none">No active job</SelectItem>{activeJobs.map((job) => <SelectItem key={job.id} value={job.id}>{job.quality_label}</SelectItem>)}</SelectContent></Select>{assignment && <Button variant="ghost" size="icon-xs" aria-label={`Remove ${worker?.name ?? 'worker'} from ${machineLabel(machine)}`} onClick={() => void handleRemove(assignment.id)} disabled={pendingKey === `remove-${assignment.id}`}><Unlink className="h-4 w-4" /></Button>}</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                    <p className="mt-4 text-xs text-muted-foreground">Saved connectors use separate curved lanes to reduce crossings and keep the board readable.</p>
                </CardContent>
            </Card>

            <Card className="md:hidden">
                <CardHeader className="border-b border-hairline/70"><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-saffron-deep" /> Workers</CardTitle><CardDescription>Tap Assign or Change, then choose a machine. No drag or horizontal scrolling is needed.</CardDescription></CardHeader>
                <CardContent className="p-3">
                    <div className="mb-3 relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={workerSearch} onChange={(event) => setWorkerSearch(event.target.value)} placeholder="Search workers" className="pl-9" /></div>
                    <div className="space-y-2">
                        {visibleWorkers.length === 0 ? <EmptyInline label="No workers match this view." /> : visibleWorkers.map((worker) => {
                            const assignments = assignmentByWorker.get(worker.id) ?? []
                            return <div key={worker.id} className="rounded-xl border border-hairline px-3 py-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-ink">{worker.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatWorkerShift(worker.shift_availability)}</p><div className="mt-1 flex flex-wrap gap-1">{assignments.length ? assignments.map((assignment) => <Badge key={assignment.id} variant="brand">{machineLabel(machineById.get(assignment.machine_id) ?? { id: '', name: 'Machine', machine_type: 'other', custom_label: null, is_active: true })}</Badge>) : <Badge variant="warning">Unassigned</Badge>}</div></div><div className="flex items-center gap-1"><Button variant="ghost" size="icon-xs" aria-label={`Edit ${worker.name}`} onClick={() => onEditWorker(worker)}><Edit3 className="h-4 w-4" /></Button><Button size="sm" variant="outline" onClick={() => setPickerWorkerId(worker.id)} disabled={!worker.is_active}>{assignments.length ? 'Change' : 'Assign'} <ChevronIcon /></Button></div></div></div>
                        })}
                    </div>
                </CardContent>
            </Card>

            <Sheet open={pickerWorkerId !== null} onOpenChange={(open) => { if (!open) setPickerWorkerId(null) }}>
                <SheetContent side="bottom" className="max-h-[82dvh] rounded-t-[28px] pb-6">
                    <SheetHeader><SheetTitle>Assign {pickerWorker?.name ?? 'worker'}</SheetTitle><SheetDescription>Choose a machine for the {shift} shift. Saving happens immediately.</SheetDescription></SheetHeader>
                    <div className="space-y-3 overflow-y-auto px-4">
                        <MachineTypeFilters machineTypes={machineTypes} selected={selectedMachineTypes} onToggle={toggleMachineType} onShowAll={() => setSelectedMachineTypes([])} />
                        {selectableMachines.length === 0 ? <EmptyInline label="No active machines found." /> : selectableMachines.map((machine) => {
                            const assignment = assignmentByMachine.get(machine.id)
                            const assignedWorker = assignment ? workerById.get(assignment.worker_id) : null
                            const isCurrent = assignment?.worker_id === pickerWorkerId
                            const pending = pendingKey === `assign-${pickerWorkerId}-${machine.id}`
                            return <button key={machine.id} type="button" className="flex w-full items-center justify-between gap-3 rounded-xl border border-hairline bg-surface px-3 py-3 text-left transition-colors hover:border-saffron hover:bg-saffron-soft/30 disabled:opacity-50" onClick={() => pickerWorkerId && void handleAssign(pickerWorkerId, machine.id)} disabled={pending || isCurrent}><span><span className="block font-semibold text-ink">{machineLabel(machine)}</span><span className="mt-0.5 block text-xs text-muted-foreground">{formatMachineType(machine.machine_type)}{assignedWorker && !isCurrent ? ` · ${assignedWorker.name} currently assigned` : ''}</span></span>{pending ? <Loader2 className="h-4 w-4 animate-spin text-saffron-deep" /> : isCurrent ? <Badge variant="success"><Check className="h-3 w-3" /> Current</Badge> : <span className="text-xs font-bold text-saffron-deep">Choose</span>}</button>
                        })}
                    </div>
                    <SheetFooter><Button variant="outline" onClick={() => setPickerWorkerId(null)}>Close</Button></SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    )
}

function EmptyInline({ label }: { label: string }) {
    return <div className="rounded-xl border border-dashed border-hairline bg-surface-soft/40 p-5 text-center"><p className="text-sm text-body">{label}</p></div>
}

function MachineTypeFilters({
    machineTypes,
    selected,
    onToggle,
    onShowAll,
}: {
    machineTypes: string[]
    selected: string[]
    onToggle: (machineType: string) => void
    onShowAll: () => void
}) {
    if (machineTypes.length === 0) return <p className="flex min-h-10 items-center text-sm text-muted-foreground">No machine types available</p>

    return (
        <div className="flex min-h-10 flex-wrap items-center gap-2" aria-label="Filter by machine type">
            <Button type="button" size="sm" variant={selected.length === 0 ? 'default' : 'outline'} onClick={onShowAll} aria-pressed={selected.length === 0}>All</Button>
            {machineTypes.map((machineType) => {
                const isSelected = selected.includes(machineType)
                return <Button key={machineType} type="button" size="sm" variant={isSelected ? 'default' : 'outline'} onClick={() => onToggle(machineType)} aria-pressed={isSelected}>{formatMachineType(machineType)}</Button>
            })}
        </div>
    )
}

function ChevronIcon() {
    return <span aria-hidden="true">›</span>
}
