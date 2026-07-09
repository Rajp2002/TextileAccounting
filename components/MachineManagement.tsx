'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from 'sonner'
import {
    Loader2,
    Plus,
    Trash2,
    KeyRound,
    Pencil,
    Power,
    Tag,
    Sun,
    Moon,
    AlertCircle,
    Activity,
    MoreVertical
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { deleteMachineWithCode, requestAccessCode } from '@/app/(dashboard)/supervisor/actions'
import {
    addMachine,
    updateMachine,
    deleteMachine,
    toggleMachineStatus as toggleMachineStatusAction,
    upsertMachineOperatorAssignment,
    assignMachineProductionTarget,
    getActiveProductionTargets,
} from '@/app/(dashboard)/owner/actions'
import type { ProductionTargetOption } from '@/app/(dashboard)/owner/actions'
import { useUserProfile } from '@/hooks/use-user-profile'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/i18n/context'
import { useTransliterate } from '@/hooks/use-transliterate'
import { cn } from '@/lib/utils'
import {
    getDefaultPayModeForMachineType,
    getOperatorWorkerTypeForPayMode,
    normalizeMachineType,
    type OperatorPayMode,
    type OperatorWorkerType,
} from '@/lib/machine-operator-payroll'

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback
}

interface Worker {
    id: number
    name: string
    is_active: boolean
}

interface FixedWorker {
    id: number
    name: string
    role: string
    monthly_salary: number
    is_active: boolean
}

interface Machine {
    id: string
    name: string
    status: string
    current_order_id?: string | null
    loom_type?: string | null
    loom_type_custom_label?: string | null
    default_rpm?: number | null
    default_power_kw?: number | null
    orders?: {
        worker_rate_per_m: number
        quality_label: string
        status: string
        market_run_id?: string | null
        party_name?: string | null
    } | null
}

interface Assignment {
    machine_id: string
    worker_id: number | null
    shift: 'day' | 'night'
    operator_assignment_id?: string | null
    operator_worker_type?: OperatorWorkerType | null
    meter_worker_id?: number | null
    fixed_worker_id?: number | null
    pay_mode?: OperatorPayMode | null
    rate?: number | null
    machine_type?: string | null
}

type AssignmentEditorState = {
    machine: Machine
    shift: 'day' | 'night'
    workerType: OperatorWorkerType
    payMode: OperatorPayMode
    meterWorkerId: string
    fixedWorkerId: string
    rate: string
}

type MachineOperatorAssignmentRow = {
    id: string
    machine_id: string
    worker_type: OperatorWorkerType
    meter_worker_id: number | null
    fixed_worker_id: number | null
    shift: string
    pay_mode: OperatorPayMode
    rate: number | string | null
    machine_type: string | null
}

type LegacyMachineAssignmentRow = {
    machine_id: string
    worker_id: number
    shift: string
}

interface MachineManagementProps {
    orgId: string
    canAddMachines?: boolean
    canToggleMachineStatus?: boolean
    canRenameMachines?: boolean
    canDeleteMachines?: boolean
}

