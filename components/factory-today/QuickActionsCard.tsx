'use client'

import Link from 'next/link'
import { ArrowRight, Calculator, Package, Truck, DollarSign, Store, Zap } from 'lucide-react'
import { getWorkflowVisibility, type ProductionMode, type WorkflowKey } from '@/lib/production-mode'
import { useTranslation } from '@/lib/i18n/context'

const actions = [
    {
        id: 'cost-fabric',
        label: 'Cost New Fabric',
        description: 'Run the estimator',
        href: '/owner/estimator',
        icon: Calculator,
        color: 'text-saffron bg-saffron/10 border-saffron/20',
        workflow: 'estimator',
    },
    {
        id: 'start-order',
        label: 'Start Party Order',
        description: 'Convert a quote to order',
        href: '/owner/quotes',
        icon: Package,
        color: 'text-saffron bg-saffron/10 border-saffron/20',
        workflow: 'orders',
    },
    {
        id: 'start-market-maal',
        label: 'Start Market Maal',
        description: 'New speculative run',
        href: '/owner/estimator?mode=market',
        icon: Store,
        color: 'text-warning bg-warning-soft border-warning/20',
        workflow: 'marketRuns',
    },
    {
        id: 'confirm-taka',
        label: 'Godown Ledger',
        description: 'Review expected stock',
        href: '/owner/stock',
        icon: Zap,
        color: 'text-success bg-success-soft border-success/20',
        workflow: 'stock',
    },
    {
        id: 'create-dispatch',
        label: 'Create Dispatch',
        description: 'Send sold stock',
        href: '/owner/dispatches',
        icon: Truck,
        color: 'text-risk bg-risk-soft border-risk/20',
        workflow: 'dispatches',
    },
    {
        id: 'settle-hisaab',
        label: 'Settle Hisaab',
        description: 'Process payroll',
        href: '/owner/payroll',
        icon: DollarSign,
        color: 'text-success bg-success-soft border-success/20',
        workflow: 'payroll',
    },
]

export function QuickActionsCard({ productionMode }: { productionMode?: ProductionMode | null }) {
    const { tx } = useTranslation()
    const visibility = getWorkflowVisibility(productionMode)
    const visibleActions = actions.filter((action) => visibility[action.workflow as WorkflowKey])

    return (
        <div className="rounded-2xl border border-hairline bg-surface overflow-hidden" data-i18n-skip="true">
            <div className="border-b border-hairline px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink">{tx("Quick Actions")}</p>
                <p className="text-sm font-bold text-ink">{tx("Jump to a workflow")}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
                {visibleActions.map((action) => {
                    const Icon = action.icon
                    return (
                        <Link
                            key={action.id}
                            href={action.href}
                            id={`quick-action-${action.id}`}
                            className="group flex min-h-[96px] flex-col justify-between gap-3 rounded-xl border border-hairline bg-surface p-3 transition-all hover:border-saffron/30 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/25"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${action.color}`}>
                                    <Icon className="h-3.5 w-3.5" />
                                </div>
                                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-saffron-deep" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-ink group-hover:text-saffron transition-colors">
                                    {tx(action.label)}
                                </p>
                                <p className="mt-0.5 text-[11px] leading-snug text-body">{tx(action.description)}</p>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
