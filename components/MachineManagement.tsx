'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
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
    CheckCircle2, 
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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteMachineWithCode, requestAccessCode } from '@/app/(dashboard)/supervisor/actions'
import {
    addMachine,
    renameMachine,
    toggleMachineStatus as toggleMachineStatusAction,
    updateMachineAssignment,
    assignMachineOrder,
} from '@/app/(dashboard)/owner/actions'
import { getActiveOrders } from '@/app/(dashboard)/owner/orders/actions'
import { useUserProfile } from '@/hooks/use-user-profile'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/i18n/context'
import { useTransliterate } from '@/hooks/use-transliterate'
import { cn } from '@/lib/utils'

interface Worker {
    id: number
    name: string
    is_active: boolean
}

interface Machine {
    id: string
    name: string
    status: string
    current_order_id?: string | null
    orders?: {
        worker_rate_per_m: number
        quality_label: string
    } | null
}

interface Assignment {
    machine_id: string
    worker_id: number
    shift: 'day' | 'night'
}

interface YarnBatch {
    id: string
    name: string
    current_machine_id: string | null
    quality_id: string
    quality: {
        name: string
        default_worker_rate_per_m: number
    } | null
}

interface MachineManagementProps {
    orgId: string
    canAddMachines?: boolean
    canRenameMachines?: boolean
    canDeleteMachines?: boolean
}

