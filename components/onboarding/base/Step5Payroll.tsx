'use client'

import React from 'react'
import { Calendar } from 'lucide-react'
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
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{tx('Step 5 of 6 · Payroll Schedule')}</span>
                </div>

                <h2 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 sm:text-3xl">
                    {tx('Configure your factory payroll cycle')}
                </h2>
                <p className="text-sm text-stone-600 dark:text-stone-400">
                    {tx('Workers’ pay periods and settlement records will automatically be created using this schedule.')}
                </p>
            </div>

            <div className="space-y-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900 sm:p-6">
                {/* Cycle Presets */}
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <button
                        type="button"
                        onClick={() => updatePayroll({ cycleType: 'monthly', anchorDay: payroll.anchorDay || 1 })}
                        className={cn(
                            'flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all',
                            currentType === 'monthly'
                                ? 'border-amber-600 bg-amber-50/70 text-amber-900 shadow-sm dark:bg-amber-950/40 dark:text-amber-200'
                                : 'border-stone-200 bg-stone-50/40 text-stone-700 hover:border-stone-300 dark:border-stone-800 dark:bg-stone-800/30 dark:text-stone-300'
                        )}
                    >
                        <span className="text-xs font-bold">{tx('Monthly')}</span>
                        <span className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">1st of month</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => updatePayroll({ cycleType: 'weekly', anchorWeekday: payroll.anchorWeekday || 'monday' })}
                        className={cn(
                            'flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all',
                            currentType === 'weekly'
                                ? 'border-amber-600 bg-amber-50/70 text-amber-900 shadow-sm dark:bg-amber-950/40 dark:text-amber-200'
                                : 'border-stone-200 bg-stone-50/40 text-stone-700 hover:border-stone-300 dark:border-stone-800 dark:bg-stone-800/30 dark:text-stone-300'
                        )}
                    >
                        <span className="text-xs font-bold">{tx('Weekly')}</span>
                        <span className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">Every 7 days</span>
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
                                ? 'border-amber-600 bg-amber-50/70 text-amber-900 shadow-sm dark:bg-amber-950/40 dark:text-amber-200'
                                : 'border-stone-200 bg-stone-50/40 text-stone-700 hover:border-stone-300 dark:border-stone-800 dark:bg-stone-800/30 dark:text-stone-300'
                        )}
                    >
                        <span className="text-xs font-bold">{tx('Every 14 days')}</span>
                        <span className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">Fortnightly</span>
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
                                ? 'border-amber-600 bg-amber-50/70 text-amber-900 shadow-sm dark:bg-amber-950/40 dark:text-amber-200'
                                : 'border-stone-200 bg-stone-50/40 text-stone-700 hover:border-stone-300 dark:border-stone-800 dark:bg-stone-800/30 dark:text-stone-300'
                        )}
                    >
                        <span className="text-xs font-bold">{tx('Custom')}</span>
                        <span className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">e.g. 24 days</span>
                    </button>
                </div>

                {/* Detailed Config Options depending on Selection */}
                {currentType === 'monthly' && (
                    <div className="rounded-xl border border-stone-100 bg-stone-50/50 p-4 dark:border-stone-800 dark:bg-stone-800/20">
                        <label htmlFor="anchor-day-input" className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                            {tx('Monthly Cycle Anchor Day')}
                        </label>
                        <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                            {tx('The day of each month on which a new pay cycle begins.')}
                        </p>
                        <div className="mt-3 flex items-center gap-3">
                            <input
                                id="anchor-day-input"
                                type="number"
                                min="1"
                                max="31"
                                value={payroll.anchorDay ?? 1}
                                onChange={e => {
                                    const val = e.target.value === '' ? 1 : Number(e.target.value)
                                    updatePayroll({ anchorDay: isNaN(val) ? 1 : Math.min(31, Math.max(1, val)) })
                                }}
                                className="h-10 w-24 rounded-lg border border-stone-300 bg-white px-3 text-center text-sm font-bold text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                            />
                            <span className="text-xs text-stone-600 dark:text-stone-400">
                                {tx('Day of month (e.g. 1st or 26th of month)')}
                            </span>
                        </div>
                    </div>
                )}

                {currentType === 'weekly' && (
                    <div className="rounded-xl border border-stone-100 bg-stone-50/50 p-4 dark:border-stone-800 dark:bg-stone-800/20">
                        <label htmlFor="anchor-weekday-select" className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                            {tx('Weekly Cycle Anchor Weekday')}
                        </label>
                        <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                            {tx('The day of the week on which each weekly period begins.')}
                        </p>
                        <select
                            id="anchor-weekday-select"
                            value={payroll.anchorWeekday || 'monday'}
                            onChange={e => updatePayroll({ anchorWeekday: e.target.value as WeekdayName })}
                            className="mt-3 h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
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
                    <div className="space-y-4 rounded-xl border border-stone-100 bg-stone-50/50 p-4 dark:border-stone-800 dark:bg-stone-800/20">
                        <div>
                            <label htmlFor="interval-days-input" className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                                {tx('Cycle Length (Days)')}
                            </label>
                            <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                                {tx('Number of days in each recurring payroll period.')}
                            </p>
                            <input
                                id="interval-days-input"
                                type="number"
                                min="1"
                                max="60"
                                value={payroll.intervalDays ?? 14}
                                onChange={e => {
                                    const val = e.target.value === '' ? 14 : Number(e.target.value)
                                    updatePayroll({ intervalDays: isNaN(val) ? 14 : Math.min(60, Math.max(1, val)) })
                                }}
                                className="mt-2 h-10 w-32 rounded-lg border border-stone-300 bg-white px-3 text-sm font-bold text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                            />
                        </div>

                        <div>
                            <label htmlFor="anchor-date-input" className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                                {tx('Anchor / Reference Date')}
                            </label>
                            <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                                {tx('A starting date to align the recurring interval.')}
                            </p>
                            <input
                                id="anchor-date-input"
                                type="date"
                                value={payroll.anchorDate || today}
                                onChange={e => updatePayroll({ anchorDate: e.target.value || today })}
                                className="mt-2 h-10 w-44 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                            />
                        </div>
                    </div>
                )}

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        {tx(error)}
                    </div>
                )}
            </div>
        </div>
    )
}
