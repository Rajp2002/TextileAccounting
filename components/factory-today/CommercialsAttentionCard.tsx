'use client'

import Link from 'next/link'
import type { FactoryTodayData } from '@/app/(dashboard)/owner/today/actions'
import { AlertTriangle, ArrowRight, CheckCircle2, ReceiptText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CommercialsAttentionCardProps {
    commercial: FactoryTodayData['commercial']
}

function formatDateOnly(value: string | null): string {
    if (!value) return 'No due date'

    const [year, month, day] = value.split('-').map(Number)
    if ([year, month, day].every(Number.isFinite)) {
        return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
        })
    }

    return value
}

export function CommercialsAttentionCard({ commercial }: CommercialsAttentionCardProps) {
    const hasIssues = commercial.blockingIssues.length > 0
    const tone = hasIssues
        ? 'border-risk/20 bg-risk-soft text-risk'
        : 'border-success/20 bg-success-soft text-success'

    return (
        <div className="min-w-0 overflow-hidden rounded-2xl border border-hairline bg-surface">
            <div className={cn('flex items-center gap-3 border-b px-4 py-3', tone)}>
                <ReceiptText className="h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink">Party Ledger</p>
                        {hasIssues && (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#FF3B30] text-[10px] font-bold text-white">
                                {commercial.blockingIssues.length}
                            </span>
                        )}
                    </div>
                    <p className={cn('text-sm font-bold', hasIssues ? 'text-risk' : 'text-success')}>
                        {hasIssues ? 'Receivables need review' : 'Receivables are current'}
                    </p>
                </div>
                {commercial.totalDueOrOverdue > 0 && (
                    <div className="shrink-0 text-right">
                        <p className="text-[11px] font-bold text-risk">
                            Rs. {(commercial.totalDueOrOverdue / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}k
                        </p>
                        <p className="text-[10px] text-body">due</p>
                    </div>
                )}
            </div>

            {hasIssues ? (
                <div className="divide-y divide-hairline px-4">
                    {commercial.blockingIssues.slice(0, 5).map((issue) => (
                        <div key={issue.id} className="flex min-w-0 items-center gap-3 py-2.5">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-risk" />
                            <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-center gap-2">
                                    <p className="truncate text-sm font-semibold text-ink">{issue.partyName}</p>
                                    {issue.reason === 'payment_mismatch' && (
                                        <span className="shrink-0 rounded bg-risk-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-risk">
                                            Mismatch
                                        </span>
                                    )}
                                </div>
                                <p className="truncate text-[11px] text-body">
                                    {issue.qualityLabel} - {formatDateOnly(issue.dueDate)}
                                </p>
                            </div>
                            <div className="shrink-0 text-right">
                                <p className="text-xs font-semibold text-risk">
                                    Rs. {issue.balanceAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </p>
                            </div>
                        </div>
                    ))}
                    {commercial.blockingIssues.length > 5 && (
                        <p className="py-2 text-xs text-muted">+{commercial.blockingIssues.length - 5} more receivables</p>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-2 px-4 py-4">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <p className="text-sm text-body">No due receivables or payment mismatches.</p>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline px-4 py-3">
                <Link
                    href="/owner/commercials"
                    className={cn(
                        'flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
                        hasIssues
                            ? 'border-risk/30 bg-risk-soft text-risk hover:bg-risk/20'
                            : 'border-hairline bg-surface text-ink hover:bg-surface-soft'
                    )}
                >
                    Review Party Ledger
                    <ArrowRight className="h-3.5 w-3.5" />
                </Link>
            </div>
        </div>
    )
}
