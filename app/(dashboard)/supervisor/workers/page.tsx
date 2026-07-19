'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
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
import { deleteWorker, deleteWorkerWithCode, getWorkerDebt, toggleWorkerActive as toggleWorkerActiveAction } from '@/app/(dashboard)/supervisor/actions'
import { formatINR } from '@/lib/finance'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useTranslation } from '@/lib/i18n/context'
import { useTransliterate } from '@/hooks/use-transliterate'
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog'

const ROLE_COLORS: Record<string, string> = {
    master: 'bg-saffron-soft text-saffron-deep',
    supervisor: 'bg-info-soft text-info',
    helper: 'bg-warning-soft text-warning',
    mender: 'bg-success-soft text-success',
    sanitation: 'bg-success-soft text-success',
    daily: 'bg-surface-soft text-body',
}

type SupervisorWorker = {
    id: number
    name: string
    role?: string | null
    is_active: boolean
    pf_esi_enrolled?: boolean | null
    pf_esi_eligible?: boolean | null
}

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback
}

export default function SupervisorWorkersPage() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    // Authorization State
    const [workerToDelete, setWorkerToDelete] = useState<number | null>(null)
    const [workerDebt, setWorkerDebt] = useState<number>(0)
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
    const [accessCode, setAccessCode] = useState('')
    const [deleting, setDeleting] = useState(false)

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
            return data as SupervisorWorker[]
        }
    })

    const handleWorkerAdded = () => {
        // Invalidate meter list
        queryClient.invalidateQueries({ queryKey: ['workers', userProfile?.org_id] })
    }

    const confirmDelete = async (id: number) => {
        if (!userProfile?.org_id) return
        try {
            const res = await getWorkerDebt(id, 'meter')
            setWorkerDebt(res.balance || 0)
            setWorkerToDelete(id)
            const [{ data: settlements, error: settlementsError }, { data: advances, error: advancesError }] = await Promise.all([
                supabase.from('payroll_settlements').select('id').eq('org_id', userProfile.org_id).eq('meter_worker_id', id).limit(1),
                supabase.from('worker_advances').select('id').eq('org_id', userProfile.org_id).eq('meter_worker_id', id).limit(1),
            ])
            if (settlementsError) throw settlementsError
            if (advancesError) throw advancesError
            const hasHistory = (settlements?.length ?? 0) > 0 || (advances?.length ?? 0) > 0
            if (hasHistory) {
                setAccessCode('')
            } else {
                setConfirmDeleteOpen(true)
            }
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to prepare worker deletion'))
        }
    }

    const executeDirectDelete = async () => {
        if (!workerToDelete || !userProfile?.org_id) return
        setDeleting(true)
        try {
            const result = await deleteWorker(workerToDelete)
            if (result.error) throw new Error(result.error)

            toast.success('Worker deleted successfully')
            setConfirmDeleteOpen(false)
            setWorkerToDelete(null)
            queryClient.invalidateQueries({ queryKey: ['workers'] })
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to delete worker'))
        } finally {
            setDeleting(false)
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
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to delete worker'))
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
        } catch (error) {
            toast.error(getErrorMessage(error, t('workers.status_update_failed')))
        }
    }

    if (!userProfile) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-saffron" /></div>

    return (
        <div className="mx-auto max-w-4xl space-y-6 pb-32">
            <div className="weavly-canvas flex flex-col items-start justify-between gap-4 rounded-xl p-4 xs:flex-row xs:items-center">
                <div>
                    <h1 className="text-2xl font-semibold tracking-normal text-ink">Worker Directory</h1>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">Piece-Rate Workers, Upaad (Worker Advance), and Worker Hisaab records</p>
                </div>
                <AddWorkerDialog
                    orgId={userProfile.org_id}
                    onWorkerAdded={handleWorkerAdded}
                />
            </div>

            {/* ── Meter Workers List ── */}
            <div className="mt-4">
                <div className="mb-4 flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-ink">{t('workers.meter_workers')}</h2>
                    {workers && workers.length > 0 && (
                        <span className="rounded-full bg-surface-soft px-2 py-0.5 text-xs font-medium text-body">
                            {workers.length}
                        </span>
                    )}
                </div>

                {workersLoading ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-hairline bg-surface/70 p-20">
                        <Loader2 className="h-8 w-8 animate-spin text-saffron" />
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Syncing workers...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {workers?.map((worker) => (
                            <div key={worker.id} className="group relative overflow-hidden rounded-xl border border-hairline bg-surface shadow-[var(--shadow-card)] transition-all duration-200 hover:border-hairline-strong">
                                <div className="p-4 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "flex h-10 w-10 items-center justify-center rounded-lg text-sm font-semibold shadow-inner",
                                            ROLE_COLORS[worker.role || 'master'] || 'bg-muted text-muted-foreground'
                                        )}>
                                            {worker.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-semibold tracking-normal text-ink">{tl(worker.name)}</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className={cn(
                                                    "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                                                    ROLE_COLORS[worker.role || 'master'] || 'bg-muted text-muted-foreground'
                                                )}>
                                                    {worker.role || 'Worker'}
                                                </span>
                                                {(worker.pf_esi_enrolled ?? worker.pf_esi_eligible) && (
                                                    <span className="rounded-md border border-success-soft bg-success-soft px-1.5 py-0.5 text-[10px] font-semibold text-success">
                                                        {t('worker.pfEsi.enrolled')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {/* Active Toggle */}
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={cn(
                                                "text-[10px] font-semibold",
                                                worker.is_active ? "text-success" : "text-muted-foreground"
                                            )}>
                                                {worker.is_active ? t('workers.active') : t('workers.inactive')}
                                            </span>
                                            <Switch
                                                checked={worker.is_active}
                                                onCheckedChange={() => toggleWorkerActiveStatus(worker.id, worker.is_active, 'workers')}
                                                className="scale-90 data-[state=checked]:bg-success"
                                            />
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 rounded-lg text-risk/70 hover:bg-risk-soft hover:text-risk"
                                            onClick={() => confirmDelete(worker.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {workers?.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-hairline bg-surface/70 py-16 text-center">
                                <Users className="h-10 w-10 text-muted-foreground/30" />
                                <p className="text-sm font-semibold text-ink">No piece-rate workers yet.</p>
                                <p className="max-w-sm text-xs text-muted-foreground">Add workers to connect metres produced this shift, Upaad, and Worker Hisaab records.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Access Code Modal (SEC-004) */}
            <Dialog open={workerToDelete !== null && !confirmDeleteOpen} onOpenChange={(open) => !open && setWorkerToDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-risk">
                            <KeyRound className="h-5 w-5" /> {t('workers.auth_req')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('workers.delete_desc')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {workerDebt > 0 && (
                            <div className="flex items-start gap-3 rounded-lg border border-warning-soft bg-warning-soft p-3">
                                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                                <div>
                                    <p className="text-sm font-semibold text-warning">{t('workers.outstanding_adv')}</p>
                                    <p className="mt-0.5 text-xs text-warning">
                                        {t('workers.balance_warning')} <strong>{formatINR(workerDebt)}</strong>{t('workers.settle_warning')}
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
            <ConfirmActionDialog
                open={confirmDeleteOpen}
                onOpenChange={setConfirmDeleteOpen}
                title="Delete worker"
                description="This worker has no production history, so no access code is required."
                confirmLabel={t('common.remove')}
                onConfirm={executeDirectDelete}
                isDestructive
                isLoading={deleting}
            />
        </div>
    )
}
