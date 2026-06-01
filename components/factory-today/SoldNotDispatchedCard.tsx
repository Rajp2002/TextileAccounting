'use client'

import Link from 'next/link'
import type { FactoryTodayData } from '@/app/(dashboard)/owner/today/actions'
import { Truck, CheckCircle2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatToSurat } from '@/lib/time'

interface SoldNotDispatchedCardProps {
    sales: FactoryTodayData['dispatch']['soldNotDispatched']
}

export function SoldNotDispatchedCard({ sales }: SoldNotDispatchedCardProps) {
    const hasSales = sales.length > 0
    const totalMeters = sales.reduce((s, sale) => s + sale.meters, 0)
    const totalValue = sales.reduce((s, sale) => s + sale.saleValue, 0)

    return (
        <div className="rounded-2xl border border-hairline bg-surface overflow-hidden">
            {/* Header */}
            <div className={cn(
                'flex items-center gap-3 border-b px-4 py-3',
                hasSales ? 'border-risk/20 bg-risk-soft' : 'border-success/20 bg-success-soft'
            )}>
                <Truck className={cn('h-4 w-4 shrink-0', hasSales ? 'text-risk' : 'text-success')} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink">Sold, Not Dispatched</p>
                        {hasSales && (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#FF3B30] text-[10px] font-bold text-white">
                                {sales.length}
                            </span>
                        )}
                    </div>
                    <p className={cn('text-sm font-bold', hasSales ? 'text-risk' : 'text-success')}>
                        {hasSales
                            ? `${sales.length} sale${sales.length !== 1 ? 's' : ''} awaiting dispatch`
                            : 'All sold stock dispatched'
                        }
                    </p>
                </div>
                {hasSales && (
                    <div className="text-right">
                        <p className="text-[11px] font-bold text-risk">
                            ₹{(totalValue / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}k
                        </p>
                        <p className="text-[10px] text-body">{totalMeters.toLocaleString('en-IN', { maximumFractionDigits: 0 })}m</p>
                    </div>
                )}
            </div>

            {/* Sales List */}
            {hasSales ? (
                <div className="divide-y divide-hairline px-4">
                    {sales.slice(0, 5).map((sale) => (
                        <div key={sale.saleId} className="flex items-center gap-3 py-2.5">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-risk" />
                            <div className="flex-1 min-w-0">
                                <p className="truncate text-sm font-semibold text-ink">{sale.qualityLabel}</p>
                                <p className="text-[11px] text-body">
                                    {formatToSurat(sale.saleDate, 'd MMM')}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-semibold text-body">
                                    {sale.meters.toLocaleString('en-IN', { maximumFractionDigits: 0 })}m
                                </p>
                                <p className="text-[11px] text-body">
                                    ₹{sale.saleValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </p>
                            </div>
                        </div>
                    ))}
                    {sales.length > 5 && (
                        <p className="py-2 text-xs text-muted">+{sales.length - 5} more awaiting dispatch</p>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-2 px-4 py-4">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <p className="text-sm text-body">All sold stock has been dispatched.</p>
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-hairline px-4 py-3">
                <Link
                    href="/owner/stock"
                    className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface text-ink px-3 py-1.5 text-xs font-semibold transition hover:bg-surface-soft"
                >
                    Sell & Dispatch
                </Link>
                <Link
                    href="/owner/dispatches"
                    className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
                        hasSales
                            ? 'border-risk/30 bg-risk-soft text-risk hover:bg-risk/20'
                            : 'border-hairline bg-surface text-ink hover:bg-surface-soft'
                    )}
                >
                    {hasSales ? 'Create Dispatch →' : 'View Dispatches'}
                </Link>
            </div>
        </div>
    )
}
