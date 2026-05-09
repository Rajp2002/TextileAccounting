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
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
            {/* Header */}
            <div className={cn(
                'flex items-center gap-3 border-b px-4 py-3',
                color === 'amber' ? 'border-amber-500/20 bg-amber-500/5' : 'border-emerald-500/20 bg-emerald-500/5'
            )}>
                <DollarSign className={cn('h-4 w-4 shrink-0', color === 'amber' ? 'text-amber-400' : 'text-emerald-400')} />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Payroll / Hisaab</p>
                    <p className={cn('text-sm font-bold', color === 'amber' ? 'text-amber-400' : 'text-emerald-400')}>
                        {payroll.currentCycleLabel}
                    </p>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 divide-x divide-white/[0.06] border-b border-white/[0.06]">
                <div className="px-4 py-4">
                    <div className="mb-2 flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-zinc-500" />
                        <p className="text-xs text-zinc-500">Active Workers</p>
                    </div>
                    <p className={cn(
                        'text-2xl font-bold',
                        hasUnsettled ? 'text-amber-400' : 'text-zinc-300'
                    )}>
                        {payroll.unsettledWorkerCount}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">workers with logs this cycle</p>
                </div>
                <div className="px-4 py-4">
                    <div className="mb-2 flex items-center gap-2">
                        <HandCoins className="h-3.5 w-3.5 text-zinc-500" />
                        <p className="text-xs text-zinc-500">Pending Advances</p>
                    </div>
                    <p className={cn(
                        'text-2xl font-bold',
                        hasAdvances ? 'text-rose-400' : 'text-zinc-300'
                    )}>
                        {hasAdvances
                            ? `₹${(payroll.pendingAdvanceTotal / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}k`
                            : '—'
                        }
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                        {hasAdvances ? 'pending deduction' : 'No pending advances'}
                    </p>
                </div>
            </div>

            {/* Cycle info */}
            {payroll.upcomingSettlementDate && (
                <div className="px-4 py-3">
                    <p className="text-xs text-zinc-500">
                        Next cycle starts{' '}
                        <span className="font-semibold text-zinc-300">
                            {new Date(payroll.upcomingSettlementDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                    </p>
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-4 py-3">
                {hasAdvances && (
                    <Link
                        href="/owner/advances"
                        className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
                    >
                        Review Advances
                    </Link>
                )}
                <Link
                    href="/owner/payroll"
                    className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
                        hasUnsettled
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                            : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                    )}
                >
                    {hasUnsettled ? 'Settle Hisaab →' : 'View Payroll'}
                </Link>
            </div>
        </div>
    )
}
