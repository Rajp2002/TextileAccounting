'use client'

import { hasBaseOperatorEligibility } from '@/lib/base-operator'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { TourInvitation } from '@/components/tours/TourInvitation'
import { useTranslation } from '@/lib/i18n/context'
import type { GuidedTour as GuidedTourComponent } from '@/components/tours/GuidedTour'
import { findTourTarget } from '@/lib/tutorial-target'
import { formatTourText } from '@/lib/tours/tour-text'
import { isSampleRecordId } from '@/lib/tours/sample-ids'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
import { configurationHelpTopics, configurationTutorialCopy } from '@/lib/i18n/configuration-tutorial'
import { configurationTourSteps, configurationTourView, configurationTourSpecs, configurationTourControlLabels, configurationHandoffWorker, makeConfigurationTourExample, type ConfigurationTourStep } from '@/lib/configuration-tour'
import { Fragment, memo, useCallback, useEffect, useEffectEvent, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type Ref, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'
import { ArrowUpRight, Check, ChevronDown, CircleHelp, Layers, Link2, Loader2, Moon, Plus, Search, Sun, Unlink, Users, Wrench } from 'lucide-react'
import { railPrimaryAction } from '@/components/ui/rail'
import { PageHeader } from '@/components/ui/page-header'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LiquidSegmented } from '@/components/ui/liquid-segmented'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { groupMachinesByWorker, orderWorkersByAssignment, workersHeldByOtherShift } from '@/lib/machine-assignment-groups'
import { compareMachineLabels } from '@/lib/base-machine-register'
import {
    applyPendingAssignmentChanges,
    isAssignmentChangeReflected,
    isPendingAssignmentId,
    pendingAssignmentId,
    type PendingAssignmentChange,
} from '@/lib/machine-assignment-optimistic'
import type { BaseProductionMachine, BaseProductionShift, BaseProductionWorker, BaseWorkerMachineAssignment } from '@/lib/base-production-core'
import {
    removeBaseWorkerMachineAssignment,
    upsertBaseWorkerMachineAssignment,
} from './actions'
import type { BaseAssignmentsInitialData } from '../assignments/loaders'
import { buildWorkerColorMap, DEFAULT_PALETTE, type WorkerPalette } from './worker-colors'
import MachineQualityDialog from './MachineQualityDialog'

const GuidedTour = dynamic(() => import('@/components/tours/GuidedTour').then(module => module.GuidedTour), { ssr: false }) as typeof GuidedTourComponent

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
type ConnectorLink = {
    key: string
    workerId: string
    machineId: string
    palette: WorkerPalette
    isHighlighted: boolean
    isDimmed: boolean
    drawIn: boolean
}
type ConnectorLayerHandle = {
    /** Re-reads every handle position (cheap; only re-renders the lines when something moved). */
    measure: () => void
    /** Keeps the lines glued to their handles every frame while cards animate. */
    follow: (durationMs: number) => void
}
type BoardItemLayout = { node: HTMLElement; x: number; y: number }
/** An optimistic change on the board: shown at once, saved in the background. */
type BoardChange = PendingAssignmentChange & {
    key: string
    source: 'drag' | 'picker'
    /** The machine has moved into its worker's group (a short beat after the link appears). */
    placed: boolean
    /** The server accepted the change; it stays until the refreshed page data shows it. */
    settled: boolean
    /** A fallback refresh was requested because the saved change had not shown up yet. */
    refreshing: boolean
}
type DragSession = {
    workerId: string
    pointerId: number
    clientX: number
    clientY: number
    scroller: Element
    targetMachineId: string | null
    end: ConnectorPoint | null
    snapFrom: ConnectorPoint | null
    snapStart: number
    lastFrame: number
    /** When the pointer reached the top or bottom edge; scrolling waits for a short dwell. */
    edgeSince: number | null
    returnFrom: ConnectorPoint | null
    returnStart: number
}

// A drop links at once; a beat later the machine glides in beside its worker.
const PLACE_DELAY_MS = 180
const SETTLE_MS = 460
const SETTLE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
const SNAP_MS = 140
const RETURN_MS = 220
const NEW_LINK_HIGHLIGHT_MS = 1200
const SAVED_REFRESH_FALLBACK_MS = 2500
const AUTO_SCROLL_EDGE = 48
const AUTO_SCROLL_DWELL_MS = 280
const AUTO_SCROLL_SPEED = 14

function connectorPath(from: ConnectorPoint, to: ConnectorPoint) {
    const distance = Math.max(48, to.x - from.x)
    const bend = Math.max(28, distance * 0.38)
    return `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`
}

function prefersReducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function easeOutCubic(t: number) {
    return 1 - (1 - t) ** 3
}

function mixPoint(from: ConnectorPoint, to: ConnectorPoint, t: number): ConnectorPoint {
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}

function nextPaint() {
    return new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
}

/**
 * Where the board's content starts in viewport coordinates. Points measured from it
 * stay put while the page or the board scrolls, which is what the connector SVG
 * (absolutely positioned inside the board) needs.
 */
function boardOrigin(board: HTMLElement): ConnectorPoint {
    const rect = board.getBoundingClientRect()
    return { x: rect.left - board.scrollLeft, y: rect.top - board.scrollTop }
}

function edgePoint(origin: ConnectorPoint, node: Element, side: 'left' | 'right'): ConnectorPoint {
    const rect = node.getBoundingClientRect()
    return { x: (side === 'right' ? rect.right : rect.left) - origin.x, y: rect.top + rect.height / 2 - origin.y }
}

function measureConnectorHandles(board: HTMLElement): ConnectorPositions {
    const origin = boardOrigin(board)
    const workers: Record<string, ConnectorPoint> = {}
    const machines: Record<string, ConnectorPoint> = {}
    board.querySelectorAll<HTMLElement>('[data-worker-handle]').forEach((node) => {
        if (node.dataset.workerHandle) workers[node.dataset.workerHandle] = edgePoint(origin, node, 'right')
    })
    board.querySelectorAll<HTMLElement>('[data-machine-handle]').forEach((node) => {
        if (node.dataset.machineHandle) machines[node.dataset.machineHandle] = edgePoint(origin, node, 'left')
    })
    return { workers, machines }
}

function samePoints(left: Record<string, ConnectorPoint>, right: Record<string, ConnectorPoint>) {
    const keys = Object.keys(left)
    if (keys.length !== Object.keys(right).length) return false
    return keys.every((key) => {
        const next = right[key]
        return next !== undefined && Math.abs(left[key].x - next.x) < 0.25 && Math.abs(left[key].y - next.y) < 0.25
    })
}

function scrollParentOf(node: HTMLElement): Element {
    for (let current: HTMLElement | null = node; current; current = current.parentElement) {
        const { overflowY } = getComputedStyle(current)
        if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight + 1) return current
    }
    return document.scrollingElement ?? document.documentElement
}

/**
 * Scrolls while a connector is held near the top or bottom edge, faster the closer it
 * gets. It waits for a short dwell so aiming at a machine near the edge does not scroll it away.
 */
function autoScrollNearEdge(session: DragSession, now: number, elapsedMs: number) {
    const { scroller, clientY } = session
    const isPage = scroller === document.scrollingElement || scroller === document.documentElement
    const bounds = isPage ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect()
    const overshoot = clientY < bounds.top + AUTO_SCROLL_EDGE
        ? clientY - (bounds.top + AUTO_SCROLL_EDGE)
        : clientY > bounds.bottom - AUTO_SCROLL_EDGE
            ? clientY - (bounds.bottom - AUTO_SCROLL_EDGE)
            : 0
    if (overshoot === 0) {
        session.edgeSince = null
        return
    }
    session.edgeSince ??= now
    if (now - session.edgeSince < AUTO_SCROLL_DWELL_MS) return
    const strength = Math.min(1, Math.abs(overshoot) / AUTO_SCROLL_EDGE)
    scroller.scrollTop += Math.sign(overshoot) * strength * strength * AUTO_SCROLL_SPEED * (elapsedMs / 16.7)
}

/**
 * FLIP for the board: compares where each `data-board-item` sits now with where it sat
 * after the previous commit, and slides anything that moved from its old place. Items
 * matched by id, so a card that React remounted in another column still glides across.
 */
