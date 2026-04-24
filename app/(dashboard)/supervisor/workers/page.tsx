'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AddWorkerDialog } from '@/components/AddWorkerDialog'
import { Loader2, Trash2, KeyRound, Users } from 'lucide-react'
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
import { deleteWorkerWithCode, getWorkerDebt, toggleWorkerActive as toggleWorkerActiveAction } from '@/app/(dashboard)/supervisor/actions'
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

    const handleWorkerAdded = () => {
        // Invalidate meter list
        queryClient.invalidateQueries({ queryKey: ['workers', userProfile?.org_id] })
    }

    const confirmDelete = async (id: number) => {
        if (!userProfile?.org_id) return
        setFetchingDebt(true)
        try {
            const res = await getWorkerDebt(id, 'meter')
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
            const result = await deleteWorkerWithCode(workerToDelete, accessCode)
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
    const toggleWorkerActiveStatus = async (workerId: number, currentActive: boolean, table: 'workers' | 'fixed_workers') => {
        try {
            const result = await toggleWorkerActiveAction(workerId, currentActive, table)
            if (result.error) throw new Error(result.error)
            
            toast.success(t('workers.status_updated'))
            queryClient.invalidateQueries({ queryKey: [table === 'workers' ? 'workers' : 'fixed_workers', userProfile?.org_id] })
        } catch (error: any) {
            toast.error(error.message || t('workers.status_update_failed'))
        }
    }

    if (!userProfile) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>

    return (
        <div className="p-4 space-y-6 max-w-4xl mx-auto pb-32">
            <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center gap-4 bg-white/50 backdrop-blur-md p-4 rounded-3xl border border-white/20 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-foreground tracking-tight">{t('workers.manage_workers')}</h1>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">Personnel Directory</p>
                </div>
                <AddWorkerDialog
                    orgId={userProfile.org_id}
                    onWorkerAdded={handleWorkerAdded}
                />
            </div>

            {/* ── Meter Workers List ── */}
            <div className="mt-4">
                <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-lg font-semibold text-gray-700">{t('workers.meter_workers')}</h2>
                    {workers && workers.length > 0 && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                            {workers.length}
                        </span>
                    )}
                </div>

                {workersLoading ? (
                    <div className="flex flex-col items-center justify-center p-20 gap-3">
                        <Loader2 className="animate-spin text-primary h-8 w-8" />
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Syncing Personnel...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {workers?.map((worker: any) => (
                            <div key={worker.id} className="relative bg-card border border-border shadow-sm rounded-2xl overflow-hidden group hover:shadow-md transition-all duration-300">
                                <div className="p-4 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-inner",
                                            ROLE_COLORS[worker.role || 'master'] || 'bg-muted text-muted-foreground'
                                        )}>
                                            {worker.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-extrabold text-foreground tracking-tight">{tl(worker.name)}</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className={cn(
                                                    "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md",
                                                    ROLE_COLORS[worker.role || 'master'] || 'bg-muted text-muted-foreground'
                                                )}>
                                                    {worker.role || 'Worker'}
                                                </span>
                                                {worker.pf_esi_eligible && (
                                                    <span className="text-[9px] font-black bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded-md border border-teal-100 uppercase tracking-widest">
                                                        ESI/PF
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {/* Active Toggle */}
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={cn(
                                                "text-[9px] font-black uppercase tracking-tighter",
                                                worker.is_active ? "text-emerald-600" : "text-slate-400"
                                            )}>
                                                {worker.is_active ? t('workers.active') : t('workers.inactive')}
                                            </span>
                                            <Switch
                                                checked={worker.is_active}
                                                onCheckedChange={() => toggleWorkerActiveStatus(worker.id, worker.is_active, 'workers')}
                                                className="scale-90 data-[state=checked]:bg-emerald-500"
                                            />
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                                            onClick={() => confirmDelete(worker.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {workers?.length === 0 && (
                            <div className="col-span-full py-16 bg-muted/20 border-2 border-dashed border-border rounded-3xl flex flex-col items-center justify-center gap-2">
                                <Users className="h-10 w-10 text-muted-foreground/30" />
                                <p className="text-muted-foreground text-xs font-black uppercase tracking-widest">{t('workers.no_meter_workers')}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

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
