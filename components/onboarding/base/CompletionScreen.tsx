'use client'

import React from 'react'
import Link from 'next/link'
import { CheckCircle2, ArrowRight, Calculator, Activity, LayoutDashboard, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'

interface CompletionScreenProps {
    factoryName: string
    machineCount: number
    workerCount: number
    hasSavedCostings: boolean
}

export function CompletionScreen({
    factoryName,
    machineCount,
    workerCount,
    hasSavedCostings,
}: CompletionScreenProps) {
    const { tx } = useTranslation()

    return (
        <div className="mx-auto max-w-lg space-y-6 text-center">
            {/* Animated Celebration Icon */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-lg shadow-emerald-500/20 dark:bg-emerald-950 dark:text-emerald-400">
                <CheckCircle2 className="h-9 w-9 stroke-[2.5]" />
            </div>

            <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{tx('Setup Complete')}</span>
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 dark:text-stone-100 sm:text-4xl">
                    {tx('Your factory is set up')}
                </h1>
                <p className="text-base text-stone-600 dark:text-stone-400">
                    {factoryName ? <span className="font-semibold text-stone-800 dark:text-stone-200">{factoryName} · </span> : ''}
                    {machineCount} {tx('machines and')} {workerCount} {tx('workers are configured and ready for production.')}
                </p>
            </div>

            {/* Next Steps Guidance Card */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 text-left shadow-sm dark:border-stone-800 dark:bg-stone-900 sm:p-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    {tx('What happens next')}
                </h2>
                <div className="mt-4 space-y-3 text-xs text-stone-600 dark:text-stone-300">
                    <div className="flex items-start gap-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 font-mono text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            1
                        </span>
                        <div>
                            <p className="font-semibold text-stone-900 dark:text-stone-100">
                                {hasSavedCostings ? tx('Activate a costing for production') : tx('Create your first fabric costing')}
                            </p>
                            <p className="text-stone-500 dark:text-stone-400">
                                {tx('Set up recipe specifications, yarn rates, and pick densities.')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 font-mono text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            2
                        </span>
                        <div>
                            <p className="font-semibold text-stone-900 dark:text-stone-100">
                                {tx('Assign machines and weavers')}
                            </p>
                            <p className="text-stone-500 dark:text-stone-400">
                                {tx('Your machines and weavers are already populated and selectable without re-typing.')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 font-mono text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            3
                        </span>
                        <div>
                            <p className="font-semibold text-stone-900 dark:text-stone-100">
                                {tx('Record daily meters & run payroll')}
                            </p>
                            <p className="text-stone-500 dark:text-stone-400">
                                {tx('Log shift production meters; piece-rate pay settlements calculate automatically.')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dynamic CTAs */}
            <div className="space-y-3 pt-2">
                {hasSavedCostings ? (
                    <Button asChild size="lg" className="w-full gap-2 bg-amber-600 text-base font-bold text-white shadow-lg shadow-amber-500/20 hover:bg-amber-700">
                        <Link href="/owner/production">
                            <Activity className="h-5 w-5" />
                            <span>{tx('Choose Costings to Activate')}</span>
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                ) : (
                    <Button asChild size="lg" className="w-full gap-2 bg-amber-600 text-base font-bold text-white shadow-lg shadow-amber-500/20 hover:bg-amber-700">
                        <Link href="/owner/estimator">
                            <Calculator className="h-5 w-5" />
                            <span>{tx('Create Your First Costing')}</span>
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                )}

                <Button asChild variant="outline" size="sm" className="w-full gap-2 bg-white dark:bg-stone-900">
                    <Link href="/owner/estimator">
                        <LayoutDashboard className="h-4 w-4" />
                        <span>{tx('Go to Dashboard')}</span>
                    </Link>
                </Button>
            </div>
        </div>
    )
}
