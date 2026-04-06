'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { formatINR, sumAdvances, calculateNetPay, calculateRemainingDebt, calculateMaxDeduction } from '@/lib/finance'
import {
    CheckCircle2, Circle, ChevronLeft, ChevronRight,
    HardHat, Briefcase, AlertCircle, IndianRupee, Loader2, HandCoins, Download, AlertTriangle,
    Search, Trash2, Send, Info, Lock, Unlock, X, Check
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
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

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
}

interface WorkerBase {
    id: number
    name: string
    whatsapp_number?: string | null
    totalAdvances: number
    settlement?: SettlementRecord
}

interface MeterWorkerPayroll extends WorkerBase {
    machines: { machineName: string; meters: number; rate: number; pay: number }[]
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

// ─── Sub-components ──────────────────────────────────────────────────────────
function PaidBadge({ status, settledAt }: { status?: 'paid' | 'pending'; settledAt?: string }) {
    const { t } = useTranslation()
    if (status === 'paid') {
        return (
            <div className="flex items-center gap-1.5 text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-tight">
                    {t('payroll.status.paid')} {settledAt ? new Date(settledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                </span>
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
    
    // Live preview — switches between 50% cap (regular) and 100% cap (final) based on checkbox
    const previewPct = isFinalSettlement ? 100 : 50
    const previewNet = parseFloat(calculateNetPay(worker.totalPay, worker.totalAdvances, previewPct))
    const previewDebt = parseFloat(calculateRemainingDebt(worker.totalPay, worker.totalAdvances, previewPct))
    
    const displayNet = isPaid ? worker.settlement!.net_payout : previewNet
    const displayDeduction = isPaid ? worker.settlement!.advance_deducted : (worker.totalPay - previewNet)
    const displayRemaining = isPaid ? worker.settlement!.carried_forward_debt : previewDebt
    const isCapped = isPaid ? worker.settlement!.compliance_flag : (worker.totalAdvances > displayDeduction && displayDeduction > 0)

    return (
        <div className={cn(
            'border rounded-xl overflow-hidden transition-all duration-300',
            isPaid ? 'border-green-200 bg-green-50/20 shadow-sm' : 'border-gray-200 bg-white hover:border-indigo-200'
        )}>
            <div className="flex items-center justify-between p-4">
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="flex items-center gap-3 text-left flex-1 min-w-0 group"
                >
                    <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-base flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                        {tl(worker.name)[0]}
                    </div>
                    <div className="min-w-0">
                        <div className="font-bold text-gray-900 truncate flex items-center gap-2">
                            {tl(worker.name)}
                            {isPaid && <Check className="h-3.5 w-3.5 text-green-500" />}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                            <span>{worker.totalMeters.toFixed(1)}m production</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                            <span>{worker.machines.length} {worker.machines.length === 1 ? 'machine' : 'machines'}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                            {hasAdvances && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-100 text-[9px] h-4 px-1.5 font-bold uppercase tracking-tight">
                                    <HandCoins className="h-2.5 w-2.5 mr-1" />
                                    {formatINR(worker.totalAdvances)} Adv
                                </Badge>
                            )}
                            <DeductionBadge complianceFlag={isCapped} />
                        </div>
                    </div>
                </button>
                <div className="flex items-center gap-4 flex-shrink-0 ml-3">
                    <div className="text-right">
                        <div className={cn("font-black text-lg tracking-tight", isPaid ? "text-green-700" : "text-gray-900")}>
                            {formatINR(displayNet)}
                        </div>
                        <div className="flex items-center justify-end gap-1.5">
                            {isPaid && worker.settlement?.is_final_settlement && (
                                <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none text-[8px] h-3.5 px-1 font-black uppercase">Final</Badge>
                            )}
                            <PaidBadge status={worker.settlement?.status} settledAt={worker.settlement?.settled_at} />
                        </div>
                    </div>
                    <Button
                        size="sm"
                        variant={isPaid ? 'outline' : 'default'}
                        className={cn(
                            'h-9 px-4 text-xs font-bold rounded-lg transition-all',
                            isPaid 
                                ? 'border-green-200 text-green-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600' 
                                : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg active:scale-95'
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
                                                        <td className="px-3 py-2 font-medium">{m.machineName}</td>
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

    // Live preview — switches between 50% cap (regular) and 100% cap (final) based on checkbox
    const previewPct = isFinalSettlement ? 100 : 50
    const previewNet = parseFloat(calculateNetPay(worker.earnedPay, worker.totalAdvances, previewPct))
    const previewDebt = parseFloat(calculateRemainingDebt(worker.earnedPay, worker.totalAdvances, previewPct))
    
    const displayNet = isPaid ? worker.settlement!.net_payout : previewNet
    const displayDeduction = isPaid ? worker.settlement!.advance_deducted : (worker.earnedPay - previewNet)
    const displayRemaining = isPaid ? worker.settlement!.carried_forward_debt : previewDebt
    const isCapped = isPaid ? worker.settlement!.compliance_flag : (worker.totalAdvances > displayDeduction && displayDeduction > 0)

    return (
        <div className={cn(
            'border rounded-xl overflow-hidden transition-all duration-300',
            isPaid ? 'border-green-200 bg-green-50/20 shadow-sm' : 'border-gray-200 bg-white hover:border-indigo-200'
        )}>
            <div className="flex items-center justify-between p-4">
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="flex items-center gap-3 text-left flex-1 min-w-0 group"
                >
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider', ROLE_COLORS[worker.role] || 'bg-gray-100 text-gray-700')}>
                                {t(`workers.roles.${worker.role}`) || worker.role}
                            </span>
                            {isPaid && <Check className="h-3 w-3 text-green-500" />}
                        </div>
                        <span className="font-bold text-gray-900 truncate block text-base">{tl(worker.name)}</span>
                        <div className="flex items-center gap-2 mt-1.5">
                            {hasAdvances && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-100 text-[9px] h-4 px-1.5 font-bold uppercase tracking-tight">
                                    <HandCoins className="h-2.5 w-2.5 mr-1" />
                                    {formatINR(worker.totalAdvances)} Adv
                                </Badge>
                            )}
                            <DeductionBadge complianceFlag={isCapped} />
                        </div>
                    </div>
                </button>
                <div className="flex items-center gap-4 flex-shrink-0 ml-3">
                    <div className="text-right">
                        <div className={cn("font-black text-lg tracking-tight", isPaid ? "text-green-700" : "text-gray-900")}>
                            {formatINR(displayNet)}
                        </div>
                        <div className="flex items-center justify-end gap-1.5">
                            {isPaid && worker.settlement?.is_final_settlement && (
                                <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none text-[8px] h-3.5 px-1 font-black uppercase">Final</Badge>
                            )}
                            <PaidBadge status={worker.settlement?.status} settledAt={worker.settlement?.settled_at} />
                        </div>
                    </div>
                    <Button
                        size="sm"
                        variant={isPaid ? 'outline' : 'default'}
                        className={cn(
                            'h-9 px-4 text-xs font-bold rounded-lg transition-all',
                            isPaid 
                                ? 'border-green-200 text-green-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600' 
                                : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg active:scale-95'
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PayrollPage() {
    const supabase = createClient()
    const queryClient = useQueryClient()
    const { t } = useTranslation()
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
                .select('worker_id, machine_id, meters, worker_rate_snapshot')
                .eq('org_id', userProfile!.org_id)
                .gte('date', monthStart)
                .lte('date', monthEnd)
            if (logsErr) throw logsErr

            // Fetch workers
            const { data: workers, error: wErr } = await supabase
                .from('workers')
                .select('id, name, whatsapp_number')
                .eq('org_id', userProfile!.org_id)
                .eq('is_active', true)
            if (wErr) throw wErr

            // Fetch machines (for names)
            const { data: machines, error: mErr } = await supabase
                .from('machines')
                .select('id, name')
                .eq('org_id', userProfile!.org_id)
            if (mErr) throw mErr

            // Fetch settlement snapshots from the new table
            const { data: settlements } = await supabase
                .from('payroll_settlements')
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

            // Build map
            const advanceMap: Record<number, number> = {}
            ;(advances || []).forEach((a: any) => {
                advanceMap[a.meter_worker_id] = (advanceMap[a.meter_worker_id] || 0) + parseFloat(a.amount)
            })

            const machineMap = Object.fromEntries((machines || []).map((m: any) => [m.id, m]))
            const settlementMap = Object.fromEntries((settlements || []).map((s: any) => [s.meter_worker_id, s]))

            // Group logs by worker → machine
            const result: MeterWorkerPayroll[] = []
            for (const worker of (workers || [])) {
                const workerLogs = (logs || []).filter((l: any) => l.worker_id === worker.id)
                if (workerLogs.length === 0 && !settlementMap[worker.id]) continue

                // Group by machine + rate
                const machineGroups: Record<string, { meters: number; rate: number; name: string }> = {}
                for (const log of workerLogs) {
                    const machine = machineMap[log.machine_id]
                    const rate = log.worker_rate_snapshot || 0
                    const key = `${log.machine_id}-${rate}`
                    
                    if (!machineGroups[key]) {
                        machineGroups[key] = { meters: 0, rate: rate, name: machine?.name || 'Unknown' }
                    }
                    machineGroups[key].meters += parseFloat(log.meters) || 0
                }
                
                const machineBreakdown = Object.values(machineGroups).map(mg => ({
                    machineName: mg.name,
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
            const { data: workers, error } = await supabase
                .from('fixed_workers')
                .select('*')
                .eq('org_id', userProfile!.org_id)
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
                ;(att || []).forEach((a: any) => {
                    attendanceMap[a.fixed_worker_id] = (attendanceMap[a.fixed_worker_id] || 0) + 1
                })
            }

            // Settlement snapshots
            const { data: settlements } = await supabase
                .from('payroll_settlements')
                .select('*')
                .eq('org_id', userProfile!.org_id)
                .eq('worker_type', 'fixed')
                .eq('month', selectedMonth)
            const settlementMap = Object.fromEntries((settlements || []).map((s: any) => [s.fixed_worker_id, s]))

            // Fetch pending advances
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
                return {
                    id: w.id,
                    name: w.name,
                    whatsapp_number: w.whatsapp_number ?? null,
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
        mutationFn: async ({ workerType, workerId, currentPaid, targetMonth, isFinal }: {
            workerType: 'meter' | 'fixed',
            workerId: number,
            currentPaid: boolean,
            targetMonth: string,
            isFinal: boolean
        }) => {
            return await toggleWorkerPaid(workerType, workerId, targetMonth, currentPaid, isFinal)
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
                        return {
                            ...w,
                            settlement: !variables.currentPaid ? {
                                status: 'paid',
                                settled_at: new Date().toISOString(),
                                is_final_settlement: variables.isFinal,
                                gross_pay: w.totalPay || w.earnedPay || 0,
                                net_payout: parseFloat(calculateNetPay(w.totalPay || w.earnedPay || 0, w.totalAdvances || 0, variables.isFinal ? 100 : 50)),
                                advance_deducted: (w.totalPay || w.earnedPay || 0) - parseFloat(calculateNetPay(w.totalPay || w.earnedPay || 0, w.totalAdvances || 0, variables.isFinal ? 100 : 50)),
                                carried_forward_debt: parseFloat(calculateRemainingDebt(w.totalPay || w.earnedPay || 0, w.totalAdvances || 0, variables.isFinal ? 100 : 50)),
                                compliance_flag: (w.totalAdvances > 0 && !variables.isFinal)
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
        },
        onSuccess: (data) => {
            if (data?.error) {
                toast.error(data.error)
            } else {
                toast.success('✓ Payroll updated', { duration: 2000 })
            }
        }
    })

    const handleTogglePaid = (workerType: 'meter' | 'fixed', workerId: number, currentPaid: boolean, isFinal: boolean = false) => {
        // If unsettling (currentPaid is true), require access code
        if (currentPaid) {
            setPendingAction({ workerType, workerId, currentPaid, isFinal })
            setShowAccessCodeDialog(true)
        } else {
            mutation.mutate({ workerType, workerId, currentPaid, targetMonth: selectedMonth, isFinal })
        }
    }

    const confirmRevert = async () => {
        if (!pendingAction) return
        
        // Check access code (in a real app, we'd verify hash, but for now we check against org config if loaded, 
        // or just proceed if the UI allows it. The RPC will also benefit from server-side checks if implemented).
        // For now, let's assume '1234' for stress testing or better, fetch from org.
        
        const { data: org } = await supabase
            .from('organizations')
            .select('access_code')
            .eq('id', userProfile?.org_id)
            .single()
            
        if (org?.access_code && accessCode !== org.access_code) {
            toast.error('Invalid access code')
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
                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Gross Target</div>
                        <div className="text-xl font-black text-indigo-700 tracking-tight">{formatINR(summary.totalGross)}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-green-50/50">
                    <CardContent className="pt-4 pb-3">
                        <div className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-1">Net Paid</div>
                        <div className="text-xl font-black text-green-700 tracking-tight">{formatINR(summary.totalPaidNet)}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-amber-50/50">
                    <CardContent className="pt-4 pb-3">
                        <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                            <HandCoins className="h-3 w-3" />
                            Recovered
                        </div>
                        <div className="text-xl font-black text-amber-700 tracking-tight">{formatINR(summary.totalDeducted)}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-red-50/50">
                    <CardContent className="pt-4 pb-3">
                        <div className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Outstanding</div>
                        <div className="text-xl font-black text-red-700 tracking-tight">{formatINR(summary.outstanding)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Search & Tabs Header */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                        placeholder="Search worker name..." 
                        className="pl-9 bg-white border-gray-200"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="flex bg-white p-1 rounded-xl border border-gray-200 w-full md:w-auto">
                    <button
                        className={cn(
                            'flex-1 md:w-40 py-2 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all rounded-lg',
                            activeTab === 'meter' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                        )}
                        onClick={() => setActiveTab('meter')}
                    >
                        <HardHat className="h-3.5 w-3.5" />
                        Piece-Rate
                        {meterWorkers && (
                            <span className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1',
                                activeTab === 'meter' ? 'bg-white/20' : 'bg-gray-100'
                            )}>
                                {meterWorkers.filter((w: MeterWorkerPayroll) => !w.settlement).length}
                            </span>
                        )}
                    </button>
                    <button
                        className={cn(
                            'flex-1 md:w-40 py-2 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all rounded-lg',
                            activeTab === 'fixed' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                        )}
                        onClick={() => setActiveTab('fixed')}
                    >
                        <Briefcase className="h-3.5 w-3.5" />
                        Monthly/Daily
                        {fixedWorkers && (
                            <span className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1',
                                activeTab === 'fixed' ? 'bg-white/20' : 'bg-gray-100'
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
                        {Math.round(((summary.totalPaidNet + summary.totalDeducted) / summary.totalGross) * 100)}% Settled
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
                                <p className="text-gray-500 font-medium">{t('payroll.empty.no_production')}</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                                Showing {filteredMeterWorkers.length} results
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
                                <p className="text-gray-500 font-medium">{t('payroll.empty.no_fixed')}</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                                Showing {filteredFixedWorkers.length} results
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
                            Secure Reversal
                        </DialogTitle>
                        <DialogDescription>
                            You are attempting to revert a confirmed settlement. This will re-open advances and update financial records. Please enter your organization's access code to proceed.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center py-6 gap-4">
                        <InputOTP
                            maxLength={4}
                            value={accessCode}
                            onChange={(val) => setAccessCode(val)}
                        >
                            <InputOTPGroup>
                                <InputOTPSlot index={0} />
                                <InputOTPSlot index={1} />
                                <InputOTPSlot index={2} />
                                <InputOTPSlot index={3} />
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
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            className="bg-red-600 font-bold uppercase tracking-widest text-xs"
                            disabled={accessCode.length < 4}
                            onClick={confirmRevert}
                        >
                            Confirm Reversal
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
