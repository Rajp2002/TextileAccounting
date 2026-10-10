'use client'

import { Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'

/**
 * First-run factory setup, offered inline instead of blocking the estimator.
 * A new owner can start costing straight away and save the factory cost and
 * usual rates once a result is on screen; the wizard carries over whatever
 * was typed in the costing.
 */
export function FactorySetupPrompt({
    hasResult,
    onStart,
    onHide,
    className,
}: {
    hasResult: boolean
    onStart: () => void
    onHide: () => void
    className?: string
}) {
    const { tx } = useTranslation()
    return (
        <section
            data-testid="factory-setup-prompt"
            aria-labelledby="factory-setup-prompt-title"
            className={`flex flex-col gap-3 rounded-xl border border-[var(--wv-border-default)] bg-[var(--wv-bg-surface)] p-4 shadow-xs sm:flex-row sm:items-center sm:gap-4 ${className ?? ''}`}
        >
            <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--wv-neel-50)] sm:flex" aria-hidden="true">
                <Building2 className="h-5 w-5 text-[var(--wv-neel-900)]" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
                <h2 id="factory-setup-prompt-title" className="text-sm font-semibold text-[var(--wv-text-primary)]">
                    {hasResult ? tx('Save this factory cost for next time') : tx('Set your factory cost once')}
                </h2>
                <p className="text-sm leading-relaxed text-[var(--wv-text-secondary)]">
                    {hasResult
                        ? tx('Save your factory cost and usual rates, and every new costing starts from them. What you typed in this costing is carried over.')
                        : tx('Your factory cost per metre and usual rates fill every new costing. Set them now, or start with the fabric and enter the factory cost in this costing.')}
                </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
                <Button onClick={onStart}>{tx('Set up factory cost')}</Button>
                <Button variant="ghost" onClick={onHide}>{tx('Not now')}</Button>
            </div>
        </section>
    )
}