function settleBoardItems(
    board: HTMLElement,
    previous: ReadonlyMap<string, BoardItemLayout>,
    animations: WeakMap<Element, Animation>,
    animate: boolean,
) {
    const origin = boardOrigin(board)
    const layout = new Map<string, BoardItemLayout>()
    const moves: Array<{ node: HTMLElement; dx: number; dy: number }> = []
    board.querySelectorAll<HTMLElement>('[data-board-item]').forEach((node) => {
        const id = node.dataset.boardItem
        if (!id) return
        // A card still gliding from an earlier change: measure its resting place, not where it is mid-flight.
        const offset = animations.get(node)?.playState === 'running' ? new DOMMatrixReadOnly(getComputedStyle(node).transform) : null
        const offsetX = offset?.m41 ?? 0
        const offsetY = offset?.m42 ?? 0
        const rect = node.getBoundingClientRect()
        const resting = { node, x: rect.left - origin.x - offsetX, y: rect.top - origin.y - offsetY }
        layout.set(id, resting)
        const before = previous.get(id)
        if (!animate || !before) return
        const dx = before.x - resting.x
        const dy = before.y - resting.y
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return
        const inFlight = before.node === node
        moves.push({ node, dx: dx + (inFlight ? offsetX : 0), dy: dy + (inFlight ? offsetY : 0) })
    })
    // Cards sit in per-row layers, so a card travelling past another row would slide under it.
    // Lift each moving card's layer while it travels, the farthest-travelling one on top.
    moves.sort((left, right) => Math.hypot(left.dx, left.dy) - Math.hypot(right.dx, right.dy))
    const started = moves.map(({ node, dx, dy }, rank) => {
        animations.get(node)?.cancel()
        const animation = node.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
            { duration: SETTLE_MS, easing: SETTLE_EASING },
        )
        animations.set(node, animation)
        const layer = node.parentElement
        if (layer && layer !== board) {
            layer.style.zIndex = String(Math.max(Number(layer.style.zIndex) || 0, 11 + rank))
            const lower = () => {
                const stillMoving = [...layer.querySelectorAll('[data-board-item]')].some((item) => animations.get(item)?.playState === 'running')
                if (!stillMoving) layer.style.zIndex = ''
            }
            animation.finished.then(lower, lower)
        }
        return animation
    })
    return { layout, started }
}

function selectCurrentAssignments(
    assignments: readonly BaseWorkerMachineAssignment[],
    shift: BaseProductionShift,
    today: string,
    currentJobByMachine: ReadonlyMap<string, string>,
) {
    return assignments.filter((assignment) => (
        assignment.shift === shift
        && assignment.active
        && isEffectiveOnDate(assignment.effective_from, assignment.effective_to, today)
        && currentJobByMachine.has(assignment.machine_id)
    ))
}

/**
 * The worker→machine lines. Lives in its own component so lines can follow animating
 * cards every frame without re-rendering the whole workspace.
 */
const AssignmentConnectorLayer = memo(function AssignmentConnectorLayer({
    layerRef,
    boardRef,
    links,
}: {
    layerRef: Ref<ConnectorLayerHandle>
    boardRef: RefObject<HTMLDivElement | null>
    links: ConnectorLink[]
}) {
    const [positions, setPositions] = useState<ConnectorPositions>({ workers: {}, machines: {} })
    const followUntil = useRef(0)
    const followFrame = useRef<number | null>(null)

    const measure = useCallback((paintThisFrame = false) => {
        const board = boardRef.current
        if (!board) return
        const next = measureConnectorHandles(board)
        const update = () => setPositions((current) => (
            samePoints(current.workers, next.workers) && samePoints(current.machines, next.machines) ? current : next
        ))
        if (paintThisFrame) flushSync(update)
        else update()
    }, [boardRef])

    const follow = useCallback((durationMs: number) => {
        followUntil.current = Math.max(followUntil.current, performance.now() + durationMs + 32)
        if (followFrame.current !== null) return
        const step = (now: number) => {
            // Commit inside this animation frame, or the lines paint a frame behind the cards.
            measure(true)
            followFrame.current = now < followUntil.current ? requestAnimationFrame(step) : null
        }
        followFrame.current = requestAnimationFrame(step)
    }, [measure])

    useImperativeHandle(layerRef, () => ({ measure, follow }), [measure, follow])

    useEffect(() => {
        const board = boardRef.current
        const frame = followFrame
        if (!board) return
        const remeasure = () => measure()
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(remeasure)
        observer?.observe(board)
        window.addEventListener('resize', remeasure)
        return () => {
            observer?.disconnect()
            window.removeEventListener('resize', remeasure)
            if (frame.current !== null) cancelAnimationFrame(frame.current)
        }
    }, [boardRef, measure])

    // New links from the Assign sheet draw themselves in; removed links fade instead of vanishing.
    const linkMotion = useCallback((node: SVGPathElement | null) => {
        if (!node) return
        if (node.dataset.drawIn === 'true' && !prefersReducedMotion()) {
            node.animate(
                [{ strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDasharray: '1 1', strokeDashoffset: 0 }],
                { duration: 380, easing: SETTLE_EASING },
            )
        }
        return () => {
            const parent = node.parentNode
            if (!parent || prefersReducedMotion()) return
            const ghost = node.cloneNode() as SVGPathElement
            ghost.removeAttribute('data-draw-in')
            parent.insertBefore(ghost, node)
            const fade = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' })
            fade.finished.then(() => ghost.remove(), () => ghost.remove())
        }
    }, [])

    return (
        <g>
            {links.map(({ key, workerId, machineId, palette, isHighlighted, isDimmed, drawIn }) => {
                const from = positions.workers[workerId]
                const to = positions.machines[machineId]
                if (!from || !to) return null
                return (
                    <path
                        key={key}
                        ref={linkMotion}
                        data-draw-in={drawIn ? 'true' : undefined}
                        d={connectorPath(from, to)}
                        pathLength={1}
                        fill="none"
                        stroke={isHighlighted ? palette.strokeActive : palette.stroke}
                        strokeWidth={isHighlighted ? 3.25 : 2.25}
                        strokeOpacity={isDimmed ? 0.22 : 1}
                        strokeLinecap="round"
                        className="transition-[stroke,stroke-width,stroke-opacity] duration-200"
                    />
                )
            })}
        </g>
    )
})

