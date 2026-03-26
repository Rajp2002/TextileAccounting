'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { formatINR, sumAdvances, calculateNetPay, calculateRemainingDebt } from '@/lib/finance'
import {
    CheckCircle2, Circle, ChevronLeft, ChevronRight,
    HardHat, Briefcase, AlertCircle, IndianRupee, Loader2, HandCoins, Download, AlertTriangle
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toggleWorkerPaid } from './actions'
import { useTranslation } from '@/lib/i18n/context'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useTransliterate } from '@/hooks/use-transliterate'
import { useMutation } from '@tanstack/react-query'
import { generateMeterPayslip, generateFixedPayslip } from '@/lib/generate-payslip'
import { MIN_WAGE_DAILY, isBelowMinWage } from '@/lib/wage-config'

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
    totalPay: number       // gross pay
    totalAdvances: number  // pending advance sum
    netPay: number         // max(0, gross - advances)
    remainingDebt: number  // leftover debt if advances > gross
    payment?: PaymentRecord
}

interface FixedWorkerPayroll {
    id: number
    name: string
    role: string
    monthly_salary: number
    daysWorked?: number       // only for 'daily' role
    earnedPay: number         // gross pay
    totalAdvances: number     // pending advance sum
    netPay: number            // max(0, gross - advances)
    remainingDebt: number     // leftover debt if advances > gross
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
    const { t } = useTranslation()
    if (paid) {
        return (
            <div className="flex items-center gap-1.5 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">
                    {t('payroll.status.paid')} {paidAt ? new Date(paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                </span>
            </div>
        )
    }
    return (
        <div className="flex items-center gap-1.5 text-amber-600">
            <Circle className="h-4 w-4" />
            <span className="text-xs font-medium">{t('payroll.status.pending')}</span>
        </div>
    )
}
function MeterWorkerRow({
    worker,
    onToggle,
    isMutating,
    selectedMonth,
    factoryName,
}: {
    worker: MeterWorkerPayroll
    onToggle: () => void
    isMutating?: boolean
    selectedMonth: string
    factoryName: string
}) {
    const [expanded, setExpanded] = useState(false)
    const { t } = useTranslation()
    const tl = useTransliterate()
    const isPaid = worker.payment?.paid ?? false
    const hasAdvances = worker.totalAdvances > 0
    const debtRatio = worker.totalPay > 0 ? worker.totalAdvances / worker.totalPay : 0

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
                        {tl(worker.name)[0]}
                    </div>
                    <div className="min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{tl(worker.name)}</div>
                        <div className="text-xs text-gray-500">
                            {worker.totalMeters.toFixed(1)} {t('payroll.row.m_across')} {worker.machines.length} {worker.machines.length !== 1 ? t('payroll.row.machines') : t('payroll.row.machine')}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            {hasAdvances && (
                                <div className="flex items-center gap-1">
                                    <HandCoins className="h-3 w-3 text-amber-600" />
                                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-tighter">
                                        {formatINR(worker.totalAdvances)} {t('payroll.row.advance')}
                                    </span>
                                </div>
                            )}
                            {debtRatio > 0.3 && (
                                <Badge 
                                    variant={debtRatio > 0.6 ? "destructive" : "warning"}
                                    className="text-[9px] h-4 px-1.5 font-black uppercase tracking-tighter"
                                >
                                    {debtRatio > 0.6 ? t('payroll.row.high_debt') : t('payroll.row.debt_risk')}: {Math.round(debtRatio * 100)}%
                                </Badge>
                            )}
                        </div>
                    </div>
                </button>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <div className="text-right">
                        <div className="font-bold text-gray-900">
                            {hasAdvances ? formatINR(worker.netPay) : formatINR(worker.totalPay)}
                        </div>
                        {hasAdvances && (
                            <div className="text-[10px] text-gray-400 line-through">
                                {formatINR(worker.totalPay)}
                            </div>
                        )}
                        <PaidBadge paid={isPaid} paidAt={worker.payment?.paid_at} />
                    </div>
                    <Button
                        size="sm"
                        variant={isPaid ? 'outline' : 'default'}
                        className={cn('h-8 text-xs', isPaid && 'border-green-300 text-green-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600')}
                        onClick={onToggle}
                    >
                        {isPaid ? t('payroll.status.unmark') : t('payroll.status.mark_paid')}
                    </Button>
                </div>
            </div>

            {expanded && worker.machines.length > 0 && (
                <div className="border-t bg-gray-50 px-4 py-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t('payroll.row.calculation_breakdown')}</p>
                    <div className="space-y-1.5">
                        {worker.machines.map((m, i) => (
                            <div key={i} className="flex justify-between text-sm">
                                <span className="text-gray-600">{m.machineName}</span>
                                <span className="text-gray-500 text-xs">
                                    {m.meters.toFixed(1)} {t('payroll.row.m_across').charAt(0)} × ₹{m.rate}/{t('payroll.row.m_across').charAt(0)}
                                    <span className="text-gray-800 font-medium ml-2">= {formatINR(m.pay)}</span>
                                </span>
                            </div>
                        ))}
                        <div className="flex justify-between text-sm font-semibold border-t pt-1.5 mt-1">
                            <span>{t('payroll.row.gross_pay')}</span>
                            <span>{formatINR(worker.totalPay)}</span>
                        </div>
                        {hasAdvances && (
                            <>
                                <div className="flex justify-between text-sm text-amber-700">
                                    <span className="flex items-center gap-1">
                                        <HandCoins className="h-3.5 w-3.5" />
                                        {t('payroll.row.advance_deduction')}
                                    </span>
                                    <span>-{formatINR(Math.min(worker.totalAdvances, worker.totalPay))}</span>
                                </div>
                                <div className="flex justify-between text-sm font-bold border-t border-dashed pt-1.5 mt-1">
                                    <span>{t('payroll.row.net_pagar')}</span>
                                    <span className="text-green-700">{formatINR(worker.netPay)}</span>
                                </div>
                                {worker.remainingDebt > 0 && (
                                    <div className="flex justify-between text-xs text-red-600 bg-red-50 rounded px-2 py-1 mt-1">
                                        <span>{t('payroll.row.remaining_debt')}</span>
                                        <span className="font-semibold">{formatINR(worker.remainingDebt)}</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    {/* Minimum wage warning */}
                    {worker.machines.length > 0 && isBelowMinWage(worker.totalPay / 30, 'daily') && (
                        <div className="flex items-center gap-1.5 mt-3 text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="text-xs">Effective daily rate is below minimum wage (₹{MIN_WAGE_DAILY}/day)</span>
                        </div>
                    )}
                    {/* Download payslip */}
                    <button
                        onClick={() => generateMeterPayslip({
                            factoryName,
                            month: selectedMonth,
                            workerName: worker.name,
                            machines: worker.machines,
                            totalMeters: worker.totalMeters,
                            totalPay: worker.totalPay,
                            totalAdvances: worker.totalAdvances,
                            netPay: worker.netPay,
                        })}
                        className="flex items-center gap-1.5 mt-3 text-xs text-gray-500 hover:text-gray-900 transition-colors"
                    >
                        <Download className="h-3.5 w-3.5" />
                        Download Payslip (PDF)
                    </button>
                </div>
            )}
        </div>
    )
}
function FixedWorkerRow({
    worker,
    onToggle,
    isMutating,
    selectedMonth,
    factoryName,
}: {
    worker: FixedWorkerPayroll
    onToggle: () => void
    isMutating?: boolean
    selectedMonth: string
    factoryName: string
}) {
    const [expanded, setExpanded] = useState(false)
    const { t } = useTranslation()
    const tl = useTransliterate()
    const isPaid = worker.payment?.paid ?? false
    const isDaily = worker.role === 'daily'
    const hasAdvances = worker.totalAdvances > 0
    const debtRatio = worker.earnedPay > 0 ? worker.totalAdvances / worker.earnedPay : 0

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
                        {t(`workers.roles.${worker.role}`) || worker.role}
                    </span>
                    <div className="min-w-0">
                        <span className="font-semibold text-gray-900 truncate block">{tl(worker.name)}</span>
                        <div className="flex items-center gap-2 mt-1">
                            {hasAdvances && (
                                <div className="flex items-center gap-1">
                                    <HandCoins className="h-3 w-3 text-amber-600" />
                                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-tighter">
                                        {formatINR(worker.totalAdvances)} {t('payroll.row.advance')}
                                    </span>
                                </div>
                            )}
                            {debtRatio > 0.3 && (
                                <Badge 
                                    variant={debtRatio > 0.6 ? "destructive" : "warning"}
                                    className="text-[9px] h-4 px-1.5 font-black uppercase tracking-tighter"
                                >
                                    {debtRatio > 0.6 ? t('payroll.row.high_debt') : t('payroll.row.debt_risk')}: {Math.round(debtRatio * 100)}%
                                </Badge>
                            )}
                        </div>
                    </div>
                </button>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <div className="text-right">
                        <div className="font-bold text-gray-900">
                            {hasAdvances ? formatINR(worker.netPay) : formatINR(worker.earnedPay)}
                        </div>
                        {hasAdvances && (
                            <div className="text-[10px] text-gray-400 line-through">
                                {formatINR(worker.earnedPay)}
                            </div>
                        )}
                        <PaidBadge paid={isPaid} paidAt={worker.payment?.paid_at} />
                    </div>
                    <Button
                        size="sm"
                        variant={isPaid ? 'outline' : 'default'}
                        className={cn('h-8 text-xs', isPaid && 'border-green-300 text-green-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600')}
                        onClick={onToggle}
                    >
                        {isPaid ? t('payroll.status.unmark') : t('payroll.status.mark_paid')}
                    </Button>
                </div>
            </div>

            {expanded && (
                <div className="border-t bg-gray-50 px-4 py-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t('payroll.row.calculation')}</p>
                    {isDaily ? (
                        <div className="text-sm text-gray-600 space-y-1">
                            <div className="flex justify-between">
                                <span>{t('payroll.row.monthly_salary')}</span>
                                <span>{formatINR(worker.monthly_salary)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>{t('payroll.row.days_worked')}</span>
                                <span>{worker.daysWorked ?? 0} / 30</span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>{t('payroll.row.formula')}</span>
                                <span>₹{worker.monthly_salary.toLocaleString()} ÷ 30 × {worker.daysWorked ?? 0} {t('payroll.row.days')}</span>
                            </div>
                            <div className="flex justify-between font-semibold border-t pt-1.5 mt-1">
                                <span>{t('payroll.row.gross_pay')}</span>
                                <span>{formatINR(worker.earnedPay)}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-gray-600 flex justify-between">
                            <span>{t('payroll.row.full_monthly_salary')}</span>
                            <span className="font-semibold">{formatINR(worker.monthly_salary)}</span>
                        </div>
                    )}
                    {hasAdvances && (
                        <div className="space-y-1.5 mt-2">
                            <div className="flex justify-between text-sm text-amber-700">
                                <span className="flex items-center gap-1">
                                    <HandCoins className="h-3.5 w-3.5" />
                                    {t('payroll.row.advance_deduction')}
                                </span>
                                <span>-{formatINR(Math.min(worker.totalAdvances, worker.earnedPay))}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold border-t border-dashed pt-1.5 mt-1">
                                <span>{t('payroll.row.net_pagar')}</span>
                                <span className="text-green-700">{formatINR(worker.netPay)}</span>
                            </div>
                            {worker.remainingDebt > 0 && (
                                <div className="flex justify-between text-xs text-red-600 bg-red-50 rounded px-2 py-1 mt-1">
                                    <span>{t('payroll.row.remaining_debt')}</span>
                                    <span className="font-semibold">{formatINR(worker.remainingDebt)}</span>
                                </div>
                            )}
                        </div>
                    )}
                    {/* Minimum wage warning */}
                    {isBelowMinWage(worker.monthly_salary, 'monthly') && (
                        <div className="flex items-center gap-1.5 mt-3 text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="text-xs">Salary is below Gujarat minimum wage (₹12,120/month)</span>
                        </div>
                    )}
                    {/* Download payslip */}
                    <button
                        onClick={() => generateFixedPayslip({
                            factoryName,
                            month: selectedMonth,
                            workerName: worker.name,
                            role: worker.role,
                            monthlySalary: worker.monthly_salary,
                            daysWorked: worker.daysWorked,
                            earnedPay: worker.earnedPay,
                            totalAdvances: worker.totalAdvances,
                            netPay: worker.netPay,
                        })}
                        className="flex items-center gap-1.5 mt-3 text-xs text-gray-500 hover:text-gray-900 transition-colors"
                    >
                        <Download className="h-3.5 w-3.5" />
                        Download Payslip (PDF)
                    </button>
                </div>
            )}
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PayrollPage() {
    const supabase = createClient()
    const queryClient = useQueryClient()
    const { t } = useTranslation()
    const [activeTab, setActiveTab] = useState<'meter' | 'fixed'>('meter')
    const [selectedMonth, setSelectedMonth] = useState('')

    useEffect(() => {
        setSelectedMonth(new Date().toISOString().substring(0, 7))
    }, [])

    const { data: userProfile } = useUserProfile()

    // Org name for payslip headers
    const { data: orgData } = useQuery({
        queryKey: ['org_name', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data } = await supabase
                .from('organizations')
                .select('name')
                .eq('id', userProfile!.org_id)
                .single()
            return data
        }
    })
    const orgName = orgData?.name || 'Factory'

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
                .select('worker_id, machine_id, meters, yarn_batches(qualities(default_worker_rate_per_m))')
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

            // Fetch machines (for names)
            const { data: machines, error: mErr } = await supabase
                .from('machines')
                .select('id, name')
                .eq('org_id', userProfile!.org_id)
            if (mErr) throw mErr

            // Fetch payment records for this month
            const { data: payments } = await supabase
                .from('payroll_payments')
                .select('*')
                .eq('org_id', userProfile!.org_id)
                .eq('worker_type', 'meter')
                .eq('month', selectedMonth)

            // Fetch pending advances for all meter workers
            const { data: advances } = await supabase
                .from('worker_advances')
                .select('meter_worker_id, amount')
                .eq('org_id', userProfile!.org_id)
                .eq('status', 'pending')
                .not('meter_worker_id', 'is', null)

            // Build advance totals map
            const advanceMap: Record<number, number> = {}
            ;(advances || []).forEach((a: any) => {
                advanceMap[a.meter_worker_id] = (advanceMap[a.meter_worker_id] || 0) + parseFloat(a.amount)
            })

            const machineMap = Object.fromEntries((machines || []).map((m: any) => [m.id, m]))
            const paymentMap = Object.fromEntries((payments || []).map((p: any) => [p.meter_worker_id, p]))

            // Group logs by worker → machine
            const result: MeterWorkerPayroll[] = []
            for (const worker of (workers || [])) {
                const workerLogs = (logs || []).filter((l: any) => l.worker_id === worker.id)
                if (workerLogs.length === 0) continue

                // Group by machine + rate (if quality changes)
                const machineGroups: Record<string, { meters: number; rate: number; name: string }> = {}
                for (const log of workerLogs) {
                    const machine = machineMap[log.machine_id]
                    const batch: any = log.yarn_batches
                    const rate = batch?.qualities?.default_worker_rate_per_m || 0
                    
                    // Key by machineId + rate to split if machine produces multiple qualities
                    const key = `${log.machine_id}-${rate}`
                    
                    if (!machineGroups[key]) {
                        machineGroups[key] = { 
                            meters: 0, 
                            rate: rate, 
                            name: machine?.name || 'Unknown' 
                        }
                    }
                    machineGroups[key].meters += parseFloat(log.meters) || 0
                }
                
                const machineBreakdown = Object.values(machineGroups).map(mg => ({
                    machineName: mg.name,
                    meters: mg.meters,
                    rate: mg.rate,
                    pay: mg.meters * mg.rate,
                }))

                const totalMeters = machineBreakdown.reduce((s: number, m: { meters: number }) => s + m.meters, 0)
                const totalPay = machineBreakdown.reduce((s: number, m: { pay: number }) => s + m.pay, 0)
                const totalAdvances = advanceMap[worker.id] || 0
                const netPay = parseFloat(calculateNetPay(totalPay, totalAdvances))
                const remainingDebt = parseFloat(calculateRemainingDebt(totalPay, totalAdvances))

                result.push({
                    id: worker.id,
                    name: worker.name,
                    machines: machineBreakdown,
                    totalMeters,
                    totalPay,
                    totalAdvances,
                    netPay,
                    remainingDebt,
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

            // Fetch pending advances for all fixed workers
            const { data: advances } = await supabase
                .from('worker_advances')
                .select('fixed_worker_id, amount')
                .eq('org_id', userProfile!.org_id)
                .eq('status', 'pending')
                .not('fixed_worker_id', 'is', null)

            const advanceMap: Record<number, number> = {}
            ;(advances || []).forEach((a: any) => {
                advanceMap[a.fixed_worker_id] = (advanceMap[a.fixed_worker_id] || 0) + parseFloat(a.amount)
            })

            return (workers || []).map((w: any) => {
                const daysWorked = w.role === 'daily' ? (attendanceMap[w.id] || 0) : undefined
                const earnedPay = w.role === 'daily'
                    ? Math.min(w.monthly_salary, (w.monthly_salary / 30) * (daysWorked ?? 0))
                    : w.monthly_salary
                const totalAdvances = advanceMap[w.id] || 0
                const netPay = parseFloat(calculateNetPay(earnedPay, totalAdvances))
                const remainingDebt = parseFloat(calculateRemainingDebt(earnedPay, totalAdvances))
                return {
                    id: w.id,
                    name: w.name,
                    role: w.role,
                    monthly_salary: w.monthly_salary,
                    daysWorked,
                    earnedPay,
                    totalAdvances,
                    netPay,
                    remainingDebt,
                    payment: paymentMap[w.id],
                } as FixedWorkerPayroll
            })
        }
    })

    // ── Toggle paid with Optimistic UI ──────────────────────────────────────
    const mutation = useMutation({
        mutationFn: async ({ workerType, workerId, amount, currentPaid, targetMonth }: {
            workerType: 'meter' | 'fixed',
            workerId: number,
            amount: number,
            currentPaid: boolean,
            targetMonth: string
        }) => {
            return await toggleWorkerPaid(workerType, workerId, targetMonth, currentPaid)
        },
        onMutate: async (variables) => {
            const orgId = userProfile?.org_id
            const targetMonth = variables.targetMonth
            const queryKey = variables.workerType === 'meter' 
                ? ['payroll_meter', orgId, targetMonth] 
                : ['payroll_fixed', orgId, targetMonth]

            // Cancel any outgoing refetches for this specific query key
            await queryClient.cancelQueries({ queryKey })

            // Snapshot the previous value
            const previousData = queryClient.getQueryData(queryKey)

            // Optimistically update to the new value
            queryClient.setQueryData(queryKey, (old: any) => {
                if (!old) return old
                return old.map((w: any) => {
                    // CRITICAL: Check both ID AND worker type (implicit in the queryKey but let's be extra safe if we ever share types)
                    // and only update the targeted worker
                    if (w.id === variables.workerId) {
                        return {
                            ...w,
                            payment: {
                                ...w.payment,
                                paid: !variables.currentPaid,
                                paid_at: !variables.currentPaid ? new Date().toISOString() : null
                            }
                        }
                    }
                    return w
                })
            })

            return { previousData, queryKey }
        },
        onError: (err, variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(context.queryKey, context.previousData)
            }
            toast.error('Failed to update payroll')
        },
        onSettled: (data, error, variables, context) => {
            // Invalidate the specific capture key
            queryClient.invalidateQueries({ queryKey: context?.queryKey })
            // Invalidate the global stats keys as well
            queryClient.invalidateQueries({ queryKey: ['payroll_meter'] })
            queryClient.invalidateQueries({ queryKey: ['payroll_fixed'] })
        },
        onSuccess: () => {
            toast.success('✓ Payroll updated', { duration: 2000 })
        }
    })

    const handleTogglePaid = (workerType: 'meter' | 'fixed', workerId: number, amount: number, currentPaid: boolean) => {
        mutation.mutate({ workerType, workerId, amount, currentPaid, targetMonth: selectedMonth })
    }

    // ── Summary stats ───────────────────────────────────────────────────────
    const summary = useMemo(() => {
        const meterTotal = (meterWorkers || []).reduce((s: number, w: any) => s + w.totalPay, 0)
        const fixedTotal = (fixedWorkers || []).reduce((s: number, w: any) => s + w.earnedPay, 0)
        const meterAdvances = (meterWorkers || []).reduce((s: number, w: any) => s + (w.totalAdvances || 0), 0)
        const fixedAdvances = (fixedWorkers || []).reduce((s: number, w: any) => s + (w.totalAdvances || 0), 0)
        const totalAdvances = meterAdvances + fixedAdvances
        const meterPaid = (meterWorkers || []).filter((w: any) => w.payment?.paid).reduce((s: number, w: any) => s + (w.netPay ?? w.totalPay), 0)
        const fixedPaid = (fixedWorkers || []).filter((w: any) => w.payment?.paid).reduce((s: number, w: any) => s + (w.netPay ?? w.earnedPay), 0)
        const total = meterTotal + fixedTotal
        const paid = meterPaid + fixedPaid
        return { total, paid, outstanding: total - paid - totalAdvances, totalAdvances }
    }, [meterWorkers, fixedWorkers])

    if (!selectedMonth) return null

    return (
        <div className="p-4 md:p-6 space-y-6 pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('payroll.monthly_payroll')}</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{t('payroll.track_settle')}</p>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="text-center">
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs text-gray-500 mb-1">{t('payroll.metrics.total_owed')}</div>
                        <div className="text-lg font-bold text-gray-900">{formatINR(summary.total)}</div>
                    </CardContent>
                </Card>
                <Card className="text-center border-green-200">
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs text-gray-500 mb-1">{t('payroll.metrics.paid')}</div>
                        <div className="text-lg font-bold text-green-700">{formatINR(summary.paid)}</div>
                    </CardContent>
                </Card>
                {summary.totalAdvances > 0 && (
                    <Card className="text-center border-amber-200">
                        <CardContent className="pt-4 pb-3">
                            <div className="text-xs text-amber-600 mb-1 flex items-center justify-center gap-1">
                                <HandCoins className="h-3 w-3" />
                                {t('payroll.metrics.deductions')}
                            </div>
                            <div className="text-lg font-bold text-amber-700">{formatINR(summary.totalAdvances)}</div>
                        </CardContent>
                    </Card>
                )}
                <Card className="text-center border-amber-200">
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs text-gray-500 mb-1">{t('payroll.metrics.outstanding')}</div>
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
                        {Math.round((summary.paid / summary.total) * 100)}% {t('payroll.metrics.settled')}
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
                    {t('payroll.tabs.meter_workers')}
                    {meterWorkers && (
                        <span className={cn(
                            'text-xs px-1.5 py-0.5 rounded-full',
                            activeTab === 'meter' ? 'bg-white/20' : 'bg-gray-100'
                        )}>
                            {meterWorkers.filter(w => !w.payment?.paid).length} {t('payroll.tabs.pending_count')}
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
                    {t('payroll.tabs.fixed_workers')}
                    {fixedWorkers && (
                        <span className={cn(
                            'text-xs px-1.5 py-0.5 rounded-full',
                            activeTab === 'fixed' ? 'bg-white/20' : 'bg-gray-100'
                        )}>
                            {fixedWorkers.filter((w: any) => !w.payment?.paid).length} {t('payroll.tabs.pending_count')}
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
                                <p className="text-gray-500 font-medium">{t('payroll.empty.no_production')}</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <p className="text-xs text-gray-400">
                                {t('payroll.empty.tap_row')}
                            </p>
                            {meterWorkers.map(w => (
                                <MeterWorkerRow
                                    key={w.id}
                                    worker={w}
                                    onToggle={() => handleTogglePaid('meter', w.id, w.totalPay, w.payment?.paid ?? false)}
                                    isMutating={mutation.isPending && mutation.variables?.workerId === w.id && mutation.variables?.workerType === 'meter'}
                                    selectedMonth={selectedMonth}
                                    factoryName={orgName}
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
                                <p className="text-gray-500 font-medium">{t('payroll.empty.no_fixed')}</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <p className="text-xs text-gray-400">
                                {t('payroll.empty.tap_row_fixed')}
                            </p>
                            {fixedWorkers.map((w: any) => (
                                <FixedWorkerRow
                                    key={w.id}
                                    worker={w}
                                    onToggle={() => handleTogglePaid('fixed', w.id, w.earnedPay, w.payment?.paid ?? false)}
                                    isMutating={mutation.isPending && mutation.variables?.workerId === w.id && mutation.variables?.workerType === 'fixed'}
                                    selectedMonth={selectedMonth}
                                    factoryName={orgName}
                                />
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
