'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { formatINR, calculateAdvanceRecovery } from '@/lib/finance'
import {
    CheckCircle2, Circle, ChevronLeft, ChevronRight,
    HardHat, Briefcase, AlertCircle, Loader2, HandCoins, Download, AlertTriangle,
    Search, Send, Info, Lock, Check, Plus, Trash2, CalendarClock, History, ReceiptText, Eye
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { savePayrollConfig, toggleWorkerPaid } from './actions'
import { useTranslation } from '@/lib/i18n/context'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useTransliterate } from '@/hooks/use-transliterate'
import { useMutation } from '@tanstack/react-query'
import { generateMeterPayslip, generateFixedPayslip, type PayslipItemization } from '@/lib/generate-payslip'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { sendPayslipWhatsApp } from './whatsapp-actions'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from '@/components/ui/input-otp'
import { REGEXP_ONLY_DIGITS_AND_CHARS } from 'input-otp'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog'
import { setWorkerActiveStatus } from '@/app/(dashboard)/owner/actions'
import { getPayrollCycleBounds, getPayrollCycleStatus, getPayrollMonthForDate } from '@/lib/payroll-cycle'
import { formatToSurat } from '@/lib/time'
import {
    PAYROLL_MANUAL_ADJUSTMENT_REASONS,
    calculatePayrollManualAdjustmentTotals,
    sanitizePayrollManualAdjustment,
    type PayrollManualAdjustment,
    type PayrollManualAdjustmentReason,
    type PayrollManualAdjustmentType,
} from '@/lib/payroll-manual-adjustments'
import {
    calculatePayrollStatutoryDeductions,
    extractPayrollStatutoryDeductionsFromItemization,
} from '@/lib/payroll-statutory'

type PaymentMode = 'cash' | 'bank_transfer' | 'upi' | 'cheque'
type PendingPayrollManualAdjustment = PayrollManualAdjustment & { id: string }
type SupabaseBrowserClient = ReturnType<typeof createClient>

interface SettlementRecord {
    id?: number
    gross_pay: number
    advance_deducted: number
    net_payout: number
    carried_forward_debt: number
    compliance_flag: boolean
    is_final_settlement: boolean
    settled_at?: string
    status: 'paid' | 'pending'
    itemization_payload?: unknown
    payment_mode?: PaymentMode | null
}

interface WorkerBase {
    id: number
    name: string
    whatsapp_number?: string | null
    totalAdvances: number
    pf_esi_enrolled?: boolean
    pf_esi_eligible?: boolean
    settlement?: SettlementRecord
}

interface MeterWorkerPayroll extends WorkerBase {
    machines: { machineName: string; orderLabel?: string; meters: number; rate: number; pay: number }[]
    totalMeters: number
    totalPay: number       // gross pay
}

interface FixedWorkerPayroll extends WorkerBase {
    role: string
    monthly_salary: number
    daysWorked?: number       // only for 'daily' role
    earnedPay: number         // gross pay
}

type PayrollWorker = MeterWorkerPayroll | FixedWorkerPayroll
type SettlementDialogWorker = PayrollWorker & {
    type: 'meter' | 'fixed'
    targetMonth?: string
    initialIsFinal?: boolean
    deactivateAfterExit?: boolean
}

type ProductionLogRow = {
    worker_id: number
    machine_id: string | number | null
    meters: number | string | null
    worker_rate_snapshot: number | string | null
    order_id: string | number | null
    date?: string | null
}

type MeterWorkerDbRow = {
    id: number
    name: string
    whatsapp_number: string | null
    is_active: boolean
    pf_esi_enrolled?: boolean | null
    pf_esi_eligible?: boolean | null
}

type MachineRow = {
    id: string | number
    name: string
}

type PayrollSettlementRow = SettlementRecord & {
    id: number
    worker_type?: 'meter' | 'fixed'
    month?: string
    meter_worker_id?: number | null
    fixed_worker_id?: number | null
}

type SettlementHistoryItem = PayrollSettlementRow & {
    worker_type: 'meter' | 'fixed'
    month: string
    workerName: string
    workerDetail: string
    earningLines: SettlementEarningLine[]
    earningTotal: number
}

type SettlementSnapshotRow = PayrollSettlementRow & {
    worker_type: 'meter' | 'fixed'
    month: string
}

type SettlementEarningLine = {
    label: string
    subLabel?: string
    quantityLabel: string
    rateLabel: string
    amount: number
    meters?: number
    rate?: number
}

type WorkerAdvanceRow = {
    meter_worker_id?: number | null
    fixed_worker_id?: number | null
    amount: number | string | null
}

type OrderRow = {
    id: string | number
    party_name: string | null
    quality_label: string | null
}

type FixedWorkerDbRow = {
    id: number
    name: string
    whatsapp_number: string | null
    role: string
    monthly_salary: number | string | null
    start_date?: string | null
    pf_esi_enrolled?: boolean | null
    pf_esi_eligible?: boolean | null
}

type AttendanceRow = {
    fixed_worker_id: number
}

type WorkerNameRow = {
    id: number
    name: string
}

type FixedWorkerNameRow = WorkerNameRow & {
    role?: string | null
    monthly_salary?: number | string | null
}

type AttendanceDateRow = {
    fixed_worker_id: number
    date: string
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

const PAYROLL_QUERY_VERSION = 'production-ledger-v3'

// ─── helpers ─────────────────────────────────────────────────────────────────
function monthLabel(ym: string) {
    const [y, m] = ym.split('-')
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
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

function payrollMeterQueryKey(orgId: string | undefined, month: string, cycleStartDay: number) {
    return ['payroll_meter', orgId, month, cycleStartDay, PAYROLL_QUERY_VERSION] as const
}

function payrollFixedQueryKey(orgId: string | undefined, month: string, cycleStartDay: number) {
    return ['payroll_fixed', orgId, month, cycleStartDay, PAYROLL_QUERY_VERSION] as const
}

function toPayrollNumber(value: unknown) {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
}

async function fetchMeterWorkerPayroll(
    supabase: SupabaseBrowserClient,
    orgId: string,
    month: string,
    cycleStartDay: number
): Promise<MeterWorkerPayroll[]> {
    const bounds = getPayrollCycleBounds(month, cycleStartDay)
    const monthStart = bounds.cycle_start
    const monthEnd = bounds.cycle_end

    const [logsRes, workersRes, machinesRes, settlementsRes, advancesRes, ordersRes] = await Promise.all([
        supabase.from('production_logs')
            .select('worker_id, machine_id, meters, worker_rate_snapshot, order_id')
            .eq('org_id', orgId)
            .gt('meters', 0)
            .gte('date', monthStart)
            .lte('date', monthEnd),
        supabase.from('workers')
            .select('id, name, whatsapp_number, is_active, pf_esi_enrolled, pf_esi_eligible')
            .eq('org_id', orgId),
        supabase.from('machines')
            .select('id, name')
            .eq('org_id', orgId),
        supabase.from('payroll_settlements')
            .select('*')
            .eq('org_id', orgId)
            .eq('worker_type', 'meter')
            .eq('month', month),
        supabase.from('worker_advances')
            .select('meter_worker_id, amount')
            .eq('org_id', orgId)
            .eq('status', 'pending')
            .is('writeoff_at', null)
            .not('meter_worker_id', 'is', null),
        supabase.from('orders')
            .select('id, party_name, quality_label')
            .eq('org_id', orgId)
            .in('status', ['active', 'completed', 'cancelled']),
    ])

    if (logsRes.error) throw logsRes.error
    if (workersRes.error) throw workersRes.error
    if (machinesRes.error) throw machinesRes.error
    if (settlementsRes.error) throw settlementsRes.error
    if (advancesRes.error) throw advancesRes.error
    if (ordersRes.error) throw ordersRes.error

    const logs = (logsRes.data || []) as ProductionLogRow[]
    const workers = (workersRes.data || []) as MeterWorkerDbRow[]
    const machines = (machinesRes.data || []) as MachineRow[]
    const settlements = (settlementsRes.data || []) as PayrollSettlementRow[]
    const advances = (advancesRes.data || []) as WorkerAdvanceRow[]
    const orders = (ordersRes.data || []) as OrderRow[]

    const advanceMap: Record<number, number> = {}
    advances.forEach((advance) => {
        if (!advance.meter_worker_id) return
        advanceMap[advance.meter_worker_id] = (advanceMap[advance.meter_worker_id] || 0) + toPayrollNumber(advance.amount)
    })

    const machineMap = Object.fromEntries(machines.map((machine) => [String(machine.id), machine]))
    const settlementMap = Object.fromEntries(
        settlements
            .filter((settlement) => settlement.meter_worker_id)
            .map((settlement) => [settlement.meter_worker_id as number, settlement])
    )
    const orderLabelMap = Object.fromEntries(
        orders.map((order) => [
            String(order.id),
            order.quality_label ? `${order.party_name || 'Order'} · ${order.quality_label}` : order.party_name || 'Order',
        ])
    )
    const workerIdsWithLogs = new Set(logs.map((log) => log.worker_id))

    const result: MeterWorkerPayroll[] = []
    for (const worker of workers) {
        if (!worker.is_active && !workerIdsWithLogs.has(worker.id)) continue

        const workerLogs = logs.filter((log) => log.worker_id === worker.id)
        if (workerLogs.length === 0 && !settlementMap[worker.id]) continue

        const machineGroups: Record<string, { meters: number; rate: number; name: string; orderLabel?: string }> = {}
        for (const log of workerLogs) {
            const machine = log.machine_id ? machineMap[String(log.machine_id)] : null
            const rate = toPayrollNumber(log.worker_rate_snapshot)
            const orderId = log.order_id || '__no_order__'
            const key = `${orderId}-${log.machine_id}-${rate}`

            if (!machineGroups[key]) {
                machineGroups[key] = {
                    meters: 0,
                    rate,
                    name: machine?.name || 'Unknown',
                    orderLabel: log.order_id ? orderLabelMap[String(log.order_id)] : undefined,
                }
            }
            machineGroups[key].meters += toPayrollNumber(log.meters)
        }

        const machineBreakdown = Object.values(machineGroups).map((group) => ({
            machineName: group.name,
            orderLabel: group.orderLabel,
            meters: group.meters,
            rate: group.rate,
            pay: group.meters * group.rate,
        }))
        const totalMeters = machineBreakdown.reduce((sum, item) => sum + item.meters, 0)
        const totalPay = machineBreakdown.reduce((sum, item) => sum + item.pay, 0)

        result.push({
            id: worker.id,
            name: worker.name,
            whatsapp_number: worker.whatsapp_number ?? null,
            pf_esi_enrolled: worker.pf_esi_enrolled ?? undefined,
            pf_esi_eligible: worker.pf_esi_eligible ?? undefined,
            machines: machineBreakdown,
            totalMeters,
            totalPay,
            totalAdvances: advanceMap[worker.id] || 0,
            settlement: settlementMap[worker.id],
        })
    }

    return result.sort((a, b) => b.totalPay - a.totalPay)
}

async function fetchFixedWorkerPayroll(
    supabase: SupabaseBrowserClient,
    orgId: string,
    month: string,
    cycleStartDay: number
): Promise<FixedWorkerPayroll[]> {
    const bounds = getPayrollCycleBounds(month, cycleStartDay)
    const monthStart = bounds.cycle_start
    const monthEnd = bounds.cycle_end

    const workersRes = await supabase
        .from('fixed_workers')
        .select('*')
        .eq('org_id', orgId)
        .order('role')
        .order('name')

    if (workersRes.error) throw workersRes.error

    const workers = (workersRes.data || []) as FixedWorkerDbRow[]
    const dailyIds = workers.filter((worker) => worker.role === 'daily').map((worker) => worker.id)

    const [attRes, settlementsRes, advancesRes] = await Promise.all([
        dailyIds.length > 0
            ? supabase.from('attendance')
                .select('fixed_worker_id, present')
                .eq('org_id', orgId)
                .in('fixed_worker_id', dailyIds)
                .gte('date', monthStart)
                .lte('date', monthEnd)
                .eq('present', true)
            : Promise.resolve({ data: [], error: null }),
        supabase.from('payroll_settlements')
            .select('*')
            .eq('org_id', orgId)
            .eq('worker_type', 'fixed')
            .eq('month', month),
        supabase.from('worker_advances')
            .select('fixed_worker_id, amount')
            .eq('org_id', orgId)
            .eq('status', 'pending')
            .is('writeoff_at', null)
            .not('fixed_worker_id', 'is', null),
    ])

    if (attRes.error) throw attRes.error
    if (settlementsRes.error) throw settlementsRes.error
    if (advancesRes.error) throw advancesRes.error

    const attendanceMap: Record<number, number> = {}
    ;((attRes.data || []) as AttendanceRow[]).forEach((attendance) => {
        attendanceMap[attendance.fixed_worker_id] = (attendanceMap[attendance.fixed_worker_id] || 0) + 1
    })

    const settlementMap = Object.fromEntries(
        ((settlementsRes.data || []) as PayrollSettlementRow[])
            .filter((settlement) => settlement.fixed_worker_id)
            .map((settlement) => [settlement.fixed_worker_id as number, settlement])
    )

    const advanceMap: Record<number, number> = {}
    ;((advancesRes.data || []) as WorkerAdvanceRow[]).forEach((advance) => {
        if (!advance.fixed_worker_id) return
        advanceMap[advance.fixed_worker_id] = (advanceMap[advance.fixed_worker_id] || 0) + toPayrollNumber(advance.amount)
    })

    return workers
        .filter((worker) => !worker.start_date || worker.start_date <= monthEnd)
        .map((worker) => {
            const monthlySalary = toPayrollNumber(worker.monthly_salary)
            const daysWorked = worker.role === 'daily' ? (attendanceMap[worker.id] || 0) : undefined
            const earnedPay = worker.role === 'daily'
                ? Math.min(monthlySalary, (monthlySalary / 30) * (daysWorked ?? 0))
                : monthlySalary

            return {
                id: worker.id,
                name: worker.name,
                whatsapp_number: worker.whatsapp_number ?? null,
                pf_esi_enrolled: worker.pf_esi_enrolled ?? undefined,
                pf_esi_eligible: worker.pf_esi_eligible ?? undefined,
                role: worker.role,
                monthly_salary: monthlySalary,
                daysWorked,
                earnedPay,
                totalAdvances: advanceMap[worker.id] || 0,
                settlement: settlementMap[worker.id],
            } as FixedWorkerPayroll
        })
}

async function fetchSettlementHistory(
    supabase: SupabaseBrowserClient,
    orgId: string,
    cycleStartDay: number
): Promise<SettlementHistoryItem[]> {
    const { data, error } = await supabase
        .from('payroll_settlements')
        .select('id, worker_type, meter_worker_id, fixed_worker_id, month, gross_pay, advance_deducted, net_payout, carried_forward_debt, compliance_flag, is_final_settlement, settled_at, status, itemization_payload, payment_mode')
        .eq('org_id', orgId)
        .eq('status', 'paid')
        .order('settled_at', { ascending: false })
        .limit(200)

    if (error) throw error

    const settlements = ((data || []) as PayrollSettlementRow[]).filter(
        (settlement): settlement is SettlementSnapshotRow =>
            (settlement.worker_type === 'meter' || settlement.worker_type === 'fixed') &&
            typeof settlement.month === 'string'
    )
    const cycleBoundsByMonth = new Map(
        Array.from(new Set(settlements.map((settlement) => settlement.month))).map((month) => [
            month,
            getPayrollCycleBounds(month, cycleStartDay),
        ])
    )
    const cycleStarts = Array.from(cycleBoundsByMonth.values()).map((bounds) => bounds.cycle_start)
    const cycleEnds = Array.from(cycleBoundsByMonth.values()).map((bounds) => bounds.cycle_end)
    const minCycleStart = cycleStarts.sort()[0]
    const maxCycleEnd = cycleEnds.sort().at(-1)
    const meterIds = Array.from(new Set(
        settlements
            .map((settlement) => settlement.meter_worker_id)
            .filter((id): id is number => typeof id === 'number')
    ))
    const fixedIds = Array.from(new Set(
        settlements
            .map((settlement) => settlement.fixed_worker_id)
            .filter((id): id is number => typeof id === 'number')
    ))

    const [meterWorkersRes, fixedWorkersRes, productionLogsRes, machinesRes, attendanceRes] = await Promise.all([
        meterIds.length > 0
            ? supabase.from('workers').select('id, name').eq('org_id', orgId).in('id', meterIds)
            : Promise.resolve({ data: [], error: null }),
        fixedIds.length > 0
            ? supabase.from('fixed_workers').select('id, name, role, monthly_salary').eq('org_id', orgId).in('id', fixedIds)
            : Promise.resolve({ data: [], error: null }),
        meterIds.length > 0 && minCycleStart && maxCycleEnd
            ? supabase.from('production_logs')
                .select('worker_id, machine_id, meters, worker_rate_snapshot, order_id, date')
                .eq('org_id', orgId)
                .in('worker_id', meterIds)
                .gt('meters', 0)
                .gte('date', minCycleStart)
                .lte('date', maxCycleEnd)
            : Promise.resolve({ data: [], error: null }),
        meterIds.length > 0
            ? supabase.from('machines').select('id, name').eq('org_id', orgId)
            : Promise.resolve({ data: [], error: null }),
        fixedIds.length > 0 && minCycleStart && maxCycleEnd
            ? supabase.from('attendance')
                .select('fixed_worker_id, date')
                .eq('org_id', orgId)
                .in('fixed_worker_id', fixedIds)
                .eq('present', true)
                .gte('date', minCycleStart)
                .lte('date', maxCycleEnd)
            : Promise.resolve({ data: [], error: null }),
    ])

    if (meterWorkersRes.error) throw meterWorkersRes.error
    if (fixedWorkersRes.error) throw fixedWorkersRes.error
    if (productionLogsRes.error) throw productionLogsRes.error
    if (machinesRes.error) throw machinesRes.error
    if (attendanceRes.error) throw attendanceRes.error

    const productionLogs = (productionLogsRes.data || []) as ProductionLogRow[]
    const machineMap = Object.fromEntries(((machinesRes.data || []) as MachineRow[]).map((machine) => [String(machine.id), machine.name]))
    const orderIds = Array.from(new Set(
        productionLogs
            .map((log) => log.order_id)
            .filter((id): id is string | number => id !== null && id !== undefined)
    ))
    const ordersRes = orderIds.length > 0
        ? await supabase.from('orders').select('id, party_name, quality_label').eq('org_id', orgId).in('id', orderIds)
        : { data: [], error: null }

    if (ordersRes.error) throw ordersRes.error

    const orderLabelMap = Object.fromEntries(
        ((ordersRes.data || []) as OrderRow[]).map((order) => [
            String(order.id),
            order.quality_label ? `${order.party_name || 'Order'} · ${order.quality_label}` : order.party_name || 'Order',
        ])
    )
    const attendanceRows = (attendanceRes.data || []) as AttendanceDateRow[]

    const meterNameMap = new Map(
        ((meterWorkersRes.data || []) as WorkerNameRow[]).map((worker) => [worker.id, worker.name])
    )
    const fixedWorkerMap = new Map(
        ((fixedWorkersRes.data || []) as FixedWorkerNameRow[]).map((worker) => [worker.id, worker])
    )

    return settlements.map((settlement) => {
        if (settlement.worker_type === 'meter') {
            const workerId = settlement.meter_worker_id ?? 0
            const bounds = cycleBoundsByMonth.get(settlement.month)
            const workerLogs = bounds
                ? productionLogs.filter((log) =>
                    log.worker_id === workerId &&
                    !!log.date &&
                    log.date >= bounds.cycle_start &&
                    log.date <= bounds.cycle_end
                )
                : []
            const groupedLines = new Map<string, SettlementEarningLine>()

            workerLogs.forEach((log) => {
                const meters = toPayrollNumber(log.meters)
                const rate = toPayrollNumber(log.worker_rate_snapshot)
                const machineKey = log.machine_id === null || log.machine_id === undefined ? 'unknown-machine' : String(log.machine_id)
                const orderKey = log.order_id === null || log.order_id === undefined ? 'no-order' : String(log.order_id)
                const machineName = machineKey === 'unknown-machine' ? 'Unknown machine' : machineMap[machineKey] || 'Unknown machine'
                const orderLabel = orderKey === 'no-order' ? undefined : orderLabelMap[orderKey]
                const key = `${machineKey}-${orderKey}-${rate}`
                const existing = groupedLines.get(key)

                if (existing) {
                    const nextMeters = (existing.meters || 0) + meters
                    groupedLines.set(key, {
                        ...existing,
                        meters: nextMeters,
                        quantityLabel: `${nextMeters.toFixed(1)} m`,
                        amount: nextMeters * rate,
                    })
                } else {
                    groupedLines.set(key, {
                        label: machineName,
                        subLabel: orderLabel,
                        meters,
                        rate,
                        quantityLabel: `${meters.toFixed(1)} m`,
                        rateLabel: `${formatINR(rate)}/m`,
                        amount: meters * rate,
                    })
                }
            })

            const earningLines = Array.from(groupedLines.values())
            const earningTotal = earningLines.reduce((sum, line) => sum + line.amount, 0)

            return {
                ...settlement,
                workerName: meterNameMap.get(workerId) || `Meter worker #${workerId}`,
                workerDetail: 'Meter worker',
                earningLines,
                earningTotal,
            }
        }

        const workerId = settlement.fixed_worker_id ?? 0
        const worker = fixedWorkerMap.get(workerId)
        const role = worker?.role || ''
        const roleLabel = role ? (ROLE_LABELS[role] || role) : 'Fixed worker'
        const monthlySalary = toPayrollNumber(worker?.monthly_salary)
        const bounds = cycleBoundsByMonth.get(settlement.month)
        const daysWorked = bounds
            ? attendanceRows.filter((attendance) =>
                attendance.fixed_worker_id === workerId &&
                attendance.date >= bounds.cycle_start &&
                attendance.date <= bounds.cycle_end
            ).length
            : 0
        const dailyRate = monthlySalary > 0 ? monthlySalary / 30 : 0
        const earningLines: SettlementEarningLine[] = role === 'daily'
            ? [{
                label: 'Days present',
                subLabel: roleLabel,
                quantityLabel: `${daysWorked} day${daysWorked === 1 ? '' : 's'}`,
                rateLabel: `${formatINR(dailyRate)}/day`,
                amount: toPayrollNumber(settlement.gross_pay),
            }]
            : [{
                label: 'Monthly salary',
                subLabel: roleLabel,
                quantityLabel: '1 cycle',
                rateLabel: monthlySalary > 0 ? formatINR(monthlySalary) : 'Salary',
                amount: toPayrollNumber(settlement.gross_pay),
            }]

        return {
            ...settlement,
            workerName: worker?.name || `Fixed worker #${workerId}`,
            workerDetail: roleLabel,
            earningLines,
            earningTotal: earningLines.reduce((sum, line) => sum + line.amount, 0),
        }
    })
}

function dateLabel(dateStr: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-IN', { ...options, timeZone: 'Asia/Kolkata' })
}

function getPayWindowCopy(status: ReturnType<typeof getPayrollCycleStatus>, payReminderDays: number) {
    const cycleLabel = `${dateLabel(status.cycle_start)} to ${dateLabel(status.cycle_end)}`
    const payDateLabel = dateLabel(status.pay_date, { day: 'numeric', month: 'short', year: 'numeric' })

    if (status.status === 'overdue') {
        return {
            tone: 'red' as const,
            title: `Payroll overdue since ${payDateLabel}`,
            description: `This cycle covers ${cycleLabel}. Settle pending wages now.`,
        }
    }

    if (status.status === 'due_today') {
        return {
            tone: 'amber' as const,
            title: `Payroll due today, ${payDateLabel}`,
            description: `This cycle covers ${cycleLabel}.`,
        }
    }

    if (status.status === 'approaching') {
        return {
            tone: 'amber' as const,
            title: `Payroll due in ${status.days_until_pay_date} day${status.days_until_pay_date === 1 ? '' : 's'}`,
            description: `Pay date is ${payDateLabel} for ${cycleLabel}.`,
        }
    }

    if (status.status === 'scheduled') {
        return {
            tone: 'slate' as const,
            title: `Payroll opens ${payReminderDays} day${payReminderDays === 1 ? '' : 's'} before ${payDateLabel}`,
            description: `This cycle covers ${cycleLabel}. Wages are not due yet.`,
        }
    }

    if (status.status === 'in_progress') {
        return {
            tone: 'slate' as const,
            title: 'Current cycle is still in progress',
            description: `This cycle closes on ${dateLabel(status.cycle_end, { day: 'numeric', month: 'short', year: 'numeric' })} and pays on ${payDateLabel}.`,
        }
    }

    return {
        tone: 'slate' as const,
        title: 'Payroll cycle has not started yet',
        description: `This cycle starts on ${dateLabel(status.cycle_start, { day: 'numeric', month: 'short', year: 'numeric' })}.`,
    }
}

function isPfEsiEnrolled(worker: WorkerBase) {
    return worker.pf_esi_enrolled ?? worker.pf_esi_eligible ?? false
}

function getStatutoryDeductions(gross: number, enrolled: boolean) {
    return calculatePayrollStatutoryDeductions(gross, enrolled)
}

function getSettlementPreview(params: {
    gross: number
    totalAdvances: number
    isFinal: boolean
    enrolled: boolean
    manualDeduction?: number | null
    manualAdjustments?: PayrollManualAdjustment[]
}) {
    const adjustmentTotals = calculatePayrollManualAdjustmentTotals(params.manualAdjustments || [])
    const adjustedGross = params.gross + adjustmentTotals.manualAdjustmentTotal
    const recovery = calculateAdvanceRecovery(adjustedGross, params.totalAdvances, params.isFinal ? 100 : 50)
    const maxDeduction = parseFloat(recovery.maxDeduction)
    const autoDeduction = parseFloat(recovery.recommendedRecovery)
    const requestedAdvanceDeduction = params.manualDeduction ?? autoDeduction
    const advanceDeducted = Math.min(
        Math.max(requestedAdvanceDeduction, 0),
        Math.max(params.totalAdvances, 0),
        Math.max(maxDeduction, 0)
    )
    const { pfEmployee, esicEmployee } = getStatutoryDeductions(adjustedGross, params.enrolled)
    const statutoryDeduction = pfEmployee + esicEmployee
    const netPayout = adjustedGross - advanceDeducted - statutoryDeduction
    return {
        baseEarnings: params.gross,
        adjustedGross,
        inamTotal: adjustmentTotals.inamTotal,
        kapaatTotal: adjustmentTotals.kapaatTotal,
        manualAdjustmentTotal: adjustmentTotals.manualAdjustmentTotal,
        pfEmployee,
        esicEmployee,
        statutoryDeduction,
        maxDeduction,
        autoDeduction,
        advanceDeducted,
        netPayout,
        remainingDebt: Math.max(params.totalAdvances - advanceDeducted, 0),
        complianceFlag: params.totalAdvances > advanceDeducted && advanceDeducted > 0 && !params.isFinal,
    }
}

function getPaymentModeLabel(mode: PaymentMode | null | undefined, t: (key: string) => string) {
    if (!mode) return null

    const labels: Record<PaymentMode, string> = {
        cash: t('payroll.payment.cash'),
        bank_transfer: t('payroll.payment.bankTransfer'),
        upi: t('payroll.payment.upi'),
        cheque: t('payroll.payment.cheque'),
    }

    return labels[mode]
}

function formatRecoveryInput(amount: number) {
    if (!Number.isFinite(amount)) return ''

    const fixed = amount.toFixed(2)
    return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
}

function getAdvanceRecoveryExplainer(params: {
    gross: number
    totalAdvances: number
    maxDeduction: number
    autoDeduction: number
    isFinal: boolean
}) {
    const totalDebt = Math.max(params.totalAdvances, 0)
    const recommendedRemainingDebt = Math.max(totalDebt - params.autoDeduction, 0)

    if (totalDebt <= 0) {
        return 'No pending advance debt, so recovery is ₹0.00.'
    }

    if (params.isFinal) {
        return `Final settlement recovers the full ${formatINR(totalDebt)} debt and ignores the regular 50% advance recovery cap.`
    }

    if (params.autoDeduction >= totalDebt) {
        return `${formatINR(totalDebt)} debt fits within the 50% advance recovery cap because gross pay is ${formatINR(params.gross)} and the cap allows up to ${formatINR(params.maxDeduction)}. Recommended recovery is the full ${formatINR(totalDebt)}.`
    }

    return `${formatINR(totalDebt)} debt is above the 50% advance recovery cap. Gross pay is ${formatINR(params.gross)}, so the cap allows ${formatINR(params.maxDeduction)} now and ${formatINR(recommendedRemainingDebt)} carries forward.`
}

function getItemizationObject(payload: unknown): Record<string, unknown> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return {}
    }

    return payload as Record<string, unknown>
}

