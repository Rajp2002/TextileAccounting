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
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--wv-moss-100)] text-[var(--wv-moss-700)] shadow-lg shadow-[var(--wv-moss-500)]/20">
                <CheckCircle2 className="h-9 w-9 stroke-[2.5]" />
            </div>

            <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wv-moss-200)] bg-[var(--wv-moss-50)] px-3 py-1 text-xs font-semibold text-[var(--wv-moss-700)]">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{tx('Setup Complete')}</span>
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight text-[var(--wv-neel-900)] sm:text-4xl">
                    {tx('Your factory is set up')}
                </h1>
                <p className="text-base text-[var(--wv-neel-700)]">
                    {factoryName ? <span className="font-semibold text-[var(--wv-neel-900)]">{factoryName} · </span> : ''}
                    {machineCount} {tx('machines and')} {workerCount} {tx('workers are configured and ready for production.')}
                </p>
            </div>

            {/* Next Steps Guidance Card */}
            <div className="rounded-2xl border border-[var(--wv-cotton-400)] bg-white p-5 text-left shadow-sm sm:p-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--wv-neel-600)]">
                    {tx('What happens next')}
                </h2>
                <div className="mt-4 space-y-3 text-xs text-[var(--wv-neel-700)]">
                    <div className="flex items-start gap-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--wv-saffron-100)] font-mono text-[10px] font-bold text-[var(--wv-brand-ink)]">
                            1
                        </span>
                        <div>
                            <p className="font-semibold text-[var(--wv-neel-900)]">
                                {hasSavedCostings ? tx('Activate a costing for production') : tx('Create your first fabric costing')}
                            </p>
                            <p className="text-[var(--wv-neel-600)]">
                                {tx('Set up recipe specifications, yarn rates, and pick densities.')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--wv-saffron-100)] font-mono text-[10px] font-bold text-[var(--wv-brand-ink)]">
                            2
                        </span>
                        <div>
                            <p className="font-semibold text-[var(--wv-neel-900)]">
                                {tx('Assign machines and weavers')}
                            </p>
                            <p className="text-[var(--wv-neel-600)]">
                                {tx('Your machines and weavers are already populated and selectable without re-typing.')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--wv-saffron-100)] font-mono text-[10px] font-bold text-[var(--wv-brand-ink)]">
                            3
                        </span>
                        <div>
                            <p className="font-semibold text-[var(--wv-neel-900)]">
                                {tx('Record daily meters & run payroll')}
                            </p>
                            <p className="text-[var(--wv-neel-600)]">
                                {tx('Log shift production meters; piece-rate pay settlements calculate automatically.')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dynamic CTAs */}
            <div className="space-y-3 pt-2">
                {hasSavedCostings ? (
                    <Button asChild size="lg" className="w-full gap-2 bg-[var(--wv-action-primary)] text-base font-bold text-white shadow-sm hover:bg-[var(--wv-action-primary-hover)]">
                        <Link href="/owner/production">
                            <Activity className="h-5 w-5" />
                            <span>{tx('Choose Costings to Activate')}</span>
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                ) : (
                    <Button asChild size="lg" className="w-full gap-2 bg-[var(--wv-action-primary)] text-base font-bold text-white shadow-sm hover:bg-[var(--wv-action-primary-hover)]">
                        <Link href="/owner/estimator">
                            <Calculator className="h-5 w-5" />
                            <span>{tx('Create Your First Costing')}</span>
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                )}

                <Button asChild variant="outline" size="sm" className="w-full gap-2 border-[var(--wv-cotton-400)] bg-white text-[var(--wv-neel-800)] hover:bg-[var(--wv-cotton-100)]">
                    <Link href="/owner/estimator">
                        <LayoutDashboard className="h-4 w-4" />
                        <span>{tx('Go to Dashboard')}</span>
                    </Link>
                </Button>
            </div>
        </div>
    )
}
