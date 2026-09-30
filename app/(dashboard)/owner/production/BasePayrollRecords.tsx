'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    Download,
    FileSpreadsheet,
    FileText,
    History,
    Search,
    WalletCards,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { reverseBasePayrollSettlement } from './actions'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LiquidSegmented } from '@/components/ui/liquid-segmented'
import { formatINR } from '@/lib/finance'
import {
    buildBasePayrollHistory,
    buildBasePayrollHistoryCsv,
} from '@/lib/base-payroll-history'
import type { BasePayrollPaymentMode } from '@/lib/base-production-core'

import type { BaseProductionInitialData } from './loaders'

function formatDateOnly(value: string | null | undefined) {
    if (!value) return '—'
    const [year, month, day] = value.slice(0, 10).split('-').map(Number)
    if (![year, month, day].every(Number.isFinite)) return value
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
    }).format(new Date(Date.UTC(year, month - 1, day)))
}

function formatMeters(value: number) {
    return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)} m`
}

function formatCount(value: number, singular: string, plural = `${singular}s`) {
    return `${value} ${value === 1 ? singular : plural}`
}

function paymentModeLabel(mode: BasePayrollPaymentMode) {
    if (mode === 'bank_transfer') return 'Bank transfer'
    if (mode === 'upi') return 'UPI'
    if (mode === 'cheque') return 'Cheque'
    return 'Cash'
}

function safeFilename(value: string) {
    return value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'Weavly'
}

function downloadText(filename: string, content: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
}

function SummaryMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
    return (
        <Card className="shadow-none">
            <CardContent className="py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-1 text-xl font-black text-ink">{value}</p>
                <p className="mt-1 text-xs text-body">{detail}</p>
            </CardContent>
        </Card>
    )
}



export default function BasePayrollRecords({
    initialData,
    onBack,
}: {
    initialData: BaseProductionInitialData
    onBack: () => void
}) {
    const router = useRouter()
    const [reversingId, setReversingId] = useState<string | null>(null)
    const [reversalReason, setReversalReason] = useState('')
    const [paymentNotMade, setPaymentNotMade] = useState(false)
    const [reversing, setReversing] = useState(false)

    const reversalTarget = initialData.settlements.find(settlement => settlement.id === reversingId)

    async function confirmReversal() {
        if (!reversingId || reversing || !paymentNotMade) return
        setReversing(true)
        try {
            const result = await reverseBasePayrollSettlement({ settlementId: reversingId, reason: reversalReason, paymentNotMade })
            if ('error' in result) { toast.error(result.error); return }
            toast.success('Reversal recorded. The original payment record is preserved.')
            setReversingId(null)
            router.refresh()
        } catch { toast.error('Reversal could not be confirmed. Reload records before trying again.') }
        finally { setReversing(false) }
    }
    const periods = useMemo(
        () => buildBasePayrollHistory(initialData.settlements, initialData.settlementLines, initialData.payrollPeriods),
        [initialData.settlementLines, initialData.settlements, initialData.payrollPeriods],
    )
    const [selectedKey, setSelectedKey] = useState(periods[0]?.key ?? '')
    const [search, setSearch] = useState('')
    const [recordsView, setRecordsView] = useState<'workers' | 'machines'>('workers')
    const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set())
    const [expandedMachines, setExpandedMachines] = useState<Set<string>>(new Set())
    const [exportingPdf, setExportingPdf] = useState(false)
    const deferredSearch = useDeferredValue(search)

    const selectedPeriod = periods.find((period) => period.key === selectedKey) ?? periods[0]
    const query = deferredSearch.trim().toLowerCase()
    const visibleWorkers = selectedPeriod?.workers.filter((worker) => (
        !query
        || worker.workerName.toLowerCase().includes(query)
        || worker.earnings.some((earning) => (
            earning.machineLabel.toLowerCase().includes(query)
            || earning.costingLabel.toLowerCase().includes(query)
        ))
    )) ?? []
    const visibleMachines = selectedPeriod?.machines.filter((machine) => (
        !query
        || machine.machineLabel.toLowerCase().includes(query)
        || machine.workers.some((worker) => (
            worker.workerName.toLowerCase().includes(query)
            || worker.costingLabel.toLowerCase().includes(query)
        ))
    )) ?? []

    function toggleWorker(id: string) {
        setExpandedWorkers((current) => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function toggleMachine(id: string) {
        setExpandedMachines((current) => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function exportCsv() {
        if (!selectedPeriod) return
        const factory = safeFilename(initialData.factoryName ?? 'Weavly')
        downloadText(
            `${factory}_Payroll_${selectedPeriod.start}_${selectedPeriod.end}.csv`,
            buildBasePayrollHistoryCsv(selectedPeriod),
            'text/csv;charset=utf-8',
        )
        toast.success('Detailed payroll CSV exported.')
    }

    async function exportPdf() {
        if (!selectedPeriod || exportingPdf) return
        setExportingPdf(true)
        try {
            const { generateBasePayrollPdf } = await import('@/lib/generate-base-payroll-pdf')
            await generateBasePayrollPdf({ ...selectedPeriod, workers: selectedPeriod.workers.filter(worker => worker.status !== 'reversed') }, {
                factoryName: initialData.factoryName,
                autoSave: true,
            })
            toast.success('Detailed payroll PDF exported.')
        } catch (error) {
            console.error('[base-payroll-history] PDF export failed', error)
            toast.error('The payroll PDF could not be generated.')
        } finally {
            setExportingPdf(false)
        }
    }

    return (
        <div className="space-y-5">
            <Dialog open={Boolean(reversingId)} onOpenChange={open => { if (!open && !reversing) setReversingId(null) }}>
                <DialogContent><DialogHeader><DialogTitle>Reverse a mistaken payment record?</DialogTitle><DialogDescription>This preserves the original receipt, restores its recorded advance recovery, and makes the earnings outstanding again. It does not reverse cash or a bank transfer. Use this only when payment was not actually made.</DialogDescription></DialogHeader>
                    <p className="rounded-lg border border-hairline bg-surface-soft p-3 text-sm"><strong>{reversalTarget?.worker_name_snapshot}</strong> · {formatINR(reversalTarget?.net_payout ?? 0)}<br />{formatDateOnly(reversalTarget?.period_start)} – {formatDateOnly(reversalTarget?.period_end)}</p>
                    <Label htmlFor="base-reversal-reason">Reason for reversal</Label><Textarea id="base-reversal-reason" value={reversalReason} onChange={event => setReversalReason(event.target.value)} maxLength={240} disabled={reversing} />
                    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={paymentNotMade} disabled={reversing} onChange={event => setPaymentNotMade(event.target.checked)} />I confirm this payment was not actually made.</label>
                    <DialogFooter><Button variant="outline" disabled={reversing} onClick={() => setReversingId(null)}>Keep record</Button><Button disabled={reversing || !paymentNotMade || reversalReason.trim().length < 3} onClick={() => void confirmReversal()}>{reversing ? 'Recording reversal…' : 'Record reversal'}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                    <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-saffron-deep" />
                        <h2 className="text-xl font-black text-ink">Payroll records</h2>
                    </div>
                    <p className="mt-1 text-sm text-body">A permanent worker, machine, costing, advance, and payment record for every settled period.</p>
                </div>
            </div>

            {periods.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center py-12 text-center">
                        <WalletCards className="h-8 w-8 text-muted-foreground" />
                        <h3 className="mt-3 font-bold text-ink">No settled pay periods yet</h3>
                        <p className="mt-1 max-w-md text-sm text-body">After a worker is marked paid, the period and its complete earning calculation will appear here.</p>
                        <Button className="mt-4" variant="outline" onClick={onBack}>Open current payroll</Button>
                    </CardContent>
                </Card>
            ) : selectedPeriod ? (
                <>
                    <Card className="rounded-2xl border border-hairline bg-surface shadow-xs">
                        <CardContent className="flex flex-col gap-3 py-4 lg:flex-row lg:items-end lg:justify-between">
                            <div className="grid flex-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-body" htmlFor="payroll-history-period">Pay period</label>
                                        {selectedPeriod.isSettled ? (
                                            <Badge className="bg-[var(--wv-moss-700)] text-white font-bold text-[10px]">
                                                <CheckCircle2 className="h-3 w-3 mr-1" /> Settled
                                            </Badge>
                                        ) : null}
                                    </div>
                                    <Select value={selectedPeriod.key} onValueChange={(value) => { setSelectedKey(value); setSearch('') }}>
                                        <SelectTrigger id="payroll-history-period" className="w-full h-10 rounded-xl border border-hairline bg-surface text-sm"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {periods.map((period) => (
                                                <SelectItem key={period.key} value={period.key}>
                                                    {formatDateOnly(period.start)} – {formatDateOnly(period.end)} · {formatCount(period.workers.length, 'record')}{period.isSettled ? ' · Settled' : ''}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-body" htmlFor="payroll-history-search">Find worker, machine, or costing</label>
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input id="payroll-history-search" value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 rounded-xl border border-hairline bg-surface pl-9 text-sm text-ink placeholder:text-muted-foreground/70 focus:border-loom-subtle focus:ring-2 focus:ring-loom/10" placeholder="Search records" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" className="h-10 rounded-xl border-hairline bg-surface text-ink shadow-xs hover:border-hairline-strong hover:bg-surface-soft" onClick={exportCsv}><FileSpreadsheet className="h-4 w-4" /> Export CSV</Button>
                                <Button className="h-10 rounded-xl bg-loom text-white shadow-xs hover:bg-loom-elevated" onClick={() => void exportPdf()} disabled={exportingPdf || selectedPeriod.workers.every(worker => worker.status === 'reversed')}><FileText className="h-4 w-4" /> {exportingPdf ? 'Preparing PDF…' : 'Export PDF'}</Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <SummaryMetric label="Total production" value={formatMeters(selectedPeriod.totalMeters)} detail={formatCount(selectedPeriod.machines.length, 'machine')} />
                        <SummaryMetric label="Gross earnings" value={formatINR(selectedPeriod.totalGrossPay)} detail={`${formatCount(selectedPeriod.workers.filter(worker => worker.status !== 'reversed').length, 'worker')} settled`} />
                        <SummaryMetric label="Advances recovered" value={formatINR(selectedPeriod.totalAdvanceRecovered)} detail="Deducted in this period" />
                        <SummaryMetric label="Net payroll" value={formatINR(selectedPeriod.totalNetPayout)} detail={`Paid by ${selectedPeriod.paymentModes.map(mode => mode === 'upi' ? 'UPI' : paymentModeLabel(mode).toLocaleLowerCase('en-IN')).join(', ')}`} />
                    </div>
                    {selectedPeriod.workers.some(worker => worker.status === 'reversed') && <p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">Reversed records remain below and in the CSV audit export. They are excluded from payment totals, machine totals, and the active-payment PDF.</p>}

                    <div className="space-y-4">
                        <LiquidSegmented
                            className="sm:w-[360px]"
                            fullWidth
                            aria-label="Payment records view"
                            value={recordsView}
                            onValueChange={setRecordsView}
                            options={[
                                { value: 'workers', label: `Workers (${visibleWorkers.length})` },
                                { value: 'machines', label: `Machines (${visibleMachines.length})` },
                            ]}
                        />

                        {recordsView === 'workers' && <div className="space-y-3">
                            {visibleWorkers.map((worker) => {
                                const original = initialData.settlements.find(settlement => settlement.id === worker.settlementId)
                                const hasLaterPayment = initialData.settlements.some(settlement => settlement.worker_id === worker.workerId && settlement.status !== 'reversed' && settlement.period_end > (original?.period_end ?? ''))
                                const canReverse = original && worker.status !== 'reversed' && !hasLaterPayment && (original.advance_deducted === 0 || original.recovery_receipt_complete)
                                const expanded = expandedWorkers.has(worker.settlementId)
                                const isSalary = worker.earnings.some(earning => earning.payType === 'fixed_monthly')
                                const machineCount = new Set(worker.earnings.filter(earning => earning.payType !== 'fixed_monthly' && earning.kind !== 'manual_incentive').map((earning) => earning.machineId ?? earning.machineLabel)).size
                                return (
                                    <Card key={worker.settlementId} className="[contain-intrinsic-size:140px] [content-visibility:auto]">
                                        <button type="button" className="w-full text-left" onClick={() => toggleWorker(worker.settlementId)} aria-expanded={expanded}>
                                            <CardHeader className="transition-colors hover:bg-surface-soft/50">
                                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                                    <div className="flex min-w-0 items-start gap-2">
                                                        {expanded ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-saffron-deep" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                                                        <div><CardTitle className="text-base">{worker.workerName}{worker.status === 'reversed' ? ' · Reversed' : ''}</CardTitle><CardDescription>{isSalary ? 'Fixed monthly salary' : formatCount(machineCount, 'machine')} · {worker.status === 'reversed' ? 'original record' : 'paid'} {formatDateOnly(worker.paidAt)}</CardDescription></div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                                                        <div><p className="text-xs text-muted-foreground">{isSalary ? 'Pay basis' : 'Production'}</p><p className="font-bold text-ink">{isSalary ? 'Monthly salary' : formatMeters(worker.meters)}</p></div>
                                                        <div><p className="text-xs text-muted-foreground">Gross</p><p className="font-bold text-ink">{formatINR(worker.grossPay)}</p></div>
                                                        <div><p className="text-xs text-muted-foreground">Recovered</p><p className="font-bold text-ink">{formatINR(worker.advanceRecovered)}</p></div>
                                                        <div><p className="text-xs text-muted-foreground">Net paid</p><p className="font-black text-saffron-deep">{formatINR(worker.netPayout)}</p></div>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                        </button>
                                        {expanded && (
                                            <CardContent className="space-y-4 border-t border-hairline pt-4">
                                                {worker.status === 'reversed' ? <p className="rounded-lg bg-warning/10 p-3 text-sm">Reversed {formatDateOnly(original?.reversed_at)}: {worker.reversalReason}. The amounts below are the preserved original record.</p> : <div className="space-y-2"><Button variant="outline" size="sm" disabled={!canReverse} onClick={() => { setReversingId(worker.settlementId); setReversalReason(''); setPaymentNotMade(false) }}>Resolve mistaken payment record</Button>{!canReverse && <p className="text-xs text-body">{hasLaterPayment ? 'A later payment depends on this record. Resolve the latest settlement first.' : 'This older record lacks the per-advance receipt needed for a safe automatic reversal.'}</p>}</div>}
                                                <div className="overflow-x-auto rounded-lg border border-hairline">
                                                    <table className="w-full min-w-[720px] text-sm">
                                                        <thead className="bg-surface-soft text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2">{isSalary ? 'Pay basis' : 'Machine'}</th><th className="px-3 py-2">{isSalary ? 'Salary period' : 'Costing'}</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2 text-right">Production</th><th className="px-3 py-2 text-right">Earnings</th></tr></thead>
                                                        <tbody className="divide-y divide-hairline">
                                                            {worker.earnings.map((earning) => (
                                                                <tr key={`${earning.machineId ?? earning.machineLabel}:${earning.costingLabel}:${earning.rate}`}>
                                                                    <td className="px-3 py-3 font-semibold text-ink">{earning.machineLabel}</td>
                                                                    <td className="px-3 py-3 text-body">{earning.costingLabel}</td>
                                                                    <td className="px-3 py-3 text-right text-body">{earning.kind === 'manual_incentive' ? '—' : <>{formatINR(earning.rate)}/{earning.payType === 'fixed_monthly' ? 'month' : 'm'}</>}</td>
                                                                    <td className="px-3 py-3 text-right font-semibold text-ink">{earning.payType === 'fixed_monthly' || earning.kind === 'manual_incentive' ? '—' : formatMeters(earning.meters)}</td>
                                                                    <td className="px-3 py-3 text-right font-bold text-ink">{formatINR(earning.grossPay)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot className="border-t border-hairline bg-surface-soft/70 font-bold text-ink"><tr><td className="px-3 py-3" colSpan={3}>Cumulative worker total</td><td className="px-3 py-3 text-right">{formatMeters(worker.meters)}</td><td className="px-3 py-3 text-right">{formatINR(worker.grossPay)}</td></tr></tfoot>
                                                    </table>
                                                </div>
                                                <div className="grid gap-3 rounded-lg bg-surface-soft/60 p-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
                                                    <div><p className="text-xs text-muted-foreground">Advance before</p><p className="font-bold text-ink">{formatINR(worker.advanceBalanceBefore)}</p></div>
                                                    <div><p className="text-xs text-muted-foreground">Recovered</p><p className="font-bold text-ink">{formatINR(worker.advanceRecovered)}</p></div>
                                                    <div><p className="text-xs text-muted-foreground">Balance carried</p><p className="font-bold text-ink">{formatINR(worker.remainingAdvanceBalance)}</p></div>
                                                    <div><p className="text-xs text-muted-foreground">Payment</p><p className="font-bold text-ink">{paymentModeLabel(worker.paymentMode)}</p></div>
                                                    <div><p className="text-xs text-muted-foreground">Cumulative net pay</p><p className="font-black text-saffron-deep">{formatINR(worker.netPayout)}</p></div>
                                                </div>
                                            </CardContent>
                                        )}
                                    </Card>
                                )
                            })}
                        </div>}

                        {recordsView === 'machines' && <div className="space-y-3">
                            {visibleMachines.map((machine) => {
                                const key = machine.machineId ?? machine.machineLabel
                                const expanded = expandedMachines.has(key)
                                return (
                                    <Card key={key} className="[contain-intrinsic-size:120px] [content-visibility:auto]">
                                        <button type="button" className="w-full text-left" onClick={() => toggleMachine(key)} aria-expanded={expanded}>
                                            <CardHeader className="transition-colors hover:bg-surface-soft/50">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="flex items-start gap-2">{expanded ? <ChevronDown className="mt-0.5 h-4 w-4 text-saffron-deep" /> : <ChevronRight className="mt-0.5 h-4 w-4 text-muted-foreground" />}<div><CardTitle className="text-base">{machine.machineLabel}</CardTitle><CardDescription>{formatCount(machine.workerCount, 'worker')} · {formatCount(machine.costingCount, 'costing')}</CardDescription></div></div>
                                                    <div className="flex gap-6 text-sm"><div><p className="text-xs text-muted-foreground">Period production</p><p className="font-bold text-ink">{formatMeters(machine.meters)}</p></div><div><p className="text-xs text-muted-foreground">Worker cost</p><p className="font-black text-saffron-deep">{formatINR(machine.grossPay)}</p></div></div>
                                                </div>
                                            </CardHeader>
                                        </button>
                                        {expanded && <CardContent className="border-t border-hairline pt-4"><div className="overflow-x-auto rounded-lg border border-hairline"><table className="w-full min-w-[640px] text-sm"><thead className="bg-surface-soft text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2">Worker</th><th className="px-3 py-2">Costing</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2 text-right">Production</th><th className="px-3 py-2 text-right">Worker cost</th></tr></thead><tbody className="divide-y divide-hairline">{machine.workers.map((worker, index) => <tr key={`${worker.workerId}:${worker.costingLabel}:${worker.rate}:${index}`}><td className="px-3 py-3 font-semibold text-ink">{worker.workerName}</td><td className="px-3 py-3 text-body">{worker.costingLabel}</td><td className="px-3 py-3 text-right">{formatINR(worker.rate)}/m</td><td className="px-3 py-3 text-right font-semibold">{formatMeters(worker.meters)}</td><td className="px-3 py-3 text-right font-bold">{formatINR(worker.grossPay)}</td></tr>)}</tbody></table></div></CardContent>}
                                    </Card>
                                )
                            })}
                        </div>}
                    </div>

                    <div className="flex items-start gap-2 rounded-lg border border-hairline bg-surface-soft/45 p-3 text-xs text-body">
                        <Download className="mt-0.5 h-4 w-4 shrink-0 text-saffron-deep" />
                        <p>Exports include the complete period even when the on-screen search is filtered. Settlement totals and earning lines are frozen when payroll is marked paid.</p>
                    </div>
                </>
            ) : null}
        </div>
    )
}
