'use client'

import React from 'react'
import { Calendar } from 'lucide-react'
import { blurNumberInputOnWheel } from '@/lib/input-mode'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/context'
import type { PayrollCycleInput } from '@/lib/base-onboarding'
import { WEEKDAYS, type WeekdayName } from '@/lib/payroll-cycle-engine'
import { getSuratTodayString } from '@/lib/time'

interface Step5PayrollProps {
    payroll: PayrollCycleInput
    onChangePayroll: (updated: PayrollCycleInput) => void
    error?: string
}

export function Step5Payroll({
    payroll,
    onChangePayroll,
    error,
}: Step5PayrollProps) {
    const { tx } = useTranslation()
    const today = getSuratTodayString()

    const updatePayroll = (fields: Partial<PayrollCycleInput>) => {
        onChangePayroll({
            ...payroll,
            ...fields,
        })
    }

    const currentType = payroll.cycleType || 'monthly'
    const isFortnightly = currentType === 'interval_days' && (payroll.intervalDays === 14 || !payroll.intervalDays)
    const isCustom = currentType === 'interval_days' && Boolean(payroll.intervalDays && payroll.intervalDays !== 14)

    return (
        <div className="mx-auto max-w-xl space-y-6">
            <div className="space-y-2 text-center sm:text-left">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] px-3 py-1 text-xs font-semibold text-[var(--wv-ochre-800)]">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{tx('Step 5 of 6 · Payroll Schedule')}</span>
                </div>

                <h2 className="text-2xl font-bold tracking-tight text-[var(--wv-neel-900)] sm:text-3xl">
                    {tx('Configure your factory payroll cycle')}
                </h2>
                <p className="text-sm text-[var(--wv-neel-700)]">
                    {tx('Workers’ pay periods and settlement records will automatically be created using this schedule.')}
                </p>
            </div>

            <div className="space-y-6 rounded-2xl border border-[var(--wv-cotton-400)] bg-white p-5 shadow-sm sm:p-6">
                {/* Cycle Presets */}
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <button
                        type="button"
                        onClick={() => updatePayroll({ cycleType: 'monthly', anchorDay: payroll.anchorDay || 1 })}
                        className={cn(
                            'flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all',
                            currentType === 'monthly'
                                ? 'border-[var(--wv-brand-accent)] bg-[var(--wv-saffron-50)] text-[var(--wv-neel-900)] shadow-sm'
                                : 'border-[var(--wv-cotton-300)] bg-[var(--wv-cotton-100)]/40 text-[var(--wv-neel-700)] hover:border-[var(--wv-cotton-400)]'
                        )}
                    >
                        <span className="text-xs font-bold">{tx('Monthly')}</span>
                        <span className="mt-1 text-[11px] text-[var(--wv-neel-600)]">1st of month</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => updatePayroll({ cycleType: 'weekly', anchorWeekday: payroll.anchorWeekday || 'monday' })}
                        className={cn(
                            'flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all',
                            currentType === 'weekly'
                                ? 'border-[var(--wv-brand-accent)] bg-[var(--wv-saffron-50)] text-[var(--wv-neel-900)] shadow-sm'
                                : 'border-[var(--wv-cotton-300)] bg-[var(--wv-cotton-100)]/40 text-[var(--wv-neel-700)] hover:border-[var(--wv-cotton-400)]'
                        )}
                    >
                        <span className="text-xs font-bold">{tx('Weekly')}</span>
                        <span className="mt-1 text-[11px] text-[var(--wv-neel-600)]">Every 7 days</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => updatePayroll({
                            cycleType: 'interval_days',
                            intervalDays: 14,
                            anchorDate: payroll.anchorDate || today,
                        })}
                        className={cn(
                            'flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all',
                            isFortnightly
                                ? 'border-[var(--wv-brand-accent)] bg-[var(--wv-saffron-50)] text-[var(--wv-neel-900)] shadow-sm'
                                : 'border-[var(--wv-cotton-300)] bg-[var(--wv-cotton-100)]/40 text-[var(--wv-neel-700)] hover:border-[var(--wv-cotton-400)]'
                        )}
                    >
                        <span className="text-xs font-bold">{tx('Every 14 days')}</span>
                        <span className="mt-1 text-[11px] text-[var(--wv-neel-600)]">Fortnightly</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => updatePayroll({
                            cycleType: 'interval_days',
                            intervalDays: (payroll.intervalDays && payroll.intervalDays !== 14) ? payroll.intervalDays : 24,
                            anchorDate: payroll.anchorDate || today,
                        })}
                        className={cn(
                            'flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all',
                            isCustom
                                ? 'border-[var(--wv-brand-accent)] bg-[var(--wv-saffron-50)] text-[var(--wv-neel-900)] shadow-sm'
                                : 'border-[var(--wv-cotton-300)] bg-[var(--wv-cotton-100)]/40 text-[var(--wv-neel-700)] hover:border-[var(--wv-cotton-400)]'
                        )}
                    >
                        <span className="text-xs font-bold">{tx('Custom')}</span>
                        <span className="mt-1 text-[11px] text-[var(--wv-neel-600)]">e.g. 24 days</span>
                    </button>
                </div>

                {/* Detailed Config Options depending on Selection */}
                {currentType === 'monthly' && (
                    <div className="rounded-xl border border-[var(--wv-cotton-300)] bg-[var(--wv-cotton-100)]/50 p-4">
                        <label htmlFor="anchor-day-input" className="block text-xs font-bold text-[var(--wv-neel-800)]">
                            {tx('Monthly Cycle Anchor Day')}
                        </label>
                        <p className="mt-0.5 text-xs text-[var(--wv-neel-600)]">
                            {tx('The day of each month on which a new pay cycle begins.')}
                        </p>
                        <div className="mt-3 flex items-center gap-3">
                            <input
                                id="anchor-day-input"
                                type="number"
                                inputMode="numeric"
                                onWheel={blurNumberInputOnWheel}
                                min="1"
                                max="31"
                                value={payroll.anchorDay ?? 1}
                                onChange={e => {
                                    const val = e.target.value === '' ? 1 : Number(e.target.value)
                                    updatePayroll({ anchorDay: isNaN(val) ? 1 : Math.min(31, Math.max(1, val)) })
                                }}
                                className="h-10 w-24 rounded-lg border border-[var(--wv-cotton-400)] bg-white px-3 text-center text-sm font-bold text-[var(--wv-neel-900)] focus:border-[var(--wv-brand-accent-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--wv-brand-accent-strong)]"
                            />
                            <span className="text-xs text-[var(--wv-neel-700)]">
                                {tx('Day of month (e.g. 1st or 26th of month)')}
                            </span>
                        </div>
                    </div>
                )}

                {currentType === 'weekly' && (
                    <div className="rounded-xl border border-[var(--wv-cotton-300)] bg-[var(--wv-cotton-100)]/50 p-4">
                        <label htmlFor="anchor-weekday-select" className="block text-xs font-bold text-[var(--wv-neel-800)]">
                            {tx('Weekly Cycle Anchor Weekday')}
                        </label>
                        <p className="mt-0.5 text-xs text-[var(--wv-neel-600)]">
                            {tx('The day of the week on which each weekly period begins.')}
                        </p>
                        <select
                            id="anchor-weekday-select"
                            value={payroll.anchorWeekday || 'monday'}
                            onChange={e => updatePayroll({ anchorWeekday: e.target.value as WeekdayName })}
                            className="mt-3 h-10 w-full rounded-lg border border-[var(--wv-cotton-400)] bg-white px-3 text-sm font-medium text-[var(--wv-neel-900)] focus:border-[var(--wv-brand-accent-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--wv-brand-accent-strong)]"
                        >
                            {WEEKDAYS.map(w => (
                                <option key={w} value={w}>
                                    {tx(w.charAt(0).toUpperCase() + w.slice(1))}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {currentType === 'interval_days' && (
                    <div className="space-y-4 rounded-xl border border-[var(--wv-cotton-300)] bg-[var(--wv-cotton-100)]/50 p-4">
                        <div>
                            <label htmlFor="interval-days-input" className="block text-xs font-bold text-[var(--wv-neel-800)]">
                                {tx('Cycle Length (Days)')}
                            </label>
                            <p className="mt-0.5 text-xs text-[var(--wv-neel-600)]">
                                {tx('Number of days in each recurring payroll period.')}
                            </p>
                            <input
                                id="interval-days-input"
                                type="number"
                                inputMode="numeric"
                                onWheel={blurNumberInputOnWheel}
                                min="1"
                                max="60"
                                value={payroll.intervalDays ?? 14}
                                onChange={e => {
                                    const val = e.target.value === '' ? 14 : Number(e.target.value)
                                    updatePayroll({ intervalDays: isNaN(val) ? 14 : Math.min(60, Math.max(1, val)) })
                                }}
                                className="mt-2 h-10 w-32 rounded-lg border border-[var(--wv-cotton-400)] bg-white px-3 text-sm font-bold text-[var(--wv-neel-900)] focus:border-[var(--wv-brand-accent-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--wv-brand-accent-strong)]"
                            />
                        </div>

                        <div>
                            <label htmlFor="anchor-date-input" className="block text-xs font-bold text-[var(--wv-neel-800)]">
                                {tx('Anchor / Reference Date')}
                            </label>
                            <p className="mt-0.5 text-xs text-[var(--wv-neel-600)]">
                                {tx('A starting date to align the recurring interval.')}
                            </p>
                            <input
                                id="anchor-date-input"
                                type="date"
                                value={payroll.anchorDate || today}
                                onChange={e => updatePayroll({ anchorDate: e.target.value || today })}
                                className="mt-2 h-10 w-44 rounded-lg border border-[var(--wv-cotton-400)] bg-white px-3 text-sm font-medium text-[var(--wv-neel-900)] focus:border-[var(--wv-brand-accent-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--wv-brand-accent-strong)]"
                            />
                        </div>
                    </div>
                )}

                {error && (
                    <div className="rounded-lg border border-[var(--wv-madder-200)] bg-[var(--wv-madder-50)] p-3 text-sm text-[var(--wv-madder-700)]">
                        {tx(error)}
                    </div>
                )}
            </div>
        </div>
    )
}
