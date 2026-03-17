'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { formatINR } from '@/lib/finance'
import {
    CheckCircle2, Circle, ChevronLeft, ChevronRight,
    HardHat, Briefcase, AlertCircle, IndianRupee
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toggleWorkerPaid } from './actions'
import { useUserProfile } from '@/hooks/use-user-profile'

// ─── Types ───────────────────────────────────────────────────────────────────
interface PaymentRecord {
    id?: number
    worker_type: 'meter' | 'fixed'
    meter_worker_id?: number
    fixed_worker_id?: number
    month: string
    amount: number
    paid: boolean
    paid_at?: string
}

interface MeterWorkerPayroll {
    id: number
    name: string
    machines: { machineName: string; meters: number; rate: number; pay: number }[]
    totalMeters: number
    totalPay: number
    payment?: PaymentRecord
}

interface FixedWorkerPayroll {
    id: number
    name: string
    role: string
    monthly_salary: number
    daysWorked?: number       // only for 'daily' role
    earnedPay: number
    payment?: PaymentRecord
}

const ROLE_LABELS: Record<string, string> = {
    master: 'Master', supervisor: 'Supervisor', helper: 'Helper',
    mender: 'Mender', sanitation: 'Sanitation', daily: 'Day-to-Day',
}
const ROLE_COLORS: Record<string, string> = {
    master: 'bg-purple-100 text-purple-700', supervisor: 'bg-blue-100 text-blue-700',
    helper: 'bg-amber-100 text-amber-700', mender: 'bg-teal-100 text-teal-700',
    sanitation: 'bg-green-100 text-green-700', daily: 'bg-orange-100 text-orange-700',
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function monthLabel(ym: string) {
    const [y, m] = ym.split('-')
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}
function prevMonth(ym: string) {
    const d = new Date(ym + '-01')
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().substring(0, 7)
}
function nextMonth(ym: string) {
    const d = new Date(ym + '-01')
    d.setMonth(d.getMonth() + 1)
    return d.toISOString().substring(0, 7)
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function PaidBadge({ paid, paidAt }: { paid: boolean; paidAt?: string }) {
    if (paid) {
        return (
            <div className="flex items-center gap-1.5 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">
                    Paid {paidAt ? new Date(paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                </span>
            </div>
        )
    }
    return (
        <div className="flex items-center gap-1.5 text-amber-600">
            <Circle className="h-4 w-4" />
            <span className="text-xs font-medium">Pending</span>
        </div>
    )
}

function MeterWorkerRow({
    worker,
    onToggle,
}: {
    worker: MeterWorkerPayroll
    onToggle: () => void
}) {
    const [expanded, setExpanded] = useState(false)
    const isPaid = worker.payment?.paid ?? false

    return (
        <div className={cn(
            'border rounded-xl overflow-hidden transition-colors',
            isPaid ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white'
        )}>
            <div className="flex items-center justify-between p-4">
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="flex items-center gap-3 text-left flex-1 min-w-0"
                >
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {worker.name[0]}
                    </div>
                    <div className="min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{worker.name}</div>
                        <div className="text-xs text-gray-500">
                            {worker.totalMeters.toFixed(1)} m across {worker.machines.length} machine{worker.machines.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                </button>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <div className="text-right">
                        <div className="font-bold text-gray-900">{formatINR(worker.totalPay)}</div>
                        <PaidBadge paid={isPaid} paidAt={worker.payment?.paid_at} />
                    </div>
                    <Button
                        size="sm"
                        variant={isPaid ? 'outline' : 'default'}
                        className={cn('h-8 text-xs', isPaid && 'border-green-300 text-green-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600')}
                        onClick={onToggle}
                    >
                        {isPaid ? 'Unmark' : 'Mark Paid'}
                    </Button>
                </div>
            </div>

            {expanded && worker.machines.length > 0 && (
                <div className="border-t bg-gray-50 px-4 py-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Calculation Breakdown</p>
                    <div className="space-y-1.5">
                        {worker.machines.map((m, i) => (
                            <div key={i} className="flex justify-between text-sm">
                                <span className="text-gray-600">{m.machineName}</span>
                                <span className="text-gray-500 text-xs">
                                    {m.meters.toFixed(1)} m × ₹{m.rate}/m
                                    <span className="text-gray-800 font-medium ml-2">= {formatINR(m.pay)}</span>
                                </span>
                            </div>
                        ))}
                        <div className="flex justify-between text-sm font-semibold border-t pt-1.5 mt-1">
                            <span>Total</span>
                            <span>{formatINR(worker.totalPay)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function FixedWorkerRow({
    worker,
    onToggle,
}: {
    worker: FixedWorkerPayroll
    onToggle: () => void
}) {
    const [expanded, setExpanded] = useState(false)
    const isPaid = worker.payment?.paid ?? false
    const isDaily = worker.role === 'daily'

    return (
        <div className={cn(
            'border rounded-xl overflow-hidden transition-colors',
            isPaid ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white'
        )}>
            <div className="flex items-center justify-between p-4">
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="flex items-center gap-3 text-left flex-1 min-w-0"
                >
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0', ROLE_COLORS[worker.role] || 'bg-gray-100 text-gray-700')}>
                        {ROLE_LABELS[worker.role] || worker.role}
                    </span>
                    <span className="font-semibold text-gray-900 truncate">{worker.name}</span>
                </button>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <div className="text-right">
                        <div className="font-bold text-gray-900">{formatINR(worker.earnedPay)}</div>
                        <PaidBadge paid={isPaid} paidAt={worker.payment?.paid_at} />
                    </div>
                    <Button
                        size="sm"
                        variant={isPaid ? 'outline' : 'default'}
                        className={cn('h-8 text-xs', isPaid && 'border-green-300 text-green-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600')}
                        onClick={onToggle}
                    >
                        {isPaid ? 'Unmark' : 'Mark Paid'}
                    </Button>
                </div>
            </div>

            {expanded && (
                <div className="border-t bg-gray-50 px-4 py-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Calculation</p>
                    {isDaily ? (
                        <div className="text-sm text-gray-600 space-y-1">
                            <div className="flex justify-between">
                                <span>Monthly salary</span>
                                <span>{formatINR(worker.monthly_salary)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Days worked</span>
                                <span>{worker.daysWorked ?? 0} / 30</span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>Formula</span>
                                <span>₹{worker.monthly_salary.toLocaleString()} ÷ 30 × {worker.daysWorked ?? 0} days</span>
                            </div>
                            <div className="flex justify-between font-semibold border-t pt-1.5 mt-1">
                                <span>Earned this month</span>
                                <span>{formatINR(worker.earnedPay)}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-gray-600 flex justify-between">
                            <span>Full monthly salary</span>
                            <span className="font-semibold">{formatINR(worker.monthly_salary)}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PayrollPage() {
    const supabase = createClient()
    const queryClient = useQueryClient()
    const [activeTab, setActiveTab] = useState<'meter' | 'fixed'>('meter')
    const [selectedMonth, setSelectedMonth] = useState('')

    useEffect(() => {
        setSelectedMonth(new Date().toISOString().substring(0, 7))
    }, [])

    const { data: userProfile } = useUserProfile()

    // ── Meter workers payroll data ──────────────────────────────────────────
    const { data: meterWorkers, isLoading: meterLoading } = useQuery({
        queryKey: ['payroll_meter', userProfile?.org_id, selectedMonth],
        enabled: !!userProfile?.org_id && !!selectedMonth,
        queryFn: async () => {
            const monthStart = `${selectedMonth}-01`
            const monthEnd = `${selectedMonth}-31`

            // Fetch production logs for the month
            const { data: logs, error: logsErr } = await supabase
                .from('production_logs')
                .select('worker_id, machine_id, meters')
                .eq('org_id', userProfile!.org_id)
                .gte('date', monthStart)
                .lte('date', monthEnd)
            if (logsErr) throw logsErr

            // Fetch workers
            const { data: workers, error: wErr } = await supabase
                .from('workers')
                .select('id, name')
                .eq('org_id', userProfile!.org_id)
                .eq('is_active', true)
            if (wErr) throw wErr

            // Fetch machines (for rates + names)
            const { data: machines, error: mErr } = await supabase
                .from('machines')
                .select('id, name, rate_per_meter')
                .eq('org_id', userProfile!.org_id)
            if (mErr) throw mErr

            // Fetch payment records for this month
            const { data: payments } = await supabase
                .from('payroll_payments')
                .select('*')
                .eq('org_id', userProfile!.org_id)
                .eq('worker_type', 'meter')
                .eq('month', selectedMonth)

            const machineMap = Object.fromEntries((machines || []).map((m: any) => [m.id, m]))
            const paymentMap = Object.fromEntries((payments || []).map((p: any) => [p.meter_worker_id, p]))

            // Group logs by worker → machine
            const result: MeterWorkerPayroll[] = []
            for (const worker of (workers || [])) {
                const workerLogs = (logs || []).filter((l: any) => l.worker_id === worker.id)
                if (workerLogs.length === 0) continue

                // Group by machine
                const machineGroups: Record<string, { meters: number; rate: number; name: string }> = {}
                for (const log of workerLogs) {
                    const machine = machineMap[log.machine_id]
                    if (!machineGroups[log.machine_id]) {
                        machineGroups[log.machine_id] = { meters: 0, rate: machine?.rate_per_meter || 0, name: machine?.name || 'Unknown' }
                    }
                    machineGroups[log.machine_id].meters += parseFloat(log.meters) || 0
                }

                const machineBreakdown = Object.values(machineGroups).map(mg => ({
                    machineName: mg.name,
                    meters: mg.meters,
                    rate: mg.rate,
                    pay: mg.meters * mg.rate,
                }))

                const totalMeters = machineBreakdown.reduce((s: number, m: { meters: number }) => s + m.meters, 0)
                const totalPay = machineBreakdown.reduce((s: number, m: { pay: number }) => s + m.pay, 0)

                result.push({
                    id: worker.id,
                    name: worker.name,
                    machines: machineBreakdown,
                    totalMeters,
                    totalPay,
                    payment: paymentMap[worker.id],
                })
            }

            return result.sort((a, b) => b.totalPay - a.totalPay)
        }
    })

    // ── Fixed workers payroll data ──────────────────────────────────────────
    const { data: fixedWorkers, isLoading: fixedLoading } = useQuery({
        queryKey: ['payroll_fixed', userProfile?.org_id, selectedMonth],
        enabled: !!userProfile?.org_id && !!selectedMonth,
        queryFn: async () => {
            const { data: workers, error } = await supabase
                .from('fixed_workers')
                .select('*')
                .eq('org_id', userProfile!.org_id)
                .eq('is_active', true)
                .order('role').order('name')
            if (error) throw error

            // Attendance for daily workers
            const dailyIds = (workers || []).filter((w: any) => w.role === 'daily').map((w: any) => w.id)
            let attendanceMap: Record<number, number> = {}
            if (dailyIds.length > 0) {
                const { data: att } = await supabase
                    .from('attendance')
                    .select('fixed_worker_id, present')
                    .eq('org_id', userProfile!.org_id)
                    .in('fixed_worker_id', dailyIds)
                    .gte('date', `${selectedMonth}-01`)
                    .lte('date', `${selectedMonth}-31`)
                    .eq('present', true)
                    ; (att || []).forEach((a: any) => {
                        attendanceMap[a.fixed_worker_id] = (attendanceMap[a.fixed_worker_id] || 0) + 1
                    })
            }

            // Payment records
            const { data: payments } = await supabase
                .from('payroll_payments')
                .select('*')
                .eq('org_id', userProfile!.org_id)
                .eq('worker_type', 'fixed')
                .eq('month', selectedMonth)
            const paymentMap = Object.fromEntries((payments || []).map((p: any) => [p.fixed_worker_id, p]))

            return (workers || []).map((w: any) => {
                const daysWorked = w.role === 'daily' ? (attendanceMap[w.id] || 0) : undefined
                const earnedPay = w.role === 'daily'
                    ? Math.min(w.monthly_salary, (w.monthly_salary / 30) * (daysWorked ?? 0))
                    : w.monthly_salary
                return {
                    id: w.id,
                    name: w.name,
                    role: w.role,
                    monthly_salary: w.monthly_salary,
                    daysWorked,
                    earnedPay,
                    payment: paymentMap[w.id],
                } as FixedWorkerPayroll
            })
        }
    })

    // ── Toggle paid ─────────────────────────────────────────────────────────
    const handleTogglePaid = async (workerType: 'meter' | 'fixed', workerId: number, amount: number, currentPaid: boolean) => {
        try {
            const result = await toggleWorkerPaid(workerType, workerId, selectedMonth, currentPaid)

            toast.success(result.success ? '✓ Payroll updated successfully' : 'Updated')
            queryClient.invalidateQueries({ queryKey: ['payroll_meter'] })
            queryClient.invalidateQueries({ queryKey: ['payroll_fixed'] })
        } catch (error: any) {
            toast.error(error.message || 'Failed to update payroll')
        }
    }

    // ── Summary stats ───────────────────────────────────────────────────────
    const summary = useMemo(() => {
        const meterTotal = (meterWorkers || []).reduce((s: number, w: any) => s + w.totalPay, 0)
        const fixedTotal = (fixedWorkers || []).reduce((s: number, w: any) => s + w.earnedPay, 0)
        const meterPaid = (meterWorkers || []).filter((w: any) => w.payment?.paid).reduce((s: number, w: any) => s + w.totalPay, 0)
        const fixedPaid = (fixedWorkers || []).filter((w: any) => w.payment?.paid).reduce((s: number, w: any) => s + w.earnedPay, 0)
        const total = meterTotal + fixedTotal
        const paid = meterPaid + fixedPaid
        return { total, paid, outstanding: total - paid }
    }, [meterWorkers, fixedWorkers])

    if (!selectedMonth) return null

    return (
        <div className="p-4 md:p-6 space-y-6 pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Monthly Payroll</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Track and settle worker payments</p>
                </div>
                {/* Month navigator */}
                <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5 self-start sm:self-auto">
                    <button
                        onClick={() => setSelectedMonth(prevMonth(selectedMonth))}
                        className="p-1 hover:bg-gray-100 rounded"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-semibold text-gray-700 min-w-[140px] text-center">
                        {monthLabel(selectedMonth)}
                    </span>
                    <button
                        onClick={() => setSelectedMonth(nextMonth(selectedMonth))}
                        disabled={selectedMonth >= new Date().toISOString().substring(0, 7)}
                        className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
                <Card className="text-center">
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs text-gray-500 mb-1">Total Owed</div>
                        <div className="text-lg font-bold text-gray-900">{formatINR(summary.total)}</div>
                    </CardContent>
                </Card>
                <Card className="text-center border-green-200">
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs text-gray-500 mb-1">Paid</div>
                        <div className="text-lg font-bold text-green-700">{formatINR(summary.paid)}</div>
                    </CardContent>
                </Card>
                <Card className="text-center border-amber-200">
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs text-gray-500 mb-1">Outstanding</div>
                        <div className="text-lg font-bold text-amber-700">{formatINR(summary.outstanding)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Progress bar */}
            {summary.total > 0 && (
                <div className="space-y-1.5">
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-green-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, (summary.paid / summary.total) * 100)}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-400 text-right">
                        {Math.round((summary.paid / summary.total) * 100)}% settled
                    </p>
                </div>
            )}

            {/* Tabs */}
            <div className="flex rounded-lg border bg-white overflow-hidden">
                <button
                    className={cn(
                        'flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors',
                        activeTab === 'meter' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                    )}
                    onClick={() => setActiveTab('meter')}
                >
                    <HardHat className="h-4 w-4" />
                    Meter Workers
                    {meterWorkers && (
                        <span className={cn(
                            'text-xs px-1.5 py-0.5 rounded-full',
                            activeTab === 'meter' ? 'bg-white/20' : 'bg-gray-100'
                        )}>
                            {meterWorkers.filter(w => !w.payment?.paid).length} pending
                        </span>
                    )}
                </button>
                <button
                    className={cn(
                        'flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-l',
                        activeTab === 'fixed' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                    )}
                    onClick={() => setActiveTab('fixed')}
                >
                    <Briefcase className="h-4 w-4" />
                    Fixed Workers
                    {fixedWorkers && (
                        <span className={cn(
                            'text-xs px-1.5 py-0.5 rounded-full',
                            activeTab === 'fixed' ? 'bg-white/20' : 'bg-gray-100'
                        )}>
                            {fixedWorkers.filter((w: any) => !w.payment?.paid).length} pending
                        </span>
                    )}
                </button>
            </div>

            {/* ── Meter Workers Tab ── */}
            {activeTab === 'meter' && (
                <div className="space-y-3">
                    {meterLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="border rounded-xl p-4 bg-white">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse" />
                                            <div className="space-y-2">
                                                <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                                                <div className="h-3 w-32 bg-gray-50 rounded animate-pulse" />
                                            </div>
                                        </div>
                                        <div className="h-8 w-20 bg-gray-100 rounded animate-pulse" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : !meterWorkers || meterWorkers.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <AlertCircle className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                                <p className="text-gray-500 font-medium">No production logged this month</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <p className="text-xs text-gray-400">
                                Tap a row to see calculation breakdown
                            </p>
                            {meterWorkers.map(w => (
                                <MeterWorkerRow
                                    key={w.id}
                                    worker={w}
                                    onToggle={() => handleTogglePaid('meter', w.id, w.totalPay, w.payment?.paid ?? false)}
                                />
                            ))}
                        </>
                    )}
                </div>
            )}

            {/* ── Fixed Workers Tab ── */}
            {activeTab === 'fixed' && (
                <div className="space-y-3">
                    {fixedLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="border rounded-xl p-4 bg-white">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="w-16 h-5 rounded-full bg-gray-100 animate-pulse" />
                                            <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                                        </div>
                                        <div className="h-8 w-20 bg-gray-100 rounded animate-pulse" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : !fixedWorkers || fixedWorkers.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <AlertCircle className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                                <p className="text-gray-500 font-medium">No fixed workers found</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <p className="text-xs text-gray-400">
                                Tap a row to see calculation. Day-to-Day pay is based on attendance.
                            </p>
                            {fixedWorkers.map((w: any) => (
                                <FixedWorkerRow
                                    key={w.id}
                                    worker={w}
                                    onToggle={() => handleTogglePaid('fixed', w.id, w.earnedPay, w.payment?.paid ?? false)}
                                />
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
