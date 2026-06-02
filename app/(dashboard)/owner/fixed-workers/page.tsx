'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Pencil, Trash2, Users, Briefcase, KeyRound, AlertCircle, Loader2, Gauge, MessageCircle, ShieldCheck } from 'lucide-react'
import { getWorkerDebt } from '@/app/(dashboard)/supervisor/actions'
import { deleteFixedWorker, deleteFixedWorkerWithCode, upsertFixedWorker, updateMeterWorker, deleteMeterWorker, deleteMeterWorkerWithCode, writeOffWorkerAdvanceBalance, setWorkerActiveStatus } from '@/app/(dashboard)/owner/actions'
import { cn } from '@/lib/utils'
import { useUserProfile } from '@/hooks/use-user-profile'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/i18n/context'
import { useTransliterate } from '@/hooks/use-transliterate'
import { Amount } from '@/components/ui/amount'
import { AddWorkerDialog } from '@/components/AddWorkerDialog'
import { WorkerExitDialog } from '@/components/advances/WorkerExitDialog'
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog'

const ROLES = [
    { value: 'master', defaultSalary: 30000 },
    { value: 'supervisor', defaultSalary: 30000 },
    { value: 'helper', defaultSalary: 15000 },
    { value: 'mender', defaultSalary: 15000 },
    { value: 'sanitation', defaultSalary: 7000 },
    { value: 'daily', defaultSalary: 15000 },
]

interface FixedWorker {
    id: number
    name: string
    role: string
    monthly_salary: number
    is_active: boolean
    start_date?: string   // 'YYYY-MM-DD'
    pf_esi_enrolled?: boolean
    pf_esi_eligible?: boolean
    esi_number?: string
    pf_number?: string
    whatsapp_number?: string
    whatsapp_language?: string
}

interface MeterWorker {
    id: number
    name: string
    is_active: boolean
    pf_esi_enrolled?: boolean
    pf_esi_eligible?: boolean
    whatsapp_number?: string | null
    whatsapp_language?: string | null
    esi_number?: string | null
    pf_number?: string | null
}

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback
}

async function hasMeterWorkerHistory(supabase: ReturnType<typeof createClient>, orgId: string, workerId: number) {
    const [{ data: settlements, error: settlementsError }, { data: advances, error: advancesError }] = await Promise.all([
        supabase.from('payroll_settlements').select('id').eq('org_id', orgId).eq('meter_worker_id', workerId).limit(1),
        supabase.from('worker_advances').select('id').eq('org_id', orgId).eq('meter_worker_id', workerId).limit(1),
    ])

    if (settlementsError) throw settlementsError
    if (advancesError) throw advancesError

    return (settlements?.length ?? 0) > 0 || (advances?.length ?? 0) > 0
}

async function hasFixedWorkerHistory(supabase: ReturnType<typeof createClient>, orgId: string, workerId: number) {
    const [
        { data: settlements, error: settlementsError },
        { data: advances, error: advancesError },
        { data: attendance, error: attendanceError },
    ] = await Promise.all([
        supabase.from('payroll_settlements').select('id').eq('org_id', orgId).eq('fixed_worker_id', workerId).limit(1),
        supabase.from('worker_advances').select('id').eq('org_id', orgId).eq('fixed_worker_id', workerId).limit(1),
        supabase.from('attendance').select('fixed_worker_id').eq('org_id', orgId).eq('fixed_worker_id', workerId).limit(1),
    ])

    if (settlementsError) throw settlementsError
    if (advancesError) throw advancesError
    if (attendanceError) throw attendanceError

    return (settlements?.length ?? 0) > 0 || (advances?.length ?? 0) > 0 || (attendance?.length ?? 0) > 0
}

function getRoleColor(role: string) {
    const colors: Record<string, string> = {
        master: 'bg-purple-100 text-purple-800',
        supervisor: 'bg-blue-100 text-blue-800',
        helper: 'bg-amber-100 text-amber-800',
        mender: 'bg-teal-100 text-teal-800',
        sanitation: 'bg-green-100 text-green-800',
        daily: 'bg-orange-100 text-orange-800',
    }
    return colors[role] || 'bg-gray-100 text-gray-800'
}

function formatOutstandingAdvanceLabel(template: string, amount: number) {
    return template.replace('{amount}', new Intl.NumberFormat('en-IN').format(amount))
}

// ─── Edit Meter Worker Dialog ─────────────────────────────────────────────────

