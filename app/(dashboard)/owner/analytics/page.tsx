'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sumMeters, calculateTotalPay, formatINR } from '@/lib/finance'
import { toast } from 'sonner'
import { AddWorkerDialog } from '@/components/AddWorkerDialog'
import { Calendar as CalendarIcon, RotateCcw, ChevronDown, ChevronRight, HardHat, Briefcase, Pencil, Check, X, TrendingUp, IndianRupee, Users2, Activity, AlertTriangle, Plus, LayoutGrid, ListFilter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUserProfile } from '@/hooks/use-user-profile'
import { Skeleton } from '@/components/ui/skeleton'
import { OrderCard } from '@/components/OrderCard'
import { upsertOrder } from '@/app/(dashboard)/owner/actions'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

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

    const [selectedDate, setSelectedDate] = useState<string>('')
    const { data: userProfile } = useUserProfile()

    const [orderDialogOpen, setOrderDialogOpen] = useState(false)
    const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
    const [editingOrder, setEditingOrder] = useState<any>(null)

    useEffect(() => {
        setSelectedDate(new Date().toISOString().split('T')[0])
    }, [])

    useEffect(() => {
        if (!userProfile?.org_id || !selectedDate) return

        const channel = supabase.channel('production_logs_changes_dashboard')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'production_logs',
                    filter: `org_id=eq.${userProfile.org_id}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['production_daily_total'] })
                    queryClient.invalidateQueries({ queryKey: ['production_worker_stats'] })
                    queryClient.invalidateQueries({ queryKey: ['order_progress_summary'] })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [supabase, queryClient, userProfile?.org_id, selectedDate])

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

    const { data: workerStats, isLoading: workersLoading } = useQuery({
        queryKey: ['production_worker_stats', userProfile?.org_id, selectedDate],
        enabled: !!userProfile?.org_id && !!selectedDate,
        queryFn: async () => {
            const { data: workers, error: wErr } = await supabase
                .from('workers')
                .select('id, name, is_active')
                .eq('org_id', userProfile!.org_id)
                .order('name')
            if (wErr) throw wErr

            const { data: machines, error: mErr } = await supabase
                .from('machines')
                .select('id, name, rate_per_meter')
                .eq('org_id', userProfile!.org_id)
            if (mErr) throw mErr

            const machineMap = (machines || []).reduce((acc: any, m: any) => {
                acc[m.id] = { name: m.name, rate: m.rate_per_meter }
                return acc
            }, {})

            const { data: logs, error: lErr } = await supabase
                .from('production_logs')
                .select('worker_id, machine_id, meters')
                .eq('org_id', userProfile!.org_id)
                .eq('date', selectedDate)
            if (lErr) throw lErr

            return workers.map((worker: Worker) => {
                const workerLogs = (logs as ProductionLog[]).filter(l => l.worker_id === worker.id)
                const totalMeters = sumMeters(workerLogs)

                const machineGroups: Record<string, number> = {}
                workerLogs.forEach(log => {
                    const logMeters = typeof log.meters === 'string' ? parseFloat(log.meters) : log.meters
                    machineGroups[log.machine_id] = (machineGroups[log.machine_id] || 0) + (logMeters || 0)
                })

                const breakdown: MachineBreakdown[] = Object.entries(machineGroups).map(([machineId, meters]) => {
                    const machine = machineMap[machineId]
                    const pay = calculateTotalPay([{ meters, rate: machine?.rate || 0 }])
                    return {
                        machineName: machine?.name || 'Unknown',
                        meters: meters.toFixed(2),
                        pay
                    }
                })

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

    const { data: fixedPayroll } = useQuery({
        queryKey: ['fixed_payroll_dashboard', userProfile?.org_id, selectedDate],
        enabled: !!userProfile?.org_id && !!selectedDate,
        queryFn: async () => {
            const { data: fixedWorkers, error: fErr } = await supabase
                .from('fixed_workers')
                .select('id, name, role, monthly_salary')
                .eq('org_id', userProfile!.org_id)
                .eq('is_active', true)
            if (fErr) throw fErr

            const month = selectedDate.substring(0, 7)
            const { data: attendance } = await supabase
                .from('attendance')
                .select('fixed_worker_id, present')
                .eq('org_id', userProfile!.org_id)
                .gte('date', `${month}-01`)
                .lte('date', `${month}-31`)

            let totalFixed = 0
            let totalDaily = 0

            for (const w of (fixedWorkers || [])) {
                if (w.role === 'daily') {
                    const daysPresent = (attendance || []).filter(
                        (a: any) => a.fixed_worker_id === w.id && a.present
                    ).length
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

    const { data: fixedWorkersList } = useQuery({
        queryKey: ['fixed_workers_list_dashboard', userProfile?.org_id, selectedDate],
        enabled: !!userProfile?.org_id && !!selectedDate,
        queryFn: async () => {
            const { data: workers, error } = await supabase
                .from('fixed_workers')
                .select('*')
                .eq('org_id', userProfile!.org_id)
                .eq('is_active', true)
                .order('role')
            if (error) throw error

            const month = selectedDate.substring(0, 7)
            const dailyWorkerIds = (workers || []).filter((w: any) => w.role === 'daily').map((w: any) => w.id)

            let attendanceMap: Record<number, number> = {}
            if (dailyWorkerIds.length > 0) {
                const { data: attendance } = await supabase
                    .from('attendance')
                    .select('fixed_worker_id')
                    .in('fixed_worker_id', dailyWorkerIds)
                    .eq('present', true)
                    .gte('date', `${month}-01`)
                    .lte('date', `${month}-31`);
                (attendance || []).forEach((a: any) => {
                    attendanceMap[a.fixed_worker_id] = (attendanceMap[a.fixed_worker_id] || 0) + 1
                })
            }

            return (workers || []).map((w: any) => ({
                ...w,
                daysWorked: attendanceMap[w.id] || 0,
                earnedPay: w.role === 'daily' ? Math.min(w.monthly_salary, (w.monthly_salary / 30) * (attendanceMap[w.id] || 0)) : undefined
            }))
        }
    })

    const { data: yieldAnalytics, isLoading: yieldLoading } = useQuery({
        queryKey: ['yield_analytics_dashboard', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_batch_yield_report', { p_org_id: userProfile!.org_id })
            if (error) throw error
            
            const activeOrRecent = (data || []).filter((b: any) => b.batch_status === 'active' || b.total_meters_produced > 0)
            let totalLoss = 0, alertCount = 0, avgEfficiency = 0, count = 0
            
            activeOrRecent.forEach((b: any) => {
                const v = Number(b.efficiency_variance)
                if (!isNaN(v)) {
                    avgEfficiency += v
                    count++
                    if (v < -5) { alertCount++; totalLoss += Number(b.monetary_loss || 0) }
                }
            })
            return {
                avgEfficiency: count > 0 ? (avgEfficiency / count).toFixed(1) : null,
                alertCount,
                totalLoss
            }
        }
    })

    const { data: ordersSummary, isLoading: ordersLoading } = useQuery({
        queryKey: ['order_progress_summary', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('order_progress_summary')
                .select('*')
                .eq('org_id', userProfile!.org_id)
                .order('deadline', { ascending: true })
            if (error) throw error
            return data
        }
    })

    const { data: orderForecasts } = useQuery({
        queryKey: ['order_forecasts', ordersSummary?.map((o: any) => o.order_id)],
        enabled: !!ordersSummary && ordersSummary.length > 0,
        queryFn: async () => {
            const forecasts: Record<string, any> = {}
            if (!ordersSummary) return forecasts
            for (const order of ordersSummary) {
                const { data, error } = await supabase.rpc('get_order_forecast', { p_order_id: order.order_id })
                if (!error && data && data[0]) forecasts[order.order_id] = data[0]
            }
            return forecasts
        }
    })

    const { data: qualities } = useQuery({
        queryKey: ['qualities_dashboard', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('qualities')
                .select('id, name')
                .eq('org_id', userProfile!.org_id)
            if (error) throw error
            return data
        }
    })

    const handleWorkerAdded = () => {
        queryClient.invalidateQueries({ queryKey: ['production_worker_stats'] })
        queryClient.invalidateQueries({ queryKey: ['fixed_workers_list_dashboard'] })
    }

    const handleFixedSalaryUpdate = async (workerId: number, salary: number) => {
        const { error } = await supabase.from('fixed_workers').update({ monthly_salary: salary }).eq('id', workerId)
        if (error) toast.error(error.message)
        else {
            toast.success('Salary updated')
            queryClient.invalidateQueries({ queryKey: ['fixed_workers_list_dashboard'] })
        }
    }

    const handleUpsertOrder = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        setIsSubmittingOrder(true)
        try {
            const res = await upsertOrder({
                id: editingOrder?.order_id,
                party_name: formData.get('party_name') as string,
                quality_id: formData.get('quality_id') as string,
                total_target_meters: Number(formData.get('total_target_meters')),
                start_date: formData.get('start_date') as string,
                deadline: formData.get('deadline') as string,
                status: 'active'
            })
            if (res.error) throw new Error(res.error)
            toast.success(editingOrder ? "Order updated" : "Order created")
            setOrderDialogOpen(false)
            setEditingOrder(null)
            queryClient.invalidateQueries({ queryKey: ['order_progress_summary'] })
        } catch (err: any) { toast.error(err.message) }
        finally { setIsSubmittingOrder(false) }
    }

    if (!selectedDate) return null

    return (
        <div className="space-y-8 pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                {userProfile?.org_id && (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white rounded-lg border p-1 shadow-sm">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} className="h-8 px-2 text-xs font-medium text-gray-600">
                                <RotateCcw className="h-3 w-3 mr-1" /> Today
                            </Button>
                            <div className="h-4 w-px bg-gray-200" />
                            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="h-8 w-auto border-0 focus-visible:ring-0 px-2 py-0 text-sm font-medium" />
                        </div>
                        
                        <div className="flex items-center gap-2 border-l pl-3">
                            <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="h-9 px-3 bg-teal-600 hover:bg-teal-700 text-white shadow-sm font-semibold" onClick={() => setEditingOrder(null)}>
                                        <Plus className="h-4 w-4 mr-1.5" /> Order
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[450px]">
                                    <form onSubmit={handleUpsertOrder} className="space-y-5">
                                        <DialogHeader>
                                            <DialogTitle>{editingOrder ? 'Edit Order' : 'Create New Order'}</DialogTitle>
                                            <DialogDescription>Track targets and forecasts for your clients.</DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="party_name">Party Name</Label>
                                                <Input id="party_name" name="party_name" defaultValue={editingOrder?.party_name} required placeholder="e.g., Sundaram Textiles" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Quality</Label>
                                                    <Select name="quality_id" defaultValue={editingOrder?.quality_id} required>
                                                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                                        <SelectContent>
                                                            {qualities?.map((q: any) => <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="total_target_meters">Target (m)</Label>
                                                    <Input id="total_target_meters" name="total_target_meters" type="number" defaultValue={editingOrder?.total_target_meters} required />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="start_date">Start Date</Label>
                                                    <Input id="start_date" name="start_date" type="date" defaultValue={editingOrder?.start_date || new Date().toISOString().split('T')[0]} required />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="deadline">Deadline</Label>
                                                    <Input id="deadline" name="deadline" type="date" defaultValue={editingOrder?.deadline} required />
                                                </div>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button type="submit" disabled={isSubmittingOrder} className="w-full bg-teal-600 hover:bg-teal-700">
                                                {isSubmittingOrder ? 'Saving...' : editingOrder ? 'Update Order' : 'Launch Order'}
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                            <AddWorkerDialog orgId={userProfile.org_id} onWorkerAdded={handleWorkerAdded} />
                        </div>
                    </div>
                )}
            </div>

            {/* Live Orders Group */}
            <div className="space-y-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <LayoutGrid className="h-5 w-5 text-teal-600" />
                        <h2 className="text-xl font-bold">Live Orders</h2>
                        {ordersSummary && ordersSummary.length > 0 && (
                            <Badge variant="secondary" className="bg-teal-50 text-teal-600 border-teal-100">{ordersSummary.length} Active</Badge>
                        )}
                    </div>
                </div>

                {ordersLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
                    </div>
                ) : !ordersSummary || ordersSummary.length === 0 ? (
                    <div className="py-12 text-center border-2 border-dashed rounded-xl bg-gray-50/50 border-gray-200">
                        <div className="bg-white p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                            <Plus className="h-8 w-8 text-teal-500" />
                        </div>
                        <p className="text-gray-900 font-bold text-lg">No active orders found</p>
                        <p className="text-sm text-gray-500 mt-1 mb-6 max-w-xs mx-auto">Start tracking client targets, daily pace, and predicted finish dates.</p>
                        <Button 
                            onClick={() => { setEditingOrder(null); setOrderDialogOpen(true); }}
                            className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-8 shadow-lg shadow-teal-100"
                        >
                            <Plus className="h-4 w-4 mr-2" /> Create First Order
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ordersSummary.map((order: any) => (
                            <div key={order.order_id} className="cursor-pointer" onClick={() => { setEditingOrder(order); setOrderDialogOpen(true); }}>
                                <OrderCard order={order} forecast={orderForecasts?.[order.order_id]} />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-l-4 border-l-emerald-500 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Daily Output</p>
                                <p className="text-3xl font-black text-gray-900">{isLoading ? '...' : dailyTotal + ' m'}</p>
                            </div>
                            <div className="p-2 bg-emerald-50 rounded-lg"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-indigo-500 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Wages Today</p>
                                <p className="text-3xl font-black text-gray-900">
                                    {workersLoading ? '...' : formatINR(workerStats?.reduce((s: number, w: any) => s + parseFloat(w.pay), 0) || 0)}
                                </p>
                            </div>
                            <div className="p-2 bg-indigo-50 rounded-lg"><IndianRupee className="h-5 w-5 text-indigo-600" /></div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Fixed Payroll</p>
                                <p className="text-3xl font-black text-gray-900">{!fixedPayroll ? '...' : formatINR(fixedPayroll.total)}</p>
                            </div>
                            <div className="p-2 bg-blue-50 rounded-lg"><Users2 className="h-5 w-5 text-blue-600" /></div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Efficiency Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-indigo-600" /><CardTitle className="text-lg">Efficiency</CardTitle></div>
                    </CardHeader>
                    <CardContent>
                        {yieldLoading ? <Skeleton className="h-10 w-24" /> : yieldAnalytics?.avgEfficiency ? (
                            <div className="flex items-baseline gap-2">
                                <span className={cn("text-4xl font-black", Number(yieldAnalytics.avgEfficiency) < 0 ? "text-red-500" : "text-teal-600")}>
                                    {Number(yieldAnalytics.avgEfficiency) > 0 ? '+' : ''}{yieldAnalytics.avgEfficiency}%
                                </span>
                                <span className="text-xs font-bold text-gray-400 uppercase">Variance</span>
                            </div>
                        ) : <p className="text-sm text-gray-400">No data available</p>}
                    </CardContent>
                </Card>
                <Card className={cn("shadow-sm", yieldAnalytics?.alertCount ? "bg-red-50 border-red-100" : "")}>
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2"><AlertTriangle className={cn("h-5 w-5", yieldAnalytics?.alertCount ? "text-red-600" : "text-gray-400")} /><CardTitle className="text-lg">Leakage Alerts</CardTitle></div>
                    </CardHeader>
                    <CardContent>
                        {yieldLoading ? <Skeleton className="h-10 w-full" /> : yieldAnalytics?.alertCount ? (
                            <div className="space-y-0.5">
                                <p className="text-2xl font-black text-red-600">{formatINR(yieldAnalytics.totalLoss)}</p>
                                <p className="text-xs font-bold text-red-800 uppercase">{yieldAnalytics.alertCount} High Leakage Batches</p>
                            </div>
                        ) : <p className="text-sm text-emerald-600 font-medium pb-2">All batches within target</p>}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <Card className="shadow-sm">
                    <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-2"><HardHat className="h-5 w-5 text-indigo-600" /><CardTitle className="text-lg">Worker Details</CardTitle></div>
                        <p className="text-xs font-bold text-gray-400">{new Date(selectedDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</p>
                    </CardHeader>
                    <CardContent>
                        {workersLoading ? <Skeleton className="h-40 w-full" /> : workerStats?.length ? (
                            <div className="space-y-1">
                                {workerStats.map((w: any) => <WorkerRow key={w.id} worker={w} />)}
                            </div>
                        ) : <div className="py-10 text-center text-gray-400">No production logs</div>}
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="pb-3"><div className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-blue-600" /><CardTitle className="text-lg">Staff Payroll</CardTitle></div></CardHeader>
                    <CardContent>
                        {fixedWorkersList?.length ? (
                            <div className="divide-y">
                                {fixedWorkersList.map((fw: any) => <FixedWorkerRow key={fw.id} worker={fw as any} onSalaryUpdate={handleFixedSalaryUpdate} />)}
                            </div>
                        ) : <div className="py-10 text-center text-gray-400">No staff found</div>}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
