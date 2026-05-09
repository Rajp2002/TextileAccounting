'use client'

import Link from 'next/link'
import type { FactoryTodayData } from '@/app/(dashboard)/owner/today/actions'
import { Truck, CheckCircle2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SoldNotDispatchedCardProps {
    sales: FactoryTodayData['dispatch']['soldNotDispatched']
}

export function SoldNotDispatchedCard({ sales }: SoldNotDispatchedCardProps) {
    const hasSales = sales.length > 0
    const totalMeters = sales.reduce((s, sale) => s + sale.meters, 0)
    const totalValue = sales.reduce((s, sale) => s + sale.saleValue, 0)

    return (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
            {/* Header */}
            <div className={cn(
                'flex items-center gap-3 border-b px-4 py-3',
                hasSales ? 'border-rose-500/20 bg-rose-500/5' : 'border-emerald-500/20 bg-emerald-500/5'
            )}>
                <Truck className={cn('h-4 w-4 shrink-0', hasSales ? 'text-rose-400' : 'text-emerald-400')} />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Sold, Not Dispatched</p>
                    <p className={cn('text-sm font-bold', hasSales ? 'text-rose-400' : 'text-emerald-400')}>
                        {hasSales
                            ? `${sales.length} sale${sales.length !== 1 ? 's' : ''} awaiting dispatch`
                            : 'All sold stock dispatched'
                        }
                    </p>
                </div>
                {hasSales && (
                    <div className="text-right">
                        <p className="text-[11px] font-bold text-rose-400">
                            ₹{(totalValue / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}k
                        </p>
                        <p className="text-[10px] text-zinc-500">{totalMeters.toLocaleString('en-IN', { maximumFractionDigits: 0 })}m</p>
                    </div>
                )}
            </div>

            {/* Sales List */}
            {hasSales ? (
                <div className="divide-y divide-white/[0.04] px-4">
                    {sales.slice(0, 5).map((sale) => (
                        <div key={sale.saleId} className="flex items-center gap-3 py-2.5">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                            <div className="flex-1 min-w-0">
                                <p className="truncate text-sm font-semibold text-zinc-200">{sale.qualityLabel}</p>
                                <p className="text-[11px] text-zinc-500">
                                    {new Date(sale.saleDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {sale.units} taka
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-semibold text-zinc-300">
                                    {sale.meters.toLocaleString('en-IN', { maximumFractionDigits: 0 })}m
                                </p>
                                <p className="text-[11px] text-zinc-500">
                                    ₹{sale.saleValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </p>
                            </div>
                        </div>
                    ))}
                    {sales.length > 5 && (
                        <p className="py-2 text-xs text-zinc-500">+{sales.length - 5} more awaiting dispatch</p>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-2 px-4 py-4">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <p className="text-sm text-zinc-400">All sold stock has been dispatched.</p>
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-4 py-3">
                <Link
                    href="/owner/stock"
                    className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-indigo-500/20"
                >
                    Sell & Dispatch
                </Link>
                <Link
                    href="/owner/dispatches"
                    className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
                        hasSales
                            ? 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                            : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                    )}
                >
                    {hasSales ? 'Create Dispatch →' : 'View Dispatches'}
                </Link>
            </div>
        </div>
    )
}
