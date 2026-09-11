'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { TourInvitation } from '@/components/tours/TourInvitation'
import { useTranslation } from '@/lib/i18n/context'
import { configurationTutorialCopy } from '@/lib/i18n/configuration-tutorial'
import { configurationTourSteps, configurationTourView, makeConfigurationTourExample, type ConfigurationTourStep } from '@/lib/configuration-tour'
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowUpRight, Check, Link2, Loader2, Moon, Plus, Search, Sun, Unlink, Users, Wrench } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { BaseProductionMachine, BaseProductionShift, BaseProductionWorker, BaseWorkerMachineAssignment } from '@/lib/base-production-core'
import {
    removeBaseWorkerMachineAssignment,
    upsertBaseWorkerMachineAssignment,
} from './actions'
import type { BaseProductionInitialData } from './loaders'
import { buildWorkerColorMap, DEFAULT_PALETTE } from './worker-colors'

const ConfigurationTutorial = dynamic(() => import('@/components/tours/ConfigurationTutorial'), { ssr: false })

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
    initialData: liveData,
    tourMetadata,
    focusWorkerId,
    initialShift,
}: {
    initialData: BaseProductionInitialData
    tourMetadata?: Record<string, unknown>
    focusWorkerId?: string
    initialShift?: BaseProductionShift
}) {
    const router = useRouter()
    const { language } = useTranslation()
    const [tourStep, setTourStep] = useState<ConfigurationTourStep | null>(null)
    const tourLauncher = useRef<HTMLDivElement>(null)
    const tourView = tourStep ? configurationTourView(tourStep) : null
    const initialData = useMemo(() => {
        if (!tourStep) return liveData
        const example = makeConfigurationTourExample(liveData.today, tourStep)
        const copy = configurationTutorialCopy[language]
        example.workers[0].name = copy.worker
        example.machines[0].name = copy.machine
        if (example.machines[1]) example.machines[1].name = copy.inactiveMachine
        return { ...liveData, ...example }
    }, [liveData, tourStep, language])
    const [selectedShift, setShift] = useState<BaseProductionShift>(initialShift ?? 'day')
    const [search, setWorkerSearch] = useState(() => initialData.workers.find(worker => worker.id === focusWorkerId)?.name ?? '')
    const [machineTypeFilter, setSelectedMachineTypes] = useState<string[]>([])
    const [includeInactive, setShowInactive] = useState(false)
    const [draggingWorkerId, setDraggingWorkerId] = useState<string | null>(null)
    const [dragPoint, setDragPoint] = useState<ConnectorPoint | null>(null)
    const [hoveredWorkerId, setHoveredWorkerId] = useState<string | null>(null)
    const [hoveredMachineId, setHoveredMachineId] = useState<string | null>(null)
    const [connectorPositions, setConnectorPositions] = useState<ConnectorPositions>({ workers: {}, machines: {} })
    const [selectedPickerWorkerId, setPickerWorkerId] = useState<string | null>(null)
    const [pendingKey, setPendingKey] = useState<string | null>(null)
    const [selectedMobileView, setMobileView] = useState<'workers' | 'machines'>('workers')
    const shift = tourView?.shift ?? selectedShift
    const workerSearch = tourStep ? '' : search
    const selectedMachineTypes = useMemo(() => tourStep ? [] : machineTypeFilter, [tourStep, machineTypeFilter])
    const showInactive = tourView?.showInactive ?? includeInactive
    const pickerWorkerId = tourView ? tourView.pickerWorkerId : selectedPickerWorkerId
    const mobileView = tourView?.mobileView ?? selectedMobileView
    const boardRef = useRef<HTMLDivElement>(null)
    const configurationParams = new URLSearchParams({ shift })
    if (focusWorkerId) configurationParams.set('worker', focusWorkerId)
    const configurationReturnTo = `/owner/operations?${configurationParams}`
    const setupHref = (add: 'worker' | 'machine') => `/owner/setup?${new URLSearchParams({ section: add === 'worker' ? 'workers' : 'machines', add, returnTo: configurationReturnTo })}`

    const workerById = useMemo(
        () => new Map(initialData.workers.map((worker) => [worker.id, worker])),
        [initialData.workers],
    )
    const workerColorMap = useMemo(
        () => buildWorkerColorMap(initialData.workers),
        [initialData.workers],
    )
    const machineById = useMemo(
        () => new Map(initialData.machines.map((machine) => [machine.id, machine])),
        [initialData.machines],
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

    const currentAssignments = useMemo(
        () => initialData.assignments.filter((assignment) => (
            assignment.shift === shift
            && assignment.active
            && isEffectiveOnDate(assignment.effective_from, assignment.effective_to, initialData.today)
            && currentJobByMachine.has(assignment.machine_id)
        )),
        [currentJobByMachine, initialData.assignments, initialData.today, shift],
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

    const visibleWorkers = useMemo(() => initialData.workers.filter((worker) => {
        if (worker.pay_type === 'fixed_monthly') return false
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
        return machineId && machineById.get(machineId)?.is_active && currentJobByMachine.has(machineId) ? machineId : null
    }

    function handleConnectorPointerDown(event: ReactPointerEvent<HTMLElement>, workerId: string) {
        if (tourStep || pendingKey || !workerById.get(workerId)?.is_active) return
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
        if (tourStep) return
        if (!currentJobByMachine.has(machineId)) {
            toast.error('This machine has no active production job. Create or select one before assigning a worker.')
            return
        }
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
        if (tourStep || pendingKey) return
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
        if (tourStep) return
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

    return (
        <div className="configuration-workspace" inert={tourStep !== null}>
            <aside className="configuration-guide-rail" aria-label="Configuration guide">
                <div ref={tourLauncher}>
                    <TourInvitation tourId="configuration" userId={liveData.actorId} orgId={liveData.orgId} userMetadata={tourMetadata} align="full" onLaunch={() => {
                        if (pendingKey) return
                        setPickerWorkerId(null)
                        setTourStep(configurationTourSteps[0])
                    }} />
                </div>
            </aside>
            <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div data-configuration-tour="shift" role="group" aria-label="Assignment shift" className="inline-flex rounded-full border border-hairline bg-surface p-1 shadow-xs">
                        <Button type="button" size="sm" variant={shift === 'day' ? 'default' : 'ghost'} className="rounded-full px-4" aria-pressed={shift === 'day'} disabled={pendingKey !== null} onClick={() => setShift('day')}><Sun className="h-4 w-4" /> Day shift</Button>
                        <Button type="button" size="sm" variant={shift === 'night' ? 'default' : 'ghost'} className="rounded-full px-4" aria-pressed={shift === 'night'} disabled={pendingKey !== null} onClick={() => setShift('night')}><Moon className="h-4 w-4" /> Night shift</Button>
                    </div>
                    <span data-configuration-tour="count" className="text-xs text-muted-foreground" aria-live="polite">{currentAssignments.length} assignment{currentAssignments.length === 1 ? '' : 's'} · {shift === 'day' ? 'Day' : 'Night'} shift</span>
                </div>

            <Card data-configuration-tour="board" className="hidden overflow-hidden md:block">
                <CardHeader className="border-b border-hairline/70">
                    <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4 text-saffron-deep" /> Connect workers to machines</CardTitle>
                    <CardDescription>Drag a connector or choose Assign. Each machine has one worker per shift.</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                    <div className="mb-3 grid grid-cols-2 gap-4">
                        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input data-configuration-tour="search" value={workerSearch} onChange={(event) => setWorkerSearch(event.target.value)} aria-label="Search workers" placeholder="Search workers" className="pl-9" /></div>
                        <MachineTypeFilters machineTypes={machineTypes} selected={selectedMachineTypes} onToggle={toggleMachineType} onShowAll={() => setSelectedMachineTypes([])} />
                    </div>
                    <div ref={boardRef} data-configuration-tour-connections className={`relative grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-16 ${draggingWorkerId ? 'select-none' : ''}`}>
                        <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" aria-hidden="true">
                            {visibleWorkers.flatMap((worker) => {
                                const palette = workerColorMap.get(worker.id) ?? DEFAULT_PALETTE
                                const assignments = assignmentByWorker.get(worker.id) ?? []
                                return assignments.map((assignment, assignmentIndex) => {
                                    const from = connectorPositions.workers[worker.id]
                                    const to = connectorPositions.machines[assignment.machine_id]
                                    if (!from || !to) return null
                                    const lane = ((visibleWorkers.indexOf(worker) + assignmentIndex) % 5) - 2

                                    const isAssignedMachineHovered = hoveredMachineId === assignment.machine_id
                                    const isWorkerHovered = hoveredWorkerId === worker.id
                                    const isHighlighted = isWorkerHovered || isAssignedMachineHovered
                                    const hasAnyHover = Boolean(hoveredWorkerId || (hoveredMachineId && !draggingWorkerId && assignmentByMachine.get(hoveredMachineId)))
                                    const isDimmed = hasAnyHover && !isHighlighted

                                    return (
                                        <path
                                            key={assignment.id}
                                            d={connectorPath(from, to, lane)}
                                            fill="none"
                                            stroke={isHighlighted ? palette.strokeActive : palette.stroke}
                                            strokeWidth={isHighlighted ? 3.25 : 2.25}
                                            strokeOpacity={isDimmed ? 0.22 : 1}
                                            strokeLinecap="round"
                                            className="transition-[stroke,stroke-width,stroke-opacity] duration-150"
                                        />
                                    )
                                })
                            })}
                            {draggingWorkerId && dragPoint && connectorPositions.workers[draggingWorkerId] && (
                                <path
                                    d={connectorPath(connectorPositions.workers[draggingWorkerId], dragPoint, 0)}
                                    fill="none"
                                    stroke={(workerColorMap.get(draggingWorkerId) ?? DEFAULT_PALETTE).strokeActive}
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeDasharray="7 5"
                                />
                            )}
                        </svg>
                        <div className="relative z-10 space-y-3">
                            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted-foreground"><span>Workers</span><Users className="h-4 w-4" /></div>
                            {visibleWorkers.length === 0 ? <EmptyInline label="No workers match this view." /> : visibleWorkers.map((worker) => {
                                const assignments = assignmentByWorker.get(worker.id) ?? []
                                const palette = workerColorMap.get(worker.id) ?? DEFAULT_PALETTE
                                return (
                                    <div
                                        key={worker.id}
                                        data-configuration-tour="worker"
                                        onMouseEnter={() => !draggingWorkerId && setHoveredWorkerId(worker.id)}
                                        onMouseLeave={() => !draggingWorkerId && setHoveredWorkerId(null)}
                                        className={`flex min-h-[76px] items-center justify-between gap-3 rounded-xl border bg-surface px-3 py-3 shadow-xs transition-colors ${draggingWorkerId === worker.id ? 'border-saffron bg-saffron-soft/40 shadow-sm' : hoveredWorkerId === worker.id ? 'border-hairline-strong shadow-xs' : 'border-hairline'}`}
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold text-ink">{worker.name}</p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">{formatWorkerShift(worker.shift_availability)}{worker.is_active ? '' : ' · inactive'}</p>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {assignments.map((assignment) => (
                                                    <span
                                                        key={assignment.id}
                                                        style={{
                                                            backgroundColor: palette.bg,
                                                            borderColor: palette.border,
                                                            color: palette.text,
                                                        }}
                                                        className="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold leading-[1.35] w-fit whitespace-nowrap"
                                                    >
                                                        {machineLabel(machineById.get(assignment.machine_id) ?? { id: '', name: 'Machine', machine_type: 'other', custom_label: null, is_active: true })}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1.5">
                                            <Button data-configuration-tour="assign" size="sm" variant="outline" onClick={() => setPickerWorkerId(worker.id)} disabled={!worker.is_active}>Assign</Button>
                                            <span
                                                role="button"
                                                tabIndex={-1}
                                                data-configuration-tour="drag" data-worker-handle={worker.id}
                                                onPointerDown={(event) => handleConnectorPointerDown(event, worker.id)}
                                                onPointerMove={handleConnectorPointerMove}
                                                onPointerUp={finishConnectorDrag}
                                                onPointerCancel={finishConnectorDrag}
                                                style={{
                                                    borderColor: palette.border,
                                                    backgroundColor: palette.bg,
                                                    color: palette.text,
                                                }}
                                                className="flex h-9 w-9 touch-none cursor-grab items-center justify-center rounded-full border-2 shadow-sm transition-transform hover:scale-105 active:cursor-grabbing"
                                                title={worker.is_active ? `Drag ${worker.name} to a machine` : 'Inactive workers cannot be assigned'}
                                                aria-label={worker.is_active ? `Drag ${worker.name} to a machine` : `${worker.name} is inactive`}
                                            >
                                                <Link2 className="h-4 w-4" />
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="relative z-10 space-y-3">
                            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted-foreground"><span>Machines</span><Wrench className="h-4 w-4" /></div>
                            {visibleMachines.length === 0 ? <EmptyInline label="No machines match this view." /> : visibleMachines.map((machine) => {
                                const assignment = assignmentByMachine.get(machine.id)
                                const worker = assignment ? workerById.get(assignment.worker_id) : null
                                const workerPalette = worker ? (workerColorMap.get(worker.id) ?? DEFAULT_PALETTE) : null
                                const jobId = currentJobByMachine.get(machine.id) ?? 'none'
                                const hasActiveJob = jobId !== 'none'
                                const isDropTargetValid = Boolean(draggingWorkerId && machine.is_active && hasActiveJob)
                                return (
                                    <div
                                        key={machine.id}
                                        data-configuration-tour="machine" data-machine-node={machine.id}
                                        onMouseEnter={() => !draggingWorkerId && setHoveredMachineId(machine.id)}
                                        onMouseLeave={() => !draggingWorkerId && setHoveredMachineId(null)}
                                        className={`min-h-[76px] rounded-xl border bg-surface px-3 py-3 shadow-xs transition-all ${hoveredMachineId === machine.id && draggingWorkerId ? 'scale-[1.01] border-saffron bg-saffron-soft/45 shadow-md ring-2 ring-saffron/20' : isDropTargetValid ? 'border-saffron/55 bg-saffron-soft/20' : hoveredMachineId === machine.id ? 'border-hairline-strong shadow-xs' : 'border-hairline'} ${!hasActiveJob ? 'opacity-90' : ''}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <span
                                                data-machine-handle={machine.id}
                                                style={
                                                    hoveredMachineId === machine.id && draggingWorkerId
                                                        ? undefined
                                                        : workerPalette && hasActiveJob
                                                            ? {
                                                                borderColor: workerPalette.border,
                                                                backgroundColor: workerPalette.bg,
                                                                color: workerPalette.text,
                                                            }
                                                            : undefined
                                                }
                                                className={`-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                                    hoveredMachineId === machine.id && draggingWorkerId
                                                        ? 'border-saffron bg-saffron text-white'
                                                        : hasActiveJob
                                                            ? workerPalette
                                                                ? ''
                                                                : 'border-saffron/60 bg-saffron-soft text-saffron-deep'
                                                            : 'border-hairline/80 bg-surface-soft text-muted-foreground/50 cursor-not-allowed'
                                                }`}
                                                title={!machine.is_active ? 'Inactive machines cannot be assigned' : !hasActiveJob ? 'Create a production job before linking a worker' : 'Drop a worker here'}
                                                aria-label={!machine.is_active ? `${machineLabel(machine)} is inactive` : !hasActiveJob ? `${machineLabel(machine)} has no active production job` : `Drop a worker on ${machineLabel(machine)}`}
                                            >
                                                <Link2 className="h-3.5 w-3.5" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-semibold text-ink">{machineLabel(machine)}</p>
                                                <p className="mt-0.5 text-xs text-muted-foreground">{formatMachineType(machine.machine_type)}{machine.is_active ? '' : ' · inactive'}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {worker ? (
                                                    <span
                                                        style={
                                                            workerPalette
                                                                ? {
                                                                    backgroundColor: workerPalette.bg,
                                                                    borderColor: workerPalette.border,
                                                                    color: workerPalette.text,
                                                                }
                                                                : undefined
                                                        }
                                                        className="inline-flex items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold leading-[1.35]"
                                                    >
                                                        <Check className="h-3 w-3" /> {worker.name}
                                                    </span>
                                                ) : !hasActiveJob ? (
                                                    <Badge variant="outline" className="border-dashed text-muted-foreground">No production job</Badge>
                                                ) : (
                                                    <Badge variant="warning">Unassigned</Badge>
                                                )}
                                                {assignment && <Button data-configuration-tour="remove" variant="ghost" size="icon-sm" aria-label={`Remove ${worker?.name ?? 'worker'} from ${machineLabel(machine)}`} onClick={() => void handleRemove(assignment.id)} disabled={pendingKey !== null}><Unlink className="h-4 w-4" /></Button>}
                                            </div>
                                        </div>
                                        {!hasActiveJob && machine.is_active && <Link data-configuration-tour="job" onClick={event => { if (tourStep) event.preventDefault() }} prefetch={tourStep ? false : undefined} href={`/owner/production?${new URLSearchParams({ tab: 'jobs', returnTo: configurationReturnTo })}#machine-jobs`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-saffron-deep underline underline-offset-2">Set job in Production <ArrowUpRight className="h-3 w-3" /></Link>}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card data-configuration-tour="board" className="gap-3 md:hidden">
                <CardHeader className="border-b border-hairline/70 pb-3">
                    <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4 text-saffron-deep" /> Connect workers to machines</CardTitle>
                    <div className="grid grid-cols-2 rounded-lg bg-surface-soft p-1" role="group" aria-label="Assignment workspace view">
                        <Button type="button" size="sm" variant={mobileView === 'workers' ? 'secondary' : 'ghost'} aria-pressed={mobileView === 'workers'} onClick={() => setMobileView('workers')}><Users className="h-4 w-4" /> Workers</Button>
                        <Button type="button" size="sm" variant={mobileView === 'machines' ? 'secondary' : 'ghost'} aria-pressed={mobileView === 'machines'} onClick={() => setMobileView('machines')}><Wrench className="h-4 w-4" /> Machines</Button>
                    </div>
                </CardHeader>
                {mobileView === 'workers' ? (
                    <CardContent className="p-3 pt-0">
                        <p className="mb-3 text-xs text-body">Assign each worker to one or more machines.</p>
                        <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input data-configuration-tour="search" value={workerSearch} onChange={(event) => setWorkerSearch(event.target.value)} aria-label="Search workers" placeholder="Search workers" className="pl-9" /></div>
                        <div className="space-y-2">
                            {visibleWorkers.length === 0 ? <EmptyInline label="No workers match this view." /> : visibleWorkers.map((worker) => {
                                const assignments = assignmentByWorker.get(worker.id) ?? []
                                const palette = workerColorMap.get(worker.id) ?? DEFAULT_PALETTE
                                return <div key={worker.id} data-configuration-tour="worker" className="rounded-xl border border-hairline px-3 py-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-ink">{worker.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatWorkerShift(worker.shift_availability)}</p><div className="mt-1 flex flex-wrap gap-1">{assignments.length ? assignments.map((assignment) => <span key={assignment.id} style={{ backgroundColor: palette.bg, borderColor: palette.border, color: palette.text }} className="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold leading-[1.35] w-fit whitespace-nowrap">{machineLabel(machineById.get(assignment.machine_id) ?? { id: '', name: 'Machine', machine_type: 'other', custom_label: null, is_active: true })}</span>) : <Badge variant="warning">Unassigned</Badge>}</div></div><div className="flex shrink-0 items-center gap-1"><Button data-configuration-tour="assign" data-configuration-tour-drag-fallback size="sm" variant="outline" onClick={() => setPickerWorkerId(worker.id)} disabled={!worker.is_active}>{assignments.length ? 'Change' : 'Assign'} <ChevronIcon /></Button></div></div></div>
                            })}
                        </div>
                    </CardContent>
                ) : (
                    <CardContent className="p-3 pt-0">
                        <p className="mb-3 text-xs text-body">View the worker connected to each machine for this shift.</p>
                        <div className="mb-3"><MachineTypeFilters machineTypes={machineTypes} selected={selectedMachineTypes} onToggle={toggleMachineType} onShowAll={() => setSelectedMachineTypes([])} /></div>
                        <div className="space-y-2">
                            {visibleMachines.length === 0 ? <EmptyInline label="No machines match this view." /> : visibleMachines.map((machine) => {
                                const assignment = assignmentByMachine.get(machine.id)
                                const worker = assignment ? workerById.get(assignment.worker_id) : null
                                const workerPalette = worker ? (workerColorMap.get(worker.id) ?? DEFAULT_PALETTE) : null
                                const jobId = currentJobByMachine.get(machine.id) ?? 'none'
                                const hasActiveJob = jobId !== 'none'
                                return (
                                    <div key={machine.id} data-configuration-tour="machine" data-configuration-tour-connections className="rounded-xl border border-hairline px-3 py-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold text-ink">{machineLabel(machine)}</p>
                                                <p className="mt-0.5 text-xs text-muted-foreground">{formatMachineType(machine.machine_type)}</p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1">
                                                {worker ? (
                                                    <span
                                                        style={
                                                            workerPalette
                                                                ? {
                                                                    backgroundColor: workerPalette.bg,
                                                                    borderColor: workerPalette.border,
                                                                    color: workerPalette.text,
                                                                }
                                                                : undefined
                                                        }
                                                        className="inline-flex items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold leading-[1.35]"
                                                    >
                                                        <Check className="h-3 w-3" /> {worker.name}
                                                    </span>
                                                ) : !hasActiveJob ? (
                                                    <Badge variant="outline" className="border-dashed text-muted-foreground">No production job</Badge>
                                                ) : (
                                                    <Badge variant="warning">Unassigned</Badge>
                                                )}
                                                {assignment && <Button data-configuration-tour="remove" variant="ghost" size="icon-sm" aria-label={`Remove ${worker?.name ?? 'worker'} from ${machineLabel(machine)}`} onClick={() => void handleRemove(assignment.id)} disabled={pendingKey !== null}><Unlink className="h-4 w-4" /></Button>}
                                            </div>
                                        </div>
                                        {!hasActiveJob && machine.is_active && <Link data-configuration-tour="job" onClick={event => { if (tourStep) event.preventDefault() }} prefetch={tourStep ? false : undefined} href={`/owner/production?${new URLSearchParams({ tab: 'jobs', returnTo: configurationReturnTo })}#machine-jobs`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-saffron-deep underline underline-offset-2">Set job in Production <ArrowUpRight className="h-3 w-3" /></Link>}
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                )}
            </Card>

                <label data-configuration-tour="inactive" className="flex min-h-9 w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" className="h-4 w-4 accent-saffron" checked={showInactive} onChange={event => setShowInactive(event.target.checked)} /> Show inactive</label>
            </div>
            <aside aria-label="Setup shortcuts" className="configuration-actions-rail flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm" className="justify-start rounded-full"><Link data-configuration-tour="add-worker" onClick={event => { if (tourStep) event.preventDefault() }} prefetch={tourStep ? false : undefined} href={setupHref('worker')}><Plus className="h-4 w-4" /> Add worker</Link></Button>
                <Button asChild variant="outline" size="sm" className="justify-start rounded-full"><Link data-configuration-tour="add-machine" onClick={event => { if (tourStep) event.preventDefault() }} prefetch={tourStep ? false : undefined} href={setupHref('machine')}><Plus className="h-4 w-4" /> Add machine</Link></Button>
                <Link data-configuration-tour="setup" onClick={event => { if (tourStep) event.preventDefault() }} prefetch={tourStep ? false : undefined} href="/owner/setup" className="inline-flex min-h-9 items-center gap-1 px-3 text-xs font-medium text-muted-foreground hover:text-ink">View all in Setup <ArrowUpRight className="h-3.5 w-3.5" /></Link>
            </aside>

            <Sheet modal={!tourStep} open={pickerWorkerId !== null} onOpenChange={(open) => { if (!open && !tourStep) setPickerWorkerId(null) }}>
                <SheetContent data-configuration-tour="picker" data-tour-floating={tourStep ? '' : undefined} onOpenAutoFocus={event => { if (tourStep) event.preventDefault() }} onCloseAutoFocus={event => { if (tourStep) event.preventDefault() }} onInteractOutside={event => { if (tourStep) event.preventDefault() }} side="bottom" className="max-h-[82dvh] rounded-t-[28px] pb-6">
                    <SheetHeader><SheetTitle>Assign {pickerWorker?.name ?? 'worker'}</SheetTitle><SheetDescription>Choose a machine for the {shift} shift. Saving happens immediately.</SheetDescription></SheetHeader>
                    <div className="space-y-3 overflow-y-auto px-4">
                        <MachineTypeFilters machineTypes={machineTypes} selected={selectedMachineTypes} onToggle={toggleMachineType} onShowAll={() => setSelectedMachineTypes([])} />
                        {selectableMachines.length === 0 ? <EmptyInline label="No active machines found." /> : selectableMachines.map((machine) => {
                            const assignment = assignmentByMachine.get(machine.id)
                            const assignedWorker = assignment ? workerById.get(assignment.worker_id) : null
                            const isCurrent = assignment?.worker_id === pickerWorkerId
                            const hasActiveJob = currentJobByMachine.has(machine.id)
                            const pending = pendingKey === `assign-${pickerWorkerId}-${machine.id}`
                            const isOptionDisabled = pending || isCurrent || !hasActiveJob
                            return (
                                <button
                                    key={machine.id}
                                    type="button"
                                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-hairline bg-surface px-3 py-3 text-left transition-colors hover:border-saffron hover:bg-saffron-soft/30 disabled:opacity-50 disabled:pointer-events-none"
                                    onClick={() => pickerWorkerId && void handleAssign(pickerWorkerId, machine.id)}
                                    disabled={isOptionDisabled}
                                >
                                    <span>
                                        <span className="block font-semibold text-ink">{machineLabel(machine)}</span>
                                        <span className="mt-0.5 block text-xs text-muted-foreground">
                                            {formatMachineType(machine.machine_type)}
                                            {!hasActiveJob
                                                ? ' · No active production job'
                                                : assignedWorker && !isCurrent
                                                    ? ` · ${assignedWorker.name} currently assigned`
                                                    : ''}
                                        </span>
                                    </span>
                                    {pending ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-saffron-deep" />
                                    ) : isCurrent ? (
                                        <Badge variant="success"><Check className="h-3 w-3" /> Current</Badge>
                                    ) : !hasActiveJob ? (
                                        <span className="text-xs font-semibold text-muted-foreground">No production job</span>
                                    ) : (
                                        <span className="text-xs font-bold text-saffron-deep">Choose</span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                    <SheetFooter><Button variant="outline" onClick={() => setPickerWorkerId(null)}>Close</Button></SheetFooter>
                </SheetContent>
            </Sheet>
            {tourStep && <ConfigurationTutorial step={tourStep} onStepChange={setTourStep} launcher={tourLauncher} userId={liveData.actorId} />}
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
    if (machineTypes.length === 0) return null

    return (
        <div className="flex min-h-10 flex-wrap items-center gap-2" data-configuration-tour="types" aria-label="Filter by machine type">
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
