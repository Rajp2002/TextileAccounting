'use client'

import Link from 'next/link'
import { ArrowUpRight, CheckCircle2, Clock3, Download, ReceiptText, XCircle } from 'lucide-react'
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/page-header'

export type BillingHistoryStatus = 'captured' | 'failed' | 'incomplete' | 'refunded'

export type BillingHistoryEntry = {
    id: string
    kind: 'payment' | 'attempt'
    date: string | null
    planTier: string | null
    purchaseType: string | null
    amountPaise: number | null
    method: string | null
    paymentId: string | null
    orderId: string | null
    receiptPaymentId: string | null
    status: BillingHistoryStatus
}

function formatShortDate(iso: string | null): string {
    if (!iso) return 'Date unavailable'
    return `${new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        timeZone: 'Asia/Kolkata',
    })} IST`
}

function formatAmount(paise: number): string {
    return `₹${(paise / 100).toLocaleString('en-IN')}`
}

function getBillingPlanName(planTier: string | null | undefined): string {
    if (planTier === 'lite') return 'Weavly Lite'
    if (planTier === 'base') return 'Weavly Base'
    return 'Previous Weavly plan'
}

function getPurchaseTypeLabel(purchaseType: string | null | undefined): string {
    if (purchaseType === 'renewal') return 'Annual renewal'
    if (purchaseType === 'initial_purchase') return 'First-year payment'
    return 'Subscription payment'
}

function BillingHistoryRow({ entry }: { entry: BillingHistoryEntry }) {
    const statusPresentation = {
        captured: {
            label: 'Captured',
            status: 'success',
            icon: CheckCircle2,
            className: 'border-success/25 bg-success-soft text-success',
        },
        failed: {
            label: 'Failed',
            status: 'failed',
            icon: XCircle,
            className: 'border-risk/25 bg-risk-soft text-risk',
        },
        incomplete: {
            label: 'Incomplete',
            status: 'pending',
            icon: Clock3,
            className: 'border-warning/25 bg-warning-soft text-warning',
        },
        refunded: {
            label: 'Refunded',
            status: 'cancelled',
            icon: XCircle,
            className: 'border-hairline bg-surface-soft text-subtle',
        },
    }[entry.status]
    const Icon = statusPresentation.icon

    return (
        <div className="flex flex-col gap-3 p-4 transition-colors hover:bg-surface-soft sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${statusPresentation.className}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold tracking-tight text-ink">{getBillingPlanName(entry.planTier)}</p>
                        <StatusBadge status={statusPresentation.status} label={statusPresentation.label} />
                        {entry.receiptPaymentId && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800">
                                <ReceiptText className="h-3 w-3" aria-hidden="true" /> Receipt available
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-subtle">
                        <span>{formatShortDate(entry.date)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{getPurchaseTypeLabel(entry.purchaseType)}</span>
                        {entry.method && (
                            <>
                                <span aria-hidden="true">·</span>
                                <span className="capitalize">{entry.method.replaceAll('_', ' ')}</span>
                            </>
                        )}
                        {entry.paymentId && (
                            <>
                                <span aria-hidden="true">·</span>
                                <span>Ref. {entry.paymentId.slice(-8)}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center justify-between gap-4 pl-12 sm:block sm:pl-0 sm:text-right">
                <p className={`text-lg font-bold tracking-tight ${entry.status === 'captured' ? 'text-ink' : 'text-body'}`}>
                    {entry.amountPaise !== null ? formatAmount(entry.amountPaise) : '—'}
                </p>
                {entry.receiptPaymentId ? (
                    <Link
                        href={`/api/billing/receipt/${entry.receiptPaymentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-saffron-deep hover:underline"
                    >
                        Download receipt <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                ) : (
                    <p className="text-[11px] text-subtle">
                        {entry.status === 'incomplete' ? 'No payment captured' : entry.status === 'failed' ? 'Payment not completed' : 'No receipt'}
                    </p>
                )}
            </div>
        </div>
    )
}

export function PaymentHistoryDialog({ entries }: { entries: BillingHistoryEntry[] }) {
    const latestPaid = entries.find((entry) => entry.receiptPaymentId)
        ?? entries.find((entry) => entry.status === 'captured')
        ?? null
    const latest = latestPaid ?? entries[0] ?? null
    const recordLabel = `${entries.length} ${entries.length === 1 ? 'record' : 'records'}`
    const latestSummary = latest
        ? `${latestPaid ? 'Latest payment' : 'Latest activity'} ${formatShortDate(latest.date)}${latest.amountPaise !== null ? ` · ${formatAmount(latest.amountPaise)}` : ''}`
        : 'Successful payments and receipts will appear here'

    return (
        <Dialog>
            <DialogTrigger asChild>
                <button
                    type="button"
                    className="group flex w-full items-center gap-3 rounded-xl border border-hairline bg-surface p-4 text-left shadow-[var(--shadow-card)] transition-all duration-150 hover:border-saffron/40 hover:bg-surface-soft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-saffron/40 active:scale-[0.99]"
                    aria-label="View payment history"
                >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-saffron/25 bg-saffron-soft/60 text-saffron-deep transition-colors group-hover:bg-saffron-soft">
                        <ReceiptText className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold tracking-tight text-ink">View payment history</span>
                            <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[10px] font-semibold text-subtle">{recordLabel}</span>
                        </span>
                        <span className="mt-1 block truncate text-xs text-subtle">{latestSummary}</span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-subtle transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-saffron-deep" aria-hidden="true" />
                </button>
            </DialogTrigger>

            <DialogContent className="max-h-[calc(100dvh-1rem)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <DialogHeader className="border-b border-hairline bg-surface-soft/45 px-5 py-5 pr-14 sm:px-6">
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-saffron/25 bg-saffron-soft/60 text-saffron-deep">
                            <ReceiptText className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <DialogTitle className="text-xl font-bold tracking-tight">Payment history</DialogTitle>
                            <DialogDescription className="mt-1 text-xs leading-relaxed">
                                Review payment status, references, and downloadable receipts for this workspace.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="min-h-0 max-h-[min(65vh,560px)] overflow-y-auto px-4 py-4 sm:px-6">
                    {entries.length > 0 ? (
                        <Card className="gap-0 overflow-hidden p-0 shadow-none">
                            <div className="divide-y divide-hairline">
                                {entries.map((entry) => <BillingHistoryRow key={entry.id} entry={entry} />)}
                            </div>
                        </Card>
                    ) : (
                        <div className="rounded-xl border border-dashed border-hairline bg-surface-soft/45 px-5 py-10 text-center">
                            <ReceiptText className="mx-auto h-6 w-6 text-subtle" aria-hidden="true" />
                            <p className="mt-3 text-sm font-semibold text-ink">No payment history yet.</p>
                            <p className="mt-1 text-sm leading-relaxed text-subtle">Successful payments and downloadable receipts will appear here.</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t border-hairline bg-surface-soft/35 px-5 py-3 sm:px-6">
                    <p className="flex items-center gap-1.5 text-[11px] text-subtle">
                        <ReceiptText className="h-3.5 w-3.5" aria-hidden="true" />
                        Receipts are available for captured payments.
                    </p>
                    <DialogClose asChild>
                        <Button variant="outline" size="sm">Done</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
