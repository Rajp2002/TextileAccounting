'use client'

import Link from 'next/link'
import type { FactoryTodayData } from '@/app/(dashboard)/owner/today/actions'
import { TrendingDown, Calendar, Package, Store, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WorkAtRiskCardProps {
    workAtRisk: FactoryTodayData['workAtRisk']
}

export function WorkAtRiskCard({ workAtRisk }: WorkAtRiskCardProps) {
    const { ordersBehindPace, inactiveMarketRuns } = workAtRisk
    const total = ordersBehindPace.length + inactiveMarketRuns.length
    const hasRisk = total > 0
    const criticalOrders = ordersBehindPace.filter((o) => o.riskLevel === 'red')

    return (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
            {/* Header */}
            <div className={cn(
                'flex items-center gap-3 border-b px-4 py-3',
                !hasRisk
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : criticalOrders.length > 0
                        ? 'border-rose-500/20 bg-rose-500/5'
                        : 'border-amber-500/20 bg-amber-500/5'
            )}>
                <TrendingDown className={cn(
                    'h-4 w-4 shrink-0',
                    !hasRisk ? 'text-emerald-400' : criticalOrders.length > 0 ? 'text-rose-400' : 'text-amber-400'
                )} />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Work at Risk</p>
                    <p className={cn(
                        'text-sm font-bold',
                        !hasRisk ? 'text-emerald-400' : criticalOrders.length > 0 ? 'text-rose-400' : 'text-amber-400'
                    )}>
                        {!hasRisk ? 'All orders on track' : `${total} item${total !== 1 ? 's' : ''} need attention`}
                    </p>
                </div>
                {hasRisk && (
                    <span className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-bold',
                        criticalOrders.length > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                    )}>
                        {criticalOrders.length > 0 ? `${criticalOrders.length} critical` : 'Warning'}
                    </span>
                )}
            </div>

            {/* Orders Behind Pace */}
            {ordersBehindPace.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                        <Package className="h-3.5 w-3.5 text-zinc-500" />
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Orders behind pace</p>
                    </div>
                    <div className="divide-y divide-white/[0.04] px-4">
                        {ordersBehindPace.slice(0, 3).map((order) => (
                            <div key={order.id} className="flex items-start gap-3 py-2.5">
                                <span className={cn(
                                    'mt-0.5 h-2 w-2 shrink-0 rounded-full',
                                    order.riskLevel === 'red' ? 'bg-rose-400' : 'bg-amber-400'
                                )} />
                                <div className="flex-1 min-w-0">
                                    <p className="truncate text-sm font-semibold text-zinc-200">{order.partyName}</p>
                                    {order.qualityLabel && (
                                        <p className="text-xs text-zinc-500">{order.qualityLabel}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-semibold text-zinc-300">
                                        {order.remainingMeters.toLocaleString('en-IN', { maximumFractionDigits: 0 })}m left
                                    </p>
                                    <p className="flex items-center gap-1 text-[11px] text-zinc-500">
                                        <Calendar className="h-2.5 w-2.5" />
                                        {new Date(order.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Inactive Market Runs */}
            {inactiveMarketRuns.length > 0 && (
                <div className={cn(ordersBehindPace.length > 0 && 'border-t border-white/[0.06]')}>
                    <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                        <Store className="h-3.5 w-3.5 text-zinc-500" />
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Inactive market runs</p>
                    </div>
                    <div className="divide-y divide-white/[0.04] px-4">
                        {inactiveMarketRuns.slice(0, 3).map((run) => (
                            <div key={run.id} className="flex items-center gap-3 py-2.5">
                                <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                                <span className="flex-1 truncate text-sm font-medium text-zinc-300">{run.label}</span>
                                <span className="text-[11px] text-zinc-500">No prod. 2+ days</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!hasRisk && (
                <div className="flex items-center gap-2 px-4 py-4">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <p className="text-sm text-zinc-400">All orders and runs are on schedule.</p>
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-4 py-3">
                <Link
                    href="/owner/orders"
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/10"
                >
                    View Orders
                </Link>
                <Link
                    href="/owner/market-runs"
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/10"
                >
                    View Runs
                </Link>
            </div>
        </div>
    )
}
