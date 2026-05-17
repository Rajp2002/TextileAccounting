'use client'

import Link from 'next/link'
import type { FactoryTodayData } from '@/app/(dashboard)/owner/today/actions'
import { MapPin, Clock, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useTransition } from 'react'
import { markDiscrepancyReviewed } from '@/app/(dashboard)/owner/dispatches/actions'
import { toast } from 'sonner'

interface PendingReceiptsCardProps {
    receipts: FactoryTodayData['dispatch']['pendingReceipts']
    receiptDifferences: FactoryTodayData['dispatch']['receiptDifferences']
}

function TrackingLink({ token, dispatchNumber }: { token: string; dispatchNumber: number }) {
    return (
        <Link
            href={`/track/${token}`}
            target="_blank"
            className="flex items-center gap-1 rounded border border-hairline bg-surface px-2 py-1 text-[11px] font-medium text-body transition hover:bg-surface-soft"
            title={`Track Dispatch #${dispatchNumber}`}
        >
            <MapPin className="h-2.5 w-2.5" />
            Track
        </Link>
    )
}

export function PendingReceiptsCard({ receipts, receiptDifferences }: PendingReceiptsCardProps) {
    const hasReceipts = receipts.length > 0
    const hasDifferences = receiptDifferences.length > 0
    const longPending = receipts.filter((r) => r.daysPending > 5)
    const [reviewingId, setReviewingId] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const reviewDifference = (discrepancyId: string) => {
        setReviewingId(discrepancyId)
        startTransition(async () => {
            const result = await markDiscrepancyReviewed(discrepancyId)
            if ('error' in result) {
                toast.error(result.error)
            } else {
                toast.success('Receipt difference marked reviewed')
            }
            setReviewingId(null)
        })
    }

    return (
        <div className="rounded-2xl border border-hairline bg-surface overflow-hidden">
            {/* Header */}
            <div className={cn(
                'flex items-center gap-3 border-b px-4 py-3',
                !hasReceipts && !hasDifferences
                    ? 'border-success/20 bg-success-soft'
                    : hasDifferences
                        ? 'border-risk/20 bg-risk-soft'
                    : longPending.length > 0
                        ? 'border-risk/20 bg-risk-soft'
                        : 'border-warning/20 bg-warning-soft'
            )}>
                <MapPin className={cn(
                    'h-4 w-4 shrink-0',
                    !hasReceipts && !hasDifferences ? 'text-success' : hasDifferences || longPending.length > 0 ? 'text-risk' : 'text-warning'
                )} />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink">Dispatches Pending Receipt</p>
                    <p className={cn(
                        'text-sm font-bold',
                        !hasReceipts && !hasDifferences ? 'text-success' : hasDifferences || longPending.length > 0 ? 'text-risk' : 'text-warning'
                    )}>
                        {!hasReceipts && !hasDifferences
                            ? 'All dispatches received'
                            : hasDifferences
                                ? `${receiptDifferences.length} receipt difference${receiptDifferences.length !== 1 ? 's' : ''}`
                            : `${receipts.length} in transit`
                        }
                    </p>
                </div>
                {(hasDifferences || longPending.length > 0) && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FF3B30] text-[11px] font-bold text-white">
                        {hasDifferences ? receiptDifferences.length : longPending.length}
                    </span>
                )}
            </div>

            {hasDifferences && (
                <div className="divide-y divide-risk/10 border-b border-hairline px-4">
                    {receiptDifferences.slice(0, 5).map((d) => (
                        <div key={d.discrepancyId} className="flex items-center gap-3 py-2.5">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-risk" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-ink">
                                    {d.partyName} reported {Math.abs(d.differenceMeters).toLocaleString('en-IN', { maximumFractionDigits: 2 })}m {d.direction} than dispatched.
                                </p>
                                <p className="text-[11px] text-body">
                                    Dispatch #{d.dispatchNumber} · sent {d.sentMeters.toLocaleString('en-IN', { maximumFractionDigits: 0 })}m · received {d.receivedMeters.toLocaleString('en-IN', { maximumFractionDigits: 0 })}m
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => reviewDifference(d.discrepancyId)}
                                disabled={isPending && reviewingId === d.discrepancyId}
                                className="flex items-center gap-1 rounded border border-risk/20 bg-white px-2 py-1 text-[11px] font-semibold text-risk transition hover:bg-risk-soft disabled:opacity-60"
                            >
                                {isPending && reviewingId === d.discrepancyId ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                Reviewed
                            </button>
                        </div>
                    ))}
                    {receiptDifferences.length > 5 && (
                        <p className="py-2 text-xs text-muted">+{receiptDifferences.length - 5} more receipt differences</p>
                    )}
                </div>
            )}

            {/* Receipts List */}
            {hasReceipts ? (
                <div className="divide-y divide-hairline px-4">
                    {receipts.slice(0, 5).map((r) => (
                        <div key={r.dispatchId} className="flex items-center gap-3 py-2.5">
                            <Clock className={cn(
                                'h-3.5 w-3.5 shrink-0',
                                r.daysPending > 5 ? 'text-risk' : 'text-warning'
                            )} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="truncate text-sm font-semibold text-ink">{r.partyName}</p>
                                    {r.daysPending > 5 && (
                                        <span className="rounded bg-risk-soft px-1.5 py-0.5 text-[10px] font-bold text-risk uppercase">Critical</span>
                                    )}
                                </div>
                                <p className="text-[11px] text-body">
                                    Dispatch #{r.dispatchNumber} · {r.sentMeters.toLocaleString('en-IN', { maximumFractionDigits: 0 })}m sent
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    'text-[11px] font-semibold',
                                    r.daysPending > 5 ? 'text-risk' : 'text-warning'
                                )}>
                                    {r.daysPending}d ago
                                </span>
                                {r.trackingToken && (
                                    <TrackingLink token={r.trackingToken} dispatchNumber={r.dispatchNumber} />
                                )}
                            </div>
                        </div>
                    ))}
                    {receipts.length > 5 && (
                        <p className="py-2 text-xs text-muted">+{receipts.length - 5} more in transit</p>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-2 px-4 py-4">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <p className="text-sm text-body">All dispatches have been confirmed received.</p>
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-hairline px-4 py-3">
                <Link
                    href="/owner/dispatches"
                    className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-surface-soft"
                >
                    View All Dispatches
                </Link>
            </div>
        </div>
    )
}
