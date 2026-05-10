'use client'

import Link from 'next/link'
import type { FactoryTodayData } from '@/app/(dashboard)/owner/today/actions'
import { Package, CheckCircle2, Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PendingStockDraftsCardProps {
    drafts: FactoryTodayData['stock']['pendingInwardDrafts']
}

export function PendingStockDraftsCard({ drafts }: PendingStockDraftsCardProps) {
    const hasDrafts = drafts.length > 0

    return (
        <div className="rounded-2xl border border-hairline bg-surface overflow-hidden">
            {/* Header */}
            <div className={cn(
                'flex items-center gap-3 border-b px-4 py-3',
                hasDrafts ? 'border-warning/20 bg-warning-soft' : 'border-success/20 bg-success-soft'
            )}>
                <Package className={cn('h-4 w-4 shrink-0', hasDrafts ? 'text-warning' : 'text-success')} />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink">Pending Stock Inward</p>
                    <p className={cn('text-sm font-bold', hasDrafts ? 'text-warning' : 'text-success')}>
                        {hasDrafts
                            ? `${drafts.length} draft${drafts.length !== 1 ? 's' : ''} need confirmation`
                            : 'All drafts confirmed'
                        }
                    </p>
                </div>
                {hasDrafts && (
                    <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-bold text-warning">
                        {drafts.reduce((s, d) => s + d.producedMeters, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}m
                    </span>
                )}
            </div>

            {/* Draft List */}
            {hasDrafts ? (
                <div className="divide-y divide-hairline px-4">
                    {drafts.slice(0, 5).map((draft) => {
                        const ShiftIcon = draft.shift === 'night' ? Moon : Sun
                        return (
                            <div key={draft.id} className="flex items-center gap-3 py-2.5">
                                <ShiftIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
                                <div className="flex-1 min-w-0">
                                    <p className="truncate text-sm font-semibold text-ink">{draft.qualityLabel}</p>
                                    <p className="text-[11px] text-body">
                                        {new Date(draft.productionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {draft.shift} shift
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-semibold text-body">
                                        {draft.producedMeters.toLocaleString('en-IN', { maximumFractionDigits: 0 })}m
                                    </p>
                                    <p className="text-[11px] text-body">
                                        ₹{draft.costPerMeter.toLocaleString('en-IN', { maximumFractionDigits: 2 })}/m
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                    {drafts.length > 5 && (
                        <p className="py-2 text-xs text-muted">+{drafts.length - 5} more pending drafts</p>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-2 px-4 py-4">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <p className="text-sm text-body">No pending inward drafts. Stock is up to date.</p>
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-hairline px-4 py-3">
                <Link
                    href="/owner/stock?tab=pending"
                    className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
                        hasDrafts
                            ? 'border-warning/30 bg-warning-soft text-warning hover:bg-warning/20'
                            : 'border-hairline bg-surface text-ink hover:bg-surface-soft'
                    )}
                >
                    {hasDrafts ? 'Confirm Takas →' : 'View Stock'}
                </Link>
            </div>
        </div>
    )
}
