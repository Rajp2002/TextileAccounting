import type { FactoryTodayData } from '@/app/(dashboard)/owner/today/actions'
import { Activity, Server, Package, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TodayKpiStripProps {
    production: FactoryTodayData['production']
    machines: FactoryTodayData['machines']
    stock: FactoryTodayData['stock']
    dispatch: FactoryTodayData['dispatch']
    actionCounts: FactoryTodayData['actionCounts']
}

function KpiCard({
    icon: Icon,
    label,
    value,
    sub,
    color,
}: {
    icon: React.ElementType
    label: string
    value: string | number
    sub?: string
    color: 'green' | 'yellow' | 'red' | 'neutral'
}) {
    const colorMap = {
        green: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        yellow: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        red: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
        neutral: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
    }

    return (
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 backdrop-blur-sm min-w-[160px]">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', colorMap[color])}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
                <p className="text-lg font-bold leading-tight text-zinc-100">{value}</p>
                {sub && <p className="text-[11px] text-zinc-500">{sub}</p>}
            </div>
        </div>
    )
}

export function TodayKpiStrip({ production, machines, stock, dispatch, actionCounts }: TodayKpiStripProps) {
    const prodColor = production.hasLogsToday
        ? (production.dayShiftLogged && production.nightShiftLogged ? 'green' : 'yellow')
        : 'red'

    const machineColor = machines.unassigned > 0 ? 'yellow' : 'green'

    const pendingDrafts = stock.pendingInwardDrafts.length
    const stockColor = pendingDrafts > 0 ? 'yellow' : 'green'

    const notDispatched = dispatch.soldNotDispatched.length
    const dispatchColor = notDispatched > 0 ? 'red' : 'green'

    const prodValue = production.hasLogsToday
        ? `${production.totalMetersToday.toLocaleString('en-IN', { maximumFractionDigits: 0 })}m`
        : 'Pending'

    return (
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
            <KpiCard
                icon={Activity}
                label="Today's Production"
                value={prodValue}
                sub={production.hasLogsToday
                    ? `${production.totalLogsToday} log${production.totalLogsToday !== 1 ? 's' : ''}`
                    : 'No logs yet'
                }
                color={prodColor}
            />
            <KpiCard
                icon={Server}
                label="Active Looms"
                value={`${machines.assigned} / ${machines.totalActive}`}
                sub={machines.unassigned > 0 ? `${machines.unassigned} unassigned` : 'All assigned'}
                color={machineColor}
            />
            <KpiCard
                icon={Package}
                label="Stock Drafts"
                value={pendingDrafts}
                sub={pendingDrafts > 0 ? 'Need confirmation' : 'All confirmed'}
                color={stockColor}
            />
            <KpiCard
                icon={Truck}
                label="Not Dispatched"
                value={notDispatched}
                sub={notDispatched > 0 ? 'Sold awaiting dispatch' : 'All dispatched'}
                color={dispatchColor}
            />

            {actionCounts.critical > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 min-w-[160px]">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/20">
                        <span className="text-base font-bold text-rose-400">{actionCounts.critical}</span>
                    </div>
                    <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-rose-500">Critical</p>
                        <p className="text-sm font-semibold text-rose-300">Action needed</p>
                    </div>
                </div>
            )}
        </div>
    )
}