export default function BaseAssignmentWorkspace({
    initialData: liveData,
    tourMetadata,
    focusWorkerId,
    focusMachineId,
    initialShift,
}: {
    initialData: BaseAssignmentsInitialData
    tourMetadata?: Record<string, unknown>
    focusMachineId?: string
    focusWorkerId?: string
    initialShift?: BaseProductionShift
}) {
    const router = useRouter()
    const { language, tx, t } = useTranslation()
    const tourCopy = configurationTutorialCopy[language]
    const [tourStep, setTourStep] = useState<ConfigurationTourStep | null>(null)
    const tourLauncher = useRef<HTMLDivElement>(null)
    const tourReturnFocus = useRef<HTMLElement | null>(null)
    const tourReturnScroll = useRef<{ x: number; y: number } | null>(null)
    const completedHandoff = useRef<string | null>(null)
    useEffect(() => {
        if (tourStep === null && tourReturnScroll.current) {
            window.scrollTo({ left: tourReturnScroll.current.x, top: tourReturnScroll.current.y, behavior: 'instant' })
            tourReturnScroll.current = null
        }
        if (tourStep === null && completedHandoff.current) {
            // Restoring the user's search/focus/mobile view may remove the highlighted
            // worker. Resolve again after restoration, then use the replay launcher.
            const target = findTourTarget(completedHandoff.current)
            const fallback = tourLauncher.current?.querySelector<HTMLElement>('[data-tour-control="quiet-tour"], [data-tour-control="take-tour"]')
            const focus = target && !target.matches(':disabled, [aria-disabled="true"]') ? target : fallback
            focus?.focus({ preventScroll: true })
            completedHandoff.current = null
        }
    }, [tourStep])
    const tourSampleActive = tourStep !== null && tourStep !== 'ma-handoff'
    const tourLabels = configurationTourControlLabels(t, tx)
    const tourView = tourStep ? configurationTourView(tourStep) : null
    const initialData = useMemo(() => {
        if (!tourStep || tourStep === 'ma-handoff') return liveData
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
    const [showOtherShiftWorkers, setShowOtherShiftWorkers] = useState(false)
    const [draggingWorkerId, setDraggingWorkerId] = useState<string | null>(null)
    const [hoveredWorkerId, setHoveredWorkerId] = useState<string | null>(null)
    const [hoveredMachineId, setHoveredMachineId] = useState<string | null>(null)
    const [selectedPickerWorkerId, setPickerWorkerId] = useState<string | null>(null)
    // The machine whose quality is being chosen; kept after the dialog closes so it can fade out.
    const [qualityMachineId, setQualityMachineId] = useState<string | null>(null)
    const [qualityDialogOpen, setQualityDialogOpen] = useState(false)
    const [boardChanges, setBoardChanges] = useState<BoardChange[]>([])
    const [newLinkKey, setNewLinkKey] = useState<string | null>(null)
    const [selectedMobileView, setMobileView] = useState<'workers' | 'machines'>('workers')
    // Saved changes stay overlaid until the page data shows them; drop them once it does.
    const [changesCheckedAgainst, setChangesCheckedAgainst] = useState(liveData.assignments)
    if (changesCheckedAgainst !== liveData.assignments) {
        setChangesCheckedAgainst(liveData.assignments)
        setBoardChanges((changes) => {
            const next = changes.filter((change) => !(change.settled && (change.refreshing || isAssignmentChangeReflected(liveData.assignments, change, liveData.today))))
            return next.length === changes.length ? changes : next
        })
    }
    const shift = tourView?.shift ?? selectedShift
    const workerSearch = tourStep ? '' : search
    const selectedMachineTypes = useMemo(() => tourStep ? [] : machineTypeFilter, [tourStep, machineTypeFilter])
    const showInactive = tourView?.showInactive ?? includeInactive
    const pickerWorkerId = tourStep ? tourView?.pickerWorkerId ?? null : selectedPickerWorkerId
    const mobileView = tourStep === 'ma-handoff' ? 'workers' : tourView?.mobileView ?? selectedMobileView
    const boardRef = useRef<HTMLDivElement>(null)
    const connectorLayerRef = useRef<ConnectorLayerHandle>(null)
    const dragPathRef = useRef<SVGPathElement>(null)
    const dragSession = useRef<DragSession | null>(null)
    const hoverPausedUntil = useRef(0)
    const changeSequence = useRef(0)
    const changeTimers = useRef(new Set<number>())
    const boardLayout = useRef<ReadonlyMap<string, BoardItemLayout>>(new Map())
    const boardAnimations = useRef(new WeakMap<Element, Animation>())
    const boardMotionContextRef = useRef('')
    const latest = useRef<{
        undo: typeof handleUndoAssignment
        changes: BoardChange[]
        assignments: BaseWorkerMachineAssignment[]
        today: string
    } | null>(null)
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
    const jobById = useMemo(() => new Map(initialData.jobs.map((job) => [job.id, job])), [initialData.jobs])
    const loomsByJob = useMemo(() => {
        const result = new Map<string, number>()
        for (const machine of initialData.machines) {
            const jobId = machine.is_active ? currentJobByMachine.get(machine.id) : undefined
            if (jobId) result.set(jobId, (result.get(jobId) ?? 0) + 1)
        }
        return result
    }, [currentJobByMachine, initialData.machines])
    const qualityMachine = qualityMachineId ? machineById.get(qualityMachineId) ?? null : null

    // Tour samples never show live pending changes.
    const shownChanges = useMemo(() => tourStep ? [] : boardChanges, [boardChanges, tourStep])
    const pendingKey = shownChanges.find((change) => !change.settled)?.key ?? null
    const savingMachineIds = useMemo(
        () => new Set(shownChanges.filter((change) => !change.settled).map((change) => change.machineId)),
        [shownChanges],
    )
    // What the board shows: server rows with every pending change applied.
    const currentAssignments = useMemo(
        () => selectCurrentAssignments(applyPendingAssignmentChanges(initialData.assignments, shownChanges, initialData.today), shift, initialData.today, currentJobByMachine),
        [currentJobByMachine, initialData.assignments, initialData.today, shift, shownChanges],
    )
    // Where machines sit: the same, but a new change only moves its machine once it is placed.
    const placedAssignments = useMemo(
        () => selectCurrentAssignments(applyPendingAssignmentChanges(initialData.assignments, shownChanges.filter((change) => change.placed), initialData.today), shift, initialData.today, currentJobByMachine),
        [currentJobByMachine, initialData.assignments, initialData.today, shift, shownChanges],
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

    // Someone working the other shift is moved with switch workers, so they stay off this board.
    const heldByOtherShift = useMemo(() => workersHeldByOtherShift(
        currentAssignments,
        selectCurrentAssignments(applyPendingAssignmentChanges(initialData.assignments, shownChanges, initialData.today), shift === 'day' ? 'night' : 'day', initialData.today, currentJobByMachine),
    ), [currentAssignments, currentJobByMachine, initialData.assignments, initialData.today, shift, shownChanges])
    const candidateWorkers = useMemo(() => initialData.workers.filter((worker) => {
        if (!tourStep && focusWorkerId && worker.id !== focusWorkerId) return false
        if (!hasBaseOperatorEligibility(worker, initialData.today)) return false
        if (!showInactive && !worker.is_active) return false
        const isAvailable = worker.shift_availability === 'both' || worker.shift_availability === shift
        if (!isAvailable && !assignmentByWorker.has(worker.id)) return false
        return worker.name.toLowerCase().includes(workerSearch.trim().toLowerCase())
    }), [assignmentByWorker, initialData.workers, shift, showInactive, workerSearch, focusWorkerId, tourStep, initialData.today])
    // A worker who covers both shifts back to back can be brought back with the toggle under the search.
    const otherShiftHiddenCount = tourStep || focusWorkerId ? 0 : candidateWorkers.filter((worker) => heldByOtherShift.has(worker.id)).length
    const hidesOtherShift = !showOtherShiftWorkers && otherShiftHiddenCount > 0
    const visibleWorkers = useMemo(
        () => orderWorkersByAssignment(hidesOtherShift ? candidateWorkers.filter((worker) => !heldByOtherShift.has(worker.id)) : candidateWorkers, placedAssignments),
        [candidateWorkers, heldByOtherShift, hidesOtherShift, placedAssignments],
    )
    const machineTypes = useMemo(() => Array.from(new Set(
        initialData.machines
            .filter((machine) => showInactive || machine.is_active)
            .map((machine) => machine.machine_type),
    )).sort((left, right) => formatMachineType(left).localeCompare(formatMachineType(right))), [initialData.machines, showInactive])
    // Numbered labels 1..N, then A-Z. Sorting here orders both the per-worker groups and the unassigned tail.
    const visibleMachines = useMemo(() => initialData.machines.filter((machine) => {
        if (!tourStep && focusMachineId && machine.id !== focusMachineId) return false
        if (!showInactive && !machine.is_active) return false
        return selectedMachineTypes.length === 0 || selectedMachineTypes.includes(machine.machine_type)
    }).sort((left, right) => compareMachineLabels(
        { machineLabel: machineLabel(left), machineId: left.id },
        { machineLabel: machineLabel(right), machineId: right.id },
    )), [initialData.machines, selectedMachineTypes, showInactive, focusMachineId, tourStep])
    // Machines are laid out per worker so each worker's machines sit together, beside that worker's card.
    const machineGroups = useMemo(
        () => groupMachinesByWorker(visibleWorkers, visibleMachines, new Map(placedAssignments.map((assignment) => [assignment.machine_id, assignment.worker_id]))),
        [placedAssignments, visibleMachines, visibleWorkers],
    )
    const groupedMachines = useMemo(
        () => [...machineGroups.rows.flatMap((row) => row.machines), ...machineGroups.ungrouped],
        [machineGroups],
    )
    const selectableMachines = useMemo(
        () => initialData.machines.filter((machine) => machine.is_active && (selectedMachineTypes.length === 0 || selectedMachineTypes.includes(machine.machine_type))),
        [initialData.machines, selectedMachineTypes],
    )
    const pickerWorker = pickerWorkerId ? workerById.get(pickerWorkerId) : null
    const handoffWorker = tourSampleActive ? undefined : configurationHandoffWorker(visibleWorkers)
    const hasHandoffWorker = Boolean(handoffWorker)
    const tourSpecs = useMemo(() => configurationTourSpecs(hasHandoffWorker), [hasHandoffWorker])

    const connectorLinks = useMemo<ConnectorLink[]>(() => {
        const sheetPlaceholderIds = new Set(shownChanges.filter((change) => change.kind === 'assign' && change.source === 'picker' && !change.settled).map((change) => pendingAssignmentId(change.id)))
        const hasAnyHover = Boolean(hoveredWorkerId || (hoveredMachineId && !draggingWorkerId && assignmentByMachine.get(hoveredMachineId)))
        return visibleWorkers.flatMap((worker) => {
            const palette = workerColorMap.get(worker.id) ?? DEFAULT_PALETTE
            return (assignmentByWorker.get(worker.id) ?? []).map((assignment) => {
                const key = `${worker.id}->${assignment.machine_id}`
                const isHighlighted = hoveredWorkerId === worker.id || hoveredMachineId === assignment.machine_id || key === newLinkKey
                return {
                    key,
                    workerId: worker.id,
                    machineId: assignment.machine_id,
                    palette,
                    isHighlighted,
                    isDimmed: hasAnyHover && !isHighlighted,
                    drawIn: sheetPlaceholderIds.has(assignment.id),
                }
            })
        })
    }, [assignmentByMachine, assignmentByWorker, draggingWorkerId, hoveredMachineId, hoveredWorkerId, newLinkKey, shownChanges, visibleWorkers, workerColorMap])

    // Anything that changes the board's layout without a user change (shift, filters, search,
    // tour samples) snaps into place; only assignment changes glide.
    const boardMotionContext = [shift, workerSearch, selectedMachineTypes.join(','), showInactive, showOtherShiftWorkers, tourStep ?? '', focusWorkerId ?? '', focusMachineId ?? ''].join('|')
    useLayoutEffect(() => {
        const board = boardRef.current
        if (!board) return
        const animate = boardMotionContextRef.current === boardMotionContext && !tourStep && !prefersReducedMotion()
        boardMotionContextRef.current = boardMotionContext
        const { layout, started } = settleBoardItems(board, boardLayout.current, boardAnimations.current, animate)
        boardLayout.current = layout
        connectorLayerRef.current?.measure()
        if (started.length === 0) return
        connectorLayerRef.current?.follow(SETTLE_MS)
        // If the browser dropped frames, the per-frame follow can end early; settle the lines on the real finish.
        for (const animation of started) animation.finished.then(() => connectorLayerRef.current?.measure(), () => {})
    })
    useEffect(() => {
        const board = boardRef.current
        if (!board || typeof ResizeObserver === 'undefined') return
        // A resize moves cards without a change to animate: just remember where they now rest.
        const observer = new ResizeObserver(() => {
            boardLayout.current = settleBoardItems(board, boardLayout.current, boardAnimations.current, false).layout
        })
        observer.observe(board)
        return () => observer.disconnect()
    }, [])
    useLayoutEffect(() => {
        latest.current = { undo: handleUndoAssignment, changes: boardChanges, assignments: liveData.assignments, today: liveData.today }
    })
    useEffect(() => {
        const timers = changeTimers.current
        return () => timers.forEach((timer) => window.clearTimeout(timer))
    }, [])

    function schedule(callback: () => void, delayMs: number) {
        const timer = window.setTimeout(() => {
            changeTimers.current.delete(timer)
            callback()
        }, delayMs)
        changeTimers.current.add(timer)
    }

    function nextChangeId() {
        changeSequence.current += 1
        return String(changeSequence.current)
    }

    /** Shows a change at once (link first, then the machine settles beside its worker). */
    function beginChange(change: BoardChange) {
        const placeNow = prefersReducedMotion()
        // A newer change on the same machine and shift replaces anything still overlaid there.
        setBoardChanges((changes) => [
            ...changes.filter((existing) => existing.machineId !== change.machineId || existing.shift !== change.shift),
            { ...change, placed: placeNow },
        ])
        if (!placeNow) {
            schedule(() => setBoardChanges((changes) => changes.map((existing) => existing.id === change.id ? { ...existing, placed: true } : existing)), PLACE_DELAY_MS)
        }
        if (change.kind === 'assign') {
            const linkKey = `${change.workerId}->${change.machineId}`
            setNewLinkKey(linkKey)
            schedule(() => setNewLinkKey((current) => current === linkKey ? null : current), NEW_LINK_HIGHLIGHT_MS)
        }
    }

    function revertChange(changeId: string) {
        setBoardChanges((changes) => changes.filter((change) => change.id !== changeId))
    }

    function settleChange(changeId: string) {
        const live = latest.current
        setBoardChanges((changes) => changes.flatMap((change) => {
            if (change.id !== changeId) return [change]
            if (live && isAssignmentChangeReflected(live.assignments, change, live.today)) return []
            return [{ ...change, placed: true, settled: true }]
        }))
        // The save action revalidates this page, so its fresh data normally arrives with the
        // response. If it has not shown up after a while, ask for it once.
        schedule(() => {
            if (!latest.current?.changes.some((change) => change.id === changeId)) return
            setBoardChanges((changes) => changes.map((change) => change.id === changeId ? { ...change, refreshing: true } : change))
            router.refresh()
        }, SAVED_REFRESH_FALLBACK_MS)
    }

    function droppableMachineAt(clientX: number, clientY: number) {
        const target = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-machine-node]')
        const machineId = target?.dataset.machineNode ?? null
        return machineId && machineById.get(machineId)?.is_active && currentJobByMachine.has(machineId) && !savingMachineIds.has(machineId) ? machineId : null
    }

    function handleBoardPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
        // Cards slide under a resting cursor after a drop; wait for a real move before highlighting.
        if (draggingWorkerId || event.pointerType === 'touch' || event.timeStamp < hoverPausedUntil.current) return
        const target = event.target instanceof Element ? event.target : null
        const workerId = target?.closest<HTMLElement>('[data-worker-card]')?.dataset.workerCard ?? null
        const machineId = target?.closest<HTMLElement>('[data-machine-node]')?.dataset.machineNode ?? null
        if (workerId !== hoveredWorkerId) setHoveredWorkerId(workerId)
        if (machineId !== hoveredMachineId) setHoveredMachineId(machineId)
    }

    function handleBoardPointerLeave() {
        if (draggingWorkerId) return
        setHoveredWorkerId(null)
        setHoveredMachineId(null)
    }

    function handleConnectorPointerDown(event: ReactPointerEvent<HTMLElement>, workerId: string) {
        if (tourStep || isSampleRecordId(workerId) || draggingWorkerId || !workerById.get(workerId)?.is_active) return
        if (event.pointerType === 'mouse' && event.button !== 0) return
        const board = boardRef.current
        if (!board) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        dragSession.current = {
            workerId,
            pointerId: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY,
            scroller: scrollParentOf(board),
            targetMachineId: null,
            end: null,
            snapFrom: null,
            snapStart: 0,
            lastFrame: event.timeStamp,
            edgeSince: null,
            returnFrom: null,
            returnStart: 0,
        }
        setHoveredWorkerId(null)
        setHoveredMachineId(null)
        setDraggingWorkerId(workerId)
    }

    /** Let go somewhere that is not a machine: the line eases back into the worker's handle. */
    function returnConnector(session: DragSession, now: number) {
        session.returnFrom = session.end
        session.returnStart = now
        session.targetMachineId = null
        setHoveredMachineId(null)
        if (!session.returnFrom) {
            dragSession.current = null
            setDraggingWorkerId(null)
        }
    }

    const onDragPointerMove = useEffectEvent((event: PointerEvent) => {
        const session = dragSession.current
        if (!session || session.returnFrom || event.pointerId !== session.pointerId) return
        session.clientX = event.clientX
        session.clientY = event.clientY
    })

    const onDragPointerUp = useEffectEvent((event: PointerEvent) => {
        const session = dragSession.current
        if (!session || session.returnFrom || event.pointerId !== session.pointerId) return
        const machineId = droppableMachineAt(event.clientX, event.clientY)
        if (!machineId) {
            returnConnector(session, event.timeStamp)
            return
        }
        // The line is already snapped to this machine's handle, so the saved link appears exactly where it is.
        dragSession.current = null
        hoverPausedUntil.current = event.timeStamp + PLACE_DELAY_MS + SETTLE_MS
        setHoveredMachineId(null)
        setDraggingWorkerId(null)
        connectorLayerRef.current?.follow(200)
        void handleAssign(session.workerId, machineId, 'drag')
    })

    const onDragCancel = useEffectEvent((event: Event) => {
        const session = dragSession.current
        if (!session || session.returnFrom) return
        if (event instanceof PointerEvent && event.pointerId !== session.pointerId) return
        if (event instanceof KeyboardEvent && event.key !== 'Escape') return
        returnConnector(session, event.timeStamp)
    })

    const onDragFrame = useEffectEvent((now: number) => {
        const session = dragSession.current
        const board = boardRef.current
        if (!session || !board) return
        const elapsed = Math.min(48, Math.max(0, now - session.lastFrame))
        session.lastFrame = now
        const origin = boardOrigin(board)
        const workerHandle = board.querySelector(`[data-worker-handle="${CSS.escape(session.workerId)}"]`)
        if (!workerHandle) return
        const start = edgePoint(origin, workerHandle, 'right')
        const path = dragPathRef.current

        if (session.returnFrom) {
            const progress = Math.min(1, (now - session.returnStart) / RETURN_MS)
            path?.setAttribute('d', connectorPath(start, mixPoint(session.returnFrom, start, easeOutCubic(progress))))
            path?.setAttribute('stroke-opacity', String(1 - progress))
            if (progress >= 1) {
                dragSession.current = null
                setDraggingWorkerId(null)
            }
            return
        }

        autoScrollNearEdge(session, now, elapsed)
        const machineId = droppableMachineAt(session.clientX, session.clientY)
        if (machineId !== session.targetMachineId) {
            session.snapFrom = session.end
            session.snapStart = now
            session.targetMachineId = machineId
            setHoveredMachineId(machineId)
        }
        // Over a machine the line snaps onto its handle; elsewhere it follows the pointer.
        const machineHandle = machineId ? board.querySelector(`[data-machine-handle="${CSS.escape(machineId)}"]`) : null
        const target = machineHandle ? edgePoint(origin, machineHandle, 'left') : { x: session.clientX - origin.x, y: session.clientY - origin.y }
        const snap = session.snapFrom ? easeOutCubic(Math.min(1, (now - session.snapStart) / SNAP_MS)) : 1
        const end = session.snapFrom && snap < 1 ? mixPoint(session.snapFrom, target, snap) : target
        if (snap >= 1) session.snapFrom = null
        session.end = end
        path?.setAttribute('d', connectorPath(start, end))
        path?.setAttribute('stroke-dasharray', machineId ? 'none' : '7 5')
    })

    useLayoutEffect(() => {
        if (!draggingWorkerId) return
        const move = (event: PointerEvent) => onDragPointerMove(event)
        const up = (event: PointerEvent) => onDragPointerUp(event)
        const cancel = (event: Event) => onDragCancel(event)
        let frame = requestAnimationFrame(function step(now) {
            onDragFrame(now)
            frame = requestAnimationFrame(step)
        })
        const previousCursor = document.body.style.cursor
        document.body.style.cursor = 'grabbing'
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
        window.addEventListener('pointercancel', cancel)
        window.addEventListener('keydown', cancel)
        window.addEventListener('blur', cancel)
        return () => {
            cancelAnimationFrame(frame)
            document.body.style.cursor = previousCursor
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', up)
            window.removeEventListener('pointercancel', cancel)
            window.removeEventListener('keydown', cancel)
            window.removeEventListener('blur', cancel)
        }
    }, [draggingWorkerId])

    function openQualityDialog(machine: BaseProductionMachine) {
        if (tourStep || !machine.is_active) return
        // A connector dropped on a machine must not also open its quality.
        if (draggingWorkerId || dragSession.current) return
        if (isSampleRecordId(machine.id)) {
            toast.info(tourCommonCopy[language].sampleBanner)
            return
        }
        setQualityMachineId(machine.id)
        setQualityDialogOpen(true)
    }

    async function handleAssign(workerId: string, machineId: string, source: BoardChange['source'] = 'picker') {
        if (tourStep) return
        if (isSampleRecordId(workerId) || isSampleRecordId(machineId)) {
            toast.info(tourCommonCopy[language].sampleBanner)
            return
        }
        if (!currentJobByMachine.has(machineId)) {
            toast.error('This machine has no active production job. Create or select one before assigning a worker.')
            return
        }
        if (savingMachineIds.has(machineId)) return
        const previousAssignment = assignmentByMachine.get(machineId)
        if (previousAssignment?.worker_id === workerId) {
            setPickerWorkerId(null)
            return
        }
        let replaceExisting = false
        if (previousAssignment) {
            await nextPaint()
            const currentWorker = workerById.get(previousAssignment.worker_id)?.name ?? 'Another worker'
            if (!window.confirm(`${currentWorker} is already assigned to this machine for the ${shift} shift. Replace that primary assignment?`)) return
            replaceExisting = true
        }
        const changeId = nextChangeId()
        beginChange({ id: changeId, kind: 'assign', workerId, machineId, shift, key: `assign-${workerId}-${machineId}`, source, placed: false, settled: false, refreshing: false })
        setPickerWorkerId(null)
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
                // Someone else took the machine since this page loaded.
                const currentWorker = (result as { currentWorkerName?: string }).currentWorkerName ?? 'Another worker'
                const confirmed = window.confirm(`${currentWorker} is already assigned to this machine for the ${shift} shift. Replace that primary assignment?`)
                if (!confirmed) {
                    revertChange(changeId)
                    router.refresh()
                    return
                }
                replaceExisting = true
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
                revertChange(changeId)
                toast.error(error)
                return
            }
            settleChange(changeId)
            const assignmentId = result && typeof result === 'object' && 'assignmentId' in result
                ? (result as { assignmentId?: string | null }).assignmentId
                : null
            const changedAssignment = Boolean(assignmentId && (!previousAssignment || previousAssignment.worker_id !== workerId))
            toast.success(replaceExisting ? 'Primary worker replaced.' : 'Worker assigned.', changedAssignment && assignmentId ? {
                action: {
                    label: 'Undo',
                    onClick: () => void latest.current?.undo(assignmentId, machineId, shift, previousAssignment),
                },
            } : undefined)
        } catch (error) {
            revertChange(changeId)
            toast.error(error instanceof Error ? error.message : 'The assignment action could not be completed.')
        }
    }

    async function handleUndoAssignment(
        assignmentId: string,
        machineId: string,
        assignmentShift: BaseProductionShift,
        previousAssignment: BaseWorkerMachineAssignment | undefined,
    ) {
        if (tourStep) return
        if (isSampleRecordId(assignmentId) || isSampleRecordId(previousAssignment?.id) || isSampleRecordId(previousAssignment?.worker_id) || isSampleRecordId(previousAssignment?.machine_id)) {
            toast.info(tourCommonCopy[language].sampleBanner)
            return
        }
        if (savingMachineIds.has(machineId)) return
        const changeId = nextChangeId()
        const pending = { id: changeId, machineId, key: `undo-${assignmentId}`, source: 'picker', placed: false, settled: false, refreshing: false } as const
        beginChange(previousAssignment
            ? { ...pending, kind: 'assign', workerId: previousAssignment.worker_id, shift: previousAssignment.shift }
            : { ...pending, kind: 'remove', assignmentId, shift: assignmentShift })
        try {
            const removeResult = await removeBaseWorkerMachineAssignment({ assignmentId })
            const removeError = getActionError(removeResult)
            if (removeError) {
                revertChange(changeId)
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
                    // The new assignment is already gone; show what the server has now.
                    revertChange(changeId)
                    router.refresh()
                    toast.error(restoreError)
                    return
                }
            }

            settleChange(changeId)
            toast.success(previousAssignment ? 'Previous assignment restored.' : 'Assignment undone.')
        } catch (error) {
            revertChange(changeId)
            router.refresh()
            toast.error(error instanceof Error ? error.message : 'The assignment could not be undone.')
        }
    }

    async function handleRemove(assignmentId: string, machineId: string) {
        if (tourStep) return
        if (isSampleRecordId(assignmentId)) {
            toast.info(tourCommonCopy[language].sampleBanner)
            return
        }
        if (isPendingAssignmentId(assignmentId) || savingMachineIds.has(machineId)) return
        const changeId = nextChangeId()
        beginChange({ id: changeId, kind: 'remove', assignmentId, machineId, shift, key: `remove-${assignmentId}`, source: 'picker', placed: false, settled: false, refreshing: false })
        try {
            const result = await removeBaseWorkerMachineAssignment({ assignmentId })
            const error = getActionError(result)
            if (error) {
                revertChange(changeId)
                toast.error(error)
                return
            }
            settleChange(changeId)
            toast.success('Assignment removed.')
        } catch (error) {
            revertChange(changeId)
            toast.error(error instanceof Error ? error.message : 'The assignment could not be removed.')
        }
    }

    /** The name is the explicit control for a machine's quality; its card stretches the tap target, and the unlink and job links sit above it. */
    const renderMachineIdentity = (machine: BaseProductionMachine) => {
        const jobId = currentJobByMachine.get(machine.id)
        const job = jobId ? jobById.get(jobId) : undefined
        const name = machineLabel(machine)
        return (
            <div className="min-w-0 flex-1">
                {machine.is_active ? (
                    <button
                        type="button"
                        data-configuration-tour="quality"
                        onClick={() => openQualityDialog(machine)}
                        aria-label={tx(job ? 'Change quality for {machine}' : 'Choose quality for {machine}', { machine: name })}
                        className="block max-w-full truncate rounded-md text-left font-semibold text-ink outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-loom/40"
                    >
                        {name}
                    </button>
                ) : (
                    <p className="truncate font-semibold text-ink">{name}</p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">{formatMachineType(machine.machine_type)}{machine.is_active ? '' : ' · inactive'}</p>
                {job && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-body">
                        <Layers className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="truncate" title={job.quality_label}>{job.quality_label}</span>
                        <span className="shrink-0 text-muted-foreground">v{job.costing_version || 1}</span>
                        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </p>
                )}
            </div>
        )
    }

    const renderWorkerCard = (worker: BaseProductionWorker) => {
        const assignments = assignmentByWorker.get(worker.id) ?? []
        const palette = workerColorMap.get(worker.id) ?? DEFAULT_PALETTE
        return (
            <div
                key={worker.id}
                data-configuration-tour="worker"
                data-worker-card={worker.id}
                data-board-item={`worker:${worker.id}`}
                className={`flex min-h-[76px] items-center justify-between gap-3 rounded-xl border bg-surface px-3.5 py-3 shadow-xs transition-[border-color,background-color,box-shadow] duration-200 ${draggingWorkerId === worker.id ? 'border-saffron bg-saffron-soft/40 shadow-sm' : hoveredWorkerId === worker.id ? 'border-hairline-strong shadow-xs' : 'border-hairline'}`}
            >
                <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{worker.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatWorkerShift(worker.shift_availability)}{worker.is_active ? '' : ' · inactive'}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                        {assignments.map((assignment) => (
                            <span
                                key={assignment.machine_id}
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
                        data-tour-anchor={!tourSampleActive && worker.id === handoffWorker?.id ? 'assignments.first-assign' : undefined}
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg border-hairline px-3 text-xs font-medium text-body shadow-xs hover:border-hairline-strong hover:bg-surface-soft hover:text-ink"
                        onClick={() => setPickerWorkerId(worker.id)}
                        disabled={!worker.is_active}
                    >
                        <span data-i18n-skip="true">{t('assignments.assign')}</span>
                    </Button>
                    <span
                        role="button"
                        tabIndex={-1}
                        data-configuration-tour="drag"
                        data-worker-handle={worker.id}
                        onPointerDown={(event) => handleConnectorPointerDown(event, worker.id)}
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
    }

    /** A loom with no quality opens the same quality dialog as one that has a quality, so new looms never leave this board. */
    const renderChooseQuality = (machine: BaseProductionMachine, spacing: string) => (
        <button
            type="button"
            data-configuration-tour="job"
            onClick={() => openQualityDialog(machine)}
            aria-label={tx('Choose quality for {machine}', { machine: machineLabel(machine) })}
            className={`relative z-10 inline-flex items-center gap-1 text-xs font-medium text-saffron-deep underline underline-offset-2 hover:text-saffron ${spacing}`}
        >
            {tx('Choose quality')} <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </button>
    )

    const renderMachineCard = (machine: BaseProductionMachine) => {
        const assignment = assignmentByMachine.get(machine.id)
        const worker = assignment ? workerById.get(assignment.worker_id) : null
        const workerPalette = worker ? (workerColorMap.get(worker.id) ?? DEFAULT_PALETTE) : null
        const jobId = currentJobByMachine.get(machine.id) ?? 'none'
        const hasActiveJob = jobId !== 'none'
        const isSaving = savingMachineIds.has(machine.id)
        const isDropTargetValid = Boolean(draggingWorkerId && machine.is_active && hasActiveJob && !isSaving)
        return (
            <div
                key={machine.id}
                data-configuration-tour="machine"
                data-machine-node={machine.id}
                data-board-item={`machine:${machine.id}`}
                className={`relative min-h-[76px] rounded-xl border bg-surface px-3.5 py-3 shadow-xs transition-[border-color,background-color,box-shadow,scale] duration-200 ${machine.is_active && !draggingWorkerId ? 'cursor-pointer' : ''} ${hoveredMachineId === machine.id && draggingWorkerId ? 'scale-[1.01] border-saffron bg-saffron-soft/45 shadow-md ring-2 ring-saffron/20' : isDropTargetValid ? 'border-saffron/55 bg-saffron-soft/20' : hoveredMachineId === machine.id ? 'border-hairline-strong shadow-xs' : 'border-hairline'} ${!hasActiveJob ? 'opacity-90' : ''}`}
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
                    {renderMachineIdentity(machine)}
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
                                className={cn('inline-flex items-center justify-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-[1.35] transition-opacity duration-300', isPendingAssignmentId(assignment?.id) && 'opacity-70')}
                            >
                                <Check className="h-3 w-3" /> {worker.name}
                            </span>
                        ) : !hasActiveJob ? (
                            <Badge variant="outline" className="border-dashed text-muted-foreground text-xs"><span data-i18n-skip="true">{t('assignments.noJob')}</span></Badge>
                        ) : (
                            <Badge variant="warning" className="text-xs">Unassigned</Badge>
                        )}
                        {assignment && (
                            <Button
                                data-configuration-tour="remove"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Remove ${worker?.name ?? 'worker'} from ${machineLabel(machine)}`}
                                onClick={() => void handleRemove(assignment.id, machine.id)}
                                disabled={isPendingAssignmentId(assignment.id) || isSaving}
                                className="relative z-10 h-8 w-8 rounded-lg text-muted-foreground hover:bg-risk-soft/40 hover:text-risk transition-colors"
                            >
                                <Unlink className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                </div>
                {!hasActiveJob && machine.is_active && renderChooseQuality(machine, 'mt-2.5')}
            </div>
        )
    }

    return (
        <div className="configuration-workspace space-y-5" inert={tourStep !== null}>
            {!tourStep && (focusWorkerId || focusMachineId) && <div role="status" className="col-span-full rounded border p-3"><p>{(focusWorkerId && !liveData.workers.some(worker => worker.id === focusWorkerId)) || (focusMachineId && !liveData.machines.some(machine => machine.id === focusMachineId)) ? 'This record is unavailable.' : focusWorkerId ? 'Worker filter active' : 'Machine filter active'}</p><Link className="inline-flex min-h-11 items-center underline" href={`/owner/assignments?shift=${shift}`}>View all assignments</Link></div>}
            <PageHeader
                title="Worker–Machine Assignments"
                actions={<>
                    <div ref={tourLauncher} className="contents">
                        <TourInvitation
                            tourId="configuration"
                            userId={liveData.actorId}
                            orgId={liveData.orgId}
                            userMetadata={tourMetadata}
                            topics={[{
                                id: 'configuration-help', icon: CircleHelp, title: tourCopy.helpLabel, summary: tourCopy.helpIntro,
                                count: configurationHelpTopics.length, lang: language, i18nSkip: true,
                                content: <div className="space-y-3 divide-y divide-hairline">
                                    {configurationHelpTopics.map(topic => (
                                        <div key={topic} className="pt-3 first:pt-0">
                                            <h3 className="text-sm font-semibold text-ink">{tourCopy.help[topic][0]}</h3>
                                            <p className="mt-1 text-sm leading-relaxed text-body">{tourCopy.help[topic][1]}</p>
                                        </div>
                                    ))}
                                </div>,
                            }]}
                            onLaunch={() => {
                                if (pendingKey || selectedPickerWorkerId) return
                                tourReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
                                tourReturnScroll.current = { x: window.scrollX, y: window.scrollY }
                                setTourStep(configurationTourSteps[0])
                            }}
                        />
                    </div>
                    <Button asChild variant="outline" className="h-10 rounded-lg border-hairline bg-surface px-3.5 font-semibold text-ink shadow-xs hover:border-hairline-strong hover:bg-surface-soft hover:text-ink">
                        <Link data-tour-anchor="assignments.add-worker" data-configuration-tour="add-worker" onClick={event => { if (tourStep) event.preventDefault() }} prefetch={tourStep ? false : undefined} href={setupHref('worker')}>
                            <Plus className="h-4 w-4" /> Add worker
                        </Link>
                    </Button>
                    <Button asChild variant="outline" className="h-10 rounded-lg border-hairline bg-surface px-3.5 font-semibold text-ink shadow-xs hover:border-hairline-strong hover:bg-surface-soft hover:text-ink">
                        <Link data-configuration-tour="add-machine" onClick={event => { if (tourStep) event.preventDefault() }} prefetch={tourStep ? false : undefined} href={setupHref('machine')}>
                            <Plus className="h-4 w-4" /> Add machine
                        </Link>
                    </Button>
                    <Button asChild className={railPrimaryAction}>
                        <Link data-configuration-tour="daily-sheet" data-i18n-skip="true" lang={language} onClick={event => { if (tourStep) event.preventDefault() }} prefetch={tourStep ? false : undefined} href={`/owner/production?${new URLSearchParams({ tab: 'production', shift, returnTo: configurationReturnTo })}`}>
                            {tourCopy.dailySheetLabel} <ArrowUpRight className="h-4 w-4" />
                        </Link>
                    </Button>
                </>}
            />
            <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline/70 bg-surface/80 p-2 shadow-xs sm:px-3">
                    <LiquidSegmented
                        data-configuration-tour="shift"
                        aria-label={tx('Assignment shift')}
                        size="sm"
                        disabled={pendingKey !== null}
                        value={shift}
                        onValueChange={setShift}
                        options={[
                            { value: 'day', label: tx('Day shift'), icon: <Sun /> },
                            { value: 'night', label: tx('Night shift'), icon: <Moon /> },
                        ]}
                    />
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                        <span data-configuration-tour="count" className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-medium text-body shadow-xs" aria-live="polite">
                            {tx('Assignments: {count}', { count: contextAssignmentCount })} · {tx(shift === 'day' ? 'Day shift' : 'Night shift')}
                        </span>
                        <nav aria-label="Management links" className="flex flex-wrap items-center">
                            <Link data-configuration-tour="setup" onClick={event => { if (tourStep) event.preventDefault() }} prefetch={tourStep ? false : undefined} href={setupHref('worker').replace('add=worker&', '')} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-soft hover:text-ink">
                                Manage workers <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                            <Link onClick={event => { if (tourStep) event.preventDefault() }} prefetch={tourStep ? false : undefined} href={setupHref('machine').replace('add=machine&', '')} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-soft hover:text-ink">
                                Manage machines <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                        </nav>
                    </div>
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
                                className="h-10 sm:h-11 rounded-xl border border-hairline bg-surface pl-9 text-sm text-ink placeholder:text-[var(--color-placeholder)] focus:border-loom-subtle focus:ring-2 focus:ring-loom/10"
                            />
                        </div>
                        <MachineTypeFilters machineTypes={machineTypes} selected={selectedMachineTypes} onSelect={(machineType) => setSelectedMachineTypes(machineType ? [machineType] : [])} />
                    </div>
                    {otherShiftHiddenCount > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowOtherShiftWorkers((current) => !current)}
                                aria-pressed={showOtherShiftWorkers}
                                className="-mt-3 mb-3 inline-flex min-h-[44px] items-center text-xs font-semibold text-body underline-offset-2 hover:text-ink hover:underline"
                            >
                                {showOtherShiftWorkers ? tx('Hide workers on the other shift') : tx('Show {count} workers on the other shift', { count: otherShiftHiddenCount })}
                            </button>
                        )}
                    <div
                        ref={boardRef}
                        data-configuration-tour-connections
                        data-tour-anchor="assignments.columns"
                        onPointerMove={handleBoardPointerMove}
                        onPointerLeave={handleBoardPointerLeave}
                        className={`relative grid ${tourSampleActive ? 'flex-none' : 'flex-1'} min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] content-start gap-x-12 gap-y-4 lg:gap-x-16 overflow-y-auto overscroll-contain pr-2 ${draggingWorkerId ? 'select-none' : ''}`}
                    >
                        <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" aria-hidden="true">
                            <AssignmentConnectorLayer layerRef={connectorLayerRef} boardRef={boardRef} links={connectorLinks} />
                            {draggingWorkerId && (
                                <path
                                    ref={dragPathRef}
                                    fill="none"
                                    stroke={(workerColorMap.get(draggingWorkerId) ?? DEFAULT_PALETTE).strokeActive}
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                />
                            )}
                        </svg>
                        <div className="relative z-10 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted-foreground"><span>Workers</span><Users className="h-4 w-4" /></div>
                        <div className="relative z-10 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted-foreground"><span>Machines</span><Wrench className="h-4 w-4" /></div>
                        {machineGroups.rows.map((row) => (
                            <Fragment key={row.worker.id}>
                                <div className="relative z-10 self-center">{renderWorkerCard(row.worker)}</div>
                                <div data-machine-group={row.worker.id} className="relative z-10 space-y-2 self-center">
                                    {row.machines.map((machine) => renderMachineCard(machine))}
                                </div>
                            </Fragment>
                        ))}
                        {(machineGroups.idleWorkers.length > 0 || machineGroups.ungrouped.length > 0 || visibleWorkers.length === 0 || visibleMachines.length === 0) && (
                            <>
                                <div className="relative z-10 space-y-4 self-start">
                                    {visibleWorkers.length === 0 ? <EmptyInline label="No workers match this view." /> : machineGroups.idleWorkers.map((worker) => renderWorkerCard(worker))}
                                </div>
                                <div data-machine-group="none" className="relative z-10 space-y-4 self-start">
                                    {visibleMachines.length === 0 ? <EmptyInline label="No machines match this view." /> : machineGroups.ungrouped.map((machine) => renderMachineCard(machine))}
                                </div>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card data-configuration-tour="board" data-tour-anchor="assignments.columns" className="gap-3 rounded-2xl border border-hairline bg-surface shadow-xs md:hidden min-h-[calc(100vh-14.5rem)] flex flex-col">
                <CardHeader className="border-b border-hairline/70 p-4 pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-bold text-ink">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-hairline bg-surface-soft text-loom">
                            <Link2 className="h-4 w-4" />
                        </span>
                        Connect workers to machines
                    </CardTitle>
                    <LiquidSegmented
                        aria-label={tx('Assignment workspace view')}
                        size="sm"
                        value={mobileView}
                        onValueChange={setMobileView}
                        options={[
                            { value: 'workers', label: tx('Workers'), icon: <Users /> },
                            { value: 'machines', label: tx('Machines'), icon: <Wrench /> },
                        ]}
                    />
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
                                className="h-10 rounded-xl border border-hairline bg-surface pl-9 text-sm text-ink placeholder:text-[var(--color-placeholder)] focus:border-loom-subtle focus:ring-2 focus:ring-loom/10"
                            />
                        </div>
                        {otherShiftHiddenCount > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowOtherShiftWorkers((current) => !current)}
                                aria-pressed={showOtherShiftWorkers}
                                className="-mt-1 mb-2 inline-flex min-h-[44px] items-center text-xs font-semibold text-body underline-offset-2 hover:text-ink hover:underline"
                            >
                                {showOtherShiftWorkers ? tx('Hide workers on the other shift') : tx('Show {count} workers on the other shift', { count: otherShiftHiddenCount })}
                            </button>
                        )}
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
                                                    data-tour-anchor={!tourSampleActive && worker.id === handoffWorker?.id ? 'assignments.first-assign' : undefined}
                                                    data-configuration-tour-drag-fallback
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 rounded-lg border-hairline px-3 text-xs font-medium text-body shadow-xs hover:border-hairline-strong hover:bg-surface-soft hover:text-ink"
                                                    onClick={() => setPickerWorkerId(worker.id)}
                                                    disabled={!worker.is_active}
                                                >
                                                    {assignments.length ? 'Change' : <span data-i18n-skip="true">{t('assignments.assign')}</span>} <ChevronIcon />
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
                            <MachineTypeFilters machineTypes={machineTypes} selected={selectedMachineTypes} onSelect={(machineType) => setSelectedMachineTypes(machineType ? [machineType] : [])} />
                        </div>
                        <div className="space-y-2">
                            {visibleMachines.length === 0 ? <EmptyInline label="No machines match this view." /> : groupedMachines.map((machine) => {
                                const assignment = assignmentByMachine.get(machine.id)
                                const worker = assignment ? workerById.get(assignment.worker_id) : null
                                const workerPalette = worker ? (workerColorMap.get(worker.id) ?? DEFAULT_PALETTE) : null
                                const jobId = currentJobByMachine.get(machine.id) ?? 'none'
                                const hasActiveJob = jobId !== 'none'
                                return (
                                    <div key={machine.id} data-configuration-tour="machine" data-configuration-tour-connections className="relative rounded-xl border border-hairline bg-surface p-3 shadow-xs">
                                        <div className="flex items-start justify-between gap-2">
                                            {renderMachineIdentity(machine)}
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
                                                    <Badge variant="outline" className="border-dashed text-muted-foreground text-xs"><span data-i18n-skip="true">{t('assignments.noJob')}</span></Badge>
                                                ) : (
                                                    <Badge variant="warning" className="text-xs">Unassigned</Badge>
                                                )}
                                                {assignment && (
                                                    <Button
                                                        data-configuration-tour="remove"
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        aria-label={`Remove ${worker?.name ?? 'worker'} from ${machineLabel(machine)}`}
                                                        onClick={() => void handleRemove(assignment.id, machine.id)}
                                                        disabled={isPendingAssignmentId(assignment.id) || savingMachineIds.has(machine.id)}
                                                        className="relative z-10 h-8 w-8 rounded-lg text-muted-foreground hover:bg-risk-soft/40 hover:text-risk transition-colors"
                                                    >
                                                        <Unlink className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        {!hasActiveJob && machine.is_active && renderChooseQuality(machine, 'mt-2')}
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                )}
            </Card>

            </div>

            <Sheet modal={!tourStep} open={pickerWorkerId !== null} onOpenChange={(open) => { if (!open && !tourStep) setPickerWorkerId(null) }}>
                <SheetContent inert={Boolean(tourStep)} showCloseButton={!tourStep} hideOverlay={Boolean(tourStep)} data-configuration-tour="picker" data-configuration-picker-preview={tourStep ? "true" : undefined} onOpenAutoFocus={event => { if (tourStep) event.preventDefault() }} onCloseAutoFocus={event => { if (tourStep) event.preventDefault() }} onInteractOutside={event => { if (tourStep) event.preventDefault() }} side="bottom" className="max-h-[82dvh] rounded-t-2xl border-t border-hairline bg-surface pb-6 shadow-xl">
                    <SheetHeader className="pb-3 border-b border-hairline/60">
                        <SheetTitle className="text-lg font-bold text-ink">Assign {pickerWorker?.name ?? 'worker'}</SheetTitle>
                        <SheetDescription className="text-xs text-body">Choose a machine for the {shift} shift. Saving happens immediately.</SheetDescription>
                    </SheetHeader>
                    <div className="space-y-3 overflow-y-auto px-4 pt-3">
                        <MachineTypeFilters machineTypes={machineTypes} selected={selectedMachineTypes} onSelect={(machineType) => setSelectedMachineTypes(machineType ? [machineType] : [])} />
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
                                        <span className="text-xs font-semibold text-muted-foreground"><span data-i18n-skip="true">{t('assignments.noJob')}</span></span>
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
            <MachineQualityDialog
                machine={qualityMachine}
                open={qualityDialogOpen && !tourStep}
                onOpenChange={setQualityDialogOpen}
                jobs={activeJobs}
                currentJobId={qualityMachine ? currentJobByMachine.get(qualityMachine.id) ?? null : null}
                loomsByJob={loomsByJob}
                today={initialData.today}
                productionHref={`/owner/production?${new URLSearchParams({ tab: 'jobs', returnTo: configurationReturnTo })}`}
                onSaved={() => router.refresh()}
            />
            {tourStep === 'ma-linked' && <div data-configuration-tour="saved-preview" data-i18n-skip="true" lang={language} role="status" className="col-span-full flex items-center justify-between gap-3 rounded-xl border border-hairline bg-surface p-4 shadow-sm">
                <div>
                    <p className="font-semibold">{tourCopy.savedLabel}</p>
                    <p className="text-sm text-body">{tourCopy.worker} → {tourCopy.machine} · {tourCopy.dayShiftLabel}</p>
                </div>
                <Button type="button" variant="outline" disabled>{tourCopy.undoLabel}</Button>
            </div>}
            {tourStep && <GuidedTour tourId="configuration" steps={tourSpecs} step={tourStep}
                onDone={() => { completedHandoff.current = tourSpecs[tourSpecs.length - 1].anchor }}
                onStepChange={setTourStep} launcher={tourLauncher} returnFocus={tourReturnFocus} userId={liveData.actorId}
                copy={step => {
                    const content = step === 'ma-handoff' && !handoffWorker ? tourCopy.emptyHandoff : tourCopy.steps[step]
                    const controls = Object.fromEntries(Object.entries(tourLabels).map(([key, value]) => [key, `“${value}”`]))
                    return {
                        ...content, body: formatTourText(content.body, controls),
                        detail: 'detail' in content && typeof content.detail === 'string' ? formatTourText(content.detail, controls) : undefined,
                    }
                }} />}
        </div>
    )
}

function EmptyInline({ label }: { label: string }) {
    return <div className="rounded-xl border border-dashed border-hairline bg-surface-soft/40 p-5 text-center"><p className="text-sm text-body">{label}</p></div>
}

function MachineTypeFilters({
    machineTypes,
    selected,
    onSelect,
}: {
    machineTypes: string[]
    selected: string[]
    onSelect: (machineType: string | null) => void
}) {
    const { tx } = useTranslation()
    if (machineTypes.length === 0) return null

    return (
        <div className="max-w-full overflow-x-auto pb-0.5" data-configuration-tour="types">
            <LiquidSegmented
                size="sm"
                aria-label={tx('Filter by machine type')}
                value={selected.length === 1 ? selected[0] : 'all'}
                onValueChange={(value) => onSelect(value === 'all' ? null : value)}
                options={[
                    { value: 'all', label: tx('All') },
                    ...machineTypes.map((machineType) => ({ value: machineType, label: formatMachineType(machineType) })),
                ]}
            />
        </div>
    )
}

function ChevronIcon() {
    return <span aria-hidden="true">›</span>
}
