'use client'

import type { ReactNode } from 'react'

import {
    formatBaseMeters,
    type BaseProductionDay,
    type BaseProductionDayComparison,
} from '@/lib/base-production-analytics'
import { useTranslation } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

const DATE_LOCALES = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN' } as const

const metresFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })
const percentFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1, signDisplay: 'exceptZero' })
const deltaMetresFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, signDisplay: 'exceptZero' })

function formatBandDate(date: string, language: keyof typeof DATE_LOCALES) {
    const [year, month, day] = date.split('-').map(Number)
    if (![year, month, day].every(Number.isFinite)) return date
    return new Intl.DateTimeFormat(DATE_LOCALES[language] ?? 'en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)))
}

function ShiftState({ saved, children }: { saved: boolean; children: ReactNode }) {
    return (
        <span className="inline-flex items-center gap-2">
            <span
                aria-hidden="true"
                className={cn('size-2 rounded-full', saved ? 'bg-[var(--wv-moss-700)]' : 'border-[1.5px] border-muted-foreground/70')}
            />
            {children}
        </span>
    )
}

function Fact({ label, value, children, className }: { label: string; value: ReactNode; children: ReactNode; className?: string }) {
    return (
        <div className={cn('flex min-w-0 flex-col p-5 sm:p-6', className)}>
            <p className="text-sm font-medium text-muted-foreground" data-i18n-skip="true">{label}</p>
            <p className="mt-2 text-3xl font-semibold leading-none tracking-[-0.025em] text-ink tabular-nums" data-i18n-skip="true">{value}</p>
            <div className="mt-auto pt-4 text-sm text-muted-foreground" data-i18n-skip="true">{children}</div>
        </div>
    )
}

/**
 * The top of the Production overview: today's metres, how they compare with yesterday, and how
 * much of the factory is weaving. It carries the tour's overview anchor.
 */
export default function BaseProductionTodayBand({
    today,
    comparison,
    otherQualityMeters,
    runningLooms,
    activeLooms,
    workersOnLooms,
}: {
    today: BaseProductionDay
    comparison: BaseProductionDayComparison | null
    /** Metres today on qualities that are no longer active; they count in the total only. */
    otherQualityMeters: number
    runningLooms: number
    activeLooms: number
    workersOnLooms: number
}) {
    const { t, language } = useTranslation()
    const entered = today.hasSavedSheet
    const idleLooms = Math.max(0, activeLooms - runningLooms)
    const runningShare = activeLooms > 0 ? Math.round((runningLooms / activeLooms) * 100) : 0

    return (
        <section
            data-production-tour="overview"
            aria-label={t('production.todayProduction')}
            className="grid grid-cols-2 overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]"
        >
            <div className="col-span-2 border-b border-hairline p-5 sm:p-6 lg:col-span-1 lg:border-b-0">
                <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground" data-i18n-skip="true">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-saffron" />
                    {t('production.todayProduction')} · {formatBandDate(today.date, language)}
                </p>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">
                    <p className="text-5xl font-semibold leading-none tracking-[-0.035em] text-ink tabular-nums" data-i18n-skip="true">
                        {entered ? (
                            <>
                                {metresFormat.format(today.totalMeters)}
                                <span className="ml-1.5 text-2xl font-medium tracking-normal text-muted-foreground">m</span>
                            </>
                        ) : '—'}
                    </p>
                    {comparison && (entered && comparison.comparable ? (
                        <p
                            className={cn(
                                'text-sm font-semibold tabular-nums',
                                comparison.deltaMeters > 0 ? 'text-success' : comparison.deltaMeters < 0 ? 'text-warning' : 'text-muted-foreground',
                            )}
                            data-i18n-skip="true"
                        >
                            {t('production.vsYesterday', {
                                change: comparison.deltaPercent !== null
                                    ? `${percentFormat.format(comparison.deltaPercent)}%`
                                    : `${deltaMetresFormat.format(comparison.deltaMeters)} m`,
                                meters: formatBaseMeters(comparison.previousMeters),
                            })}
                        </p>
                    ) : (
                        <p className="text-sm text-muted-foreground tabular-nums" data-i18n-skip="true">
                            {t('production.yesterdayTotal', { meters: formatBaseMeters(comparison.previousMeters) })}
                        </p>
                    ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-body" data-i18n-skip="true">
                    {!entered ? (
                        <ShiftState saved={false}>{t('production.notEnteredYet')}</ShiftState>
                    ) : today.savedShifts.day || today.savedShifts.night ? (
                        <>
                            <ShiftState saved={today.savedShifts.day}>
                                {t(today.savedShifts.day ? 'production.dayShiftSaved' : 'production.dayShiftPending')}
                            </ShiftState>
                            <ShiftState saved={today.savedShifts.night}>
                                {t(today.savedShifts.night ? 'production.nightShiftSaved' : 'production.nightShiftPending')}
                            </ShiftState>
                        </>
                    ) : (
                        <ShiftState saved>{t('production.recorded')}</ShiftState>
                    )}
                </div>
                {otherQualityMeters > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground" data-i18n-skip="true">
                        {t('production.otherQualities', { meters: formatBaseMeters(otherQualityMeters) })}
                    </p>
                )}
            </div>

            <Fact
                label={t('production.loomsRunning')}
                value={<>{runningLooms}<span className="ml-1.5 text-base font-medium tracking-normal text-muted-foreground">/ {activeLooms}</span></>}
                className="border-r border-hairline lg:border-l lg:border-r-0"
            >
                <div aria-hidden="true" className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-soft">
                    <div className="ui-meter-fill h-full rounded-full bg-ink" style={{ width: `${runningShare}%` }} />
                </div>
                {activeLooms === 0
                    ? t('production.noActiveLooms')
                    : idleLooms === 0
                        ? t('production.noIdleLooms')
                        : t('production.idleLooms', { count: idleLooms })}
            </Fact>

            <Fact label={t('production.workersOnLooms')} value={workersOnLooms} className="lg:border-l lg:border-hairline">
                {t('production.workersOnLoomsNote')}
            </Fact>
        </section>
    )
}
