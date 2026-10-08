'use client'

import Link from 'next/link'
import { ArrowDown, ArrowUp, BarChart3, TrendingDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
    formatBaseMeters,
    type BaseLoomOutputRow,
    type BaseProductionDay,
    type BaseProductionDayComparison,
} from '@/lib/base-production-analytics'
import { useTranslation } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

// Yesterday is a taller muted frame and today a thinner solid bar centred in it. Whichever day
// is longer, the other's end still shows above and below the bar, so neither can hide the other.
const FRAME_HEIGHT = 20
const BAR_HEIGHT = 10

const percentFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1, signDisplay: 'exceptZero' })
const metersFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, signDisplay: 'exceptZero' })

function share(value: number, max: number) {
    return max > 0 && value > 0 ? Math.max(1, (value / max) * 100) : 0
}

function changeTone(change: number) {
    return change > 0 ? 'text-success' : change < 0 ? 'text-warning' : 'text-muted-foreground'
}

export default function BaseProductionLoomChart({
    rows,
    today,
    comparison,
    otherQualityMeters,
    dailySheetHref,
}: {
    rows: BaseLoomOutputRow[]
    today: BaseProductionDay
    comparison: BaseProductionDayComparison | null
    /** Metres today on qualities that are no longer active; they count in the total only. */
    otherQualityMeters: number
    dailySheetHref: string
}) {
    const { t } = useTranslation()
    const entered = today.hasSavedSheet
    const max = Math.max(0, ...rows.flatMap((row) => [row.todayMeters, row.yesterdayMeters]))
    const hasQualityAverage = rows.some((row) => row.peerAverage !== null)
    const hasLagging = rows.some((row) => row.lagging)

    const status = !entered
        ? t('production.notEnteredYet')
        : today.savedShifts.day && today.savedShifts.night
            ? t('production.shiftsSavedBoth')
            : today.savedShifts.day
                ? t('production.shiftsSavedDay')
                : today.savedShifts.night
                    ? t('production.shiftsSavedNight')
                    : t('production.recorded')

    return (
        <Card
            role="region"
            aria-label={t('production.loomOutputTitle')}
            className="gap-0 rounded-2xl border border-hairline bg-surface p-4 shadow-xs sm:p-5"
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <BarChart3 className="h-4 w-4" aria-hidden="true" />
                        <span data-i18n-skip="true">{t('production.todayProduction')}</span>
                    </div>
                    <p className="text-2xl font-black tracking-tight text-ink sm:text-3xl">
                        {entered ? formatBaseMeters(today.totalMeters) : '—'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground" data-i18n-skip="true">{status}</p>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground sm:text-right" data-i18n-skip="true">
                    {comparison && (entered && comparison.comparable ? (
                        <p className={cn('font-semibold', changeTone(comparison.deltaMeters))}>
                            {t('production.vsYesterday', {
                                change: comparison.deltaPercent !== null
                                    ? `${percentFormat.format(comparison.deltaPercent)}%`
                                    : `${metersFormat.format(comparison.deltaMeters)} m`,
                                meters: formatBaseMeters(comparison.previousMeters),
                            })}
                        </p>
                    ) : (
                        <p>{t('production.yesterdayTotal', { meters: formatBaseMeters(comparison.previousMeters) })}</p>
                    ))}
                    {otherQualityMeters > 0 && (
                        <p>{t('production.otherQualities', { meters: formatBaseMeters(otherQualityMeters) })}</p>
                    )}
                </div>
            </div>

            {rows.length === 0 ? (
                <p className="mt-5 rounded-xl bg-surface-soft/60 px-3 py-3 text-sm text-muted-foreground" data-i18n-skip="true">
                    {t('production.noLoomOutput')}
                </p>
            ) : (
                <>
                    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground" data-i18n-skip="true">
                        {entered && (
                            <span className="inline-flex items-center gap-1.5">
                                <span className="inline-block h-2.5 w-4 rounded-sm bg-ink" aria-hidden="true" />
                                {t('production.today')}
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block h-4 w-4 rounded-sm bg-ink/15" aria-hidden="true" />
                            {t('production.yesterday')}
                        </span>
                        {hasQualityAverage && (
                            <span className="inline-flex items-center gap-1.5">
                                <span className="inline-block h-4 w-px bg-muted-foreground/60" aria-hidden="true" />
                                {t('production.qualityAverage')}
                            </span>
                        )}
                        {hasLagging && (
                            <span className="inline-flex items-center gap-1.5">
                                <span className="inline-block h-2.5 w-4 rounded-sm bg-[var(--wv-ochre-400)]" aria-hidden="true" />
                                {t('production.belowQualityAverage')}
                            </span>
                        )}
                    </div>

                    {!entered && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-soft/60 px-3 py-2.5" data-i18n-skip="true">
                            <p className="text-sm text-body">{t('production.barsAppearWhenSaved')}</p>
                            <Button asChild variant="outline" size="sm">
                                <Link href={dailySheetHref}>{t('production.openDailySheet')}</Link>
                            </Button>
                        </div>
                    )}

                    <ul className="mt-3 divide-y divide-hairline/60">
                        {rows.map((row) => (
                            <li
                                key={row.machineId}
                                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-2 sm:grid-cols-[9rem_minmax(0,1fr)_7.5rem]"
                            >
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-ink" title={row.label}>{row.label}</p>
                                    <p className="truncate text-xs text-muted-foreground" title={row.qualityLabel ?? undefined}>
                                        {row.qualityLabel ?? '—'}
                                    </p>
                                    {row.lagging && (
                                        <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-warning" data-i18n-skip="true">
                                            <TrendingDown className="h-3 w-3" aria-hidden="true" />
                                            {t('production.belowAverage')}
                                        </p>
                                    )}
                                </div>

                                <div className="text-right sm:col-start-3 sm:row-start-1" data-i18n-skip="true">
                                    {entered ? (
                                        <>
                                            <p className="text-sm font-bold tabular-nums text-ink">{formatBaseMeters(row.todayMeters)}</p>
                                            {row.deltaPercent !== null && (
                                                <p className={cn('flex items-center justify-end gap-0.5 text-[11px] font-semibold tabular-nums', changeTone(row.deltaPercent))}>
                                                    {row.deltaPercent > 0 && <ArrowUp className="h-3 w-3" aria-hidden="true" />}
                                                    {row.deltaPercent < 0 && <ArrowDown className="h-3 w-3" aria-hidden="true" />}
                                                    {t('production.changeVsYday', { change: `${Math.abs(row.deltaPercent)}%` })}
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-sm font-semibold tabular-nums text-muted-foreground">{formatBaseMeters(row.yesterdayMeters)}</p>
                                            <p className="text-[11px] text-muted-foreground">{t('production.yesterday')}</p>
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
                                        className="absolute left-0 top-0 rounded-r-[5px] bg-ink/15"
                                        style={{ width: `${share(row.yesterdayMeters, max)}%`, height: FRAME_HEIGHT }}
                                    />
                                    {entered && (
                                        <div
                                            data-bar="today"
                                            className={cn('ui-meter-fill absolute left-0 rounded-r-[4px]', row.lagging ? 'bg-[var(--wv-ochre-400)]' : 'bg-ink')}
                                            style={{
                                                width: `${share(row.todayMeters, max)}%`,
                                                height: BAR_HEIGHT,
                                                top: (FRAME_HEIGHT - BAR_HEIGHT) / 2,
                                            }}
                                        />
                                    )}
                                    {row.peerAverage !== null && (
                                        <div
                                            className="absolute w-px bg-muted-foreground/60"
                                            style={{ left: `${share(row.peerAverage, max)}%`, top: -4, bottom: -4 }}
                                        />
                                    )}
                                </div>

                                <span className="sr-only">
                                    {`${row.label}: ${t('production.today')} ${formatBaseMeters(row.todayMeters)}, ${t('production.yesterday')} ${formatBaseMeters(row.yesterdayMeters)}`}
                                </span>
                            </li>
                        ))}
                    </ul>

                    <p className="mt-3 border-t border-hairline pt-3 text-xs text-muted-foreground" data-i18n-skip="true">
                        {entered ? t('production.rankedByToday') : t('production.rankedByYesterday')}
                    </p>
                </>
            )}
        </Card>
    )
}