export function MachineManagement({
    orgId,
    canAddMachines = true,
    canRenameMachines = true,
    canDeleteMachines = true,
}: MachineManagementProps) {
    const supabase = createClient()
    const queryClient = useQueryClient()

    // Add Machine State
    const [isAddMachineOpen, setIsAddMachineOpen] = useState(false)
    const [newMachineName, setNewMachineName] = useState('')
    const [isAddingMachine, setIsAddingMachine] = useState(false)

    // Delete Machine State
    const [machineToDelete, setMachineToDelete] = useState<string | null>(null)
    const [accessCode, setAccessCode] = useState('')
    const [deleting, setDeleting] = useState(false)

    // Rename Machine State
    const [machineToRename, setMachineToRename] = useState<Machine | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const [renaming, setRenaming] = useState(false)

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
                .select('*, orders(worker_rate_per_m, quality_label)')
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

    // Fetch Active Orders (Owner only)
    const { data: activeOrders } = useQuery({
        queryKey: ['active_orders', orgId],
        queryFn: async () => {
            const res = await getActiveOrders()
            if ('error' in res) throw new Error(res.error)
            return res.data
        },
        enabled: !!orgId && (userProfile?.role === 'owner' || userProfile?.role === 'supervisor')
    })

    const { data: assignments, isLoading: assignmentsLoading } = useQuery({
        queryKey: ['machine_assignments', orgId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('machine_assignments')
                .select('*')
                .eq('org_id', orgId)
            if (error) throw error
            return data as Assignment[]
        }
    })

    const handleOrderLink = async (machineId: string, orderId: string | null) => {
        try {
            const res = await assignMachineOrder(machineId, orderId)
            if (res.error) throw new Error(res.error)
            toast.success(t('machines.order_assigned') || 'Order linked to machine')
            queryClient.invalidateQueries({ queryKey: ['machines'] })
        } catch (error: any) {
            toast.error(error.message || t('machines.order_assign_failed'))
        }
    }


    const handleAddMachine = async () => {
        if (!newMachineName) return

        setIsAddingMachine(true)
        try {
            const result = await addMachine(newMachineName)
            if (result.error) throw new Error(result.error)
            toast.success(t('machines.machine_added'))
            queryClient.invalidateQueries({ queryKey: ['machines'] })
            setIsAddMachineOpen(false)
            setNewMachineName('')
        } catch (error: any) {
            toast.error(t('machines.machine_add_failed') + ': ' + error.message)
        } finally {
            setIsAddingMachine(false)
        }
    }

    const confirmDelete = async (id: string) => {
        if (userProfile?.role === 'owner') {
            if (confirm(t('machines.delete_confirm'))) {
                setDeleting(true)
                const { error } = await supabase.from('machines').delete().eq('id', id)
                setDeleting(false)
                if (error) toast.error(t('machines.machine_delete_failed'))
                else {
                    toast.success(t('machines.machine_deleted'))
                    queryClient.invalidateQueries({ queryKey: ['machines'] })
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
        } catch (error: any) {
            toast.error(error.message || t('machines.machine_delete_failed'))
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
        } catch (error: any) {
            toast.error(error.message || 'Failed to request code')
        } finally {
            setRequestingCode(false)
        }
    }

    // ── Rename Machine ──
    const handleRename = async () => {
        if (!machineToRename || !renameValue.trim()) return
        setRenaming(true)
        try {
            const result = await renameMachine(machineToRename.id, renameValue.trim())
            if (result.error) throw new Error(result.error)
            toast.success(t('machines.renamed'))
            queryClient.invalidateQueries({ queryKey: ['machines'] })
            setMachineToRename(null)
        } catch {
            toast.error(t('machines.rename_failed'))
        } finally {
            setRenaming(false)
        }
    }

    // ── Toggle Machine Status (activate / deactivate) ──
    const toggleMachineStatus = async (machine: Machine) => {
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
        } catch {
            toast.error(t('machines.status_update_failed'))
            // Rollback on error
            queryClient.setQueryData(['machines', orgId], oldMachines)
        } finally {
            queryClient.invalidateQueries({ queryKey: ['machines', orgId] })
        }
    }

    const handleAssignment = async (machineId: string, workerId: string, shift: 'day' | 'night') => {
        try {
            const existing = assignments?.find(a => a.machine_id === machineId && a.shift === shift)
            const result = await updateMachineAssignment(
                machineId,
                parseInt(workerId),
                shift,
                !!existing
            )
            if (result.error) throw new Error(result.error)
            toast.success(t('machines.worker_assigned'))
            queryClient.invalidateQueries({ queryKey: ['machine_assignments'] })
        } catch (error: any) {
            console.error(error)
            toast.error(t('machines.worker_assign_failed'))
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
                    <div key={i} className="p-4 border rounded-lg bg-gray-50/50 space-y-4">
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
                                    {/* Rate is now defined on the Quality, not the machine */}
                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-md p-2.5">
                                        <Tag className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                        Worker rates are set per fabric quality in the Inventory tab. The machine's rate updates automatically when a beam is linked.
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
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
                    {machines?.map(machine => {
                        const dayAssignment = assignments?.find(a => a.machine_id === machine.id && a.shift === 'day')
                        const nightAssignment = assignments?.find(a => a.machine_id === machine.id && a.shift === 'night')
                        const isInactive = machine.status === 'inactive'

                        const hasAssignments = !!dayAssignment || !!nightAssignment
                        const isEffectivelyActive = !isInactive && hasAssignments

                        // Derive rate from the active order
                        const activeRate = machine.orders?.worker_rate_per_m
                        const activeQualityName = machine.orders?.quality_label

                        const dayWorkerName = workers?.find(w => w.id === dayAssignment?.worker_id)?.name
                        const nightWorkerName = workers?.find(w => w.id === nightAssignment?.worker_id)?.name

                        return (
                            <div
                                key={machine.id}
                                className={cn(
                                    "relative flex flex-col justify-between p-5 border rounded-2xl transition-all duration-300 group",
                                    isInactive 
                                        ? "bg-gray-100/40 border-gray-200 grayscale opacity-70" 
                                        : "bg-white border-slate-200 hover:border-teal-500/50 hover:shadow-xl hover:shadow-teal-500/5"
                                )}
                            >
                                {/* Header: Machine ID & Status */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                            isEffectivelyActive ? "bg-teal-50 text-teal-600" : "bg-slate-50 text-slate-400"
                                        )}>
                                            <Activity className={cn("h-5 w-5", isEffectivelyActive && "animate-pulse")} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900">{machine.name}</h3>
                                            <div className="flex items-center gap-1.5">
                                                {isEffectivelyActive ? (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold text-teal-600 uppercase tracking-wider">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                                                        {t('machines.active_status')}
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                        {t('machines.inactive')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Actions Dropdown */}
                                    <div className="flex items-center">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-40">
                                                {canRenameMachines && (
                                                    <>
                                                        <DropdownMenuItem onClick={() => toggleMachineStatus(machine)}>
                                                            <Power className={cn("h-4 w-4 mr-2", isInactive ? "text-teal-600" : "text-amber-600")} />
                                                            {isInactive? t('machines.activate') : t('machines.deactivate')}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => {
                                                            setMachineToRename(machine)
                                                            setRenameValue(machine.name)
                                                        }}>
                                                            <Pencil className="h-4 w-4 mr-2" />
                                                            {t('machines.rename_machine')}
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                                {canDeleteMachines && (
                                                    <DropdownMenuItem 
                                                        className="text-red-600 focus:text-red-600"
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
                                </div>

                                {/* Order & Quality Section */}
                                <div className="flex-1 space-y-4">
                                    <Popover>
                                        <PopoverTrigger asChild disabled={userProfile?.role !== 'owner' && userProfile?.role !== 'supervisor'}>
                                            <div className={cn(
                                                "p-3 rounded-xl border transition-all",
                                                machine.current_order_id 
                                                    ? "bg-teal-50/30 border-teal-100" 
                                                    : "bg-slate-50 border-slate-100",
                                                (userProfile?.role === 'owner' || userProfile?.role === 'supervisor') && "cursor-pointer hover:border-teal-300 hover:bg-teal-50/50"
                                            )}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Active Requirement</span>
                                                    {machine.current_order_id && (
                                                        <Badge variant="outline" className="text-[10px] bg-white text-teal-700 border-teal-200">
                                                            ₹{activeRate ?? '—'}/m
                                                        </Badge>
                                                    )}
                                                </div>
                                                {machine.current_order_id ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1.5 bg-white rounded-lg border border-teal-100">
                                                            <Tag className="h-3.5 w-3.5 text-teal-500" />
                                                        </div>
                                                        <span className="text-sm font-semibold text-slate-800 truncate">
                                                            {activeQualityName || "Custom Order"}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-slate-400 italic">
                                                        <AlertCircle className="h-3.5 w-3.5" />
                                                        <span className="text-xs">No active order</span>
                                                    </div>
                                                )}
                                            </div>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[280px] p-0" align="start">
                                            <div className="max-h-[300px] overflow-auto p-1">
                                                <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase border-b mb-1 flex justify-between items-center">
                                                    Assign New Order
                                                    {machine.current_order_id && (
                                                        <button 
                                                            onClick={() => handleOrderLink(machine.id, null)}
                                                            className="text-red-500 hover:text-red-600 font-bold"
                                                        >
                                                            Unlink
                                                        </button>
                                                    )}
                                                </div>
                                                {activeOrders?.map((order: any) => (
                                                    <button
                                                        key={order.id}
                                                        type="button"
                                                        className={cn(
                                                            "w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors hover:bg-slate-100 space-y-0.5",
                                                            machine.current_order_id === order.id && "bg-teal-50 text-teal-700 font-medium border border-teal-100"
                                                        )}
                                                        onClick={() => {
                                                            handleOrderLink(machine.id, order.id)
                                                        }}
                                                    >
                                                        <div className="font-bold truncate">{order.quality_label || 'Unnamed Order'}</div>
                                                        <div className="text-[10px] opacity-70 truncate">{order.party_name}</div>
                                                    </button>
                                                ))}
                                                {activeOrders?.length === 0 && (
                                                    <div className="p-4 text-center text-xs text-slate-500 italic">
                                                        No active orders found.<br/>
                                                        Create one in the Orders tab.
                                                    </div>
                                                )}
                                            </div>
                                        </PopoverContent>
                                    </Popover>

                                    {/* Shift Assignments */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Day Shift */}
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                <Sun className="h-3 w-3 text-amber-500" />
                                                Day
                                            </div>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className={cn(
                                                            "w-full justify-start text-left font-normal h-9 px-3 rounded-xl border-dashed hover:border-solid transition-all",
                                                            dayAssignment ? "text-slate-900 border-slate-200 bg-white" : "text-slate-400 border-slate-200 bg-slate-50/50"
                                                        )}
                                                    >
                                                        <span className="truncate text-xs">
                                                            {dayWorkerName ? tl(dayWorkerName) : t('machines.assign_worker')}
                                                        </span>
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[200px] p-0" align="start">
                                                    <div className="max-h-[240px] overflow-auto p-1">
                                                        <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase border-b mb-1">
                                                            Select Day Worker
                                                        </div>
                                                        {workers?.map(w => (
                                                            <button
                                                                key={w.id}
                                                                type="button"
                                                                className={cn(
                                                                    "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors hover:bg-slate-100",
                                                                    dayAssignment?.worker_id === w.id && "bg-teal-50 text-teal-700 font-medium"
                                                                )}
                                                                onClick={() => {
                                                                    handleAssignment(machine.id, w.id.toString(), 'day')
                                                                }}
                                                            >
                                                                {tl(w.name)}
                                                            </button>
                                                        ))}
                                                        {workers?.length === 0 && (
                                                            <div className="p-3 text-center text-xs text-slate-500">No workers available</div>
                                                        )}
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>

                                        {/* Night Shift */}
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                <Moon className="h-3 w-3 text-indigo-500" />
                                                Night
                                            </div>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className={cn(
                                                            "w-full justify-start text-left font-normal h-9 px-3 rounded-xl border-dashed hover:border-solid transition-all",
                                                            nightAssignment ? "text-slate-900 border-slate-200 bg-white" : "text-slate-400 border-slate-200 bg-slate-50/50"
                                                        )}
                                                    >
                                                        <span className="truncate text-xs">
                                                            {nightWorkerName ? tl(nightWorkerName) : t('machines.assign_worker')}
                                                        </span>
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[200px] p-0" align="start">
                                                    <div className="max-h-[240px] overflow-auto p-1">
                                                        <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase border-b mb-1">
                                                            Select Night Worker
                                                        </div>
                                                        {workers?.map(w => (
                                                            <button
                                                                key={w.id}
                                                                type="button"
                                                                className={cn(
                                                                    "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors hover:bg-slate-100",
                                                                    nightAssignment?.worker_id === w.id && "bg-teal-50 text-teal-700 font-medium"
                                                                )}
                                                                onClick={() => {
                                                                    handleAssignment(machine.id, w.id.toString(), 'night')
                                                                }}
                                                            >
                                                                {tl(w.name)}
                                                            </button>
                                                        ))}
                                                        {workers?.length === 0 && (
                                                            <div className="p-3 text-center text-xs text-slate-500">No workers available</div>
                                                        )}
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}

                    {machines?.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            {canAddMachines ? t('machines.no_machines_add') : t('machines.no_machines_contact')}
                        </div>
                    )}
                </div>
            </CardContent>

            {/* ── Rename Dialog ── */}
            <Dialog open={machineToRename !== null} onOpenChange={(open) => !open && setMachineToRename(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('machines.rename_machine')}</DialogTitle>
                        <DialogDescription>{t('machines.rename_desc')}</DialogDescription>
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
                        <DialogTitle className="flex items-center gap-2 text-red-600">
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
                                className="font-mono uppercase tracking-widest text-lg"
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
                                className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
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
