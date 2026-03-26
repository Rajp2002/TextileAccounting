'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useTranslation } from '@/lib/i18n/context'
import { useTransliterate } from '@/hooks/use-transliterate'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Loader2, Sun, Moon } from 'lucide-react'
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
    yarn_batches?: any[]
}

interface Assignment {
    machine_id: string
    worker_id: number
    shift: 'day' | 'night'
}

export default function SupervisorAssignmentsPage() {
    const supabase = createClient()
    const queryClient = useQueryClient()
    const { t } = useTranslation()
    const tl = useTransliterate()
    const { data: userProfile } = useUserProfile()
    const [activeShift, setActiveShift] = useState<'day' | 'night'>('day')

    const orgId = userProfile?.org_id

    // Fetch Machines
    const { data: machines, isLoading: machinesLoading } = useQuery({
        queryKey: ['machines', orgId],
        enabled: !!orgId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('machines')
                .select('*, yarn_batches(status, qualities(default_worker_rate_per_m))')
                .eq('org_id', orgId!)
                .order('name')
            if (error) throw error
            return data as Machine[]
        }
    })

    // Fetch Workers (active only)
    const { data: workers } = useQuery({
        queryKey: ['workers', orgId],
        enabled: !!orgId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('workers')
                .select('id, name, is_active')
                .eq('org_id', orgId!)
                .eq('is_active', true)
                .order('name')
            if (error) throw error
            return data as Worker[]
        }
    })

    // Fetch Assignments
    const { data: assignments } = useQuery({
        queryKey: ['machine_assignments', orgId],
        enabled: !!orgId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('machine_assignments')
                .select('*')
                .eq('org_id', orgId!)
            if (error) throw error
            return data as Assignment[]
        }
    })

    const handleAssignment = async (machineId: string, workerId: string) => {
        if (!orgId) return
        try {
            const existing = assignments?.find(a => a.machine_id === machineId && a.shift === activeShift)

            let error;
            if (existing) {
                const { error: updateError } = await supabase
                    .from('machine_assignments')
                    .update({ worker_id: parseInt(workerId) })
                    .eq('machine_id', machineId)
                    .eq('shift', activeShift)
                    .eq('org_id', orgId)
                error = updateError
            } else {
                const { error: insertError } = await supabase
                    .from('machine_assignments')
                    .insert({
                        machine_id: machineId,
                        worker_id: parseInt(workerId),
                        shift: activeShift,
                        org_id: orgId
                    })
                error = insertError
            }

            if (error) throw error
            toast.success(t('machines.worker_assigned'))
            queryClient.invalidateQueries({ queryKey: ['machine_assignments'] })
        } catch (error: any) {
            console.error(error)
            toast.error(t('machines.worker_assign_failed'))
        }
    }

    if (!userProfile?.org_id) return (
        <div className="flex flex-col items-center justify-center h-[50vh]">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-4" />
            <p className="text-gray-500 font-medium text-sm">Loading profile...</p>
        </div>
    )

    const activeMachines = machines?.filter(m => m.status === 'active') ?? []

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-bold">{t('assignments.title')}</h1>

                {/* ── Global Shift Toggle ── */}
                <div className="inline-flex items-center rounded-lg border bg-gray-100 p-1 gap-0.5">
                    <button
                        onClick={() => setActiveShift('day')}
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-all",
                            activeShift === 'day'
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        <Sun className="h-4 w-4" />
                        {t('assignments.day_shift')}
                    </button>
                    <button
                        onClick={() => setActiveShift('night')}
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-all",
                            activeShift === 'night'
                                ? "bg-gray-900 text-white shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        <Moon className="h-4 w-4" />
                        {t('assignments.night_shift')}
                    </button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('assignments.title')}</CardTitle>
                    <CardDescription>
                        {activeShift === 'day'
                            ? t('assignments.day_desc')
                            : t('assignments.night_desc')
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {machinesLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                                    <Skeleton className="h-5 w-32" />
                                    <Skeleton className="h-9 w-40" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="divide-y">
                            {activeMachines.map(machine => {
                                const assignment = assignments?.find(
                                    a => a.machine_id === machine.id && a.shift === activeShift
                                )
                                return (
                                    <div key={machine.id} className="py-3 flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="font-medium text-gray-800 truncate">{machine.name}</div>
                                            <div className="text-xs text-gray-400">
                                                {(() => {
                                                    const activeBatch = machine.yarn_batches?.find((b: any) => b.status === 'active')
                                                    const rate = activeBatch?.qualities?.default_worker_rate_per_m
                                                    return rate ? `₹${rate}/m` : t('machines.no_active_beam')
                                                })()}
                                            </div>
                                        </div>
                                        <Select
                                            value={assignment?.worker_id.toString()}
                                            onValueChange={(val) => handleAssignment(machine.id, val)}
                                        >
                                            <SelectTrigger className="w-44 bg-white">
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
                                )
                            })}

                            {activeMachines.length === 0 && (
                                <div className="text-center py-8 text-gray-500">
                                    {t('machines.no_machines_contact')}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