export function MachineManagement({
    orgId,
    canAddMachines = true,
    canToggleMachineStatus = true,
    canRenameMachines = true,
    canDeleteMachines = true,
}: MachineManagementProps) {
    const supabase = createClient()
    const queryClient = useQueryClient()

    // Add Machine State
    const [isAddMachineOpen, setIsAddMachineOpen] = useState(false)
    const [newMachineName, setNewMachineName] = useState('')
    const [newMachineLoomType, setNewMachineLoomType] = useState<string>('')
    const [newMachineCustomLabel, setNewMachineCustomLabel] = useState('')
    const [isAddingMachine, setIsAddingMachine] = useState(false)

    // Delete Machine State
    const [machineToDelete, setMachineToDelete] = useState<string | null>(null)
    const [accessCode, setAccessCode] = useState('')
    const [deleting, setDeleting] = useState(false)

    // Rename / Edit Machine State
    const [machineToRename, setMachineToRename] = useState<Machine | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const [renameLoomType, setRenameLoomType] = useState<string>('')
    const [renameCustomLabel, setRenameCustomLabel] = useState('')
    const [renaming, setRenaming] = useState(false)
    const [assignmentEditor, setAssignmentEditor] = useState<AssignmentEditorState | null>(null)
    const [savingAssignment, setSavingAssignment] = useState(false)

    // Request Access Code state
    const [requestingCode, setRequestingCode] = useState(false)

    const { data: userProfile } = useUserProfile()
    const { t } = useTranslation()
    const tl = useTransliterate()

    // Fetch Machines
    const { data: machines, isLoading: machinesLoading } = useQuery({
        queryKey: ['machines', orgId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('machines')
                .select('*, orders(worker_rate_per_m, quality_label, party_name, status, market_run_id)')
                .eq('org_id', orgId)
                .order('name')
            if (error) throw error
            return data as Machine[]
        }
    })

    // ── Real-time Sync ──
    useEffect(() => {
        if (!orgId) return

        const channel = supabase.channel('machines_realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'machines',
                    filter: `org_id=eq.${orgId}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['machines', orgId] })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [orgId, supabase, queryClient])

    // Fetch Workers
    const { data: workers } = useQuery({
        queryKey: ['workers', orgId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('workers')
                .select('id, name, is_active')
                .eq('org_id', orgId)
                .eq('is_active', true)
                .order('name')
            if (error) throw error
            return data as Worker[]
        }
    })

    const { data: fixedWorkers } = useQuery({
        queryKey: ['fixed_workers', orgId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('fixed_workers')
                .select('id, name, role, monthly_salary, is_active')
                .eq('org_id', orgId)
                .eq('is_active', true)
                .order('name')
            if (error) throw error
            return data as FixedWorker[]
        }
    })

    // Fetch assignable cost analyses / qualities across party orders and market runs.
    // staleTime: 30 s — avoids re-running the heavy market_run_summary view query on every
    // mount or tab switch. The query is invalidated immediately after any assignment change.
    const { data: productionTargets } = useQuery({
        queryKey: ['production_targets', orgId],
        queryFn: async () => {
            const res = await getActiveProductionTargets()
            if ('error' in res) throw new Error(res.error)
            return res.data
        },
        enabled: !!orgId && (userProfile?.role === 'owner' || userProfile?.role === 'supervisor'),
        staleTime: 30_000,           // keep fresh for 30 s before background refetch
        placeholderData: keepPreviousData, // show last result while refetching (no blank flash)
    })

    const { data: assignments } = useQuery({
        queryKey: ['machine_operator_assignments', orgId],
        queryFn: async () => {
            const [operatorRes, legacyRes] = await Promise.all([
                supabase
                    .from('machine_operator_assignments')
                    .select('id, machine_id, worker_type, meter_worker_id, fixed_worker_id, shift, pay_mode, rate, machine_type')
                    .eq('org_id', orgId)
                    .eq('active', true)
                    .is('effective_to', null),
                supabase
                    .from('machine_assignments')
                    .select('machine_id, worker_id, shift')
                    .eq('org_id', orgId),
            ])
            if (operatorRes.error) throw operatorRes.error
            if (legacyRes.error) throw legacyRes.error

            const operatorRows = (operatorRes.data ?? []) as MachineOperatorAssignmentRow[]
            const legacyRows = (legacyRes.data ?? []) as LegacyMachineAssignmentRow[]
            const operatorAssignments = operatorRows.map((assignment) => ({
                machine_id: assignment.machine_id,
                shift: assignment.shift as 'day' | 'night',
                worker_id: assignment.worker_type === 'meter_worker' ? assignment.meter_worker_id : null,
                operator_assignment_id: assignment.id,
                operator_worker_type: assignment.worker_type as OperatorWorkerType,
                meter_worker_id: assignment.meter_worker_id,
                fixed_worker_id: assignment.fixed_worker_id,
                pay_mode: assignment.pay_mode as OperatorPayMode,
                rate: Number(assignment.rate ?? 0),
                machine_type: assignment.machine_type,
            })) as Assignment[]
            const operatorKeys = new Set(operatorAssignments.map((assignment) => `${assignment.machine_id}:${assignment.shift}`))
            const legacyAssignments = legacyRows
                .filter((assignment) => !operatorKeys.has(`${assignment.machine_id}:${assignment.shift}`))
                .map((assignment) => ({
                    machine_id: assignment.machine_id,
                    worker_id: assignment.worker_id,
                    shift: assignment.shift as 'day' | 'night',
                    operator_assignment_id: null,
                    operator_worker_type: 'meter_worker' as OperatorWorkerType,
                    meter_worker_id: assignment.worker_id,
                    fixed_worker_id: null,
                    pay_mode: 'per_meter' as OperatorPayMode,
                    rate: null,
                    machine_type: null,
                }))

            return [...operatorAssignments, ...legacyAssignments]
        }
    })

    const handleProductionTargetLink = async (machineId: string, target: ProductionTargetOption | null) => {
        try {
            const res = await assignMachineProductionTarget(
                machineId,
                target ? { source_type: target.source_type, source_id: target.source_id } : null
            )
            if (res.error) throw new Error(res.error)
            toast.success(target ? 'Cost analysis linked to loom' : 'Cost analysis unlinked from loom')
            queryClient.invalidateQueries({ queryKey: ['machines'] })
            queryClient.invalidateQueries({ queryKey: ['production_targets', orgId] })
        } catch (error) {
            toast.error(getErrorMessage(error, t('machines.order_assign_failed')))
        }
    }


    const handleAddMachine = async () => {
        if (!newMachineName || !newMachineLoomType) return

        setIsAddingMachine(true)
        try {
            const result = await addMachine(
                newMachineName, 
                newMachineLoomType || undefined, 
                newMachineLoomType === 'other' ? newMachineCustomLabel : undefined
            )
            if (result.error) throw new Error(result.error)
            toast.success(t('machines.machine_added'))
            queryClient.invalidateQueries({ queryKey: ['machines'] })
            setIsAddMachineOpen(false)
            setNewMachineName('')
            setNewMachineLoomType('')
            setNewMachineCustomLabel('')
        } catch (error) {
            toast.error(t('machines.machine_add_failed') + ': ' + getErrorMessage(error, t('machines.machine_add_failed')))
        } finally {
            setIsAddingMachine(false)
        }
    }

    const confirmDelete = async (id: string) => {
        if (userProfile?.role === 'owner') {
            if (confirm(t('machines.delete_confirm'))) {
                setDeleting(true)
                try {
                    const result = await deleteMachine(id)
                    if (result.error) toast.error(result.error)
                    else {
                        toast.success(t('machines.machine_deleted'))
                        queryClient.invalidateQueries({ queryKey: ['machines'] })
                    }
                } catch (error) {
                    toast.error(getErrorMessage(error, t('machines.machine_delete_failed')))
                } finally {
                    setDeleting(false)
                }
            }
        } else {
            setMachineToDelete(id)
            setAccessCode('')
        }
    }

    const executeDeleteWithCode = async () => {
        if (!machineToDelete) return
        setDeleting(true)
        try {
            const result = await deleteMachineWithCode(machineToDelete, accessCode)
            if (result.error) throw new Error(result.error)

            toast.success(t('machines.machine_deleted'))
            setMachineToDelete(null)
            queryClient.invalidateQueries({ queryKey: ['machines'] })
        } catch (error) {
            toast.error(getErrorMessage(error, t('machines.machine_delete_failed')))
        } finally {
            setDeleting(false)
        }
    }

    const handleRequestCode = async () => {
        setRequestingCode(true)
        try {
            const result = await requestAccessCode()
            if (result.error) throw new Error(result.error)
            toast.success(t('auth.code_requested_success') || 'Request sent to owner via WhatsApp')
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to request code'))
        } finally {
            setRequestingCode(false)
        }
    }

    // ── Edit Machine (name + loom type) ──
    const handleRename = async () => {
        if (!machineToRename || !renameValue.trim()) return
        setRenaming(true)
        try {
            const result = await updateMachine(
                machineToRename.id,
                renameValue.trim(),
                renameLoomType || null,   // empty string → null (clears loom type)
                renameLoomType === 'other' ? renameCustomLabel : null
            )
            if (result.error) throw new Error(result.error)
            toast.success(t('machines.renamed'))
            queryClient.invalidateQueries({ queryKey: ['machines'] })
            setMachineToRename(null)
            setRenameCustomLabel('')
        } catch {
            toast.error(t('machines.rename_failed'))
        } finally {
            setRenaming(false)
        }
    }

    // ── Toggle Machine Status (activate / deactivate) ──
    const toggleMachineStatus = async (machine: Machine) => {
        const isActivating = machine.status !== 'active'
        if (isActivating) {
            const hasDayWorker = assignments?.some(a => a.machine_id === machine.id && a.shift === 'day')
            const hasNightWorker = assignments?.some(a => a.machine_id === machine.id && a.shift === 'night')

            if (!hasDayWorker && !hasNightWorker) {
                toast.error('Assign at least one day or night worker before activating this loom.')
                return
            }

            if (!machine.current_order_id || machine.orders?.status !== 'active') {
                toast.error('Assign an active cost analysis or quality before activating this loom.')
                return
            }
        }

        // Optimistic Update
        const oldMachines = queryClient.getQueryData(['machines', orgId])
        queryClient.setQueryData(['machines', orgId], (old: Machine[] | undefined) => {
            if (!old) return old
            return old.map(m => m.id === machine.id
                ? { ...m, status: m.status === 'active' ? 'inactive' : 'active' }
                : m
            )
        })

        try {
            const result = await toggleMachineStatusAction(machine.id, machine.status)
            if (result.error) throw new Error(result.error)
            toast.success(t('machines.status_updated'))
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : t('machines.status_update_failed'))
            // Rollback on error
            queryClient.setQueryData(['machines', orgId], oldMachines)
        } finally {
            queryClient.invalidateQueries({ queryKey: ['machines', orgId] })
        }
    }

    const getFixedWorkerDefaultRate = (workerId: string, payMode: OperatorPayMode) => {
        const worker = fixedWorkers?.find((item) => item.id.toString() === workerId)
        const salary = Number(worker?.monthly_salary ?? 0)
        if (payMode === 'fixed_monthly') return salary
        if (payMode === 'fixed_daily' || payMode === 'fixed_shift') return salary > 0 ? Number((salary / 30).toFixed(2)) : 0
        return 0
    }

    const getAssignmentDisplayName = (assignment: Assignment | undefined) => {
        if (!assignment) return ''
        if (assignment.operator_worker_type === 'fixed_worker') {
            return fixedWorkers?.find((worker) => worker.id === assignment.fixed_worker_id)?.name ?? ''
        }
        return workers?.find((worker) => worker.id === (assignment.meter_worker_id ?? assignment.worker_id))?.name ?? ''
    }

    const getAssignmentPayLabel = (assignment: Assignment | undefined) => {
        if (!assignment?.pay_mode) return ''
        const modeLabels: Record<OperatorPayMode, string> = {
            per_meter: 'per m',
            fixed_monthly: 'monthly',
            fixed_daily: 'daily',
            fixed_shift: 'shift',
        }
        const amount = assignment.rate ? ` · ₹${assignment.rate}` : ''
        return `${modeLabels[assignment.pay_mode]}${amount}`
    }

    const openAssignmentEditor = (machine: Machine, shift: 'day' | 'night', existing: Assignment | undefined, fallbackRate?: number | null) => {
        const machineType = normalizeMachineType(machine.loom_type)
        const payMode = existing?.pay_mode ?? getDefaultPayModeForMachineType(machineType)
        const workerType = existing?.operator_worker_type ?? getOperatorWorkerTypeForPayMode(payMode)
        const fixedWorkerId = existing?.fixed_worker_id?.toString() ?? ''
        const meterWorkerId = (existing?.meter_worker_id ?? existing?.worker_id)?.toString() ?? ''
        const initialRate = existing?.rate
            ?? (workerType === 'fixed_worker'
                ? getFixedWorkerDefaultRate(fixedWorkerId, payMode)
                : (fallbackRate ?? 0))

        setAssignmentEditor({
            machine,
            shift,
            workerType,
            payMode,
            meterWorkerId,
            fixedWorkerId,
            rate: initialRate ? String(initialRate) : '',
        })
    }

    const saveOperatorAssignment = async () => {
        if (!assignmentEditor) return
        setSavingAssignment(true)
        try {
            const result = await upsertMachineOperatorAssignment({
                machineId: assignmentEditor.machine.id,
                shift: assignmentEditor.shift,
                workerType: assignmentEditor.workerType,
                meterWorkerId: assignmentEditor.workerType === 'meter_worker' ? Number(assignmentEditor.meterWorkerId) : null,
                fixedWorkerId: assignmentEditor.workerType === 'fixed_worker' ? Number(assignmentEditor.fixedWorkerId) : null,
                payMode: assignmentEditor.payMode,
                rate: Number(assignmentEditor.rate),
            })
            if (result.error) throw new Error(result.error)
            toast.success(t('machines.worker_assigned'))
            setAssignmentEditor(null)
            queryClient.invalidateQueries({ queryKey: ['machine_operator_assignments'] })
            queryClient.invalidateQueries({ queryKey: ['machine_assignments'] })
        } catch (error) {
            console.error(error)
            toast.error(getErrorMessage(error, t('machines.worker_assign_failed')))
        } finally {
            setSavingAssignment(false)
        }
    }

    if (machinesLoading) return (
        <Card className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-9 w-28" />
            </CardHeader>
            <CardContent className="space-y-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="space-y-4 rounded-lg border border-hairline bg-surface-soft/50 p-4">
                        <div className="flex justify-between items-center">
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-8 w-24" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Skeleton className="h-14 w-full" />
                            <Skeleton className="h-14 w-full" />
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    )

    const typeLabels: Record<string, string> = {
        jacquard: 'Jacquard',
        rapier: 'Rapier',
        water_jet: 'Water Jet',
        air_jet: 'Air Jet',
        power_loom: 'Power Loom',
        shuttle: 'Shuttle',
        other: 'Other',
        uncategorized: 'Uncategorized'
    }

    const sortOrder = ['jacquard', 'rapier', 'water_jet', 'air_jet', 'power_loom', 'shuttle', 'other', 'uncategorized']

    const groupedMachines = machines?.reduce((acc, machine) => {
        let type = machine.loom_type || 'uncategorized'
        // Normalize old tags to new keys
        if (type === 'JAC') type = 'jacquard'
        if (type === 'RAP') type = 'rapier'
        if (type === 'WJ') type = 'water_jet'
        
        if (!acc[type]) acc[type] = []
        acc[type].push(machine)
        return acc
    }, {} as Record<string, Machine[]>)

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>{t('machines.title')}</CardTitle>
                    <CardDescription>
                        {t('machines.desc_no_edit')}
                    </CardDescription>
                </div>
                {canAddMachines && (
                    <div className="flex items-center gap-2">
                        <Dialog open={isAddMachineOpen} onOpenChange={setIsAddMachineOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    {t('machines.add_machine')}
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>{t('machines.add_machine')}</DialogTitle>
                                    <DialogDescription>
                                        {t('machines.add_machine_desc')}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">{t('machines.machine_name')}</Label>
                                        <Input
                                            id="name"
                                            placeholder={t('machines.add_machine_placeholder')}
                                            value={newMachineName}
                                            onChange={(e) => setNewMachineName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddMachine()}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="loom-type-add">Loom Type</Label>
                                        <select
                                            id="loom-type-add"
                                            value={newMachineLoomType}
                                            onChange={e => setNewMachineLoomType(e.target.value)}
                                            className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ring/25"
                                        >
                                            <option value="">— Select type —</option>
                                            <option value="jacquard">Jacquard</option>
                                            <option value="rapier">Rapier</option>
                                            <option value="water_jet">Water Jet</option>
                                            <option value="air_jet">Air Jet</option>
                                            <option value="power_loom">Power Loom</option>
                                            <option value="shuttle">Shuttle</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                    {newMachineLoomType === 'other' && (
                                        <div className="space-y-2">
                                            <Label htmlFor="custom-label-add">Custom Label</Label>
                                            <Input
                                                id="custom-label-add"
                                                placeholder="e.g. Imported Italian Jacquard"
                                                value={newMachineCustomLabel}
                                                onChange={(e) => setNewMachineCustomLabel(e.target.value)}
                                                maxLength={80}
                                            />
                                        </div>
                                    )}
                                    {/* Rate is now defined on the Quality, not the machine */}
                                    <p className="flex items-center gap-1.5 rounded-md border border-info-soft bg-info-soft p-2.5 text-xs text-info">
                                        <Tag className="h-3.5 w-3.5 shrink-0 text-info" />
                                        Worker rates are set per fabric quality. The loom rate follows the selected cost analysis.
                                    </p>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsAddMachineOpen(false)}>{t('common.cancel')}</Button>
                                    <Button onClick={handleAddMachine} disabled={!newMachineName || isAddingMachine}>
                                        {isAddingMachine ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                        {t('machines.add_machine')}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                )}
            </CardHeader>
            <CardContent>
                <div className="space-y-8">
                    {sortOrder.map(type => {
                        const looms = groupedMachines?.[type] || []
                        if (looms.length === 0) return null

                        return (
                            <div key={type} className="space-y-4">
                                <div className="flex items-center justify-between border-b border-hairline pb-2">
                                    <h3 className="text-sm font-semibold text-ink">{typeLabels[type]} Looms</h3>
                                    <span className="text-xs text-muted-foreground">{looms.length} looms</span>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
                                    {looms.map(machine => {
                                        const dayAssignment = assignments?.find(a => a.machine_id === machine.id && a.shift === 'day')
                                        const nightAssignment = assignments?.find(a => a.machine_id === machine.id && a.shift === 'night')
                                        const isInactive = machine.status === 'inactive'

                                        const hasAnyShiftAssignment = !!dayAssignment || !!nightAssignment
                                        const activeTarget = productionTargets?.find((target) => target.order_id === machine.current_order_id)
                                        const hasActiveProductionTarget = !!machine.current_order_id && machine.orders?.status === 'active'
                                        const isEffectivelyActive = !isInactive && hasAnyShiftAssignment && hasActiveProductionTarget

                                        // Derive the wage rate from the selected cost analysis / quality.
                                        const activeRate = activeTarget?.worker_rate_per_m ?? machine.orders?.worker_rate_per_m
                                        const activeQualityName = activeTarget?.label ?? machine.orders?.quality_label
                                        const activeDetailLabel = activeTarget?.detail_label
                                            ?? (machine.orders?.market_run_id ? 'Market Run' : machine.orders?.party_name)

                                        const dayWorkerName = getAssignmentDisplayName(dayAssignment)
                                        const nightWorkerName = getAssignmentDisplayName(nightAssignment)

                                        return (
                                            <div
                                                key={machine.id}
                                                className={cn(
                                                    "group relative flex flex-col justify-between rounded-xl border p-5 transition-all duration-200",
                                                    isInactive
                                                        ? "border-hairline bg-surface-soft/60 opacity-70"
                                                        : "border-hairline bg-surface hover:border-hairline-strong hover:shadow-[var(--shadow-card)]"
                                                )}
                                            >
                                                {/* Header: Machine ID & Status */}
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                                                            isEffectivelyActive ? "bg-success-soft text-success" : "bg-surface-soft text-muted-foreground"
                                                        )}>
                                                            <Activity className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-semibold text-ink">{machine.name.replace(/^Machine\b/i, 'Loom')}</h3>
                                                            <div className="flex items-center gap-1.5">
                                                                {isEffectivelyActive ? (
                                                                    <span className="flex items-center gap-1 text-[11px] font-semibold text-success">
                                                                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                                                                        {t('machines.active_status')}
                                                                    </span>
                                                                ) : (
                                                                    <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                                                                        <span className="h-1.5 w-1.5 rounded-full bg-hairline-strong" />
                                                                        {t('machines.inactive')}
                                                                    </span>
                                                                )}
                                                                {machine.loom_type && (
                                                                    <span className="rounded-full border border-saffron-soft bg-saffron-soft px-1.5 py-0.5 text-[10px] font-semibold text-saffron-deep">
                                                                        {machine.loom_type === 'other' && machine.loom_type_custom_label 
                                                                            ? machine.loom_type_custom_label 
                                                                            : typeLabels[machine.loom_type] || machine.loom_type}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Quick Actions Dropdown */}
                                                    {(canToggleMachineStatus || canRenameMachines || canDeleteMachines) && (
                                                        <div className="flex items-center">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-ink">
                                                                        <MoreVertical className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-40">
                                                                    {canToggleMachineStatus && (
                                                                        <DropdownMenuItem onClick={() => toggleMachineStatus(machine)}>
                                                                            <Power className={cn("h-4 w-4 mr-2", isInactive ? "text-success" : "text-warning")} />
                                                                            {isInactive ? t('machines.activate') : t('machines.deactivate')}
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    {canRenameMachines && (
                                                                        <DropdownMenuItem onClick={() => {
                                                                            setMachineToRename(machine)
                                                                            setRenameValue(machine.name)
                                                                            setRenameLoomType(machine.loom_type ?? '')
                                                                            setRenameCustomLabel(machine.loom_type_custom_label ?? '')
                                                                        }}>
                                                                            <Pencil className="h-4 w-4 mr-2" />
                                                                            {t('machines.rename_machine')}
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    {canDeleteMachines && (
                                                                        <DropdownMenuItem
                                                                            className="text-risk focus:text-risk"
                                                                            onClick={() => {
                                                                                if (userProfile?.role === 'owner') {
                                                                                    confirmDelete(machine.id)
                                                                                } else {
                                                                                    setMachineToDelete(machine.id)
                                                                                    setAccessCode('')
                                                                                }
                                                                            }}
                                                                        >
                                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                                            {t('common.delete')}
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Cost Analysis / Quality Section */}
                                                <div className="flex-1 space-y-4">
                                                    <Popover>
                                                        <PopoverTrigger asChild disabled={userProfile?.role !== 'owner' && userProfile?.role !== 'supervisor'}>
                                                            <div className={cn(
                                                                "rounded-lg border p-3 transition-all",
                                                                hasActiveProductionTarget
                                                                    ? "border-success-soft bg-success-soft/45"
                                                                    : "border-hairline bg-surface-soft/60",
                                                                (userProfile?.role === 'owner' || userProfile?.role === 'supervisor') && "cursor-pointer hover:border-saffron-soft hover:bg-saffron-soft/30"
                                                            )}>
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="text-[11px] font-semibold text-muted-foreground">Cost analysis / quality</span>
                                                                    {hasActiveProductionTarget && (
                                                                        <Badge variant="success" className="text-[11px]">
                                                                            ₹{activeRate ?? '—'}/m
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                {hasActiveProductionTarget ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="rounded-md border border-success-soft bg-surface p-1.5">
                                                                            <Tag className="h-3.5 w-3.5 text-success" />
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <span className="block truncate text-sm font-semibold text-ink">
                                                                                {activeQualityName || "Selected quality"}
                                                                            </span>
                                                                            {activeDetailLabel && (
                                                                                <span className="block truncate text-[10px] font-medium text-muted-foreground">
                                                                                    {activeDetailLabel}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                                        <AlertCircle className="h-3.5 w-3.5" />
                                                                        <span className="text-xs">No cost analysis selected</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[280px] p-0" align="start">
                                                            <div className="max-h-[300px] overflow-auto p-1">
                                                                <div className="mb-1 flex items-center justify-between border-b border-hairline px-2 py-1.5 text-[11px] font-semibold text-muted-foreground">
                                                                    Assign cost analysis / quality
                                                                    {machine.current_order_id && (
                                                                        <button
                                                                            onClick={() => handleProductionTargetLink(machine.id, null)}
                                                                            className="font-semibold text-risk hover:text-risk/80"
                                                                        >
                                                                            Unlink
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                {productionTargets?.map((target) => (
                                                                    <button
                                                                        key={`${target.source_type}:${target.source_id}`}
                                                                        type="button"
                                                                        className={cn(
                                                                            "w-full space-y-0.5 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-soft",
                                                                            machine.current_order_id === target.order_id && "border border-saffron-soft bg-saffron-soft text-saffron-deep font-medium"
                                                                        )}
                                                                        onClick={() => {
                                                                            handleProductionTargetLink(machine.id, target)
                                                                        }}
                                                                    >
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <div className="truncate font-bold">{target.label || 'Unnamed quality'}</div>
                                                                            {target.worker_rate_per_m !== null && (
                                                                                <span className="shrink-0 rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-bold opacity-80">
                                                                                    ₹{target.worker_rate_per_m}/m
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-[10px] opacity-70 truncate">{target.detail_label}</div>
                                                                    </button>
                                                                ))}
                                                                {productionTargets?.length === 0 && (
                                                                    <div className="p-4 text-center text-xs text-muted-foreground">
                                                                        No active cost analyses found.<br/>
                                                                        Start a party order or market run from Estimator.
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>

                                                    {/* Shift Assignments */}
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {/* Day Shift */}
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                                                                <Sun className="h-3 w-3 text-saffron" />
                                                                Day
                                                            </div>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className={cn(
                                                                    "h-12 w-full flex-col items-start justify-center rounded-lg border-dashed px-3 text-left font-normal transition-all hover:border-solid",
                                                                    dayAssignment ? "border-hairline bg-surface text-ink" : "border-hairline bg-surface-soft/50 text-muted-foreground"
                                                                )}
                                                                onClick={() => {
                                                                    if (userProfile?.role !== 'owner') {
                                                                        toast.error('Ask the owner to change machine operator payroll assignments.')
                                                                        return
                                                                    }
                                                                    openAssignmentEditor(machine, 'day', dayAssignment, activeRate)
                                                                }}
                                                            >
                                                                <span className="max-w-full truncate text-xs font-semibold">
                                                                    {dayWorkerName ? tl(dayWorkerName) : t('machines.assign_worker')}
                                                                </span>
                                                                {dayAssignment?.pay_mode && (
                                                                    <span className="max-w-full truncate text-[10px] text-muted-foreground">
                                                                        {getAssignmentPayLabel(dayAssignment)}
                                                                    </span>
                                                                )}
                                                            </Button>
                                                        </div>

                                                        {/* Night Shift */}
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                                                                <Moon className="h-3 w-3 text-loom" />
                                                                Night
                                                            </div>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className={cn(
                                                                    "h-12 w-full flex-col items-start justify-center rounded-lg border-dashed px-3 text-left font-normal transition-all hover:border-solid",
                                                                    nightAssignment ? "border-hairline bg-surface text-ink" : "border-hairline bg-surface-soft/50 text-muted-foreground"
                                                                )}
                                                                onClick={() => {
                                                                    if (userProfile?.role !== 'owner') {
                                                                        toast.error('Ask the owner to change machine operator payroll assignments.')
                                                                        return
                                                                    }
                                                                    openAssignmentEditor(machine, 'night', nightAssignment, activeRate)
                                                                }}
                                                            >
                                                                <span className="max-w-full truncate text-xs font-semibold">
                                                                    {nightWorkerName ? tl(nightWorkerName) : t('machines.assign_worker')}
                                                                </span>
                                                                {nightAssignment?.pay_mode && (
                                                                    <span className="max-w-full truncate text-[10px] text-muted-foreground">
                                                                        {getAssignmentPayLabel(nightAssignment)}
                                                                    </span>
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}

                    {machines?.length === 0 && (
                        <div className="py-8 text-center text-muted-foreground">
                            {canAddMachines ? t('machines.no_machines_add') : t('machines.no_machines_contact')}
                        </div>
                    )}
                </div>
            </CardContent>

            {/* ── Operator Assignment Dialog ── */}
            <Dialog open={assignmentEditor !== null} onOpenChange={(open) => !open && setAssignmentEditor(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign Machine Operator</DialogTitle>
                        <DialogDescription>
                            Set the operator, pay mode, and rate snapshot for this loom shift.
                        </DialogDescription>
                    </DialogHeader>
                    {assignmentEditor && (
                        <div className="space-y-4 py-4">
                            <div className="rounded-md border border-hairline bg-surface-soft/70 px-3 py-2 text-sm">
                                <div className="font-semibold text-ink">{assignmentEditor.machine.name.replace(/^Machine\b/i, 'Loom')}</div>
                                <div className="text-xs font-medium text-muted-foreground">
                                    {assignmentEditor.shift === 'day' ? 'Day shift' : 'Night shift'}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="operator-worker-type">Operator Type</Label>
                                    <select
                                        id="operator-worker-type"
                                        value={assignmentEditor.workerType}
                                        onChange={(e) => {
                                            const workerType = e.target.value as OperatorWorkerType
                                            const payMode = workerType === 'meter_worker' ? 'per_meter' : 'fixed_monthly'
                                            setAssignmentEditor((current) => current && {
                                                ...current,
                                                workerType,
                                                payMode,
                                                meterWorkerId: workerType === 'meter_worker' ? current.meterWorkerId : '',
                                                fixedWorkerId: workerType === 'fixed_worker' ? current.fixedWorkerId : '',
                                                rate: workerType === 'fixed_worker'
                                                    ? String(getFixedWorkerDefaultRate(current.fixedWorkerId, payMode) || '')
                                                    : String(current.rate || ''),
                                            })
                                        }}
                                        className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ring/25"
                                    >
                                        <option value="meter_worker">Meter worker</option>
                                        <option value="fixed_worker">Fixed worker</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="operator-pay-mode">Pay Mode</Label>
                                    <select
                                        id="operator-pay-mode"
                                        value={assignmentEditor.payMode}
                                        onChange={(e) => {
                                            const payMode = e.target.value as OperatorPayMode
                                            const workerType = getOperatorWorkerTypeForPayMode(payMode)
                                            setAssignmentEditor((current) => current && {
                                                ...current,
                                                payMode,
                                                workerType,
                                                meterWorkerId: workerType === 'meter_worker' ? current.meterWorkerId : '',
                                                fixedWorkerId: workerType === 'fixed_worker' ? current.fixedWorkerId : '',
                                                rate: workerType === 'fixed_worker'
                                                    ? String(getFixedWorkerDefaultRate(current.fixedWorkerId, payMode) || '')
                                                    : current.rate,
                                            })
                                        }}
                                        className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ring/25"
                                    >
                                        {assignmentEditor.workerType === 'meter_worker' ? (
                                            <option value="per_meter">Per meter</option>
                                        ) : (
                                            <>
                                                <option value="fixed_monthly">Fixed monthly</option>
                                                <option value="fixed_daily">Fixed daily</option>
                                                <option value="fixed_shift">Fixed shift</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>

                            {assignmentEditor.workerType === 'meter_worker' ? (
                                <div className="space-y-2">
                                    <Label htmlFor="meter-worker">Meter Worker</Label>
                                    <select
                                        id="meter-worker"
                                        value={assignmentEditor.meterWorkerId}
                                        onChange={(e) => setAssignmentEditor((current) => current && { ...current, meterWorkerId: e.target.value })}
                                        className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ring/25"
                                    >
                                        <option value="">Select meter worker</option>
                                        {workers?.map((worker) => (
                                            <option key={worker.id} value={worker.id}>{tl(worker.name)}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label htmlFor="fixed-worker">Fixed Worker</Label>
                                    <select
                                        id="fixed-worker"
                                        value={assignmentEditor.fixedWorkerId}
                                        onChange={(e) => {
                                            const fixedWorkerId = e.target.value
                                            setAssignmentEditor((current) => current && {
                                                ...current,
                                                fixedWorkerId,
                                                rate: String(getFixedWorkerDefaultRate(fixedWorkerId, current.payMode) || ''),
                                            })
                                        }}
                                        className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ring/25"
                                    >
                                        <option value="">Select fixed worker</option>
                                        {fixedWorkers?.map((worker) => (
                                            <option key={worker.id} value={worker.id}>
                                                {tl(worker.name)} · {worker.role}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="operator-rate">
                                    {assignmentEditor.payMode === 'per_meter'
                                        ? 'Rate per meter'
                                        : assignmentEditor.payMode === 'fixed_monthly'
                                            ? 'Monthly rate'
                                            : assignmentEditor.payMode === 'fixed_daily'
                                                ? 'Daily rate'
                                                : 'Shift rate'}
                                </Label>
                                <Input
                                    id="operator-rate"
                                    inputMode="decimal"
                                    value={assignmentEditor.rate}
                                    onChange={(e) => setAssignmentEditor((current) => current && { ...current, rate: e.target.value })}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAssignmentEditor(null)}>{t('common.cancel')}</Button>
                        <Button
                            onClick={saveOperatorAssignment}
                            disabled={
                                !assignmentEditor ||
                                savingAssignment ||
                                Number(assignmentEditor.rate) <= 0 ||
                                (assignmentEditor.workerType === 'meter_worker' ? !assignmentEditor.meterWorkerId : !assignmentEditor.fixedWorkerId)
                            }
                        >
                            {savingAssignment ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {t('common.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Rename Dialog ── */}
            <Dialog open={machineToRename !== null} onOpenChange={(open) => !open && setMachineToRename(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Loom</DialogTitle>
                        <DialogDescription>Update the name or loom type for this loom.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>{t('machines.new_name')}</Label>
                            <Input
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                placeholder={t('machines.add_machine_placeholder')}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-loom-type">Loom Type</Label>
                            <select
                                id="edit-loom-type"
                                value={renameLoomType}
                                onChange={e => setRenameLoomType(e.target.value)}
                                className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ring/25"
                            >
                                <option value="">— Not set —</option>
                                <option value="jacquard">Jacquard</option>
                                <option value="rapier">Rapier</option>
                                <option value="water_jet">Water Jet</option>
                                <option value="air_jet">Air Jet</option>
                                <option value="power_loom">Power Loom</option>
                                <option value="shuttle">Shuttle</option>
                                <option value="other">Other</option>
                            </select>
                            {renameLoomType === 'other' && (
                                <div className="space-y-2 mt-2">
                                    <Label htmlFor="custom-label-edit">Custom Label</Label>
                                    <Input
                                        id="custom-label-edit"
                                        placeholder="e.g. Imported Italian Jacquard"
                                        value={renameCustomLabel}
                                        onChange={(e) => setRenameCustomLabel(e.target.value)}
                                        maxLength={80}
                                    />
                                </div>
                            )}
                            {!renameLoomType && (
                                <p className="text-[11px] font-medium text-warning">
                                    Setting the loom type enables pace index forecasting for this loom.
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMachineToRename(null)}>{t('common.cancel')}</Button>
                        <Button onClick={handleRename} disabled={!renameValue.trim() || renaming}>
                            {renaming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {t('common.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Access Code Modal (SEC-004) */}
            <Dialog open={machineToDelete !== null} onOpenChange={(open) => !open && setMachineToDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-risk">
                            <KeyRound className="h-5 w-5" /> {t('auth.owner_auth_req')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('auth.delete_desc')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>{t('auth.access_code')}</Label>
                            <Input
                                placeholder={t('machines.enter_code')}
                                value={accessCode}
                                onChange={(e) => setAccessCode(e.target.value)}
                                className="font-mono text-lg uppercase tracking-widest"
                                maxLength={6}
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex flex-col sm:flex-row gap-2">
                        {userProfile?.role !== 'owner' && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-xs text-info hover:bg-info-soft hover:text-info"
                                onClick={handleRequestCode}
                                disabled={requestingCode}
                            >
                                {requestingCode ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <KeyRound className="h-3 w-3 mr-1" />}
                                Request Code from Owner
                            </Button>
                        )}
                        <div className="flex gap-2 ml-auto">
                            <Button variant="outline" onClick={() => setMachineToDelete(null)}>{t('common.cancel')}</Button>
                            <Button
                                variant="destructive"
                                disabled={accessCode.length < 6 || deleting}
                                onClick={executeDeleteWithCode}
                            >
                                {deleting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                                {t('auth.verify_delete')}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
