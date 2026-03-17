'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sumMeters, calculateTotalPay, formatINR } from '@/lib/finance'
import { toast } from 'sonner'
import { AddWorkerDialog } from '@/components/AddWorkerDialog'
import { Calendar as CalendarIcon, RotateCcw, ChevronDown, ChevronRight, HardHat, Briefcase, Pencil, Check, X, TrendingUp, IndianRupee, Users2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUserProfile } from '@/hooks/use-user-profile'
import { Skeleton } from '@/components/ui/skeleton'

// Define interfaces for better type safety
interface Worker {
    id: number
    name: string
    is_active: boolean
}

interface Machine {
    id: string
    name: string
    rate_per_meter: number
}

interface ProductionLog {
    worker_id: number
    machine_id: string
    meters: number | string
}

interface MachineBreakdown {
    machineName: string
    meters: string
    pay: string
}

interface WorkerStats {
    id: number
    name: string
    is_active: boolean
    totalMeters: string
    pay: string
    breakdown: MachineBreakdown[]
}

interface FixedWorkerData {
    id: number
    name: string
    role: string
    monthly_salary: number
    is_active: boolean
    daysWorked?: number
    earnedPay?: number
}

const ROLE_LABELS: Record<string, string> = {
    master: 'Master',
    supervisor: 'Supervisor',
    helper: 'Helper',
    mender: 'Mender',
    sanitation: 'Sanitation',
    daily: 'Day-to-Day',
}

const ROLE_COLORS: Record<string, string> = {
    master: 'bg-purple-100 text-purple-700',
    supervisor: 'bg-blue-100 text-blue-700',
    helper: 'bg-amber-100 text-amber-700',
    mender: 'bg-teal-100 text-teal-700',
    sanitation: 'bg-green-100 text-green-700',
    daily: 'bg-orange-100 text-orange-700',
}