function getItemizationNumber(payload: unknown, key: string) {
    const value = getItemizationObject(payload)[key]
    return toPayrollNumber(value)
}

function getItemizationText(payload: unknown, ...keys: string[]) {
    const itemization = getItemizationObject(payload)
    for (const key of keys) {
        const value = itemization[key]
        if (typeof value === 'string' && value.trim()) return value.trim()
    }

    return null
}

function getItemizationStatutoryDeductions(payload: unknown) {
    return extractPayrollStatutoryDeductionsFromItemization(payload)
}

function getAdvanceRecoveryRows(payload: unknown) {
    const rows = getItemizationObject(payload).advances_recovered
    if (!Array.isArray(rows)) return []

    return rows
        .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row))
        .map((row) => ({
            date: typeof row.date === 'string' ? row.date : null,
            label: typeof row.label === 'string' ? row.label : null,
            recovered: toPayrollNumber(row.recovered),
        }))
        .filter((row) => row.recovered > 0)
}

function getPayslipItemization(payload: unknown): PayslipItemization | undefined {
    const itemization = getItemizationObject(payload)
    if (Object.keys(itemization).length === 0) return undefined

    const statutory = getItemizationStatutoryDeductions(payload)

    return {
        advances_recovered: getAdvanceRecoveryRows(payload),
        manualAdjustments: getManualAdjustmentRows(payload),
        inamTotal: getItemizationNumber(payload, 'inamTotal'),
        kapaatTotal: getItemizationNumber(payload, 'kapaatTotal'),
        manualAdjustmentTotal: getItemizationNumber(payload, 'manualAdjustmentTotal'),
        advanceRecovery: getItemizationNumber(payload, 'advanceRecovery'),
        pfEmployee: statutory.pfEmployee,
        esicEmployee: statutory.esicEmployee,
        remainingDebt: getItemizationNumber(payload, 'remainingDebt'),
        paymentMode: getItemizationText(payload, 'payment_mode', 'paymentMethod'),
    }
}

function getManualAdjustmentRows(payload: unknown) {
    const rows = getItemizationObject(payload).manual_adjustments
    if (!Array.isArray(rows)) return []

    return rows
        .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row))
        .map((row) => ({
            type: String(row.adjustment_type || ''),
            reason: String(row.reason || 'Adjustment'),
            amount: toPayrollNumber(row.amount),
            note: String(row.note || ''),
        }))
}

function settlementDateLabel(dateStr?: string) {
    if (!dateStr) return 'Date not recorded'

    return new Date(dateStr).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
    })
}

function settlementDateKey(dateStr?: string) {
    if (!dateStr) return ''

    try {
        return formatToSurat(dateStr, 'yyyy-MM-dd')
    } catch {
        return ''
    }
}

function csvCell(value: string | number | boolean | null | undefined) {
    const raw = value === null || value === undefined ? '' : String(value)
    return `"${raw.replace(/"/g, '""')}"`
}

function filenamePart(value: string, fallback: string) {
    const cleaned = value
        .trim()
        .replace(/&/g, 'and')
        .replace(/[^a-zA-Z0-9]+/g, '')

    return cleaned || fallback
}

function exportDateLabel(dateStr: string) {
    const [year, month, day] = dateStr.split('-').map(Number)
    if (!year || !month || !day) return dateStr.replace(/[^a-zA-Z0-9]+/g, '-')

    return new Date(year, month - 1, day)
        .toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' })
        .replace(',', '')
        .replace(/\s+/g, '-')
}

function settlementExportCycleLabel({
    dateFrom,
    dateTo,
    monthFilter,
    cycleStartDay,
}: {
    dateFrom: string
    dateTo: string
    monthFilter: string
    cycleStartDay: number
}) {
    if (dateFrom || dateTo) {
        return `${dateFrom ? exportDateLabel(dateFrom) : 'Start'}-${dateTo ? exportDateLabel(dateTo) : 'Latest'}`
    }

    if (monthFilter !== 'all') {
        const bounds = getPayrollCycleBounds(monthFilter, cycleStartDay)
        return `${exportDateLabel(bounds.cycle_start)}-${exportDateLabel(bounds.cycle_end)}`
    }

    return 'All-Settlements'
}

function settlementExportFilename(factoryName: string, cycleLabel: string) {
    return `${filenamePart(factoryName, 'Factory')}_${cycleLabel}.csv`
}

