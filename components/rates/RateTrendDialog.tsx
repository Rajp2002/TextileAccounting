'use client'

import { useMemo, useRef } from 'react'
import { History, Loader2, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RateTrendChart } from '@/components/rates/RateTrendChart'
import { formatRateValue, getRatePriceDelta, type CostRateRow } from '@/lib/cost-rates'
import { formatDateOnly } from '@/lib/format'
import { useTranslation } from '@/lib/i18n/context'
import { buildRateTrend, type RateTrendRow } from '@/lib/rate-trend'
import { getSuratTodayString } from '@/lib/time'
import { cn } from '@/lib/utils'

const DATE_OPTIONS = { day: 'numeric', month: 'short', year: 'numeric' } as const

/**
 * The yarn's full recorded price history as a chart, from its first entry to today.
 * It shares the Activity sheet's history fetch; `onOpenActivity` switches to that
 * audit list without loading it again.
 */
export function RateTrendDialog({ rate, rows, loading, error, onClose, onOpenActivity }: {
    /** The yarn to chart; null keeps the modal closed. */
    rate: CostRateRow | null
    rows: RateTrendRow[]
    loading: boolean
    error: string | null
    onClose: () => void
    onOpenActivity: () => void
}) {
    const { tx } = useTranslation()
    const contentRef = useRef<HTMLDivElement>(null)
    const today = getSuratTodayString()
    const trend = useMemo(() => buildRateTrend(rows, today), [rows, today])
    const sinceFirst = trend ? getRatePriceDelta(trend.stats.latest, trend.stats.first, rate?.unit) : null

    return (
        <Dialog open={Boolean(rate)} onOpenChange={open => { if (!open) onClose() }}>
            {/* Focus the dialog itself on open. Left alone, Radix focuses the first chart point and pops its tooltip. */}
            <DialogContent
                ref={contentRef}
                className="sm:max-w-2xl"
                onOpenAutoFocus={event => { event.preventDefault(); contentRef.current?.focus() }}
            >
                <DialogHeader className="pr-10">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface-soft text-saffron-deep">
                            <History className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <DialogTitle className="break-words text-xl font-bold text-ink">{rate?.name}</DialogTitle>
                            <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
                                {tx('Price history')}
                                {trend && (
                                    <>
                                        {' · '}
                                        {formatDateOnly(trend.points[0].date, DATE_OPTIONS)}
                                        {' – '}
                                        {trend.endTime === Date.parse(`${today}T00:00:00Z`) ? tx('Today') : formatDateOnly(new Date(trend.endTime).toISOString(), DATE_OPTIONS)}
                                    </>
                                )}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {loading ? (
                    <div className="flex min-h-[18rem] items-center justify-center gap-2 text-sm text-subtle" role="status" aria-live="polite">
                        <Loader2 className="h-6 w-6 animate-spin text-saffron" aria-hidden="true" /> {tx('Loading price history…')}
                    </div>
                ) : error ? (
                    <div className="flex min-h-[18rem] items-center justify-center text-center text-sm font-medium text-destructive" role="alert">{error}</div>
                ) : !trend || !rate ? (
                    <div className="flex min-h-[18rem] items-center justify-center text-center text-sm text-subtle">{tx('No price history recorded yet.')}</div>
                ) : (
                    <div className="space-y-4">
                        <dl className="grid grid-cols-3 divide-x divide-hairline rounded-xl border border-hairline bg-surface-soft/50">
                            <div className="min-w-0 px-3 py-2.5">
                                <dt className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{tx('Current')}</dt>
                                <dd className="mt-1 break-words font-mono text-sm font-bold text-ink">{formatRateValue(trend.stats.latest, rate.unit)}</dd>
                            </div>
                            <div className="min-w-0 px-3 py-2.5">
                                <dt className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{tx('Since first entry')}</dt>
                                <dd className={cn(
                                    'mt-1 flex flex-wrap items-center gap-x-1 font-mono text-sm font-bold',
                                    sinceFirst?.direction === 'increased' && 'text-[var(--wv-ochre-800)]',
                                    sinceFirst?.direction === 'decreased' && 'text-[var(--wv-moss-700)]',
                                    (sinceFirst?.direction === 'unchanged' || sinceFirst?.direction === 'initial') && 'text-subtle',
                                )}>
                                    {sinceFirst?.direction === 'increased' && <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                                    {sinceFirst?.direction === 'decreased' && <TrendingDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                                    {(sinceFirst?.direction === 'unchanged' || sinceFirst?.direction === 'initial') && <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                                    {sinceFirst && (sinceFirst.direction === 'increased' || sinceFirst.direction === 'decreased')
                                        ? <><span>{sinceFirst.formattedDifference}</span>{sinceFirst.formattedPercent && <span className="text-xs font-semibold opacity-80">({sinceFirst.formattedPercent})</span>}</>
                                        : <span>{tx('No change')}</span>}
                                </dd>
                            </div>
                            <div className="min-w-0 px-3 py-2.5">
                                <dt className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{tx('Price changes')}</dt>
                                <dd className="mt-1 font-mono text-sm font-bold text-ink">{trend.stats.priceChanges}</dd>
                            </div>
                        </dl>

                        <RateTrendChart trend={trend} unit={rate.unit} yarnName={rate.name} />

                        {trend.points.length === 1 && (
                            <p className="text-center text-xs text-subtle">{tx('Only one price is recorded so far. The trend appears once this rate changes.')}</p>
                        )}
                    </div>
                )}

                <DialogFooter className="gap-2 sm:justify-between">
                    <Button variant="outline" onClick={onOpenActivity} disabled={loading || Boolean(error)}>
                        <History className="h-4 w-4" aria-hidden="true" /> {tx('Full activity')}
                    </Button>
                    <Button variant="outline" onClick={onClose}>{tx('Close')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
