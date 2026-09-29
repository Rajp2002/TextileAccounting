'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { TourInvitation } from '@/components/tours/TourInvitation'
import { useTranslation } from '@/lib/i18n/context'
import { configurationHelpTopics, configurationTutorialCopy } from '@/lib/i18n/configuration-tutorial'
import { configurationTourSteps, configurationTourView, makeConfigurationTourExample, type ConfigurationTourStep } from '@/lib/configuration-tour'
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowUpRight, Check, CircleHelp, Link2, Loader2, Moon, Plus, Search, Sun, Unlink, Users, Wrench } from 'lucide-react'
import { railButton, railIcon } from '@/components/ui/rail'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
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
    focusMachineId,
    initialShift,
}: {
    initialData: BaseProductionInitialData
    tourMetadata?: Record<string, unknown>
    focusMachineId?: string
    focusWorkerId?: string
    initialShift?: BaseProductionShift
}) {
    const router = useRouter()
    const { language, tx } = useTranslation()
    const tourCopy = configurationTutorialCopy[language]
    const [tourStep, setTourStep] = useState<ConfigurationTourStep | null>(null)
    const tourLauncher = useRef<HTMLDivElement>(null)
    const tourReturnScroll = useRef({ x: 0, y: 0 })
    const tourView = tourStep ? configurationTourView(tourStep) : null
    const initialData = useMemo(() => {
        if (!tourStep) return liveData
        const example = makeConfigurationTourExample(liveData.today, tourStep)
        const copy = configurationTutorialCopy[language]
        example.workers[0].name = copy.worker
        example.machines[0].name = copy.machine
        return { ...liveData, ...example }
    }, [liveData, tourStep, language])
    const [selectedShift, setShift] = useState<BaseProductionShift>(initialShift ?? 'day')
    const [search, setWorkerSearch] = useState('')
    const [machineTypeFilter, setSelectedMachineTypes] = useState<string[]>([])
    const [includeInactive] = useState(false)
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
    if (focusMachineId) configurationParams.set('machine', focusMachineId)
    const configurationReturnTo = `/owner/assignments?${configurationParams}`
    const setupHref = (add: 'worker' | 'machine') => `/owner/${add === 'worker' ? 'workers' : 'machines'}?${new URLSearchParams({ ...(add === 'machine' ? { register: 'base' } : {}), add, returnTo: configurationReturnTo })}`

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
    // Context filters narrow the summary; all candidates remain available for explicit reassignment.
    const contextAssignmentCount = currentAssignments.filter(assignment => (tourStep || !focusWorkerId || assignment.worker_id === focusWorkerId) && (tourStep || !focusMachineId || assignment.machine_id === focusMachineId)).length
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
        if (!tourStep && focusWorkerId && worker.id !== focusWorkerId) return false
        if (worker.pay_type === 'fixed_monthly') return false
        if (!showInactive && !worker.is_active) return false
        const isAvailable = worker.shift_availability === 'both' || worker.shift_availability === shift
        if (!isAvailable && !assignmentByWorker.has(worker.id)) return false
        return worker.name.toLowerCase().includes(workerSearch.trim().toLowerCase())
    }), [assignmentByWorker, initialData.workers, shift, showInactive, workerSearch, focusWorkerId, tourStep])
    const machineTypes = useMemo(() => Array.from(new Set(
        initialData.machines
            .filter((machine) => showInactive || machine.is_active)
            .map((machine) => machine.machine_type),
    )).sort((left, right) => formatMachineType(left).localeCompare(formatMachineType(right))), [initialData.machines, showInactive])
    const visibleMachines = useMemo(() => initialData.machines.filter((machine) => {
        if (!tourStep && focusMachineId && machine.id !== focusMachineId) return false
        if (!showInactive && !machine.is_active) return false
        return selectedMachineTypes.length === 0 || selectedMachineTypes.includes(machine.machine_type)
    }), [initialData.machines, selectedMachineTypes, showInactive, focusMachineId, tourStep])
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
            {(focusWorkerId || focusMachineId) && <div role="status" className="col-span-full rounded border p-3"><p>{(focusWorkerId && !liveData.workers.some(worker => worker.id === focusWorkerId)) || (focusMachineId && !liveData.machines.some(machine => machine.id === focusMachineId)) ? 'This record is unavailable.' : focusWorkerId ? 'Worker filter active' : 'Machine filter active'}</p><Link className="inline-flex min-h-11 items-center underline" href={`/owner/assignments?shift=${shift}`}>View all assignments</Link></div>}
            <aside className="configuration-guide-rail" aria-label="Machine Assignments guide">
                <div ref={tourLauncher}>
                    <TourInvitation
                        tourId="configuration"
                        userId={liveData.actorId}
                        orgId={liveData.orgId}
                        userMetadata={tourMetadata}
                        align="full"
                        className="w-full"
                        onLaunch={() => {
                            if (pendingKey) return
                            tourReturnScroll.current = { x: window.scrollX, y: window.scrollY }
                            setTourStep(configurationTourSteps[0])
                        }}
                    />
                </div>
                <div data-i18n-skip="true" lang={language} className="left-rail-bottom mt-auto pt-3">
                    <Dialog>
                        <DialogTrigger asChild>
                            <button
                                type="button"
                                className={cn('estimator-touch-target', railButton)}
                                aria-label={tourCopy.helpLabel}
                            >
                                <span className="flex min-w-0 items-center gap-2.5">
                                    <CircleHelp className={railIcon} aria-hidden="true" />
                                    <span className="min-w-0">{tourCopy.helpLabel}</span>
                                </span>
                                <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                                    {configurationHelpTopics.length}
                                </span>
                            </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border border-hairline bg-surface p-6 shadow-2xl">
                            <DialogHeader>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--wv-ochre-100)] text-[var(--wv-ochre-800)] shadow-xs border border-[var(--wv-ochre-200)]/60">
                                        <CircleHelp className="h-5 w-5" aria-hidden="true" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-xl font-bold text-ink">
                                            {tourCopy.helpLabel}
                                        </DialogTitle>
                                        <DialogDescription className="mt-1 text-sm text-body">
                                            {tourCopy.helpIntro}
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>
                            <div className="mt-4 space-y-3 divide-y divide-hairline">
                                {configurationHelpTopics.map(topic => (
                                    <div key={topic} className="pt-3 first:pt-0">
                                        <h3 className="text-sm font-semibold text-ink">{tourCopy.help[topic][0]}</h3>
                                        <p className="mt-1 text-xs sm:text-sm leading-relaxed text-body">{tourCopy.help[topic][1]}</p>
                                    </div>
                                ))}
                            </div>
                        </DialogContent>
                    </Dialog>
                    <div className="sr-only" aria-hidden="true">
                        {configurationHelpTopics.map(topic => (
                            <div key={`sr-${topic}`}>
                                <span>{tourCopy.help[topic][0]}</span>
                                <span>{tourCopy.help[topic][1]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </aside>
            <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline/70 bg-surface/80 p-2 shadow-xs sm:px-3">
                    <div data-configuration-tour="shift" role="group" aria-label="Assignment shift" className="inline-flex rounded-full border border-hairline bg-surface p-1 shadow-xs">
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className={cn(
                                "h-8 rounded-full px-4 text-xs font-semibold transition-all",
                                shift === 'day'
                                    ? "bg-loom text-white shadow-xs hover:bg-loom-elevated hover:text-white"
                                    : "text-muted-foreground hover:bg-surface-soft hover:text-ink"
                            )}
                            aria-pressed={shift === 'day'}
                            disabled={pendingKey !== null}
                            onClick={() => setShift('day')}
                        >
                            <Sun className="h-3.5 w-3.5" /> Day shift
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className={cn(
                                "h-8 rounded-full px-4 text-xs font-semibold transition-all",
                                shift === 'night'
                                    ? "bg-loom text-white shadow-xs hover:bg-loom-elevated hover:text-white"
                                    : "text-muted-foreground hover:bg-surface-soft hover:text-ink"
                            )}
                            aria-pressed={shift === 'night'}
                            disabled={pendingKey !== null}
                            onClick={() => setShift('night')}
                        >
                            <Moon className="h-3.5 w-3.5" /> Night shift
                        </Button>
                    </div>
                    <span data-configuration-tour="count" className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-medium text-body shadow-xs" aria-live="polite">
                        {tx('Assignments: {count}', { count: contextAssignmentCount })} · {tx(shift === 'day' ? 'Day shift' : 'Night shift')}
                    </span>
                </div>

            <Card data-configuration-tour="board" className="hidden overflow-hidden rounded-2xl border border-hairline/80 bg-surface shadow-[var(--shadow-card)] md:flex md:flex-col min-h-[calc(100vh-14.5rem)]">
                <CardHeader className="border-b border-hairline/80 bg-gradient-to-r from-surface to-surface-soft/35 px-6 py-4">
                    <CardTitle className="flex items-center gap-2 text-base font-bold text-ink">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-hairline bg-surface-soft text-loom">
                            <Link2 className="h-4 w-4" />
                        </span>
                        Connect workers to machines
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs text-body">
                        Drag a connector or choose Assign. Each machine has one worker per shift.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6 flex flex-1 flex-col min-h-0">
                    <div className="mb-5 grid grid-cols-2 gap-4">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                data-configuration-tour="search"
                                value={workerSearch}
                                onChange={(event) => setWorkerSearch(event.target.value)}
                                aria-label="Search workers"
                                placeholder="Search workers"
                                className="h-10 sm:h-11 rounded-xl border border-hairline bg-surface pl-9 text-sm text-ink placeholder:text-muted-foreground/70 focus:border-loom-subtle focus:ring-2 focus:ring-loom/10"
                            />
                        </div>
                        <MachineTypeFilters machineTypes={machineTypes} selected={selectedMachineTypes} onToggle={toggleMachineType} onShowAll={() => setSelectedMachineTypes([])} />
                    </div>
                    <div
                        ref={boardRef}
                        data-configuration-tour-connections
                        onScroll={updateConnectorPositions}
                        className={`relative grid flex-1 min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-12 lg:gap-16 overflow-y-auto overscroll-contain pr-2 ${draggingWorkerId ? 'select-none' : ''}`}
                    >
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
                                        className={`flex min-h-[76px] items-center justify-between gap-3 rounded-xl border bg-surface px-3.5 py-3 shadow-xs transition-all ${draggingWorkerId === worker.id ? 'border-saffron bg-saffron-soft/40 shadow-sm' : hoveredWorkerId === worker.id ? 'border-hairline-strong shadow-xs' : 'border-hairline'}`}
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold text-ink">{worker.name}</p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">{formatWorkerShift(worker.shift_availability)}{worker.is_active ? '' : ' · inactive'}</p>
                                            <div className="mt-1.5 flex flex-wrap gap-1">
                                                {assignments.map((assignment) => (
                                                    <span
                                                        key={assignment.id}
                                                        style={{
                                                            backgroundColor: palette.bg,
                                                            borderColor: palette.border,
                                                            color: palette.text,
                                                        }}
                                                        className="inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-[1.35] w-fit whitespace-nowrap"
                                                    >
                                                        {machineLabel(machineById.get(assignment.machine_id) ?? { id: '', name: 'Machine', machine_type: 'other', custom_label: null, is_active: true })}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <Button
                                                data-configuration-tour="assign"
                                                size="sm"
                                                variant="outline"
                                                className="h-8 rounded-lg border-hairline px-3 text-xs font-medium text-body shadow-xs hover:border-hairline-strong hover:bg-surface-soft hover:text-ink"
                                                onClick={() => setPickerWorkerId(worker.id)}
                                                disabled={!worker.is_active}
                                            >
                                                Assign
                                            </Button>
                                            <span
                                                role="button"
                                                tabIndex={-1}
                                                data-configuration-tour="drag"
                                                data-worker-handle={worker.id}
                                                onPointerDown={(event) => handleConnectorPointerDown(event, worker.id)}
                                                onPointerMove={handleConnectorPointerMove}
                                                onPointerUp={finishConnectorDrag}
                                                onPointerCancel={finishConnectorDrag}
                                                style={{
                                                    borderColor: palette.border,
                                                    backgroundColor: palette.bg,
                                                    color: palette.text,
                                                }}
                                                className="flex h-9 w-9 touch-none cursor-grab items-center justify-center rounded-full border-2 shadow-xs transition-transform hover:scale-110 active:cursor-grabbing active:scale-95"
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
                                        data-configuration-tour="machine"
                                        data-machine-node={machine.id}
                                        onMouseEnter={() => !draggingWorkerId && setHoveredMachineId(machine.id)}
                                        onMouseLeave={() => !draggingWorkerId && setHoveredMachineId(null)}
                                        className={`min-h-[76px] rounded-xl border bg-surface px-3.5 py-3 shadow-xs transition-all ${hoveredMachineId === machine.id && draggingWorkerId ? 'scale-[1.01] border-saffron bg-saffron-soft/45 shadow-md ring-2 ring-saffron/20' : isDropTargetValid ? 'border-saffron/55 bg-saffron-soft/20' : hoveredMachineId === machine.id ? 'border-hairline-strong shadow-xs' : 'border-hairline'} ${!hasActiveJob ? 'opacity-90' : ''}`}
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
                                                        className="inline-flex items-center justify-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-[1.35]"
                                                    >
                                                        <Check className="h-3 w-3" /> {worker.name}
                                                    </span>
                                                ) : !hasActiveJob ? (
                                                    <Badge variant="outline" className="border-dashed text-muted-foreground text-xs">No production job</Badge>
                                                ) : (
                                                    <Badge variant="warning" className="text-xs">Unassigned</Badge>
                                                )}
                                                {assignment && (
                                                    <Button
                                                        data-configuration-tour="remove"
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        aria-label={`Remove ${worker?.name ?? 'worker'} from ${machineLabel(machine)}`}
                                                        onClick={() => void handleRemove(assignment.id)}
                                                        disabled={pendingKey !== null}
                                                        className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-risk-soft/40 hover:text-risk transition-colors"
                                                    >
                                                        <Unlink className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        {!hasActiveJob && machine.is_active && (
                                            <Link
                                                data-configuration-tour="job"
                                                onClick={event => { if (tourStep) event.preventDefault() }}
                                                prefetch={tourStep ? false : undefined}
                                                href={`/owner/production?${new URLSearchParams({ tab: 'jobs', returnTo: configurationReturnTo })}#machine-jobs`}
                                                className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-saffron-deep hover:text-saffron underline underline-offset-2"
                                            >
                                                Set job in Production <ArrowUpRight className="h-3 w-3" />
                                            </Link>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card data-configuration-tour="board" className="gap-3 rounded-2xl border border-hairline bg-surface shadow-xs md:hidden min-h-[calc(100vh-14.5rem)] flex flex-col">
                <CardHeader className="border-b border-hairline/70 p-4 pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-bold text-ink">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-hairline bg-surface-soft text-loom">
                            <Link2 className="h-4 w-4" />
                        </span>
                        Connect workers to machines
                    </CardTitle>
                    <div className="grid grid-cols-2 rounded-xl bg-surface-soft p-1 border border-hairline/60" role="group" aria-label="Assignment workspace view">
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className={cn(
                                "h-8 rounded-lg text-xs font-semibold transition-all",
                                mobileView === 'workers'
                                    ? "bg-surface text-ink shadow-xs border border-hairline"
                                    : "text-muted-foreground hover:text-ink"
                            )}
                            aria-pressed={mobileView === 'workers'}
                            onClick={() => setMobileView('workers')}
                        >
                            <Users className="h-3.5 w-3.5" /> Workers
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className={cn(
                                "h-8 rounded-lg text-xs font-semibold transition-all",
                                mobileView === 'machines'
                                    ? "bg-surface text-ink shadow-xs border border-hairline"
                                    : "text-muted-foreground hover:text-ink"
                            )}
                            aria-pressed={mobileView === 'machines'}
                            onClick={() => setMobileView('machines')}
                        >
                            <Wrench className="h-3.5 w-3.5" /> Machines
                        </Button>
                    </div>
                </CardHeader>
                {mobileView === 'workers' ? (
                    <CardContent className="p-4 pt-3">
                        <p className="mb-3 text-xs text-body">Assign each worker to one or more machines.</p>
                        <div className="relative mb-3">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                data-configuration-tour="search"
                                value={workerSearch}
                                onChange={(event) => setWorkerSearch(event.target.value)}
                                aria-label="Search workers"
                                placeholder="Search workers"
                                className="h-10 rounded-xl border border-hairline bg-surface pl-9 text-sm text-ink placeholder:text-muted-foreground/70 focus:border-loom-subtle focus:ring-2 focus:ring-loom/10"
                            />
                        </div>
                        <div className="space-y-2">
                            {visibleWorkers.length === 0 ? <EmptyInline label="No workers match this view." /> : visibleWorkers.map((worker) => {
                                const assignments = assignmentByWorker.get(worker.id) ?? []
                                const palette = workerColorMap.get(worker.id) ?? DEFAULT_PALETTE
                                return (
                                    <div key={worker.id} data-configuration-tour="worker" className="rounded-xl border border-hairline bg-surface p-3 shadow-xs">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold text-ink">{worker.name}</p>
                                                <p className="mt-0.5 text-xs text-muted-foreground">{formatWorkerShift(worker.shift_availability)}</p>
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {assignments.length ? assignments.map((assignment) => (
                                                        <span
                                                            key={assignment.id}
                                                            style={{ backgroundColor: palette.bg, borderColor: palette.border, color: palette.text }}
                                                            className="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold leading-[1.35] w-fit whitespace-nowrap"
                                                        >
                                                            {machineLabel(machineById.get(assignment.machine_id) ?? { id: '', name: 'Machine', machine_type: 'other', custom_label: null, is_active: true })}
                                                        </span>
                                                    )) : (
                                                        <Badge variant="warning" className="text-xs">Unassigned</Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1">
                                                <Button
                                                    data-configuration-tour="assign"
                                                    data-configuration-tour-drag-fallback
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 rounded-lg border-hairline px-3 text-xs font-medium text-body shadow-xs hover:border-hairline-strong hover:bg-surface-soft hover:text-ink"
                                                    onClick={() => setPickerWorkerId(worker.id)}
                                                    disabled={!worker.is_active}
                                                >
                                                    {assignments.length ? 'Change' : 'Assign'} <ChevronIcon />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                ) : (
                    <CardContent className="p-4 pt-3">
                        <p className="mb-3 text-xs text-body">View the worker connected to each machine for this shift.</p>
                        <div className="mb-3">
                            <MachineTypeFilters machineTypes={machineTypes} selected={selectedMachineTypes} onToggle={toggleMachineType} onShowAll={() => setSelectedMachineTypes([])} />
                        </div>
                        <div className="space-y-2">
                            {visibleMachines.length === 0 ? <EmptyInline label="No machines match this view." /> : visibleMachines.map((machine) => {
                                const assignment = assignmentByMachine.get(machine.id)
                                const worker = assignment ? workerById.get(assignment.worker_id) : null
                                const workerPalette = worker ? (workerColorMap.get(worker.id) ?? DEFAULT_PALETTE) : null
                                const jobId = currentJobByMachine.get(machine.id) ?? 'none'
                                const hasActiveJob = jobId !== 'none'
                                return (
                                    <div key={machine.id} data-configuration-tour="machine" data-configuration-tour-connections className="rounded-xl border border-hairline bg-surface p-3 shadow-xs">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold text-ink">{machineLabel(machine)}</p>
                                                <p className="mt-0.5 text-xs text-muted-foreground">{formatMachineType(machine.machine_type)}</p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1.5">
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
                                                        className="inline-flex items-center justify-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-[1.35]"
                                                    >
                                                        <Check className="h-3 w-3" /> {worker.name}
                                                    </span>
                                                ) : !hasActiveJob ? (
                                                    <Badge variant="outline" className="border-dashed text-muted-foreground text-xs">No production job</Badge>
                                                ) : (
                                                    <Badge variant="warning" className="text-xs">Unassigned</Badge>
                                                )}
                                                {assignment && (
                                                    <Button
                                                        data-configuration-tour="remove"
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        aria-label={`Remove ${worker?.name ?? 'worker'} from ${machineLabel(machine)}`}
                                                        onClick={() => void handleRemove(assignment.id)}
                                                        disabled={pendingKey !== null}
                                                        className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-risk-soft/40 hover:text-risk transition-colors"
                                                    >
                                                        <Unlink className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        {!hasActiveJob && machine.is_active && (
                                            <Link
                                                data-configuration-tour="job"
                                                onClick={event => { if (tourStep) event.preventDefault() }}
                                                prefetch={tourStep ? false : undefined}
                                                href={`/owner/production?${new URLSearchParams({ tab: 'jobs', returnTo: configurationReturnTo })}#machine-jobs`}
                                                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-saffron-deep hover:text-saffron underline underline-offset-2"
                                            >
                                                Set job in Production <ArrowUpRight className="h-3 w-3" />
                                            </Link>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                )}
            </Card>

            </div>
            <aside aria-label="Management links" className="configuration-actions-rail flex flex-wrap gap-2 rounded-2xl border border-hairline/80 bg-surface/95 p-3 shadow-[var(--shadow-card)] backdrop-blur-sm">
                <Button asChild variant="default" size="sm" className="h-12 w-full justify-between rounded-xl border border-loom bg-loom px-4 text-sm font-semibold text-white shadow-sm hover:border-loom-elevated hover:bg-loom-elevated hover:text-white focus-visible:ring-loom/30">
                    <Link data-configuration-tour="daily-sheet" data-i18n-skip="true" lang={language} onClick={event => { if (tourStep) event.preventDefault() }} prefetch={tourStep ? false : undefined} href={`/owner/production?${new URLSearchParams({ tab: 'production', shift, returnTo: configurationReturnTo })}`}>
                        {tourCopy.dailySheetLabel} <ArrowUpRight className="h-4 w-4" />
                    </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-11 w-full justify-start rounded-xl border-hairline bg-surface px-4 text-sm font-semibold text-ink shadow-xs hover:border-hairline-strong hover:bg-surface-soft hover:text-ink">
                    <Link data-configuration-tour="add-worker" onClick={event => { if (tourStep) event.preventDefault() }} prefetch={tourStep ? false : undefined} href={setupHref('worker')}>
                        <Plus className="h-4 w-4" /> Add worker
                    </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-11 w-full justify-start rounded-xl border-hairline bg-surface px-4 text-sm font-semibold text-ink shadow-xs hover:border-hairline-strong hover:bg-surface-soft hover:text-ink">
                    <Link data-configuration-tour="add-machine" onClick={event => { if (tourStep) event.preventDefault() }} prefetch={tourStep ? false : undefined} href={setupHref('machine')}>
                        <Plus className="h-4 w-4" /> Add machine
                    </Link>
                </Button>
                <div className="my-1 h-px w-full bg-hairline/80" aria-hidden="true" />
                <Link data-configuration-tour="setup" onClick={event => { if (tourStep) event.preventDefault() }} prefetch={tourStep ? false : undefined} href={setupHref('worker').replace('add=worker&', '')} className="inline-flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-soft hover:text-ink">
                    Manage workers <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
                <Link onClick={event => { if (tourStep) event.preventDefault() }} prefetch={tourStep ? false : undefined} href={setupHref('machine').replace('add=machine&', '')} className="inline-flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-soft hover:text-ink">
                    Manage machines <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
            </aside>

            <Sheet modal={!tourStep} open={pickerWorkerId !== null} onOpenChange={(open) => { if (!open && !tourStep) setPickerWorkerId(null) }}>
                <SheetContent data-configuration-tour="picker" data-configuration-picker-preview={tourStep ? "true" : undefined} onOpenAutoFocus={event => { if (tourStep) event.preventDefault() }} onCloseAutoFocus={event => { if (tourStep) event.preventDefault() }} onInteractOutside={event => { if (tourStep) event.preventDefault() }} side="bottom" className="max-h-[82dvh] rounded-t-2xl border-t border-hairline bg-surface pb-6 shadow-xl">
                    <SheetHeader className="pb-3 border-b border-hairline/60">
                        <SheetTitle className="text-lg font-bold text-ink">Assign {pickerWorker?.name ?? 'worker'}</SheetTitle>
                        <SheetDescription className="text-xs text-body">Choose a machine for the {shift} shift. Saving happens immediately.</SheetDescription>
                    </SheetHeader>
                    <div className="space-y-3 overflow-y-auto px-4 pt-3">
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
                                    data-configuration-picker-state={!hasActiveJob ? 'blocked' : isCurrent ? 'current' : assignedWorker ? 'occupied' : 'available'}
                                    type="button"
                                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-hairline bg-surface p-3.5 text-left transition-all hover:border-hairline-strong hover:bg-surface-soft disabled:opacity-50 disabled:pointer-events-none shadow-xs"
                                    onClick={() => pickerWorkerId && void handleAssign(pickerWorkerId, machine.id)}
                                    disabled={Boolean(tourStep) || isOptionDisabled}
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
                                        <Loader2 className="h-4 w-4 animate-spin text-loom" />
                                    ) : isCurrent ? (
                                        <Badge variant="success" className="text-xs"><Check className="h-3 w-3 mr-1" /> Current</Badge>
                                    ) : !hasActiveJob ? (
                                        <span className="text-xs font-semibold text-muted-foreground">No production job</span>
                                    ) : (
                                        <span className="inline-flex items-center justify-center rounded-lg bg-loom px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-loom-elevated">Choose</span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                    <SheetFooter className="pt-3 border-t border-hairline/60">
                        <Button variant="outline" className="rounded-xl border-hairline" onClick={() => setPickerWorkerId(null)}>Close</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
            {tourStep === 'connected' && <div data-configuration-tour="saved-preview" data-i18n-skip="true" lang={language} role="status" className="col-span-full flex items-center justify-between gap-3 rounded-xl border border-hairline bg-surface p-4 shadow-sm">
                <div>
                    <p className="text-xs text-saffron-deep">{tourCopy.sample}</p>
                    <p className="font-semibold">{tourCopy.savedLabel}</p>
                    <p className="text-sm text-body">{tourCopy.worker} → {tourCopy.machine} · {tourCopy.dayShiftLabel}</p>
                </div>
                <Button type="button" variant="outline" disabled>{tourCopy.undoLabel}</Button>
            </div>}
            {tourStep && <ConfigurationTutorial step={tourStep} onStepChange={setTourStep} launcher={tourLauncher} returnScroll={tourReturnScroll} userId={liveData.actorId} />}
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
        <div className="flex min-h-10 flex-wrap items-center gap-1.5" data-configuration-tour="types" aria-label="Filter by machine type">
            <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onShowAll}
                aria-pressed={selected.length === 0}
                className={cn(
                    "h-8 rounded-full px-3 text-xs font-semibold transition-all border",
                    selected.length === 0
                        ? "border-loom bg-loom text-white shadow-xs hover:bg-loom-elevated hover:text-white"
                        : "border-hairline bg-surface text-body hover:border-hairline-strong hover:text-ink hover:bg-surface-soft"
                )}
            >
                All
            </Button>
            {machineTypes.map((machineType) => {
                const isSelected = selected.includes(machineType)
                return (
                    <Button
                        key={machineType}
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onToggle(machineType)}
                        aria-pressed={isSelected}
                        className={cn(
                            "h-8 rounded-full px-3 text-xs font-semibold transition-all border",
                            isSelected
                                ? "border-loom bg-loom text-white shadow-xs hover:bg-loom-elevated hover:text-white"
                                : "border-hairline bg-surface text-body hover:border-hairline-strong hover:text-ink hover:bg-surface-soft"
                        )}
                    >
                        {formatMachineType(machineType)}
                    </Button>
                )
            })}
        </div>
    )
}

function ChevronIcon() {
    return <span aria-hidden="true">›</span>
}
