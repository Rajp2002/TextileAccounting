'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AddWorkerDialog } from '@/components/AddWorkerDialog'
import { Loader2, Trash2, KeyRound } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { deleteWorkerWithCode } from '@/app/(dashboard)/supervisor/actions'
import { cn } from '@/lib/utils'

const ROLE_LABELS: Record<string, string> = {
    master: 'Master', supervisor: 'Supervisor', helper: 'Helper',
    mender: 'Mender', sanitation: 'Sanitation', daily: 'Day-to-Day',
}
const ROLE_COLORS: Record<string, string> = {
    master: 'bg-purple-100 text-purple-700', supervisor: 'bg-blue-100 text-blue-700',
    helper: 'bg-amber-100 text-amber-700', mender: 'bg-teal-100 text-teal-700',
    sanitation: 'bg-green-100 text-green-700', daily: 'bg-orange-100 text-orange-700',
}

export default function SupervisorWorkersPage() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    // Authorization State
    const [workerToDelete, setWorkerToDelete] = useState<number | null>(null)
    const [accessCode, setAccessCode] = useState('')
    const [deleting, setDeleting] = useState(false)

    // Fetch User Profile to get Org ID
    const { data: userProfile } = useQuery({
        queryKey: ['user_profile'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')
            const { data, error } = await supabase
                .from('profiles')
                .select('org_id, role')
                .eq('id', user.id)
                .single()
            if (error) throw error
            return data
        }
    })

    // Fetch Meter (piece-rate) Workers
    const { data: workers, isLoading: workersLoading } = useQuery({
        queryKey: ['workers', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('workers')
                .select('*')
                .eq('org_id', userProfile!.org_id)
                .order('name')
            if (error) throw error
            return data
        }
    })

    // Fetch Fixed / Salaried Workers
    const { data: fixedWorkers, isLoading: fixedLoading } = useQuery({
        queryKey: ['fixed_workers', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('fixed_workers')
                .select('*')
                .eq('org_id', userProfile!.org_id)
                .order('role')
                .order('name')
            if (error) throw error
            return data
        }
    })

    const handleWorkerAdded = () => {
        // Invalidate both lists so the new worker appears immediately
        queryClient.invalidateQueries({ queryKey: ['workers', userProfile?.org_id] })
        queryClient.invalidateQueries({ queryKey: ['fixed_workers', userProfile?.org_id] })
    }

    const confirmDelete = (id: number) => {
        setWorkerToDelete(id)
        setAccessCode('')
    }

    const executeDelete = async () => {
        if (!workerToDelete || !userProfile?.org_id) return
        setDeleting(true)
        try {
            await deleteWorkerWithCode(userProfile.org_id, workerToDelete, accessCode)
            toast.success('Worker deleted successfully')
            setWorkerToDelete(null)
            queryClient.invalidateQueries({ queryKey: ['workers'] })
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete worker')
        } finally {
            setDeleting(false)
        }
    }

    if (!userProfile) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>

    return (
        <div className="p-4 space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Manage Workers</h1>
                <AddWorkerDialog
                    orgId={userProfile.org_id}
                    onWorkerAdded={handleWorkerAdded}
                />
            </div>

            {/* ── Meter Workers ── */}
            <Card>
                <CardHeader>
                    <CardTitle>Meter Workers</CardTitle>
                </CardHeader>
                <CardContent>
                    {workersLoading ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <div className="divide-y">
                            {workers?.map((worker: any) => (
                                <div key={worker.id} className="py-3 flex justify-between items-center group">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${worker.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                                        <span className="font-medium text-gray-700">{worker.name}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs text-gray-400">
                                            {worker.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => confirmDelete(worker.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {workers?.length === 0 && (
                                <p className="text-center text-gray-500 py-8">No meter workers yet. Add one to get started.</p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── Fixed / Salaried Staff ── */}
            <Card>
                <CardHeader>
                    <CardTitle>Fixed Staff</CardTitle>
                </CardHeader>
                <CardContent>
                    {fixedLoading ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <div className="divide-y">
                            {fixedWorkers?.map((worker: any) => (
                                <div key={worker.id} className="py-3 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <span className={cn(
                                            'text-xs px-2 py-0.5 rounded-full font-medium',
                                            ROLE_COLORS[worker.role] || 'bg-gray-100 text-gray-700'
                                        )}>
                                            {ROLE_LABELS[worker.role] || worker.role}
                                        </span>
                                        <span className="font-medium text-gray-700">{worker.name}</span>
                                    </div>
                                    <span className="text-xs text-gray-400">
                                        {worker.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            ))}
                            {fixedWorkers?.length === 0 && (
                                <p className="text-center text-gray-500 py-8">No fixed staff yet. Add one to get started.</p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Access Code Modal (SEC-004) */}
            <Dialog open={workerToDelete !== null} onOpenChange={(open) => !open && setWorkerToDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <KeyRound className="h-5 w-5" /> Owner Authorization Required
                        </DialogTitle>
                        <DialogDescription>
                            Deleting a worker record permanently removes them. This action requires a single-use access code from the factory owner.
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
                        <Button variant="outline" onClick={() => setWorkerToDelete(null)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            disabled={accessCode.length < 6 || deleting}
                            onClick={executeDelete}
                        >
                            {deleting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                            Verify & Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