function WorkerRow({ worker }: { worker: WorkerStats }) {
    const [isExpanded, setIsExpanded] = useState(false)

    return (
        <div className="border-b last:border-0">
            <div
                className={cn(
                    "flex justify-between items-center py-3 px-2 cursor-pointer hover:bg-gray-50 transition-colors rounded-lg",
                    isExpanded && "bg-gray-50"
                )}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    {(worker.breakdown?.length || 0) > 0 ? (
                        isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                        )
                    ) : (
                        <div className="w-4" /> // Spacer
                    )}

                    <span className={cn("font-medium", !worker.is_active && "text-gray-400")}>
                        {worker.name}
                    </span>
                    {!worker.is_active && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                            Inactive
                        </span>
                    )}
                </div>
                <div className="text-right">
                    <span className="font-bold">{worker.totalMeters} m</span>
                    {parseFloat(worker.pay) > 0 && (
                        <span className="text-sm text-green-700 ml-2 font-medium bg-green-50 px-2 py-0.5 rounded">
                            {formatINR(worker.pay)}
                        </span>
                    )}
                </div>
            </div>

            {isExpanded && (worker.breakdown?.length || 0) > 0 && (
                <div className="pl-9 pr-2 pb-3 pt-1 space-y-1">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex justify-between px-2">
                        <span>Machine</span>
                        <span>Output / Pay</span>
                    </div>
                    {worker.breakdown?.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm py-1 px-2 hover:bg-white rounded">
                            <span className="text-gray-600">{item.machineName}</span>
                            <div className="text-right text-gray-900">
                                <span>{item.meters} m</span>
                                {parseFloat(item.pay) > 0 && (
                                    <span className="text-xs text-gray-500 ml-2">
                                        ({formatINR(item.pay)})
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function FixedWorkerRow({ worker, onSalaryUpdate }: { worker: FixedWorkerData, onSalaryUpdate: (id: number, salary: number) => void }) {
    const [editing, setEditing] = useState(false)
    const [editValue, setEditValue] = useState(worker.monthly_salary.toString())

    // Keep editValue in sync when the parent refreshes worker data from the DB,
    // but only when the user isn't actively editing (to avoid clobbering live input)
    useEffect(() => {
        if (!editing) {
            setEditValue(worker.monthly_salary.toString())
        }
    }, [worker.monthly_salary, editing])

    const handleSave = () => {
        const val = parseFloat(editValue)
        if (isNaN(val) || val <= 0) return
        onSalaryUpdate(worker.id, val)
        setEditing(false)
    }

    return (
        <div className="py-3 px-2 hover:bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_COLORS[worker.role] || 'bg-gray-100 text-gray-700')}>
                        {ROLE_LABELS[worker.role] || worker.role}
                    </span>
                    <span className="font-medium">{worker.name}</span>
                </div>
                <div className="flex items-center gap-2">
                    {editing ? (
                        <div className="flex items-center gap-1">
                            <span className="text-sm text-gray-500">₹</span>
                            <Input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="h-7 w-24 text-sm text-right"
                                autoFocus
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
                            />
                            <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                <Check className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setEditing(false)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <span className="text-sm font-semibold text-gray-700">
                                {formatINR(worker.monthly_salary)}/mo
                            </span>
                            <button onClick={() => { setEditValue(worker.monthly_salary.toString()); setEditing(true) }} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded">
                                <Pencil className="h-3.5 w-3.5" />
                            </button>
                        </>
                    )}
                </div>
            </div>
            {/* Day-to-day: show earned pay this month */}
            {worker.role === 'daily' && worker.earnedPay !== undefined && (
                <div className="mt-1.5 flex items-center gap-2 pl-1">
                    <span className="text-xs text-gray-400">
                        {worker.daysWorked ?? 0} day{worker.daysWorked !== 1 ? 's' : ''} worked this month
                    </span>
                    <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                        {formatINR(worker.earnedPay)} earned so far
                    </span>
                </div>
            )}
        </div>
    )
}

export default function OwnerDashboard() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    // State for selected date (YYYY-MM-DD)
    const [selectedDate, setSelectedDate] = useState<string>('')

    // Initialize with today's date on client-side to avoid hydration mismatch
    useEffect(() => {
        setSelectedDate(new Date().toISOString().split('T')[0])
    }, [])

    // Fetch the current user's profile info
    const { data: userProfile } = useUserProfile()

    // Real-time subscription for production logs
    useEffect(() => {
        if (!userProfile?.org_id || !selectedDate) return

        const channel = supabase.channel('production_logs_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'production_logs',
                    filter: `org_id=eq.${userProfile.org_id}`
                },
                () => {
                    // Invalidate queries when production logs change
                    queryClient.invalidateQueries({ queryKey: ['production_daily_total', userProfile.org_id, selectedDate] })
                    queryClient.invalidateQueries({ queryKey: ['production_worker_stats', userProfile.org_id, selectedDate] })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [supabase, queryClient, userProfile?.org_id, selectedDate])

    // Fetch daily totals — scoped by org_id and selected date
    const { data: dailyTotal, isLoading } = useQuery({
        queryKey: ['production_daily_total', userProfile?.org_id, selectedDate],
        enabled: !!userProfile?.org_id && !!selectedDate,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('production_logs')
                .select('meters')
                .eq('org_id', userProfile!.org_id)
                .eq('date', selectedDate)

            if (error) throw error
            return sumMeters(data)
        }
    })

    // 📊 Strike Package 6: Worker-level breakdown (Machine-based Pay)
    const { data: workerStats, isLoading: workersLoading } = useQuery({
        queryKey: ['production_worker_stats', userProfile?.org_id, selectedDate],
        enabled: !!userProfile?.org_id && !!selectedDate,
        queryFn: async () => {
            // 1. Fetch Workers
            const { data: workers, error: wErr } = await supabase
                .from('workers')
                .select('id, name, is_active')
                .eq('org_id', userProfile!.org_id)
                .order('name')
            if (wErr) throw wErr

            // 2. Fetch Machines (for names and rates)
            const { data: machines, error: mErr } = await supabase
                .from('machines')
                .select('id, name, rate_per_meter')
                .eq('org_id', userProfile!.org_id)
            if (mErr) throw mErr

            // Map machine details for lookup
            const machineMap = (machines || []).reduce((acc: Record<string, { name: string, rate: number }>, m: any) => {
                acc[m.id] = { name: m.name, rate: m.rate_per_meter }
                return acc
            }, {} as Record<string, { name: string, rate: number }>)

            // 3. Fetch Logs for date
            const { data: logs, error: lErr } = await supabase
                .from('production_logs')
                .select('worker_id, machine_id, meters')
                .eq('org_id', userProfile!.org_id)
                .eq('date', selectedDate)
            if (lErr) throw lErr

            // 4. Calculate stats per worker
            return workers.map((worker: Worker) => {
                const workerLogs = (logs as ProductionLog[]).filter(l => l.worker_id === worker.id)
                const totalMeters = sumMeters(workerLogs) // returns string "0.00"

                // Group by machine for breakdown
                const machineGroups: Record<string, number> = {}
                workerLogs.forEach(log => {
                    // Safe aggregation handled by explicitly converting to number
                    const logMeters = typeof log.meters === 'string' ? parseFloat(log.meters) : log.meters
                    machineGroups[log.machine_id] = (machineGroups[log.machine_id] || 0) + (logMeters || 0)
                })

                const breakdown: MachineBreakdown[] = Object.entries(machineGroups).map(([machineId, meters]) => {
                    const machine = machineMap[machineId]
                    const pay = calculateTotalPay([{ meters, rate: machine?.rate || 0 }])
                    return {
                        machineName: machine?.name || 'Unknown Machine',
                        meters: meters.toFixed(2), // Convert to fixed string
                        pay
                    }
                })

                // Sorting breakdown by meters descending (parse back to float for sort)
                breakdown.sort((a, b) => parseFloat(b.meters) - parseFloat(a.meters))

                // Calculate total pay
                const payItems = workerLogs.map(log => ({
                    meters: log.meters,
                    rate: machineMap[log.machine_id]?.rate || 0
                }))
                const totalPay = calculateTotalPay(payItems)

                return {
                    id: worker.id,
                    name: worker.name,
                    is_active: worker.is_active,
                    totalMeters,
                    pay: totalPay,
                    breakdown,
                }
            })
        }
    })

    // Fixed workers payroll query
    const { data: fixedPayroll } = useQuery({
        queryKey: ['fixed_payroll', userProfile?.org_id, selectedDate],
        enabled: !!userProfile?.org_id && !!selectedDate,
        queryFn: async () => {
            // Get all active fixed workers
            const { data: fixedWorkers, error: fErr } = await supabase
                .from('fixed_workers')
                .select('id, name, role, monthly_salary')
                .eq('org_id', userProfile!.org_id)
                .eq('is_active', true)
            if (fErr) throw fErr

            // Get current month's attendance for day-to-day workers
            const month = selectedDate.substring(0, 7) // YYYY-MM
            const { data: attendance, error: aErr } = await supabase
                .from('attendance')
                .select('fixed_worker_id, present')
                .eq('org_id', userProfile!.org_id)
                .gte('date', `${month}-01`)
                .lte('date', `${month}-31`)
            if (aErr) throw aErr

            let totalFixed = 0
            let totalDaily = 0

            for (const w of (fixedWorkers || [])) {
                if (w.role === 'daily') {
                    // Prorated: (salary / 30) * days_present
                    const daysPresent = (attendance || []).filter(
                        (a: { fixed_worker_id: number; present: boolean }) => a.fixed_worker_id === w.id && a.present
                    ).length
                    // Prorated but capped at monthly salary (max 30 days)
                    totalDaily += Math.min(w.monthly_salary, (w.monthly_salary / 30) * daysPresent)
                } else {
                    totalFixed += w.monthly_salary
                }
            }

            return {
                totalFixed,
                totalDaily,
                total: totalFixed + totalDaily,
                fixedCount: (fixedWorkers || []).filter((w: any) => w.role !== 'daily').length,
                dailyCount: (fixedWorkers || []).filter((w: any) => w.role === 'daily').length,
            }
        }
    })

    // Fetch fixed workers list (with attendance for daily workers)
    const { data: fixedWorkersList } = useQuery({
        queryKey: ['fixed_workers_list', userProfile?.org_id, selectedDate],
        enabled: !!userProfile?.org_id && !!selectedDate,
        queryFn: async () => {
            const { data: workers, error } = await supabase
                .from('fixed_workers')
                .select('*')
                .eq('org_id', userProfile!.org_id)
                .eq('is_active', true)
                .order('role')
                .order('name')
            if (error) throw error

            // Fetch this month's attendance for daily workers
            const month = selectedDate.substring(0, 7) // YYYY-MM
            const dailyWorkerIds = (workers || [])
                .filter((w: any) => w.role === 'daily')
                .map((w: any) => w.id)

            let attendanceMap: Record<number, number> = {}
            if (dailyWorkerIds.length > 0) {
                const { data: attendance } = await supabase
                    .from('attendance')
                    .select('fixed_worker_id, present')
                    .eq('org_id', userProfile!.org_id)
                    .in('fixed_worker_id', dailyWorkerIds)
                    .gte('date', `${month}-01`)
                    .lte('date', `${month}-31`)
                    .eq('present', true)
                    ; (attendance || []).forEach((a: any) => {
                        attendanceMap[a.fixed_worker_id] = (attendanceMap[a.fixed_worker_id] || 0) + 1
                    })
            }

            return (workers || []).map((w: any) => {
                if (w.role === 'daily') {
                    const daysWorked = attendanceMap[w.id] || 0
                    const earnedPay = Math.min(w.monthly_salary, (w.monthly_salary / 30) * daysWorked)
                    return { ...w, daysWorked, earnedPay }
                }
                return w as FixedWorkerData
            }) as FixedWorkerData[]
        }
    })

    const handleWorkerAdded = () => {
        // Invalidate both meter and fixed worker queries
        queryClient.invalidateQueries({ queryKey: ['production_worker_stats', userProfile?.org_id] })
        queryClient.invalidateQueries({ queryKey: ['fixed_workers'] })
        queryClient.invalidateQueries({ queryKey: ['fixed_workers_list'] })
        queryClient.invalidateQueries({ queryKey: ['fixed_payroll'] })
    }

    const handleFixedSalaryUpdate = async (workerId: number, salary: number) => {
        const { error } = await supabase
            .from('fixed_workers')
            .update({ monthly_salary: salary })
            .eq('id', workerId)
        if (error) {
            toast.error(error.message)
        } else {
            toast.success('Salary updated')
            queryClient.invalidateQueries({ queryKey: ['fixed_workers_list'] })
            queryClient.invalidateQueries({ queryKey: ['fixed_payroll'] })
        }
    }

    const setToday = () => {
        setSelectedDate(new Date().toISOString().split('T')[0])
    }

    // Return null while date initializes to prevent hydration mismatch or stale data
    if (!selectedDate) return null

    return (
        <div className="space-y-8">
            {/* Welcome Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {new Date(selectedDate || Date.now()).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                {userProfile?.org_id && (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-white rounded-lg border p-1 shadow-sm">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={setToday}
                                className="h-8 px-2 text-xs font-medium hover:bg-gray-100 text-gray-600"
                                title="Reset to Today"
                            >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Today
                            </Button>
                            <div className="h-4 w-px bg-gray-200" />
                            <Input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="h-8 w-auto border-0 focus-visible:ring-0 px-2 py-0 text-sm font-medium text-gray-700"
                            />
                        </div>
                        <AddWorkerDialog
                            orgId={userProfile.org_id}
                            onWorkerAdded={handleWorkerAdded}
                        />
                    </div>
                )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-l-4 border-l-emerald-500 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Daily Production</p>
                                {isLoading ? (
                                    <Skeleton className="h-9 w-28 mt-2" />
                                ) : (
                                    <p className="text-3xl font-bold text-gray-900 mt-1">{dailyTotal} m</p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                    Output for {new Date(selectedDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                                </p>
                            </div>
                            <div className="p-2 bg-emerald-50 rounded-lg">
                                <TrendingUp className="h-5 w-5 text-emerald-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-indigo-500 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Production Payroll</p>
                                {workersLoading ? (
                                    <Skeleton className="h-9 w-28 mt-2" />
                                ) : (
                                    <p className="text-3xl font-bold text-gray-900 mt-1">
                                        {workerStats
                                            ? formatINR(workerStats.reduce((sum: number, w: any) => sum + parseFloat(w.pay), 0))
                                            : '₹0.00'
                                        }
                                    </p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">Per-meter wages today</p>
                            </div>
                            <div className="p-2 bg-indigo-50 rounded-lg">
                                <IndianRupee className="h-5 w-5 text-indigo-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fixed Payroll</p>
                                {!fixedPayroll ? (
                                    <Skeleton className="h-9 w-28 mt-2" />
                                ) : (
                                    <p className="text-3xl font-bold text-gray-900 mt-1">
                                        {formatINR(fixedPayroll.total)}
                                    </p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                    {fixedPayroll ? `${fixedPayroll.fixedCount} salaried + ${fixedPayroll.dailyCount} daily` : ''}
                                </p>
                            </div>
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <Users2 className="h-5 w-5 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-6">
                {/* Worker Breakdown */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <HardHat className="h-5 w-5 text-indigo-600" />
                                <CardTitle className="text-lg">Worker Breakdown</CardTitle>
                            </div>
                            <CardDescription className="mt-0">
                                {new Date(selectedDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {workersLoading ? (
                            <div className="space-y-3">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="flex justify-between items-center py-3">
                                        <Skeleton className="h-5 w-32" />
                                        <Skeleton className="h-5 w-24" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <>
                                {workerStats && workerStats.length > 0 && (
                                    <div className="flex justify-between items-center text-xs font-medium text-gray-400 uppercase tracking-wider px-2 pb-2 border-b mb-1">
                                        <span className="pl-6">Worker</span>
                                        <span>Output / Pay</span>
                                    </div>
                                )}
                                <div className="space-y-0.5">
                                    {workerStats?.map((worker: WorkerStats) => (
                                        <WorkerRow key={worker.id} worker={worker} />
                                    ))}
                                    {workerStats && workerStats.length === 0 && (
                                        <div className="py-12 text-center border-2 border-dashed rounded-xl">
                                            <HardHat className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                                            <p className="text-gray-500 font-medium">No production logged</p>
                                            <p className="text-sm text-gray-400 mt-1">Workers will appear here once production is logged for this date</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Fixed Workers */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <Briefcase className="h-5 w-5 text-blue-600" />
                            <CardTitle className="text-lg">Fixed Workers</CardTitle>
                        </div>
                        <CardDescription>
                            Salaried staff — click the pencil to edit pay
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {!fixedWorkersList ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex justify-between items-center py-4">
                                        <div className="flex items-center gap-3">
                                            <Skeleton className="h-5 w-16 rounded-full" />
                                            <Skeleton className="h-5 w-32" />
                                        </div>
                                        <Skeleton className="h-5 w-24" />
                                    </div>
                                ))}
                            </div>
                        ) : fixedWorkersList.length === 0 ? (
                            <div className="py-12 text-center border-2 border-dashed rounded-xl">
                                <Briefcase className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                                <p className="text-gray-500 font-medium">No fixed workers yet</p>
                                <p className="text-sm text-gray-400 mt-1">Use &quot;Add Worker&quot; → Fixed Salary to add</p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {fixedWorkersList.map(fw => (
                                    <FixedWorkerRow
                                        key={fw.id}
                                        worker={fw}
                                        onSalaryUpdate={handleFixedSalaryUpdate}
                                    />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