function buildSettlementCsv(settlements: SettlementHistoryItem[]) {
    const paymentModeLabels: Record<PaymentMode, string> = {
        cash: 'Cash',
        bank_transfer: 'Bank transfer',
        upi: 'UPI',
        cheque: 'Cheque',
    }
    const headers = [
        'Settlement ID',
        'Settlement Date',
        'Payroll Month',
        'Worker Name',
        'Worker Type',
        'Worker Detail',
        'Earnings Lines',
        'Total Meters',
        'Payment Mode',
        'Net Revenue Before Deductions',
        'Inam Bonus',
        'Kapaat Deduction',
        'Advance Recovered',
        'PF',
        'ESI',
        'Net Paid',
        'Carried Debt',
        'Final Settlement',
        'Compliance Flag',
        'Manual Adjustments',
    ]
    const rows = settlements.map((settlement) => {
        const manualAdjustments = getManualAdjustmentRows(settlement.itemization_payload)
        const statutory = getItemizationStatutoryDeductions(settlement.itemization_payload)
        const paymentMode = settlement.payment_mode ? paymentModeLabels[settlement.payment_mode] : ''
        const totalMeters = settlement.earningLines.reduce((sum, line) => sum + (line.meters || 0), 0)
        const earningLines = settlement.earningLines.map((line) => {
            const detail = line.subLabel ? ` (${line.subLabel})` : ''
            return `${line.label}${detail}: ${line.quantityLabel} x ${line.rateLabel} = ${line.amount.toFixed(2)}`
        }).join('; ')

        return [
            settlement.id,
            settlementDateKey(settlement.settled_at),
            settlement.month,
            settlement.workerName,
            settlement.worker_type,
            settlement.workerDetail,
            earningLines,
            totalMeters > 0 ? totalMeters.toFixed(1) : '',
            paymentMode,
            toPayrollNumber(settlement.gross_pay).toFixed(2),
            getItemizationNumber(settlement.itemization_payload, 'inamTotal').toFixed(2),
            getItemizationNumber(settlement.itemization_payload, 'kapaatTotal').toFixed(2),
            toPayrollNumber(settlement.advance_deducted).toFixed(2),
            statutory.pfEmployee.toFixed(2),
            statutory.esicEmployee.toFixed(2),
            toPayrollNumber(settlement.net_payout).toFixed(2),
            toPayrollNumber(settlement.carried_forward_debt).toFixed(2),
            settlement.is_final_settlement ? 'Yes' : 'No',
            settlement.compliance_flag ? 'Yes' : 'No',
            manualAdjustments.map((adjustment) => {
                const sign = adjustment.type === 'inam' ? '+' : '-'
                const note = adjustment.note ? ` (${adjustment.note})` : ''
                return `${adjustment.reason}: ${sign}${adjustment.amount.toFixed(2)}${note}`
            }).join('; '),
        ].map(csvCell).join(',')
    })

    return [headers.map(csvCell).join(','), ...rows].join('\n')
}

