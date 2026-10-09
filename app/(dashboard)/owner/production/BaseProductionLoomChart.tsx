'use client'

import Link from 'next/link'
import { ArrowDown, ArrowRight, ArrowUp, TrendingDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
    formatBaseMeters,
    type BaseLoomOutputRow,
    type BaseProductionDay,
} from '@/lib/base-production-analytics'
import { useTranslation } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

// Yesterday is a taller muted frame and today a thinner solid bar centred in it. Whichever day
// is longer, the other's end still shows above and below the bar, so neither can hide the other.
const FRAME_HEIGHT = 16
const BAR_HEIGHT = 8

function share(value: number, max: number) {
    return max > 0 && value > 0 ? Math.max(1, (value / max) * 100) : 0
}

function changeTone(change: number) {
    return change > 0 ? 'text-success' : change < 0 ? 'text-warning' : 'text-muted-foreground'
}

export default function BaseProductionLoomChart({
    rows,
    today,
    dailySheetHref,
}: {
    rows: BaseLoomOutputRow[]
    today: BaseProductionDay
    dailySheetHref: string
}) {
    const { t } = useTranslation()
    const entered = today.hasSavedSheet
    const max = Math.max(0, ...rows.flatMap((row) => [row.todayMeters, row.yesterdayMeters]))
    const hasQualityAverage = rows.some((row) => row.peerAverage !== null)
    const hasLagging = rows.some((row) => row.lagging)
    // Wide screens read the ranking down the first column, then the second, so bars stay a readable length.
    const half = Math.ceil(rows.length / 2)
    const columns = rows.length > 1 ? [rows.slice(0, half), rows.slice(half)] : [rows]

    function renderRow(row: BaseLoomOutputRow) {
        return (
            <li
                key={row.machineId}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[9rem_minmax(0,1fr)_7.5rem]"
            >
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink" title={row.label}>{row.label}</p>
                    <p className="truncate text-xs text-muted-foreground" title={row.qualityLabel ?? undefined}>
                        {row.qualityLabel ?? '—'}
                    </p>
                    {row.lagging && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-warning" data-i18n-skip="true">
                            <TrendingDown className="size-3" aria-hidden="true" />
                            {t('production.belowAverage')}
                        </p>
                    )}
                </div>

                <div className="text-right sm:col-start-3 sm:row-start-1" data-i18n-skip="true">
                    {entered ? (
                        <>
                            <p className="text-sm font-semibold tabular-nums text-ink">{formatBaseMeters(row.todayMeters)}</p>
                            {row.deltaPercent !== null && (
                                <p className={cn('flex items-center justify-end gap-0.5 text-xs font-medium tabular-nums', changeTone(row.deltaPercent))}>
                                    {row.deltaPercent > 0 && <ArrowUp className="size-3" aria-hidden="true" />}
                                    {row.deltaPercent < 0 && <ArrowDown className="size-3" aria-hidden="true" />}
                                    {t('production.changeVsYday', { change: `${Math.abs(row.deltaPercent)}%` })}
                                </p>
                            )}
                        </>
                    ) : (
                        <>
                            <p className="text-sm font-medium tabular-nums text-muted-foreground">{formatBaseMeters(row.yesterdayMeters)}</p>
                            <p className="text-xs text-muted-foreground">{t('production.yesterday')}</p>
                        </>
                    )}
                </div>

                <div
                    className="relative col-span-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"
                    style={{ height: FRAME_HEIGHT }}
                    aria-hidden="true"
                    title={`${row.label}: ${formatBaseMeters(row.todayMeters)} / ${formatBaseMeters(row.yesterdayMeters)}`}
                >
                    <div
                        data-bar="yesterday"
                        className="absolute left-0 top-0 rounded-full bg-wv-cotton-300/75"
                        style={{ width: `${share(row.yesterdayMeters, max)}%`, height: FRAME_HEIGHT }}
                    />
                    {entered && (
                        <div
                            data-bar="today"
                            className={cn('ui-meter-fill absolute left-0 rounded-full', row.lagging ? 'bg-[var(--wv-ochre-400)]' : 'bg-ink')}
                            style={{
                                width: `${share(row.todayMeters, max)}%`,
                                height: BAR_HEIGHT,
                                top: (FRAME_HEIGHT - BAR_HEIGHT) / 2,
                            }}
                        />
                    )}
                    {row.peerAverage !== null && (
                        <div
                            className="absolute w-0.5 rounded-full bg-muted-foreground/60"
                            style={{ left: `${share(row.peerAverage, max)}%`, top: -3, bottom: -3 }}
                        />
                    )}
                </div>

                <span className="sr-only">
                    {`${row.label}: ${t('production.today')} ${formatBaseMeters(row.todayMeters)}, ${t('production.yesterday')} ${formatBaseMeters(row.yesterdayMeters)}`}
                </span>
            </li>
        )
    }

    return (
        <section aria-labelledby="production-loom-output-title" className="space-y-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-baseline lg:justify-between">
                <h2 id="production-loom-output-title" className="text-lg font-semibold text-ink" data-i18n-skip="true">
                    {t('production.loomOutputTitle')}
                </h2>
                {rows.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground" data-i18n-skip="true">
                        {entered && (
                            <span className="inline-flex items-center gap-1.5">
                                <span className="inline-block h-2 w-4 rounded-full bg-ink" aria-hidden="true" />
                                {t('production.today')}
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block h-3 w-4 rounded-full bg-wv-cotton-300/75" aria-hidden="true" />
                            {t('production.yesterday')}
                        </span>
                        {hasQualityAverage && (
                            <span className="inline-flex items-center gap-1.5">
                                <span className="inline-block h-3 w-0.5 rounded-full bg-muted-foreground/60" aria-hidden="true" />
                                {t('production.qualityAverage')}
                            </span>
                        )}
                        {hasLagging && (
                            <span className="inline-flex items-center gap-1.5">
                                <span className="inline-block h-2 w-4 rounded-full bg-[var(--wv-ochre-400)]" aria-hidden="true" />
                                {t('production.belowQualityAverage')}
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
                {rows.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-muted-foreground sm:px-6" data-i18n-skip="true">
                        {t('production.noLoomOutput')}
                    </p>
                ) : (
                    <>
                        {!entered && (
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-surface-soft/40 px-4 py-3 sm:px-6" data-i18n-skip="true">
                                <p className="text-sm text-body">{t('production.barsAppearWhenSaved')}</p>
                                <Button asChild variant="outline" className="min-h-[44px] rounded-lg md:min-h-0">
                                    <Link href={dailySheetHref}>{t('production.openDailySheet')}</Link>
                                </Button>
                            </div>
                        )}

                        <div className={cn('grid', columns.length > 1 && 'xl:grid-cols-2 xl:divide-x xl:divide-hairline')}>
                            {columns.map((column, index) => (
                                <ul
                                    key={index}
                                    className={cn(
                                        'divide-y divide-hairline/60 px-4 sm:px-6',
                                        index > 0 && 'border-t border-hairline/60 xl:border-t-0',
                                    )}
                                >
                                    {column.map(renderRow)}
                                </ul>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-hairline px-4 text-xs text-muted-foreground sm:px-6" data-i18n-skip="true">
                            <p className="py-3">{entered ? t('production.rankedByToday') : t('production.rankedByYesterday')}</p>
                            {entered && (
                                <Link
                                    href={dailySheetHref}
                                    className="inline-flex min-h-[44px] items-center gap-1 font-medium text-ink underline-offset-4 hover:underline md:min-h-10"
                                >
                                    {t('production.openDailySheet')}
                                    <ArrowRight className="size-3.5" aria-hidden="true" />
                                </Link>
                            )}
                        </div>
                    </>
                )}
            </div>
        </section>
    )
}
