'use client'

import Link from 'next/link'
import type { FactoryTodayData } from '@/app/(dashboard)/owner/today/actions'
import { DollarSign, Users, HandCoins } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PayrollHisaabCardProps {
    payroll: FactoryTodayData['payroll']
}

export function PayrollHisaabCard({ payroll }: PayrollHisaabCardProps) {
    const hasAdvances = payroll.pendingAdvanceTotal > 0
    const hasUnsettled = payroll.unsettledWorkerCount > 0

    const color = hasAdvances || hasUnsettled ? 'amber' : 'emerald'

    return (
        <div className="rounded-2xl border border-hairline bg-surface overflow-hidden">
            {/* Header */}
            <div className={cn(
                'flex items-center gap-3 border-b px-4 py-3',
                color === 'amber' ? 'border-warning/20 bg-warning-soft' : 'border-success/20 bg-success-soft'
            )}>
                <DollarSign className={cn('h-4 w-4 shrink-0', color === 'amber' ? 'text-warning' : 'text-success')} />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink">Payroll / Hisaab</p>
                    <p className={cn('text-sm font-bold', color === 'amber' ? 'text-warning' : 'text-success')}>
                        {payroll.currentCycleLabel}
                    </p>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 divide-x divide-hairline border-b border-hairline">
                <div className="px-4 py-4">
                    <div className="mb-2 flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-body" />
                        <p className="text-xs text-body">Active Workers</p>
                    </div>
                    <p className={cn(
                        'text-2xl font-bold',
                        hasUnsettled ? 'text-warning' : 'text-ink'
                    )}>
                        {payroll.unsettledWorkerCount}
                    </p>
                    <p className="mt-0.5 text-[11px] text-body">workers with logs this cycle</p>
                </div>
                <div className="px-4 py-4">
                    <div className="mb-2 flex items-center gap-2">
                        <HandCoins className="h-3.5 w-3.5 text-body" />
                        <p className="text-xs text-body">Pending Advances</p>
                    </div>
                    <p className={cn(
                        'text-2xl font-bold',
                        hasAdvances ? 'text-risk' : 'text-ink'
                    )}>
                        {hasAdvances
                            ? `₹${(payroll.pendingAdvanceTotal / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}k`
                            : '—'
                        }
                    </p>
                    <p className="mt-0.5 text-[11px] text-body">
                        {hasAdvances ? 'pending deduction' : 'No pending advances'}
                    </p>
                </div>
            </div>

            {/* Cycle info */}
            {payroll.upcomingSettlementDate && (
                <div className="px-4 py-3">
                    <p className="text-xs text-body">
                        Next cycle starts{' '}
                        <span className="font-semibold text-ink">
                            {new Date(payroll.upcomingSettlementDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                    </p>
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-hairline px-4 py-3">
                {hasAdvances && (
                    <Link
                        href="/owner/advances"
                        className="flex items-center gap-1.5 rounded-lg border border-risk/30 bg-risk-soft px-3 py-1.5 text-xs font-semibold text-risk transition hover:bg-risk/20"
                    >
                        Review Advances
                    </Link>
                )}
                <Link
                    href="/owner/payroll"
                    className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
                        hasUnsettled
                            ? 'border-warning/30 bg-warning-soft text-warning hover:bg-warning/20'
                            : 'border-hairline bg-surface text-ink hover:bg-surface-soft'
                    )}
                >
                    {hasUnsettled ? 'Settle Hisaab →' : 'View Payroll'}
                </Link>
            </div>
        </div>
    )
}
