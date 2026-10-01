'use client'

import Link from 'next/link'
import { AlertTriangle, History, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { BasePayrollReadiness } from '@/lib/base-payroll-readiness'
import { baseDailySheetHref } from '@/lib/base-production-navigation'

function formatDateOnly(value: string) {
    const [year, month, day] = value.split('-').map(Number)
    if (![year, month, day].every(Number.isFinite)) return value
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
    }).format(new Date(Date.UTC(year, month - 1, day)))
}

export default function BasePayrollReadinessPanel({ readiness }: { readiness: BasePayrollReadiness }) {
    const hasProduction = readiness.verifiedLineCount > 0 || readiness.issueCount > 0 || readiness.salaryLineCount > 0 || (readiness.incentiveLineCount ?? 0) > 0
    const hasIssues = readiness.issueCount > 0

    return (
        <Card data-payroll-tour="readiness" className={hasIssues ? 'gap-0 overflow-hidden rounded-2xl border border-warning/30 bg-warning-soft/40 py-0 shadow-[var(--shadow-card)]' : 'gap-0 overflow-hidden rounded-2xl border border-hairline bg-surface py-0 shadow-[var(--shadow-card)]'}>
            <CardHeader className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                        <div className={`rounded-xl p-2 shadow-xs ${hasIssues ? 'border border-warning/30 bg-surface text-warning' : 'border border-success-soft bg-success-soft text-success'}`}>
                            {hasIssues ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                        </div>
                        <div>
                            <CardTitle className="text-sm font-semibold text-ink">Payroll readiness</CardTitle>
                            <CardDescription className="mt-0.5 text-xs leading-relaxed text-body">
                                {hasIssues
                                    ? `${readiness.issueCount} ${readiness.issueCount === 1 ? 'issue needs' : 'issues need'} attention before payment.`
                                    : hasProduction
                                        ? readiness.incentiveLineCount ? 'Approved incentive earnings' : readiness.salaryLineCount > 0 ? 'Dated staff salaries and saved production are included in worker pay.' : 'Every current production line is included in worker pay.'
                                        : 'No production has been recorded since the latest settlement.'}
                            </CardDescription>
                        </div>
                    </div>
                    <Badge variant={hasIssues ? 'warning' : 'success'} className="shrink-0 text-[10px] font-semibold">
                        {hasIssues ? 'Review required' : hasProduction ? 'Reconciled' : 'Up to date'}
                    </Badge>
                </div>
            </CardHeader>

            {hasProduction && (
                <CardContent className="space-y-2.5 border-t border-hairline bg-surface-soft/15 p-3.5 sm:p-4">
                    <div className="grid grid-cols-3 divide-x divide-hairline rounded-xl border border-hairline/80 bg-surface py-2 text-center">
                        <Metric label="Verified earnings" value={readiness.verifiedLineCount + readiness.salaryLineCount + (readiness.incentiveLineCount ?? 0)} />
                        <Metric label="Machine lines" value={readiness.machineLineCount} />
                        <Metric label="Ready workers" value={readiness.readyWorkerCount} />
                    </div>

                    {readiness.salaryLineCount > 0 && <p className="text-xs text-body font-medium">{readiness.salaryLineCount} salary {readiness.salaryLineCount === 1 ? 'segment' : 'segments'} included. Fixed staff do not need production entries.</p>}

                    {readiness.legacyLineCount > 0 && (
                        <div className="flex items-start gap-2 border-l-2 border-saffron/35 pl-2 text-xs leading-relaxed text-body">
                            <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-saffron-deep" />
                            <p><strong className="font-bold text-ink">{readiness.legacyLineCount} legacy worker {readiness.legacyLineCount === 1 ? 'total is' : 'totals are'} included.</strong> Pay uses the saved worker rate; the original machine breakdown was not captured.</p>
                        </div>
                    )}

                    {hasIssues && (
                        <div className="space-y-2">
                            {readiness.workers.flatMap((worker) => worker.issues).map((item) => (
                                <div key={`${item.entryId}:${item.code}`} className="flex items-start justify-between gap-3 rounded-xl border border-warning/30 bg-surface p-3 text-xs shadow-xs">
                                    <div><p className="font-bold text-ink">{item.message}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatDateOnly(item.productionDate)}{item.shift ? ` · ${item.shift} shift` : ''}</p></div>
                                    <Button asChild variant="outline" size="xs" className="shrink-0 h-7 rounded-lg bg-surface text-xs font-bold shadow-xs"><Link href={item.code === 'incentive_review' ? `/owner/payroll?incentive=${encodeURIComponent(item.entryId)}` : baseDailySheetHref({ date: item.productionDate, shift: item.shift === 'day' || item.shift === 'night' ? item.shift : undefined, entry: item.entryId, returnTo: '/owner/payroll' })}>Review</Link></Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    )
}

function Metric({ label, value }: { label: string; value: number }) {
    return <div className="px-2"><p className="text-base font-semibold text-ink">{value}</p><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p></div>
}
