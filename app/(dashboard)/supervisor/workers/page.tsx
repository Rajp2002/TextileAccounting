'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { deleteWorkerWithCode, getWorkerDebt } from '@/app/(dashboard)/supervisor/actions'
import { formatINR } from '@/lib/finance'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useTranslation } from '@/lib/i18n/context'
import { useTransliterate } from '@/hooks/use-transliterate'

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
    const [workerDebt, setWorkerDebt] = useState<number>(0)
    const [accessCode, setAccessCode] = useState('')
    const [deleting, setDeleting] = useState(false)
    const [fetchingDebt, setFetchingDebt] = useState(false)

    const { data: userProfile } = useUserProfile()
    const { t } = useTranslation()
    const tl = useTransliterate()

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

    const confirmDelete = async (id: number) => {
        if (!userProfile?.org_id) return
        setFetchingDebt(true)
        try {
            const res = await getWorkerDebt(userProfile.org_id, id, 'meter')
            setWorkerDebt(res.balance || 0)
            setWorkerToDelete(id)
            setAccessCode('')
        } finally {
            setFetchingDebt(false)
        }
    }

    const executeDelete = async () => {
        if (!workerToDelete || !userProfile?.org_id) return
        setDeleting(true)
        try {
            const result = await deleteWorkerWithCode(userProfile.org_id, workerToDelete, accessCode)
            if (result.error) throw new Error(result.error)

            toast.success('Worker deleted successfully')
            setWorkerToDelete(null)
            queryClient.invalidateQueries({ queryKey: ['workers'] })
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete worker')
        } finally {
            setDeleting(false)
        }
    }

    // ── Toggle worker active status ──
    const toggleWorkerActive = async (workerId: number, currentActive: boolean, table: 'workers' | 'fixed_workers') => {
        try {
            const { error } = await supabase
                .from(table)
                .update({ is_active: !currentActive })
                .eq('id', workerId)
            if (error) throw error
            toast.success(t('workers.status_updated'))
            queryClient.invalidateQueries({ queryKey: [table === 'workers' ? 'workers' : 'fixed_workers', userProfile?.org_id] })
        } catch {
            toast.error(t('workers.status_update_failed'))
        }
    }

    if (!userProfile) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>

    return (
        <div className="p-4 space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">{t('workers.manage_workers')}</h1>
                <AddWorkerDialog
                    orgId={userProfile.org_id}
                    onWorkerAdded={handleWorkerAdded}
                />
            </div>

            {/* ── Workers Tabs ── */}
            <Tabs defaultValue="meter" className="w-full">
                <TabsList className="w-full">
                    <TabsTrigger value="meter" className="flex-1">
                        {t('workers.meter_workers')}
                        {workers && workers.length > 0 && (
                            <span className="ml-1.5 text-xs text-muted-foreground">({workers.length})</span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="fixed" className="flex-1">
                        {t('workers.fixed_staff')}
                        {fixedWorkers && fixedWorkers.length > 0 && (
                            <span className="ml-1.5 text-xs text-muted-foreground">({fixedWorkers.length})</span>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* ── Meter Workers Tab ── */}
                <TabsContent value="meter" className="mt-4">
                    {workersLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <div className="divide-y border rounded-lg">
                            {workers?.map((worker: any) => (
                                <div key={worker.id} className="py-3 px-4 flex justify-between items-center group">
                                    <div className="flex items-center gap-3">
                                        <span className="font-medium text-gray-700">{tl(worker.name)}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {/* Active Toggle */}
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "text-xs",
                                                worker.is_active ? "text-green-600" : "text-gray-400"
                                            )}>
                                                {worker.is_active ? t('workers.active') : t('workers.inactive')}
                                            </span>
                                            <Switch
                                                checked={worker.is_active}
                                                onCheckedChange={() => toggleWorkerActive(worker.id, worker.is_active, 'workers')}
                                            />
                                        </div>
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
                                <p className="text-center text-gray-500 py-8">{t('workers.no_meter_workers')}</p>
                            )}
                        </div>
                    )}
                </TabsContent>

                {/* ── Fixed Staff Tab ── */}
                <TabsContent value="fixed" className="mt-4">
                    {fixedLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <div className="divide-y border rounded-lg">
                            {fixedWorkers?.map((worker: any) => (
                                <div key={worker.id} className="py-3 px-4 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <span className={cn(
                                            'text-xs px-2 py-0.5 rounded-full font-medium',
                                            ROLE_COLORS[worker.role] || 'bg-gray-100 text-gray-700'
                                        )}>
                                            {t(`workers.roles.${worker.role}`) || worker.role}
                                        </span>
                                        <span className="font-medium text-gray-700">{tl(worker.name)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "text-xs",
                                            worker.is_active ? "text-green-600" : "text-gray-400"
                                        )}>
                                            {worker.is_active ? t('workers.active') : t('workers.inactive')}
                                        </span>
                                        <Switch
                                            checked={worker.is_active}
                                            onCheckedChange={() => toggleWorkerActive(worker.id, worker.is_active, 'fixed_workers')}
                                        />
                                    </div>
                                </div>
                            ))}
                            {fixedWorkers?.length === 0 && (
                                <p className="text-center text-gray-500 py-8">{t('workers.no_fixed_staff')}</p>
                            )}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Access Code Modal (SEC-004) */}
            <Dialog open={workerToDelete !== null} onOpenChange={(open) => !open && setWorkerToDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <KeyRound className="h-5 w-5" /> {t('workers.auth_req')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('workers.delete_desc')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {workerDebt > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-amber-900">{t('workers.outstanding_adv')}</p>
                                    <p className="text-xs text-amber-700 mt-0.5">
                                        {t('workers.balance_warning')} <strong className="text-amber-900">{formatINR(workerDebt)}</strong>{t('workers.settle_warning')}
                                    </p>
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>{t('auth.access_code')}</Label>
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
                        <Button variant="outline" onClick={() => setWorkerToDelete(null)}>{t('common.cancel')}</Button>
                        <Button
                            variant="destructive"
                            disabled={accessCode.length < 6 || deleting}
                            onClick={executeDelete}
                        >
                            {deleting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                            {t('auth.verify_delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
