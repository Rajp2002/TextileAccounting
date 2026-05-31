'use client'

import Link from 'next/link'
import type { FactoryTodayData } from '@/app/(dashboard)/owner/today/actions'
import { TrendingDown, Calendar, Package, Store, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getWorkflowVisibility, type ProductionMode } from '@/lib/production-mode'

interface WorkAtRiskCardProps {
    workAtRisk: FactoryTodayData['workAtRisk']
    productionMode?: ProductionMode | null
}

export function WorkAtRiskCard({ workAtRisk, productionMode }: WorkAtRiskCardProps) {
    const { ordersBehindPace, inactiveMarketRuns } = workAtRisk
    const visibility = getWorkflowVisibility(productionMode)
    const total = ordersBehindPace.length + inactiveMarketRuns.length
    const hasRisk = total > 0
    const criticalOrders = ordersBehindPace.filter((o) => o.riskLevel === 'red')

    return (
        <div className="rounded-2xl border border-hairline bg-surface overflow-hidden">
            {/* Header */}
            <div className={cn(
                'flex items-center gap-3 border-b px-4 py-3',
                !hasRisk
                    ? 'border-success/20 bg-success-soft'
                    : criticalOrders.length > 0
                        ? 'border-risk/20 bg-risk-soft'
                        : 'border-warning/20 bg-warning-soft'
            )}>
                <TrendingDown className={cn(
                    'h-4 w-4 shrink-0',
                    !hasRisk ? 'text-success' : criticalOrders.length > 0 ? 'text-risk' : 'text-warning'
                )} />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink">Work at Risk</p>
                    <p className={cn(
                        'text-sm font-bold',
                        !hasRisk ? 'text-success' : criticalOrders.length > 0 ? 'text-risk' : 'text-warning'
                    )}>
                        {!hasRisk ? (visibility.orders ? 'All orders and runs on track' : 'All market runs on track') : `${total} item${total !== 1 ? 's' : ''} need attention`}
                    </p>
                </div>
                {hasRisk && (
                    criticalOrders.length > 0 ? (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FF3B30] text-[11px] font-bold text-white">
                            {criticalOrders.length}
                        </span>
                    ) : (
                        <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-bold text-warning">
                            Warning
                        </span>
                    )
                )}
            </div>

            {/* Orders Behind Pace */}
            {ordersBehindPace.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                        <Package className="h-3.5 w-3.5 text-muted" />
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink">Orders behind pace</p>
                    </div>
                    <div className="divide-y divide-hairline px-4">
                        {ordersBehindPace.slice(0, 3).map((order) => (
                            <div key={order.id} className="flex items-start gap-3 py-2.5">
                                <span className={cn(
                                    'mt-0.5 h-2 w-2 shrink-0 rounded-full',
                                    order.riskLevel === 'red' ? 'bg-risk' : 'bg-warning'
                                )} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="truncate text-sm font-semibold text-ink">{order.partyName}</p>
                                        {order.riskLevel === 'red' && (
                                            <span className="rounded bg-risk-soft px-1.5 py-0.5 text-[10px] font-bold text-risk uppercase">Critical</span>
                                        )}
                                    </div>
                                    {order.qualityLabel && (
                                        <p className="text-xs text-body">{order.qualityLabel}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-semibold text-body">
                                        {order.remainingMeters.toLocaleString('en-IN', { maximumFractionDigits: 0 })}m left
                                    </p>
                                    <p className="flex items-center gap-1 text-[11px] text-body">
                                        <Calendar className="h-2.5 w-2.5" />
                                        {new Date(order.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Inactive Market Runs */}
            {inactiveMarketRuns.length > 0 && (
                <div className={cn(ordersBehindPace.length > 0 && 'border-t border-hairline')}>
                    <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                        <Store className="h-3.5 w-3.5 text-muted" />
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink">Inactive market runs</p>
                    </div>
                    <div className="divide-y divide-hairline px-4">
                        {inactiveMarketRuns.slice(0, 3).map((run) => (
                            <div key={run.id} className="flex items-center gap-3 py-2.5">
                                <span className="h-2 w-2 shrink-0 rounded-full bg-warning" />
                                <span className="flex-1 truncate text-sm font-medium text-body">{run.label}</span>
                                <span className="text-[11px] text-body">No prod. 2+ days</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!hasRisk && (
                <div className="flex items-center gap-2 px-4 py-4">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <p className="text-sm text-body">All orders and runs are on schedule.</p>
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-hairline px-4 py-3">
                {visibility.orders && (
                    <Link
                        href="/owner/orders"
                        className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-surface-soft"
                    >
                        View Orders
                    </Link>
                )}
                {visibility.marketRuns && (
                    <Link
                        href="/owner/market-runs"
                        className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-surface-soft"
                    >
                        View Runs
                    </Link>
                )}
            </div>
        </div>
    )
}
