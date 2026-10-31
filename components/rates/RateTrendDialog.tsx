'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
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

/** The yarns offered in the modal's picker, one labelled group per section of the board. */
export type RateTrendGroup = { label: string; rates: CostRateRow[] }

/** A track's border (1px) and padding (4px) on each side, added to its options' widths. */
const TRACK_CHROME = 10
const OPTION_TEXT = 'whitespace-nowrap px-3 text-[13px] font-semibold'

/**
 * One section's yarns as a connected segmented track, like the board's direction
 * toggle. When the yarns don't fit on one line they wrap into further tracks, one
 * per line: a hidden copy of the options measures their widths and packs them.
 */
function YarnPickerGroup({ group, selectedId, onSelect }: {
    group: RateTrendGroup
    selectedId: string | null
    onSelect: (rate: CostRateRow) => void
}) {
    const areaRef = useRef<HTMLDivElement>(null)
    const measureRef = useRef<HTMLDivElement>(null)
    const [rows, setRows] = useState<CostRateRow[][] | null>(null)

    useLayoutEffect(() => {
        const area = areaRef.current
        const measure = measureRef.current
        if (!area || !measure) return
        const pack = () => {
            const available = area.clientWidth
            const widths = Array.from(measure.children, child => Math.ceil(child.getBoundingClientRect().width))
            const next: CostRateRow[][] = []
            let row: CostRateRow[] = []
            let used = TRACK_CHROME
            group.rates.forEach((option, index) => {
                if (row.length > 0 && used + widths[index] > available) {
                    next.push(row)
                    row = []
                    used = TRACK_CHROME
                }
                row.push(option)
                used += widths[index]
            })
            if (row.length > 0) next.push(row)
            const key = next.map(line => line.map(option => option.id).join(',')).join('|')
            setRows(current => current?.map(line => line.map(option => option.id).join(',')).join('|') === key ? current : next)
        }
        pack()
        // Re-pack when the modal resizes or the web font lands and the names change width.
        const observer = new ResizeObserver(pack)
        observer.observe(area)
        observer.observe(measure)
        return () => observer.disconnect()
    }, [group.rates])

    return (
        <div role="group" aria-label={group.label} className="flex items-start gap-2">
            <span className="flex h-10 w-11 shrink-0 items-center text-xs font-semibold text-subtle max-md:h-[54px]">{group.label}</span>
            <div ref={areaRef} className="relative min-w-0 flex-1 space-y-1.5">
                <div ref={measureRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 flex w-max">
                    {group.rates.map(option => <span key={option.id} className={OPTION_TEXT}>{option.name}</span>)}
                </div>
                {(rows ?? [group.rates]).map(line => (
                    <div
                        key={line[0].id}
                        className="flex w-fit max-w-full rounded-full border border-hairline bg-surface-soft p-1 shadow-[inset_0_1px_2px_rgba(22,33,62,0.08)]"
                    >
                        {line.map(option => {
                            const selected = option.id === selectedId
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => { if (!selected) onSelect(option) }}
                                    className={cn(
                                        OPTION_TEXT,
                                        'h-8 min-w-0 truncate rounded-full transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/70 max-md:min-h-[44px]',
                                        selected
                                            ? 'bg-loom text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_3px_8px_-3px_rgba(22,33,62,0.55)]'
                                            : 'text-ink hover:bg-surface',
                                    )}
                                >
                                    {option.name}
                                </button>
                            )
                        })}
                    </div>
                ))}
            </div>
        </div>
    )
}

/**
 * Every active yarn's price history in one place: pills pick a yarn, and its full
 * recorded history shows as a chart from its first entry to today. It shares the
 * Activity sheet's history fetch; `onOpenActivity` switches to that audit list
 * without loading it again.
 */
export function RateTrendDialog({ rate, groups, onSelectRate, rows, loading, error, onClose, onOpenActivity }: {
    /** The yarn to chart; null keeps the modal closed. */
    rate: CostRateRow | null
    groups: RateTrendGroup[]
    onSelectRate: (rate: CostRateRow) => void
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
                            <DialogTitle className="text-xl font-bold text-ink">{tx('Yarn rate activity')}</DialogTitle>
                            <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
                                {tx('Pick a yarn to see how its price has moved.')}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* One connected track per section, grouped like the board; the chosen yarn is filled navy.
                    It grows with its rows; the dialog scrolls as a whole once it outgrows the screen. */}
                <div data-ratebook-field="activityYarnPicker" className="space-y-2">
                    {groups.filter(group => group.rates.length > 0).map(group => (
                        <YarnPickerGroup key={group.label} group={group} selectedId={rate?.id ?? null} onSelect={onSelectRate} />
                    ))}
                </div>

                {rate && (
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <h3 className="min-w-0 break-words text-base font-semibold text-ink">{rate.name}</h3>
                        {trend && !loading && !error && (
                            <p className="text-[13px] tabular-nums text-muted-foreground">
                                {formatDateOnly(trend.points[0].date, DATE_OPTIONS)}
                                {' – '}
                                {trend.endTime === Date.parse(`${today}T00:00:00Z`) ? tx('Today') : formatDateOnly(new Date(trend.endTime).toISOString(), DATE_OPTIONS)}
                            </p>
                        )}
                    </div>
                )}

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
                                <dt className="text-xs font-semibold text-subtle">{tx('Current')}</dt>
                                <dd className="mt-1 break-words font-mono text-sm font-bold text-ink">{formatRateValue(trend.stats.latest, rate.unit)}</dd>
                            </div>
                            <div className="min-w-0 px-3 py-2.5">
                                <dt className="text-xs font-semibold text-subtle">{tx('Since first entry')}</dt>
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
                                <dt className="text-xs font-semibold text-subtle">{tx('Price changes')}</dt>
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
