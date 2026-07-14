'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { formatINR } from '@/lib/finance'
import { RotateCcw, Check, X, CalendarDays, KeyRound, Loader2, Lock, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { savePastAttendance } from '@/app/(dashboard)/supervisor/actions'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useTranslation } from '@/lib/i18n/context'
import { useTransliterate } from '@/hooks/use-transliterate'
import { getSuratTodayString } from '@/lib/time'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from '@/components/ui/label'

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback
}

function moveDateByDays(date: string, days: number) {
    const [year, month, day] = date.split('-').map(Number)
    const next = new Date(Date.UTC(year, month - 1, day + days))
    return next.toISOString().slice(0, 10)
}

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
    const [accessCode, setAccessCode] = useState('')

    useEffect(() => {
        setSelectedDate(getSuratTodayString())
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

    const toggleAttendance = (workerId: number) => {
        if (isLocked) {
            toast.error(t('attendance.already_saved'), { duration: 5000 })
            return
        }
        setLocalAttendance(prev => ({ ...prev, [workerId]: !prev[workerId] }))
    }

    const prepareSaveFlow = () => {
        if (!dailyWorkers || dailyWorkers.length === 0) return

        const today = getSuratTodayString()
        const isPastDate = selectedDate < today

        // SEC-002 / PAY-006: Supervisors editing past dates always require an access code at save time
        if (isPastDate && userProfile?.role === 'supervisor') {
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
        } catch (err) {
            toast.error('Failed: ' + getErrorMessage(err, 'Unable to save attendance'))
        } finally {
            setSaving(false)
        }
    }

    const setToday = () => {
        setSelectedDate(getSuratTodayString())
    }

    const presentCount = Object.values(localAttendance).filter(Boolean).length
    const totalCount = dailyWorkers?.length || 0

    if (!selectedDate) return null

    return (
        <div className="mx-auto max-w-2xl space-y-4 pb-28">
            <div className="weavly-canvas rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-saffron-soft">
                            <CalendarDays className="h-5 w-5 text-saffron-deep" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold tracking-normal text-ink">{t('attendance.title')}</h1>
                            <p className="mt-0.5 text-xs font-medium leading-none text-muted-foreground">Fixed salary staff</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto w-full sm:w-auto">
                        <Button variant="outline" size="sm" onClick={setToday} className="h-10 flex-1 shrink-0 px-4 text-xs sm:flex-none">
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                            {t('attendance.today')}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Previous attendance day"
                            className="h-10 w-10 shrink-0"
                            onClick={() => setSelectedDate(moveDateByDays(selectedDate, -1))}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Input
                            aria-label="Attendance date"
                            type="date"
                            value={selectedDate}
                            max={getSuratTodayString()} // Prevent future dates
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="h-10 flex-1 rounded-lg text-sm font-semibold sm:w-[150px]"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Next attendance day"
                            className="h-10 w-10 shrink-0"
                            disabled={selectedDate >= getSuratTodayString()}
                            onClick={() => setSelectedDate(moveDateByDays(selectedDate, 1))}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
                <div className="flex justify-between items-center relative z-10">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('attendance.present')}</span>
                    <span className="text-xl font-semibold tracking-normal">
                        <span className="text-success">{presentCount}</span>
                        <span className="text-muted-foreground/30 mx-1">/</span>
                        <span className="text-muted-foreground">{totalCount}</span>
                    </span>
                </div>
                {/* Visual Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-soft">
                    <div
                        className="h-full bg-success transition-all duration-500 ease-out"
                        style={{ width: `${totalCount > 0 ? (presentCount / totalCount) * 100 : 0}%` }}
                    />
                </div>
            </div>

            {/* Show unlock banner if there are saved entries and not unlocked */}
            {attendanceRecords && attendanceRecords.length > 0 && !unlocked && (
                <div className="flex items-center justify-between rounded-lg border border-warning-soft bg-warning-soft p-3">
                    <div className="flex items-center gap-2 text-sm text-warning">
                        <Lock className="h-4 w-4" />
                        <span>{t('attendance.locked_banner')}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setUnlocked(true); }} className="h-8 border-warning-soft text-xs text-warning hover:bg-warning-soft">
                        {t('attendance.unlock_edit')}
                    </Button>
                </div>
            )}

            {attendanceLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-hairline bg-surface/70 py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-saffron" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('attendance.loading')}</p>
                </div>
            ) : !dailyWorkers || dailyWorkers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-hairline bg-surface/70 py-16 text-center">
                    <p className="text-sm font-semibold text-ink">{t('attendance.no_workers')}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Add daily workers to start attendance-linked payroll.</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-[var(--shadow-card)]">
                    <div className="divide-y divide-border">
                        {dailyWorkers.map(worker => {
                            const isPresent = localAttendance[worker.id] ?? true
                            const dailyRate = worker.monthly_salary / 30

                            return (
                                <button
                                    type="button"
                                    key={worker.id}
                                    className={cn(
                                        'flex w-full justify-between items-center py-4 px-4 min-h-[64px] cursor-pointer text-left transition-all active:bg-muted/10',
                                        isPresent ? 'hover:bg-success-soft/35' : 'hover:bg-risk-soft/40 opacity-65'
                                    )}
                                    onClick={() => toggleAttendance(worker.id)}
                                    aria-pressed={isPresent}
                                    aria-label={`${worker.name}: ${isPresent ? t('attendance.present') : t('attendance.absent')}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            'flex h-12 w-12 items-center justify-center rounded-lg border transition-all duration-300 shadow-sm',
                                            isPresent ? 'border-success-soft bg-success-soft text-success' : 'border-risk-soft bg-risk-soft text-risk'
                                        )}>
                                            {isPresent ? <Check className="h-6 w-6 stroke-[3px] animate-in zoom-in duration-300" /> : <X className="h-6 w-6 stroke-[3px] animate-in zoom-in duration-300" />}
                                        </div>
                                        <div>
                                            <span className={cn('block font-semibold tracking-normal text-ink', !isPresent && 'line-through text-muted-foreground/50')}>
                                                {tl(worker.name)}
                                            </span>
                                            <div className="mt-0.5 text-xs font-medium text-muted-foreground">
                                                {formatINR(dailyRate)} {t('attendance.per_day')}
                                            </div>
                                        </div>
                                    </div>
                                    <span className={cn(
                                        'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                                        isPresent ? 'border-success-soft bg-success-soft text-success' : 'border-risk-soft bg-risk-soft text-risk'
                                    )}>
                                        {isPresent ? t('attendance.present') : t('attendance.absent')}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center border-t border-border bg-canvas/76 p-4 backdrop-blur-xl pb-floating-button md:left-[248px] md:p-6">
                <div className="w-full max-w-2xl md:flex md:justify-end md:px-0">
                    <Button
                        onClick={prepareSaveFlow}
                        disabled={saving || totalCount === 0}
                        className="h-14 w-full rounded-xl text-base font-semibold md:w-[240px]"
                    >
                        {saving ? t('attendance.saving') : t('attendance.save')}
                    </Button>
                </div>
            </div>

            {/* Access Code Modal (SEC-002) */}
            <Dialog open={verificationOpen} onOpenChange={setVerificationOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-risk">
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
                                className="font-mono text-lg uppercase tracking-widest"
                                maxLength={6}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setVerificationOpen(false)}>{t('common.cancel')}</Button>
                        <Button
                            disabled={accessCode.length < 6 || saving}
                            onClick={() => executeSave(accessCode)}
                        >
                            {saving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                            {t('attendance.verify_save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
