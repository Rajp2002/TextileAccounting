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
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] px-3 py-1 text-xs font-semibold text-[var(--wv-ochre-800)]">
                    <Sliders className="h-3.5 w-3.5" />
                    <span>{tx('Step 2 of 6 · Costing & Process Defaults')}</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-[var(--wv-neel-900)] sm:text-3xl">
                    {tx('Set your factory defaults')}
                </h2>
                <p className="text-sm text-[var(--wv-neel-700)]">
                    {tx('These baseline assumptions speed up your costing and job setups. You can always override them for any individual fabric.')}
                </p>
            </div>

            <div className="space-y-6 rounded-2xl border border-[var(--wv-cotton-400)] bg-white p-5 shadow-sm sm:p-6">
                {/* Costing Defaults (Wastage & Margin) */}
                <div className="grid gap-4 sm:grid-cols-2">
                    {/* Wastage */}
                    <div className="space-y-1.5 rounded-xl border border-[var(--wv-cotton-300)] bg-[var(--wv-cotton-100)]/60 p-3.5">
                        <div className="flex items-center justify-between">
                            <label htmlFor="wastage-input" className="text-xs font-bold text-[var(--wv-neel-800)]">
                                {tx('Default Wastage')}
                            </label>
                            <Percent className="h-3.5 w-3.5 text-[var(--wv-cotton-500)]" />
                        </div>
                        <p className="text-[11px] leading-tight text-[var(--wv-neel-600)]">
                            {tx('Used automatically when creating a costing.')}
                        </p>
                        <div className="relative mt-2 flex items-center">
                            <input
                                id="wastage-input"
                                type="number"
                                inputMode="decimal"
                                step="0.1"
                                min="0"
                                max="50"
                                value={defaults.yarnShortagePct}
                                onChange={e => updateField('yarnShortagePct', Number(e.target.value) || 0)}
                                className="h-10 w-full rounded-md border border-[var(--wv-cotton-400)] bg-white pr-8 pl-3 text-base font-semibold text-[var(--wv-neel-900)] focus:border-[var(--wv-brand-accent-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--wv-brand-accent-strong)]"
                            />
                            <span className="pointer-events-none absolute right-3 text-sm font-semibold text-[var(--wv-cotton-500)]">
                                %
                            </span>
                        </div>
                    </div>

                    {/* Margin */}
                    <div className="space-y-1.5 rounded-xl border border-[var(--wv-cotton-300)] bg-[var(--wv-cotton-100)]/60 p-3.5">
                        <div className="flex items-center justify-between">
                            <label htmlFor="margin-input" className="text-xs font-bold text-[var(--wv-neel-800)]">
                                {tx('Default Margin')}
                            </label>
                            <DollarSign className="h-3.5 w-3.5 text-[var(--wv-cotton-500)]" />
                        </div>
                        <p className="text-[11px] leading-tight text-[var(--wv-neel-600)]">
                            {tx('Target profit margin for suggested rate.')}
                        </p>
                        <div className="relative mt-2 flex items-center">
                            <input
                                id="margin-input"
                                type="number"
                                inputMode="decimal"
                                step="0.5"
                                min="0"
                                max="90"
                                value={defaults.defaultMarginPct}
                                onChange={e => updateField('defaultMarginPct', Number(e.target.value) || 0)}
                                className="h-10 w-full rounded-md border border-[var(--wv-cotton-400)] bg-white pr-8 pl-3 text-base font-semibold text-[var(--wv-neel-900)] focus:border-[var(--wv-brand-accent-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--wv-brand-accent-strong)]"
                            />
                            <span className="pointer-events-none absolute right-3 text-sm font-semibold text-[var(--wv-cotton-500)]">
                                %
                            </span>
                        </div>
                    </div>
                </div>

                {/* Overhead Mode */}
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--wv-neel-600)]">
                        {tx('How do you normally account for overhead?')}
                    </label>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => updateField('overheadMode', 'direct')}
                            className={cn(
                                'flex flex-col items-start rounded-xl border p-3.5 text-left transition-all',
                                defaults.overheadMode === 'direct'
                                    ? 'border-[var(--wv-brand-accent)] bg-[var(--wv-saffron-50)] text-[var(--wv-neel-900)] shadow-sm'
                                    : 'border-[var(--wv-cotton-300)] bg-[var(--wv-cotton-100)]/40 text-[var(--wv-neel-700)] hover:border-[var(--wv-cotton-400)]'
                            )}
                        >
                            <span className="text-sm font-semibold">{tx('Direct Overhead')}</span>
                            <span className="mt-1 text-xs text-[var(--wv-neel-600)]">
                                {tx('Fixed ₹ per meter added directly to each quality.')}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => updateField('overheadMode', 'monthly_expenses')}
                            className={cn(
                                'flex flex-col items-start rounded-xl border p-3.5 text-left transition-all',
                                defaults.overheadMode === 'monthly_expenses'
                                    ? 'border-[var(--wv-brand-accent)] bg-[var(--wv-saffron-50)] text-[var(--wv-neel-900)] shadow-sm'
                                    : 'border-[var(--wv-cotton-300)] bg-[var(--wv-cotton-100)]/40 text-[var(--wv-neel-700)] hover:border-[var(--wv-cotton-400)]'
                            )}
                        >
                            <span className="text-sm font-semibold">{tx('Monthly Overhead Allocation')}</span>
                            <span className="mt-1 text-xs text-[var(--wv-neel-600)]">
                                {tx('Monthly factory expenses divided across production capacity.')}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Sizing & Warping Defaults */}
                <div className="grid gap-4 sm:grid-cols-2">
                    {/* Warping */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-[var(--wv-neel-600)]">
                            {tx('Warping Process')}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => updateField('warpingMode', 'in_house')}
                                className={cn(
                                    'rounded-lg border px-3 py-2 text-xs font-semibold transition',
                                    defaults.warpingMode === 'in_house'
                                        ? 'border-[var(--wv-action-primary)] bg-[var(--wv-action-primary)] text-white'
                                        : 'border-[var(--wv-cotton-300)] bg-white text-[var(--wv-neel-700)] hover:bg-[var(--wv-cotton-100)]'
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
                                        ? 'border-[var(--wv-action-primary)] bg-[var(--wv-action-primary)] text-white'
                                        : 'border-[var(--wv-cotton-300)] bg-white text-[var(--wv-neel-700)] hover:bg-[var(--wv-cotton-100)]'
                                )}
                            >
                                {tx('Outsourced')}
                            </button>
                        </div>
                    </div>

                    {/* Sizing */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-[var(--wv-neel-600)]">
                            {tx('Sizing Process')}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => updateField('sizingMode', 'in_house')}
                                className={cn(
                                    'rounded-lg border px-3 py-2 text-xs font-semibold transition',
                                    defaults.sizingMode === 'in_house'
                                        ? 'border-[var(--wv-action-primary)] bg-[var(--wv-action-primary)] text-white'
                                        : 'border-[var(--wv-cotton-300)] bg-white text-[var(--wv-neel-700)] hover:bg-[var(--wv-cotton-100)]'
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
                                        ? 'border-[var(--wv-action-primary)] bg-[var(--wv-action-primary)] text-white'
                                        : 'border-[var(--wv-cotton-300)] bg-white text-[var(--wv-neel-700)] hover:bg-[var(--wv-cotton-100)]'
                                )}
                            >
                                {tx('Outsourced')}
                            </button>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="rounded-lg border border-[var(--wv-madder-200)] bg-[var(--wv-madder-50)] p-3 text-sm text-[var(--wv-madder-700)]">
                        {tx(error)}
                    </div>
                )}
            </div>
        </div>
    )
}
