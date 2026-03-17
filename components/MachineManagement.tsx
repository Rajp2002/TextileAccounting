'use client'

import { useState } from 'react'
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
import { Loader2, Save, Plus, Trash2, KeyRound } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteMachineWithCode } from '@/app/(dashboard)/supervisor/actions'
import { useUserProfile } from '@/hooks/use-user-profile'
import { Skeleton } from '@/components/ui/skeleton'

interface Worker {
    id: number
    name: string
    is_active: boolean
}

interface Machine {
    id: string
    name: string
    status: string
    rate_per_meter: number
}

interface Assignment {
    machine_id: string
    worker_id: number
    shift: 'day' | 'night'
}

interface MachineManagementProps {
    orgId: string
    canEditRates?: boolean
    canAddMachines?: boolean
}

export function MachineManagement({ orgId, canEditRates = true, canAddMachines = true }: MachineManagementProps) {
    const supabase = createClient()
    const queryClient = useQueryClient()
    const [editingRates, setEditingRates] = useState<Record<string, string>>({})
    const [saving, setSaving] = useState<Record<string, boolean>>({})

    // Add Machine State
    const [isAddMachineOpen, setIsAddMachineOpen] = useState(false)
    const [newMachineName, setNewMachineName] = useState('')
    const [newMachineRate, setNewMachineRate] = useState('')
    const [isAddingMachine, setIsAddingMachine] = useState(false)

    // Delete Machine State
    const [machineToDelete, setMachineToDelete] = useState<string | null>(null)
    const [accessCode, setAccessCode] = useState('')
    const [deleting, setDeleting] = useState(false)

    // Use shared profile hook instead of independent fetch
    const { data: userProfile } = useUserProfile()

    // Fetch Machines
    const { data: machines, isLoading: machinesLoading } = useQuery({
        queryKey: ['machines', orgId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('machines')
                .select('*')
                .eq('org_id', orgId)
                .order('name')
            if (error) throw error
            return data as Machine[]
        }
    })

    // Fetch Workers
    const { data: workers } = useQuery({
        queryKey: ['workers', orgId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('workers')
                .select('id, name, is_active')
                .eq('org_id', orgId)
                .eq('is_active', true) // Only active workers for assignment
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

    const handleRateChange = (machineId: string, value: string) => {
        setEditingRates(prev => ({ ...prev, [machineId]: value }))
    }

    const saveRate = async (machineId: string) => {
        const newRate = editingRates[machineId]
        if (!newRate) return

        setSaving(prev => ({ ...prev, [machineId]: true }))
        try {
            const { error } = await supabase
                .from('machines')
                .update({ rate_per_meter: parseFloat(newRate) })
                .eq('id', machineId)

            if (error) throw error
            toast.success('Rate updated')
            queryClient.invalidateQueries({ queryKey: ['machines'] })
            setEditingRates(prev => {
                const next = { ...prev }
                delete next[machineId]
                return next
            })
        } catch (error: any) {
            toast.error('Failed to update rate')
        } finally {
            setSaving(prev => ({ ...prev, [machineId]: false }))
        }
    }

    const handleAddMachine = async () => {
        if (!newMachineName || !newMachineRate) return

        setIsAddingMachine(true)
        try {
            const { error } = await supabase
                .from('machines')
                .insert({
                    name: newMachineName,
                    rate_per_meter: parseFloat(newMachineRate),
                    org_id: orgId,
                    status: 'active'
                })

            if (error) throw error
            toast.success('Machine added successfully')
            queryClient.invalidateQueries({ queryKey: ['machines'] })
            setIsAddMachineOpen(false)
            setNewMachineName('')
            setNewMachineRate('')
        } catch (error: any) {
            toast.error('Failed to add machine: ' + error.message)
        } finally {
            setIsAddingMachine(false)
        }
    }

    const confirmDelete = async (id: string) => {
        if (userProfile?.role === 'owner') {
            // Owner can delete directly
            if (confirm('Are you sure you want to delete this machine?')) {
                setDeleting(true)
                const { error } = await supabase.from('machines').delete().eq('id', id)
                setDeleting(false)
                if (error) toast.error('Failed to delete machine')
                else {
                    toast.success('Machine deleted')
                    queryClient.invalidateQueries({ queryKey: ['machines'] })
                }
            }
        } else {
            // Supervisor needs code
            setMachineToDelete(id)
            setAccessCode('')
        }
    }

    const executeDeleteWithCode = async () => {
        if (!machineToDelete) return
        setDeleting(true)
        try {
            const result = await deleteMachineWithCode(orgId, machineToDelete, accessCode)
            if (result.error) throw new Error(result.error)

            toast.success('Machine deleted successfully')
            setMachineToDelete(null)
            queryClient.invalidateQueries({ queryKey: ['machines'] })
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete machine')
        } finally {
            setDeleting(false)
        }
    }

    const handleAssignment = async (machineId: string, workerId: string, shift: 'day' | 'night') => {
        try {
            // Check if assignment exists
            const existing = assignments?.find(a => a.machine_id === machineId && a.shift === shift)

            let error;
            if (existing) {
                // Update
                const { error: updateError } = await supabase
                    .from('machine_assignments')
                    .update({ worker_id: parseInt(workerId) })
                    .eq('machine_id', machineId)
                    .eq('shift', shift)
                    .eq('org_id', orgId)
                error = updateError
            } else {
                // Insert
                const { error: insertError } = await supabase
                    .from('machine_assignments')
                    .insert({
                        machine_id: machineId,
                        worker_id: parseInt(workerId),
                        shift,
                        org_id: orgId
                    })
                error = insertError
            }

            if (error) throw error
            toast.success(`Worker assigned to ${shift} shift`)
            queryClient.invalidateQueries({ queryKey: ['machine_assignments'] })
        } catch (error: any) {
            console.error(error)
            toast.error('Failed to assign worker')
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
                    <CardTitle>Machine Rates & Assignments</CardTitle>
                    <CardDescription>
                        {canEditRates
                            ? "Set rates per machine and assign workers to shifts."
                            : "Assign workers to shifts for each machine."}
                    </CardDescription>
                </div>
                {canAddMachines && (
                    <div className="flex items-center gap-2">
                        <Dialog open={isAddMachineOpen} onOpenChange={setIsAddMachineOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    Add Machine
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Add New Machine</DialogTitle>
                                    <DialogDescription>
                                        Enter the details for the new machine.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Machine Name</Label>
                                        <Input
                                            id="name"
                                            placeholder="e.g., Loom 1"
                                            value={newMachineName}
                                            onChange={(e) => setNewMachineName(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="rate">Rate per Meter (₹)</Label>
                                        <Input
                                            id="rate"
                                            type="number"
                                            placeholder="0.00"
                                            value={newMachineRate}
                                            onChange={(e) => setNewMachineRate(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsAddMachineOpen(false)}>Cancel</Button>
                                    <Button onClick={handleAddMachine} disabled={!newMachineName || !newMachineRate || isAddingMachine}>
                                        {isAddingMachine ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                        Add Machine
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

                        return (
                            <div key={machine.id} className="p-4 border rounded-lg bg-gray-50/50 space-y-4 group">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="font-semibold text-lg">{machine.name}</div>
                                        <div className="text-sm text-gray-500 bg-white px-2 py-0.5 rounded border">
                                            Current Rate: ₹{machine.rate_per_meter}/m
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {canEditRates && (
                                            <>
                                                <Input
                                                    type="number"
                                                    placeholder="New Rate"
                                                    className="w-24 h-8"
                                                    value={editingRates[machine.id] ?? ''}
                                                    onChange={(e) => handleRateChange(machine.id, e.target.value)}
                                                />
                                                <Button
                                                    size="sm"
                                                    onClick={() => saveRate(machine.id)}
                                                    disabled={!editingRates[machine.id] || saving[machine.id]}
                                                >
                                                    {saving[machine.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                </Button>
                                            </>
                                        )}

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-500 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                            onClick={() => confirmDelete(machine.id)}
                                            disabled={deleting}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground uppercase">Day Shift (7AM - 7PM)</Label>
                                        <Select
                                            value={dayAssignment?.worker_id.toString()}
                                            onValueChange={(val) => handleAssignment(machine.id, val, 'day')}
                                        >
                                            <SelectTrigger className="bg-white">
                                                <SelectValue placeholder="Assign Worker" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {workers?.map(w => (
                                                    <SelectItem key={w.id} value={w.id.toString()}>
                                                        {w.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground uppercase">Night Shift (7PM - 7AM)</Label>
                                        <Select
                                            value={nightAssignment?.worker_id.toString()}
                                            onValueChange={(val) => handleAssignment(machine.id, val, 'night')}
                                        >
                                            <SelectTrigger className="bg-white">
                                                <SelectValue placeholder="Assign Worker" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {workers?.map(w => (
                                                    <SelectItem key={w.id} value={w.id.toString()}>
                                                        {w.name}
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
                            No machines found. {canAddMachines ? "Please add a machine." : "Contact the owner to add machines."}
                        </div>
                    )}
                </div>
            </CardContent>

            {/* Access Code Modal (SEC-004) */}
            <Dialog open={machineToDelete !== null} onOpenChange={(open) => !open && setMachineToDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <KeyRound className="h-5 w-5" /> Owner Authorization Required
                        </DialogTitle>
                        <DialogDescription>
                            Deleting a machine permanently removes it and its configuration. This action requires a single-use access code from the factory owner.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Access Code</Label>
                            <Input
                                placeholder="Enter 6-character code"
                                value={accessCode}
                                onChange={(e) => setAccessCode(e.target.value)}
                                className="font-mono uppercase tracking-widest text-lg"
                                maxLength={6}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMachineToDelete(null)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            disabled={accessCode.length < 6 || deleting}
                            onClick={executeDeleteWithCode}
                        >
                            {deleting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                            Verify & Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