function downloadCsv(filename: string, contents: string) {
    const blob = new Blob([contents], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function PaidBadge({
    status,
    settledAt,
    paymentMode,
}: {
    status?: 'paid' | 'pending'
    settledAt?: string
    paymentMode?: PaymentMode | null
}) {
    const { t } = useTranslation()
    if (status === 'paid') {
        return (
            <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5 text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">
                        {t('payroll.status.paid')} {settledAt ? new Date(settledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : ''}
                    </span>
                </div>
                {paymentMode && (
                    <Badge variant="outline" className="h-5 border-gray-200 bg-gray-50 px-1.5 text-[9px] font-bold text-gray-600">
                        {getPaymentModeLabel(paymentMode, t)}
                    </Badge>
                )}
            </div>
        )
    }
    return (
        <div className="flex items-center gap-1.5 text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
            <Circle className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-tight">{t('payroll.status.pending')}</span>
        </div>
    )
}

function DeductionBadge({ complianceFlag }: { complianceFlag?: boolean }) {
    if (!complianceFlag) return null
    return (
        <Badge variant="warning" className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] h-4 px-1.5 font-bold uppercase tracking-tight">
            <Info className="h-2.5 w-2.5 mr-1" />
            50% Cap Applied
        </Badge>
    )
}
function MeterWorkerRow({
    worker,
    onToggle,
    isMutating,
    selectedMonth,
    cycleStartDay,
    factoryName,
    canSettle,
    settleDisabledReason,
}: {
    worker: MeterWorkerPayroll
    onToggle: (isFinal?: boolean) => void
    isMutating?: boolean
    selectedMonth: string
    cycleStartDay: number
    factoryName: string
    canSettle: boolean
    settleDisabledReason?: string
}) {
    const [expanded, setExpanded] = useState(false)
    const [isFinalSettlement, setIsFinalSettlement] = useState(false)
    const [waSending, setWaSending] = useState(false)
    const { t } = useTranslation()
    const tl = useTransliterate()
    const isPaid = worker.settlement?.status === 'paid'
    const hasAdvances = worker.totalAdvances > 0
    const cycleBounds = getPayrollCycleBounds(selectedMonth, cycleStartDay)
    const paymentModeLabel = getPaymentModeLabel(worker.settlement?.payment_mode, t)
    
    const preview = getSettlementPreview({
        gross: worker.totalPay,
        totalAdvances: worker.totalAdvances,
        isFinal: isFinalSettlement,
        enrolled: isPfEsiEnrolled(worker),
    })
    
    const displayNet = isPaid ? worker.settlement!.net_payout : preview.netPayout
    const displayDeduction = isPaid ? worker.settlement!.advance_deducted : preview.advanceDeducted
    const displayRemaining = isPaid ? worker.settlement!.carried_forward_debt : preview.remainingDebt
    const isCapped = isPaid ? worker.settlement!.compliance_flag : preview.complianceFlag

    return (
        <div className={cn(
            'border rounded-2xl overflow-hidden transition-all duration-300',
            isPaid ? 'border-green-200 bg-green-50/20 shadow-sm' : 'border-gray-200 bg-white hover:border-saffron-soft'
        )}>
            <div className="flex flex-col sm:flex-row sm:items-center p-4 sm:py-3.5 gap-3">
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="flex items-center gap-3 text-left flex-1 min-w-0 group w-full"
                >
                    <div className="w-10 h-10 rounded-full bg-saffron-soft text-saffron-deep flex items-center justify-center font-bold text-base flex-shrink-0 group-hover:bg-saffron-soft/80 transition-colors">
                        {tl(worker.name)[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="font-bold text-gray-900 truncate flex items-center gap-2">
                            {tl(worker.name)}
                            {isPaid && <Check className="h-3.5 w-3.5 text-green-500" />}
                        </div>
                        <div className="text-[11px] sm:text-xs text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                            <span>{worker.totalMeters.toFixed(1)}m</span>
                            <span className="hidden sm:inline w-1 h-1 rounded-full bg-gray-300" />
                            <span>{worker.machines.length} {worker.machines.length === 1 ? 'machine' : 'machines'}</span>
                        </div>
                        {!isPaid && (
                            <div className="mt-1 text-[10px] font-bold text-gray-500">
                                Gross {formatINR(worker.totalPay, { hideDecimals: true })}
                                {displayDeduction > 0 && <> - Advance {formatINR(displayDeduction, { hideDecimals: true })}</>}
                                {' = '}
                                <span className="text-green-700">Net {formatINR(displayNet, { hideDecimals: true })}</span>
                            </div>
                        )}
                        {(hasAdvances || isCapped) && (
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                {hasAdvances && (
                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-100 text-[9px] h-4 px-1.5 font-bold uppercase tracking-tight">
                                        <HandCoins className="h-2.5 w-2.5 mr-1" />
                                        {formatINR(worker.totalAdvances)} Adv
                                    </Badge>
                                )}
                                <DeductionBadge complianceFlag={isCapped} />
                            </div>
                        )}
                    </div>
                </button>
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 flex-shrink-0 mt-2 sm:mt-0 w-full sm:w-auto bg-gray-50/50 sm:bg-transparent -mx-4 px-4 py-3 sm:mr-1 sm:p-0 border-t sm:border-0 border-gray-100">
                    <div className="text-left sm:text-right flex-1 sm:flex-none flex flex-col justify-center gap-1.5 sm:gap-1">
                        <div className={cn("font-black text-lg tracking-tight leading-none", isPaid ? "text-green-700" : "text-gray-900")}>
                            {formatINR(displayNet)}
                        </div>
                        <div className="flex items-center justify-start sm:justify-end gap-1.5">
                            {isPaid && worker.settlement?.is_final_settlement && (
                                <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none text-[8px] h-3.5 px-1 font-black uppercase">Final</Badge>
                            )}
                            <PaidBadge
                                status={worker.settlement?.status}
                                settledAt={worker.settlement?.settled_at}
                                paymentMode={worker.settlement?.payment_mode}
                            />
                        </div>
                    </div>
                    <Button
                        size="sm"
                        variant={isPaid ? 'outline' : 'default'}
                        className={cn(
                            'h-11 lg:h-9 w-[108px] px-3 text-sm lg:text-[11px] font-bold rounded-md leading-none transition-all whitespace-nowrap',
                            isPaid 
                                ? 'border-green-200 text-green-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600' 
                                : 'bg-saffron hover:bg-saffron-deep text-white shadow-sm hover:shadow-md active:scale-95'
                        )}
                        onClick={() => onToggle(false)}
                        disabled={isMutating || (!isPaid && !canSettle)}
                        title={!isPaid && !canSettle ? settleDisabledReason : undefined}
                    >
                        {isMutating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isPaid ? (
                            'Mark Unpaid'
                        ) : (
                            'Mark Paid'
                        )}
                    </Button>
                </div>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t bg-gray-50/50 px-4 py-4 space-y-4">
                            {/* Calculation Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Earnings Breakdown</h4>
                                    <div className="bg-white border rounded-lg overflow-hidden">
                                        {/* Desktop Table */}
                                        <table className="hidden lg:table w-full text-xs">
                                            <thead className="bg-gray-50 text-gray-500">
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-bold">Machine</th>
                                                    <th className="px-3 py-2 text-right font-bold">Meters</th>
                                                    <th className="px-3 py-2 text-right font-bold">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {worker.machines.map((m, i) => (
                                                    <tr key={i}>
                                                        <td className="px-3 py-2">
                                                            <span className="font-medium">{m.machineName}</span>
                                                            {m.orderLabel && (
                                                                <span className="block text-xs text-saffron-deep/80 font-medium truncate max-w-[120px]" title={m.orderLabel}>
                                                                    {m.orderLabel}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-gray-500">{m.meters.toFixed(1)} @ ₹{m.rate}</td>
                                                        <td className="px-3 py-2 text-right font-semibold">{formatINR(m.pay)}</td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-gray-50/50 font-bold">
                                                    <td className="px-3 py-2">Gross Total</td>
                                                    <td colSpan={2} className="px-3 py-2 text-right text-saffron-deep">{formatINR(worker.totalPay)}</td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        {/* Mobile Cards */}
                                        <div className="lg:hidden divide-y divide-gray-100">
                                            {worker.machines.map((m, i) => (
                                                <div key={i} className="p-3 space-y-1.5">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold text-gray-900">{m.machineName}</span>
                                                        <span className="font-semibold text-gray-900">{formatINR(m.pay)}</span>
                                                    </div>
                                                    {m.orderLabel && (
                                                        <div className="text-xs text-gray-500 truncate" title={m.orderLabel}>
                                                            {m.orderLabel}
                                                        </div>
                                                    )}
                                                    <div className="text-xs text-gray-500 flex justify-between">
                                                        <span>Meters</span>
                                                        <span>{m.meters.toFixed(1)} @ ₹{m.rate}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="flex justify-between items-center bg-gray-50/50 p-3 font-bold text-sm">
                                                <span>Gross Total</span>
                                                <span className="text-saffron-deep">{formatINR(worker.totalPay)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Settlement Audit</h4>
                                    <div className="bg-white border rounded-lg p-3 space-y-2.5">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Gross Earnings</span>
                                            <span className="font-bold">{formatINR(worker.totalPay)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm text-amber-600">
                                            <span className="flex items-center gap-1.5">
                                                <HandCoins className="h-3.5 w-3.5" />
                                                Advances Recovered
                                            </span>
                                            <span className="font-bold">-{formatINR(displayDeduction)}</span>
                                        </div>
                                        {isCapped && !isFinalSettlement && (
                                            <div className="flex items-center gap-2 text-[10px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-100 italic">
                                                <Info className="h-3 w-3 flex-shrink-0" />
                                                Legally capped at 50% of gross earnings.
                                            </div>
                                        )}
                                        {isFinalSettlement && worker.totalAdvances > 0 && !isPaid && (
                                            <div className="flex items-center gap-2 text-[10px] text-red-700 bg-red-50 p-2 rounded border border-red-100 font-bold">
                                                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                                                Final settlement — 100% of advances will be recovered.
                                            </div>
                                        )}
                                        <div className="border-t pt-2 mt-1 flex justify-between text-base font-black text-gray-900">
                                            <span>Net Payout</span>
                                            <span className="text-green-600">{formatINR(displayNet)}</span>
                                        </div>
                                        {displayRemaining > 0 && (
                                            <div className="flex justify-between text-xs font-bold text-red-600 bg-red-50 p-2 rounded border border-red-100">
                                                <span>Carry-Forward Debt</span>
                                                <span>{formatINR(displayRemaining)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Actions Footer */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-100">
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={cn(
                                            'h-8 text-[11px] gap-1.5',
                                            !isPaid && 'cursor-not-allowed text-gray-300'
                                        )}
                                        disabled={!isPaid}
                                        title={!isPaid ? 'Settle payroll first to download a payslip' : undefined}
                                        onClick={() => isPaid && generateMeterPayslip({
                                            factoryName,
                                            month: selectedMonth,
                                            workerName: worker.name,
                                            cycleStartDate: cycleBounds.cycle_start,
                                            cycleEndDate: cycleBounds.cycle_end,
                                            machines: worker.machines,
                                            totalMeters: worker.totalMeters,
                                            totalPay: worker.totalPay,
                                            advanceDeducted: displayDeduction,
                                            remainingDebt: displayRemaining,
                                            netPay: displayNet,
                                            paymentMode: paymentModeLabel,
                                            itemization: getPayslipItemization(worker.settlement?.itemization_payload),
                                        })}
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        PDF Slip
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={cn(
                                            'h-8 text-[11px] gap-1.5 transition-all',
                                            worker.whatsapp_number && isPaid
                                                ? 'text-green-700 border-green-200 hover:bg-green-50'
                                                : 'text-gray-300 border-gray-200 cursor-not-allowed'
                                        )}
                                        disabled={!worker.whatsapp_number || !isPaid || waSending}
                                        title={
                                            !worker.whatsapp_number
                                                ? 'Worker has no WhatsApp number'
                                                : !isPaid
                                                ? 'Settle payroll first to send payslip'
                                                : 'Send payslip via WhatsApp'
                                        }
                                        onClick={async () => {
                                            if (!worker.settlement?.id) return
                                            setWaSending(true)
                                            const result = await sendPayslipWhatsApp(
                                                worker.id,
                                                'meter',
                                                worker.settlement.id
                                            )
                                            setWaSending(false)
                                            if (result.error) toast.error(result.error)
                                            else if (result.skipped) toast.info(`Skipped: ${result.reason}`)
                                            else toast.success('Payslip sent via WhatsApp ✅')
                                        }}
                                    >
                                        {waSending
                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            : <Send className="h-3.5 w-3.5" />
                                        }
                                        WhatsApp
                                    </Button>
                                </div>
                                {!isPaid && (
                                    <div className="flex items-center gap-3">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input 
                                                type="checkbox"
                                                checked={isFinalSettlement}
                                                className="w-3.5 h-3.5 text-red-600 rounded border-gray-300 focus:ring-red-500 accent-red-600" 
                                                onChange={(e) => setIsFinalSettlement(e.target.checked)}
                                            />
                                            <span className={cn(
                                                "text-[11px] font-bold transition-colors uppercase tracking-tight",
                                                isFinalSettlement ? "text-red-600" : "text-gray-500 group-hover:text-red-600"
                                            )}>Final Settlement</span>
                                        </label>
                                        <Button 
                                            size="sm" 
                                            variant="destructive" 
                                            className={cn(
                                                "h-8 text-[11px] font-black uppercase tracking-widest transition-all",
                                                isFinalSettlement 
                                                    ? "bg-red-600 hover:bg-red-700 shadow-md" 
                                                    : "bg-gray-400 hover:bg-gray-500 cursor-default"
                                            )}
                                            onClick={() => isFinalSettlement && onToggle(true)}
                                            disabled={isMutating || !isFinalSettlement}
                                            title={!isFinalSettlement ? 'Check "Final Settlement" to enable' : undefined}
                                        >
                                            Settle All
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
function FixedWorkerRow({
    worker,
    onToggle,
    isMutating,
    selectedMonth,
    cycleStartDay,
    factoryName,
    canSettle,
    settleDisabledReason,
}: {
    worker: FixedWorkerPayroll
    onToggle: (isFinal?: boolean) => void
    isMutating?: boolean
    selectedMonth: string
    cycleStartDay: number
    factoryName: string
    canSettle: boolean
    settleDisabledReason?: string
}) {
    const [expanded, setExpanded] = useState(false)
    const [isFinalSettlement, setIsFinalSettlement] = useState(false)
    const [waSending, setWaSending] = useState(false)
    const { t } = useTranslation()
    const tl = useTransliterate()
    const isPaid = worker.settlement?.status === 'paid'
    const isDaily = worker.role === 'daily'
    const hasAdvances = worker.totalAdvances > 0
    const cycleBounds = getPayrollCycleBounds(selectedMonth, cycleStartDay)
    const paymentModeLabel = getPaymentModeLabel(worker.settlement?.payment_mode, t)

    const preview = getSettlementPreview({
        gross: worker.earnedPay,
        totalAdvances: worker.totalAdvances,
        isFinal: isFinalSettlement,
        enrolled: isPfEsiEnrolled(worker),
    })
    
    const displayNet = isPaid ? worker.settlement!.net_payout : preview.netPayout
    const displayDeduction = isPaid ? worker.settlement!.advance_deducted : preview.advanceDeducted
    const displayRemaining = isPaid ? worker.settlement!.carried_forward_debt : preview.remainingDebt
    const isCapped = isPaid ? worker.settlement!.compliance_flag : preview.complianceFlag

    return (
        <div className={cn(
            'border rounded-2xl overflow-hidden transition-all duration-300',
            isPaid ? 'border-green-200 bg-green-50/20 shadow-sm' : 'border-gray-200 bg-white hover:border-saffron-soft'
        )}>
            <div className="flex flex-col sm:flex-row sm:items-center p-4 sm:py-3.5 gap-3">
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="flex items-start sm:items-center gap-3 text-left flex-1 min-w-0 group w-full"
                >
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={cn('text-xs px-2 py-0.5 rounded-full font-black uppercase tracking-wider', ROLE_COLORS[worker.role] || 'bg-gray-100 text-gray-700')}>
                                {t(`workers.roles.${worker.role}`) || worker.role}
                            </span>
                            {isPaid && <Check className="h-3 w-3 text-green-500" />}
                        </div>
                        <span className="font-bold text-gray-900 truncate block text-base">{tl(worker.name)}</span>
                        {!isPaid && (
                            <div className="mt-1 text-[10px] font-bold text-gray-500">
                                Gross {formatINR(worker.earnedPay, { hideDecimals: true })}
                                {displayDeduction > 0 && <> - Advance {formatINR(displayDeduction, { hideDecimals: true })}</>}
                                {' = '}
                                <span className="text-green-700">Net {formatINR(displayNet, { hideDecimals: true })}</span>
                            </div>
                        )}
                        {(hasAdvances || isCapped) && (
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                {hasAdvances && (
                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-100 text-[9px] h-4 px-1.5 font-bold uppercase tracking-tight">
                                        <HandCoins className="h-2.5 w-2.5 mr-1" />
                                        {formatINR(worker.totalAdvances)} Adv
                                    </Badge>
                                )}
                                <DeductionBadge complianceFlag={isCapped} />
                            </div>
                        )}
                    </div>
                </button>
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 flex-shrink-0 mt-2 sm:mt-0 w-full sm:w-auto bg-gray-50/50 sm:bg-transparent -mx-4 px-4 py-3 sm:mr-1 sm:p-0 border-t sm:border-0 border-gray-100">
                    <div className="text-left sm:text-right flex-1 sm:flex-none flex flex-col justify-center gap-1.5 sm:gap-1">
                        <div className={cn("font-black text-lg tracking-tight leading-none", isPaid ? "text-green-700" : "text-gray-900")}>
                            {formatINR(displayNet)}
                        </div>
                        <div className="flex items-center justify-start sm:justify-end gap-1.5">
                            {isPaid && worker.settlement?.is_final_settlement && (
                                <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none text-[8px] h-3.5 px-1 font-black uppercase">Final</Badge>
                            )}
                            <PaidBadge
                                status={worker.settlement?.status}
                                settledAt={worker.settlement?.settled_at}
                                paymentMode={worker.settlement?.payment_mode}
                            />
                        </div>
                    </div>
                    <Button
                        size="sm"
                        variant={isPaid ? 'outline' : 'default'}
                        className={cn(
                            'h-11 lg:h-9 w-[108px] px-3 text-sm lg:text-[11px] font-bold rounded-md leading-none transition-all whitespace-nowrap',
                            isPaid 
                                ? 'border-green-200 text-green-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600' 
                                : 'bg-saffron hover:bg-saffron-deep text-white shadow-sm hover:shadow-md active:scale-95'
                        )}
                        onClick={() => onToggle(false)}
                        disabled={isMutating || (!isPaid && !canSettle)}
                        title={!isPaid && !canSettle ? settleDisabledReason : undefined}
                    >
                        {isMutating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isPaid ? (
                            'Mark Unpaid'
                        ) : (
                            'Mark Paid'
                        )}
                    </Button>
                </div>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t bg-gray-50/50 px-4 py-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Calculations</h4>
                                    <div className="bg-white border rounded-lg p-3 space-y-2 text-sm">
                                        {isDaily ? (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Fixed Monthly</span>
                                                    <span>{formatINR(worker.monthly_salary)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Days Present</span>
                                                    <span className="font-bold">{worker.daysWorked ?? 0} / 30</span>
                                                </div>
                                                <div className="flex justify-between text-xs text-saffron-deep italic border-t pt-2">
                                                    <span>Earned Gross</span>
                                                    <span className="font-black">{formatINR(worker.earnedPay)}</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex justify-between font-bold">
                                                <span className="text-gray-500">Monthly Salary</span>
                                                <span className="text-saffron-deep">{formatINR(worker.monthly_salary)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Settlement Audit</h4>
                                    <div className="bg-white border rounded-lg p-3 space-y-2.5">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Gross Earnings</span>
                                            <span className="font-bold">{formatINR(worker.earnedPay)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm text-amber-600">
                                            <span className="flex items-center gap-1.5">
                                                <HandCoins className="h-3.5 w-3.5" />
                                                Advances Recovered
                                            </span>
                                            <span className="font-bold">-{formatINR(displayDeduction)}</span>
                                        </div>
                                        {isCapped && !isFinalSettlement && (
                                            <div className="flex items-center gap-2 text-[10px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-100 italic">
                                                <Info className="h-3 w-3 flex-shrink-0" />
                                                Legally capped at 50% of gross earnings.
                                            </div>
                                        )}
                                        {isFinalSettlement && worker.totalAdvances > 0 && !isPaid && (
                                            <div className="flex items-center gap-2 text-[10px] text-red-700 bg-red-50 p-2 rounded border border-red-100 font-bold">
                                                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                                                Final settlement — 100% of advances will be recovered.
                                            </div>
                                        )}
                                        <div className="border-t pt-2 mt-1 flex justify-between text-base font-black text-gray-900">
                                            <span>Net Payout</span>
                                            <span className="text-green-600">{formatINR(displayNet)}</span>
                                        </div>
                                        {displayRemaining > 0 && (
                                            <div className="flex justify-between text-xs font-bold text-red-600 bg-red-50 p-2 rounded border border-red-100">
                                                <span>Carry-Forward Debt</span>
                                                <span>{formatINR(displayRemaining)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Actions Footer */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-100">
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={cn(
                                            'h-8 text-[11px] gap-1.5',
                                            !isPaid && 'cursor-not-allowed text-gray-300'
                                        )}
                                        disabled={!isPaid}
                                        title={!isPaid ? 'Settle payroll first to download a payslip' : undefined}
                                        onClick={() => isPaid && generateFixedPayslip({
                                            factoryName,
                                            month: selectedMonth,
                                            workerName: worker.name,
                                            cycleStartDate: cycleBounds.cycle_start,
                                            cycleEndDate: cycleBounds.cycle_end,
                                            role: worker.role,
                                            monthlySalary: worker.monthly_salary,
                                            daysWorked: worker.daysWorked,
                                            earnedPay: worker.earnedPay,
                                            advanceDeducted: displayDeduction,
                                            remainingDebt: displayRemaining,
                                            netPay: displayNet,
                                            paymentMode: paymentModeLabel,
                                            itemization: getPayslipItemization(worker.settlement?.itemization_payload),
                                        })}
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        PDF Slip
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={cn(
                                            'h-8 text-[11px] gap-1.5 transition-all',
                                            worker.whatsapp_number && isPaid
                                                ? 'text-green-700 border-green-200 hover:bg-green-50'
                                                : 'text-gray-300 border-gray-200 cursor-not-allowed'
                                        )}
                                        disabled={!worker.whatsapp_number || !isPaid || waSending}
                                        title={
                                            !worker.whatsapp_number
                                                ? 'Worker has no WhatsApp number'
                                                : !isPaid
                                                ? 'Settle payroll first to send payslip'
                                                : 'Send payslip via WhatsApp'
                                        }
                                        onClick={async () => {
                                            if (!worker.settlement?.id) return
                                            setWaSending(true)
                                            const result = await sendPayslipWhatsApp(
                                                worker.id,
                                                'fixed',
                                                worker.settlement.id
                                            )
                                            setWaSending(false)
                                            if (result.error) toast.error(result.error)
                                            else if (result.skipped) toast.info(`Skipped: ${result.reason}`)
                                            else toast.success('Payslip sent via WhatsApp ✅')
                                        }}
                                    >
                                        {waSending
                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            : <Send className="h-3.5 w-3.5" />
                                        }
                                        WhatsApp
                                    </Button>
                                </div>
                                {!isPaid && (
                                    <div className="flex items-center gap-3">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input 
                                                type="checkbox"
                                                checked={isFinalSettlement}
                                                className="w-3.5 h-3.5 text-red-600 rounded border-gray-300 focus:ring-red-500 accent-red-600" 
                                                onChange={(e) => setIsFinalSettlement(e.target.checked)}
                                            />
                                            <span className={cn(
                                                "text-[11px] font-bold transition-colors uppercase tracking-tight",
                                                isFinalSettlement ? "text-red-600" : "text-gray-500 group-hover:text-red-600"
                                            )}>Final Settlement</span>
                                        </label>
                                        <Button 
                                            size="sm" 
                                            variant="destructive" 
                                            className={cn(
                                                "h-8 text-[11px] font-black uppercase tracking-widest transition-all",
                                                isFinalSettlement 
                                                    ? "bg-red-600 hover:bg-red-700 shadow-md" 
                                                    : "bg-gray-400 hover:bg-gray-500 cursor-default"
                                            )}
                                            onClick={() => isFinalSettlement && onToggle(true)}
                                            disabled={isMutating || !isFinalSettlement}
                                            title={!isFinalSettlement ? 'Check "Final Settlement" to enable' : undefined}
                                        >
                                            Settle All
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Settlement Dialogue (V2 Hardening) ───────────────────────────────────────
function SettlementDialog({
    open,
    onOpenChange,
    worker,
    selectedMonth,
    onSettle,
    isMutating,
    initialIsFinal = false,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    worker: MeterWorkerPayroll | FixedWorkerPayroll
    selectedMonth: string
    onSettle: (params: {
        isFinal: boolean
        manualDeduction: number | null
        paymentMode: PaymentMode
        manualAdjustments: PayrollManualAdjustment[]
        verifiedByOwner: boolean
    }) => void
    isMutating: boolean
    initialIsFinal?: boolean
}) {
    const { t } = useTranslation()
    const tl = useTransliterate()
    const enrolled = isPfEsiEnrolled(worker)
    const gross = (worker as MeterWorkerPayroll).totalPay || (worker as FixedWorkerPayroll).earnedPay || 0
    const initialRecovery = calculateAdvanceRecovery(gross, worker.totalAdvances || 0, initialIsFinal ? 100 : 50)
    const initialAutoDeduction = parseFloat(initialRecovery.recommendedRecovery)
    const [isFinal, setIsFinal] = useState(initialIsFinal)
    const [manualDeduction, setManualDeduction] = useState<string>(() => formatRecoveryInput(initialAutoDeduction))
    const [advanceEdited, setAdvanceEdited] = useState(false)
    const [confirmed, setConfirmed] = useState(false)
    const [manualAdjustments, setManualAdjustments] = useState<PendingPayrollManualAdjustment[]>([])
    const [adjType, setAdjType] = useState<PayrollManualAdjustmentType | ''>('')
    const [adjReason, setAdjReason] = useState<PayrollManualAdjustmentReason | ''>('')
    const [adjAmount, setAdjAmount] = useState('')
    const [adjNote, setAdjNote] = useState('')
    const [paymentMode, setPaymentMode] = useState<PaymentMode | ''>('')
    const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false)
    const adjustmentIdRef = useRef(0)
    const parsedManualDeduction = parseFloat(manualDeduction)
    const manualDeductionValue = manualDeduction.trim() === '' || !Number.isFinite(parsedManualDeduction) ? null : parsedManualDeduction
    const {
        adjustedGross,
        inamTotal,
        kapaatTotal,
        manualAdjustmentTotal,
        pfEmployee,
        esicEmployee,
        statutoryDeduction,
        maxDeduction,
        autoDeduction,
        advanceDeducted,
        netPayout,
        remainingDebt,
    } = getSettlementPreview({
        gross,
        totalAdvances: worker.totalAdvances || 0,
        isFinal,
        enrolled,
        manualDeduction: manualDeductionValue,
        manualAdjustments,
    })
    const advanceRecoveryExplainer = getAdvanceRecoveryExplainer({
        gross: adjustedGross,
        totalAdvances: worker.totalAdvances || 0,
        maxDeduction,
        autoDeduction,
        isFinal,
    })

    useEffect(() => {
        if (advanceEdited) return undefined
        let disposed = false
        queueMicrotask(() => {
            if (!disposed) setManualDeduction(formatRecoveryInput(autoDeduction))
        })
        return () => { disposed = true }
    }, [advanceEdited, autoDeduction])

    const handleAddAdjustment = () => {
        const parsed = sanitizePayrollManualAdjustment({
            adjustment_type: adjType,
            reason: adjReason,
            amount: Number(adjAmount),
            note: adjNote,
        })

        if (!parsed.success) {
            toast.error(parsed.error)
            return
        }

        adjustmentIdRef.current += 1
        const nextAdjustment: PendingPayrollManualAdjustment = {
            id: globalThis.crypto?.randomUUID?.() || `adjustment-${adjustmentIdRef.current}`,
            ...parsed.data,
        }
        const nextAdjustments = [...manualAdjustments, nextAdjustment]
        const nextPreview = getSettlementPreview({
            gross,
            totalAdvances: worker.totalAdvances || 0,
            isFinal,
            enrolled,
            manualDeduction: manualDeductionValue,
            manualAdjustments: nextAdjustments,
        })

        if (nextPreview.netPayout < 0) {
            toast.error('Kapaat cannot make the final payout negative.')
            return
        }

        setManualAdjustments(nextAdjustments)
        setAdjType('')
        setAdjReason('')
        setAdjAmount('')
        setAdjNote('')
        toast.success('Adjustment added')
    }

    const handleRemoveAdjustment = (id: string) => {
        setManualAdjustments((current) => current.filter((adjustment) => adjustment.id !== id))
    }

    const submitSettlement = () => {
        if (!paymentMode) {
            toast.error(t('payroll.payment.modeRequired'))
            return
        }

        if (netPayout < 0) {
            toast.error('Kapaat cannot make the final payout negative.')
            return
        }

        onSettle({
            isFinal,
            manualDeduction: manualDeductionValue,
            paymentMode,
            manualAdjustments: manualAdjustments.map((adjustment) => ({
                adjustment_type: adjustment.adjustment_type,
                reason: adjustment.reason,
                amount: adjustment.amount,
                note: adjustment.note,
            })),
            verifiedByOwner: confirmed,
        })
        setShowAdvanceConfirm(false)
    }

    const handleFinalChange = (checked: boolean | 'indeterminate') => {
        const nextIsFinal = !!checked
        const nextRecovery = calculateAdvanceRecovery(gross, worker.totalAdvances || 0, nextIsFinal ? 100 : 50)

        setIsFinal(nextIsFinal)
        setAdvanceEdited(false)
        setManualDeduction(formatRecoveryInput(parseFloat(nextRecovery.recommendedRecovery)))
    }

    const shouldConfirmAdvanceAdjustment =
        advanceEdited &&
        manualDeductionValue !== null &&
        Math.abs(manualDeductionValue - autoDeduction) > 0.001

    return (
        <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-none shadow-2xl flex flex-col max-h-[96dvh] sm:max-h-[90vh]">
                <div className="bg-saffron p-4 sm:p-6 text-white shrink-0 relative">
                    <DialogTitle className="text-lg sm:text-xl font-black uppercase tracking-tight flex items-center gap-3 pr-8">
                        <HandCoins className="h-5 w-5 sm:h-6 sm:w-6" />
                        <span className="truncate">{tl(worker.name)}</span>
                    </DialogTitle>
                    <DialogDescription className="text-white/80 mt-1 text-xs sm:text-sm font-medium italic opacity-90">
                        Finalizing payroll for {monthLabel(selectedMonth)} cycle
                    </DialogDescription>
                </div>

                <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-y-auto flex-1">
                    {enrolled ? (
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <h4 className="text-xs font-black text-blue-800 uppercase tracking-wider">Statutory Deductions (Estimated)</h4>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[11px] text-blue-700">
                                    <span>Worker PF (12%):</span> <span className="font-bold text-right">{formatINR(pfEmployee)}</span>
                                    <span>Worker ESI (0.75%):</span> <span className="font-bold text-right">{formatINR(esicEmployee)}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-[11px] text-slate-600">
                            {t('worker.pfEsi.notEnrolled')}
                        </div>
                    )}

                    {/* Adjustment Section */}
                    <div className="flex flex-col gap-3">
                        <div className="px-1">
                            <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Manual Adjustment</h4>
                            <p className="mt-1 text-[11px] text-gray-500">
                                Add an inam bonus or kapaat deduction before confirming payout.
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 border-dashed bg-gray-50/50 p-3 sm:p-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-[11px] font-black uppercase tracking-wider text-gray-500">
                                        Adjustment Type
                                    </Label>
                                    <Select value={adjType} onValueChange={(value) => setAdjType(value as PayrollManualAdjustmentType)}>
                                        <SelectTrigger className="h-10 w-full bg-white text-xs">
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="inam">Inam / Bonus</SelectItem>
                                            <SelectItem value="kapaat">Kapaat / Deduction</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-[11px] font-black uppercase tracking-wider text-gray-500">
                                        Reason
                                    </Label>
                                    <Select value={adjReason} onValueChange={(value) => setAdjReason(value as PayrollManualAdjustmentReason)}>
                                        <SelectTrigger className="h-10 w-full bg-white text-xs">
                                            <SelectValue placeholder="Select reason" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PAYROLL_MANUAL_ADJUSTMENT_REASONS.map((reason) => (
                                                <SelectItem key={reason} value={reason}>
                                                    {reason}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr]">
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-[11px] font-black uppercase tracking-wider text-gray-500">
                                        Amount
                                    </Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">₹</span>
                                        <Input
                                            placeholder="0"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            inputMode="decimal"
                                            className="h-10 bg-white pl-8 text-xs"
                                            value={adjAmount}
                                            onChange={(event) => setAdjAmount(event.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-[11px] font-black uppercase tracking-wider text-gray-500">
                                        Note
                                    </Label>
                                    <Input
                                        placeholder="Short owner note"
                                        className="h-10 bg-white text-xs"
                                        value={adjNote}
                                        onChange={(event) => setAdjNote(event.target.value)}
                                    />
                                </div>
                            </div>

                            <Button
                                type="button"
                                size="sm"
                                className="h-10 self-start bg-saffron px-4 text-xs font-black uppercase tracking-widest text-white hover:bg-saffron-deep"
                                onClick={handleAddAdjustment}
                            >
                                <Plus className="h-4 w-4" />
                                Add Adjustment
                            </Button>

                            {manualAdjustments.length > 0 && (
                                <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">
                                    {manualAdjustments.map((adjustment) => {
                                        const isInam = adjustment.adjustment_type === 'inam'
                                        return (
                                            <div
                                                key={adjustment.id}
                                                className="rounded-lg border border-gray-200 bg-white p-3"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <Badge
                                                                variant="outline"
                                                                className={cn(
                                                                    'text-[10px] font-black uppercase',
                                                                    isInam
                                                                        ? 'border-green-200 bg-green-50 text-green-700'
                                                                        : 'border-red-200 bg-red-50 text-red-700'
                                                                )}
                                                            >
                                                                {isInam ? 'Inam / Bonus' : 'Kapaat / Deduction'}
                                                            </Badge>
                                                            <span className="text-xs font-bold text-gray-700">{adjustment.reason}</span>
                                                        </div>
                                                        <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{adjustment.note}</p>
                                                    </div>
                                                    <div className="flex shrink-0 flex-col items-end gap-2">
                                                        <span
                                                            className={cn(
                                                                'text-sm font-black',
                                                                isInam ? 'text-green-700' : 'text-red-700'
                                                            )}
                                                        >
                                                            {isInam ? '+' : '-'}{formatINR(adjustment.amount)}
                                                        </span>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="xs"
                                                            className="h-7 px-2 text-[10px] font-bold text-gray-500 hover:text-red-600"
                                                            onClick={() => handleRemoveAdjustment(adjustment.id)}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                            Remove
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Advance Deduction Override */}
                    <div className="space-y-4 pt-2 border-t border-gray-100">
                        <div className="flex items-center justify-between gap-3">
                            <div className="space-y-1">
                                <Label className="text-sm font-black text-gray-700">Advance Recovery</Label>
                                <p className="text-[10px] text-gray-500 italic">Recommended: {formatINR(autoDeduction)} (of {formatINR(worker.totalAdvances)} total debt)</p>
                            </div>
                            <div className="relative w-40">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">₹</span>
                                <Input 
                                    className="pl-8 h-11 font-black text-indigo-700 text-right text-lg border-gray-200 bg-white" 
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    inputMode="decimal"
                                    aria-describedby="advance-recovery-explainer"
                                    value={manualDeduction}
                                    onChange={e => {
                                        setAdvanceEdited(true)
                                        setManualDeduction(e.target.value)
                                    }}
                                />
                            </div>
                        </div>
                        <div
                            id="advance-recovery-explainer"
                            className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2 text-[10px] leading-relaxed text-amber-800"
                        >
                            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <p>{advanceRecoveryExplainer}</p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-black text-gray-700">{t('payroll.payment.modeLabel')}</Label>
                            <Select value={paymentMode} onValueChange={(value) => setPaymentMode(value as PaymentMode)}>
                                <SelectTrigger className="h-11 border-gray-200 bg-white">
                                    <SelectValue placeholder={t('payroll.payment.modeLabel')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash">{t('payroll.payment.cash')}</SelectItem>
                                    <SelectItem value="bank_transfer">{t('payroll.payment.bankTransfer')}</SelectItem>
                                    <SelectItem value="upi">{t('payroll.payment.upi')}</SelectItem>
                                    <SelectItem value="cheque">{t('payroll.payment.cheque')}</SelectItem>
                                </SelectContent>
                            </Select>
                            {!paymentMode && (
                                <p className="text-[11px] text-red-500">{t('payroll.payment.modeRequired')}</p>
                            )}
                        </div>

                        <div className="flex items-start space-x-3 bg-red-50/50 p-4 rounded-xl border border-red-100">
                            <Checkbox id="final" checked={isFinal} onCheckedChange={handleFinalChange} className="mt-1" />
                            <div className="grid gap-1.5 leading-none">
                                <label htmlFor="final" className="text-xs font-black text-red-700 uppercase leading-none cursor-pointer">
                                    Mark as Final Settlement
                                </label>
                                <p className="text-[10px] text-red-500 font-medium leading-relaxed opacity-80">
                                    {t('advances.exit.finalSettleWarning')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 p-4 sm:p-6 border-t border-gray-200 space-y-3 sm:space-y-4 shrink-0">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border border-gray-200 bg-white p-3 text-[11px]">
                        <span className="text-gray-500">Base Earnings</span>
                        <span className="text-right font-bold text-gray-800">{formatINR(gross)}</span>
                        <span className="text-green-700">Inam / Bonus</span>
                        <span className="text-right font-bold text-green-700">+{formatINR(inamTotal)}</span>
                        <span className="text-red-700">Kapaat / Deduction</span>
                        <span className="text-right font-bold text-red-700">-{formatINR(kapaatTotal)}</span>
                        <span className="text-gray-500">Manual Adjustment</span>
                        <span className={cn(
                            'text-right font-bold',
                            manualAdjustmentTotal >= 0 ? 'text-green-700' : 'text-red-700'
                        )}>
                            {manualAdjustmentTotal >= 0 ? '+' : '-'}{formatINR(Math.abs(manualAdjustmentTotal))}
                        </span>
                        <span className="text-amber-700">Advance Recovery</span>
                        <span className="text-right font-bold text-amber-700">-{formatINR(advanceDeducted)}</span>
                        {statutoryDeduction > 0 && (
                            <>
                                <span className="text-blue-700">PF/ESI</span>
                                <span className="text-right font-bold text-blue-700">-{formatINR(statutoryDeduction)}</span>
                            </>
                        )}
                    </div>
                    <div className="flex justify-between items-end">
                        <div className="space-y-0.5 sm:space-y-1">
                            <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest block">Confirmed Payout</span>
                            <div className="text-3xl sm:text-4xl font-black text-green-600 tracking-tighter leading-none">
                                {formatINR(netPayout)}
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 mb-0.5 sm:mb-1">
                            <span className="text-[10px] sm:text-[11px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                                Debt: {formatINR(remainingDebt)}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-1 sm:pt-2">
                        <Checkbox id="confirm" checked={confirmed} onCheckedChange={(c) => setConfirmed(!!c)} />
                        <label htmlFor="confirm" className="text-[11px] sm:text-xs font-bold text-gray-600 cursor-pointer select-none">
                            I verify calculations are correct
                        </label>
                    </div>

                    <div className="flex gap-2 sm:gap-3">
                        <Button variant="outline" className="flex-1 h-10 sm:h-12 text-xs sm:text-sm font-bold border-gray-300 hover:bg-gray-100 transition-colors" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button 
                            className="flex-[2] h-10 sm:h-12 text-xs sm:text-sm bg-saffron hover:bg-saffron-deep text-white font-black uppercase tracking-widest shadow-lg shadow-saffron-soft disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed transition-all" 
                            disabled={!confirmed || isMutating || netPayout < 0 || !paymentMode}
                            onClick={() => {
                                if (shouldConfirmAdvanceAdjustment) {
                                    setShowAdvanceConfirm(true)
                                    return
                                }
                                submitSettlement()
                            }}
                        >
                            {isMutating ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirm'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
        <ConfirmActionDialog
            open={showAdvanceConfirm}
            onOpenChange={setShowAdvanceConfirm}
            title={t('confirm.title')}
            description={t('confirm.payroll.adjustAdvance')}
            onConfirm={submitSettlement}
            isLoading={isMutating}
        />
        </>
    )
}

function PayrollRulesDialog({
    open,
    onOpenChange,
    cycleStartDay,
    payDateDay,
    payReminderDays,
    onSave,
    isSaving,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    cycleStartDay: number
    payDateDay: number
    payReminderDays: number
    onSave: (input: { cycleStartDay: number; payDateDay: number; payReminderDays: number }) => void
    isSaving: boolean
}) {
    const [draftCycleStartDay, setDraftCycleStartDay] = useState(cycleStartDay)
    const [draftPayDateDay, setDraftPayDateDay] = useState(payDateDay)
    const [draftPayReminderDays, setDraftPayReminderDays] = useState(payReminderDays)

    const clampNumber = (value: string, min: number, max: number) => {
        const parsed = Number(value)
        if (!Number.isFinite(parsed)) return min
        return Math.min(max, Math.max(min, Math.trunc(parsed)))
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Payroll rules</DialogTitle>
                    <DialogDescription>
                        Configure the cycle and pay date used to decide when wages become due.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    <div className="grid gap-1.5">
                        <Label className="text-xs font-black uppercase tracking-widest text-gray-500">Cycle start day</Label>
                        <Input
                            type="number"
                            min={1}
                            max={28}
                            value={draftCycleStartDay}
                            onChange={(event) => setDraftCycleStartDay(clampNumber(event.target.value, 1, 28))}
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label className="text-xs font-black uppercase tracking-widest text-gray-500">Pay date day</Label>
                        <Input
                            type="number"
                            min={1}
                            max={28}
                            value={draftPayDateDay}
                            onChange={(event) => setDraftPayDateDay(clampNumber(event.target.value, 1, 28))}
                        />
                        <p className="text-xs leading-relaxed text-gray-500">
                            We use the first matching pay date after the cycle closes.
                        </p>
                    </div>
                    <div className="grid gap-1.5">
                        <Label className="text-xs font-black uppercase tracking-widest text-gray-500">Reminder days</Label>
                        <Input
                            type="number"
                            min={0}
                            max={14}
                            value={draftPayReminderDays}
                            onChange={(event) => setDraftPayReminderDays(clampNumber(event.target.value, 0, 14))}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        className="bg-saffron font-bold text-white hover:bg-saffron-deep"
                        disabled={isSaving}
                        onClick={() => onSave({
                            cycleStartDay: draftCycleStartDay,
                            payDateDay: draftPayDateDay,
                            payReminderDays: draftPayReminderDays,
                        })}
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save rules'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

type PayDateWorkerItem = {
    key: string
    workerType: 'meter' | 'fixed'
    worker: MeterWorkerPayroll | FixedWorkerPayroll
    name: string
    detail: string
    gross: number
    netPayout: number
    advanceDeducted: number
    isPaid: boolean
    settledAt?: string
}

function buildPayDateItems(
    meterWorkers: MeterWorkerPayroll[] = [],
    fixedWorkers: FixedWorkerPayroll[] = []
): PayDateWorkerItem[] {
    const meterItems = meterWorkers.map((worker) => {
        const isPaid = worker.settlement?.status === 'paid'
        const preview = getSettlementPreview({
            gross: worker.totalPay,
            totalAdvances: worker.totalAdvances,
            isFinal: false,
            enrolled: isPfEsiEnrolled(worker),
        })

        return {
            key: `meter-${worker.id}`,
            workerType: 'meter' as const,
            worker,
            name: worker.name,
            detail: `${worker.totalMeters.toFixed(1)}m · ${worker.machines.length} ${worker.machines.length === 1 ? 'machine' : 'machines'}`,
            gross: worker.totalPay,
            netPayout: isPaid ? worker.settlement!.net_payout : preview.netPayout,
            advanceDeducted: isPaid ? worker.settlement!.advance_deducted : preview.advanceDeducted,
            isPaid,
            settledAt: worker.settlement?.settled_at,
        }
    })

    const fixedItems = fixedWorkers.map((worker) => {
        const isPaid = worker.settlement?.status === 'paid'
        const preview = getSettlementPreview({
            gross: worker.earnedPay,
            totalAdvances: worker.totalAdvances,
            isFinal: false,
            enrolled: isPfEsiEnrolled(worker),
        })
        const roleLabel = ROLE_LABELS[worker.role] || worker.role

        return {
            key: `fixed-${worker.id}`,
            workerType: 'fixed' as const,
            worker,
            name: worker.name,
            detail: worker.role === 'daily' ? `${roleLabel} · ${worker.daysWorked ?? 0} days` : roleLabel,
            gross: worker.earnedPay,
            netPayout: isPaid ? worker.settlement!.net_payout : preview.netPayout,
            advanceDeducted: isPaid ? worker.settlement!.advance_deducted : preview.advanceDeducted,
            isPaid,
            settledAt: worker.settlement?.settled_at,
        }
    })

    return [...meterItems, ...fixedItems].sort((a, b) => {
        if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1
        return b.netPayout - a.netPayout
    })
}

function PayDateOverview({
    month,
    status,
    meterWorkers,
    fixedWorkers,
    isLoading,
    isSelected,
    canSettle,
    onOpenMonth,
    onMarkPaid,
    isItemMutating,
}: {
    month: string
    status: ReturnType<typeof getPayrollCycleStatus>
    meterWorkers?: MeterWorkerPayroll[]
    fixedWorkers?: FixedWorkerPayroll[]
    isLoading: boolean
    isSelected: boolean
    canSettle: boolean
    onOpenMonth: () => void
    onMarkPaid: (item: PayDateWorkerItem) => void
    isItemMutating: (item: PayDateWorkerItem) => boolean
}) {
    const tl = useTransliterate()
    const items = useMemo(
        () => buildPayDateItems(meterWorkers, fixedWorkers),
        [fixedWorkers, meterWorkers]
    )
    const pendingItems = items.filter((item) => !item.isPaid)
    const owedTotal = pendingItems.reduce((sum, item) => sum + item.netPayout, 0)
    const paidCount = items.length - pendingItems.length
    const payDateLabel = dateLabel(status.pay_date, { day: 'numeric', month: 'short', year: 'numeric' })
    const cycleLabel = `${dateLabel(status.cycle_start)} to ${dateLabel(status.cycle_end)}`
    const isCompleted = pendingItems.length === 0
    const statusLabel = (() => {
        if (isCompleted) {
            return items.length > 0 ? 'Paid' : 'Clear'
        }
        if (status.status === 'overdue') return `Overdue since ${payDateLabel}`
        if (status.status === 'due_today') return `Due today, ${payDateLabel}`
        if (status.status === 'approaching') return `Due in ${status.days_until_pay_date} day${status.days_until_pay_date === 1 ? '' : 's'}`
        return `Pay date ${payDateLabel}`
    })()

    return (
        <div className="overflow-hidden rounded-xl border border-saffron-soft bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-saffron-soft/70 bg-saffron-soft/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-saffron-deep shadow-sm">
                        <CalendarClock className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-black uppercase tracking-widest text-saffron-deep">Pay date hisaab</p>
                            <Badge
                                variant="outline"
                                className={cn(
                                    "bg-white/70 text-[10px] font-black uppercase tracking-widest",
                                    isCompleted
                                        ? "border-green-200 text-green-700"
                                        : "border-saffron-soft text-saffron-deep"
                                )}
                            >
                                {statusLabel}
                            </Badge>
                        </div>
                        <p className="mt-1 text-xs text-gray-600">
                            {monthLabel(month)} cycle · {cycleLabel}
                        </p>
                    </div>
                </div>
                {!isSelected && (
                    <Button
                        type="button"
                        size="sm"
                        className="h-9 bg-saffron text-xs font-bold text-white hover:bg-saffron-deep"
                        onClick={onOpenMonth}
                    >
                        Open payroll
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-3 divide-x divide-saffron-soft/60 border-b border-saffron-soft/60">
                <div className="p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Owed</p>
                    <p className="mt-1 text-xl font-black text-gray-900">{formatINR(owedTotal)}</p>
                </div>
                <div className="p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pending</p>
                    <p className="mt-1 text-xl font-black text-amber-700">{pendingItems.length}</p>
                </div>
                <div className="p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Paid</p>
                    <p className="mt-1 text-xl font-black text-green-700">{paidCount}</p>
                </div>
            </div>

            <div className="divide-y divide-gray-100">
                {isLoading ? (
                    [1, 2, 3].map((item) => (
                        <div key={item} className="flex items-center justify-between gap-3 p-4">
                            <div className="min-w-0 flex-1 space-y-2">
                                <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
                                <div className="h-3 w-44 animate-pulse rounded bg-gray-50" />
                            </div>
                            <div className="h-9 w-24 animate-pulse rounded bg-gray-100" />
                        </div>
                    ))
                ) : pendingItems.length === 0 ? (
                    <div className="flex items-center justify-between gap-3 p-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <div>
                                <p className="text-sm font-bold text-gray-900">All workers are marked paid</p>
                                <p className="text-xs text-gray-500">This pay-date cycle is clear.</p>
                            </div>
                        </div>
                        {!isSelected && (
                            <Button type="button" variant="outline" size="sm" className="h-9 text-xs font-bold" onClick={onOpenMonth}>
                                View details
                            </Button>
                        )}
                    </div>
                ) : (
                    pendingItems.map((item) => {
                        const mutating = isItemMutating(item)
                        return (
                            <div key={item.key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="truncate text-sm font-bold text-gray-900">{tl(item.name)}</p>
                                        <Badge variant="outline" className="h-5 border-gray-200 bg-gray-50 px-1.5 text-[9px] font-black uppercase tracking-wider text-gray-600">
                                            {item.workerType === 'meter' ? 'Meter' : 'Fixed'}
                                        </Badge>
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">
                                        {item.detail} · Gross {formatINR(item.gross, { hideDecimals: true })}
                                        {item.advanceDeducted > 0 && ` · advance ${formatINR(item.advanceDeducted, { hideDecimals: true })}`}
                                    </p>
                                </div>
                                <div className="flex items-center justify-between gap-3 sm:justify-end">
                                    <div className="text-right">
                                        <p className="text-base font-black text-gray-900">{formatINR(item.netPayout)}</p>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">net payout</p>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="h-9 w-[100px] bg-saffron text-xs font-bold text-white hover:bg-saffron-deep disabled:bg-gray-200 disabled:text-gray-500"
                                        disabled={!canSettle || mutating}
                                        title={!canSettle ? 'Payroll opens near the configured pay date.' : undefined}
                                        onClick={() => onMarkPaid(item)}
                                    >
                                        {mutating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Mark Paid'}
                                    </Button>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}

function SettlementHistoryDialog({
    open,
    onOpenChange,
    supabase,
    orgId,
    factoryName,
    cycleStartDay,
    onOpenMonth,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    supabase: SupabaseBrowserClient
    orgId?: string
    factoryName: string
    cycleStartDay: number
    onOpenMonth: (month: string) => void
}) {
    const { t } = useTranslation()
    const tl = useTransliterate()
    const [search, setSearch] = useState('')
    const [monthFilter, setMonthFilter] = useState('all')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const { data: settlements = [], isLoading, error } = useQuery({
        queryKey: ['payroll_settlement_history', orgId, cycleStartDay],
        enabled: open && !!orgId,
        staleTime: 30_000,
        queryFn: () => fetchSettlementHistory(supabase, orgId!, cycleStartDay),
    })

    const monthOptions = useMemo(
        () => Array.from(new Set(settlements.map((settlement) => settlement.month))),
        [settlements]
    )
    const filteredSettlements = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase()

        return settlements.filter((settlement) => {
            const matchesMonth = monthFilter === 'all' || settlement.month === monthFilter
            const settledDate = settlementDateKey(settlement.settled_at)
            const matchesDateFrom = !dateFrom || (settledDate && settledDate >= dateFrom)
            const matchesDateTo = !dateTo || (settledDate && settledDate <= dateTo)
            const matchesSearch =
                normalizedSearch.length === 0 ||
                settlement.workerName.toLowerCase().includes(normalizedSearch) ||
                settlement.workerDetail.toLowerCase().includes(normalizedSearch) ||
                settlement.month.includes(normalizedSearch) ||
                String(settlement.id).includes(normalizedSearch)

            return matchesMonth && matchesDateFrom && matchesDateTo && matchesSearch
        })
    }, [dateFrom, dateTo, monthFilter, search, settlements])
    const selectedSettlement = useMemo(() => {
        if (selectedId) {
            return settlements.find((settlement) => settlement.id === selectedId) || filteredSettlements[0] || null
        }

        return filteredSettlements[0] || null
    }, [filteredSettlements, selectedId, settlements])
    const totals = useMemo(() => {
        return filteredSettlements.reduce(
            (sum, settlement) => ({
                net: sum.net + toPayrollNumber(settlement.net_payout),
                gross: sum.gross + toPayrollNumber(settlement.gross_pay),
                recovered: sum.recovered + toPayrollNumber(settlement.advance_deducted),
            }),
            { net: 0, gross: 0, recovered: 0 }
        )
    }, [filteredSettlements])
    const manualAdjustments = selectedSettlement ? getManualAdjustmentRows(selectedSettlement.itemization_payload) : []
    const selectedInam = selectedSettlement ? getItemizationNumber(selectedSettlement.itemization_payload, 'inamTotal') : 0
    const selectedKapaat = selectedSettlement ? getItemizationNumber(selectedSettlement.itemization_payload, 'kapaatTotal') : 0
    const selectedStatutory = selectedSettlement
        ? getItemizationStatutoryDeductions(selectedSettlement.itemization_payload)
        : { pfEmployee: 0, esicEmployee: 0 }
    const selectedPf = selectedStatutory.pfEmployee
    const selectedEsic = selectedStatutory.esicEmployee
    const paymentModeLabel = selectedSettlement ? getPaymentModeLabel(selectedSettlement.payment_mode, t) : null
    const selectedTotalMeters = selectedSettlement
        ? selectedSettlement.earningLines.reduce((sum, line) => sum + (line.meters || 0), 0)
        : 0
    const selectedEarningTotal = selectedSettlement
        ? selectedSettlement.earningLines.reduce((sum, line) => sum + line.amount, 0)
        : 0
    const exportLabel = dateFrom || dateTo
        ? `${dateFrom || 'start'} to ${dateTo || 'today'}`
        : monthFilter === 'all'
            ? 'all dates'
            : monthLabel(monthFilter)
    const handleDownloadCsv = () => {
        if (filteredSettlements.length === 0) {
            toast.error('No settlements in this range.')
            return
        }

        const cycleLabel = settlementExportCycleLabel({
            dateFrom,
            dateTo,
            monthFilter,
            cycleStartDay,
        })
        downloadCsv(
            settlementExportFilename(factoryName, cycleLabel),
            buildSettlementCsv(filteredSettlements)
        )
        toast.success(`Downloaded ${filteredSettlements.length} settlement${filteredSettlements.length === 1 ? '' : 's'}.`)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[92dvh] flex-col overflow-hidden p-0 sm:max-w-5xl">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-4 sm:px-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-black text-gray-900">
                            <History className="h-5 w-5 text-saffron-deep" />
                            Past settlements
                        </DialogTitle>
                        <DialogDescription>
                            Review paid payroll snapshots for audit and worker questions.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
                    <div className="flex min-h-0 flex-col border-b border-gray-200 lg:border-b-0 lg:border-r">
                        <div className="grid gap-3 border-b border-gray-100 p-4 lg:grid-cols-[minmax(220px,1fr)_170px_150px_150px_150px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <Input
                                    placeholder="Search worker, month, or settlement ID"
                                    className="h-10 bg-white pl-9 text-sm"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                />
                            </div>
                            <Select value={monthFilter} onValueChange={setMonthFilter}>
                                <SelectTrigger className="h-10 bg-white text-sm">
                                    <SelectValue placeholder="All months" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All months</SelectItem>
                                    {monthOptions.map((month) => (
                                        <SelectItem key={month} value={month}>
                                            {monthLabel(month)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="relative">
                                <Label className="absolute -top-2 left-2 bg-white px-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                    From
                                </Label>
                                <Input
                                    type="date"
                                    className="h-10 bg-white text-sm"
                                    value={dateFrom}
                                    max={dateTo || undefined}
                                    onChange={(event) => setDateFrom(event.target.value)}
                                />
                            </div>
                            <div className="relative">
                                <Label className="absolute -top-2 left-2 bg-white px-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                    To
                                </Label>
                                <Input
                                    type="date"
                                    className="h-10 bg-white text-sm"
                                    value={dateTo}
                                    min={dateFrom || undefined}
                                    onChange={(event) => setDateTo(event.target.value)}
                                />
                            </div>
                            <Button
                                type="button"
                                className="h-10 bg-saffron text-xs font-black uppercase tracking-widest text-white hover:bg-saffron-deep"
                                disabled={isLoading || filteredSettlements.length === 0}
                                onClick={handleDownloadCsv}
                            >
                                <Download className="h-4 w-4" />
                                CSV
                            </Button>
                        </div>

                        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 bg-white">
                            <div className="p-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Paid · {exportLabel}</p>
                                <p className="mt-1 text-lg font-black text-green-700">{formatINR(totals.net)}</p>
                            </div>
                            <div className="p-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Gross</p>
                                <p className="mt-1 text-lg font-black text-gray-900">{formatINR(totals.gross)}</p>
                            </div>
                            <div className="p-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Recovered</p>
                                <p className="mt-1 text-lg font-black text-amber-700">{formatINR(totals.recovered)}</p>
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto">
                            {isLoading ? (
                                <div className="space-y-0 divide-y divide-gray-100">
                                    {[1, 2, 3, 4].map((item) => (
                                        <div key={item} className="flex items-center justify-between gap-3 p-4">
                                            <div className="space-y-2">
                                                <div className="h-4 w-36 animate-pulse rounded bg-gray-100" />
                                                <div className="h-3 w-48 animate-pulse rounded bg-gray-50" />
                                            </div>
                                            <div className="h-8 w-24 animate-pulse rounded bg-gray-100" />
                                        </div>
                                    ))}
                                </div>
                            ) : error ? (
                                <div className="p-8 text-center">
                                    <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-300" />
                                    <p className="text-sm font-bold text-gray-900">Could not load settlement history</p>
                                    <p className="mt-1 text-xs text-gray-500">{error.message}</p>
                                </div>
                            ) : filteredSettlements.length === 0 ? (
                                <div className="p-8 text-center">
                                    <ReceiptText className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                                    <p className="text-sm font-bold text-gray-900">No paid settlements found</p>
                                    <p className="mt-1 text-xs text-gray-500">Paid workers will appear here after payroll is settled.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {filteredSettlements.map((settlement) => {
                                        const isSelected = selectedSettlement?.id === settlement.id
                                        return (
                                            <button
                                                key={settlement.id}
                                                type="button"
                                                className={cn(
                                                    'flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-gray-50',
                                                    isSelected && 'bg-saffron-soft/30'
                                                )}
                                                onClick={() => setSelectedId(settlement.id)}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="truncate text-sm font-bold text-gray-900">{tl(settlement.workerName)}</p>
                                                        <Badge variant="outline" className="h-5 border-gray-200 bg-white px-1.5 text-[9px] font-black uppercase tracking-wider text-gray-600">
                                                            {settlement.worker_type === 'meter' ? 'Meter' : 'Fixed'}
                                                        </Badge>
                                                        {settlement.is_final_settlement && (
                                                            <Badge className="h-5 bg-red-100 px-1.5 text-[9px] font-black uppercase tracking-wider text-red-700 hover:bg-red-100">
                                                                Final
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="mt-1 text-xs text-gray-500">
                                                        {monthLabel(settlement.month)} · {settlementDateLabel(settlement.settled_at)}
                                                    </p>
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    <p className="text-sm font-black text-green-700">{formatINR(settlement.net_payout)}</p>
                                                    <p className="mt-1 flex items-center justify-end gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                                        <Eye className="h-3 w-3" />
                                                        View
                                                    </p>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="min-h-0 overflow-y-auto bg-white p-4 sm:p-6">
                        {selectedSettlement ? (
                            <div className="space-y-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                            Settlement #{selectedSettlement.id}
                                        </p>
                                        <h3 className="mt-1 truncate text-xl font-black text-gray-900">{tl(selectedSettlement.workerName)}</h3>
                                        <p className="mt-1 text-sm text-gray-500">
                                            {selectedSettlement.workerDetail} · {monthLabel(selectedSettlement.month)}
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="shrink-0 border-green-200 bg-green-50 text-[10px] font-black uppercase tracking-widest text-green-700">
                                        Paid
                                    </Badge>
                                </div>

                                <div className="rounded-xl border border-green-100 bg-green-50 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-green-700">Net paid</p>
                                    <p className="mt-1 text-3xl font-black text-green-700">{formatINR(selectedSettlement.net_payout)}</p>
                                    <p className="mt-2 text-xs text-green-800/80">{settlementDateLabel(selectedSettlement.settled_at)}</p>
                                </div>

                                <div className="overflow-hidden rounded-xl border border-gray-200">
                                    <div className="flex flex-col gap-2 border-b border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-gray-500">Earnings overview</p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                {selectedSettlement.worker_type === 'meter'
                                                    ? 'Net revenue before deductions: meters produced x worker rate across machines.'
                                                    : 'Salary basis used for this settlement.'}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedTotalMeters > 0 && (
                                                <Badge variant="outline" className="border-gray-200 bg-white text-[10px] font-black uppercase tracking-widest text-gray-600">
                                                    {selectedTotalMeters.toFixed(1)} m
                                                </Badge>
                                            )}
                                            <Badge variant="outline" className="border-saffron-soft bg-white text-[10px] font-black uppercase tracking-widest text-saffron-deep">
                                                Net revenue {formatINR(selectedEarningTotal || selectedSettlement.gross_pay)}
                                            </Badge>
                                        </div>
                                    </div>

                                    {selectedSettlement.earningLines.length > 0 ? (
                                        <div className="divide-y divide-gray-100">
                                            {selectedSettlement.earningLines.map((line, index) => (
                                                <div key={`${line.label}-${line.subLabel || 'line'}-${index}`} className="p-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-bold text-gray-900">{line.label}</p>
                                                            {line.subLabel && <p className="mt-0.5 truncate text-xs text-saffron-deep/80">{line.subLabel}</p>}
                                                        </div>
                                                        <p className="shrink-0 text-sm font-black text-gray-900">{formatINR(line.amount)}</p>
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-gray-500">
                                                        <span>{line.quantityLabel}</span>
                                                        <span className="h-1 w-1 rounded-full bg-gray-300" />
                                                        <span>{line.rateLabel}</span>
                                                        <span className="h-1 w-1 rounded-full bg-gray-300" />
                                                        <span>= {formatINR(line.amount)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-4 text-sm text-gray-500">
                                            Detailed production lines are not available for this settlement, so the saved gross snapshot is shown below.
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2 rounded-xl border border-gray-200 p-4 text-sm">
                                    <div className="flex justify-between gap-3">
                                        <span className="text-gray-500">
                                            {selectedSettlement.worker_type === 'meter' ? 'Net revenue before deductions' : 'Gross earnings'}
                                        </span>
                                        <span className="font-bold text-gray-900">{formatINR(selectedSettlement.gross_pay)}</span>
                                    </div>
                                    {selectedInam > 0 && (
                                        <div className="flex justify-between gap-3 text-green-700">
                                            <span>Inam / bonus</span>
                                            <span className="font-bold">+{formatINR(selectedInam)}</span>
                                        </div>
                                    )}
                                    {selectedKapaat > 0 && (
                                        <div className="flex justify-between gap-3 text-red-700">
                                            <span>Kapaat / deduction</span>
                                            <span className="font-bold">-{formatINR(selectedKapaat)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between gap-3 text-amber-700">
                                        <span>Advance recovered</span>
                                        <span className="font-bold">-{formatINR(selectedSettlement.advance_deducted)}</span>
                                    </div>
                                    {(selectedPf > 0 || selectedEsic > 0) && (
                                        <div className="flex justify-between gap-3 text-blue-700">
                                            <span>PF / ESI</span>
                                            <span className="font-bold">-{formatINR(selectedPf + selectedEsic)}</span>
                                        </div>
                                    )}
                                    <div className="border-t border-gray-100 pt-2">
                                        <div className="flex justify-between gap-3">
                                            <span className="font-bold text-gray-700">Final payout</span>
                                            <span className="font-black text-green-700">{formatINR(selectedSettlement.net_payout)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-xl border border-gray-200 p-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Payment mode</p>
                                        <p className="mt-1 text-sm font-bold text-gray-900">{paymentModeLabel || 'Not recorded'}</p>
                                    </div>
                                    <div className="rounded-xl border border-gray-200 p-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Carried debt</p>
                                        <p className="mt-1 text-sm font-bold text-gray-900">{formatINR(selectedSettlement.carried_forward_debt)}</p>
                                    </div>
                                </div>

                                {manualAdjustments.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Manual adjustments</p>
                                        <div className="space-y-2">
                                            {manualAdjustments.map((adjustment, index) => {
                                                const isInam = adjustment.type === 'inam'
                                                return (
                                                    <div key={`${adjustment.reason}-${index}`} className="rounded-lg border border-gray-200 p-3">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <p className="text-xs font-bold text-gray-900">{adjustment.reason}</p>
                                                                {adjustment.note && <p className="mt-1 text-xs text-gray-500">{adjustment.note}</p>}
                                                            </div>
                                                            <p className={cn('text-sm font-black', isInam ? 'text-green-700' : 'text-red-700')}>
                                                                {isInam ? '+' : '-'}{formatINR(adjustment.amount)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-10 flex-1 text-xs font-bold"
                                        onClick={() => onOpenMonth(selectedSettlement.month)}
                                    >
                                        <CalendarClock className="h-4 w-4" />
                                        Open cycle
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-10 flex-1 text-xs font-bold"
                                        onClick={() => setSelectedId(null)}
                                    >
                                        Show latest
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex h-full min-h-[260px] items-center justify-center text-center">
                                <div>
                                    <ReceiptText className="mx-auto mb-3 h-9 w-9 text-gray-300" />
                                    <p className="text-sm font-bold text-gray-900">Select a settlement</p>
                                    <p className="mt-1 text-xs text-gray-500">The audit snapshot will appear here.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PayrollPage() {
    const supabase = createClient()
    const queryClient = useQueryClient()
    const { t } = useTranslation()
    const router = useRouter()
    const searchParams = useSearchParams()
    const cycleParam = searchParams.get('cycle')
    const hasInitialCycleParam = Boolean(cycleParam && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(cycleParam))
    const initialCycleMonth = hasInitialCycleParam && cycleParam
        ? cycleParam
        : formatToSurat(new Date(), 'yyyy-MM')
    const [activeTab, setActiveTab] = useState<'meter' | 'fixed'>('meter')
    const [selectedMonth, setSelectedMonth] = useState(initialCycleMonth)
    const [hasManualCycleSelection, setHasManualCycleSelection] = useState(hasInitialCycleParam)
    const [searchTerm, setSearchTerm] = useState('')
    const [showRulesDialog, setShowRulesDialog] = useState(false)
    const [showSettlementHistory, setShowSettlementHistory] = useState(false)
    const [showAccessCodeDialog, setShowAccessCodeDialog] = useState(false)
    const [accessCode, setAccessCode] = useState('')
    const [pendingAction, setPendingAction] = useState<{
        workerType: 'meter' | 'fixed',
        workerId: number,
        currentPaid: boolean,
        isFinal: boolean
        targetMonth: string
    } | null>(null)

    const { data: userProfile } = useUserProfile()
    const todayStr = useMemo(() => formatToSurat(new Date(), 'yyyy-MM-dd'), [])

    // 1. Cycle Config
    const { data: cycleConfig } = useQuery({
        queryKey: ['payroll_config', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data } = await supabase.from('payroll_configs').select('*').eq('org_id', userProfile!.org_id).maybeSingle()
            return data
        }
    })
    const cycleStartDay = cycleConfig?.cycle_start_day || 1
    const payDateDay = cycleConfig?.pay_date_day || 10
    const payReminderDays = cycleConfig?.pay_reminder_days ?? 3
    const currentMonth = useMemo(
        () => getPayrollMonthForDate(todayStr, cycleStartDay),
        [cycleStartDay, todayStr]
    )
    const payDateCycleMonth = useMemo(
        () => prevMonth(currentMonth),
        [currentMonth]
    )
    const selectedCycleStatus = useMemo(
        () => getPayrollCycleStatus(selectedMonth, cycleStartDay, payDateDay, todayStr, payReminderDays),
        [cycleStartDay, payDateDay, payReminderDays, selectedMonth, todayStr]
    )
    const payDateCycleStatus = useMemo(
        () => getPayrollCycleStatus(payDateCycleMonth, cycleStartDay, payDateDay, todayStr, payReminderDays),
        [cycleStartDay, payDateCycleMonth, payDateDay, payReminderDays, todayStr]
    )

    useEffect(() => {
        if (!userProfile?.org_id || hasManualCycleSelection) return
        let disposed = false
        queueMicrotask(() => {
            if (!disposed) setSelectedMonth(currentMonth)
        })
        return () => { disposed = true }
    }, [currentMonth, hasManualCycleSelection, userProfile?.org_id])

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

    useEffect(() => {
        const orgId = userProfile?.org_id
        if (!orgId) return

        const invalidatePayroll = () => {
            void queryClient.invalidateQueries({ queryKey: ['payroll_meter', orgId] })
            void queryClient.invalidateQueries({ queryKey: ['payroll_fixed', orgId] })
            void queryClient.invalidateQueries({ queryKey: ['payroll_settlement_history', orgId] })
        }

        const channel = supabase
            .channel(`payroll-ledger-${orgId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'production_logs', filter: `org_id=eq.${orgId}` },
                invalidatePayroll
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'worker_advances', filter: `org_id=eq.${orgId}` },
                invalidatePayroll
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'payroll_settlements', filter: `org_id=eq.${orgId}` },
                invalidatePayroll
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [queryClient, supabase, userProfile?.org_id])

    // ── Meter workers payroll data ──────────────────────────────────────────
    const { data: meterWorkers, isLoading: meterLoading } = useQuery({
        queryKey: payrollMeterQueryKey(userProfile?.org_id, selectedMonth, cycleStartDay),
        enabled: !!userProfile?.org_id && !!selectedMonth,
        staleTime: 0,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
        queryFn: () => fetchMeterWorkerPayroll(supabase, userProfile!.org_id, selectedMonth, cycleStartDay)
    })

    const { data: fixedWorkers, isLoading: fixedLoading } = useQuery({
        queryKey: payrollFixedQueryKey(userProfile?.org_id, selectedMonth, cycleStartDay),
        enabled: !!userProfile?.org_id && !!selectedMonth,
        staleTime: 0,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
        queryFn: () => fetchFixedWorkerPayroll(supabase, userProfile!.org_id, selectedMonth, cycleStartDay)
    })

    const isPayDateCycleSelected = selectedMonth === payDateCycleMonth
    const shouldLoadPayDateCycle =
        !!userProfile?.org_id &&
        !!payDateCycleMonth &&
        !isPayDateCycleSelected &&
        payDateCycleStatus.status !== 'not_started'

    const { data: payDateMeterWorkers, isLoading: payDateMeterLoading } = useQuery({
        queryKey: payrollMeterQueryKey(userProfile?.org_id, payDateCycleMonth, cycleStartDay),
        enabled: shouldLoadPayDateCycle,
        staleTime: 0,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
        queryFn: () => fetchMeterWorkerPayroll(supabase, userProfile!.org_id, payDateCycleMonth, cycleStartDay),
    })

    const { data: payDateFixedWorkers, isLoading: payDateFixedLoading } = useQuery({
        queryKey: payrollFixedQueryKey(userProfile?.org_id, payDateCycleMonth, cycleStartDay),
        enabled: shouldLoadPayDateCycle,
        staleTime: 0,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
        queryFn: () => fetchFixedWorkerPayroll(supabase, userProfile!.org_id, payDateCycleMonth, cycleStartDay),
    })

    const payDateMeterSource = isPayDateCycleSelected ? meterWorkers : payDateMeterWorkers
    const payDateFixedSource = isPayDateCycleSelected ? fixedWorkers : payDateFixedWorkers
    const isPayDateLoading = isPayDateCycleSelected
        ? meterLoading || fixedLoading
        : payDateMeterLoading || payDateFixedLoading

    const configMutation = useMutation({
        mutationFn: async (input: { cycleStartDay: number; payDateDay: number; payReminderDays: number }) => {
            return savePayrollConfig(input.cycleStartDay, input.payDateDay, input.payReminderDays)
        },
        onSuccess: (data) => {
            if (data?.error) {
                toast.error(data.error)
                return
            }

            setShowRulesDialog(false)
            setHasManualCycleSelection(false)
            toast.success('Payroll rules updated')
            void queryClient.invalidateQueries({ queryKey: ['payroll_config', userProfile?.org_id] })
            void queryClient.invalidateQueries({ queryKey: ['payroll_meter'] })
            void queryClient.invalidateQueries({ queryKey: ['payroll_fixed'] })
        },
        onError: () => {
            toast.error('Failed to update payroll rules')
        },
    })

    // ── Toggle paid with Optimistic UI ──────────────────────────────────────
    const mutation = useMutation({
        mutationFn: async ({ workerType, workerId, currentPaid, targetMonth, isFinal, manualDeductionOverride, paymentMode, manualAdjustments, verifiedByOwner, accessCode }: {
            workerType: 'meter' | 'fixed',
            workerId: number,
            currentPaid: boolean,
            targetMonth: string,
            isFinal: boolean,
            manualDeductionOverride?: number | null,
            paymentMode?: PaymentMode | null,
            manualAdjustments?: PayrollManualAdjustment[],
            verifiedByOwner?: boolean,
            accessCode?: string
        }) => {
            return await toggleWorkerPaid(
                workerType,
                workerId,
                targetMonth,
                currentPaid,
                isFinal,
                manualDeductionOverride,
                null,
                paymentMode ?? null,
                manualAdjustments ?? [],
                verifiedByOwner ?? false,
                accessCode
            )
        },
        onMutate: async (variables) => {
            const orgId = userProfile?.org_id
            const targetMonth = variables.targetMonth
            const queryKey = variables.workerType === 'meter' 
                ? payrollMeterQueryKey(orgId, targetMonth, cycleStartDay)
                : payrollFixedQueryKey(orgId, targetMonth, cycleStartDay)

            await queryClient.cancelQueries({ queryKey })
            const previousData = queryClient.getQueryData<PayrollWorker[]>(queryKey)

            queryClient.setQueryData<PayrollWorker[]>(queryKey, (old) => {
                if (!old) return old
                return old.map((w) => {
                    if (w.id === variables.workerId) {
                        const gross = 'totalPay' in w ? w.totalPay : w.earnedPay
                        const enrolled = isPfEsiEnrolled(w)
                        const manualAdjustments = variables.manualAdjustments ?? []
                        const preview = getSettlementPreview({
                            gross,
                            totalAdvances: w.totalAdvances || 0,
                            isFinal: variables.isFinal,
                            enrolled,
                            manualDeduction: variables.manualDeductionOverride ?? null,
                            manualAdjustments,
                        })

                        return {
                            ...w,
                            settlement: !variables.currentPaid ? {
                                status: 'paid',
                                settled_at: new Date().toISOString(),
                                is_final_settlement: variables.isFinal,
                                gross_pay: gross,
                                net_payout: preview.netPayout,
                                advance_deducted: preview.advanceDeducted,
                                carried_forward_debt: preview.remainingDebt,
                                compliance_flag: preview.complianceFlag,
                                payment_mode: variables.paymentMode ?? null,
                                itemization_payload: enrolled ? {
                                    baseEarnings: gross,
                                    inamTotal: preview.inamTotal,
                                    kapaatTotal: preview.kapaatTotal,
                                    manualAdjustmentTotal: preview.manualAdjustmentTotal,
                                    advanceRecovery: preview.advanceDeducted,
                                    finalPayout: preview.netPayout,
                                    remainingDebt: preview.remainingDebt,
                                    manual_adjustments: manualAdjustments,
                                    employee_pf: preview.pfEmployee,
                                    employee_esic: preview.esicEmployee,
                                    pf: preview.pfEmployee > 0
                                        ? { basis: Math.min(preview.adjustedGross, 15000), employee: preview.pfEmployee }
                                        : null,
                                    esic: preview.esicEmployee > 0
                                        ? { employee: preview.esicEmployee }
                                        : null,
                                    payment_mode: variables.paymentMode ?? null,
                                    verifiedByOwner: variables.verifiedByOwner ?? false,
                                } : {
                                    baseEarnings: gross,
                                    inamTotal: preview.inamTotal,
                                    kapaatTotal: preview.kapaatTotal,
                                    manualAdjustmentTotal: preview.manualAdjustmentTotal,
                                    advanceRecovery: preview.advanceDeducted,
                                    finalPayout: preview.netPayout,
                                    remainingDebt: preview.remainingDebt,
                                    manual_adjustments: manualAdjustments,
                                    employee_pf: preview.pfEmployee,
                                    employee_esic: preview.esicEmployee,
                                    pf: null,
                                    esic: null,
                                    payment_mode: variables.paymentMode ?? null,
                                    verifiedByOwner: variables.verifiedByOwner ?? false,
                                },
                            } : undefined
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
            queryClient.invalidateQueries({ queryKey: context?.queryKey })
            queryClient.invalidateQueries({ queryKey: ['payroll_meter'] })
            queryClient.invalidateQueries({ queryKey: ['payroll_fixed'] })
            queryClient.invalidateQueries({ queryKey: ['payroll_settlement_history'] })
            setShowSettlementDialog(false)
            setPendingSettleWorker(null)
        },
        onSuccess: async (data) => {
            if (data?.error) {
                toast.error(data.error)
            } else {
                if (pendingSettleWorker?.deactivateAfterExit) {
                    const deactivateResult = await setWorkerActiveStatus(
                        pendingSettleWorker.type,
                        pendingSettleWorker.id,
                        false
                    )

                    if (deactivateResult.error) {
                        toast.error(deactivateResult.error)
                    } else {
                        toast.success('Worker moved to inactive after final settlement.')
                    }

                    router.replace('/owner/payroll')
                }
                toast.success('✓ Payroll updated', { duration: 2000 })
            }
        }
    })

    const [showSettlementDialog, setShowSettlementDialog] = useState(false)
    const [pendingSettleWorker, setPendingSettleWorker] = useState<SettlementDialogWorker | null>(null)
    const [handledExitLaunch, setHandledExitLaunch] = useState(false)

    const handleTogglePaid = (
        workerType: 'meter' | 'fixed',
        workerId: number,
        currentPaid: boolean,
        isFinal: boolean = false,
        targetMonth: string = selectedMonth,
        workerOverride?: MeterWorkerPayroll | FixedWorkerPayroll
    ) => {
        const source = (workerType === 'meter' ? meterWorkers : fixedWorkers) as PayrollWorker[] | undefined
        const worker = workerOverride || (source || []).find((w) => w.id === workerId)

        if (!worker) {
            toast.error('Worker payroll row is still loading.')
            return
        }

        if (currentPaid) {
            setPendingAction({ workerType, workerId, currentPaid, isFinal, targetMonth })
            setShowAccessCodeDialog(true)
        } else {
            setPendingSettleWorker({ ...worker, type: workerType, targetMonth })
            setShowSettlementDialog(true)
        }
    }

    const confirmRevert = async () => {
        if (!pendingAction) return
        
        if (!accessCode) {
            toast.error(t('payroll_ext.code_required') || 'Access code is required')
            return
        }

        mutation.mutate({ 
            workerType: pendingAction.workerType, 
            workerId: pendingAction.workerId, 
            currentPaid: pendingAction.currentPaid, 
            targetMonth: pendingAction.targetMonth, 
            isFinal: false,
            accessCode: accessCode
        })
        
        setShowAccessCodeDialog(false)
        setAccessCode('')
        setPendingAction(null)
    }

    // ── Summary stats ───────────────────────────────────────────────────────
    const summary = useMemo(() => {
        const meterTotal = (meterWorkers || []).reduce((s: number, w: MeterWorkerPayroll) => s + w.totalPay, 0)
        const fixedTotal = (fixedWorkers || []).reduce((s: number, w: FixedWorkerPayroll) => s + w.earnedPay, 0)
        
        const meterAdvances = (meterWorkers || []).reduce((s: number, w: MeterWorkerPayroll) => s + (w.totalAdvances || 0), 0)
        const fixedAdvances = (fixedWorkers || []).reduce((s: number, w: FixedWorkerPayroll) => s + (w.totalAdvances || 0), 0)
        const totalPendingAdvances = meterAdvances + fixedAdvances
        
        const meterPaid = (meterWorkers || []).filter((w: MeterWorkerPayroll) => w.settlement?.status === 'paid').reduce((s: number, w: MeterWorkerPayroll) => s + (w.settlement?.net_payout ?? 0), 0)
        const fixedPaid = (fixedWorkers || []).filter((w: FixedWorkerPayroll) => w.settlement?.status === 'paid').reduce((s: number, w: FixedWorkerPayroll) => s + (w.settlement?.net_payout ?? 0), 0)
        
        const meterDeducted = (meterWorkers || []).filter((w: MeterWorkerPayroll) => w.settlement?.status === 'paid').reduce((s: number, w: MeterWorkerPayroll) => s + (w.settlement?.advance_deducted ?? 0), 0)
        const fixedDeducted = (fixedWorkers || []).filter((w: FixedWorkerPayroll) => w.settlement?.status === 'paid').reduce((s: number, w: FixedWorkerPayroll) => s + (w.settlement?.advance_deducted ?? 0), 0)
        
        const totalGross = meterTotal + fixedTotal
        const totalPaidNet = meterPaid + fixedPaid
        const totalDeducted = meterDeducted + fixedDeducted
        
        return { 
            totalGross, 
            totalPaidNet, 
            outstanding: totalGross - totalPaidNet - totalDeducted, 
            totalPendingAdvances,
            totalDeducted
        }
    }, [meterWorkers, fixedWorkers])

    const filteredMeterWorkers = useMemo(() => {
        if (!meterWorkers) return []
        return meterWorkers.filter((w: MeterWorkerPayroll) => 
            w.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
    }, [meterWorkers, searchTerm])

    const filteredFixedWorkers = useMemo(() => {
        if (!fixedWorkers) return []
        return fixedWorkers.filter((w: FixedWorkerPayroll) => 
            w.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
    }, [fixedWorkers, searchTerm])

    useEffect(() => {
        let disposed = false
        const exitWorkerType = searchParams.get('exitWorkerType')
        const exitWorkerId = searchParams.get('exitWorkerId')
        const finalSettlement = searchParams.get('finalSettlement') === '1'
        const deactivateAfterExit = searchParams.get('deactivateAfterExit') === '1'

        if (!exitWorkerType || !exitWorkerId || !finalSettlement || handledExitLaunch) {
            return undefined
        }

        if (exitWorkerType !== 'meter' && exitWorkerType !== 'fixed') {
            queueMicrotask(() => {
                if (!disposed) setHandledExitLaunch(true)
            })
            return () => { disposed = true }
        }

        const parsedWorkerId = Number(exitWorkerId)
        if (!Number.isFinite(parsedWorkerId)) {
            queueMicrotask(() => {
                if (!disposed) setHandledExitLaunch(true)
            })
            return () => { disposed = true }
        }

        const source = exitWorkerType === 'meter' ? meterWorkers : fixedWorkers
        if (!source) return undefined

        const worker = source.find((item: MeterWorkerPayroll | FixedWorkerPayroll) => item.id === parsedWorkerId)
        if (!worker) {
            queueMicrotask(() => {
                if (disposed) return
                setHandledExitLaunch(true)
                toast.error('Worker not found for final settlement.')
            })
            return () => { disposed = true }
        }

        queueMicrotask(() => {
            if (disposed) return
            setActiveTab(exitWorkerType === 'meter' ? 'meter' : 'fixed')
            setPendingSettleWorker({
                ...worker,
                type: exitWorkerType,
                initialIsFinal: true,
                deactivateAfterExit,
            })
            setShowSettlementDialog(true)
            setHandledExitLaunch(true)
        })
        return () => { disposed = true }
    }, [searchParams, meterWorkers, fixedWorkers, handledExitLaunch])

    if (!selectedMonth) return null

    const payWindowCopy = getPayWindowCopy(selectedCycleStatus, payReminderDays)
    const payWindowToneClasses = {
        red: 'border-red-200 bg-red-50 text-red-800',
        amber: 'border-amber-200 bg-amber-50 text-amber-800',
        slate: 'border-slate-200 bg-slate-50 text-slate-700',
    }[payWindowCopy.tone]
    const payWindowIconClasses = {
        red: 'text-red-600',
        amber: 'text-amber-600',
        slate: 'text-slate-500',
    }[payWindowCopy.tone]
    const settleDisabledReason = selectedCycleStatus.is_payroll_window_open
        ? undefined
        : `${payWindowCopy.title}. Normal settlement opens near the configured pay date.`
    const shouldShowPayDateOverview = payDateCycleStatus.status !== 'not_started'

    return (
        <div className="p-4 md:p-6 space-y-6 pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('payroll.monthly_payroll')}</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{t('payroll.track_settle')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 gap-2 bg-white text-xs font-bold"
                        onClick={() => setShowSettlementHistory(true)}
                    >
                        <History className="h-4 w-4" />
                        Past settlements
                    </Button>
                    {/* Month navigator */}
                    <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5">
                        <button
                            onClick={() => {
                                setHasManualCycleSelection(true)
                                setSelectedMonth(prevMonth(selectedMonth))
                            }}
                            className="p-1 hover:bg-gray-100 rounded"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="text-sm font-semibold text-gray-700 min-w-[140px] text-center">
                            {monthLabel(selectedMonth)}
                        </span>
                        <button
                            onClick={() => {
                                setHasManualCycleSelection(true)
                                setSelectedMonth(nextMonth(selectedMonth))
                            }}
                            disabled={selectedMonth >= currentMonth}
                            className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            <div className={cn('flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between', payWindowToneClasses)}>
                <div className="flex min-w-0 items-start gap-3">
                    <CalendarClock className={cn('mt-0.5 h-5 w-5 shrink-0', payWindowIconClasses)} />
                    <div className="min-w-0">
                        <p className="text-sm font-black">{payWindowCopy.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed opacity-85">{payWindowCopy.description}</p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline" className="w-fit border-current/20 bg-white/60 text-[10px] font-black uppercase tracking-widest">
                        Pay day {payDateDay}
                    </Badge>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 border-current/20 bg-white/70 text-xs font-bold hover:bg-white"
                        onClick={() => setShowRulesDialog(true)}
                    >
                        Edit rules
                    </Button>
                </div>
            </div>

            {shouldShowPayDateOverview && (
                <PayDateOverview
                    month={payDateCycleMonth}
                    status={payDateCycleStatus}
                    meterWorkers={payDateMeterSource}
                    fixedWorkers={payDateFixedSource}
                    isLoading={isPayDateLoading}
                    isSelected={isPayDateCycleSelected}
                    canSettle={payDateCycleStatus.is_payroll_window_open}
                    onOpenMonth={() => {
                        setHasManualCycleSelection(true)
                        setSelectedMonth(payDateCycleMonth)
                    }}
                    onMarkPaid={(item) => {
                        handleTogglePaid(
                            item.workerType,
                            item.worker.id,
                            item.isPaid,
                            false,
                            payDateCycleMonth,
                            item.worker
                        )
                    }}
                    isItemMutating={(item) =>
                        mutation.isPending &&
                        mutation.variables?.workerType === item.workerType &&
                        mutation.variables?.workerId === item.worker.id &&
                        mutation.variables?.targetMonth === payDateCycleMonth
                    }
                />
            )}

            {selectedCycleStatus.status === 'not_started' && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <CalendarClock className="mx-auto mb-3 h-9 w-9 text-slate-300" />
                        <p className="font-bold text-slate-800">No wages due for this cycle yet</p>
                        <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-slate-500">
                            Payroll rows open when the configured pay date is approaching. This keeps in-progress production out of the due-wages list.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Summary Cards */}
            {selectedCycleStatus.status !== 'not_started' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="border-none shadow-sm bg-saffron-soft/50">
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs font-black text-saffron-deep uppercase tracking-widest mb-1">{t('payroll_ext.gross_target')}</div>
                        <div className="text-xl font-black text-saffron-deep tracking-tight">{formatINR(summary.totalGross)}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-green-50/50">
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs font-black text-green-600 uppercase tracking-widest mb-1">{t('payroll_ext.net_paid')}</div>
                        <div className="text-xl font-black text-green-700 tracking-tight">{formatINR(summary.totalPaidNet)}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-amber-50/50">
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs font-black text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                            <HandCoins className="h-3 w-3" />
                            {t('payroll_ext.recovered')}
                        </div>
                        <div className="text-xl font-black text-amber-700 tracking-tight">{formatINR(summary.totalDeducted)}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-red-50/50">
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs font-black text-red-600 uppercase tracking-widest mb-1">{t('payroll_ext.outstanding')}</div>
                        <div className="text-xl font-black text-red-700 tracking-tight">{formatINR(summary.outstanding)}</div>
                    </CardContent>
                </Card>
            </div>
            )}

            {/* Search & Tabs Header */}
            {selectedCycleStatus.status !== 'not_started' && (
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                        placeholder={t('payroll_ext.search_placeholder')} 
                        className="pl-9 bg-white border-gray-200"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="flex bg-white p-1 rounded-xl border border-gray-200 w-full md:w-auto">
                    <button
                        className={cn(
                            'flex-1 md:min-w-[200px] px-1.5 sm:px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-tighter sm:tracking-widest flex items-center justify-center gap-1 sm:gap-3 transition-all rounded-lg min-w-0',
                            activeTab === 'meter' ? 'bg-saffron text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                        )}
                        onClick={() => setActiveTab('meter')}
                    >
                        <HardHat className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                        <span className="truncate">{t('payroll_ext.piece_rate_tab')}</span>
                        {meterWorkers && (
                            <span className={cn(
                                'text-xs px-2 py-0.5 rounded-full font-bold ml-2 shrink-0',
                                activeTab === 'meter' ? 'bg-white/25' : 'bg-gray-100'
                            )}>
                                {meterWorkers.filter((w: MeterWorkerPayroll) => !w.settlement).length}
                            </span>
                        )}
                    </button>
                    <button
                        className={cn(
                            'flex-1 md:min-w-[200px] px-1.5 sm:px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-tighter sm:tracking-widest flex items-center justify-center gap-1 sm:gap-3 transition-all rounded-lg min-w-0',
                            activeTab === 'fixed' ? 'bg-saffron text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                        )}
                        onClick={() => setActiveTab('fixed')}
                    >
                        <Briefcase className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                        <span className="truncate">{t('payroll_ext.monthly_daily_tab')}</span>
                        {fixedWorkers && (
                            <span className={cn(
                                'text-xs px-2 py-0.5 rounded-full font-bold ml-2 shrink-0',
                                activeTab === 'fixed' ? 'bg-white/25' : 'bg-gray-100'
                            )}>
                                {fixedWorkers.filter((w: FixedWorkerPayroll) => !w.settlement).length}
                            </span>
                        )}
                    </button>
                </div>
            </div>
            )}

            {/* Progress bar */}
            {selectedCycleStatus.status !== 'not_started' && summary.totalGross > 0 && (
                <div className="space-y-1.5">
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-green-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, ((summary.totalPaidNet + summary.totalDeducted) / summary.totalGross) * 100)}%` }}
                        />
                    </div>
                    <p className="text-[10px] font-black text-gray-400 text-right uppercase tracking-widest">
                        {Math.round(((summary.totalPaidNet + summary.totalDeducted) / summary.totalGross) * 100)}{t('payroll_ext.settled_pct')}
                    </p>
                </div>
            )}

            {/* ── Meter Workers Tab ── */}
            {selectedCycleStatus.status !== 'not_started' && activeTab === 'meter' && (
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
                                <p className="text-gray-700 font-medium">{t('emptyState.payroll.title')}</p>
                                <p className="text-sm text-gray-500 mt-1">{t('payroll.empty.no_production')}</p>
                                <Button
                                    className="mt-4"
                                    variant="outline"
                                    onClick={() => {
                                        if (fixedWorkers && fixedWorkers.length > 0) {
                                            setActiveTab('fixed')
                                            return
                                        }
                                        window.location.href = '/owner/fixed-workers'
                                    }}
                                >
                                    {t('emptyState.payroll.cta')}
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <p className="px-1 text-[10px] font-black leading-4 text-gray-400 uppercase tracking-widest">
                                {t('payroll_ext.showing_results').replace('{count}', String(filteredMeterWorkers.length))}
                            </p>
                            {filteredMeterWorkers.map(w => (
                                <MeterWorkerRow
                                    key={w.id}
                                    worker={w}
                                    onToggle={(isFinal) => handleTogglePaid('meter', w.id, w.settlement?.status === 'paid', isFinal)}
                                    isMutating={mutation.isPending && mutation.variables?.workerId === w.id && mutation.variables?.workerType === 'meter'}
                                    selectedMonth={selectedMonth}
                                    cycleStartDay={cycleStartDay}
                                    factoryName={orgName}
                                    canSettle={selectedCycleStatus.is_payroll_window_open}
                                    settleDisabledReason={settleDisabledReason}
                                />
                            ))}
                        </>
                    )}
                </div>
            )}

            {/* ── Fixed Workers Tab ── */}
            {selectedCycleStatus.status !== 'not_started' && activeTab === 'fixed' && (
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
                                <p className="text-gray-700 font-medium">{t('emptyState.payroll.title')}</p>
                                <p className="text-sm text-gray-500 mt-1">{t('payroll.empty.no_fixed')}</p>
                                <Button
                                    className="mt-4"
                                    variant="outline"
                                    onClick={() => {
                                        if (meterWorkers && meterWorkers.length > 0) {
                                            setActiveTab('meter')
                                            return
                                        }
                                        window.location.href = '/owner/fixed-workers'
                                    }}
                                >
                                    {t('emptyState.payroll.cta')}
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <p className="px-1 text-[10px] font-black leading-4 text-gray-400 uppercase tracking-widest">
                                {t('payroll_ext.showing_results').replace('{count}', String(filteredFixedWorkers.length))}
                            </p>
                            {filteredFixedWorkers.map((w: FixedWorkerPayroll) => (
                                <FixedWorkerRow
                                    key={w.id}
                                    worker={w}
                                    onToggle={(isFinal) => handleTogglePaid('fixed', w.id, w.settlement?.status === 'paid', isFinal)}
                                    isMutating={mutation.isPending && mutation.variables?.workerId === w.id && mutation.variables?.workerType === 'fixed'}
                                    selectedMonth={selectedMonth}
                                    cycleStartDay={cycleStartDay}
                                    factoryName={orgName}
                                    canSettle={selectedCycleStatus.is_payroll_window_open}
                                    settleDisabledReason={settleDisabledReason}
                                />
                            ))}
                        </>
                    )}
                </div>
            )}

            {/* Access Code Dialog */}
            <Dialog open={showAccessCodeDialog} onOpenChange={setShowAccessCodeDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Lock className="h-5 w-5 text-red-600" />
                            {t('payroll_ext.secure_reversal_title')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('payroll_ext.secure_reversal_desc')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center py-6 gap-4">
                        <InputOTP
                            maxLength={6}
                            pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
                            value={accessCode}
                            onChange={(val) => setAccessCode(val)}
                        >
                            <InputOTPGroup>
                                <InputOTPSlot index={0} />
                                <InputOTPSlot index={1} />
                                <InputOTPSlot index={2} />
                                <InputOTPSlot index={3} />
                                <InputOTPSlot index={4} />
                                <InputOTPSlot index={5} />
                            </InputOTPGroup>
                        </InputOTP>
                    </div>
                    <DialogFooter className="sm:justify-between">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setShowAccessCodeDialog(false)
                                setAccessCode('')
                                setPendingAction(null)
                            }}
                        >
                            {t('payroll_ext.cancel')}
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            className="bg-red-600 font-bold uppercase tracking-widest text-xs"
                            disabled={accessCode.length < 6}
                            onClick={confirmRevert}
                        >
                            {t('payroll_ext.confirm_reversal')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Settlement Dialog V2 */}
            {pendingSettleWorker && (
                <SettlementDialog
                    key={`${pendingSettleWorker.type}-${pendingSettleWorker.id}-${pendingSettleWorker.initialIsFinal ? 'final' : 'regular'}-${showSettlementDialog ? 'open' : 'closed'}`}
                    open={showSettlementDialog}
                    onOpenChange={setShowSettlementDialog}
                    worker={pendingSettleWorker}
                    selectedMonth={pendingSettleWorker.targetMonth ?? selectedMonth}
                    initialIsFinal={!!pendingSettleWorker.initialIsFinal}
                    isMutating={mutation.isPending}
                    onSettle={({ isFinal, manualDeduction, paymentMode, manualAdjustments, verifiedByOwner }) => {
                        mutation.mutate({ 
                            workerType: pendingSettleWorker.type, 
                            workerId: pendingSettleWorker.id, 
                            currentPaid: false, 
                            targetMonth: pendingSettleWorker.targetMonth ?? selectedMonth, 
                            isFinal,
                            manualDeductionOverride: manualDeduction,
                            paymentMode,
                            manualAdjustments,
                            verifiedByOwner,
                        })
                    }}
                />
            )}
            <PayrollRulesDialog
                key={`${cycleStartDay}-${payDateDay}-${payReminderDays}-${showRulesDialog ? 'open' : 'closed'}`}
                open={showRulesDialog}
                onOpenChange={setShowRulesDialog}
                cycleStartDay={cycleStartDay}
                payDateDay={payDateDay}
                payReminderDays={payReminderDays}
                isSaving={configMutation.isPending}
                onSave={(input) => configMutation.mutate(input)}
            />
            <SettlementHistoryDialog
                open={showSettlementHistory}
                onOpenChange={setShowSettlementHistory}
                supabase={supabase}
                orgId={userProfile?.org_id}
                factoryName={orgName}
                cycleStartDay={cycleStartDay}
                onOpenMonth={(month) => {
                    setHasManualCycleSelection(true)
                    setSelectedMonth(month)
                    setShowSettlementHistory(false)
                }}
            />
        </div>
    )
}
