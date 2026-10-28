'use client'

import type { ReactNode } from 'react'
import { Check, CheckCircle2, ClipboardCheck, Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { railPrimaryAction } from '@/components/ui/rail'
import { formatRateValue, type CostRateRow } from '@/lib/cost-rates'
import { fillCopy } from '@/lib/i18n/fill'
import { rateBookBoardText } from '@/lib/i18n/rate-book-board'
import { useTranslation } from '@/lib/i18n/context'
import { rateDateLabel, reviewOutcome, type RateReviewSession } from '@/lib/rate-book-board'
import { cn } from '@/lib/utils'

/**
 * The prices due for a check, one row each: confirm the price if the supplier still charges it, or edit it.
 * A checked row stays in place, marked done, so the list never jumps while the owner works down it.
 */
export function RateReviewDialog({ session, rates, dueCount, isDue, dueStatus, usage, pendingId, busy, onConfirm, onEdit, onConfirmAll, onClose }: {
    /** The review in progress; null keeps the modal closed. */
    session: RateReviewSession | null
    rates: CostRateRow[]
    /** Every price due now; Confirm All confirms all of them, so it shows only while this list holds them all. */
    dueCount: number
    isDue: (rate: CostRateRow) => boolean
    dueStatus: (rate: CostRateRow) => string
    usage: (rate: CostRateRow) => ReactNode
    /** The rate being confirmed, or 'all-review' while Confirm All runs. */
    pendingId: string | null
    busy: boolean
    onConfirm: (rate: CostRateRow) => void
    onEdit: (rate: CostRateRow) => void
    onConfirmAll: () => void
    onClose: () => void
}) {
    const { tx, language } = useTranslation()
    const copy = rateBookBoardText[language]
    const items = (session?.ids ?? []).flatMap(id => {
        const rate = rates.find(candidate => candidate.id === id)
        const before = session?.before[id]
        return rate && before ? [{ rate, before, outcome: reviewOutcome(rate, before, isDue(rate)) }] : []
    })
    const waiting = items.filter(item => item.outcome === 'waiting').length
    const checked = items.length - waiting
    const finished = items.length > 0 && waiting === 0

    return (
        <Dialog open={Boolean(session)} onOpenChange={open => { if (!open && !busy) onClose() }}>
            <DialogContent data-ratebook-field="reviewDialog" data-i18n-skip="true" lang={language} className="sm:max-w-2xl">
                <DialogHeader className="pr-10">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface-soft text-[var(--wv-ochre-800)]">
                            <ClipboardCheck className="size-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <DialogTitle className="text-xl font-bold text-ink">{copy.review}</DialogTitle>
                            <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
                                {fillCopy(copy.queueHint, { edit: `“${tx('Edit rate')}”` })}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-2">
                    <p role="status" aria-live="polite" className={cn('flex items-center gap-1.5 text-[13px] font-medium tabular-nums', finished ? 'text-[var(--wv-moss-700)]' : 'text-body')}>
                        {finished && <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />}
                        {finished ? copy.allCurrent : fillCopy(copy.reviewProgress, { done: checked, n: items.length })}
                    </p>
                    <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-surface-soft">
                        <div
                            className="h-full rounded-full bg-[var(--wv-moss-700)] transition-[width] duration-300 ease-out motion-reduce:transition-none"
                            style={{ width: `${items.length ? (checked / items.length) * 100 : 0}%` }}
                        />
                    </div>
                </div>

                <ul className="max-h-[55vh] divide-y divide-hairline overflow-y-auto rounded-xl border border-hairline">
                    {items.map(({ rate, before, outcome }) => {
                        if (outcome !== 'waiting') {
                            return (
                                <li key={rate.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 animate-in fade-in-0 duration-200 sm:px-5">
                                    <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--wv-moss-50)] text-[var(--wv-moss-700)]">
                                        <Check className="size-4" strokeWidth={2.5} />
                                    </span>
                                    <p className="min-w-0 flex-1 break-words text-sm font-medium text-body">{rate.name}</p>
                                    <p className="text-[13px] font-medium tabular-nums text-[var(--wv-moss-700)]">
                                        {outcome === 'changed'
                                            ? fillCopy(copy.changedTo, { from: formatRateValue(before.value, rate.unit), to: formatRateValue(rate.current_value, rate.unit) })
                                            : fillCopy(copy.confirmedAt, { price: formatRateValue(rate.current_value, rate.unit) })}
                                    </p>
                                </li>
                            )
                        }
                        const confirming = pendingId === rate.id
                        return (
                            <li key={rate.id} data-ratebook-row-id={rate.id} className="p-4 sm:px-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="break-words font-semibold leading-snug text-ink">
                                            {rate.name}
                                            <span className="ml-2 text-[13px] font-medium text-muted-foreground">{rate.category === 'yarn_warp' ? copy.warp : copy.weft}</span>
                                        </p>
                                        <div className="mt-1">{usage(rate)}</div>
                                    </div>
                                    <p className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--wv-ochre-800)]">{dueStatus(rate)}</p>
                                </div>
                                <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
                                    <div className="min-w-0">
                                        <p className="text-xl font-semibold leading-tight tracking-[-0.01em] text-ink tabular-nums">
                                            {fillCopy(copy.stillPrice, { price: formatRateValue(rate.current_value, rate.unit) })}
                                        </p>
                                        <p className="mt-1 text-[13px] tabular-nums text-muted-foreground">
                                            {rate.is_reviewed === false ? copy.notConfirmed : fillCopy(copy.confirmedOn, { date: rateDateLabel(rate.last_reviewed_at, language) })}
                                        </p>
                                    </div>
                                    <div className="flex w-full gap-2 sm:w-auto" role="group" aria-label={tx('Actions')}>
                                        <Button
                                            data-ratebook-field="reviewEditAction"
                                            variant="outline"
                                            onClick={() => onEdit(rate)}
                                            disabled={busy}
                                            aria-label={`Edit rate for ${rate.name}`}
                                            className="h-10 flex-1 rounded-lg border-hairline font-semibold shadow-xs max-md:min-h-[44px] sm:flex-none"
                                        >
                                            <Pencil className="h-4 w-4" aria-hidden="true" />{tx('Edit rate')}
                                        </Button>
                                        <Button
                                            data-ratebook-field="quickReviewAction"
                                            onClick={() => onConfirm(rate)}
                                            disabled={busy}
                                            aria-label={`${copy.confirm}: ${rate.name}`}
                                            className={cn(railPrimaryAction, 'flex-1 sm:flex-none')}
                                        >
                                            {confirming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />}
                                            {confirming ? tx('Confirming…') : copy.confirm}
                                        </Button>
                                    </div>
                                </div>
                            </li>
                        )
                    })}
                </ul>

                <DialogFooter className="gap-2 sm:justify-between">
                    {waiting > 1 && waiting === dueCount ? (
                        <Button data-ratebook-field="confirmAll" variant="outline" onClick={onConfirmAll} disabled={busy} className="border-hairline font-semibold shadow-xs">
                            {pendingId === 'all-review' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                            {pendingId === 'all-review' ? tx('Confirming…') : tx(`Confirm All (${waiting}) as Current`)}
                        </Button>
                    ) : <span className="hidden sm:block" />}
                    {finished
                        ? <Button onClick={onClose} className={railPrimaryAction}>{copy.done}</Button>
                        : <Button variant="outline" onClick={onClose} disabled={busy} className="border-hairline font-semibold shadow-xs">{tx('Close')}</Button>}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
