'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { toast } from 'sonner'
import {
    AlertCircle,
    CheckCircle2,
    ExternalLink,
    History,
    Layers,
    Loader2,
    MoreVertical,
    Plus,
    Search,
    StopCircle,
    Wrench,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/page-header'
import { compareMachineLabels } from '@/lib/base-machine-register'
import { formatINR } from '@/lib/finance'
import { formatBaseMeters } from '@/lib/base-production-analytics'
import { useTourSample } from '@/lib/tours/sample-context'
import { tourSurfaceProps } from '@/lib/tours/sample-surface'
import {
    activateSavedCostingForProduction,
    bulkAssignMachinesToQuality,
    deactivateQualityProduction,
    setBaseMachineJobContext,
} from './actions'
import type {
    BaseProductionCosting,
    BaseProductionJob,
    BaseProductionMachine,
    BaseMachineJobContext,
} from '@/lib/base-production-core'

interface BaseActiveQualitiesProps {
    jobs: BaseProductionJob[]
    costings: BaseProductionCosting[]
    machines: BaseProductionMachine[]
    machineJobContexts: BaseMachineJobContext[]
    today: string
    /** Metres each quality produced today, from the saved daily sheets. */
    todayMetersByJobId?: ReadonlyMap<string, number>
    /** False until a sheet is saved for today, so "not entered" is never shown as zero. */
    todayEntered?: boolean
    onViewHistory?: (jobId: string) => void
    isActivateModalOpen?: boolean
    onOpenActivateModalChange?: (open: boolean) => void
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

function isContextEffective(context: BaseMachineJobContext, today: string) {
    return (
        context.active &&
        context.effective_from <= today &&
        (!context.effective_to || context.effective_to >= today)
    )
}

export default function BaseActiveQualities({
    jobs,
    costings,
    machines,
    machineJobContexts,
    today,
    todayMetersByJobId,
    todayEntered = false,
    onViewHistory,
    isActivateModalOpen = false,
    onOpenActivateModalChange,
}: BaseActiveQualitiesProps) {
    const router = useRouter()
    const { t } = useTranslation()
    const tourStep = useTourSample('production')?.step
    const surface = tourSurfaceProps(Boolean(tourStep))
    const [pendingAction, setPendingAction] = useState<string | null>(null)
    const [costingSearch, setCostingSearch] = useState('')

    // Bulk assign modal state
    const [assigningJob, setAssigningJob] = useState<BaseProductionJob | null>(null)
    const [selectedMachineIds, setSelectedMachineIds] = useState<Set<string>>(new Set())

    // Deactivate modal state
    const [deactivatingJob, setDeactivatingJob] = useState<BaseProductionJob | null>(null)

    // Active jobs
    const activeJobs = useMemo(
        () => jobs.filter((j) => j.status === 'planned' || j.status === 'active'),
        [jobs]
    )

    // Machine lookup
    const activeMachines = useMemo(() => machines.filter((m) => m.is_active), [machines])

    // Machine -> current active job ID
    const currentJobIdByMachine = useMemo(() => {
        const map = new Map<string, string>()
        for (const context of machineJobContexts) {
            if (isContextEffective(context, today) && !map.has(context.machine_id)) {
                map.set(context.machine_id, context.job_id)
            }
        }
        return map
    }, [machineJobContexts, today])

    // Job ID -> machine count currently running
    const runningMachinesByJobId = useMemo(() => {
        const map = new Map<string, BaseProductionMachine[]>()
        for (const machine of activeMachines) {
            const jobId = currentJobIdByMachine.get(machine.id)
            if (jobId) {
                const list = map.get(jobId) ?? []
                list.push(machine)
                map.set(jobId, list)
            }
        }
        return map
    }, [activeMachines, currentJobIdByMachine])

    // Every metre today belongs to a quality, so the map's sum is the day's total.
    const todayTotalMeters = useMemo(
        () => [...(todayMetersByJobId?.values() ?? [])].reduce((total, meters) => total + meters, 0),
        [todayMetersByJobId]
    )

    // While the Production tour teaches a dialog, show the real one for the first running quality.
    const tourAssigningJob = tourStep === 'pd-looms' ? activeJobs[0] ?? null : null
    const shownAssigningJob = tourAssigningJob ?? assigningJob
    const shownSelectedMachineIds = tourAssigningJob
        ? new Set((runningMachinesByJobId.get(tourAssigningJob.id) ?? []).map((m) => m.id))
        : selectedMachineIds
    const activateDialogOpen = isActivateModalOpen || tourStep === 'pd-activate'

    // Costing group -> latest costing version
    const latestVersionByGroup = useMemo(() => {
        const map = new Map<string, number>()
        for (const costing of costings) {
            const groupKey = costing.costing_group_id || costing.id
            const currentMax = map.get(groupKey) ?? 0
            if (costing.version_number > currentMax) {
                map.set(groupKey, costing.version_number)
            }
        }
        return map
    }, [costings])

    // Costing ID -> active job ID
    const activeJobByCostingId = useMemo(() => {
        const map = new Map<string, BaseProductionJob>()
        for (const job of activeJobs) {
            map.set(job.costing_id, job)
        }
        return map
    }, [activeJobs])

    // Filtered costings for Activate modal
    const filteredCostings = useMemo(() => {
        const query = costingSearch.trim().toLowerCase()
        if (!query) return costings
        return costings.filter(
            (c) =>
                c.quality_label.toLowerCase().includes(query) ||
                (c.costing_group_id && c.costing_group_id.toLowerCase().includes(query))
        )
    }, [costings, costingSearch])

    async function handleActivateCosting(costingId: string) {
        if (pendingAction) return
        setPendingAction(`activate-${costingId}`)

        try {
            const result = await activateSavedCostingForProduction({ costingId })
            if ('error' in result && result.error) {
                toast.error(result.error)
                return
            }

            toast.success('Quality activated for production.')
            onOpenActivateModalChange?.(false)
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not activate quality.')
        } finally {
            setPendingAction(null)
        }
    }

    // Open Assign Machines modal
    function openAssignMachines(job: BaseProductionJob) {
        const currentlyAssigned = runningMachinesByJobId.get(job.id) ?? []
        setSelectedMachineIds(new Set(currentlyAssigned.map((m) => m.id)))
        setAssigningJob(job)
    }

    // Toggle machine in bulk assign modal
    function toggleMachineSelection(machineId: string) {
        setSelectedMachineIds((prev) => {
            const next = new Set(prev)
            if (next.has(machineId)) {
                next.delete(machineId)
            } else {
                next.add(machineId)
            }
            return next
        })
    }

    // Submit bulk assign
    async function handleSaveMachineAssignments() {
        if (!assigningJob || pendingAction) return
        setPendingAction('bulk-assign')

        try {
            const previouslyAssigned = (runningMachinesByJobId.get(assigningJob.id) ?? []).map((m) => m.id)
            const previousSet = new Set(previouslyAssigned)
            const selectedArray = Array.from(selectedMachineIds)

            // Machines to add
            const toAdd = selectedArray.filter((id) => !previousSet.has(id))
            // Machines to unassign from this quality
            const toRemove = previouslyAssigned.filter((id) => !selectedMachineIds.has(id))

            // Add new assignments
            if (toAdd.length > 0) {
                const addResult = await bulkAssignMachinesToQuality({
                    jobId: assigningJob.id,
                    machineIds: toAdd,
                    effectiveFrom: today,
                })
                if ('error' in addResult && addResult.error) {
                    toast.error(addResult.error)
                    return
                }
            }

            // Remove unselected assignments
            for (const machineId of toRemove) {
                await setBaseMachineJobContext({
                    machineId,
                    jobId: null,
                    effectiveFrom: today,
                })
            }

            toast.success('Loom assignments updated successfully.')
            setAssigningJob(null)
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not update assignments.')
        } finally {
            setPendingAction(null)
        }
    }

    // Deactivate handler
    async function handleConfirmDeactivate() {
        if (!deactivatingJob || pendingAction) return
        setPendingAction(`deactivate-${deactivatingJob.id}`)

        try {
            const result = await deactivateQualityProduction({ jobId: deactivatingJob.id })
            if ('error' in result && result.error) {
                toast.error(result.error)
                return
            }

            const machinesClosed = (result as { machines_closed?: number }).machines_closed ?? 0
            if (machinesClosed > 0) {
                toast.success(`Quality deactivated. Production ended on ${machinesClosed} machine(s).`)
            } else {
                toast.success('Quality deactivated from production.')
            }

            setDeactivatingJob(null)
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not deactivate quality.')
        } finally {
            setPendingAction(null)
        }
    }

    return (
        <section className="space-y-3" data-production-tour="qualities">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <h2 className="text-lg font-semibold text-ink" data-i18n-skip="true">
                    {t('production.activeQualities')}
                    <span className="ml-2 font-medium tabular-nums text-muted-foreground">{activeJobs.length}</span>
                </h2>
                <p className="text-sm text-muted-foreground" data-i18n-skip="true">{t('production.activeQualitiesHint')}</p>
            </div>

            {activeJobs.length === 0 && (
                <EmptyState
                    icon={Layers}
                    title={t('production.noActiveQualities')}
                    description={t('production.noActiveQualitiesHint')}
                    className="rounded-2xl"
                    action={onOpenActivateModalChange && (
                        <Button variant="outline" onClick={() => onOpenActivateModalChange(true)} className="min-h-[44px] rounded-lg md:min-h-0" data-i18n-skip="true">
                            <Plus className="size-4" aria-hidden="true" />
                            {t('production.activateQuality')}
                        </Button>
                    )}
                />
            )}

            {activeJobs.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs lg:grid lg:grid-cols-[minmax(0,2.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.5fr)_minmax(0,1.4fr)_auto] lg:gap-x-6">
                    <div aria-hidden="true" className="hidden h-10 items-center border-b border-hairline bg-surface-soft/40 px-6 text-xs font-medium text-muted-foreground lg:col-span-full lg:grid lg:grid-cols-subgrid" data-i18n-skip="true">
                        <span>{t('production.qualityColumn')}</span>
                        <span>{t('production.weaverWage')}</span>
                        <span>{t('production.cost')}</span>
                        <span>{t('production.loomsColumn')}</span>
                        <span>{t('production.today')}</span>
                        <span />
                    </div>
                    <ul className="divide-y divide-hairline lg:col-span-full lg:grid lg:grid-cols-subgrid">
                        {activeJobs.map((job) => {
                            const assignedMachines = runningMachinesByJobId.get(job.id) ?? []
                            const machineCount = assignedMachines.length
                            const loomLabels = assignedMachines
                                .map((machine) => ({ machineLabel: machine.custom_label || machine.name, machineId: machine.id }))
                                .sort(compareMachineLabels)
                                .map((machine) => machine.machineLabel)
                            const groupKey = job.costing_group_id || job.costing_id
                            const latestVersion = latestVersionByGroup.get(groupKey) ?? (job.costing_version || 1)
                            const hasNewerVersion = latestVersion > (job.costing_version || 1)
                            const jobTodayMeters = todayMetersByJobId?.get(job.id) ?? 0
                            const todayShare = todayEntered && todayTotalMeters > 0 ? Math.round((jobTodayMeters / todayTotalMeters) * 100) : null

                            return (
                                <li
                                    key={job.id}
                                    className="grid grid-cols-2 items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-6 lg:col-span-full lg:grid-cols-subgrid lg:gap-y-0"
                                >
                                    <div className="min-w-0">
                                        <h3 className="break-words text-base font-semibold text-ink">{job.quality_label}</h3>
                                        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums" data-i18n-skip="true">
                                            v{job.costing_version || 1} · {t('production.activeSince', { date: formatDateOnly(job.start_date || job.created_at) })}
                                        </p>
                                        {hasNewerVersion && (
                                            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-[var(--wv-ochre-800)]" data-i18n-skip="true">
                                                <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                                                {t('production.newerCostingAvailable', { version: latestVersion })}
                                            </p>
                                        )}
                                    </div>

                                    <div className="min-w-0">
                                        <p className="text-xs text-muted-foreground lg:sr-only" data-i18n-skip="true">{t('production.weaverWage')}</p>
                                        <p className="text-sm text-body tabular-nums" data-i18n-skip="true">
                                            {job.worker_rate_per_meter > 0
                                                ? <><span className="font-semibold text-ink">{formatINR(job.worker_rate_per_meter)}</span>/m</>
                                                : '—'}
                                        </p>
                                    </div>

                                    <div className="min-w-0">
                                        <p className="text-xs text-muted-foreground lg:sr-only" data-i18n-skip="true">{t('production.cost')}</p>
                                        <p className="text-sm text-body tabular-nums" data-i18n-skip="true">
                                            {job.planned_cost_per_meter > 0
                                                ? <><span className="font-semibold text-ink">{formatINR(job.planned_cost_per_meter)}</span>/m</>
                                                : '—'}
                                        </p>
                                    </div>

                                    <div className="col-span-2 min-w-0 lg:col-span-1">
                                        <p className="text-xs text-muted-foreground lg:sr-only" data-i18n-skip="true">{t('production.loomsColumn')}</p>
                                        {machineCount > 0 ? (
                                            <>
                                                <p className="text-sm font-semibold text-ink" data-i18n-skip="true">{t('production.loomsRunningCount', { count: machineCount })}</p>
                                                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground" title={loomLabels.join(', ')}>
                                                    {loomLabels.join(' · ')}
                                                </p>
                                            </>
                                        ) : (
                                            <p className="text-sm text-muted-foreground" data-i18n-skip="true">{t('production.noLoomsAssigned')}</p>
                                        )}
                                    </div>

                                    <div className="col-start-2 row-start-1 text-right lg:col-start-auto lg:row-start-auto lg:text-left">
                                        <p className="text-xs text-muted-foreground lg:sr-only" data-i18n-skip="true">{t('production.today')}</p>
                                        {todayMetersByJobId && (
                                            <div className="flex items-center justify-end gap-3 lg:justify-start">
                                                <span className="text-base font-semibold tracking-tight text-ink tabular-nums">
                                                    {todayEntered ? formatBaseMeters(jobTodayMeters) : '—'}
                                                </span>
                                                {todayShare !== null && (
                                                    <>
                                                        <span aria-hidden="true" className="hidden h-1.5 max-w-[7.5rem] flex-1 overflow-hidden rounded-full bg-surface-soft lg:block">
                                                            <span className="ui-meter-fill block h-full rounded-full bg-ink" style={{ width: `${todayShare}%` }} />
                                                        </span>
                                                        <span className="text-xs text-muted-foreground tabular-nums">{todayShare}%</span>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="col-span-2 flex items-center gap-2 lg:col-span-1 lg:justify-end">
                                        <Button
                                            variant="outline"
                                            onClick={() => openAssignMachines(job)}
                                            className="min-h-[44px] flex-1 rounded-lg lg:min-h-0 lg:flex-none"
                                        >
                                            <Wrench className="size-4" aria-hidden="true" />
                                            <span data-i18n-skip="true">{t('production.assignLooms')}</span>
                                        </Button>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-[44px] shrink-0 rounded-lg text-muted-foreground hover:text-ink lg:size-10"
                                                    data-i18n-skip="true"
                                                    aria-label={t('production.qualityActions')}
                                                >
                                                    <MoreVertical className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg">
                                                <DropdownMenuLabel className="text-xs text-muted-foreground">Quality</DropdownMenuLabel>
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/owner/quotes?search=${encodeURIComponent(job.quality_label)}`}>
                                                        <ExternalLink className="mr-2 h-4 w-4" /> View in Costings
                                                    </Link>
                                                </DropdownMenuItem>
                                                {onViewHistory && (
                                                    <DropdownMenuItem onClick={() => onViewHistory(job.id)}>
                                                        <History className="mr-2 h-4 w-4" /> Production History
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => setDeactivatingJob(job)}
                                                    className="text-[var(--wv-madder-600)] focus:text-[var(--wv-madder-600)] focus:bg-[var(--wv-madder-50)]"
                                                >
                                                    <StopCircle className="mr-2 h-4 w-4" /> Deactivate Quality
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            )}

            {/* Modal: Activate Quality from Saved Costings */}
            <Dialog open={activateDialogOpen} onOpenChange={onOpenActivateModalChange} {...surface.root}>
                <DialogContent className="max-w-xl rounded-2xl p-0 overflow-hidden" {...surface.content}>
                    <DialogHeader className="p-5 pb-3 border-b border-hairline bg-surface-soft/40">
                        <DialogTitle className="text-base font-bold text-ink">Activate Quality for Production</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Choose an immutable Saved Costing to make it actively available on your looms.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-5 space-y-4">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={costingSearch}
                                onChange={(e) => setCostingSearch(e.target.value)}
                                placeholder="Search saved qualities..."
                                className="h-10 pl-9 rounded-xl border-hairline text-sm"
                            />
                        </div>

                        <div data-production-tour="activate" className="max-h-80 overflow-y-auto divide-y divide-hairline rounded-xl border border-hairline">
                            {filteredCostings.length === 0 && (
                                <div className="p-6 text-center text-xs text-muted-foreground">
                                    No saved costings found. Create one in{' '}
                                    <Link href="/owner/estimator" className="font-semibold text-loom hover:underline">
                                        Cost Estimator
                                    </Link>
                                    .
                                </div>
                            )}

                            {filteredCostings.map((costing) => {
                                const activeJob = activeJobByCostingId.get(costing.id)
                                const isAlreadyActive = Boolean(activeJob)
                                const runningCount = activeJob ? (runningMachinesByJobId.get(activeJob.id) ?? []).length : 0
                                const isPending = pendingAction === `activate-${costing.id}`

                                return (
                                    <div
                                        key={costing.id}
                                        className="flex items-center justify-between p-3 hover:bg-surface-soft/40 transition-colors gap-3"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <p className="truncate text-sm font-bold text-ink">{costing.quality_label}</p>
                                                <span className="rounded bg-surface-soft px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground">
                                                    v{costing.version_number}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Weaver wage: {costing.worker_rate_per_meter > 0 ? formatINR(costing.worker_rate_per_meter) : '—'}/m · <span data-i18n-skip="true">{t('production.cost')}</span>: {costing.production_cost_per_meter > 0 ? formatINR(costing.production_cost_per_meter) : '—'}/m
                                            </p>
                                        </div>

                                        <div className="shrink-0">
                                            {isAlreadyActive ? (
                                                <Badge variant="outline" className="text-[var(--wv-moss-700)] border-[var(--wv-moss-200)] bg-[var(--wv-moss-50)] text-xs font-semibold py-1">
                                                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                                    Active ({runningCount} {runningCount === 1 ? 'loom' : 'looms'})
                                                </Badge>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    disabled={isPending}
                                                    onClick={() => handleActivateCosting(costing.id)}
                                                    className="h-8 rounded-lg px-3 text-xs font-bold bg-loom text-white shadow-xs hover:bg-loom-elevated"
                                                >
                                                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Activate'}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <DialogFooter className="p-4 border-t border-hairline bg-surface-soft/20 flex justify-between sm:justify-between items-center">
                        <span className="text-xs text-muted-foreground">
                            Missing a quality? <Link href="/owner/estimator" className="font-semibold text-loom hover:underline">Create new costing</Link>
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => onOpenActivateModalChange?.(false)} className="rounded-xl">
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal: Bulk Assign Machines */}
            <Dialog open={shownAssigningJob !== null} onOpenChange={(open) => !open && setAssigningJob(null)} {...surface.root}>
                <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden" {...surface.content}>
                    <DialogHeader className="p-5 pb-3 border-b border-hairline bg-surface-soft/40">
                        <DialogTitle className="text-base font-bold text-ink">
                            Assign Looms to {shownAssigningJob?.quality_label}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Select the looms that should produce this quality. Workers already operating these looms remain assigned.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-5 space-y-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
                            <span>Available Looms ({activeMachines.length} total)</span>
                            <span className="font-bold text-ink">{shownSelectedMachineIds.size} Selected</span>
                        </div>

                        <div data-production-tour="allocate" className="max-h-80 overflow-y-auto space-y-2 rounded-xl border border-hairline p-3">
                            {activeMachines.length === 0 && (
                                <p className="text-center text-xs text-muted-foreground py-4">
                                    No active machines found. Add machines in{' '}
                                    <Link href="/owner/machines?register=base" className="font-semibold text-loom hover:underline">
                                        Machines
                                    </Link>
                                    .
                                </p>
                            )}

                            {activeMachines.map((machine) => {
                                const currentJobId = currentJobIdByMachine.get(machine.id)
                                const isCurrentQuality = currentJobId === shownAssigningJob?.id
                                const isOtherQuality = Boolean(currentJobId && currentJobId !== shownAssigningJob?.id)
                                const otherJob = isOtherQuality ? jobs.find((j) => j.id === currentJobId) : null
                                const isSelected = shownSelectedMachineIds.has(machine.id)

                                return (
                                    <label
                                        key={machine.id}
                                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                                            isOtherQuality
                                                ? 'opacity-60 bg-surface-soft/40 border-hairline cursor-not-allowed'
                                                : isSelected
                                                ? 'bg-loom/5 border-loom shadow-xs'
                                                : 'bg-surface border-hairline hover:bg-surface-soft/30'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <input
                                                type="checkbox"
                                                disabled={isOtherQuality}
                                                checked={isSelected}
                                                onChange={() => toggleMachineSelection(machine.id)}
                                                className="h-4 w-4 rounded border-hairline text-loom focus:ring-loom"
                                            />
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-bold text-ink">
                                                    {machine.custom_label || machine.name}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground capitalize">
                                                    {machine.machine_type.replaceAll('_', ' ')}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="shrink-0 text-right">
                                            {isOtherQuality ? (
                                                <Badge variant="outline" className="text-[10px] text-[var(--wv-ochre-800)] border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)]">
                                                    Producing {otherJob?.quality_label ?? 'other quality'}
                                                </Badge>
                                            ) : isCurrentQuality ? (
                                                <Badge variant="secondary" className="text-[10px] font-semibold text-[var(--wv-moss-700)] bg-[var(--wv-moss-50)]">
                                                    Currently assigned
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                                    Available
                                                </Badge>
                                            )}
                                        </div>
                                    </label>
                                )
                            })}
                        </div>
                    </div>

                    <DialogFooter className="p-4 border-t border-hairline bg-surface-soft/20 flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setAssigningJob(null)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            disabled={pendingAction !== null}
                            onClick={handleSaveMachineAssignments}
                            className="h-9 px-4 rounded-xl bg-loom text-white font-bold shadow-xs hover:bg-loom-elevated"
                        >
                            {pendingAction === 'bulk-assign' ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                `Assign ${shownSelectedMachineIds.size} Loom(s)`
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal: Confirm Deactivate Quality */}
            <Dialog open={deactivatingJob !== null} onOpenChange={(open) => !open && setDeactivatingJob(null)}>
                <DialogContent className="max-w-md rounded-2xl p-5">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-ink">
                            Deactivate &ldquo;{deactivatingJob?.quality_label}&rdquo;?
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground pt-1">
                            {deactivatingJob && (runningMachinesByJobId.get(deactivatingJob.id) ?? []).length > 0 ? (
                                <>
                                    This quality is currently running on{' '}
                                    <strong className="text-ink">
                                        {(runningMachinesByJobId.get(deactivatingJob.id) ?? []).length} looms
                                    </strong>
                                    . Deactivating it will stop production of this quality on those looms.
                                    <br />
                                    <br />
                                    <span className="text-[var(--wv-moss-700)] font-semibold">
                                        ✓ Worker-machine assignments will remain unchanged.
                                    </span>
                                    <br />
                                    <span className="text-muted-foreground">
                                        ✓ Historical production records remain intact.
                                    </span>
                                </>
                            ) : (
                                <>
                                    This quality will be removed from Active Production.
                                    <br />
                                    <br />
                                    <span className="text-muted-foreground">
                                        ✓ Historical production records will remain unchanged.
                                    </span>
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="mt-4 flex justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeactivatingJob(null)}
                            disabled={pendingAction !== null}
                            className="rounded-xl"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            disabled={pendingAction !== null}
                            onClick={handleConfirmDeactivate}
                            className="rounded-xl font-bold"
                        >
                            {pendingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Deactivate Quality'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    )
}
