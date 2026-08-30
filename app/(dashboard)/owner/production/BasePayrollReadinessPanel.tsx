'use client'

import Link from 'next/link'
import { AlertTriangle, History, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { BasePayrollReadiness } from '@/lib/base-payroll-readiness'

function formatDateOnly(value: string) {
    const [year, month, day] = value.split('-').map(Number)
    if (![year, month, day].every(Number.isFinite)) return value
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
    }).format(new Date(Date.UTC(year, month - 1, day)))
}

export default function BasePayrollReadinessPanel({ readiness }: { readiness: BasePayrollReadiness }) {
    const hasProduction = readiness.verifiedLineCount > 0 || readiness.issueCount > 0
    const hasIssues = readiness.issueCount > 0

    return (
        <Card className={hasIssues ? 'border-warning/35 bg-warning/5' : 'border-success/25 bg-success/5'}>
            <CardHeader className="pb-3 sm:pb-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                        <div className={`rounded-lg p-2 ${hasIssues ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                            {hasIssues ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                        </div>
                        <div>
                            <CardTitle className="text-base">Payroll readiness</CardTitle>
                            <CardDescription className="mt-1">
                                {hasIssues
                                    ? `${readiness.issueCount} production ${readiness.issueCount === 1 ? 'issue needs' : 'issues need'} attention before payment.`
                                    : hasProduction
                                        ? 'Every current production line is included in worker pay.'
                                        : 'No production has been recorded since the latest settlement.'}
                            </CardDescription>
                        </div>
                    </div>
                    <Badge variant={hasIssues ? 'warning' : 'success'} className="shrink-0">
                        {hasIssues ? 'Review required' : hasProduction ? 'Reconciled' : 'Up to date'}
                    </Badge>
                </div>
            </CardHeader>

            {hasProduction && (
                <CardContent className="space-y-3 border-t border-current/10 pt-4">
                    <div className="grid grid-cols-3 divide-x divide-hairline rounded-lg border border-hairline bg-surface/75 py-2 text-center">
                        <Metric label="Verified" value={readiness.verifiedLineCount} />
                        <Metric label="Machine lines" value={readiness.machineLineCount} />
                        <Metric label="Ready workers" value={readiness.readyWorkerCount} />
                    </div>

                    {readiness.legacyLineCount > 0 && (
                        <div className="flex items-start gap-2 rounded-lg border border-hairline bg-surface/70 px-3 py-2.5 text-xs text-body">
                            <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-saffron-deep" />
                            <p><strong className="text-ink">{readiness.legacyLineCount} legacy worker {readiness.legacyLineCount === 1 ? 'total is' : 'totals are'} included.</strong> Pay uses the saved worker rate; the original machine breakdown was not captured.</p>
                        </div>
                    )}

                    {hasIssues && (
                        <div className="space-y-2">
                            {readiness.workers.flatMap((worker) => worker.issues).map((item) => (
                                <div key={`${item.entryId}:${item.code}`} className="flex items-start justify-between gap-3 rounded-lg border border-warning/25 bg-surface px-3 py-2.5 text-xs">
                                    <div><p className="font-semibold text-ink">{item.message}</p><p className="mt-0.5 text-body">{formatDateOnly(item.productionDate)}{item.shift ? ` · ${item.shift} shift` : ''}</p></div>
                                    <Button asChild variant="outline" size="xs" className="shrink-0"><Link href="/owner/production">Review</Link></Button>
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
    return <div className="px-2"><p className="text-base font-black text-ink">{value}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>
}
