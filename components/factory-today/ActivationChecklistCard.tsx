'use client'

import Link from 'next/link'
import { CheckCircle2, Circle, ArrowRight, Calculator, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getWorkflowVisibility, normalizeProductionMode, type ProductionMode } from '@/lib/production-mode'

interface ActivationChecklistCardProps {
    checklist: {
        hasEstimate: boolean
        hasQuality: boolean
        hasOrder: boolean
        hasProductionLog: boolean
        hasStockEntry: boolean
        hasMarketRun: boolean
    }
    isCollapsed: boolean
    productionMode?: ProductionMode | null
}

export function ActivationChecklistCard({ checklist, isCollapsed, productionMode }: ActivationChecklistCardProps) {
    const normalizedMode = normalizeProductionMode(productionMode)
    const visibility = getWorkflowVisibility(normalizedMode)
    const marketRunFirst = normalizedMode === 'market_run'

    const items = [
        {
            id: 'market-run',
            label: 'Start first market run',
            description: 'Plan fabric that will move into taka/godown stock.',
            completed: checklist.hasMarketRun,
            href: '/owner/market-runs',
            priority: 'High',
            workflow: 'marketRuns',
        },
        {
            id: 'estimate',
            label: 'Create first estimate',
            description: 'Calculate pricing and expected profit.',
            completed: checklist.hasEstimate,
            href: '/owner/estimator',
            priority: 'High',
            workflow: 'estimator',
        },
        {
            id: 'quality',
            label: 'Add/select first quality',
            description: 'This happens inside the estimator flow.',
            completed: checklist.hasQuality,
            href: '/owner/estimator',
            priority: 'High',
            workflow: 'estimator',
        },
        {
            id: 'order',
            label: 'Convert quote to order',
            description: 'Move from estimate to production.',
            completed: checklist.hasOrder,
            href: '/owner/quotes',
            priority: 'Medium',
            workflow: 'orders',
        },
        {
            id: 'production',
            label: 'Log first production',
            description: 'Record meters produced on looms.',
            completed: checklist.hasProductionLog,
            href: '/supervisor/production',
            priority: 'High',
            workflow: 'productionLogging',
        },
        {
            id: 'stock',
            label: 'Add opening stock',
            description: 'Add existing stock to godown.',
            completed: checklist.hasStockEntry,
            href: '/owner/stock',
            priority: 'Medium',
            workflow: 'stock',
        },
    ].filter((item) => visibility[item.workflow as keyof typeof visibility])

    const allCompleted = items.every((item) => item.completed)
    const primaryHref = marketRunFirst ? '/owner/market-runs' : '/owner/estimator'
    const primaryLabel = marketRunFirst ? 'Start market run' : 'Create first estimate'

    if (allCompleted) return null

    return (
        <div className={cn(
            "rounded-2xl border border-hairline bg-surface overflow-hidden transition-all duration-300",
            isCollapsed ? "p-4" : "p-6"
        )}>
            {!isCollapsed ? (
                <>
                    <div className="mb-4">
                        <h2 className="text-xl font-bold text-ink">
                            {marketRunFirst ? 'Your factory is ready. Start with your first market run.' : 'Your factory is ready. Start with your first estimate.'}
                        </h2>
                        <p className="mt-1 text-sm text-body">
                            {marketRunFirst
                                ? 'Produce fabric into taka/godown stock first, then sell or dispatch from stock.'
                                : 'Create your first estimate to add a fabric quality, calculate pricing, and see expected profit.'}
                        </p>
                    </div>

                    <div className="mb-6 flex flex-wrap gap-3">
                        <Link
                            href={primaryHref}
                            className="inline-flex h-11 items-center gap-2 rounded-lg bg-saffron px-4 text-sm font-semibold text-white transition hover:bg-saffron-deep"
                        >
                            <Calculator className="h-4 w-4" />
                            {primaryLabel}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </>
            ) : (
                <div className="mb-3 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-ink">Activation Checklist</h2>
                        <p className="text-xs text-body">Complete these steps to get the most out of Weavly.</p>
                    </div>
                    {items.some((item) => !item.completed && item.priority === 'High') && (
                        <Link
                            href={primaryHref}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-saffron px-3 text-xs font-semibold text-white transition hover:bg-saffron-deep"
                        >
                            <Calculator className="h-3.5 w-3.5" />
                            {primaryLabel}
                        </Link>
                    )}
                </div>
            )}

            <div className="space-y-3">
                {items.map((item) => (
                    <div
                        key={item.id}
                        className={cn(
                            "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                            item.completed
                                ? "border-success/20 bg-success-soft/50"
                                : "border-hairline bg-surface-soft/50"
                        )}
                    >
                        {item.completed ? (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                        ) : (
                            <Circle className={cn(
                                "h-5 w-5 shrink-0",
                                item.priority === 'High' ? "text-saffron" : "text-body"
                            )} />
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                                <p className={cn(
                                    "text-sm font-semibold",
                                    item.completed ? "text-success" : "text-ink"
                                )}>
                                    {item.label}
                                </p>
                                {item.priority === 'High' && !item.completed && (
                                    <span className="rounded-full bg-saffron/10 px-2 py-0.5 text-xs font-medium text-saffron">
                                        High Priority
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-body mt-0.5">{item.description}</p>
                        </div>
                        {!item.completed && (
                            <Link
                                href={item.href}
                                className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-surface text-ink transition hover:bg-surface-soft"
                                title={`Go to ${item.label}`}
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
