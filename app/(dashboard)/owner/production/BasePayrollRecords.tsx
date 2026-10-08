'use client'

import { useTranslation } from '@/lib/i18n/context'
import { useTourSample } from '@/lib/tours/sample-context'
import { tourSurfaceProps } from '@/lib/tours/sample-surface'

import { useDeferredValue, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    FileSpreadsheet,
    FileText,
    Search,
    WalletCards,
    X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { reverseBasePayrollSettlement } from './actions'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatINR } from '@/lib/finance'
import {
    buildBasePayrollHistory,
    buildBasePayrollHistoryCsv,
    type BasePayrollHistoryMachine,
    type BasePayrollHistoryPeriod,
    type BasePayrollHistoryWorker,
} from '@/lib/base-payroll-history'
import type { BasePayrollPaymentMode, BasePayrollSettlement } from '@/lib/base-production-core'
import { DEFAULT_MONTHLY_CYCLE_RULE, formatDateLabel, formatPayrollPeriodLabel, isValidDateString } from '@/lib/payroll-cycle-engine'
import { cn } from '@/lib/utils'

import type { BaseProductionInitialData } from './loaders'

// Same "19 Sep 2026" style as the period labels.
function formatDateOnly(value: string | null | undefined) {
    if (!value) return '—'
    const date = value.slice(0, 10)
    return isValidDateString(date) ? formatDateLabel(date) : value
}

