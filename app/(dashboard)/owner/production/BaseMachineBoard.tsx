'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    ArrowRightLeft,
    Check,
    CheckCircle2,
    Loader2,
    Moon,
    Plus,
    Search,
    Sun,
    Trash2,
    Users,
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
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    setBaseMachineJobContext,
    switchBaseMachineQuality,
    upsertBaseWorkerMachineAssignment,
    removeBaseWorkerMachineAssignment,
} from './actions'
import type {
    BaseProductionJob,
    BaseProductionMachine,
    BaseProductionWorker,
    BaseWorkerMachineAssignment,
    BaseMachineJobContext,
} from '@/lib/base-production-core'

interface BaseMachineBoardProps {
    machines: BaseProductionMachine[]
    jobs: BaseProductionJob[]
    workers: BaseProductionWorker[]
    assignments: BaseWorkerMachineAssignment[]
    machineJobContexts: BaseMachineJobContext[]
    today: string
    onActivateQualityClick?: () => void
}

function isEffectiveOnDate(effectiveFrom: string, effectiveTo: string | null, date: string) {
    return effectiveFrom <= date && (!effectiveTo || effectiveTo >= date)
}

export default function BaseMachineBoard({
    machines,
    jobs,
    workers,
    assignments,
    machineJobContexts,
    today,
    onActivateQualityClick,
}: BaseMachineBoardProps) {
    const router = useRouter()
    const [search, setSearch] = useState('')
    const [filterStatus, setFilterStatus] = useState<'all' | 'running' | 'available'>('all')
    const [pendingKey, setPendingKey] = useState<string | null>(null)

    // Switch Quality modal
    const [switchingMachine, setSwitchingMachine] = useState<BaseProductionMachine | null>(null)
    const [selectedTargetJobId, setSelectedTargetJobId] = useState<string>('')

    // Assign Quality modal (for available machine)
    const [assigningMachine, setAssigningMachine] = useState<BaseProductionMachine | null>(null)
    const [selectedAssignJobId, setSelectedAssignJobId] = useState<string>('')

    // Manage Workers sheet
    const [managingMachine, setManagingMachine] = useState<BaseProductionMachine | null>(null)
    const [manageWorkerShift, setManageWorkerShift] = useState<'day' | 'night'>('day')
    const [workerSearch, setWorkerSearch] = useState('')

    // Active jobs
    const activeJobs = useMemo(
        () => jobs.filter((j) => j.status === 'planned' || j.status === 'active'),
        [jobs]
    )
    const jobById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs])
    const workerById = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers])

    // Machine active contexts
    const currentJobByMachine = useMemo(() => {
        const map = new Map<string, BaseProductionJob>()
        for (const context of machineJobContexts) {
            if (context.active && isEffectiveOnDate(context.effective_from, context.effective_to, today)) {
                const job = jobById.get(context.job_id)
                if (job && (job.status === 'planned' || job.status === 'active') && !map.has(context.machine_id)) {
                    map.set(context.machine_id, job)
                }
            }
        }
        return map
    }, [machineJobContexts, today, jobById])

    // Machine worker assignments (day & night)
    const machineWorkers = useMemo(() => {
        const map = new Map<string, { day?: BaseProductionWorker; dayAssignmentId?: string; night?: BaseProductionWorker; nightAssignmentId?: string }>()
        for (const assignment of assignments) {
            if (assignment.active && isEffectiveOnDate(assignment.effective_from, assignment.effective_to, today)) {
                const current = map.get(assignment.machine_id) ?? {}
                const worker = workerById.get(assignment.worker_id)
                if (worker) {
                    if (assignment.shift === 'day') {
                        current.day = worker
                        current.dayAssignmentId = assignment.id
                    } else if (assignment.shift === 'night') {
                        current.night = worker
                        current.nightAssignmentId = assignment.id
                    }
                }
                map.set(assignment.machine_id, current)
            }
        }
        return map
    }, [assignments, today, workerById])

    // Active machines list
    const activeMachines = useMemo(() => machines.filter((m) => m.is_active), [machines])

    // Filtered machines
    const filteredMachines = useMemo(() => {
        return activeMachines.filter((machine) => {
            const hasJob = currentJobByMachine.has(machine.id)
            if (filterStatus === 'running' && !hasJob) return false
            if (filterStatus === 'available' && hasJob) return false

            if (!search.trim()) return true
            const query = search.trim().toLowerCase()
            const nameMatch = (machine.custom_label || machine.name).toLowerCase().includes(query)
            const typeMatch = machine.machine_type.toLowerCase().includes(query)
            const jobMatch = hasJob && currentJobByMachine.get(machine.id)?.quality_label.toLowerCase().includes(query)
            const workers = machineWorkers.get(machine.id)
            const workerMatch =
                (workers?.day?.name.toLowerCase().includes(query) ?? false) ||
                (workers?.night?.name.toLowerCase().includes(query) ?? false)

            return nameMatch || typeMatch || jobMatch || workerMatch
        })
    }, [activeMachines, currentJobByMachine, filterStatus, search, machineWorkers])

    // Counts
    const runningCount = useMemo(() => {
        return activeMachines.filter((m) => currentJobByMachine.has(m.id)).length
    }, [activeMachines, currentJobByMachine])

    const availableCount = activeMachines.length - runningCount

    // Open switch quality
    function openSwitchQuality(machine: BaseProductionMachine) {
        setSwitchingMachine(machine)
        const currentJob = currentJobByMachine.get(machine.id)
        // Find first other active job
        const otherJob = activeJobs.find((j) => j.id !== currentJob?.id)
        setSelectedTargetJobId(otherJob?.id ?? '')
    }

    // Submit switch quality
    async function handleSwitchQualitySubmit() {
        if (!switchingMachine || !selectedTargetJobId || pendingKey) return
        setPendingKey(`switch-${switchingMachine.id}`)

        try {
            const result = await switchBaseMachineQuality({
                machineId: switchingMachine.id,
                toJobId: selectedTargetJobId,
                effectiveFrom: today,
            })

            if ('error' in result && result.error) {
                toast.error(result.error)
                return
            }

            toast.success(`Switched ${switchingMachine.custom_label || switchingMachine.name} to ${jobById.get(selectedTargetJobId)?.quality_label}.`)
            setSwitchingMachine(null)
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not switch quality.')
        } finally {
            setPendingKey(null)
        }
    }

    // Open assign quality
    function openAssignQuality(machine: BaseProductionMachine) {
        setAssigningMachine(machine)
        setSelectedAssignJobId(activeJobs[0]?.id ?? '')
    }

    // Submit assign quality
    async function handleAssignQualitySubmit() {
        if (!assigningMachine || !selectedAssignJobId || pendingKey) return
        setPendingKey(`assign-${assigningMachine.id}`)

        try {
            const result = await setBaseMachineJobContext({
                machineId: assigningMachine.id,
                jobId: selectedAssignJobId,
                effectiveFrom: today,
            })

            if ('error' in result && result.error) {
                toast.error(result.error)
                return
            }

            toast.success(`Quality assigned to ${assigningMachine.custom_label || assigningMachine.name}.`)
            setAssigningMachine(null)
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not assign quality.')
        } finally {
            setPendingKey(null)
        }
    }

    // Worker management handlers
    async function handleAssignWorker(workerId: string) {
        if (!managingMachine || pendingKey) return
        setPendingKey(`assign-worker-${workerId}`)

        try {
            const result = await upsertBaseWorkerMachineAssignment({
                machineId: managingMachine.id,
                workerId,
                shift: manageWorkerShift,
                effectiveFrom: today,
                replaceExisting: true,
            })

            if ('error' in result && result.error) {
                toast.error(result.error)
                return
            }

            toast.success(`Assigned worker to ${managingMachine.custom_label || managingMachine.name} (${manageWorkerShift} shift).`)
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not assign worker.')
        } finally {
            setPendingKey(null)
        }
    }

    async function handleRemoveWorker(assignmentId: string) {
        if (pendingKey) return
        setPendingKey(`remove-worker-${assignmentId}`)

        try {
            const result = await removeBaseWorkerMachineAssignment({ assignmentId })
            if ('error' in result && result.error) {
                toast.error(result.error)
                return
            }

            toast.success('Worker unassigned.')
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not remove worker.')
        } finally {
            setPendingKey(null)
        }
    }

    // Workers available for shift in managing sheet
    const availableWorkersForShift = useMemo(() => {
        const query = workerSearch.trim().toLowerCase()
        return workers.filter((w) => {
            if (!w.is_active) return false
            if (w.pay_type === 'fixed_monthly') return false
            const matchesShift = w.shift_availability === 'both' || w.shift_availability === manageWorkerShift
            if (!matchesShift) return false
            if (!query) return true
            return w.name.toLowerCase().includes(query)
        })
    }, [workers, manageWorkerShift, workerSearch])

    return (
        <section className="space-y-4 pt-2">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                    <h2 className="text-lg font-bold text-ink">Machine Board</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        Loom-by-loom status, active quality, and operator assignments.
                    </p>
                </div>

                <div className="flex items-center gap-1.5 rounded-xl border border-hairline bg-surface p-1 shadow-xs">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilterStatus('all')}
                        className={`h-7 px-3 text-xs font-semibold rounded-lg ${
                            filterStatus === 'all'
                                ? 'bg-loom text-white hover:bg-loom hover:text-white shadow-xs'
                                : 'text-muted-foreground hover:text-ink'
                        }`}
                    >
                        All ({activeMachines.length})
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilterStatus('running')}
                        className={`h-7 px-3 text-xs font-semibold rounded-lg ${
                            filterStatus === 'running'
                                ? 'bg-loom text-white hover:bg-loom hover:text-white shadow-xs'
                                : 'text-muted-foreground hover:text-ink'
                        }`}
                    >
                        Running ({runningCount})
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilterStatus('available')}
                        className={`h-7 px-3 text-xs font-semibold rounded-lg ${
                            filterStatus === 'available'
                                ? 'bg-loom text-white hover:bg-loom hover:text-white shadow-xs'
                                : 'text-muted-foreground hover:text-ink'
                        }`}
                    >
                        Available ({availableCount})
                    </Button>
                </div>
            </div>

            {/* Search filter bar */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by loom or worker..."
                        className="h-10 pl-9 rounded-xl border-hairline text-sm"
                    />
                </div>
                {activeMachines.length === 0 && (
                    <Button asChild size="sm" variant="outline" className="rounded-xl">
                        <Link href="/owner/machines?register=base&add=machine">
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Loom
                        </Link>
                    </Button>
                )}
            </div>

            {/* Empty state when no machines */}
            {activeMachines.length === 0 && (
                <Card className="rounded-2xl border border-dashed border-hairline-strong bg-surface p-8 text-center shadow-xs">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-soft text-muted-foreground mb-3">
                        <Wrench className="h-6 w-6" />
                    </div>
                    <h3 className="text-base font-bold text-ink">Set up your machines</h3>
                    <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                        Add your factory looms to assign active qualities and workers.
                    </p>
                    <div className="mt-4 flex justify-center">
                        <Button asChild size="sm" className="rounded-xl bg-loom text-white font-bold shadow-xs hover:bg-loom-elevated">
                            <Link href="/owner/machines?register=base&add=machine">
                                <Plus className="mr-1.5 h-4 w-4" /> Add Machines
                            </Link>
                        </Button>
                    </div>
                </Card>
            )}

            {/* Machine Cards Grid */}
            {activeMachines.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredMachines.map((machine) => {
                        const runningJob = currentJobByMachine.get(machine.id)
                        const isRunning = Boolean(runningJob)
                        const workersAssigned = machineWorkers.get(machine.id)

                        return (
                            <Card
                                key={machine.id}
                                className={`overflow-hidden rounded-2xl border transition-all ${
                                    isRunning
                                        ? 'border-hairline bg-surface shadow-xs hover:border-hairline-strong'
                                        : 'border-hairline-strong/60 bg-surface-soft/20 shadow-none'
                                }`}
                            >
                                <div className="p-4 sm:p-5 space-y-3.5">
                                    {/* Card Header: Loom Name + Status Badge */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <h3 className="truncate text-base font-bold text-ink">
                                                {machine.custom_label || machine.name}
                                            </h3>
                                            <p className="text-[11px] text-muted-foreground capitalize">
                                                {machine.machine_type.replaceAll('_', ' ')}
                                            </p>
                                        </div>

                                        {isRunning ? (
                                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 shadow-2xs">
                                                Running
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground text-[10px] px-2 py-0.5 border-hairline font-semibold">
                                                Available
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Card Body: Running vs Available */}
                                    {isRunning && runningJob ? (
                                        <div className="space-y-3">
                                            {/* Quality banner */}
                                            <div className="rounded-xl border border-hairline bg-surface-soft/40 p-2.5">
                                                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-0.5">
                                                    <span>Current Quality</span>
                                                    <span className="font-semibold text-ink">v{runningJob.costing_version || 1}</span>
                                                </div>
                                                <p className="font-bold text-sm text-ink truncate" title={runningJob.quality_label}>
                                                    {runningJob.quality_label}
                                                </p>
                                            </div>

                                            {/* Operators info */}
                                            <div className="space-y-1.5 text-xs">
                                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                    Assigned Operators
                                                </p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="rounded-lg border border-hairline/80 bg-surface p-2">
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700 mb-0.5">
                                                            <Sun className="h-3 w-3" /> Day Shift
                                                        </div>
                                                        <p className="font-semibold text-ink truncate">
                                                            {workersAssigned?.day ? workersAssigned.day.name : <span className="text-muted-foreground font-normal italic">Unassigned</span>}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-lg border border-hairline/80 bg-surface p-2">
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 mb-0.5">
                                                            <Moon className="h-3 w-3" /> Night Shift
                                                        </div>
                                                        <p className="font-semibold text-ink truncate">
                                                            {workersAssigned?.night ? workersAssigned.night.name : <span className="text-muted-foreground font-normal italic">Unassigned</span>}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2 pt-1">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setManagingMachine(machine)}
                                                    className="flex-1 h-8 rounded-xl text-xs font-semibold border-hairline bg-surface hover:bg-surface-soft"
                                                >
                                                    <Users className="mr-1.5 h-3.5 w-3.5" /> Manage Workers
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openSwitchQuality(machine)}
                                                    className="flex-1 h-8 rounded-xl text-xs font-semibold border-hairline bg-surface hover:bg-surface-soft"
                                                >
                                                    <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" /> Switch Quality
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="rounded-xl border border-dashed border-hairline bg-surface-soft/20 p-3 text-center">
                                                <p className="text-xs text-muted-foreground">
                                                    No production quality currently assigned to this loom.
                                                </p>
                                            </div>

                                            <div className="text-[11px] text-muted-foreground bg-surface-soft/30 p-2 rounded-lg text-center">
                                                Assign a production quality before configuring operators.
                                            </div>

                                            <div className="pt-1">
                                                <Button
                                                    size="sm"
                                                    disabled={activeJobs.length === 0}
                                                    onClick={() => openAssignQuality(machine)}
                                                    className="w-full h-8 rounded-xl text-xs font-bold bg-loom text-white shadow-xs hover:bg-loom-elevated"
                                                >
                                                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Assign Quality
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Modal: Switch Quality on running machine */}
            <Dialog open={switchingMachine !== null} onOpenChange={(open) => !open && setSwitchingMachine(null)}>
                <DialogContent className="max-w-md rounded-2xl p-5">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-ink">
                            Switch Quality on {switchingMachine?.custom_label || switchingMachine?.name}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground pt-1">
                            Current Quality:{' '}
                            <strong className="text-ink">
                                {switchingMachine && currentJobByMachine.get(switchingMachine.id)?.quality_label}
                            </strong>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-ink">Switch to Active Quality</label>
                            <Select value={selectedTargetJobId} onValueChange={setSelectedTargetJobId}>
                                <SelectTrigger className="h-10 rounded-xl border-hairline text-sm">
                                    <SelectValue placeholder="Choose quality to switch to..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl shadow-lg">
                                    {activeJobs
                                        .filter((j) => j.id !== currentJobByMachine.get(switchingMachine?.id ?? '')?.id)
                                        .map((job) => (
                                            <SelectItem key={job.id} value={job.id}>
                                                {job.quality_label} · v{job.costing_version || 1}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-950">
                            <p className="font-semibold flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                Operator assignments will remain unchanged.
                            </p>
                            <p className="mt-1 text-[11px] text-emerald-800">
                                Operators on this loom will continue operating it seamlessly under the new quality.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setSwitchingMachine(null)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            disabled={!selectedTargetJobId || pendingKey !== null}
                            onClick={handleSwitchQualitySubmit}
                            className="rounded-xl bg-loom text-white font-bold shadow-xs hover:bg-loom-elevated"
                        >
                            {pendingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Switch Quality'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal: Assign Quality to available machine */}
            <Dialog open={assigningMachine !== null} onOpenChange={(open) => !open && setAssigningMachine(null)}>
                <DialogContent className="max-w-md rounded-2xl p-5">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-ink">
                            Assign Quality to {assigningMachine?.custom_label || assigningMachine?.name}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground pt-1">
                            Choose which active quality this loom should begin weaving.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-ink">Active Quality</label>
                            <Select value={selectedAssignJobId} onValueChange={setSelectedAssignJobId}>
                                <SelectTrigger className="h-10 rounded-xl border-hairline text-sm">
                                    <SelectValue placeholder="Choose quality..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl shadow-lg">
                                    {activeJobs.map((job) => (
                                        <SelectItem key={job.id} value={job.id}>
                                            {job.quality_label} · v{job.costing_version || 1}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setAssigningMachine(null)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            disabled={!selectedAssignJobId || pendingKey !== null}
                            onClick={handleAssignQualitySubmit}
                            className="rounded-xl bg-loom text-white font-bold shadow-xs hover:bg-loom-elevated"
                        >
                            {pendingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Start Quality'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Sheet: Manage Workers for machine */}
            <Sheet open={managingMachine !== null} onOpenChange={(open) => !open && setManagingMachine(null)}>
                <SheetContent side="right" className="w-[min(440px,95vw)] p-0 flex flex-col">
                    <SheetHeader className="p-5 pb-3 border-b border-hairline bg-surface-soft/40">
                        <SheetTitle className="text-base font-bold text-ink">
                            Manage Operators for {managingMachine?.custom_label || managingMachine?.name}
                        </SheetTitle>
                        <SheetDescription className="text-xs text-muted-foreground">
                            Quality: {managingMachine && currentJobByMachine.get(managingMachine.id)?.quality_label}
                        </SheetDescription>
                    </SheetHeader>

                    <div className="p-5 flex-1 overflow-y-auto space-y-4">
                        {/* Shift toggle */}
                        <div className="flex rounded-xl border border-hairline bg-surface p-1 shadow-xs">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setManageWorkerShift('day')}
                                className={`flex-1 h-8 rounded-lg text-xs font-bold ${
                                    manageWorkerShift === 'day'
                                        ? 'bg-loom text-white hover:bg-loom hover:text-white shadow-xs'
                                        : 'text-muted-foreground hover:text-ink'
                                }`}
                            >
                                <Sun className="mr-1.5 h-3.5 w-3.5 text-amber-500" /> Day Shift
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setManageWorkerShift('night')}
                                className={`flex-1 h-8 rounded-lg text-xs font-bold ${
                                    manageWorkerShift === 'night'
                                        ? 'bg-loom text-white hover:bg-loom hover:text-white shadow-xs'
                                        : 'text-muted-foreground hover:text-ink'
                                }`}
                            >
                                <Moon className="mr-1.5 h-3.5 w-3.5 text-indigo-500" /> Night Shift
                            </Button>
                        </div>

                        {/* Current Worker banner */}
                        {managingMachine && (() => {
                            const currentWorkers = machineWorkers.get(managingMachine.id)
                            const currentWorker = manageWorkerShift === 'day' ? currentWorkers?.day : currentWorkers?.night
                            const currentAssignmentId = manageWorkerShift === 'day' ? currentWorkers?.dayAssignmentId : currentWorkers?.nightAssignmentId

                            return (
                                <div className="rounded-xl border border-hairline bg-surface p-3.5 shadow-2xs space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                                            Currently Assigned ({manageWorkerShift} shift)
                                        </span>
                                        {currentWorker && (
                                            <Badge variant="secondary" className="text-[10px] font-bold">
                                                Active
                                            </Badge>
                                        )}
                                    </div>

                                    {currentWorker ? (
                                        <div className="flex items-center justify-between gap-2 pt-1">
                                            <div>
                                                <p className="font-bold text-sm text-ink">{currentWorker.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Rate: ₹{currentWorker.rate_per_meter}/m
                                                </p>
                                            </div>
                                            {currentAssignmentId && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleRemoveWorker(currentAssignmentId)}
                                                    disabled={pendingKey !== null}
                                                    className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs rounded-lg"
                                                >
                                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Unassign
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic py-1">
                                            No operator currently assigned for this shift.
                                        </p>
                                    )}
                                </div>
                            )
                        })()}

                        {/* Available Workers List */}
                        <div className="space-y-2 pt-1">
                            <label className="text-xs font-bold text-ink">
                                Assign / Replace Operator
                            </label>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={workerSearch}
                                    onChange={(e) => setWorkerSearch(e.target.value)}
                                    placeholder="Search workers..."
                                    className="h-9 pl-8 rounded-xl border-hairline text-xs"
                                />
                            </div>

                            <div className="max-h-64 overflow-y-auto divide-y divide-hairline rounded-xl border border-hairline">
                                {availableWorkersForShift.length === 0 && (
                                    <p className="p-4 text-center text-xs text-muted-foreground">
                                        No active workers available for {manageWorkerShift} shift. Add workers in{' '}
                                        <Link href="/owner/workers" className="font-semibold text-loom hover:underline">
                                            Workers
                                        </Link>
                                        .
                                    </p>
                                )}

                                {availableWorkersForShift.map((worker) => {
                                    const isCurrent =
                                        managingMachine &&
                                        (manageWorkerShift === 'day'
                                            ? machineWorkers.get(managingMachine.id)?.day?.id === worker.id
                                            : machineWorkers.get(managingMachine.id)?.night?.id === worker.id)

                                    return (
                                        <div
                                            key={worker.id}
                                            className="flex items-center justify-between p-2.5 hover:bg-surface-soft/40 transition-colors"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-xs font-bold text-ink">{worker.name}</p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    Rate: ₹{worker.rate_per_meter}/m
                                                </p>
                                            </div>

                                            {isCurrent ? (
                                                <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-200">
                                                    <Check className="mr-1 h-3 w-3" /> Assigned
                                                </Badge>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={pendingKey !== null}
                                                    onClick={() => handleAssignWorker(worker.id)}
                                                    className="h-7 px-2.5 text-xs font-semibold rounded-lg border-hairline"
                                                >
                                                    {pendingKey === `assign-worker-${worker.id}` ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        'Assign'
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <SheetFooter className="p-4 border-t border-hairline bg-surface-soft/30 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setManagingMachine(null)} className="rounded-xl">
                            Done
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </section>
    )
}
