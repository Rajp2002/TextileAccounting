'use client'

import Link from 'next/link'
import type { FactoryTodayData } from '@/app/(dashboard)/owner/today/actions'
import { MapPin, Clock, CheckCircle2, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface PendingReceiptsCardProps {
    receipts: FactoryTodayData['dispatch']['pendingReceipts']
}

function TrackingCopyButton({ token, dispatchNumber }: { token: string; dispatchNumber: number }) {
    const [copied, setCopied] = useState(false)

    async function handleCopy() {
        // Use the configured site URL (production-safe); fall back to current origin in dev
        const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || window.location.origin
        const url = `${base}/track/${token}`
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-zinc-400 transition hover:bg-white/10"
            title={`Copy tracking link for Dispatch #${dispatchNumber}`}
        >
            <Copy className="h-2.5 w-2.5" />
            {copied ? 'Copied!' : 'Track'}
        </button>
    )
}

export function PendingReceiptsCard({ receipts }: PendingReceiptsCardProps) {
    const hasReceipts = receipts.length > 0
    const longPending = receipts.filter((r) => r.daysPending > 5)

    return (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
            {/* Header */}
            <div className={cn(
                'flex items-center gap-3 border-b px-4 py-3',
                !hasReceipts
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : longPending.length > 0
                        ? 'border-rose-500/20 bg-rose-500/5'
                        : 'border-amber-500/20 bg-amber-500/5'
            )}>
                <MapPin className={cn(
                    'h-4 w-4 shrink-0',
                    !hasReceipts ? 'text-emerald-400' : longPending.length > 0 ? 'text-rose-400' : 'text-amber-400'
                )} />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Dispatches Pending Receipt</p>
                    <p className={cn(
                        'text-sm font-bold',
                        !hasReceipts ? 'text-emerald-400' : longPending.length > 0 ? 'text-rose-400' : 'text-amber-400'
                    )}>
                        {!hasReceipts
                            ? 'All dispatches received'
                            : `${receipts.length} in transit`
                        }
                    </p>
                </div>
                {longPending.length > 0 && (
                    <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-400">
                        {longPending.length} overdue
                    </span>
                )}
            </div>

            {/* Receipts List */}
            {hasReceipts ? (
                <div className="divide-y divide-white/[0.04] px-4">
                    {receipts.slice(0, 5).map((r) => (
                        <div key={r.dispatchId} className="flex items-center gap-3 py-2.5">
                            <Clock className={cn(
                                'h-3.5 w-3.5 shrink-0',
                                r.daysPending > 5 ? 'text-rose-400' : 'text-amber-400'
                            )} />
                            <div className="flex-1 min-w-0">
                                <p className="truncate text-sm font-semibold text-zinc-200">{r.partyName}</p>
                                <p className="text-[11px] text-zinc-500">
                                    Dispatch #{r.dispatchNumber} · {r.sentMeters.toLocaleString('en-IN', { maximumFractionDigits: 0 })}m sent
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    'text-[11px] font-semibold',
                                    r.daysPending > 5 ? 'text-rose-400' : 'text-amber-400'
                                )}>
                                    {r.daysPending}d ago
                                </span>
                                {r.trackingToken && (
                                    <TrackingCopyButton token={r.trackingToken} dispatchNumber={r.dispatchNumber} />
                                )}
                            </div>
                        </div>
                    ))}
                    {receipts.length > 5 && (
                        <p className="py-2 text-xs text-zinc-500">+{receipts.length - 5} more in transit</p>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-2 px-4 py-4">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <p className="text-sm text-zinc-400">All dispatches have been confirmed received.</p>
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-4 py-3">
                <Link
                    href="/owner/dispatches"
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/10"
                >
                    View All Dispatches
                </Link>
            </div>
        </div>
    )
}
