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
import { Loader2, Plus, Trash2, KeyRound, Pencil, Power, Tag } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteMachineWithCode, requestAccessCode } from '@/app/(dashboard)/supervisor/actions'
import {
    addMachine,
    renameMachine,
    toggleMachineStatus as toggleMachineStatusAction,
    updateMachineAssignment,
} from '@/app/(dashboard)/owner/actions'
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

    // Fetch Assignments
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
                <div className="space-y-6">
                    {machines?.map(machine => {
                        const dayAssignment = assignments?.find(a => a.machine_id === machine.id && a.shift === 'day')
                        const nightAssignment = assignments?.find(a => a.machine_id === machine.id && a.shift === 'night')
                        const isInactive = machine.status === 'inactive'

                        const hasAssignments = !!dayAssignment || !!nightAssignment
                        const isEffectivelyActive = !isInactive && hasAssignments

                        // Derive rate from the active order
                        const activeRate = machine.orders?.worker_rate_per_m
                        const activeQualityName = machine.orders?.quality_label

                        return (
                            <div
                                key={machine.id}
                                className={cn(
                                    "p-4 border rounded-lg space-y-4 group transition-opacity",
                                    isInactive ? "bg-gray-100/60 opacity-60" : "bg-gray-50/50"
                                )}
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="font-semibold text-lg">{machine.name}</div>

                                        {/* Dynamic Rate Badge — derived from active order */}
                                        {machine.current_order_id ? (
                                            <div className="text-sm text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 flex items-center gap-1">
                                                <Tag className="h-3 w-3" />
                                                ₹{activeRate ?? '—'}/m
                                                {activeQualityName && (
                                                    <span className="text-teal-500 font-normal text-xs">
                                                        ({activeQualityName})
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 flex items-center gap-1">
                                                <Tag className="h-3 w-3" />
                                                No active order
                                            </div>
                                        )}

                                        {/* Status Badge */}
                                        <span className={cn(
                                            "text-xs px-2 py-0.5 rounded-full font-medium transition-colors",
                                            isEffectivelyActive
                                                ? "bg-green-100 text-green-700"
                                                : "bg-gray-100 text-gray-500"
                                        )} title={!hasAssignments && !isInactive ? "No workers assigned" : ""}>
                                            {isEffectivelyActive ? t('machines.active_status') : t('machines.inactive')}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        {/* Rename Button */}
                                        {canRenameMachines && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-gray-500 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                                onClick={() => {
                                                    setMachineToRename(machine)
                                                    setRenameValue(machine.name)
                                                }}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        )}

                                        {/* Activate / Deactivate Toggle */}
                                        {canRenameMachines && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={cn(
                                                    "h-8 w-8 md:opacity-0 md:group-hover:opacity-100 transition-opacity",
                                                    isInactive ? "text-green-600" : "text-amber-600"
                                                )}
                                                onClick={() => toggleMachineStatus(machine)}
                                                title={isInactive ? t('machines.activate') : t('machines.deactivate')}
                                            >
                                                <Power className="h-4 w-4" />
                                            </Button>
                                        )}

                                        {canDeleteMachines && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-red-500 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                                onClick={() => {
                                                    if (userProfile?.role === 'owner') {
                                                        confirmDelete(machine.id)
                                                    } else {
                                                        setMachineToDelete(machine.id)
                                                        setAccessCode('')
                                                    }
                                                }}
                                                disabled={deleting}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground uppercase">{t('machines.day_shift_hours')}</Label>
                                        <Select
                                            value={dayAssignment?.worker_id.toString()}
                                            onValueChange={(val) => handleAssignment(machine.id, val, 'day')}
                                        >
                                            <SelectTrigger className="bg-white">
                                                <SelectValue placeholder={t('machines.assign_worker')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {workers?.map(w => (
                                                    <SelectItem key={w.id} value={w.id.toString()}>
                                                        {tl(w.name)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground uppercase">{t('machines.night_shift_hours')}</Label>
                                        <Select
                                            value={nightAssignment?.worker_id.toString()}
                                            onValueChange={(val) => handleAssignment(machine.id, val, 'night')}
                                        >
                                            <SelectTrigger className="bg-white">
                                                <SelectValue placeholder={t('machines.assign_worker')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {workers?.map(w => (
                                                    <SelectItem key={w.id} value={w.id.toString()}>
                                                        {tl(w.name)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
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
