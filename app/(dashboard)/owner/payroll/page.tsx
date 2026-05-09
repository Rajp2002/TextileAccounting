'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { formatINR, calculateMaxDeduction } from '@/lib/finance'
import {
    CheckCircle2, Circle, ChevronLeft, ChevronRight,
    HardHat, Briefcase, AlertCircle, Loader2, HandCoins, Download, AlertTriangle,
    Search, Send, Info, Lock, Check
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { createPayrollAdjustment, toggleWorkerPaid } from './actions'
import { useTranslation } from '@/lib/i18n/context'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useTransliterate } from '@/hooks/use-transliterate'
import { useMutation } from '@tanstack/react-query'
import { generateMeterPayslip, generateFixedPayslip } from '@/lib/generate-payslip'
import { MIN_WAGE_DAILY, isBelowMinWage } from '@/lib/wage-config'
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
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog'
import { setWorkerActiveStatus } from '@/app/(dashboard)/owner/actions'

type PaymentMode = 'cash' | 'bank_transfer' | 'upi' | 'cheque'

interface SettlementRecord {
    id: number
    gross_pay: number
    advance_deducted: number
    net_payout: number
    carried_forward_debt: number
    compliance_flag: boolean
    is_final_settlement: boolean
    settled_at: string
    status: 'paid' | 'pending'
    itemization_payload?: any
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

function isPfEsiEnrolled(worker: WorkerBase) {
    return worker.pf_esi_enrolled ?? worker.pf_esi_eligible ?? false
}

function getStatutoryDeductions(gross: number, enrolled: boolean) {
    if (!enrolled) {
        return { pfEmployee: 0, esicEmployee: 0 }
    }

    const pfBasis = Math.min(gross, 15000)
    return {
        pfEmployee: pfBasis * 0.12,
        esicEmployee: gross * 0.0075,
    }
}

function getSettlementPreview(params: {
    gross: number
    totalAdvances: number
    isFinal: boolean
    enrolled: boolean
    manualDeduction?: number | null
}) {
    const maxDeduction = parseFloat(calculateMaxDeduction(params.gross, params.isFinal ? 100 : 50))
    const autoDeduction = Math.min(params.totalAdvances, maxDeduction)
    const advanceDeducted = params.manualDeduction ?? autoDeduction
    const { pfEmployee, esicEmployee } = getStatutoryDeductions(params.gross, params.enrolled)
    const statutoryDeduction = pfEmployee + esicEmployee
    const netPayout = params.gross - advanceDeducted - statutoryDeduction
    return {
        pfEmployee,
        esicEmployee,
        statutoryDeduction,
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
                        {t('payroll.status.paid')} {settledAt ? new Date(settledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
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
    factoryName,
}: {
    worker: MeterWorkerPayroll
    onToggle: (isFinal?: boolean) => void
    isMutating?: boolean
    selectedMonth: string
    factoryName: string
}) {
    const [expanded, setExpanded] = useState(false)
    const [isFinalSettlement, setIsFinalSettlement] = useState(false)
    const [waSending, setWaSending] = useState(false)
    const { t } = useTranslation()
    const tl = useTransliterate()
    const isPaid = worker.settlement?.status === 'paid'
    const hasAdvances = worker.totalAdvances > 0
    
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
            'border rounded-xl overflow-hidden transition-all duration-300',
            isPaid ? 'border-green-200 bg-green-50/20 shadow-sm' : 'border-gray-200 bg-white hover:border-indigo-200'
        )}>
            <div className="flex flex-col sm:flex-row sm:items-center p-4 sm:py-3.5 gap-3">
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="flex items-center gap-3 text-left flex-1 min-w-0 group w-full"
                >
                    <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-base flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
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
                <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 mt-2 sm:mt-0 w-full sm:w-auto bg-gray-50/50 sm:bg-transparent -mx-4 px-4 py-3 sm:p-0 border-t sm:border-0 border-gray-100">
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
                            'h-8 min-w-[112px] px-3.5 text-[11px] font-bold rounded-md leading-none transition-all whitespace-nowrap',
                            isPaid 
                                ? 'border-green-200 text-green-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600' 
                                : 'bg-indigo-600 hover:bg-indigo-700 shadow-sm hover:shadow-md active:scale-95'
                        )}
                        onClick={() => onToggle(false)}
                        disabled={isMutating}
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
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Earnings Breakdown</h4>
                                    <div className="bg-white border rounded-lg overflow-hidden">
                                        <table className="w-full text-xs">
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
                                                                <span className="block text-[10px] text-indigo-500/80 font-medium truncate max-w-[120px]" title={m.orderLabel}>
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
                                                    <td colSpan={2} className="px-3 py-2 text-right text-indigo-600">{formatINR(worker.totalPay)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
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
                                        className="h-8 text-[11px] gap-1.5"
                                        onClick={() => generateMeterPayslip({
                                            factoryName,
                                            month: selectedMonth,
                                            workerName: worker.name,
                                            machines: worker.machines,
                                            totalMeters: worker.totalMeters,
                                            totalPay: worker.totalPay,
                                            totalAdvances: worker.totalAdvances,
                                            netPay: displayNet,
                                            itemization: worker.settlement?.itemization_payload,
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
    factoryName,
}: {
    worker: FixedWorkerPayroll
    onToggle: (isFinal?: boolean) => void
    isMutating?: boolean
    selectedMonth: string
    factoryName: string
}) {
    const [expanded, setExpanded] = useState(false)
    const [isFinalSettlement, setIsFinalSettlement] = useState(false)
    const [waSending, setWaSending] = useState(false)
    const { t } = useTranslation()
    const tl = useTransliterate()
    const isPaid = worker.settlement?.status === 'paid'
    const isDaily = worker.role === 'daily'
    const hasAdvances = worker.totalAdvances > 0

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
            'border rounded-xl overflow-hidden transition-all duration-300',
            isPaid ? 'border-green-200 bg-green-50/20 shadow-sm' : 'border-gray-200 bg-white hover:border-indigo-200'
        )}>
            <div className="flex flex-col sm:flex-row sm:items-center p-4 sm:py-3.5 gap-3">
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="flex items-start sm:items-center gap-3 text-left flex-1 min-w-0 group w-full"
                >
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider', ROLE_COLORS[worker.role] || 'bg-gray-100 text-gray-700')}>
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
                <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 mt-2 sm:mt-0 w-full sm:w-auto bg-gray-50/50 sm:bg-transparent -mx-4 px-4 py-3 sm:p-0 border-t sm:border-0 border-gray-100">
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
                            'h-8 min-w-[112px] px-3.5 text-[11px] font-bold rounded-md leading-none transition-all whitespace-nowrap',
                            isPaid 
                                ? 'border-green-200 text-green-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600' 
                                : 'bg-indigo-600 hover:bg-indigo-700 shadow-sm hover:shadow-md active:scale-95'
                        )}
                        onClick={() => onToggle(false)}
                        disabled={isMutating}
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
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Calculations</h4>
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
                                                <div className="flex justify-between text-[11px] text-indigo-600 italic border-t pt-2">
                                                    <span>Earned Gross</span>
                                                    <span className="font-black">{formatINR(worker.earnedPay)}</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex justify-between font-bold">
                                                <span className="text-gray-500">Monthly Salary</span>
                                                <span className="text-indigo-600">{formatINR(worker.monthly_salary)}</span>
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
                                        className="h-8 text-[11px] gap-1.5"
                                        onClick={() => generateFixedPayslip({
                                            factoryName,
                                            month: selectedMonth,
                                            workerName: worker.name,
                                            role: worker.role,
                                            monthlySalary: worker.monthly_salary,
                                            daysWorked: worker.daysWorked,
                                            earnedPay: worker.earnedPay,
                                            totalAdvances: worker.totalAdvances,
                                            netPay: displayNet,
                                            itemization: worker.settlement?.itemization_payload,
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
    workerType,
    selectedMonth,
    onSettle,
    isMutating,
    categories = [],
    cycleStartDay = 1,
    initialIsFinal = false,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    worker: MeterWorkerPayroll | FixedWorkerPayroll
    workerType: 'meter' | 'fixed'
    selectedMonth: string
    onSettle: (params: { isFinal: boolean; manualDeduction: number | null; paymentMode: PaymentMode }) => void
    isMutating: boolean
    categories: { id: string; name: string; type: 'bonus' | 'fine' }[]
    cycleStartDay: number
    initialIsFinal?: boolean
}) {
    const { t } = useTranslation()
    const tl = useTransliterate()
    const [isFinal, setIsFinal] = useState(initialIsFinal)
    const [manualDeduction, setManualDeduction] = useState<string>('')
    const [confirmed, setConfirmed] = useState(false)
    const [addingAdjustment, setAddingAdjustment] = useState(false)
    const [adjAmount, setAdjAmount] = useState('')
    const [adjCategoryId, setAdjCategoryId] = useState('')
    const [adjDesc, setAdjDesc] = useState('')
    const [paymentMode, setPaymentMode] = useState<PaymentMode | ''>('')
    const [showAdjustmentConfirm, setShowAdjustmentConfirm] = useState(false)
    const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false)
    const enrolled = isPfEsiEnrolled(worker)
    const gross = (worker as MeterWorkerPayroll).totalPay || (worker as FixedWorkerPayroll).earnedPay || 0
    const selectedCategory = categories.find((category) => category.id === adjCategoryId)
    const manualDeductionValue = manualDeduction === '' ? null : parseFloat(manualDeduction)
    const {
        pfEmployee,
        esicEmployee,
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
    })

    const handleAddAdjustment = async () => {
        const amount = parseFloat(adjAmount)
        if (!amount || !adjCategoryId) return
        setAddingAdjustment(true)
        const result = await createPayrollAdjustment({
            workerType,
            workerId: worker.id,
            month: selectedMonth,
            cycleStartDay,
            categoryId: adjCategoryId,
            amount,
            description: adjDesc,
        })

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Adjustment added')
            setAdjAmount('')
            setAdjCategoryId('')
            setAdjDesc('')
        }
        setAddingAdjustment(false)
        setShowAdjustmentConfirm(false)
    }

    const submitSettlement = () => {
        if (!paymentMode) {
            toast.error(t('payroll.payment.modeRequired'))
            return
        }

        onSettle({
            isFinal,
            manualDeduction: manualDeductionValue,
            paymentMode,
        })
        setShowAdvanceConfirm(false)
    }

    const shouldConfirmAdvanceAdjustment =
        manualDeductionValue !== null &&
        Math.abs(manualDeductionValue - autoDeduction) > 0.001

    const adjustmentDescription = selectedCategory?.type === 'fine'
        ? t('confirm.payroll.editFine')
        : t('confirm.payroll.editBonus')

    return (
        <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-none shadow-2xl flex flex-col max-h-[96dvh] sm:max-h-[90vh]">
                <div className="bg-indigo-600 p-4 sm:p-6 text-white shrink-0 relative">
                    <DialogTitle className="text-lg sm:text-xl font-black uppercase tracking-tight flex items-center gap-3 pr-8">
                        <HandCoins className="h-5 w-5 sm:h-6 sm:w-6" />
                        <span className="truncate">{tl(worker.name)}</span>
                    </DialogTitle>
                    <DialogDescription className="text-indigo-100 mt-1 text-xs sm:text-sm font-medium italic opacity-90">
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
                    <div className="space-y-2.5 sm:space-y-3">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Quick Adjustments (Inam / Kapaat)</h4>
                        <div className="bg-gray-50/50 rounded-xl p-3 sm:p-4 border border-gray-200 border-dashed space-y-3 sm:space-y-4">
                            <div className="flex gap-2">
                                <Select value={adjCategoryId} onValueChange={setAdjCategoryId}>
                                    <SelectTrigger className="h-9 sm:h-10 text-xs bg-white border-gray-200">
                                        <SelectValue placeholder="Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map(c => (
                                            <SelectItem key={c.id} value={c.id} className="text-xs">
                                                {c.name} ({c.type})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Input 
                                    placeholder="Amount" 
                                    type="number" 
                                    className="h-9 sm:h-10 w-24 sm:w-28 text-xs bg-white border-gray-200" 
                                    value={adjAmount}
                                    onChange={e => setAdjAmount(e.target.value)}
                                />
                                <Button
                                    size="sm"
                                    className="h-9 sm:h-10 px-3 sm:px-4 bg-indigo-600 hover:bg-indigo-700"
                                    onClick={() => setShowAdjustmentConfirm(true)}
                                    disabled={addingAdjustment || !adjAmount || !adjCategoryId}
                                >
                                    {addingAdjustment ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-5 w-5"/>}
                                </Button>
                            </div>
                            <Input 
                                placeholder="Description (Optional)" 
                                className="h-8 sm:h-9 text-[10px] sm:text-[11px] bg-white border-gray-200"
                                value={adjDesc}
                                onChange={e => setAdjDesc(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Advace Deduction Override */}
                    <div className="space-y-4 pt-2 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label className="text-sm font-black text-gray-700">Advance Recovery</Label>
                                <p className="text-[10px] text-gray-500 italic">Recommended: {formatINR(autoDeduction)} (of {formatINR(worker.totalAdvances)} total debt)</p>
                            </div>
                            <div className="relative w-40">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">₹</span>
                                <Input 
                                    className="pl-8 h-11 font-black text-indigo-700 text-right text-lg border-gray-200 bg-white" 
                                    placeholder={autoDeduction.toString()}
                                    value={manualDeduction}
                                    onChange={e => setManualDeduction(e.target.value)}
                                />
                            </div>
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
                            <Checkbox id="final" checked={isFinal} onCheckedChange={(c) => setIsFinal(!!c)} className="mt-1" />
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
                            className="flex-[2] h-10 sm:h-12 text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest shadow-lg shadow-indigo-100 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed transition-all" 
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
            open={showAdjustmentConfirm}
            onOpenChange={setShowAdjustmentConfirm}
            title={t('confirm.title')}
            description={adjustmentDescription}
            onConfirm={handleAddAdjustment}
            isLoading={addingAdjustment}
        />
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PayrollPage() {
    const supabase = createClient()
    const queryClient = useQueryClient()
    const { t } = useTranslation()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [activeTab, setActiveTab] = useState<'meter' | 'fixed'>('meter')
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7))
    const [searchTerm, setSearchTerm] = useState('')
    const [showAccessCodeDialog, setShowAccessCodeDialog] = useState(false)
    const [accessCode, setAccessCode] = useState('')
    const [pendingAction, setPendingAction] = useState<{
        workerType: 'meter' | 'fixed',
        workerId: number,
        currentPaid: boolean,
        isFinal: boolean
    } | null>(null)

    const { data: userProfile } = useUserProfile()

    // 1. Adjustment Categories for V2 Logic
    const { data: categories } = useQuery({
        queryKey: ['payroll_adj_categories', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data } = await supabase.from('payroll_adjustment_categories').select('*').order('name')
            return data || []
        }
    })

    // 2. Cycle Config
    const { data: cycleConfig } = useQuery({
        queryKey: ['payroll_config', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data } = await supabase.from('payroll_configs').select('*').eq('org_id', userProfile!.org_id).maybeSingle()
            return data
        }
    })
    const cycleStartDay = cycleConfig?.cycle_start_day || 1

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
            
            const [year, month] = selectedMonth.split('-')
            const lastDay = new Date(Number(year), Number(month), 0).getDate()
            const monthEnd = `${selectedMonth}-${lastDay}`

            const [logsRes, workersRes, machinesRes, settlementsRes, advancesRes, ordersRes] = await Promise.all([
                // Fetch order_id too — needed for order attribution per wage line
                supabase.from('production_logs')
                    .select('worker_id, machine_id, meters, worker_rate_snapshot, order_id')
                    .eq('org_id', userProfile!.org_id)
                    .gte('date', monthStart)
                    .lte('date', monthEnd),
                // Fetch ALL workers (active + inactive) — inactive workers who worked this month must still appear
                supabase.from('workers')
                    .select('id, name, whatsapp_number, is_active, pf_esi_enrolled, pf_esi_eligible')
                    .eq('org_id', userProfile!.org_id),
                supabase.from('machines')
                    .select('id, name')
                    .eq('org_id', userProfile!.org_id),
                supabase.from('payroll_settlements')
                    .select('*')
                    .eq('org_id', userProfile!.org_id)
                    .eq('worker_type', 'meter')
                    .eq('month', selectedMonth),
                supabase.from('worker_advances')
                    .select('meter_worker_id, amount')
                    .eq('org_id', userProfile!.org_id)
                    .eq('status', 'pending')
                    .is('writeoff_at', null)
                    .not('meter_worker_id', 'is', null),
                // Fetch all orders (active + recently completed) for order label lookup
                supabase.from('orders')
                    .select('id, party_name, quality_label')
                    .eq('org_id', userProfile!.org_id)
                    .in('status', ['active', 'completed', 'cancelled'])
            ])

            if (logsRes.error) throw logsRes.error
            if (workersRes.error) throw workersRes.error
            if (machinesRes.error) throw machinesRes.error

            const logs = logsRes.data
            const workers = workersRes.data
            const machines = machinesRes.data
            const settlements = settlementsRes.data
            const advances = advancesRes.data
            const orders = ordersRes.data

            // Build maps
            const advanceMap: Record<number, number> = {}
            ;(advances || []).forEach((a: any) => {
                advanceMap[a.meter_worker_id] = (advanceMap[a.meter_worker_id] || 0) + parseFloat(a.amount)
            })

            const machineMap = Object.fromEntries((machines || []).map((m: any) => [m.id, m]))
            const settlementMap = Object.fromEntries((settlements || []).map((s: any) => [s.meter_worker_id, s]))
            // Order label: prefer quality_label, fall back to party_name alone
            const orderLabelMap = Object.fromEntries(
                (orders || []).map((o: any) => [
                    o.id,
                    o.quality_label ? `${o.party_name} · ${o.quality_label}` : o.party_name
                ])
            )

            // Determine which worker IDs actually have logs this month (for inactive worker inclusion)
            const workerIdsWithLogs = new Set((logs || []).map((l: any) => l.worker_id))

            // Group logs by worker → order + machine + rate
            const result: MeterWorkerPayroll[] = []
            for (const worker of (workers || [])) {
                // Include worker if active OR if they have logs this period (handles mid-cycle deactivation)
                if (!worker.is_active && !workerIdsWithLogs.has(worker.id)) continue

                const workerLogs = (logs || []).filter((l: any) => l.worker_id === worker.id)
                if (workerLogs.length === 0 && !settlementMap[worker.id]) continue

                // Group by order + machine + rate — separates wage lines per order
                const machineGroups: Record<string, { meters: number; rate: number; name: string; orderLabel?: string }> = {}
                for (const log of workerLogs) {
                    const machine = machineMap[log.machine_id]
                    const rate = log.worker_rate_snapshot || 0
                    const orderId = log.order_id || '__no_order__'
                    // Key on order + machine + rate so different orders on same machine split cleanly
                    const key = `${orderId}-${log.machine_id}-${rate}`
                    
                    if (!machineGroups[key]) {
                        machineGroups[key] = {
                            meters: 0,
                            rate,
                            name: machine?.name || 'Unknown',
                            orderLabel: log.order_id ? orderLabelMap[log.order_id] : undefined,
                        }
                    }
                    machineGroups[key].meters += parseFloat(log.meters) || 0
                }
                
                const machineBreakdown = Object.values(machineGroups).map(mg => ({
                    machineName: mg.name,
                    orderLabel: mg.orderLabel,
                    meters: mg.meters,
                    rate: mg.rate,
                    pay: mg.meters * mg.rate,
                }))

                const totalMeters = machineBreakdown.reduce((s, m) => s + m.meters, 0)
                const totalPay = machineBreakdown.reduce((s, m) => s + m.pay, 0)
                const totalAdvances = advanceMap[worker.id] || 0

                result.push({
                    id: worker.id,
                    name: worker.name,
                    whatsapp_number: worker.whatsapp_number ?? null,
                    pf_esi_enrolled: worker.pf_esi_enrolled,
                    pf_esi_eligible: worker.pf_esi_eligible,
                    machines: machineBreakdown,
                    totalMeters,
                    totalPay,
                    totalAdvances,
                    settlement: settlementMap[worker.id],
                })
            }

            return result.sort((a, b) => b.totalPay - a.totalPay)
        }
    })

    const { data: fixedWorkers, isLoading: fixedLoading } = useQuery({
        queryKey: ['payroll_fixed', userProfile?.org_id, selectedMonth],
        enabled: !!userProfile?.org_id && !!selectedMonth,
        queryFn: async () => {
            const [fYear, fMonth] = selectedMonth.split('-')
            const fLastDay = new Date(Number(fYear), Number(fMonth), 0).getDate()
            const monthEnd = `${selectedMonth}-${String(fLastDay).padStart(2, '0')}`

            const workersRes = await supabase
                .from('fixed_workers')
                .select('*')
                .eq('org_id', userProfile!.org_id)
                .order('role').order('name')
            if (workersRes.error) throw workersRes.error
            const workers = workersRes.data

            const dailyIds = (workers || []).filter((w: any) => w.role === 'daily').map((w: any) => w.id)

            const [attRes, settlementsRes, advancesRes] = await Promise.all([
                dailyIds.length > 0
                    ? supabase.from('attendance')
                        .select('fixed_worker_id, present')
                        .eq('org_id', userProfile!.org_id)
                        .in('fixed_worker_id', dailyIds)
                        .gte('date', `${selectedMonth}-01`)
                        .lte('date', `${selectedMonth}-${new Date(Number(selectedMonth.split('-')[0]), Number(selectedMonth.split('-')[1]), 0).getDate()}`)
                        .eq('present', true)
                    : Promise.resolve({ data: [] }),
                supabase.from('payroll_settlements')
                    .select('*')
                    .eq('org_id', userProfile!.org_id)
                    .eq('worker_type', 'fixed')
                    .eq('month', selectedMonth),
                supabase.from('worker_advances')
                    .select('fixed_worker_id, amount')
                    .eq('org_id', userProfile!.org_id)
                    .eq('status', 'pending')
                    .is('writeoff_at', null)
                    .not('fixed_worker_id', 'is', null)
            ])

            const att = attRes.data
            const settlements = settlementsRes.data
            const advances = advancesRes.data

            const attendanceMap: Record<number, number> = {}
            ;(att || []).forEach((a: any) => {
                attendanceMap[a.fixed_worker_id] = (attendanceMap[a.fixed_worker_id] || 0) + 1
            })

            const settlementMap = Object.fromEntries((settlements || []).map((s: any) => [s.fixed_worker_id, s]))

            const advanceMap: Record<number, number> = {}
            ;(advances || []).forEach((a: any) => {
                advanceMap[a.fixed_worker_id] = (advanceMap[a.fixed_worker_id] || 0) + parseFloat(a.amount)
            })

            return (workers || [])
                // Only show workers who had joined on or before the last day of the selected month.
                // This prevents a supervisor added in March 2026 from appearing in December 2025 payroll.
                .filter((w: any) => !w.start_date || w.start_date <= monthEnd)
                .map((w: any) => {
                const daysWorked = w.role === 'daily' ? (attendanceMap[w.id] || 0) : undefined
                const earnedPay = w.role === 'daily'
                    ? Math.min(w.monthly_salary, (w.monthly_salary / 30) * (daysWorked ?? 0))
                    : w.monthly_salary
                const totalAdvances = advanceMap[w.id] || 0
                return {
                    id: w.id,
                    name: w.name,
                    whatsapp_number: w.whatsapp_number ?? null,
                    pf_esi_enrolled: w.pf_esi_enrolled,
                    pf_esi_eligible: w.pf_esi_eligible,
                    role: w.role,
                    monthly_salary: w.monthly_salary,
                    daysWorked,
                    earnedPay,
                    totalAdvances,
                    settlement: settlementMap[w.id],
                } as FixedWorkerPayroll
            })
        }
    })

    // ── Toggle paid with Optimistic UI ──────────────────────────────────────
    const mutation = useMutation({
        mutationFn: async ({ workerType, workerId, currentPaid, targetMonth, isFinal, manualDeductionOverride, paymentMode }: {
            workerType: 'meter' | 'fixed',
            workerId: number,
            currentPaid: boolean,
            targetMonth: string,
            isFinal: boolean,
            manualDeductionOverride?: number | null
            paymentMode?: PaymentMode | null
        }) => {
            return await toggleWorkerPaid(
                workerType,
                workerId,
                targetMonth,
                currentPaid,
                isFinal,
                manualDeductionOverride,
                null,
                paymentMode ?? null
            )
        },
        onMutate: async (variables) => {
            const orgId = userProfile?.org_id
            const targetMonth = variables.targetMonth
            const queryKey = variables.workerType === 'meter' 
                ? ['payroll_meter', orgId, targetMonth] 
                : ['payroll_fixed', orgId, targetMonth]

            await queryClient.cancelQueries({ queryKey })
            const previousData = queryClient.getQueryData(queryKey)

            queryClient.setQueryData(queryKey, (old: any) => {
                if (!old) return old
                return old.map((w: any) => {
                    if (w.id === variables.workerId) {
                        const gross = w.totalPay || w.earnedPay || 0
                        const enrolled = isPfEsiEnrolled(w)
                        const preview = getSettlementPreview({
                            gross,
                            totalAdvances: w.totalAdvances || 0,
                            isFinal: variables.isFinal,
                            enrolled,
                            manualDeduction: variables.manualDeductionOverride ?? null,
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
                                    employee_pf: preview.pfEmployee,
                                    employee_esic: preview.esicEmployee,
                                    payment_mode: variables.paymentMode ?? null,
                                } : {
                                    payment_mode: variables.paymentMode ?? null,
                                },
                            } : null
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
    const [pendingSettleWorker, setPendingSettleWorker] = useState<any>(null)
    const [handledExitLaunch, setHandledExitLaunch] = useState(false)

    const handleTogglePaid = (workerType: 'meter' | 'fixed', workerId: number, currentPaid: boolean, isFinal: boolean = false) => {
        // Find worker data to pre-fill dialog
        const source = workerType === 'meter' ? meterWorkers : fixedWorkers
        const worker = (source || []).find((w: any) => w.id === workerId)

        if (currentPaid) {
            setPendingAction({ workerType, workerId, currentPaid, isFinal })
            setShowAccessCodeDialog(true)
        } else {
            setPendingSettleWorker({ ...worker, type: workerType })
            setShowSettlementDialog(true)
        }
    }

    const confirmRevert = async () => {
        if (!pendingAction) return
        
        // Check access code (in a real app, we'd verify hash, but for now we check against org config if loaded, 
        // or just proceed if the UI allows it. The RPC will also benefit from server-side checks if implemented).
        // For now, let's assume '1234' for stress testing or better, fetch from org.
        
        const { data: org } = await supabase
            .from('organizations')
            .select('last_code_plain')
            .eq('id', userProfile?.org_id)
            .single()
            
        if (org?.last_code_plain && accessCode !== org.last_code_plain) {
        toast.error(t('payroll_ext.invalid_code'))
            return
        }

        mutation.mutate({ 
            workerType: pendingAction.workerType, 
            workerId: pendingAction.workerId, 
            currentPaid: pendingAction.currentPaid, 
            targetMonth: selectedMonth, 
            isFinal: false 
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="border-none shadow-sm bg-indigo-50/50">
                    <CardContent className="pt-4 pb-3">
                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">{t('payroll_ext.gross_target')}</div>
                        <div className="text-xl font-black text-indigo-700 tracking-tight">{formatINR(summary.totalGross)}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-green-50/50">
                    <CardContent className="pt-4 pb-3">
                        <div className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-1">{t('payroll_ext.net_paid')}</div>
                        <div className="text-xl font-black text-green-700 tracking-tight">{formatINR(summary.totalPaidNet)}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-amber-50/50">
                    <CardContent className="pt-4 pb-3">
                        <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                            <HandCoins className="h-3 w-3" />
                            {t('payroll_ext.recovered')}
                        </div>
                        <div className="text-xl font-black text-amber-700 tracking-tight">{formatINR(summary.totalDeducted)}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-red-50/50">
                    <CardContent className="pt-4 pb-3">
                        <div className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">{t('payroll_ext.outstanding')}</div>
                        <div className="text-xl font-black text-red-700 tracking-tight">{formatINR(summary.outstanding)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Search & Tabs Header */}
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
                            'flex-1 md:min-w-[200px] px-1.5 sm:px-4 py-2.5 text-[9px] sm:text-xs font-black uppercase tracking-tighter sm:tracking-widest flex items-center justify-center gap-1 sm:gap-3 transition-all rounded-lg min-w-0',
                            activeTab === 'meter' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                        )}
                        onClick={() => setActiveTab('meter')}
                    >
                        <HardHat className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                        <span className="truncate">{t('payroll_ext.piece_rate_tab')}</span>
                        {meterWorkers && (
                            <span className={cn(
                                'text-[10px] px-2 py-0.5 rounded-full font-bold ml-2 shrink-0',
                                activeTab === 'meter' ? 'bg-white/25' : 'bg-gray-100'
                            )}>
                                {meterWorkers.filter((w: MeterWorkerPayroll) => !w.settlement).length}
                            </span>
                        )}
                    </button>
                    <button
                        className={cn(
                            'flex-1 md:min-w-[200px] px-1.5 sm:px-4 py-2.5 text-[9px] sm:text-xs font-black uppercase tracking-tighter sm:tracking-widest flex items-center justify-center gap-1 sm:gap-3 transition-all rounded-lg min-w-0',
                            activeTab === 'fixed' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                        )}
                        onClick={() => setActiveTab('fixed')}
                    >
                        <Briefcase className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                        <span className="truncate">{t('payroll_ext.monthly_daily_tab')}</span>
                        {fixedWorkers && (
                            <span className={cn(
                                'text-[10px] px-2 py-0.5 rounded-full font-bold ml-2 shrink-0',
                                activeTab === 'fixed' ? 'bg-white/25' : 'bg-gray-100'
                            )}>
                                {fixedWorkers.filter((w: FixedWorkerPayroll) => !w.settlement).length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Progress bar */}
            {summary.totalGross > 0 && (
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
                                    factoryName={orgName}
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
                    workerType={pendingSettleWorker.type}
                    selectedMonth={selectedMonth}
                    categories={categories || []}
                    cycleStartDay={cycleStartDay}
                    initialIsFinal={!!pendingSettleWorker.initialIsFinal}
                    isMutating={mutation.isPending}
                    onSettle={({ isFinal, manualDeduction, paymentMode }) => {
                        mutation.mutate({ 
                            workerType: pendingSettleWorker.type, 
                            workerId: pendingSettleWorker.id, 
                            currentPaid: false, 
                            targetMonth: selectedMonth, 
                            isFinal,
                            manualDeductionOverride: manualDeduction,
                            paymentMode,
                        })
                    }}
                />
            )}
        </div>
    )
}
