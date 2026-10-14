'use client'

import { Check } from 'lucide-react'
import type { BaseSalaryLine } from '@/lib/base-salary'
import { formatINR } from '@/lib/finance'
import { useTranslation } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

type Props = {
    lines: BaseSalaryLine[]
    /** A paid period is shown read-only. */
    locked: boolean
    pendingDates?: ReadonlySet<string>
    error?: string | null
    /** Omit to render read-only, for example in a tour sample. */
    onToggle?: (date: string, off: boolean) => void
}

type DayState = 'present' | 'off' | 'outside'

const LOCALES = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN' } as const
// 2026-10-05 is a Monday; the grid starts each week on Monday.
const WEEKDAY_SAMPLE = Array.from({ length: 7 }, (_, index) => new Date(Date.UTC(2026, 9, 5 + index)))

function iso(date: Date) { return date.toISOString().slice(0, 10) }
function salary(amount: number) { return formatINR(amount, { hideDecimals: true }) }

/** Every calendar month the salary lines touch, oldest first. */
function monthsOf(lines: BaseSalaryLine[]) {
    const keys = [...new Set(lines.map(line => line.start.slice(0, 7)))].sort()
    return keys.map(key => {
        const [year, month] = key.split('-').map(Number)
        const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
        return {
            key,
            first: new Date(Date.UTC(year, month - 1, 1)),
            dates: Array.from({ length: days }, (_, index) => iso(new Date(Date.UTC(year, month - 1, index + 1)))),
            lines: lines.filter(line => line.start.slice(0, 7) === key),
        }
    })
}

/**
 * A fixed-salary worker's pay period as an attendance calendar. Every employed day up to the period
 * end is worked unless the owner marked it off; the owner taps a day to switch it.
 */
export default function BaseStaffAttendanceCalendar({ lines, locked, pendingDates, error, onToggle }: Props) {
    const { tx, language } = useTranslation()
    const locale = LOCALES[language as keyof typeof LOCALES] ?? LOCALES.en
    const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' })
    const dayLabel = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' })
    const offDates = new Set(lines.flatMap(line => line.offDates))
    const editable = !locked && Boolean(onToggle)
    const total = lines.reduce((sum, line) => sum + line.grossPay, 0)

    const stateOf = (date: string): DayState => {
        if (!lines.some(line => line.start <= date && date <= line.end)) return 'outside'
        return offDates.has(date) ? 'off' : 'present'
    }

    return (
        <div className="space-y-5" data-staff-attendance-calendar>
            {monthsOf(lines).map(month => {
                const leading = (month.first.getUTCDay() + 6) % 7
                return (
                    <section key={month.key} className="space-y-2" aria-label={monthLabel.format(month.first)}>
                        <div className="flex items-baseline justify-between gap-3">
                            <h3 className="text-sm font-bold text-ink">{monthLabel.format(month.first)}</h3>
                            <span className="text-sm font-semibold text-ink tabular-nums">{formatINR(month.lines.reduce((sum, line) => sum + line.grossPay, 0))}</span>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center">
                            {WEEKDAY_SAMPLE.map(day => (
                                <span key={day.toISOString()} aria-hidden className="pb-1 text-[11px] font-semibold uppercase text-muted-foreground">{weekday.format(day)}</span>
                            ))}
                            {Array.from({ length: leading }, (_, index) => <span key={`blank-${index}`} data-day-blank aria-hidden />)}
                            {month.dates.map(date => {
                                const state = stateOf(date)
                                const day = Number(date.slice(8))
                                const cell = 'flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-lg text-sm tabular-nums'
                                if (state === 'outside' || !editable) {
                                    return (
                                        <span key={date} data-day-state={state} className={cn(cell,
                                            state === 'outside' && 'text-placeholder',
                                            state === 'present' && 'border border-hairline bg-surface text-ink',
                                            state === 'off' && 'border border-dashed border-hairline-strong bg-surface-soft text-muted-foreground',
                                        )}>
                                            <DayContent day={day} state={state} offLabel={tx('Off')} />
                                        </span>
                                    )
                                }
                                const pending = pendingDates?.has(date) ?? false
                                return (
                                    <button
                                        key={date}
                                        type="button"
                                        data-day-state={state}
                                        aria-pressed={state === 'off'}
                                        aria-busy={pending || undefined}
                                        disabled={pending}
                                        aria-label={state === 'off'
                                            ? tx('{date}: off. Tap to mark worked.', { date: dayLabel.format(new Date(`${date}T00:00:00Z`)) })
                                            : tx('{date}: worked. Tap to mark off.', { date: dayLabel.format(new Date(`${date}T00:00:00Z`)) })}
                                        onClick={() => onToggle?.(date, state !== 'off')}
                                        className={cn(cell, 'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
                                            state === 'present' && 'border border-hairline bg-surface text-ink hover:bg-surface-soft',
                                            state === 'off' && 'border border-dashed border-hairline-strong bg-surface-soft text-muted-foreground hover:bg-surface-muted',
                                        )}
                                    >
                                        <DayContent day={day} state={state} offLabel={tx('Off')} />
                                    </button>
                                )
                            })}
                        </div>
                        {month.lines.map(line => (
                            <div key={line.start} className="space-y-0.5 text-sm text-body">
                                {month.lines.length > 1 && (
                                    <p className="text-xs font-semibold text-muted-foreground">{dayLabel.format(new Date(`${line.start}T00:00:00Z`))} – {dayLabel.format(new Date(`${line.end}T00:00:00Z`))}</p>
                                )}
                                <p>{tx('{salary} ÷ {monthDays} days ≈ {dayRate} a day', { salary: salary(line.monthlySalary), monthDays: line.monthDays, dayRate: formatINR(line.dayRate) })}</p>
                                <p className="font-semibold text-ink tabular-nums">
                                    {[tx('{days} days worked', { days: line.days }), line.offDays > 0 ? tx('{count} off', { count: line.offDays }) : null]
                                        .filter(Boolean).join(' · ')} → {formatINR(line.grossPay)}
                                </p>
                            </div>
                        ))}
                    </section>
                )
            })}
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <div className="flex items-baseline justify-between gap-3 border-t border-hairline pt-3">
                <span className="text-xs text-muted-foreground">{locked ? tx('Paid · days locked') : editable ? tx('Tap a day to mark it off.') : null}</span>
                <span className="text-base font-bold text-ink tabular-nums">{tx('Total')} {formatINR(total)}</span>
            </div>
        </div>
    )
}

function DayContent({ day, state, offLabel }: { day: number; state: DayState; offLabel: string }) {
    return (
        <>
            <span className={cn('leading-none', state === 'off' && 'line-through')}>{day}</span>
            {state === 'present' && <Check aria-hidden className="h-3.5 w-3.5 text-factory-green" strokeWidth={3} />}
            {state === 'off' && <span className="text-[10px] font-bold uppercase leading-none">{offLabel}</span>}
        </>
    )
}
