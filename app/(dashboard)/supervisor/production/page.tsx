'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queueMutation } from '@/lib/db'
import { createClient } from '@/lib/supabase/client'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { calculateDailyPay, formatINR } from '@/lib/finance'
import { verifyAccessCode } from '@/app/(dashboard)/supervisor/actions'
import { CalendarDays, KeyRound, Loader2, RotateCcw, Lock, BoxSelect } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Worker {
    id: number
    name: string
    is_active: boolean
}

interface Machine {
    id: string
    name: string
    rate_per_meter: number
    status: string
}

interface Assignment {
    machine_id: string
    worker_id: number
    shift: 'day' | 'night'
}

export default function ProductionEntryForm() {
    const [metersInput, setMetersInput] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(false)
    const [selectedDate, setSelectedDate] = useState<string>('')
    const [currentShift, setCurrentShift] = useState<'day' | 'night'>('day')

    // Authorization State
    const [unlocked, setUnlocked] = useState(false)
    const [verificationOpen, setVerificationOpen] = useState(false)
    const [accessCode, setAccessCode] = useState('')
    const [verifying, setVerifying] = useState(false)

    const isOnline = useOnlineStatus()
    const supabase = createClient()
    const queryClient = useQueryClient()

    // Initialize date and shift
    useEffect(() => {
        const now = new Date()
        setSelectedDate(now.toISOString().split('T')[0])

        const hour = now.getHours()
        // 7 AM to 7 PM is Day shift
        if (hour >= 7 && hour < 19) {
            setCurrentShift('day')
        } else {
            setCurrentShift('night')
        }
    }, [])

    // Lock again if date changes
    useEffect(() => {
        setUnlocked(false)
        setMetersInput({})
    }, [selectedDate])

    const { data: userProfile } = useQuery({
        queryKey: ['user_profile'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')
            const { data, error } = await supabase
                .from('profiles')
                .select('org_id')
                .eq('id', user.id)
                .single()
            if (error) throw error
            return { ...data, userId: user.id }
        }
    })

    const { data: existingLogs, isLoading: logsLoading } = useQuery({
        queryKey: ['production_logs', userProfile?.org_id, selectedDate, currentShift],
        enabled: !!userProfile?.org_id && !!selectedDate,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('production_logs')
                .select('*')
                .eq('org_id', userProfile!.org_id)
                .eq('date', selectedDate)
                .eq('shift', currentShift)
            if (error) throw error
            return data
        }
    })

    const { data: machines, isLoading: machinesLoading } = useQuery({
        queryKey: ['machines', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('machines')
                .select('*')
                .eq('org_id', userProfile!.org_id)
                .order('name')
            if (error) throw error
            return data as Machine[]
        }
    })

    const { data: workers } = useQuery({
        queryKey: ['active_workers', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('workers')
                .select('id, name, is_active')
                .eq('org_id', userProfile!.org_id)
                .eq('is_active', true)
                .order('name')
            if (error) throw error
            return data as Worker[]
        }
    })

    const { data: assignments } = useQuery({
        queryKey: ['machine_assignments', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('machine_assignments')
                .select('*')
                .eq('org_id', userProfile!.org_id)
            if (error) throw error
            return data as Assignment[]
        }
    })

    const machineCards = useMemo(() => {
        if (!machines) return []
        return machines.map(machine => {
            // Filter by both machine_id AND shift so day/night logs are independent
            const existingLog = existingLogs?.find(
                l => l.machine_id === machine.id && l.shift === currentShift
            )
            const assignment = assignments?.find(a => a.machine_id === machine.id && a.shift === currentShift)
            const assignedWorkerId = assignment?.worker_id
            const effectiveWorkerId = existingLog ? existingLog.worker_id : assignedWorkerId
            const isSaved = !!existingLog

            return {
                machine,
                assignedWorkerId,
                effectiveWorkerId,
                meters: existingLog ? Number(existingLog.meters) : (metersInput[machine.id] || 0),
                isSaved,
                existingLogId: existingLog?.id
            }
        })
    }, [machines, assignments, currentShift, metersInput, existingLogs])

    const handleMetersChange = (machineId: string, value: number, isSaved: boolean) => {
        if (isSaved && !unlocked) return // Cannot change if saved and not unlocked
        setMetersInput(prev => ({ ...prev, [machineId]: value }))
    }

    const setToday = () => {
        setSelectedDate(new Date().toISOString().split('T')[0])
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

            // Copy existing log meters to metersInput state so they can be edited seamlessly
            const newMeters: Record<string, number> = {}
            if (existingLogs) {
                existingLogs.forEach(log => {
                    newMeters[log.machine_id] = Number(log.meters)
                })
            }
            setMetersInput(newMeters)

        } catch (error: any) {
            toast.error(error.message || 'Invalid access code')
        } finally {
            setVerifying(false)
        }
    }

    const handleSaveAll = async () => {
        // Only save entries that have meters > 0 and are either NOT saved, OR are unlocked for editing.
        // Wait, if unlocked, user might have modified a saved entry.
        const entriesToSave = machineCards.filter(c => {
            if (c.isSaved && !unlocked) return false;

            // If unlocked, we only want to save if there's a user input value (which might be 0, overriding the old one?).
            // Actually if unlocked, user can submit whatever is in the input. Let's just save ones where c.meters is defined.
            return (metersInput[c.machine.id] !== undefined) || (!c.isSaved && c.meters > 0)
        })

        if (entriesToSave.length === 0) {
            toast.warning('No new or edited meters entered.')
            return
        }

        const missingWorker = entriesToSave.find(c => !c.effectiveWorkerId)
        if (missingWorker) {
            toast.error(`Please assign a worker for ${missingWorker.machine.name} in assignments first.`)
            return
        }

        setLoading(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            for (const item of entriesToSave) {
                // If it's already saved, and we are unlocked, we upsert based on the existingLogId
                // Otherwise we insert a new log
                const finalMeters = metersInput[item.machine.id] !== undefined ? metersInput[item.machine.id] : item.meters

                const productionData: any = {
                    machine_id: item.machine.id,
                    worker_id: item.effectiveWorkerId!,
                    meters: finalMeters,
                    date: selectedDate,
                    shift: currentShift,
                    org_id: userProfile!.org_id,
                }

                if (item.existingLogId) {
                    productionData.id = item.existingLogId // for upsert
                    productionData.updated_by = user.id
                } else {
                    productionData.created_by = user.id
                }

                if (isOnline) {
                    const { error } = await supabase.from('production_logs').upsert(productionData, { onConflict: 'id' })
                    if (error) throw error
                } else {
                    if (item.existingLogId) {
                        await queueMutation('production_logs', 'UPDATE', productionData)
                    } else {
                        await queueMutation('production_logs', 'INSERT', productionData)
                    }
                }
            }

            toast.success(
                isOnline
                    ? `${entriesToSave.length} entries saved!`
                    : `${entriesToSave.length} entries queued (offline).`
            )

            setMetersInput({})
            setUnlocked(false)
            queryClient.invalidateQueries({ queryKey: ['production_logs', userProfile?.org_id, selectedDate, currentShift] })
            queryClient.invalidateQueries({ queryKey: ['production_daily_total', 'production_worker_stats'] })
        } catch (error: any) {
            toast.error('Failed to save: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 pb-28">
            <Card className="shadow-sm">
                <CardHeader className="p-4 sm:p-6 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5 text-teal-600" />
                            <CardTitle className="text-xl">Log Production</CardTitle>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={setToday} className="h-10 px-3 text-sm flex-1 sm:flex-none">
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Today
                            </Button>
                            <Input
                                type="date"
                                value={selectedDate}
                                max={new Date().toISOString().split('T')[0]} // Prevent future dates
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="h-10 w-[140px] text-sm"
                            />
                        </div>
                    </div>
                </CardHeader>

                {/* Full-width Shift Toggle inside card content */}
                <CardContent className="p-4 sm:p-6 pt-0">
                    <div className="flex rounded-xl bg-gray-100 p-1 w-full mt-2">
                        <button
                            onClick={() => setCurrentShift('day')}
                            className={cn(
                                'flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 shadow-sm',
                                currentShift === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 shadow-none'
                            )}
                        >
                            Day Shift
                        </button>
                        <button
                            onClick={() => setCurrentShift('night')}
                            className={cn(
                                'flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 shadow-sm',
                                currentShift === 'night' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 shadow-none'
                            )}
                        >
                            Night Shift
                        </button>
                    </div>
                </CardContent>
            </Card>

            {/* Show unlock banner if there are saved entries and not unlocked */}
            {machineCards.some(c => c.isSaved) && !unlocked && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-800 text-sm">
                        <Lock className="h-4 w-4" />
                        <span>Some entries are already saved and locked.</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setVerificationOpen(true)} className="h-8 text-xs border-amber-300 text-amber-800 hover:bg-amber-100">
                        Unlock to Edit
                    </Button>
                </div>
            )}

            {(machinesLoading || logsLoading) ? (
                <div className="text-center py-12 flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-600 mb-4" />
                    <p className="text-gray-500 font-medium">Loading factory data...</p>
                </div>
            ) : machineCards.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed rounded-xl border-gray-200 bg-white">
                    <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                        <BoxSelect className="h-8 w-8" />
                    </div>
                    <p className="text-gray-900 font-semibold text-lg">No machines found</p>
                    <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">Please add machines in the owner view before logging production.</p>
                </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {machineCards.map(({ machine, assignedWorkerId, effectiveWorkerId, meters, isSaved }) => {
                    const rate = machine.rate_per_meter || 0

                    // Priority of meters: metersInput (if user editing) > existing meters > 0
                    const displayMeters = metersInput[machine.id] !== undefined ? metersInput[machine.id] : meters
                    const pay = displayMeters > 0 ? calculateDailyPay(displayMeters, rate) : null
                    const worker = workers?.find(w => w.id === effectiveWorkerId)

                    const disabled = isSaved && !unlocked

                    return (
                        <Card key={machine.id} className={cn("shadow-sm transition-opacity", disabled ? "opacity-60 bg-gray-50" : "")}>
                            <CardContent className="p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-semibold text-lg">{machine.name}</div>
                                        <div className="text-xs text-gray-500">Rate: ₹{rate}/m</div>
                                    </div>
                                    {pay && (
                                        <span className={cn("text-sm font-bold px-2 py-1 rounded", disabled ? "bg-gray-200 text-gray-600" : "text-green-700 bg-green-50")}>
                                            Est: {formatINR(pay)}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-500">Worker</Label>
                                    <div className="text-sm font-medium h-8 flex items-center">
                                        {worker ? worker.name : <span className="text-red-500 italic">No assigned worker for this shift</span>}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 pt-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="lg"
                                        className="h-12 w-16 bg-gray-50 hover:bg-gray-100 text-gray-700 text-lg border-gray-200"
                                        disabled={disabled}
                                        onClick={() => handleMetersChange(machine.id, Math.max(0, displayMeters - 10), isSaved)}
                                    >
                                        -10
                                    </Button>
                                    <Input
                                        type="number"
                                        value={displayMeters || ''}
                                        disabled={disabled}
                                        onChange={(e) => handleMetersChange(machine.id, Number(e.target.value), isSaved)}
                                        placeholder="0"
                                        className="text-center text-xl font-bold h-12 w-full flex-1 border-gray-300 focus:border-teal-500 focus:ring-teal-500 transition-all"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="lg"
                                        className="h-12 w-16 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-100 text-lg"
                                        disabled={disabled}
                                        onClick={() => handleMetersChange(machine.id, displayMeters + 10, isSaved)}
                                    >
                                        +10
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Access Code Modal */}
            <Dialog open={verificationOpen} onOpenChange={setVerificationOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <KeyRound className="h-5 w-5" /> Owner Authorization Required
                        </DialogTitle>
                        <DialogDescription>
                            Editing past or saved production entries requires a single-use access code from the factory owner.
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
                            disabled={accessCode.length < 6 || verifying}
                            onClick={handleUnlockSubmit}
                        >
                            {verifying ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                            Verify & Unlock
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Fixed Save All button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] flex justify-center z-40 pb-[env(safe-area-inset-bottom,16px)] md:pb-6">
                <div className="w-full max-w-5xl md:flex md:justify-end md:px-0">
                    <Button
                        onClick={handleSaveAll}
                        disabled={loading || machineCards.length === 0}
                        className="w-full md:w-[240px] h-[52px] text-lg font-bold shadow-md bg-teal-600 hover:bg-teal-700 text-white rounded-xl mb-14 md:mb-0 transition-all"
                    >
                        {loading ? 'Saving...' : 'Save All Entries'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
