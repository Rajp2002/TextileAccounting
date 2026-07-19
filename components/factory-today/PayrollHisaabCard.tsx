'use client'

import Link from 'next/link'
import type { FactoryTodayData } from '@/app/(dashboard)/owner/today/actions'
import { CalendarClock, DollarSign, Users, HandCoins } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatToSurat } from '@/lib/time'

interface PayrollHisaabCardProps {
    payroll: FactoryTodayData['payroll']
}

export function PayrollHisaabCard({ payroll }: PayrollHisaabCardProps) {
    const hasAdvances = payroll.pendingAdvanceTotal > 0
    const hasUnsettled = payroll.isPayWindowOpen && payroll.unsettledWorkerCount > 0
    const isOverdue = payroll.payWindowStatus === 'overdue' && hasUnsettled

    const color = isOverdue ? 'red' : hasAdvances || hasUnsettled ? 'amber' : 'emerald'
    const payDateLabel = formatToSurat(payroll.payDate, 'd MMM')
    const statusLabel = (() => {
        if (payroll.isPayWindowOpen && payroll.unsettledWorkerCount === 0) {
            return 'Paid'
        }
        if (payroll.payWindowStatus === 'overdue') return `Overdue since ${payDateLabel}`
        if (payroll.payWindowStatus === 'due_today') return `Due today, ${payDateLabel}`
        if (payroll.payWindowStatus === 'approaching') return `Due in ${payroll.daysUntilPayDate} day${payroll.daysUntilPayDate === 1 ? '' : 's'}`
        return `Pay date ${payDateLabel}`
    })()
    const tone = {
        red: {
            header: 'border-risk/20 bg-risk-soft',
            icon: 'text-risk',
            text: 'text-risk',
            link: 'border-risk/30 bg-risk-soft text-risk hover:bg-risk/20',
        },
        amber: {
            header: 'border-warning/20 bg-warning-soft',
            icon: 'text-warning',
            text: 'text-warning',
            link: 'border-warning/30 bg-warning-soft text-warning hover:bg-warning/20',
        },
        emerald: {
            header: 'border-success/20 bg-success-soft',
            icon: 'text-success',
            text: 'text-success',
            link: 'border-hairline bg-surface text-ink hover:bg-surface-soft',
        },
    }[color]

    return (
        <div className="min-w-0 overflow-hidden rounded-2xl border border-hairline bg-surface">
            {/* Header */}
            <div className={cn(
                'flex items-center gap-3 border-b px-4 py-3',
                tone.header
            )}>
                <DollarSign className={cn('h-4 w-4 shrink-0', tone.icon)} />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink">Worker Hisaab</p>
                    <p className={cn('text-sm font-bold', tone.text)}>
                        {payroll.currentCycleLabel}
                    </p>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 divide-y divide-hairline border-b border-hairline xs:grid-cols-2 xs:divide-x xs:divide-y-0">
                <div className="px-4 py-4">
                    <div className="mb-2 flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-body" />
                        <p className="min-w-0 truncate text-xs text-body">Active Workers</p>
                    </div>
                    <p className={cn(
                        'text-2xl font-bold',
                        isOverdue ? 'text-risk' : hasUnsettled ? 'text-warning' : 'text-ink'
                    )}>
                        {payroll.isPayWindowOpen ? payroll.unsettledWorkerCount : '—'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-body">
                        {payroll.isPayWindowOpen ? 'workers with logs this cycle' : 'opens near pay date'}
                    </p>
                </div>
                <div className="px-4 py-4">
                    <div className="mb-2 flex items-center gap-2">
                        <HandCoins className="h-3.5 w-3.5 text-body" />
                        <p className="min-w-0 truncate text-xs text-body">Pending Upaad</p>
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
                        {hasAdvances ? 'pending Worker Hisaab deduction' : 'No pending Upaad'}
                    </p>
                </div>
            </div>

            {/* Cycle info */}
            <div className="px-4 py-3">
                <div className="flex min-w-0 items-start gap-2 text-xs text-body">
                    <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                    <span>
                        {statusLabel}
                        {payroll.upcomingSettlementDate && (
                            <>
                                {' '}· Next cycle starts{' '}
                                <span className="font-semibold text-ink">
                                    {formatToSurat(payroll.upcomingSettlementDate, 'd MMM')}
                                </span>
                            </>
                        )}
                    </span>
                </div>
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline px-4 py-3">
                {hasAdvances && (
                    <Link
                        href="/owner/advances"
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-risk/30 bg-risk-soft px-3 py-1.5 text-xs font-semibold text-risk transition hover:bg-risk/20"
                    >
                        Review Upaad
                    </Link>
                )}
                <Link
                    href={`/owner/payroll?cycle=${payroll.currentCycleMonth}`}
                    className={cn(
                        'flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
                        hasUnsettled ? tone.link : 'border-hairline bg-surface text-ink hover:bg-surface-soft'
                    )}
                >
                    {hasUnsettled ? 'Complete Worker Hisaab →' : 'View Worker Hisaab'}
                </Link>
            </div>
        </div>
    )
}
