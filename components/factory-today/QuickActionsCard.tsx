'use client'

import Link from 'next/link'
import { Calculator, Package, Truck, DollarSign, Store, Zap } from 'lucide-react'

const actions = [
    {
        id: 'cost-fabric',
        label: 'Cost New Fabric',
        description: 'Run the estimator',
        href: '/owner/estimator',
        icon: Calculator,
        color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    },
    {
        id: 'start-order',
        label: 'Start Party Order',
        description: 'Convert a quote to order',
        href: '/owner/quotes',
        icon: Package,
        color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    },
    {
        id: 'start-market-maal',
        label: 'Start Market Maal',
        description: 'New speculative run',
        href: '/owner/estimator?mode=market',
        icon: Store,
        color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    },
    {
        id: 'confirm-taka',
        label: 'Confirm Takas',
        description: 'Confirm inward drafts',
        href: '/owner/stock?tab=pending',
        icon: Zap,
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
    {
        id: 'create-dispatch',
        label: 'Create Dispatch',
        description: 'Send sold stock',
        href: '/owner/dispatches',
        icon: Truck,
        color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    },
    {
        id: 'settle-hisaab',
        label: 'Settle Hisaab',
        description: 'Process payroll',
        href: '/owner/payroll',
        icon: DollarSign,
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
]

export function QuickActionsCard() {
    return (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
            <div className="border-b border-white/[0.06] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Quick Actions</p>
                <p className="text-sm font-bold text-zinc-300">Jump to a workflow</p>
            </div>

            <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
                {actions.map((action) => {
                    const Icon = action.icon
                    return (
                        <Link
                            key={action.id}
                            href={action.href}
                            id={`quick-action-${action.id}`}
                            className="group flex flex-col items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 transition-all hover:border-white/20 hover:bg-white/[0.07]"
                        >
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${action.color}`}>
                                <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-zinc-200 group-hover:text-white transition-colors">
                                    {action.label}
                                </p>
                                <p className="text-[11px] text-zinc-500">{action.description}</p>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
