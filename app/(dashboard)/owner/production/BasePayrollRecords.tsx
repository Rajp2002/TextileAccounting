'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import {
    ChevronDown,
    ChevronRight,
    Download,
    FileSpreadsheet,
    FileText,
    History,
    Search,
    WalletCards,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatINR } from '@/lib/finance'
import {
    buildBasePayrollHistory,
    buildBasePayrollHistoryCsv,
    type BasePayrollHistoryPeriod,
} from '@/lib/base-payroll-history'
import { generateBasePayrollPdf } from '@/lib/generate-base-payroll-pdf'
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
    const periods = useMemo(
        () => buildBasePayrollHistory(initialData.settlements, initialData.settlementLines),
        [initialData.settlementLines, initialData.settlements],
    )
    const [selectedKey, setSelectedKey] = useState(periods[0]?.key ?? '')
    const [search, setSearch] = useState('')
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
            await generateBasePayrollPdf(selectedPeriod, {
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
                    <Card>
                        <CardContent className="flex flex-col gap-3 py-4 lg:flex-row lg:items-end lg:justify-between">
                            <div className="grid flex-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-body" htmlFor="payroll-history-period">Pay period</label>
                                    <Select value={selectedPeriod.key} onValueChange={(value) => { setSelectedKey(value); setSearch('') }}>
                                        <SelectTrigger id="payroll-history-period" className="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {periods.map((period) => (
                                                <SelectItem key={period.key} value={period.key}>
                                                    {formatDateOnly(period.start)} – {formatDateOnly(period.end)} · {formatCount(period.workers.length, 'worker')}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-body" htmlFor="payroll-history-search">Find worker, machine, or costing</label>
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input id="payroll-history-search" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search records" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" onClick={exportCsv}><FileSpreadsheet className="h-4 w-4" /> Export CSV</Button>
                                <Button onClick={() => void exportPdf()} disabled={exportingPdf}><FileText className="h-4 w-4" /> {exportingPdf ? 'Preparing PDF…' : 'Export PDF'}</Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <SummaryMetric label="Total production" value={formatMeters(selectedPeriod.totalMeters)} detail={formatCount(selectedPeriod.machines.length, 'machine')} />
                        <SummaryMetric label="Gross earnings" value={formatINR(selectedPeriod.totalGrossPay)} detail={`${formatCount(selectedPeriod.workers.length, 'worker')} settled`} />
                        <SummaryMetric label="Advances recovered" value={formatINR(selectedPeriod.totalAdvanceRecovered)} detail="Deducted in this period" />
                        <SummaryMetric label="Net payroll" value={formatINR(selectedPeriod.totalNetPayout)} detail={`Paid by ${selectedPeriod.paymentModes.map(mode => mode === 'upi' ? 'UPI' : paymentModeLabel(mode).toLocaleLowerCase('en-IN')).join(', ')}`} />
                    </div>

                    <Tabs defaultValue="workers" className="space-y-4">
                        <TabsList className="grid h-auto w-full grid-cols-2 sm:w-[360px]">
                            <TabsTrigger value="workers">Workers ({visibleWorkers.length})</TabsTrigger>
                            <TabsTrigger value="machines">Machines ({visibleMachines.length})</TabsTrigger>
                        </TabsList>

                        <TabsContent value="workers" className="space-y-3">
                            {visibleWorkers.map((worker) => {
                                const expanded = expandedWorkers.has(worker.settlementId)
                                const machineCount = new Set(worker.earnings.map((earning) => earning.machineId ?? earning.machineLabel)).size
                                return (
                                    <Card key={worker.settlementId} className="[contain-intrinsic-size:140px] [content-visibility:auto]">
                                        <button type="button" className="w-full text-left" onClick={() => toggleWorker(worker.settlementId)} aria-expanded={expanded}>
                                            <CardHeader className="transition-colors hover:bg-surface-soft/50">
                                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                                    <div className="flex min-w-0 items-start gap-2">
                                                        {expanded ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-saffron-deep" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                                                        <div><CardTitle className="text-base">{worker.workerName}</CardTitle><CardDescription>{formatCount(machineCount, 'machine')} · paid {formatDateOnly(worker.paidAt)}</CardDescription></div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                                                        <div><p className="text-xs text-muted-foreground">Production</p><p className="font-bold text-ink">{formatMeters(worker.meters)}</p></div>
                                                        <div><p className="text-xs text-muted-foreground">Gross</p><p className="font-bold text-ink">{formatINR(worker.grossPay)}</p></div>
                                                        <div><p className="text-xs text-muted-foreground">Recovered</p><p className="font-bold text-ink">{formatINR(worker.advanceRecovered)}</p></div>
                                                        <div><p className="text-xs text-muted-foreground">Net paid</p><p className="font-black text-saffron-deep">{formatINR(worker.netPayout)}</p></div>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                        </button>
                                        {expanded && (
                                            <CardContent className="space-y-4 border-t border-hairline pt-4">
                                                <div className="overflow-x-auto rounded-lg border border-hairline">
                                                    <table className="w-full min-w-[720px] text-sm">
                                                        <thead className="bg-surface-soft text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2">Machine</th><th className="px-3 py-2">Costing</th><th className="px-3 py-2 text-right">Weaver rate</th><th className="px-3 py-2 text-right">Production</th><th className="px-3 py-2 text-right">Earnings</th></tr></thead>
                                                        <tbody className="divide-y divide-hairline">
                                                            {worker.earnings.map((earning) => (
                                                                <tr key={`${earning.machineId ?? earning.machineLabel}:${earning.costingLabel}:${earning.rate}`}>
                                                                    <td className="px-3 py-3 font-semibold text-ink">{earning.machineLabel}</td>
                                                                    <td className="px-3 py-3 text-body">{earning.costingLabel}</td>
                                                                    <td className="px-3 py-3 text-right text-body">{formatINR(earning.rate)}/m</td>
                                                                    <td className="px-3 py-3 text-right font-semibold text-ink">{formatMeters(earning.meters)}</td>
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
                        </TabsContent>

                        <TabsContent value="machines" className="space-y-3">
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
                        </TabsContent>
                    </Tabs>

                    <div className="flex items-start gap-2 rounded-lg border border-hairline bg-surface-soft/45 p-3 text-xs text-body">
                        <Download className="mt-0.5 h-4 w-4 shrink-0 text-saffron-deep" />
                        <p>Exports include the complete period even when the on-screen search is filtered. Settlement totals and earning lines are frozen when payroll is marked paid.</p>
                    </div>
                </>
            ) : null}
        </div>
    )
}
