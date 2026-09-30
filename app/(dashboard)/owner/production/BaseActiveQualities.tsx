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
    Factory,
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
import { Card } from '@/components/ui/card'
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
import { formatINR } from '@/lib/finance'
import {
    activateSavedCostingForProduction,
    bulkAssignMachinesToQuality,
    deactivateQualityProduction,
    setBaseMachineJobContext,
    validateQualityActivationYarnAction,
} from './actions'
import { mutateYarnStock } from '../stock/yarn-actions'
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
    onActivateQuality?: () => void
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
    onActivateQuality,
    onViewHistory,
    isActivateModalOpen = false,
    onOpenActivateModalChange,
}: BaseActiveQualitiesProps) {
    const router = useRouter()
    const { t } = useTranslation()
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

    type YarnRequirementItem = {
        yarn_id: string | null
        yarn_name: string
        yarn_key: string
        role: string
        kg_per_100m: number
        current_stock_kg: number
        status: 'available' | 'zero_stock' | 'missing'
    }

    const [yarnGateModal, setYarnGateModal] = useState<{
        costingId: string
        qualityLabel: string
        yarns: YarnRequirementItem[]
    } | null>(null)

    const [inlineAddYarn, setInlineAddYarn] = useState<{
        yarnName: string
        weightKg: string
        reason: string
        saving: boolean
    } | null>(null)

    // Activate handler with Rule 1 Activation Gate check
    async function handleActivateCosting(costingId: string) {
        if (pendingAction) return
        setPendingAction(`activate-${costingId}`)

        try {
            // Check required yarn stock first
            const check = await validateQualityActivationYarnAction({ costingId })
            if ('validation' in check && check.validation) {
                if (!check.validation.can_activate) {
                    setYarnGateModal({
                        costingId,
                        qualityLabel: check.validation.quality_label,
                        yarns: check.validation.yarns,
                    })
                    return
                }
            }

            const result = await activateSavedCostingForProduction({ costingId })
            if ('error' in result && result.error) {
                toast.error(result.error)
                return
            }

            if ('blocked' in result && result.blocked) {
                const val = (result as { validation?: { quality_label?: string; yarns?: YarnRequirementItem[] } }).validation
                setYarnGateModal({
                    costingId,
                    qualityLabel: val?.quality_label ?? 'Quality',
                    yarns: val?.yarns ?? [],
                })
                return
            }

            toast.success('Quality activated for production.')
            onOpenActivateModalChange?.(false)
            setYarnGateModal(null)
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not activate quality.')
        } finally {
            setPendingAction(null)
        }
    }

    async function handleSaveInlineYarn() {
        if (!inlineAddYarn || !yarnGateModal) return
        const kg = Number(inlineAddYarn.weightKg)
        if (isNaN(kg) || kg <= 0) {
            toast.error('Enter a valid positive quantity in kg.')
            return
        }

        setInlineAddYarn(prev => prev ? { ...prev, saving: true } : null)
        try {
            const res = await mutateYarnStock({
                action: 'receipt',
                requestId: crypto.randomUUID(),
                payload: {
                    yarn_name: inlineAddYarn.yarnName,
                    weight_kg: kg,
                    reason: inlineAddYarn.reason.trim() || `Added for Quality "${yarnGateModal.qualityLabel}" activation`,
                }
            })

            if ('error' in res && res.error) {
                toast.error(res.error)
                setInlineAddYarn(prev => prev ? { ...prev, saving: false } : null)
                return
            }

            toast.success(`Added ${kg} kg for ${inlineAddYarn.yarnName}`)
            setInlineAddYarn(null)

            // Re-run validation automatically
            const check = await validateQualityActivationYarnAction({ costingId: yarnGateModal.costingId })
            if ('validation' in check && check.validation) {
                setYarnGateModal({
                    costingId: yarnGateModal.costingId,
                    qualityLabel: check.validation.quality_label,
                    yarns: check.validation.yarns,
                })
                if (check.validation.can_activate) {
                    toast.success('All required yarns are now available! Ready to activate.')
                }
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to add yarn stock.')
            setInlineAddYarn(prev => prev ? { ...prev, saving: false } : null)
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
        <section className="space-y-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-ink">Active Qualities</h2>
                        <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-bold">
                            {activeJobs.length} active
                        </Badge>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        Saved qualities currently activated for production across your looms.
                    </p>
                </div>

                <Button
                    size="sm"
                    onClick={onActivateQuality ?? (() => onOpenActivateModalChange?.(true))}
                    data-tour-anchor="production.activate"
                    className="production-inline-activate h-9 px-3.5 rounded-xl bg-loom text-white font-bold shadow-xs hover:bg-loom-elevated"
                >
                    <Plus className="mr-1.5 h-4 w-4" /> <span data-i18n-skip="true">{t('production.activateQuality')}</span>
                </Button>
            </div>

            {/* Empty state if no active qualities */}
            {activeJobs.length === 0 && (
                <Card className="rounded-2xl border border-dashed border-hairline-strong bg-surface p-8 text-center shadow-xs">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-soft text-muted-foreground mb-3">
                        <Layers className="h-6 w-6" />
                    </div>
                    <h3 className="text-base font-bold text-ink">No Active Qualities</h3>
                    <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                        Activate a quality from your Saved Costings shortlist to start assigning looms and tracking production.
                    </p>
                </Card>
            )}

            {/* Active Qualities Cards Grid */}
            {activeJobs.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4">
                    {activeJobs.map((job) => {
                        const assignedMachines = runningMachinesByJobId.get(job.id) ?? []
                        const machineCount = assignedMachines.length
                        const groupKey = job.costing_group_id || job.costing_id
                        const latestVersion = latestVersionByGroup.get(groupKey) ?? (job.costing_version || 1)
                        const hasNewerVersion = latestVersion > (job.costing_version || 1)

                        return (
                            <Card
                                key={job.id}
                                className="group relative overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs transition-all hover:border-hairline-strong hover:shadow-sm"
                            >
                                <div className="p-4 sm:p-5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="truncate text-base font-bold text-ink" title={job.quality_label}>
                                                    {job.quality_label}
                                                </h3>
                                                <span className="inline-flex items-center rounded-md bg-surface-soft px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                                                    v{job.costing_version || 1}
                                                </span>
                                            </div>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                Activated {formatDateOnly(job.start_date || job.created_at)}
                                            </p>
                                        </div>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    className="h-8 w-8 text-muted-foreground hover:text-ink rounded-lg"
                                                    data-i18n-skip="true"
                                                    aria-label={t('production.qualityActions')}
                                                >
                                                    <MoreVertical className="h-4 w-4" />
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

                                    {/* Newer costing version badge if available */}
                                    {hasNewerVersion && (
                                        <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)]/80 px-2.5 py-1 text-[11px] font-semibold text-[var(--wv-ochre-900)]">
                                            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[var(--wv-ochre-700)]" />
                                            <span>Newer costing v{latestVersion} available</span>
                                        </div>
                                    )}

                                    {/* Operational specs */}
                                    <div className="mt-3.5 flex flex-wrap gap-2 text-xs">
                                        <div className="rounded-lg bg-surface-soft/60 px-2.5 py-1 text-body">
                                            Weaver wage: <span className="font-bold text-ink">{job.worker_rate_per_meter > 0 ? formatINR(job.worker_rate_per_meter) : '—'}/m</span>
                                        </div>
                                        {job.planned_cost_per_meter > 0 && (
                                            <div className="rounded-lg bg-surface-soft/60 px-2.5 py-1 text-body">
                                                <span data-i18n-skip="true">{t('production.cost')}</span>: <span className="font-bold text-ink">{formatINR(job.planned_cost_per_meter)}/m</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Machine status and Primary CTA */}
                                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-hairline/60 pt-3">
                                        <div className="flex items-center gap-1.5">
                                            <Factory className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-xs font-semibold text-ink">
                                                {machineCount > 0 ? (
                                                    <span className="text-[var(--wv-moss-700)] font-bold">
                                                        {machineCount} {machineCount === 1 ? 'Loom' : 'Looms'} running
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">0 Looms assigned</span>
                                                )}
                                            </span>
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openAssignMachines(job)}
                                            className="h-8 rounded-lg px-3 text-xs font-bold border-hairline bg-surface hover:bg-surface-soft"
                                        >
                                            <Wrench className="mr-1.5 h-3.5 w-3.5" /> <span data-i18n-skip="true">{t('production.assignLooms')}</span>
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Modal: Activate Quality from Saved Costings */}
            <Dialog open={isActivateModalOpen} onOpenChange={onOpenActivateModalChange}>
                <DialogContent className="max-w-xl rounded-2xl p-0 overflow-hidden">
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

                        <div className="max-h-80 overflow-y-auto divide-y divide-hairline rounded-xl border border-hairline">
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
            <Dialog open={assigningJob !== null} onOpenChange={(open) => !open && setAssigningJob(null)}>
                <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-5 pb-3 border-b border-hairline bg-surface-soft/40">
                        <DialogTitle className="text-base font-bold text-ink">
                            Assign Looms to {assigningJob?.quality_label}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Select the looms that should produce this quality. Workers already operating these looms remain assigned.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-5 space-y-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
                            <span>Available Looms ({activeMachines.length} total)</span>
                            <span className="font-bold text-ink">{selectedMachineIds.size} Selected</span>
                        </div>

                        <div className="max-h-80 overflow-y-auto space-y-2 rounded-xl border border-hairline p-3">
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
                                const isCurrentQuality = currentJobId === assigningJob?.id
                                const isOtherQuality = Boolean(currentJobId && currentJobId !== assigningJob?.id)
                                const otherJob = isOtherQuality ? jobs.find((j) => j.id === currentJobId) : null
                                const isSelected = selectedMachineIds.has(machine.id)

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
                                `Assign ${selectedMachineIds.size} Loom(s)`
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

            {/* Modal: Rule 1 Quality Activation Gate - Yarn Required Before Production */}
            <Dialog open={yarnGateModal !== null} onOpenChange={(open) => !open && setYarnGateModal(null)}>
                <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-5 pb-3 border-b border-hairline bg-[var(--wv-ochre-50)]/50">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-[var(--wv-ochre-700)] shrink-0" />
                            <DialogTitle className="text-base font-bold text-ink">
                                Yarn required before production
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-xs text-muted-foreground pt-1">
                            &ldquo;{yarnGateModal?.qualityLabel}&rdquo; requires yarn that is not currently available in Yarn Stock. Every required yarn must have positive stock before activation.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-5 space-y-4">
                        <div className="rounded-xl border border-hairline overflow-hidden">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-surface-soft/60 border-b border-hairline text-muted-foreground font-semibold">
                                    <tr>
                                        <th className="p-2.5">Yarn</th>
                                        <th className="p-2.5 text-right">Requirement</th>
                                        <th className="p-2.5 text-right">Current Stock</th>
                                        <th className="p-2.5 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-hairline">
                                    {yarnGateModal?.yarns.map((item) => {
                                        const isAvailable = item.status === 'available'
                                        return (
                                            <tr key={item.yarn_key} className="hover:bg-surface-soft/20">
                                                <td className="p-2.5">
                                                    <p className="font-bold text-ink">{item.yarn_name}</p>
                                                    <span className="text-[10px] text-muted-foreground capitalize">{item.role}</span>
                                                </td>
                                                <td className="p-2.5 text-right tabular-nums font-medium text-ink">
                                                    {item.kg_per_100m.toFixed(2)} kg / 100m
                                                </td>
                                                <td className="p-2.5 text-right tabular-nums">
                                                    {isAvailable ? (
                                                        <span className="font-semibold text-[var(--wv-moss-700)]">{item.current_stock_kg.toFixed(2)} kg</span>
                                                    ) : item.status === 'zero_stock' ? (
                                                        <span className="font-medium text-[var(--wv-ochre-700)]">0 kg</span>
                                                    ) : (
                                                        <span className="text-muted-foreground italic">None</span>
                                                    )}
                                                </td>
                                                <td className="p-2.5 text-right">
                                                    {isAvailable ? (
                                                        <Badge variant="outline" className="text-[var(--wv-moss-700)] border-[var(--wv-moss-200)] bg-[var(--wv-moss-50)] text-[10px] font-semibold">
                                                            <CheckCircle2 className="mr-1 h-3 w-3" /> Available
                                                        </Badge>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setInlineAddYarn({
                                                                yarnName: item.yarn_name,
                                                                weightKg: '',
                                                                reason: '',
                                                                saving: false
                                                            })}
                                                            className="h-7 px-2.5 text-[11px] font-bold text-loom border-loom/40 hover:bg-loom/10"
                                                        >
                                                            <Plus className="mr-1 h-3 w-3" /> Add Stock
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {yarnGateModal?.yarns.every(y => y.status === 'available') ? (
                            <p className="text-xs text-[var(--wv-moss-800)] bg-[var(--wv-moss-50)] p-2.5 rounded-lg border border-[var(--wv-moss-200)] flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-[var(--wv-moss-600)] shrink-0" />
                                All required yarns are now available! You can proceed to activate this quality.
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                Click <strong>Add Stock</strong> to record loose yarn currently available in your factory. Activating a quality does not consume yarn.
                            </p>
                        )}
                    </div>

                    <DialogFooter className="p-4 border-t border-hairline bg-surface-soft/20 flex justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setYarnGateModal(null)}
                            className="rounded-xl"
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            disabled={!yarnGateModal?.yarns.every(y => y.status === 'available') || pendingAction !== null}
                            onClick={() => yarnGateModal && handleActivateCosting(yarnGateModal.costingId)}
                            className="h-9 px-4 rounded-xl bg-loom text-white font-bold shadow-xs hover:bg-loom-elevated disabled:opacity-50"
                        >
                            {pendingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Activate Quality'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal: Inline Add Yarn Stock */}
            <Dialog open={inlineAddYarn !== null} onOpenChange={(open) => !open && setInlineAddYarn(null)}>
                <DialogContent className="max-w-sm rounded-2xl p-5">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-ink">
                            Add Yarn Stock: {inlineAddYarn?.yarnName}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground pt-1">
                            Record raw/loose yarn physically received or on-hand in your factory.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                        <div>
                            <label className="text-xs font-semibold text-ink">Quantity in kg *</label>
                            <Input
                                type="number"
                                step="0.001"
                                min="0.001"
                                placeholder="e.g. 50.0"
                                value={inlineAddYarn?.weightKg ?? ''}
                                onChange={(e) => setInlineAddYarn(prev => prev ? { ...prev, weightKg: e.target.value } : null)}
                                className="mt-1 h-9 rounded-lg"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-ink">Reference or Reason (optional)</label>
                            <Input
                                placeholder={`Added for ${yarnGateModal?.qualityLabel ?? 'quality'} activation`}
                                value={inlineAddYarn?.reason ?? ''}
                                onChange={(e) => setInlineAddYarn(prev => prev ? { ...prev, reason: e.target.value } : null)}
                                className="mt-1 h-9 rounded-lg text-xs"
                            />
                        </div>
                    </div>

                    <DialogFooter className="mt-4 flex justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setInlineAddYarn(null)}
                            disabled={inlineAddYarn?.saving}
                            className="rounded-xl"
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            disabled={inlineAddYarn?.saving || !inlineAddYarn?.weightKg}
                            onClick={handleSaveInlineYarn}
                            className="rounded-xl font-bold bg-loom text-white shadow-xs hover:bg-loom-elevated"
                        >
                            {inlineAddYarn?.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Yarn Stock'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    )
}
