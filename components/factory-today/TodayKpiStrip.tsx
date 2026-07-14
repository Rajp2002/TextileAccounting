import type { FactoryTodayData } from '@/app/(dashboard)/owner/today/actions'
import { Activity, Server, Package, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TodayKpiStripProps {
    productionMode: FactoryTodayData['productionMode']
    production: FactoryTodayData['production']
    machines: FactoryTodayData['machines']
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
        green: 'text-success bg-success-soft border-success/20',
        yellow: 'text-warning bg-warning-soft border-warning/20',
        red: 'text-risk bg-risk-soft border-risk/20',
        neutral: 'text-muted bg-surface-soft border-hairline',
    }

    return (
        <div className="flex min-w-0 items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', colorMap[color])}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-body">{label}</p>
                <p className="text-lg font-bold leading-tight text-ink">{value}</p>
                {sub && <p className="truncate text-xs text-body">{sub}</p>}
            </div>
        </div>
    )
}

export function TodayKpiStrip({ productionMode, production, machines, dispatch, actionCounts }: TodayKpiStripProps) {
    const prodColor = production.hasLogsToday
        ? (production.dayShiftLogged && production.nightShiftLogged ? 'green' : 'yellow')
        : 'red'

    const machineColor = machines.unassigned > 0 ? 'yellow' : 'green'

    const marketRunOnly = productionMode === 'market_run'
    const stockColor = 'green'

    const notDispatched = dispatch.soldNotDispatched.length
    const dispatchColor = notDispatched > 0 ? 'red' : 'green'

    const prodValue = production.hasLogsToday
        ? `${production.totalMetersToday.toLocaleString('en-IN', { maximumFractionDigits: 0 })}m`
        : 'Pending'
    const productionSub = production.hasLogsToday
        ? production.dayShiftLogged && production.nightShiftLogged
            ? 'Day + night logged'
            : production.dayShiftLogged
                ? 'Day shift logged'
                : production.nightShiftLogged
                    ? 'Night shift logged'
                    : 'Partial shift logged'
        : 'Record Metres Produced This Shift'

    return (
        <div className="space-y-3">
            {/* Critical Action Card */}
            {actionCounts.critical > 0 && (
                <div className="flex min-w-0 items-center gap-3 rounded-xl border border-risk/30 bg-risk-soft px-4 py-3" role="alert">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-risk/30 bg-risk/20">
                        <span className="text-lg font-bold text-risk">{actionCounts.critical}</span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-risk">Critical action needed</p>
                        <p className="text-sm text-risk">You have {actionCounts.critical} critical item{actionCounts.critical !== 1 ? 's' : ''} that need attention.</p>
                    </div>
                </div>
            )}

            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                    icon={Activity}
                    label="Today's Production"
                    value={prodValue}
                    sub={productionSub}
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
                    label="Godown Stock"
                    value={marketRunOnly ? 'Expected' : 'Live'}
                    sub={marketRunOnly ? 'As per production' : 'Current ledger'}
                    color={stockColor}
                />
                <KpiCard
                    icon={Truck}
                    label="Not Dispatched"
                    value={notDispatched}
                    sub={notDispatched > 0 ? 'Sold awaiting dispatch' : 'All dispatched'}
                    color={dispatchColor}
                />
            </div>
        </div>
    )
}
