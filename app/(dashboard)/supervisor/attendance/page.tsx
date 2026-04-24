'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { formatINR } from '@/lib/finance'
import { RotateCcw, Check, X, CalendarDays, KeyRound, Loader2, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { savePastAttendance, verifyAccessCode } from '@/app/(dashboard)/supervisor/actions'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useTranslation } from '@/lib/i18n/context'
import { useTransliterate } from '@/hooks/use-transliterate'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from '@/components/ui/label'

interface DailyWorker {
    id: number
    name: string
    monthly_salary: number
    is_active: boolean
}

interface AttendanceRecord {
    id: number
    fixed_worker_id: number
    date: string
    present: boolean
}

export default function AttendancePage() {
    const { t } = useTranslation()
    const tl = useTransliterate()
    const supabase = createClient()
    const queryClient = useQueryClient()

    const [selectedDate, setSelectedDate] = useState('')
    const [saving, setSaving] = useState(false)
    const [localAttendance, setLocalAttendance] = useState<Record<number, boolean>>({})

    // Authorization State
    const [unlocked, setUnlocked] = useState(false)
    const [verificationOpen, setVerificationOpen] = useState(false)
    const [verificationMode, setVerificationMode] = useState<'unlock' | 'save'>('save')
    const [accessCode, setAccessCode] = useState('')
    const [verifying, setVerifying] = useState(false)

    useEffect(() => {
        setSelectedDate(new Date().toISOString().split('T')[0])
    }, [])

    useEffect(() => {
        setUnlocked(false)
    }, [selectedDate])

    const { data: userProfile } = useUserProfile()

    const { data: dailyWorkers } = useQuery({
        queryKey: ['daily_workers', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('fixed_workers')
                .select('id, name, monthly_salary, is_active')
                .eq('org_id', userProfile!.org_id)
                .eq('role', 'daily')
                .eq('is_active', true)
                .order('name')
            if (error) throw error
            return data as DailyWorker[]
        }
    })

    const { data: attendanceRecords, isLoading: attendanceLoading } = useQuery({
        queryKey: ['attendance', userProfile?.org_id, selectedDate],
        enabled: !!userProfile?.org_id && !!selectedDate,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('attendance')
                .select('*')
                .eq('org_id', userProfile!.org_id)
                .eq('date', selectedDate)
            if (error) throw error
            return data as AttendanceRecord[]
        }
    })

    useEffect(() => {
        if (!dailyWorkers || !attendanceRecords) return
        const map: Record<number, boolean> = {}
        dailyWorkers.forEach(w => {
            const record = attendanceRecords.find(a => a.fixed_worker_id === w.id)
            map[w.id] = record ? record.present : true
        })
        setLocalAttendance(map)
    }, [dailyWorkers, attendanceRecords])

    const isLocked = attendanceRecords && attendanceRecords.length > 0 && !unlocked

    const toggleAttendance = (workerId: number, workerName: string) => {
        if (isLocked) {
            toast.error(t('attendance.already_saved'), { duration: 5000 })
            return
        }
        setLocalAttendance(prev => ({ ...prev, [workerId]: !prev[workerId] }))
    }

    const handleUnlockSubmit = async () => {
        setVerifying(true)
        try {
            if (!userProfile?.org_id) throw new Error("Missing org_id")
            const result = await verifyAccessCode(accessCode)
            if (result.error) throw new Error(result.error)

            setUnlocked(true)
            setVerificationOpen(false)
            setAccessCode('')
            toast.success('Edit mode unlocked')
        } catch (error: any) {
            toast.error(error.message || 'Invalid access code')
        } finally {
            setVerifying(false)
        }
    }

    const prepareSaveFlow = () => {
        if (!dailyWorkers || dailyWorkers.length === 0) return

        const today = new Date().toISOString().split('T')[0]
        const isPastDate = selectedDate < today

        // SEC-002: Supervisors editing past dates require an access code
        if (isPastDate && userProfile?.role === 'supervisor' && !unlocked) {
            setVerificationMode('save')
            setVerificationOpen(true)
        } else {
            executeSave()
        }
    }

    const executeSave = async (codeToUse?: string) => {
        if (!userProfile || !dailyWorkers) return

        setSaving(true)
        try {
            const recordsToSave = dailyWorkers.map(w => ({
                fixed_worker_id: w.id,
                present: localAttendance[w.id] ?? true
            }))

            if (codeToUse) {
                // Secure server action bypass for verified supervisor 
                const result = await savePastAttendance(selectedDate, recordsToSave, codeToUse)
                if (result.error) throw new Error(result.error)

                setVerificationOpen(false)
                setAccessCode('')
            } else {
                // Normal RLS-compliant client upsert (for today, or for owners)
                for (const record of recordsToSave) {
                    const { error } = await supabase
                        .from('attendance')
                        .upsert({
                            org_id: userProfile.org_id,
                            fixed_worker_id: record.fixed_worker_id,
                            date: selectedDate,
                            present: record.present,
                            marked_by: userProfile.userId,
                        }, {
                            onConflict: 'fixed_worker_id,date'
                        })
                    if (error) throw error
                }
            }

            toast.success('Attendance saved!')
            queryClient.invalidateQueries({ queryKey: ['attendance'] })
        } catch (err: any) {
            toast.error('Failed: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const setToday = () => {
        setSelectedDate(new Date().toISOString().split('T')[0])
    }

    const presentCount = Object.values(localAttendance).filter(Boolean).length
    const totalCount = dailyWorkers?.length || 0

    if (!selectedDate) return null

    return (
        <div className="space-y-4 pb-28 max-w-2xl mx-auto">
            <div className="bg-white/50 backdrop-blur-md p-4 rounded-3xl border border-white/20 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                            <CalendarDays className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-foreground tracking-tight">{t('attendance.title')}</h1>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mt-0.5">Fixed Salary Staff</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto w-full sm:w-auto">
                        <Button variant="outline" size="sm" onClick={setToday} className="h-10 px-4 text-[10px] font-black uppercase shrink-0 flex-1 sm:flex-none rounded-xl bg-white/80 hover:bg-white shadow-sm border-border active:scale-95 transition-all">
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                            {t('attendance.today')}
                        </Button>
                        <Input
                            type="date"
                            value={selectedDate}
                            max={new Date().toISOString().split('T')[0]} // Prevent future dates
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="h-10 text-sm font-bold flex-1 sm:w-[150px] rounded-xl bg-white/80 shadow-sm border-border"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-card border border-border shadow-sm rounded-2xl p-4 overflow-hidden relative">
                <div className="flex justify-between items-center relative z-10">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t('attendance.present')}</span>
                    <span className="text-xl font-black tracking-tight">
                        <span className="text-emerald-600">{presentCount}</span>
                        <span className="text-muted-foreground/30 mx-1">/</span>
                        <span className="text-slate-400">{totalCount}</span>
                    </span>
                </div>
                {/* Visual Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
                    <div 
                        className="h-full bg-emerald-500 transition-all duration-500 ease-out" 
                        style={{ width: `${totalCount > 0 ? (presentCount / totalCount) * 100 : 0}%` }}
                    />
                </div>
            </div>

            {/* Show unlock banner if there are saved entries and not unlocked */}
            {attendanceRecords && attendanceRecords.length > 0 && !unlocked && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-800 text-sm">
                        <Lock className="h-4 w-4" />
                        <span>{t('attendance.locked_banner')}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setVerificationMode('unlock'); setVerificationOpen(true); }} className="h-8 text-xs border-amber-300 text-amber-800 hover:bg-amber-100">
                        {t('attendance.unlock_edit')}
                    </Button>
                </div>
            )}

            {attendanceLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t('attendance.loading')}</p>
                </div>
            ) : !dailyWorkers || dailyWorkers.length === 0 ? (
                <div className="py-16 text-center bg-muted/20 border-2 border-dashed border-border rounded-3xl">
                    <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">{t('attendance.no_workers')}</p>
                </div>
            ) : (
                <div className="bg-card border border-border shadow-sm rounded-3xl overflow-hidden">
                    <div className="divide-y divide-border">
                        {dailyWorkers.map(worker => {
                            const isPresent = localAttendance[worker.id] ?? true
                            const dailyRate = worker.monthly_salary / 30

                            return (
                                <div
                                    key={worker.id}
                                    className={cn(
                                        'flex justify-between items-center py-4 px-4 min-h-[64px] cursor-pointer transition-all active:bg-muted/10',
                                        isPresent ? 'hover:bg-emerald-50/30' : 'hover:bg-red-50/30 opacity-60'
                                    )}
                                    onClick={() => toggleAttendance(worker.id, worker.name)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            'w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm border-2',
                                            isPresent ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-500'
                                        )}>
                                            {isPresent ? <Check className="h-6 w-6 stroke-[3px] animate-in zoom-in duration-300" /> : <X className="h-6 w-6 stroke-[3px] animate-in zoom-in duration-300" />}
                                        </div>
                                        <div>
                                            <span className={cn('font-black text-foreground tracking-tight block', !isPresent && 'line-through text-muted-foreground/50')}>
                                                {tl(worker.name)}
                                            </span>
                                            <div className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest mt-0.5">
                                                {formatINR(dailyRate)} {t('attendance.per_day')}
                                            </div>
                                        </div>
                                    </div>
                                    <span className={cn(
                                        'text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border transition-colors',
                                        isPresent ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-red-100 border-red-200 text-red-600'
                                    )}>
                                        {isPresent ? t('attendance.present') : t('attendance.absent')}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-background/40 backdrop-blur-xl border-t border-border flex justify-center z-40 pb-floating-button">
                <div className="w-full max-w-2xl md:flex md:justify-end md:px-0">
                    <Button
                        onClick={prepareSaveFlow}
                        disabled={saving || totalCount === 0}
                        className="w-full md:w-[240px] h-14 text-lg font-black shadow-[0_12px_24px_-8px_#0D948880] bg-teal-600 hover:bg-teal-700 text-white rounded-2xl transition-all active:scale-[0.98]"
                    >
                        {saving ? t('attendance.saving') : t('attendance.save')}
                    </Button>
                </div>
            </div>

            {/* Access Code Modal (SEC-002) */}
            <Dialog open={verificationOpen} onOpenChange={setVerificationOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <KeyRound className="h-5 w-5" /> {t('auth.owner_auth_req')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('attendance.auth_desc')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
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
                        <Button variant="outline" onClick={() => setVerificationOpen(false)}>{t('common.cancel')}</Button>
                        <Button
                            disabled={accessCode.length < 6 || saving || verifying}
                            onClick={() => verificationMode === 'unlock' ? handleUnlockSubmit() : executeSave(accessCode)}
                        >
                            {(saving || verifying) ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                            {verificationMode === 'unlock' ? t('attendance.verify_unlock') : t('attendance.verify_save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
