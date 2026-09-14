'use client'

import React from 'react'
import { Sliders, Percent, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/context'
import type { FactoryDefaultsInput } from '@/lib/base-onboarding'

interface Step2DefaultsProps {
    defaults: FactoryDefaultsInput
    onChangeDefaults: (updated: FactoryDefaultsInput) => void
    error?: string
}

export function Step2Defaults({
    defaults,
    onChangeDefaults,
    error,
}: Step2DefaultsProps) {
    const { tx } = useTranslation()

    const updateField = <K extends keyof FactoryDefaultsInput>(field: K, val: FactoryDefaultsInput[K]) => {
        onChangeDefaults({
            ...defaults,
            [field]: val,
        })
    }

    return (
        <div className="mx-auto max-w-xl space-y-6">
            <div className="space-y-2 text-center sm:text-left">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                    <Sliders className="h-3.5 w-3.5" />
                    <span>{tx('Step 2 of 6 · Costing & Process Defaults')}</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 sm:text-3xl">
                    {tx('Set your factory defaults')}
                </h2>
                <p className="text-sm text-stone-600 dark:text-stone-400">
                    {tx('These baseline assumptions speed up your costing and job setups. You can always override them for any individual fabric.')}
                </p>
            </div>

            <div className="space-y-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900 sm:p-6">
                {/* Costing Defaults (Wastage & Margin) */}
                <div className="grid gap-4 sm:grid-cols-2">
                    {/* Wastage */}
                    <div className="space-y-1.5 rounded-xl border border-stone-100 bg-stone-50/60 p-3.5 dark:border-stone-800 dark:bg-stone-800/30">
                        <div className="flex items-center justify-between">
                            <label htmlFor="wastage-input" className="text-xs font-bold text-stone-800 dark:text-stone-200">
                                {tx('Default Wastage')}
                            </label>
                            <Percent className="h-3.5 w-3.5 text-stone-400" />
                        </div>
                        <p className="text-[11px] leading-tight text-stone-500 dark:text-stone-400">
                            {tx('Used automatically when creating a costing.')}
                        </p>
                        <div className="relative mt-2 flex items-center">
                            <input
                                id="wastage-input"
                                type="number"
                                step="0.1"
                                min="0"
                                max="50"
                                value={defaults.yarnShortagePct}
                                onChange={e => updateField('yarnShortagePct', Number(e.target.value) || 0)}
                                className="h-10 w-full rounded-md border border-stone-200 bg-white pr-8 pl-3 text-base font-semibold text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                            />
                            <span className="pointer-events-none absolute right-3 text-sm font-semibold text-stone-400">
                                %
                            </span>
                        </div>
                    </div>

                    {/* Margin */}
                    <div className="space-y-1.5 rounded-xl border border-stone-100 bg-stone-50/60 p-3.5 dark:border-stone-800 dark:bg-stone-800/30">
                        <div className="flex items-center justify-between">
                            <label htmlFor="margin-input" className="text-xs font-bold text-stone-800 dark:text-stone-200">
                                {tx('Default Margin')}
                            </label>
                            <DollarSign className="h-3.5 w-3.5 text-stone-400" />
                        </div>
                        <p className="text-[11px] leading-tight text-stone-500 dark:text-stone-400">
                            {tx('Target profit margin for suggested rate.')}
                        </p>
                        <div className="relative mt-2 flex items-center">
                            <input
                                id="margin-input"
                                type="number"
                                step="0.5"
                                min="0"
                                max="90"
                                value={defaults.defaultMarginPct}
                                onChange={e => updateField('defaultMarginPct', Number(e.target.value) || 0)}
                                className="h-10 w-full rounded-md border border-stone-200 bg-white pr-8 pl-3 text-base font-semibold text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                            />
                            <span className="pointer-events-none absolute right-3 text-sm font-semibold text-stone-400">
                                %
                            </span>
                        </div>
                    </div>
                </div>

                {/* Overhead Mode */}
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                        {tx('How do you normally account for overhead?')}
                    </label>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => updateField('overheadMode', 'direct')}
                            className={cn(
                                'flex flex-col items-start rounded-xl border p-3.5 text-left transition-all',
                                defaults.overheadMode === 'direct'
                                    ? 'border-amber-600 bg-amber-50/60 text-amber-900 shadow-sm dark:bg-amber-950/30 dark:text-amber-200'
                                    : 'border-stone-200 bg-stone-50/40 text-stone-700 hover:border-stone-300 dark:border-stone-800 dark:bg-stone-800/20 dark:text-stone-300'
                            )}
                        >
                            <span className="text-sm font-semibold">{tx('Direct Overhead')}</span>
                            <span className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                                {tx('Fixed ₹ per meter added directly to each quality.')}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => updateField('overheadMode', 'monthly_expenses')}
                            className={cn(
                                'flex flex-col items-start rounded-xl border p-3.5 text-left transition-all',
                                defaults.overheadMode === 'monthly_expenses'
                                    ? 'border-amber-600 bg-amber-50/60 text-amber-900 shadow-sm dark:bg-amber-950/30 dark:text-amber-200'
                                    : 'border-stone-200 bg-stone-50/40 text-stone-700 hover:border-stone-300 dark:border-stone-800 dark:bg-stone-800/20 dark:text-stone-300'
                            )}
                        >
                            <span className="text-sm font-semibold">{tx('Monthly Overhead Allocation')}</span>
                            <span className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                                {tx('Monthly factory expenses divided across production capacity.')}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Sizing & Warping Defaults */}
                <div className="grid gap-4 sm:grid-cols-2">
                    {/* Warping */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                            {tx('Warping Process')}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => updateField('warpingMode', 'in_house')}
                                className={cn(
                                    'rounded-lg border px-3 py-2 text-xs font-semibold transition',
                                    defaults.warpingMode === 'in_house'
                                        ? 'border-amber-600 bg-amber-600 text-white'
                                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200'
                                )}
                            >
                                {tx('In-house')}
                            </button>
                            <button
                                type="button"
                                onClick={() => updateField('warpingMode', 'outsourced')}
                                className={cn(
                                    'rounded-lg border px-3 py-2 text-xs font-semibold transition',
                                    defaults.warpingMode === 'outsourced'
                                        ? 'border-amber-600 bg-amber-600 text-white'
                                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200'
                                )}
                            >
                                {tx('Outsourced')}
                            </button>
                        </div>
                    </div>

                    {/* Sizing */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                            {tx('Sizing Process')}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => updateField('sizingMode', 'in_house')}
                                className={cn(
                                    'rounded-lg border px-3 py-2 text-xs font-semibold transition',
                                    defaults.sizingMode === 'in_house'
                                        ? 'border-amber-600 bg-amber-600 text-white'
                                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200'
                                )}
                            >
                                {tx('In-house')}
                            </button>
                            <button
                                type="button"
                                onClick={() => updateField('sizingMode', 'outsourced')}
                                className={cn(
                                    'rounded-lg border px-3 py-2 text-xs font-semibold transition',
                                    defaults.sizingMode === 'outsourced'
                                        ? 'border-amber-600 bg-amber-600 text-white'
                                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200'
                                )}
                            >
                                {tx('Outsourced')}
                            </button>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        {tx(error)}
                    </div>
                )}
            </div>
        </div>
    )
}
