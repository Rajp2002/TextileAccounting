'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Check, Circle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatGoLiveDate, type GoLiveReadiness } from '@/lib/base-go-live'
import { useTranslation } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

import { scheduleBaseGoLiveAction } from './actions'

function ReadinessLine({ done, children }: { done: boolean; children: React.ReactNode }) {
    return (
        <li className="flex items-start gap-2 text-sm text-body">
            {done
                ? <Check className="mt-0.5 size-4 shrink-0 text-[var(--wv-moss-700)]" aria-hidden="true" />
                : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
            <span className="min-w-0">{children}</span>
        </li>
    )
}

/**
 * The production overview while a factory is still setting up: when daily recording starts, a way to move that
 * date to a later pay-cycle start, and what is left to prepare. Before a date exists it offers the next cycle start.
 */
export default function BaseGoLiveSetupCard({ phase, goLive, options, readiness }: {
    phase: 'unscheduled' | 'setup'
    goLive: string | null
    options: string[]
    readiness: GoLiveReadiness | null
}) {
    const { t, language } = useTranslation()
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState('')
    const [choice, setChoice] = useState(goLive ?? options[0] ?? '')
    const label = (date: string) => formatGoLiveDate(date, language)

    function schedule(date: string) {
        setError('')
        startTransition(async () => {
            const result = await scheduleBaseGoLiveAction(date)
            if ('error' in result) setError(result.error)
            else router.refresh()
        })
    }

    if (phase === 'unscheduled' || !goLive) {
        const next = options[0]
        return (
            <section data-go-live-card className="rounded-2xl border border-hairline bg-surface p-5 shadow-xs">
                <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                    <CalendarClock className="size-5 text-muted-foreground" aria-hidden="true" />
                    {t('goLive.scheduleTitle')}
                </h2>
                {next && <p className="mt-2 text-sm text-body">{t('goLive.scheduleBody', { date: label(next) })}</p>}
                {next && (
                    <Button className="mt-4 min-h-[44px]" disabled={pending} onClick={() => schedule(next)}>
                        {t('goLive.scheduleAction', { date: label(next) })}
                    </Button>
                )}
                {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
            </section>
        )
    }

    const later = options.filter(option => option !== goLive)
    return (
        <section data-go-live-card className="rounded-2xl border border-hairline bg-surface p-5 shadow-xs">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                <CalendarClock className="size-5 text-muted-foreground" aria-hidden="true" />
                {t('goLive.setupCardTitle', { date: label(goLive) })}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-body">{t('goLive.setupCardBody', { date: label(goLive) })}</p>

            {readiness && (
                <ul className="mt-4 space-y-2">
                    <ReadinessLine done={readiness.loomsTotal > 0 && readiness.loomsWithQuality === readiness.loomsTotal}>
                        {t('goLive.readinessQualities', { count: readiness.loomsWithQuality, total: readiness.loomsTotal })}
                    </ReadinessLine>
                    <ReadinessLine done={readiness.staffed.day + readiness.staffed.night > 0}>
                        {t('goLive.readinessStaffed', { day: readiness.staffed.day, night: readiness.staffed.night, total: readiness.loomsTotal })}
                    </ReadinessLine>
                    <ReadinessLine done={readiness.legacy.state === 'fresh'}>
                        {readiness.legacy.state === 'fresh'
                            ? t('goLive.readinessLegacyFresh', { counted: label(readiness.legacy.countedOn!) })
                            : readiness.legacy.state === 'stale'
                                ? t('goLive.readinessLegacyStale', { counted: label(readiness.legacy.countedOn!), date: label(goLive) })
                                : t('goLive.readinessLegacyNone', { date: label(goLive) })}
                    </ReadinessLine>
                </ul>
            )}

            {later.length > 0 && (
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select value={choice} onValueChange={setChoice} disabled={pending}>
                        <SelectTrigger aria-label={t('goLive.changeDate')} className="min-h-[44px] sm:w-56">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {[goLive, ...later].map(option => <SelectItem key={option} value={option}>{label(option)}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" className={cn('min-h-[44px]')} disabled={pending || choice === goLive} onClick={() => schedule(choice)}>
                        {t('goLive.changeDate')}
                    </Button>
                </div>
            )}
            {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </section>
    )
}