function formatMeters(value: number) {
    return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)} m`
}

const paymentModeKeys: Record<BasePayrollPaymentMode, string> = {
    cash: 'payroll.payment.cash',
    bank_transfer: 'payroll.payment.bankTransfer',
    upi: 'payroll.payment.upi',
    cheque: 'payroll.payment.cheque',
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

function workerMatches(worker: BasePayrollHistoryWorker, query: string) {
    return !query
        || worker.workerName.toLowerCase().includes(query)
        || worker.earnings.some(earning => earning.machineLabel.toLowerCase().includes(query) || earning.costingLabel.toLowerCase().includes(query))
}

function machineMatches(machine: BasePayrollHistoryMachine, query: string) {
    return !query
        || machine.machineLabel.toLowerCase().includes(query)
        || machine.workers.some(worker => worker.workerName.toLowerCase().includes(query) || worker.costingLabel.toLowerCase().includes(query))
}

const periodLabel = (period: Pick<BasePayrollHistoryPeriod, 'start' | 'end'>) => formatPayrollPeriodLabel(period.start, period.end)

// Narrow surfaces stack each payment; wide ones line its amounts up under one header.
const paymentColumns = '@3xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_8.5rem]'

type PayrollDetailRow = {
    key: string
    values: [string, string, string, string, string]
}

function PayrollRecordDetails({ columns, rows, total }: {
    columns: PayrollDetailRow['values']
    rows: PayrollDetailRow[]
    total?: { label: string; production: string; earnings: string }
}) {
    return <>
        <div className="mobile-record-details min-w-0 divide-y divide-hairline">
            {rows.map(row => <dl key={row.key} className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 py-3 first:pt-0">
                {columns.map((label, index) => <div key={index} className={index < 2 || index === 4 ? 'col-span-2 min-w-0' : 'min-w-0'}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className={`min-w-0 break-words [overflow-wrap:anywhere] text-sm ${index === 0 || index === 4 ? 'font-semibold text-ink' : 'text-body'}`}>{row.values[index]}</dd>
                </div>)}
            </dl>)}
            {total && <div className="space-y-2 py-3">
                <p className="text-sm font-semibold text-ink">{total.label}</p>
                <dl className="grid min-w-0 grid-cols-2 gap-3">
                    <div className="min-w-0"><dt className="text-xs text-muted-foreground">{columns[3]}</dt><dd className="break-words [overflow-wrap:anywhere] text-sm font-bold text-ink">{total.production}</dd></div>
                    <div className="min-w-0"><dt className="text-xs text-muted-foreground">{columns[4]}</dt><dd className="break-words [overflow-wrap:anywhere] text-sm font-bold text-ink">{total.earnings}</dd></div>
                </dl>
            </div>}
        </div>
        <div className="desktop-record-details min-w-0 overflow-x-auto rounded-lg border border-hairline">
            <table className={`w-full text-sm ${total ? 'min-w-[560px]' : 'min-w-[520px]'}`}>
                <thead className="bg-surface-soft text-left text-xs text-muted-foreground"><tr>{columns.map((label, index) => <th key={index} scope="col" className={`px-3 py-2 ${index > 1 ? 'text-right' : ''}`}>{label}</th>)}</tr></thead>
                <tbody className="divide-y divide-hairline">{rows.map(row => <tr key={row.key}>{row.values.map((value, index) => <td key={index} className={`px-3 py-3 ${index > 1 ? 'text-right' : ''} ${index === 0 || index === 3 ? 'font-semibold text-ink' : index === 4 ? 'font-bold text-ink' : 'text-body'}`}>{value}</td>)}</tr>)}</tbody>
                {total && <tfoot className="border-t border-hairline bg-surface-soft/70 font-bold text-ink"><tr><td className="px-3 py-3" colSpan={3}>{total.label}</td><td className="px-3 py-3 text-right">{total.production}</td><td className="px-3 py-3 text-right">{total.earnings}</td></tr></tfoot>}
            </table>
        </div>
    </>
}

export function PayrollWorkerEarnings({ worker }: { worker: BasePayrollHistoryWorker }) {
    const { t } = useTranslation()
    const isSalary = worker.earnings.some(earning => earning.payType === 'fixed_monthly')
    const rows: PayrollDetailRow[] = worker.earnings.map((earning, index) => ({
        key: `${earning.machineId ?? earning.machineLabel}:${earning.costingLabel}:${earning.rate}:${index}`,
        values: [
            earning.machineLabel,
            earning.costingLabel,
            earning.kind === 'manual_incentive' ? '—' : `${formatINR(earning.rate)}/${earning.payType === 'fixed_monthly' ? t('payroll.recordDetails.month') : 'm'}`,
            earning.payType === 'fixed_monthly' || earning.kind === 'manual_incentive' ? '—' : formatMeters(earning.meters),
            formatINR(earning.grossPay),
        ],
    }))
    return <PayrollRecordDetails
        columns={[
            t(isSalary ? 'payroll.recordDetails.payBasis' : 'payroll.recordDetails.machine'),
            t(isSalary ? 'payroll.recordDetails.salaryPeriod' : 'payroll.recordDetails.costing'),
            t('payroll.recordDetails.rate'), t('payroll.recordDetails.production'), t('payroll.recordDetails.earnings'),
        ]}
        rows={rows}
        total={{ label: t('payroll.recordDetails.cumulativeWorkerTotal'), production: formatMeters(worker.meters), earnings: formatINR(worker.grossPay) }}
    />
}

export function PayrollMachineWorkers({ machine }: { machine: BasePayrollHistoryMachine }) {
    const { t } = useTranslation()
    const rows: PayrollDetailRow[] = machine.workers.map((worker, index) => ({
        key: `${worker.workerId}:${worker.costingLabel}:${worker.rate}:${index}`,
        values: [worker.workerName, worker.costingLabel, `${formatINR(worker.rate)}/m`, formatMeters(worker.meters), formatINR(worker.grossPay)],
    }))
    return <PayrollRecordDetails columns={[
        t('payroll.recordDetails.worker'), t('payroll.recordDetails.costing'), t('payroll.recordDetails.rate'),
        t('payroll.recordDetails.production'), t('payroll.recordDetails.workerCost'),
    ]} rows={rows} />
}

export function PayrollWorkerReceipt({ worker }: { worker: BasePayrollHistoryWorker }) {
    const { t } = useTranslation()
    const fields = [
        [t('payroll.recordDetails.advanceBefore'), formatINR(worker.advanceBalanceBefore)],
        [t('payroll.recordDetails.recovered'), formatINR(worker.advanceRecovered)],
        [t('payroll.recordDetails.balanceCarried'), formatINR(worker.remainingAdvanceBalance)],
        [t('payroll.recordDetails.payment'), t(paymentModeKeys[worker.paymentMode])],
        [t('payroll.recordDetails.cumulativeNetPay'), formatINR(worker.netPayout)],
    ]
    return <dl className="grid min-w-0 gap-3 rounded-lg bg-surface-soft/60 p-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
        {fields.map(([label, value], index) => <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className={`break-words [overflow-wrap:anywhere] ${index === 4 ? 'font-black text-saffron-deep' : 'font-bold text-ink'}`}>{value}</dd>
        </div>)}
    </dl>
}


function PaymentRow({ worker, period, settlements, expanded, onToggle, onReverse }: {
    worker: BasePayrollHistoryWorker
    period: BasePayrollHistoryPeriod
    settlements: BasePayrollSettlement[]
    expanded: boolean
    onToggle: () => void
    onReverse: () => void
}) {
    const { t } = useTranslation()
    const original = settlements.find(settlement => settlement.id === worker.settlementId)
    const hasLaterPayment = settlements.some(settlement => settlement.worker_id === worker.workerId && settlement.status !== 'reversed' && settlement.period_end > (original?.period_end ?? ''))
    const canReverse = original && worker.status !== 'reversed' && !hasLaterPayment && (original.advance_deducted === 0 || original.recovery_receipt_complete)
    const reversed = worker.status === 'reversed'
    const isSalary = worker.earnings.some(earning => earning.payType === 'fixed_monthly')
    const machineCount = new Set(worker.earnings.filter(earning => earning.payType !== 'fixed_monthly' && earning.kind !== 'manual_incentive').map(earning => earning.machineId ?? earning.machineLabel)).size
    const coversOtherDates = worker.coverStart && worker.coverEnd && (worker.coverStart !== period.start || worker.coverEnd !== period.end)
    const basis = isSalary
        ? t('payroll.records.monthlySalary')
        : machineCount > 0 ? `${machineCount === 1 ? t('payroll.records.machinesOne') : t('payroll.records.machinesMany', { count: machineCount })} · ${formatMeters(worker.meters)}` : null
    const detailsId = `payroll-record-${worker.settlementId}`
    const amount = cn('tabular-nums', reversed ? 'text-muted-foreground line-through' : 'text-ink')

    return (
        <li className="min-w-0 [contain-intrinsic-size:auto_88px] [content-visibility:auto]">
            <div className={cn('grid grid-cols-3 items-start gap-x-4 gap-y-3 px-4 py-3 sm:px-5 @3xl:items-center', paymentColumns)}>
                <div className="col-span-2 min-w-0 @3xl:col-span-1">
                    <p className="break-words font-semibold text-ink [overflow-wrap:anywhere]">{worker.workerName}</p>
                    {basis && <p className="mt-0.5 text-xs text-body">{basis}</p>}
                    {coversOtherDates && <p className="mt-0.5 text-xs text-body">{t('payroll.records.covers', { range: formatPayrollPeriodLabel(worker.coverStart!, worker.coverEnd!) })}</p>}
                    {reversed && <p className="mt-0.5 text-xs font-semibold text-risk">{t('payroll.records.reversed')}</p>}
                </div>
                <dl className="contents text-sm">
                    <div className="min-w-0 @3xl:col-start-2 @3xl:row-start-1">
                        <dt className="text-xs text-muted-foreground @3xl:sr-only">{t('payroll.records.paidOn')}</dt>
                        <dd className="text-body">{formatDateOnly(worker.paidAt)}</dd>
                    </div>
                    <div className="min-w-0 @3xl:col-start-3 @3xl:row-start-1 @3xl:text-right">
                        <dt className="text-xs text-muted-foreground @3xl:sr-only">{t('payroll.records.gross')}</dt>
                        <dd className={amount}>{formatINR(worker.grossPay)}</dd>
                    </div>
                    <div className="min-w-0 @3xl:col-start-4 @3xl:row-start-1 @3xl:text-right">
                        <dt className="text-xs text-muted-foreground @3xl:sr-only">{t('payroll.recordDetails.recovered')}</dt>
                        <dd className={amount}>{formatINR(worker.advanceRecovered)}</dd>
                    </div>
                    <div className="col-start-3 row-start-1 min-w-0 text-right @3xl:col-start-5">
                        <dt className="text-xs text-muted-foreground @3xl:sr-only">{t('payroll.records.netPaid')}</dt>
                        <dd className={cn(amount, 'font-bold')}>{formatINR(worker.netPayout)}</dd>
                    </div>
                </dl>
                <Button variant="outline" aria-expanded={expanded} aria-controls={detailsId} onClick={onToggle} className="col-span-3 h-11 w-full rounded-lg border-hairline bg-surface text-ink shadow-xs hover:border-hairline-strong hover:bg-surface-soft sm:h-10 @3xl:col-span-1 @3xl:col-start-6 @3xl:row-start-1">
                    <span data-i18n-skip="true">{expanded ? t('payroll.records.hideDetails') : t('payroll.records.details')}</span>
                    <ChevronDown className={cn('size-4 transition-transform duration-150', expanded && 'rotate-180')} aria-hidden="true" />
                </Button>
            </div>
            {expanded && (
                <div id={detailsId} className="ui-disclosure-content min-w-0 space-y-4 border-t border-hairline px-4 py-4 sm:px-5">
                    {reversed && <p className="rounded-lg border border-warning/30 bg-warning-soft/50 p-3 text-sm text-body">{t('payroll.records.reversedOn', { date: formatDateOnly(original?.reversed_at), reason: worker.reversalReason ?? '—' })}</p>}
                    <PayrollWorkerEarnings worker={worker} />
                    <PayrollWorkerReceipt worker={worker} />
                    {!reversed && <div className="space-y-1.5">
                        <Button variant="outline" className="h-10 rounded-lg border-hairline bg-surface text-ink hover:bg-surface-soft" disabled={!canReverse} onClick={onReverse}><span data-i18n-skip="true">{t('payroll.resolveMistaken')}</span></Button>
                        {!canReverse && <p className="text-xs text-body">{t(hasLaterPayment ? 'payroll.records.laterPaymentBlocks' : 'payroll.records.legacyReceipt')}</p>}
                    </div>}
                </div>
            )}
        </li>
    )
}

export default function BasePayrollRecords({
    initialData,
    onBack,
    initialPeriodStart,
}: {
    initialData: BaseProductionInitialData
    onBack: () => void
    /** Opens on the pay period containing this date, e.g. the one just settled. */
    initialPeriodStart?: string
}) {
    const { t } = useTranslation()
    const router = useRouter()
    const payrollTourStep = useTourSample('payroll')?.step
    const surface = tourSurfaceProps(Boolean(payrollTourStep))
    const [reversingSettlementId, setReversingId] = useState<string | null>(null)
    // The Payroll tour shows the real reversal dialog for the first recorded payment.
    const tourReversingId = payrollTourStep === 'pra-correct' ? initialData.settlements.find(settlement => settlement.status !== 'reversed')?.id ?? null : null
    const reversingId = tourReversingId ?? reversingSettlementId
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
    const cycleRule = initialData.payrollCycleConfig?.rule ?? DEFAULT_MONTHLY_CYCLE_RULE
    const periods = useMemo(
        () => buildBasePayrollHistory(initialData.settlements, initialData.settlementLines, initialData.payrollPeriods, cycleRule),
        [initialData.settlementLines, initialData.settlements, initialData.payrollPeriods, cycleRule],
    )
    // Owners come here for a period that has ended, so a running period waits one step forward.
    const [selectedKey, setSelectedKey] = useState(() => (
        periods.find(period => initialPeriodStart && period.start <= initialPeriodStart && initialPeriodStart <= period.end)?.key
        ?? periods.find(period => period.end < initialData.today)?.key
        ?? periods[0]?.key
        ?? ''
    ))
    // The search stays put while stepping between periods, so one worker can be followed month by month.
    const [search, setSearch] = useState('')
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [machinesOpen, setMachinesOpen] = useState(false)
    const [exportingPdf, setExportingPdf] = useState(false)
    const deferredSearch = useDeferredValue(search)

    const selectedIndex = Math.max(0, periods.findIndex(period => period.key === selectedKey))
    const selectedPeriod = periods[selectedIndex]
    const olderPeriod = periods[selectedIndex + 1]
    const newerPeriod = periods[selectedIndex - 1]
    const query = deferredSearch.trim().toLowerCase()
    const visibleWorkers = selectedPeriod?.workers.filter(worker => workerMatches(worker, query)) ?? []
    const visibleMachines = selectedPeriod?.machines.filter(machine => machineMatches(machine, query)) ?? []
    // When a search finds nothing here, offer the nearest period where it does, older first.
    const nearestMatch = query && visibleWorkers.length === 0
        ? [...periods.slice(selectedIndex + 1), ...periods.slice(0, selectedIndex).reverse()].find(period => period.workers.some(worker => workerMatches(worker, query)))
        : undefined

    function toggle(id: string) {
        setExpanded((current) => {
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

    const activeWorkers = selectedPeriod?.workers.filter(worker => worker.status !== 'reversed') ?? []
    const workersPaid = new Set(activeWorkers.map(worker => worker.workerId)).size
    const selectedLabel = selectedPeriod ? periodLabel(selectedPeriod) : ''
    const periodStatus = !selectedPeriod ? null
        : selectedPeriod.isSettled
            ? { text: selectedPeriod.settledAt ? t('payroll.records.completedOn', { date: formatDateOnly(selectedPeriod.settledAt) }) : t('payroll.records.completed'), className: 'text-success' }
            : selectedPeriod.start <= initialData.today && initialData.today <= selectedPeriod.end
                ? { text: t('payroll.records.inProgress'), className: 'text-body' }
                : { text: t('payroll.records.notCompleted'), className: 'text-body' }

    return (
        <div className="space-y-6">
            <Dialog open={Boolean(reversingId)} onOpenChange={open => { if (!open && !reversing) setReversingId(null) }} {...surface.root}>
                <DialogContent data-payroll-tour="correction" {...surface.content}><DialogHeader><DialogTitle>Reverse a mistaken payment record?</DialogTitle><DialogDescription>This preserves the original receipt, restores its recorded advance recovery, and makes the earnings outstanding again. It does not reverse cash or a bank transfer. Use this only when payment was not actually made.</DialogDescription></DialogHeader>
                    <p className="rounded-lg border border-hairline bg-surface-soft p-3 text-sm"><strong>{reversalTarget?.worker_name_snapshot}</strong> · {formatINR(reversalTarget?.net_payout ?? 0)}<br />{formatDateOnly(reversalTarget?.period_start)} – {formatDateOnly(reversalTarget?.period_end)}</p>
                    <Label htmlFor="base-reversal-reason">Reason for reversal</Label><Textarea id="base-reversal-reason" value={reversalReason} onChange={event => setReversalReason(event.target.value)} maxLength={240} disabled={reversing} />
                    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={paymentNotMade} disabled={reversing} onChange={event => setPaymentNotMade(event.target.checked)} />I confirm this payment was not actually made.</label>
                    <DialogFooter><Button variant="outline" disabled={reversing} onClick={() => setReversingId(null)}>Keep record</Button><Button disabled={reversing || !paymentNotMade || reversalReason.trim().length < 3} onClick={() => void confirmReversal()}>{reversing ? 'Recording reversal…' : 'Record reversal'}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <div>
                <h2 className="text-xl font-bold leading-tight text-ink" data-i18n-skip="true">{t('payroll.payrollRecords')}</h2>
                <p className="mt-1 text-sm text-body" data-i18n-skip="true">{t('payroll.records.subtitle')}</p>
            </div>

            {!selectedPeriod ? (
                <section className="flex flex-col items-center rounded-2xl border border-dashed border-hairline-strong bg-surface px-6 py-12 text-center" data-i18n-skip="true">
                    <WalletCards className="size-8 text-muted-foreground" aria-hidden="true" />
                    <h3 className="mt-3 text-base font-semibold text-ink">{t('payroll.records.emptyTitle')}</h3>
                    <p className="mt-1 max-w-md text-sm text-body">{t('payroll.records.emptyBody')}</p>
                    <Button className="mt-4 h-10 rounded-lg border-hairline bg-surface" variant="outline" onClick={onBack}>{t('payroll.records.openCurrentPayroll')}</Button>
                </section>
            ) : (
                <section aria-label={selectedLabel} className="@container min-w-0 overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs" data-i18n-skip="true">
                    <div className="flex flex-col gap-3 p-4 sm:p-5 @3xl:flex-row @3xl:items-start @3xl:justify-between">
                        <div className="min-w-0 space-y-2">
                            <div role="group" aria-label={t('payroll.records.payPeriod')} className="flex h-11 w-full items-center gap-0.5 rounded-lg border border-hairline bg-surface p-0.5 shadow-2xs @xl:w-auto">
                                <Button variant="ghost" size="icon" aria-label={t('payroll.records.previousPeriod')} disabled={!olderPeriod} onClick={() => olderPeriod && setSelectedKey(olderPeriod.key)} className="shrink-0 rounded-md text-subtle hover:text-ink">
                                    <ChevronLeft className="size-[1.125rem]" aria-hidden="true" />
                                </Button>
                                <Select value={selectedPeriod.key} onValueChange={setSelectedKey}>
                                    <SelectTrigger aria-label={t('payroll.records.payPeriod')} className="h-10 min-w-0 flex-1 justify-center gap-1.5 border-0 bg-transparent px-3 font-semibold text-ink shadow-none hover:bg-surface-soft focus-visible:ring-saffron/30 @xl:min-w-48">
                                        <SelectValue>{selectedLabel}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-hairline bg-surface">
                                        {periods.map(period => (
                                            <SelectItem key={period.key} value={period.key}>
                                                {periodLabel(period)}<span className="text-muted-foreground">· {formatINR(period.totalNetPayout)}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button variant="ghost" size="icon" aria-label={t('payroll.records.nextPeriod')} disabled={!newerPeriod} onClick={() => newerPeriod && setSelectedKey(newerPeriod.key)} className="shrink-0 rounded-md text-subtle hover:text-ink">
                                    <ChevronRight className="size-[1.125rem]" aria-hidden="true" />
                                </Button>
                            </div>
                            <p className="text-sm text-body">
                                {/* A month name hides its dates; a range label already shows them. */}
                                {selectedLabel.includes('–') ? null : <>{formatDateOnly(selectedPeriod.start)} – {formatDateOnly(selectedPeriod.end)} · </>}
                                <span className={periodStatus?.className}>{periodStatus?.text}</span>
                            </p>
                        </div>
                        <div data-payroll-tour="export" className="flex flex-wrap gap-2">
                            <Button variant="outline" className="h-10 rounded-lg border-hairline bg-surface text-ink shadow-xs hover:border-hairline-strong hover:bg-surface-soft" onClick={exportCsv}><FileSpreadsheet className="size-4" aria-hidden="true" /> <span data-i18n-skip="true">{t('payroll.exportCsv')}</span></Button>
                            <Button className="h-10 rounded-lg" onClick={() => void exportPdf()} disabled={exportingPdf || activeWorkers.length === 0}><FileText className="size-4" aria-hidden="true" /> <span data-i18n-skip="true">{exportingPdf ? t('payroll.preparingPdf') : t('payroll.exportPdf')}</span></Button>
                        </div>
                    </div>

                    <dl className="grid grid-cols-2 border-t border-hairline @xl:grid-cols-3 @xl:divide-x @xl:divide-hairline">
                        <div className="col-span-2 border-b border-hairline px-4 py-3 sm:px-5 @xl:col-span-1 @xl:border-b-0">
                            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('payroll.records.netPaid')}</dt>
                            <dd className="mt-1 text-2xl font-bold tabular-nums text-ink">{formatINR(selectedPeriod.totalNetPayout)}</dd>
                            <dd className="mt-0.5 text-xs text-body">{workersPaid === 1 ? t('payroll.records.workersPaidOne') : t('payroll.records.workersPaidMany', { count: workersPaid })}{selectedPeriod.paymentModes.length > 0 ? ` · ${selectedPeriod.paymentModes.map(mode => t(paymentModeKeys[mode])).join(', ')}` : ''}</dd>
                        </div>
                        <div className="min-w-0 px-4 py-3 sm:px-5">
                            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('payroll.records.grossEarnings')}</dt>
                            <dd className="mt-1 text-lg font-bold tabular-nums text-ink @xl:text-2xl">{formatINR(selectedPeriod.totalGrossPay)}</dd>
                        </div>
                        <div className="min-w-0 border-l border-hairline px-4 py-3 sm:px-5 @xl:border-l-0">
                            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('payroll.records.advancesRecovered')}</dt>
                            <dd className="mt-1 text-lg font-bold tabular-nums text-ink @xl:text-2xl">{formatINR(selectedPeriod.totalAdvanceRecovered)}</dd>
                        </div>
                    </dl>
                    {selectedPeriod.workers.some(worker => worker.status === 'reversed') && <p className="border-t border-hairline bg-warning-soft/40 px-4 py-2.5 text-sm text-body sm:px-5">{t('payroll.records.reversedNote')}</p>}

                    <div className="border-t border-hairline px-4 py-3 sm:px-5">
                        <label htmlFor="payroll-history-search" className="text-xs font-semibold text-body">{t('payroll.records.findWorker')}</label>
                        <div className="relative mt-1.5 @xl:max-w-sm">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle/60" aria-hidden="true" />
                            <Input id="payroll-history-search" type="text" enterKeyHint="search" autoComplete="off" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('payroll.records.searchPlaceholder')} className="h-10 rounded-lg border-hairline bg-surface pl-10 pr-9 text-sm text-ink shadow-2xs focus-visible:border-saffron focus-visible:ring-saffron" />
                            {search && <button type="button" onClick={() => setSearch('')} aria-label={t('payroll.records.clearSearch')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-subtle/60 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"><X className="size-4" aria-hidden="true" /></button>}
                        </div>
                        {query && <p className="mt-2 text-xs text-body">{t('payroll.records.exportHint', { period: selectedLabel })}</p>}
                    </div>

                    <div data-payroll-tour="records" className="border-t border-hairline">
                        {selectedPeriod.workers.length === 0 ? (
                            <p className="px-4 py-10 text-center text-sm text-body sm:px-5">{t('payroll.records.periodEmpty')}</p>
                        ) : visibleWorkers.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center sm:px-5">
                                <p className="text-sm text-body">{t('payroll.records.noMatch', { query: deferredSearch.trim(), period: selectedLabel })}</p>
                                <div className="flex flex-wrap justify-center gap-2">
                                    {nearestMatch && <Button className="h-10 rounded-lg" onClick={() => setSelectedKey(nearestMatch.key)}>{t('payroll.records.goTo', { period: periodLabel(nearestMatch) })}</Button>}
                                    <Button variant="outline" className="h-10 rounded-lg border-hairline bg-surface" onClick={() => setSearch('')}>{t('payroll.records.clearSearch')}</Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div aria-hidden="true" className={cn('hidden gap-x-4 bg-surface-soft/60 px-5 py-2 text-xs font-semibold text-muted-foreground @3xl:grid', paymentColumns)}>
                                    <span>{t('payroll.recordDetails.worker')}</span>
                                    <span>{t('payroll.records.paidOn')}</span>
                                    <span className="text-right">{t('payroll.records.gross')}</span>
                                    <span className="text-right">{t('payroll.recordDetails.recovered')}</span>
                                    <span className="text-right">{t('payroll.records.netPaid')}</span>
                                    <span />
                                </div>
                                <ul key={selectedPeriod.key} className="ui-content-swap divide-y divide-hairline border-t border-hairline @3xl:border-t-0">
                                    {visibleWorkers.map(worker => (
                                        <PaymentRow
                                            key={worker.settlementId}
                                            worker={worker}
                                            period={selectedPeriod}
                                            settlements={initialData.settlements}
                                            expanded={expanded.has(worker.settlementId)}
                                            onToggle={() => toggle(worker.settlementId)}
                                            onReverse={() => { setReversingId(worker.settlementId); setReversalReason(''); setPaymentNotMade(false) }}
                                        />
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>

                    {visibleMachines.length > 0 && (
                        <div className="border-t border-hairline">
                            <button type="button" aria-expanded={machinesOpen} aria-controls="payroll-machine-breakdown" onClick={() => setMachinesOpen(open => !open)} className="flex min-h-12 w-full items-center gap-3 px-4 text-left transition-colors hover:bg-surface-soft/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-saffron sm:px-5">
                                <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-150', machinesOpen && 'rotate-90')} aria-hidden="true" />
                                <span className="font-semibold text-ink">{t('payroll.records.machineBreakdown')}</span>
                                <span className="text-sm text-body">{selectedPeriod.machines.length === 1 ? t('payroll.records.machinesOne') : t('payroll.records.machinesMany', { count: selectedPeriod.machines.length })} · {formatMeters(selectedPeriod.totalMeters)}</span>
                            </button>
                            {machinesOpen && <ul id="payroll-machine-breakdown" className="ui-disclosure-content divide-y divide-hairline border-t border-hairline">
                                {visibleMachines.map(machine => (
                                    <li key={machine.machineId ?? machine.machineLabel} className="min-w-0 space-y-3 px-4 py-4 sm:px-5">
                                        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                                            <div className="min-w-0">
                                                <p className="break-words font-semibold text-ink [overflow-wrap:anywhere]">{machine.machineLabel}</p>
                                                <p className="text-xs text-body">{machine.workerCount === 1 ? t('payroll.records.workersOne') : t('payroll.records.workersMany', { count: machine.workerCount })} · {machine.costingCount === 1 ? t('payroll.records.costingsOne') : t('payroll.records.costingsMany', { count: machine.costingCount })}</p>
                                            </div>
                                            <dl className="flex gap-6 text-sm">
                                                <div><dt className="text-xs text-muted-foreground">{t('payroll.recordDetails.production')}</dt><dd className="font-semibold tabular-nums text-ink">{formatMeters(machine.meters)}</dd></div>
                                                <div><dt className="text-xs text-muted-foreground">{t('payroll.recordDetails.workerCost')}</dt><dd className="font-semibold tabular-nums text-ink">{formatINR(machine.grossPay)}</dd></div>
                                            </dl>
                                        </div>
                                        <PayrollMachineWorkers machine={machine} />
                                    </li>
                                ))}
                            </ul>}
                        </div>
                    )}
                </section>
            )}
        </div>
    )
}
