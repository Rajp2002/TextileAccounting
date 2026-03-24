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
            const result = await verifyAccessCode(userProfile.org_id, accessCode)
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
                const result = await savePastAttendance(userProfile.org_id, selectedDate, recordsToSave, codeToUse)
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
            <Card className="shadow-sm">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5 text-indigo-600" />
                            <CardTitle>{t('attendance.title')}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={setToday} className="h-8 px-2 text-xs">
                                <RotateCcw className="h-3 w-3 mr-1" />
                                {t('attendance.today')}
                            </Button>
                            <Input
                                type="date"
                                value={selectedDate}
                                max={new Date().toISOString().split('T')[0]} // Prevent future dates
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="h-8 w-auto text-sm"
                            />
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card>
                <CardContent className="py-4">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">{t('attendance.present')}</span>
                        <span className="text-lg font-bold">
                            <span className="text-green-700">{presentCount}</span>
                            <span className="text-gray-400"> / {totalCount}</span>
                        </span>
                    </div>
                </CardContent>
            </Card>

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
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-4" />
                    <p className="text-gray-500 font-medium text-sm">{t('attendance.loading')}</p>
                </div>
            ) : !dailyWorkers || dailyWorkers.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="font-medium text-gray-500">{t('attendance.no_workers')}</p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="py-2">
                        <div className="divide-y">
                            {dailyWorkers.map(worker => {
                                const isPresent = localAttendance[worker.id] ?? true
                                const dailyRate = worker.monthly_salary / 30

                                return (
                                    <div
                                        key={worker.id}
                                        className={cn(
                                            'flex justify-between items-center py-4 px-3 min-h-[56px] rounded-lg cursor-pointer transition-colors',
                                            isPresent ? 'hover:bg-green-50/50' : 'hover:bg-red-50/50 opacity-60'
                                        )}
                                        onClick={() => toggleAttendance(worker.id, worker.name)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                'w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-sm',
                                                isPresent ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'
                                            )}>
                                                {isPresent ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                                            </div>
                                            <div>
                                                <span className={cn('font-medium', !isPresent && 'line-through text-gray-400')}>
                                                    {tl(worker.name)}
                                                </span>
                                                <div className="text-xs text-gray-400">
                                                    {formatINR(dailyRate)}{t('attendance.per_day')}
                                                </div>
                                            </div>
                                        </div>
                                        <span className={cn(
                                            'text-xs font-semibold px-2.5 py-1 rounded-full',
                                            isPresent ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'
                                        )}>
                                            {isPresent ? t('attendance.present') : t('attendance.absent')}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] flex justify-center z-40 pb-[env(safe-area-inset-bottom,16px)] md:pb-6">
                <div className="w-full max-w-2xl md:flex md:justify-end md:px-0">
                    <Button
                        onClick={prepareSaveFlow}
                        disabled={saving || totalCount === 0}
                        className="w-full md:w-[240px] h-[52px] text-lg font-bold shadow-md bg-teal-600 hover:bg-teal-700 text-white rounded-xl mb-14 md:mb-0 transition-all"
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