function EditMeterWorkerDialog({
    worker,
    onClose,
}: {
    worker: MeterWorker
    onClose: () => void
}) {
    const queryClient = useQueryClient()
    const [name, setName] = useState(worker.name)
    const [phone, setPhone] = useState(worker.whatsapp_number || '')
    const [lang, setLang] = useState<'en' | 'hi' | 'gu'>(
        (worker.whatsapp_language as 'en' | 'hi' | 'gu') || 'en'
    )
    const [consent, setConsent] = useState(false)
    const [pfEsiEnrolled, setPfEsiEnrolled] = useState(worker.pf_esi_enrolled ?? worker.pf_esi_eligible ?? false)
    const [esiNumber, setEsiNumber] = useState(worker.esi_number || '')
    const [pfNumber, setPfNumber] = useState(worker.pf_number || '')
    const { t } = useTranslation()

    const mutation = useMutation({
        mutationFn: () =>
            updateMeterWorker({
                id: worker.id,
                name,
                phone: phone || undefined,
                language: lang,
                consentGiven: phone.length === 10 ? consent : true,
                pf_esi_enrolled: pfEsiEnrolled,
                esi_number: esiNumber,
                pf_number: pfNumber,
            }),
        onSuccess: (result) => {
            if ('error' in result && result.error) {
                toast.error(result.error)
                return
            }
            toast.success('Worker updated')
            queryClient.invalidateQueries({ queryKey: ['meter_workers'] })
            queryClient.invalidateQueries({ queryKey: ['workers'] })
            onClose()
        },
        onError: (err) => toast.error(getErrorMessage(err, 'Failed to update worker')),
    })

    const canSave =
        name.trim().length > 0 &&
        (phone.length === 0 || (phone.length === 10 && consent))

    return (
        <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
                <DialogTitle>Edit Piece Rate Worker</DialogTitle>
                <DialogDescription>Update name or WhatsApp number</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                    <Label htmlFor="mw-name">Worker Name <span className="text-red-500">*</span></Label>
                    <Input
                        id="mw-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Worker name"
                        autoFocus
                    />
                </div>

                <div className="border-t border-gray-100 pt-3 space-y-2">
                    <p className="text-xs font-medium text-gray-700">
                        WhatsApp Number <span className="text-gray-400 font-normal">(optional)</span>
                    </p>
                    <p className="text-xs text-gray-400">Used for payroll messages and advance receipts</p>
                    <div className="flex gap-2">
                        <div className="flex items-center px-2.5 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-600 font-medium whitespace-nowrap">
                            +91
                        </div>
                        <Input
                            type="tel"
                            inputMode="numeric"
                            placeholder="9898989898"
                            value={phone}
                            onChange={(e) => {
                                setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                                if (e.target.value.length === 0) setConsent(false)
                            }}
                            maxLength={10}
                            className="font-mono"
                        />
                        <select
                            value={lang}
                            onChange={(e) => setLang(e.target.value as 'en' | 'hi' | 'gu')}
                            className="border border-gray-200 rounded-md text-xs px-2 bg-white text-gray-700"
                        >
                            <option value="en">English</option>
                            <option value="hi">हिंदी</option>
                            <option value="gu">ગુજરાતી</option>
                        </select>
                    </div>

                    {phone.length === 10 && (
                        <div className="flex items-start gap-2">
                            <input
                                type="checkbox"
                                id="mw-consent"
                                checked={consent}
                                onChange={(e) => setConsent(e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 cursor-pointer"
                            />
                            <label htmlFor="mw-consent" className="text-xs text-gray-500 leading-snug cursor-pointer">
                                I confirm this worker has consented to receive WhatsApp payroll messages on this number
                            </label>
                        </div>
                    )}
                </div>

                <div className="border-t border-gray-100 pt-3 space-y-3">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id={`meter-pf-${worker.id}`}
                            checked={pfEsiEnrolled}
                            onChange={(e) => setPfEsiEnrolled(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-teal-600 cursor-pointer"
                        />
                        <Label htmlFor={`meter-pf-${worker.id}`}>{t('worker.pfEsi.label')}</Label>
                    </div>
                    <p className="text-xs text-gray-500">{t('worker.pfEsi.helper')}</p>
                    {pfEsiEnrolled && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">{t('worker.pfEsi.esiNumber')}</Label>
                                <Input value={esiNumber} onChange={(e) => setEsiNumber(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">{t('worker.pfEsi.pfNumber')}</Label>
                                <Input value={pfNumber} onChange={(e) => setPfNumber(e.target.value)} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <DialogFooter>
                <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
                    Cancel
                </Button>
                <Button onClick={() => mutation.mutate()} disabled={!canSave || mutation.isPending}>
                    {mutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Save Changes'}
                </Button>
            </DialogFooter>
        </DialogContent>
    )
}

// ─── Piece Rate Workers Tab ───────────────────────────────────────────────────

function PieceRateTab({ orgId }: { orgId: string }) {
    const { t } = useTranslation()
    const tl = useTransliterate()
    const router = useRouter()
    const supabase = createClient()
    const queryClient = useQueryClient()

    const [editWorker, setEditWorker] = useState<MeterWorker | null>(null)
    const [workerToDelete, setWorkerToDelete] = useState<MeterWorker | null>(null)
    const [exitWorker, setExitWorker] = useState<MeterWorker | null>(null)
    const [workerDebt, setWorkerDebt] = useState<number>(0)
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
    const [accessCode, setAccessCode] = useState('')
    const [erasePII, setErasePII] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [fetchingDebt, setFetchingDebt] = useState(false)
    const [verificationOpen, setVerificationOpen] = useState(false)
    const [writingOff, setWritingOff] = useState(false)

    const { data: outstandingAdvances } = useQuery({
        queryKey: ['worker_exit_advances_meter', orgId],
        enabled: !!orgId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('worker_advances')
                .select('meter_worker_id, amount')
                .eq('org_id', orgId)
                .eq('status', 'pending')
                .is('writeoff_at', null)
                .not('meter_worker_id', 'is', null)
            if (error) throw error

            return (data || []).reduce((map: Record<number, number>, row: { meter_worker_id: number | null; amount: number | string }) => {
                const workerId = Number(row.meter_worker_id)
                map[workerId] = (map[workerId] || 0) + Number(row.amount)
                return map
            }, {} as Record<number, number>)
        },
    })

    const { data: meterWorkers, isLoading } = useQuery({
        queryKey: ['meter_workers', orgId],
        enabled: !!orgId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('workers')
                .select('id, name, is_active, pf_esi_enrolled, pf_esi_eligible, whatsapp_number, whatsapp_language, esi_number, pf_number')
                .eq('org_id', orgId)
                .order('name')
            if (error) throw error
            return data as MeterWorker[]
        },
    })

    const handleDelete = async (worker: MeterWorker) => {
        setFetchingDebt(true)
        try {
            const res = await getWorkerDebt(worker.id, 'meter')
            setWorkerDebt(res.balance || 0)
            if ((res.balance || 0) > 0) {
                setExitWorker(worker)
                return
            }
            const hasHistory = await hasMeterWorkerHistory(supabase, orgId, worker.id)
            setWorkerToDelete(worker)
            if (hasHistory) {
                setAccessCode('')
                setVerificationOpen(true)
            } else {
                setConfirmDeleteOpen(true)
            }
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to prepare worker deletion'))
        } finally {
            setFetchingDebt(false)
        }
    }

    const executeDirectDelete = async () => {
        if (!workerToDelete) return
        setDeleting(true)
        try {
            const result = await deleteMeterWorker(workerToDelete.id)
            if (!('success' in result) || !result.success) {
                toast.error(result.error || 'Failed to delete worker')
                return
            }
            toast.success(t('common.removed'))
            setConfirmDeleteOpen(false)
            setWorkerToDelete(null)
            queryClient.invalidateQueries({ queryKey: ['meter_workers'] })
            queryClient.invalidateQueries({ queryKey: ['workers'] })
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to delete worker'))
        } finally {
            setDeleting(false)
        }
    }

    const handleWriteOff = async () => {
        if (!exitWorker) return
        setWritingOff(true)
        try {
            const writeOffResult = await writeOffWorkerAdvanceBalance('meter', exitWorker.id)
            if (writeOffResult.error) {
                toast.error(writeOffResult.error)
                return
            }

            const deactivateResult = await setWorkerActiveStatus('meter', exitWorker.id, false)
            if (deactivateResult.error) {
                toast.error(deactivateResult.error)
                return
            }

            toast.success(t('common.updated'))
            setExitWorker(null)
            setWorkerDebt(0)
            queryClient.invalidateQueries({ queryKey: ['worker_exit_advances_meter'] })
            queryClient.invalidateQueries({ queryKey: ['meter_workers'] })
            queryClient.invalidateQueries({ queryKey: ['workers'] })
        } finally {
            setWritingOff(false)
        }
    }

    const executeDelete = async () => {
        if (!workerToDelete) return
        setDeleting(true)
        try {
            const result = await deleteMeterWorkerWithCode(workerToDelete.id, accessCode, erasePII)
            if (!('success' in result) || !result.success) {
                toast.error(result.error || t('auth.invalid_code'))
                return
            }
            toast.success(t('common.removed'))
            setVerificationOpen(false)
            setWorkerToDelete(null)
            queryClient.invalidateQueries({ queryKey: ['meter_workers'] })
            queryClient.invalidateQueries({ queryKey: ['workers'] })
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to delete worker'))
        } finally {
            setDeleting(false)
        }
    }

    const activeCount = (meterWorkers || []).filter((w) => w.is_active).length

    return (
        <div className="space-y-4">
            {/* Summary */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                        Piece Rate Workers
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-orange-600">{activeCount}</div>
                    <p className="text-xs text-muted-foreground mt-1">active piece rate workers</p>
                </CardContent>
            </Card>

            {/* Add button */}
            <div className="flex justify-end">
                <AddWorkerDialog orgId={orgId} onWorkerAdded={() => queryClient.invalidateQueries({ queryKey: ['meter_workers'] })} />
            </div>

            {/* List */}
            {isLoading ? (
                <Card>
                    <CardContent className="pt-4 space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex justify-between items-center py-2">
                                <Skeleton className="h-5 w-32" />
                                <div className="flex gap-2">
                                    <Skeleton className="h-8 w-8 rounded-md" />
                                    <Skeleton className="h-8 w-8 rounded-md" />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            ) : (meterWorkers || []).length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Gauge className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                        <p className="font-medium text-gray-500">No piece rate workers yet</p>
                        <p className="text-sm text-gray-400 mt-1">Add workers who are paid per meter woven</p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="pt-0">
                        <div className="divide-y">
                            {(meterWorkers || []).map((w) => (
                                <div key={w.id} className="flex justify-between items-center py-3 gap-4">
                                <div className="min-w-0 flex-1">
                                    <span className={cn('font-medium break-words block', !w.is_active && 'text-gray-400 line-through')}>
                                        {tl(w.name)}
                                    </span>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            <span className="text-xs text-orange-600 font-medium">Per metre</span>
                                            {(w.pf_esi_enrolled ?? w.pf_esi_eligible) && (
                                                <span className="text-[10px] font-semibold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">
                                                    {t('worker.pfEsi.enrolled')}
                                                </span>
                                            )}
                                            {w.whatsapp_number && (
                                                <span className="flex items-center gap-1 text-[10px] font-semibold bg-green-50 text-green-700 px-1.5 py-0.5 rounded">
                                                    <MessageCircle className="h-2.5 w-2.5" />
                                                    WA ✓
                                                </span>
                                            )}
                                            {!!outstandingAdvances?.[w.id] && (
                                                <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                                    {formatOutstandingAdvanceLabel(t('advances.badge.outstanding'), outstandingAdvances[w.id])}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Dialog open={editWorker?.id === w.id} onOpenChange={(open) => { if (!open) setEditWorker(null) }}>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="sm" onClick={() => setEditWorker(w)}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                            </DialogTrigger>
                                            {editWorker?.id === w.id && (
                                                <EditMeterWorkerDialog worker={editWorker} onClose={() => setEditWorker(null)} />
                                            )}
                                        </Dialog>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-700"
                                            onClick={() => handleDelete(w)}
                                            disabled={fetchingDebt}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Delete verification modal */}
            <Dialog open={verificationOpen} onOpenChange={setVerificationOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <KeyRound className="h-5 w-5" /> {t('fixed_page.auth_title')}
                        </DialogTitle>
                        <DialogDescription>{t('fixed_page.auth_desc')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {workerDebt > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-amber-900">{t('fixed_page.outstanding')}</p>
                                    <p className="text-xs text-amber-700 mt-0.5">
                                        {t('fixed_page.balance')} <strong className="text-amber-900"><Amount value={workerDebt} /></strong>{t('fixed_page.settle')}
                                    </p>
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>{t('fixed_page.access_code')}</Label>
                            <Input
                                placeholder={t('fixed_page.code_ph')}
                                value={accessCode}
                                onChange={(e) => setAccessCode(e.target.value)}
                                className="font-mono uppercase tracking-widest text-lg"
                                maxLength={6}
                            />
                        </div>

                        {/* DPDP 2026 Erasure Option */}
                        <div className="pt-2 border-t border-gray-100 flex items-start gap-3 px-1">
                            <input
                                type="checkbox"
                                id={`erase-pii-${workerToDelete?.id}`}
                                checked={erasePII}
                                onChange={(e) => setErasePII(e.target.checked)}
                                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <div className="space-y-1 cursor-pointer" onClick={() => setErasePII(!erasePII)}>
                                <Label className="text-xs font-bold text-gray-700 cursor-pointer flex items-center gap-1.5">
                                    <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                                    DPDP Right to Erasure
                                </Label>
                                <p className="text-[10px] text-gray-500 leading-snug">
                                    Anonymize worker data instead of hard deleting. 
                                    Preserves audit trail for compliance.
                                </p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setVerificationOpen(false)}>{t('fixed_page.cancel')}</Button>
                        <Button
                            variant="destructive"
                            disabled={accessCode.length < 6 || deleting}
                            onClick={executeDelete}
                        >
                            {deleting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                            {t('fixed_page.verify_delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ConfirmActionDialog
                open={confirmDeleteOpen}
                onOpenChange={setConfirmDeleteOpen}
                title="Delete worker"
                description={workerToDelete ? `Delete ${workerToDelete.name}? This worker has no production history, so no access code is required.` : ''}
                confirmLabel={t('common.remove')}
                onConfirm={executeDirectDelete}
                isDestructive
                isLoading={deleting}
            />

            <WorkerExitDialog
                open={!!exitWorker}
                onOpenChange={(open) => {
                    if (!open) {
                        setExitWorker(null)
                        setWorkerDebt(0)
                    }
                }}
                workerName={exitWorker?.name || ''}
                amount={workerDebt}
                onFinalSettle={() => {
                    if (!exitWorker) return
                    setExitWorker(null)
                    setWorkerDebt(0)
                    router.push(`/owner/payroll?exitWorkerType=meter&exitWorkerId=${exitWorker.id}&finalSettlement=1&deactivateAfterExit=1`)
                }}
                onWriteOff={handleWriteOff}
                onKeepActive={() => {
                    setExitWorker(null)
                    setWorkerDebt(0)
                }}
                isWriteOffLoading={writingOff}
            />
        </div>
    )
}

// ─── Fixed Workers Tab ────────────────────────────────────────────────────────

function FixedWorkersTab({ orgId }: { orgId: string }) {
    const { t } = useTranslation()
    const tl = useTransliterate()
    const router = useRouter()
    const supabase = createClient()
    const queryClient = useQueryClient()

    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingWorker, setEditingWorker] = useState<FixedWorker | null>(null)
    const [formName, setFormName] = useState('')
    const [formRole, setFormRole] = useState('')
    const [formSalary, setFormSalary] = useState('')
    const [formStartDate, setFormStartDate] = useState(new Date().toISOString().substring(0, 10))
    const [formPfEsiEnrolled, setFormPfEsiEnrolled] = useState(false)
    const [formEsiNumber, setFormEsiNumber] = useState('')
    const [formPfNumber, setFormPfNumber] = useState('')
    const [saving, setSaving] = useState(false)
    const [formPhone, setFormPhone] = useState('')
    const [formLang, setFormLang] = useState<'en' | 'hi' | 'gu'>('en')
    const [formConsent, setFormConsent] = useState(false)

    const [workerToDelete, setWorkerToDelete] = useState<FixedWorker | null>(null)
    const [exitWorker, setExitWorker] = useState<FixedWorker | null>(null)
    const [workerDebt, setWorkerDebt] = useState<number>(0)
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
    const [accessCode, setAccessCode] = useState('')
    const [erasePII, setErasePII] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [verificationOpen, setVerificationOpen] = useState(false)
    const [writingOff, setWritingOff] = useState(false)

    const { data: outstandingAdvances } = useQuery({
        queryKey: ['worker_exit_advances_fixed', orgId],
        enabled: !!orgId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('worker_advances')
                .select('fixed_worker_id, amount')
                .eq('org_id', orgId)
                .eq('status', 'pending')
                .is('writeoff_at', null)
                .not('fixed_worker_id', 'is', null)
            if (error) throw error

            return (data || []).reduce((map: Record<number, number>, row: { fixed_worker_id: number | null; amount: number | string }) => {
                const workerId = Number(row.fixed_worker_id)
                map[workerId] = (map[workerId] || 0) + Number(row.amount)
                return map
            }, {} as Record<number, number>)
        },
    })

    const { data: fixedWorkers, isLoading } = useQuery({
        queryKey: ['fixed_workers', orgId],
        enabled: !!orgId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('fixed_workers')
                .select('*')
                .eq('org_id', orgId)
                .order('role')
                .order('name')
            if (error) throw error
            return data as FixedWorker[]
        },
    })

    const openAddDialog = () => {
        setEditingWorker(null)
        setFormName('')
        setFormRole('')
        setFormSalary('')
        setFormStartDate(new Date().toISOString().substring(0, 10))
        setFormPfEsiEnrolled(false)
        setFormEsiNumber('')
        setFormPfNumber('')
        setFormPhone('')
        setFormLang('en')
        setFormConsent(false)
        setDialogOpen(true)
    }

    const openEditDialog = async (worker: FixedWorker) => {
        setEditingWorker(worker)
        setFormName(worker.name)
        setFormRole(worker.role)
        setFormSalary(worker.monthly_salary.toString())
        setFormStartDate(worker.start_date || new Date().toISOString().substring(0, 10))
        setFormPfEsiEnrolled(worker.pf_esi_enrolled ?? worker.pf_esi_eligible ?? false)
        setFormEsiNumber(worker.esi_number || '')
        setFormPfNumber(worker.pf_number || '')
        setFormPhone(worker.whatsapp_number || '')
        setFormLang((worker.whatsapp_language as 'en' | 'hi' | 'gu') || 'en')
        
        const { data: consent } = await supabase
            .from('notification_consents')
            .select('consent_status')
            .eq('org_id', orgId)
            .eq('person_type', 'worker')
            .eq('person_id', String(worker.id))
            .eq('channel', 'whatsapp')
            .maybeSingle();
        
        setFormConsent(consent?.consent_status === 'opted_in');
        setDialogOpen(true)
    }

    const handleRoleChange = (role: string) => {
        setFormRole(role)
        if (!editingWorker) {
            const defaultSalary = ROLES.find((r) => r.value === role)?.defaultSalary
            if (defaultSalary) setFormSalary(defaultSalary.toString())
        }
    }

    const handleSave = async () => {
        if (!formName.trim() || !formRole || !formSalary) {
            toast.error(t('common.fill_all'))
            return
        }
        setSaving(true)
        try {
            const result = await upsertFixedWorker({
                id: editingWorker?.id,
                name: formName.trim(),
                role: formRole,
                monthly_salary: parseFloat(formSalary),
                start_date: formStartDate,
                pf_esi_enrolled: formPfEsiEnrolled,
                esi_number: formEsiNumber,
                pf_number: formPfNumber,
                phone: formPhone || undefined,
                language: formLang,
                consentGiven: formConsent,
            })
            if (result.error) throw new Error(result.error)
            toast.success(editingWorker ? t('common.updated') : t('common.added'))
            setDialogOpen(false)
            queryClient.invalidateQueries({ queryKey: ['fixed_workers'] })
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to save worker'))
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (worker: FixedWorker) => {
        try {
            const res = await getWorkerDebt(worker.id, 'fixed')
            setWorkerDebt(res.balance || 0)
            if ((res.balance || 0) > 0) {
                setExitWorker(worker)
                return
            }
            const hasHistory = await hasFixedWorkerHistory(supabase, orgId, worker.id)
            setWorkerToDelete(worker)
            if (hasHistory) {
                setAccessCode('')
                setVerificationOpen(true)
            } else {
                setConfirmDeleteOpen(true)
            }
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to prepare worker deletion'))
        }
    }

    const executeDirectDelete = async () => {
        if (!workerToDelete) return
        setDeleting(true)
        try {
            const result = await deleteFixedWorker(workerToDelete.id)
            if (!('success' in result) || !result.success) {
                toast.error(result.error || 'Failed to delete worker')
                return
            }
            toast.success(t('common.removed'))
            setConfirmDeleteOpen(false)
            setWorkerToDelete(null)
            queryClient.invalidateQueries({ queryKey: ['fixed_workers'] })
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to delete worker'))
        } finally {
            setDeleting(false)
        }
    }

    const handleWriteOff = async () => {
        if (!exitWorker) return
        setWritingOff(true)
        try {
            const writeOffResult = await writeOffWorkerAdvanceBalance('fixed', exitWorker.id)
            if (writeOffResult.error) {
                toast.error(writeOffResult.error)
                return
            }

            const deactivateResult = await setWorkerActiveStatus('fixed', exitWorker.id, false)
            if (deactivateResult.error) {
                toast.error(deactivateResult.error)
                return
            }

            toast.success(t('common.updated'))
            setExitWorker(null)
            setWorkerDebt(0)
            queryClient.invalidateQueries({ queryKey: ['worker_exit_advances_fixed'] })
            queryClient.invalidateQueries({ queryKey: ['fixed_workers'] })
        } finally {
            setWritingOff(false)
        }
    }

    const executeDelete = async () => {
        if (!workerToDelete) return
        setDeleting(true)
        try {
            const result = await deleteFixedWorkerWithCode(workerToDelete.id, accessCode, erasePII)
            if (!('success' in result) || !result.success) {
                toast.error(result.error || t('auth.invalid_code'))
                return
            }
            toast.success(t('common.removed'))
            setVerificationOpen(false)
            setWorkerToDelete(null)
            queryClient.invalidateQueries({ queryKey: ['fixed_workers'] })
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to delete worker'))
        } finally {
            setDeleting(false)
        }
    }

    const grouped = (fixedWorkers || []).reduce((acc, w) => {
        if (!acc[w.role]) acc[w.role] = []
        acc[w.role].push(w)
        return acc
    }, {} as Record<string, FixedWorker[]>)

    const totalMonthly = (fixedWorkers || [])
        .filter((w) => w.is_active)
        .reduce((sum, w) => sum + Number(w.monthly_salary), 0)

    return (
        <div className="space-y-4">
            {/* Summary Card */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                        {t('fixed_page.monthly_payroll')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-700">
                        <Amount value={totalMonthly} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {(fixedWorkers || []).filter((w) => w.is_active).length} {t('fixed_page.active_count')}
                    </p>
                </CardContent>
            </Card>

            {/* Add button */}
            <div className="flex justify-end">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openAddDialog}>
                            {t('fixed_page.add_worker')}
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingWorker ? t('fixed_page.edit_worker') : t('fixed_page.add_title')}</DialogTitle>
                            <DialogDescription>Add or update a fixed salary staff member.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <Label>{t('fixed_page.name')}</Label>
                                <Input
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder={t('fixed_page.name_ph')}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('fixed_page.role')}</Label>
                                <Select value={formRole} onValueChange={handleRoleChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('fixed_page.select_role')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ROLES.map((r) => (
                                            <SelectItem key={r.value} value={r.value}>
                                                {t(`workers.roles.${r.value}`)} — <Amount value={r.defaultSalary} />{t('common.per_month')}
                                            </SelectItem>
                                        ))}
                                        {editingWorker && !ROLES.find((r) => r.value === editingWorker.role) && (
                                            <SelectItem value={editingWorker.role}>
                                                {editingWorker.role} ({t('fixed_page.custom')})
                                            </SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('fixed_page.monthly_salary')}</Label>
                                <Input
                                    type="number"
                                    value={formSalary}
                                    onChange={(e) => setFormSalary(e.target.value)}
                                    placeholder="30000"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1">
                                    Start Date
                                    <span className="text-[10px] text-gray-400 font-normal ml-1">Used to hide worker from past payroll months</span>
                                </Label>
                                <Input
                                    type="date"
                                    value={formStartDate}
                                    onChange={(e) => setFormStartDate(e.target.value)}
                                    max={new Date().toISOString().substring(0, 10)}
                                />
                            </div>

                            <div className="border-t border-gray-100 pt-3 space-y-2">
                                <p className="text-xs font-medium text-gray-700">
                                    WhatsApp Number <span className="text-gray-400 font-normal">(optional)</span>
                                </p>
                                <p className="text-xs text-gray-400">Send payslips, advance receipts, and operational updates on WhatsApp.</p>
                                <div className="flex gap-2">
                                    <div className="flex items-center px-2.5 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-600 font-medium whitespace-nowrap">
                                        +91
                                    </div>
                                    <Input
                                        type="tel"
                                        inputMode="numeric"
                                        placeholder="9898989898"
                                        value={formPhone}
                                        onChange={(e) => {
                                            setFormPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                                            if (e.target.value.length === 0) setFormConsent(false)
                                        }}
                                        maxLength={10}
                                        className="font-mono"
                                    />
                                    <select
                                        value={formLang}
                                        onChange={(e) => setFormLang(e.target.value as 'en' | 'hi' | 'gu')}
                                        className="border border-gray-200 rounded-md text-xs px-2 bg-white text-gray-700"
                                    >
                                        <option value="en">English</option>
                                        <option value="hi">हिंदी</option>
                                        <option value="gu">ગુજરાતી</option>
                                    </select>
                                </div>

                                {formPhone.length === 10 && (
                                    <div className="flex items-start gap-2">
                                        <input
                                            type="checkbox"
                                            id="fixed-consent"
                                            checked={formConsent}
                                            onChange={(e) => setFormConsent(e.target.checked)}
                                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 cursor-pointer"
                                        />
                                        <label htmlFor="fixed-consent" className="text-xs text-gray-500 leading-snug cursor-pointer">
                                            I confirm this worker has consented to receive WhatsApp payroll messages on this number
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3 border-t border-gray-100 pt-3">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="fixed-pf-esi-enrolled"
                                        checked={formPfEsiEnrolled}
                                        onChange={(e) => setFormPfEsiEnrolled(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-teal-600 cursor-pointer"
                                    />
                                    <Label htmlFor="fixed-pf-esi-enrolled">{t('worker.pfEsi.label')}</Label>
                                </div>
                                <p className="text-xs text-gray-500">{t('worker.pfEsi.helper')}</p>
                                {formPfEsiEnrolled && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label className="text-xs">{t('worker.pfEsi.esiNumber')}</Label>
                                            <Input value={formEsiNumber} onChange={(e) => setFormEsiNumber(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs">{t('worker.pfEsi.pfNumber')}</Label>
                                            <Input value={formPfNumber} onChange={(e) => setFormPfNumber(e.target.value)} />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <Button onClick={handleSave} disabled={saving} className="w-full">
                                {saving ? t('fixed_page.saving') : editingWorker ? t('fixed_page.update') : t('fixed_page.add_worker')}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Workers list */}
            {isLoading ? (
                <div className="space-y-4">
                    {[1, 2].map((i) => (
                        <Card key={i}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-4 rounded-full" />
                                    <Skeleton className="h-5 w-32" />
                                    <Skeleton className="h-4 w-8 rounded-full" />
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="divide-y">
                                    {[1, 2].map((j) => (
                                        <div key={j} className="flex justify-between items-center py-3">
                                            <Skeleton className="h-5 w-24" />
                                            <div className="flex items-center gap-3">
                                                <Skeleton className="h-5 w-20" />
                                                <Skeleton className="h-8 w-8 rounded-md" />
                                                <Skeleton className="h-8 w-8 rounded-md" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : Object.keys(grouped).length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Users className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                        <p className="font-medium text-gray-500">{t('fixed_page.no_workers')}</p>
                        <p className="text-sm text-gray-400 mt-1">{t('fixed_page.add_desc')}</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {ROLES.map((roleInfo) => {
                        const workers = grouped[roleInfo.value]
                        if (!workers || workers.length === 0) return null
                        return (
                            <Card key={roleInfo.value}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-2">
                                        <Briefcase className="h-4 w-4 text-gray-500" />
                                        <CardTitle className="text-base">{t(`workers.roles.${roleInfo.value}`)}</CardTitle>
                                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getRoleColor(roleInfo.value))}>
                                            {workers.length}
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="divide-y">
                                        {workers.map((w) => (
                                            <div key={w.id} className="flex justify-between items-center py-3 gap-4">
                                                <div className="min-w-0 flex-1">
                                                    <span className={cn('font-medium break-words block', !w.is_active && 'text-gray-400 line-through')}>
                                                        {tl(w.name)}
                                                    </span>
                                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                        {roleInfo.value === 'daily' && (
                                                            <span className="text-xs text-orange-600 font-medium">{t('fixed_page.attendance_based')}</span>
                                                        )}
                                                        {w.start_date && (
                                                            <span className="text-[10px] text-gray-400">
                                                                Since {new Date(w.start_date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                                                            </span>
                                                        )}
                                                        {(w.pf_esi_enrolled ?? w.pf_esi_eligible) && (
                                                            <span className="text-[10px] font-semibold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">
                                                                {t('worker.pfEsi.enrolled')}
                                                            </span>
                                                        )}
                                                        {!!outstandingAdvances?.[w.id] && (
                                                            <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                                                {formatOutstandingAdvanceLabel(t('advances.badge.outstanding'), outstandingAdvances[w.id])}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-sm text-gray-700">
                                                        <Amount value={w.monthly_salary} />{t('common.per_month')}
                                                    </span>
                                                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(w)}>
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(w)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}

                    {/* Custom Roles */}
                    {Object.entries(grouped)
                        .filter(([roleName]) => !ROLES.find((r) => r.value === roleName))
                        .map(([roleName, workers]) => {
                            if (!workers || workers.length === 0) return null
                            return (
                                <Card key={roleName}>
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center gap-2">
                                            <Briefcase className="h-4 w-4 text-gray-500" />
                                            <CardTitle className="text-base capitalize">{roleName}</CardTitle>
                                            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getRoleColor('other'))}>
                                                {workers.length}
                                            </span>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <div className="divide-y">
                                            {workers.map((w) => (
                                                <div key={w.id} className="flex justify-between items-center py-3 gap-4">
                                                    <div className="min-w-0 flex-1">
                                                        <span className={cn('font-medium break-words block', !w.is_active && 'text-gray-400 line-through')}>
                                                            {tl(w.name)}
                                                        </span>
                                                        {(w.pf_esi_enrolled ?? w.pf_esi_eligible) && (
                                                            <span className="text-[10px] font-semibold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded ml-2">
                                                                {t('worker.pfEsi.enrolled')}
                                                            </span>
                                                        )}
                                                        {!!outstandingAdvances?.[w.id] && (
                                                            <span className="ml-2 text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                                                {formatOutstandingAdvanceLabel(t('advances.badge.outstanding'), outstandingAdvances[w.id])}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-sm text-gray-700">
                                                            <Amount value={w.monthly_salary} />{t('common.per_month')}
                                                        </span>
                                                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(w)}>
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(w)}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                </div>
            )}

            {/* Delete verification modal */}
            <Dialog open={verificationOpen} onOpenChange={setVerificationOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <KeyRound className="h-5 w-5" /> {t('fixed_page.auth_title')}
                        </DialogTitle>
                        <DialogDescription>{t('fixed_page.auth_desc')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {workerDebt > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-amber-900">{t('fixed_page.outstanding')}</p>
                                    <p className="text-xs text-amber-700 mt-0.5">
                                        {t('fixed_page.balance')} <strong className="text-amber-900"><Amount value={workerDebt} /></strong>{t('fixed_page.settle')}
                                    </p>
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>{t('fixed_page.access_code')}</Label>
                            <Input
                                placeholder={t('fixed_page.code_ph')}
                                value={accessCode}
                                onChange={(e) => setAccessCode(e.target.value)}
                                className="font-mono uppercase tracking-widest text-lg"
                                maxLength={6}
                            />
                        </div>

                        {/* DPDP 2026 Erasure Option */}
                        <div className="pt-2 border-t border-gray-100 flex items-start gap-3 px-1">
                            <input
                                type="checkbox"
                                id={`erase-pii-fixed-${workerToDelete?.id}`}
                                checked={erasePII}
                                onChange={(e) => setErasePII(e.target.checked)}
                                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <div className="space-y-1 cursor-pointer" onClick={() => setErasePII(!erasePII)}>
                                <Label className="text-xs font-bold text-gray-700 cursor-pointer flex items-center gap-1.5">
                                    <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                                    DPDP Right to Erasure
                                </Label>
                                <p className="text-[10px] text-gray-500 leading-snug">
                                    Anonymize worker data instead of hard deleting. 
                                    Preserves audit trail for compliance.
                                </p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setVerificationOpen(false)}>{t('fixed_page.cancel')}</Button>
                        <Button
                            variant="destructive"
                            disabled={accessCode.length < 6 || deleting}
                            onClick={executeDelete}
                        >
                            {deleting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                            {t('fixed_page.verify_delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ConfirmActionDialog
                open={confirmDeleteOpen}
                onOpenChange={setConfirmDeleteOpen}
                title="Delete worker"
                description={workerToDelete ? `Delete ${workerToDelete.name}? This worker has no production history, so no access code is required.` : ''}
                confirmLabel={t('common.remove')}
                onConfirm={executeDirectDelete}
                isDestructive
                isLoading={deleting}
            />

            <WorkerExitDialog
                open={!!exitWorker}
                onOpenChange={(open) => {
                    if (!open) {
                        setExitWorker(null)
                        setWorkerDebt(0)
                    }
                }}
                workerName={exitWorker?.name || ''}
                amount={workerDebt}
                onFinalSettle={() => {
                    if (!exitWorker) return
                    setExitWorker(null)
                    setWorkerDebt(0)
                    router.push(`/owner/payroll?exitWorkerType=fixed&exitWorkerId=${exitWorker.id}&finalSettlement=1&deactivateAfterExit=1`)
                }}
                onWriteOff={handleWriteOff}
                onKeepActive={() => {
                    setExitWorker(null)
                    setWorkerDebt(0)
                }}
                isWriteOffLoading={writingOff}
            />
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WorkersPage() {
    const { t } = useTranslation()
    const { data: userProfile } = useUserProfile()
    const [activeTab, setActiveTab] = useState<'piece-rate' | 'fixed'>('piece-rate')

    return (
        <div className="p-4 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">{t('nav.workers')}</h1>
                <p className="text-sm text-gray-500">Manage piece rate and salaried staff</p>
            </div>

            {/* Tab switcher */}
            <div className="flex rounded-lg border overflow-hidden w-full max-w-xs">
                <button
                    type="button"
                    className={cn(
                        'flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5',
                        activeTab === 'piece-rate'
                            ? 'bg-gray-900 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                    )}
                    onClick={() => setActiveTab('piece-rate')}
                >
                    <Gauge className="h-3.5 w-3.5" />
                    Piece Rate
                </button>
                <button
                    type="button"
                    className={cn(
                        'flex-1 py-2 text-sm font-medium transition-colors border-l flex items-center justify-center gap-1.5',
                        activeTab === 'fixed'
                            ? 'bg-gray-900 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                    )}
                    onClick={() => setActiveTab('fixed')}
                >
                    <Briefcase className="h-3.5 w-3.5" />
                    Fixed Salary
                </button>
            </div>

            {userProfile?.org_id && (
                activeTab === 'piece-rate'
                    ? <PieceRateTab orgId={userProfile.org_id} />
                    : <FixedWorkersTab orgId={userProfile.org_id} />
            )}
        </div>
    )
}
