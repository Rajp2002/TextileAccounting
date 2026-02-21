'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { formatINR } from '@/lib/finance'
import { RotateCcw, Check, X, CalendarDays, KeyRound, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { savePastAttendance } from '@/app/(dashboard)/supervisor/actions'
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
    const supabase = createClient()
    const queryClient = useQueryClient()

    const [selectedDate, setSelectedDate] = useState('')
    const [saving, setSaving] = useState(false)
    const [localAttendance, setLocalAttendance] = useState<Record<number, boolean>>({})

    // Authorization State
    const [verificationOpen, setVerificationOpen] = useState(false)
    const [accessCode, setAccessCode] = useState('')

    useEffect(() => {
        setSelectedDate(new Date().toISOString().split('T')[0])
    }, [])

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
            return { ...data, userId: user.id }
        }
    })

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

    const toggleAttendance = (workerId: number) => {
        setLocalAttendance(prev => ({ ...prev, [workerId]: !prev[workerId] }))
    }

    const prepareSaveFlow = () => {
        if (!dailyWorkers || dailyWorkers.length === 0) return

        const today = new Date().toISOString().split('T')[0]
        const isPastDate = selectedDate < today

        // SEC-002: Supervisors editing past dates require an access code
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
                await savePastAttendance(userProfile.org_id, selectedDate, recordsToSave, codeToUse)
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
        <div className="space-y-4 pb-24">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5 text-indigo-600" />
                            <CardTitle>Daily Attendance</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={setToday} className="h-8 px-2 text-xs">
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Today
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
                        <span className="text-sm text-gray-500">Present</span>
                        <span className="text-lg font-bold">
                            <span className="text-green-700">{presentCount}</span>
                            <span className="text-gray-400"> / {totalCount}</span>
                        </span>
                    </div>
                </CardContent>
            </Card>

            {attendanceLoading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : !dailyWorkers || dailyWorkers.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="font-medium text-gray-500">No day-to-day workers</p>
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
                                            'flex justify-between items-center py-3 px-2 rounded-lg cursor-pointer transition-colors',
                                            isPresent ? 'hover:bg-green-50' : 'hover:bg-red-50 opacity-60'
                                        )}
                                        onClick={() => toggleAttendance(worker.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                                                isPresent ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'
                                            )}>
                                                {isPresent ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                            </div>
                                            <div>
                                                <span className={cn('font-medium', !isPresent && 'line-through text-gray-400')}>
                                                    {worker.name}
                                                </span>
                                                <div className="text-xs text-gray-400">
                                                    {formatINR(dailyRate)}/day
                                                </div>
                                            </div>
                                        </div>
                                        <span className={cn(
                                            'text-xs font-semibold px-2 py-1 rounded-full',
                                            isPresent ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'
                                        )}>
                                            {isPresent ? 'Present' : 'Absent'}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-center z-10">
                <Button
                    onClick={prepareSaveFlow}
                    disabled={saving || totalCount === 0}
                    className="w-full max-w-md h-12 text-lg font-semibold shadow-lg"
                >
                    {saving ? 'Saving...' : 'Save Attendance'}
                </Button>
            </div>

            {/* Access Code Modal (SEC-002) */}
            <Dialog open={verificationOpen} onOpenChange={setVerificationOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <KeyRound className="h-5 w-5" /> Owner Authorization Required
                        </DialogTitle>
                        <DialogDescription>
                            Editing attendance for past dates requires a single-use access code from the factory owner.
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
                        <Button variant="outline" onClick={() => setVerificationOpen(false)}>Cancel</Button>
                        <Button
                            disabled={accessCode.length < 6 || saving}
                            onClick={() => executeSave(accessCode)}
                        >
                            {saving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                            Verify & Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
