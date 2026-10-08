'use client'
import type { ReactNode } from 'react'
import Link from 'next/link'
import {
    AlertTriangle,
    ArrowUpRight,
    Banknote,
    CheckCircle2,
    ChevronDown,
    Clock,
    Edit3,
    FileText,
    Printer,
    RefreshCw,
    RotateCcw,
    Truck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { useTranslation } from '@/lib/i18n/context'
import type { tourSurfaceProps } from '@/lib/tours/sample-surface'
import {
    paymentStatus,
    safeEvidenceUrl,
    type Challan,
    type ChallanEvent,
    type ChallanMutation,
} from '@/lib/delivery-challans'
import { challanDueStatus } from '@/lib/challan-payment-terms'
import {
    deliveryBadgeVariant,
    dispatchEventLabelKey,
    dispatchPrimaryAction,
    dispatchSettlement,
    formatDispatchEventTime,
    formatDocumentDate,
    formatMeters,
    formatMoney,
    paymentBadgeVariant,
} from '@/lib/dispatch-detail'
import { cn } from '@/lib/utils'

const FINANCIAL = ['payment', 'refund', 'adjustment']
// Phones render rem at 14px, so a 44px touch target needs a pixel minimum.
const control = 'max-sm:h-auto max-sm:min-h-[44px]'
const secondary = cn('rounded-lg border-hairline bg-surface font-semibold text-ink shadow-xs hover:bg-surface-soft', control)
// Document fields in the order the challan prints them. Anything not listed falls into the second group.
const PARTY_FIELDS = ['customer_phone', 'customer_gstin', 'customer_address', 'delivery_address', 'place_of_supply', 'sender_name', 'sender_gstin', 'sender_address']
const HIDDEN_FIELDS = ['date', 'customer_name']

const rupees = (value: number) => `₹${formatMoney(Math.abs(value))}`
const signedRupees = (value: number) => `${Number(value) < 0 ? '−' : '+'}₹${formatMoney(Math.abs(value))}`
const isoDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

function Figure({ label, value, strong, tone }: { label: ReactNode; value: ReactNode; strong?: boolean; tone?: 'success' | 'warning' | 'muted' }) {
    return (
        <div className={cn('flex items-baseline justify-between gap-4 border-t py-2', strong ? 'border-hairline-strong/50' : 'border-hairline/70')}>
            <dt className={cn('min-w-0', strong ? 'font-semibold text-ink' : 'text-body')}>{label}</dt>
            <dd
                className={cn(
                    'shrink-0 text-right tabular-nums',
                    strong ? 'font-bold text-ink' : 'font-medium text-ink',
                    tone === 'success' && 'text-[var(--wv-moss-700)]',
                    tone === 'warning' && 'text-[var(--wv-ochre-800)]',
                    tone === 'muted' && 'font-normal text-subtle',
                )}
            >
                {value}
            </dd>
        </div>
    )
}

export default function DispatchDetailDialog({
    challan: d,
    open,
    events,
    eventsLoading,
    busy,
    locked,
    error,
    onRetry,
    today,
    surface,
    onClose,
    onRefresh,
    onStart,
    onReceivedAsSent,
    onEditDraft,
    onReverseEntry,
}: {
    challan: Challan | null
    open: boolean
    events: ChallanEvent[]
    eventsLoading: boolean
    busy: boolean
    /** Busy, or a saved request still waiting for its retry. */
    locked: boolean
    error: string
    onRetry?: () => void
    today: string
    surface: ReturnType<typeof tourSurfaceProps>
    onClose: () => void
    onRefresh: () => void
    onStart: (action: ChallanMutation['action']) => void
    onReceivedAsSent: () => void
    onEditDraft: () => void
    onReverseEntry: (eventId: string) => void
}) {
    const { t } = useTranslation()
    const tx = (s: string, vars?: Record<string, string | number>) => t(`challan.${s}`, vars)
    return (
        <Dialog
            open={open && !!d}
            onOpenChange={(next) => {
                if (!next) onClose()
            }}
            {...surface.root}
        >
            <DialogContent
                data-i18n-skip="true"
                // Start on the dialog itself (announced by its title); its actions stay disabled while history loads.
                onOpenAutoFocus={(event) => {
                    event.preventDefault()
                    ;(event.currentTarget as HTMLElement | null)?.focus()
                }}
                {...surface.content}
                className="gap-0 sm:max-w-3xl"
            >
                {d && renderBody(d)}
            </DialogContent>
        </Dialog>
    )

    function renderBody(d: Challan) {
        const status = paymentStatus(d)
        const settlement = dispatchSettlement(d)
        const primary = dispatchPrimaryAction(d)
        const due = challanDueStatus(d, today)
        const balance = Number(d.balance)
        const isDraft = d.delivery_status === 'draft'
        const isReversed = d.delivery_status === 'reversed'
        const difference = d.acknowledged_meters === null ? null : Number(d.sent_meters) - Number(d.acknowledged_meters)
        const hasFinancialHistory = events.some((e) => FINANCIAL.includes(e.action))
        const canReverseDispatch = d.delivery_status === 'sent' && !hasFinancialHistory
        const reversedIds = new Set(events.map((e) => e.reverses_id).filter(Boolean))
        const documentEntries = Object.entries(d.document).filter(([k, v]) => v && !HIDDEN_FIELDS.includes(k))
        const detailGroups = [
            { title: 'senderAndDelivery', entries: PARTY_FIELDS.flatMap((k) => documentEntries.filter(([key]) => key === k)) },
            { title: 'optionalDetails', entries: documentEntries.filter(([k]) => !PARTY_FIELDS.includes(k)) },
        ].filter((group) => group.entries.length)
        const balanceLabel = isDraft ? tx('fabricValue') : balance < 0 ? tx('credit') : tx('balance')
        const headline = isDraft ? settlement.fabricValue : Math.abs(balance)
        const primaryButton = primary && (
            <Button
                className={cn('w-full rounded-lg sm:w-auto', control)}
                disabled={locked}
                onClick={() => (primary === 'receivedAsSent' ? onReceivedAsSent() : onStart(primary))}
            >
                {primary === 'payment' || primary === 'refund' ? <Banknote aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                {primary === 'confirm'
                    ? tx('confirm')
                    : primary === 'receivedAsSent'
                      ? tx('receivedAsSent')
                      : primary === 'payment'
                        ? tx('payment')
                        : tx('refund')}
            </Button>
        )
        const secondaryActions: ChallanMutation['action'][] = isDraft || isReversed
            ? []
            : [
                  'receipt',
                  ...(primary === 'payment' ? [] : (['payment'] as const)),
                  'adjustment',
                  'payment_terms',
                  ...(balance < 0 && primary !== 'refund' ? (['refund'] as const) : []),
              ]

        return (
            <>
                <DialogHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:pr-12">
                    <div className="min-w-0 space-y-1">
                        <DialogDescription className="text-xs text-subtle">
                            <span className="font-mono font-semibold tracking-[0.06em]">{d.number}</span>
                            {d.document.date && (
                                <>
                                    <span aria-hidden="true"> · </span>
                                    <time dateTime={d.document.date}>{formatDocumentDate(d.document.date)}</time>
                                </>
                            )}
                        </DialogDescription>
                        <DialogTitle className="text-xl font-bold leading-tight tracking-tight text-ink sm:text-2xl">
                            {d.document.customer_name}
                        </DialogTitle>
                        <p className="text-sm text-body">
                            <span className="font-semibold text-ink">{d.quality_label}</span>
                            <span aria-hidden="true" className="text-subtle/60"> · </span>
                            <span className="tabular-nums">{formatMeters(d.sent_meters)} m</span>
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <Badge variant={deliveryBadgeVariant(d.delivery_status)} className="border-current/10 text-[11px] font-semibold">
                                {tx(d.delivery_status)}
                            </Badge>
                            {!isDraft && !isReversed && (
                                <Badge variant={paymentBadgeVariant(status)} className="border-current/10 text-[11px] font-semibold">
                                    {tx(status)}
                                </Badge>
                            )}
                            {d.archived_at && (
                                <Badge variant="outline" className="text-[11px] font-semibold">
                                    {tx('archived')}
                                </Badge>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:max-w-[50%] sm:justify-end">
                        <Link
                            className={cn(
                                'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-hairline bg-surface px-3 text-sm font-semibold text-ink shadow-xs transition-colors hover:bg-surface-soft sm:flex-none',
                                control,
                            )}
                            target="_blank"
                            href={`/owner/dispatches/${d.id}/print`}
                        >
                            <Printer className="size-4 text-subtle" aria-hidden="true" />
                            {tx('print')}
                        </Link>
                        <Button
                            variant="ghost"
                            className={cn('flex-1 rounded-lg font-semibold text-body sm:flex-none', control)}
                            disabled={locked}
                            onClick={onRefresh}
                        >
                            <RefreshCw className={busy ? 'animate-spin' : undefined} aria-hidden="true" />
                            {tx('refresh')}
                        </Button>
                    </div>
                </DialogHeader>

                {['review', 'disputed'].includes(d.difference_status) && (
                    <p className="mt-4 flex items-center gap-2 rounded-lg border border-warning/25 bg-warning-soft/55 px-3 py-2 text-xs font-semibold text-warning">
                        <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                        {tx(d.difference_status)}
                    </p>
                )}
                {error && (
                    <p role="alert" className="mt-4 rounded-lg border border-risk/25 bg-risk-soft/55 p-3 text-sm font-medium text-risk">
                        {error}
                    </p>
                )}
                {onRetry && (
                    <Button variant="secondary" onClick={onRetry} className={cn('mt-3 w-full rounded-lg sm:w-fit', control)}>
                        {tx('retryButton')}
                    </Button>
                )}

                <section aria-label={balanceLabel} className="mt-5 rounded-xl bg-canvas px-4 py-4 sm:px-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-1.5">
                            <p className="text-xs font-semibold text-subtle">{balanceLabel}</p>
                            <p className="text-[1.75rem] font-bold leading-none tracking-tight tabular-nums text-ink">
                                {rupees(headline)}
                            </p>
                            {!isReversed && (
                                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-1 text-sm text-body">
                                    {balance <= 0 && !isDraft ? (
                                        <span className="font-semibold text-[var(--wv-moss-700)]">
                                            {balance < 0 ? tx('credit') : tx('paidInFull')}
                                        </span>
                                    ) : d.payment_due_date ? (
                                        <>
                                            <Clock className="size-3.5 shrink-0 text-subtle" aria-hidden="true" />
                                            <span className="sr-only">{tx('payment_due_date')}:</span>
                                            <time dateTime={d.payment_due_date} className="font-semibold text-ink">
                                                {formatDocumentDate(d.payment_due_date)}
                                            </time>
                                            {due && due.kind !== 'dueDateNotSet' && (
                                                <>
                                                    <span aria-hidden="true" className="text-subtle/60">·</span>
                                                    <span
                                                        className={cn(
                                                            'font-semibold',
                                                            due.kind === 'overdueDays' && 'text-[var(--wv-madder-600)]',
                                                            due.kind === 'dueToday' && 'text-[var(--wv-ochre-800)]',
                                                        )}
                                                    >
                                                        {tx(due.kind, { days: due.days })}
                                                    </span>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-subtle">{tx('dueDateNotSet')}</span>
                                    )}
                                </p>
                            )}
                            {d.payment_terms && (
                                <p className="break-words text-sm text-body">
                                    <span className="text-subtle">{tx('payment_terms')}:</span> {d.payment_terms}
                                </p>
                            )}
                        </div>
                        {isDraft ? (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <Button variant="outline" className={cn(secondary, 'w-full sm:w-auto')} disabled={locked} onClick={onEditDraft}>
                                    <Edit3 aria-hidden="true" />
                                    {tx('edit')}
                                </Button>
                                {primaryButton}
                            </div>
                        ) : (
                            primaryButton
                        )}
                    </div>
                    {!!settlement.paidShare && (
                        <div className="mt-4">
                            <div
                                role="progressbar"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={Math.round(settlement.paidShare * 100)}
                                aria-label={tx('paid')}
                                className="h-1.5 overflow-hidden rounded-full bg-surface-soft"
                            >
                                <div
                                    className="h-full rounded-full bg-[var(--wv-moss-700)] transition-[width] duration-200 motion-reduce:transition-none"
                                    style={{ width: `${settlement.paidShare * 100}%` }}
                                />
                            </div>
                            <p className="mt-1.5 text-xs tabular-nums text-subtle">
                                {tx('paidOf', { paid: rupees(d.paid_amount), total: rupees(settlement.billed) })}
                            </p>
                        </div>
                    )}
                </section>

                <div data-dispatch-tour="difference" className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                    <section aria-labelledby="dispatch-fabric-heading">
                        <h3 id="dispatch-fabric-heading" className="pb-2 text-xs font-semibold text-subtle">
                            {tx('fabricHeading')}
                        </h3>
                        <dl className="text-sm">
                            <Figure label={tx('sentMeters')} value={`${formatMeters(d.sent_meters)} m`} />
                            <Figure
                                label={tx('acknowledged')}
                                value={d.acknowledged_meters === null ? '—' : `${formatMeters(d.acknowledged_meters)} m`}
                                tone={d.acknowledged_meters === null ? 'muted' : undefined}
                            />
                            {difference !== null && (
                                <Figure
                                    label={tx('differenceMeters')}
                                    value={`${formatMeters(difference)} m`}
                                    tone={difference === 0 ? 'muted' : 'warning'}
                                />
                            )}
                            <Figure strong label={tx('chargeable')} value={`${formatMeters(d.chargeable_meters)} m`} />
                        </dl>
                        {!isReversed && difference !== null && difference !== 0 && (
                            <Button
                                variant="outline"
                                className={cn(secondary, 'mt-3 w-full sm:w-auto')}
                                disabled={locked}
                                onClick={() => onStart('resolve')}
                            >
                                <AlertTriangle className="text-[var(--wv-ochre-800)]" aria-hidden="true" />
                                {tx('resolve')}
                            </Button>
                        )}
                    </section>
                    <section aria-labelledby="dispatch-amount-heading">
                        <h3 id="dispatch-amount-heading" className="pb-2 text-xs font-semibold text-subtle">
                            {tx('amountHeading')}
                        </h3>
                        <dl className="text-sm">
                            <Figure
                                label={
                                    <span className="tabular-nums">
                                        {formatMeters(d.chargeable_meters)} m × ₹{formatMoney(d.selling_rate)}
                                    </span>
                                }
                                value={rupees(settlement.fabricValue)}
                            />
                            {Number(d.adjustment_amount) !== 0 && (
                                <Figure label={tx('adjustments')} value={signedRupees(d.adjustment_amount)} />
                            )}
                            {!isDraft && (
                                <Figure
                                    label={tx('paid')}
                                    value={Number(d.paid_amount) > 0 ? `−${rupees(d.paid_amount)}` : rupees(0)}
                                    tone={Number(d.paid_amount) > 0 ? 'success' : 'muted'}
                                />
                            )}
                            {!isDraft && <Figure strong label={balanceLabel} value={rupees(headline)} />}
                        </dl>
                    </section>
                </div>

                {(secondaryActions.length > 0 || canReverseDispatch) && (
                    <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
                        {secondaryActions.map((a) => (
                            <Button key={a} variant="outline" className={secondary} disabled={locked} onClick={() => onStart(a)}>
                                {a === 'receipt' && <Truck aria-hidden="true" />}
                                {tx(a === 'payment_terms' ? 'changePaymentTerms' : a)}
                            </Button>
                        ))}
                        {canReverseDispatch && (
                            <Button
                                variant="outline"
                                className={cn(secondary, 'text-[var(--wv-madder-600)] hover:bg-[var(--wv-madder-50)] hover:text-[var(--wv-madder-600)]')}
                                disabled={locked}
                                onClick={() => onStart('reverse_dispatch')}
                            >
                                <RotateCcw aria-hidden="true" />
                                {tx('reverse_dispatch')}
                            </Button>
                        )}
                    </div>
                )}

                <section aria-labelledby="dispatch-history-heading" className="mt-6">
                    <h3 id="dispatch-history-heading" className="text-sm font-bold text-ink">
                        {tx('audit')}
                    </h3>
                    {eventsLoading ? (
                        <div role="status" className="mt-3 space-y-3">
                            <span className="sr-only">{tx('historyLoading')}</span>
                            {[0, 1, 2].map((i) => (
                                <div key={i} aria-hidden="true" className="flex items-center gap-3">
                                    <span className="size-2.5 shrink-0 rounded-full bg-surface-soft" />
                                    <span className="h-3.5 flex-1 animate-pulse rounded bg-surface-soft motion-reduce:animate-none" />
                                </div>
                            ))}
                        </div>
                    ) : events.length === 0 ? (
                        <p className="mt-3 text-sm text-subtle">{tx('historyEmpty')}</p>
                    ) : (
                        <ol className="mt-3">
                            {[...events].reverse().map((e, index, list) =>
                                renderEntry(
                                    e,
                                    index === list.length - 1,
                                    reversedIds.has(e.id),
                                    e.reverses_id ? events.find((r) => r.id === e.reverses_id) : undefined,
                                ),
                            )}
                        </ol>
                    )}
                </section>

                <details className="ui-details group mt-6 border-t border-hairline">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 select-none [&::-webkit-details-marker]:hidden">
                        <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-ink">
                            <FileText className="size-4 shrink-0 text-subtle" aria-hidden="true" />
                            {tx('details')}
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-xs text-subtle">
                            <span className="tabular-nums">
                                {d.lines.length} {tx('lots')}
                            </span>
                            <ChevronDown className="size-4 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                        </span>
                    </summary>
                    <div className="space-y-5 pb-1 pt-1">
                        {detailGroups.map((group) => (
                            <section key={group.title}>
                                <h4 className="text-xs font-semibold text-subtle">{tx(group.title)}</h4>
                                <dl className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                                    {group.entries.map(([k, v]) => (
                                        <div key={k} className="min-w-0">
                                            <dt className="text-xs text-subtle">{tx(k)}</dt>
                                            <dd className="mt-0.5 break-words text-sm font-medium text-ink">
                                                {k === 'external_attachment' && safeEvidenceUrl(v) ? (
                                                    <a
                                                        className="inline-flex items-center gap-1 font-semibold text-loom underline"
                                                        href={safeEvidenceUrl(v)!}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        {tx('evidence')}
                                                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                                                    </a>
                                                ) : isoDate(v) ? (
                                                    formatDocumentDate(v)
                                                ) : (
                                                    v
                                                )}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            </section>
                        ))}
                        <section>
                            <h4 className="text-xs font-semibold text-subtle">{tx('lotEntry')}</h4>
                            <table className="mt-2 w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-subtle">
                                        <th scope="col" className="w-12 py-1.5 font-medium">{tx('rowNo')}</th>
                                        <th scope="col" className="py-1.5 font-medium">{tx('lot')}</th>
                                        <th scope="col" className="py-1.5 text-right font-medium">{tx('meters')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {d.lines.map((line, i) => (
                                        <tr key={i} className="border-t border-hairline/70">
                                            <td className="py-1.5 tabular-nums text-subtle">{i + 1}</td>
                                            <td className="break-all py-1.5 font-mono text-xs font-semibold text-ink">{line.lot}</td>
                                            <td className="py-1.5 text-right tabular-nums text-ink">{formatMeters(line.meters)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t border-hairline-strong/50">
                                        <th scope="row" colSpan={2} className="py-2 text-left font-semibold text-ink">
                                            {tx('totalSent')}
                                        </th>
                                        <td className="py-2 text-right font-bold tabular-nums text-ink">{formatMeters(d.sent_meters)} m</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </section>
                    </div>
                </details>
            </>
        )

        function renderEntry(e: ChallanEvent, last: boolean, reversed: boolean, original?: ChallanEvent) {
            const data = e.payload.data
            const reversible = FINANCIAL.includes(e.action) && !reversed && !isReversed
            const dot = e.action === 'payment' || e.action === 'refund'
                ? 'bg-[var(--wv-moss-700)]'
                : e.action.startsWith('reverse_')
                  ? 'bg-[var(--wv-madder-600)]'
                  : 'bg-hairline-strong/70'
            const notes = [isoDate(data.date) ? formatDocumentDate(String(data.date)) : data.date, data.method, data.reason]
                .filter(Boolean)
                .map(String)
                .join(' · ')
            return (
                <li key={e.id} className="relative grid grid-cols-[10px_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0">
                    <span aria-hidden="true" className="relative flex justify-center">
                        <span className={cn('mt-1.5 size-2.5 rounded-full', dot)} />
                        {!last && <span className="absolute bottom-[-4px] top-5 w-px bg-hairline" />}
                    </span>
                    <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                            <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-ink">
                                <span>{tx(dispatchEventLabelKey(e.action))}</span>
                                {e.amount !== null && (
                                    <span className={cn('tabular-nums', reversed && 'font-medium text-subtle line-through')}>
                                        {e.action === 'adjustment' ? signedRupees(e.amount) : rupees(e.amount)}
                                    </span>
                                )}
                                {reversed && <span className="text-xs font-semibold text-[var(--wv-madder-600)]">{tx('reversed')}</span>}
                            </p>
                            <time dateTime={e.created_at} className="text-xs tabular-nums text-subtle">
                                {formatDispatchEventTime(e.created_at)}
                            </time>
                        </div>
                        {e.action === 'receipt' && (
                            <p className="text-xs text-body">
                                {tx('acknowledged')}: <span className="font-semibold tabular-nums text-ink">{formatMeters(Number(data.meters))} m</span>
                            </p>
                        )}
                        {e.action === 'resolve' && <p className="text-xs text-body">{tx(String(data.decision))}</p>}
                        {e.action === 'payment_terms' && (
                            <div className="space-y-0.5 text-xs text-body">
                                <p>
                                    <span className="text-subtle">{tx('previousTerms')}:</span>{' '}
                                    {e.previous_terms?.payment_due_date ? formatDocumentDate(e.previous_terms.payment_due_date) : tx('dueDateNotSet')}
                                    {' · '}
                                    {e.previous_terms?.payment_terms || '—'}
                                </p>
                                <p>
                                    <span className="text-subtle">{tx('updatedTerms')}:</span>{' '}
                                    {isoDate(data.payment_due_date) ? formatDocumentDate(String(data.payment_due_date)) : tx('dueDateNotSet')}
                                    {' · '}
                                    {String(data.payment_terms || '—')}
                                </p>
                            </div>
                        )}
                        {original && (
                            <p className="text-xs text-body">
                                <span className="text-subtle">{tx('reverses')}:</span> {tx(dispatchEventLabelKey(original.action))}
                                {original.amount !== null && ` · ${rupees(original.amount)}`}
                            </p>
                        )}
                        {notes && <p className="break-words text-xs text-subtle">{notes}</p>}
                        {typeof data.evidence === 'string' && safeEvidenceUrl(data.evidence) && (
                            <a
                                className="inline-flex items-center gap-1 text-xs font-semibold text-loom underline"
                                href={safeEvidenceUrl(data.evidence)!}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {tx('evidence')}
                                <ArrowUpRight className="size-3" aria-hidden="true" />
                            </a>
                        )}
                        {reversible && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn('-ml-2 rounded-lg px-2 text-xs font-semibold text-[var(--wv-madder-600)] hover:bg-[var(--wv-madder-50)] hover:text-[var(--wv-madder-600)]', control)}
                                disabled={locked}
                                onClick={() => onReverseEntry(e.id)}
                            >
                                <RotateCcw className="size-3.5" aria-hidden="true" />
                                {tx('reverse_entry')}
                            </Button>
                        )}
                    </div>
                </li>
            )
        }
    }
}
