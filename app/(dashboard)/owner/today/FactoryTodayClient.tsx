'use client'

import type { FactoryTodayData } from './actions'
import { TodayKpiStrip } from '@/components/factory-today/TodayKpiStrip'
import { ProductionStatusCard } from '@/components/factory-today/ProductionStatusCard'
import { MachineAttentionCard } from '@/components/factory-today/MachineAttentionCard'
import { WorkAtRiskCard } from '@/components/factory-today/WorkAtRiskCard'
import { SoldNotDispatchedCard } from '@/components/factory-today/SoldNotDispatchedCard'
import { PendingReceiptsCard } from '@/components/factory-today/PendingReceiptsCard'
import { PayrollHisaabCard } from '@/components/factory-today/PayrollHisaabCard'
import { QuickActionsCard } from '@/components/factory-today/QuickActionsCard'
import { SetupPanel, SetupFloatingButton } from '@/components/factory-today/SetupPanel'
import { CheckCircle2, Factory } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FactoryTodayClientProps {
    initialData: FactoryTodayData
}

function getDisplayDate(date: string) {
    const [year, month, day] = date.split('-').map(Number)

    if ([year, month, day].every(Number.isFinite)) {
        return new Date(year, month - 1, day)
    }

    return new Date(date)
}

function HeaderDateBadge({
    weekdayLabel,
    dayMonthLabel,
    fullDateLabel,
    className,
}: {
    weekdayLabel: string
    dayMonthLabel: string
    fullDateLabel: string
    className?: string
}) {
    return (
        <div
            className={cn(
                'shrink-0 rounded-xl border border-saffron/20 bg-canvas/85 px-3 py-2 text-right shadow-sm backdrop-blur-sm',
                className
            )}
            aria-label={fullDateLabel}
        >
            <p className="text-[11px] font-bold uppercase leading-none text-saffron-deep">{weekdayLabel}</p>
            <p className="mt-1 text-lg font-bold leading-none text-ink">{dayMonthLabel}</p>
        </div>
    )
}

function AllClearState() {
    return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-success/20 bg-success-soft px-6 py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-success/30 bg-success/10">
                <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-success">Factory is clear today.</h2>
            <p className="max-w-sm text-sm text-body">
                Production has been logged, the ledger is current, no dispatches pending, and payroll is up to date.
            </p>
        </div>
    )
}

export function FactoryTodayClient({ initialData }: FactoryTodayClientProps) {
    const data = initialData
    const { actionCounts } = data

    const displayDate = getDisplayDate(data.date)
    const dateLabel = displayDate.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'Asia/Kolkata',
    })
    const weekdayLabel = displayDate.toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' })
    const dayMonthLabel = displayDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        timeZone: 'Asia/Kolkata',
    })

    // All-clear: every actionable item must be resolved.
    const isAllClear =
        data.production.hasLogsToday &&
        data.machines.unassigned === 0 &&
        data.workAtRisk.ordersBehindPace.length === 0 &&
        data.workAtRisk.inactiveMarketRuns.length === 0 &&
        data.dispatch.soldNotDispatched.length === 0 &&
        data.dispatch.pendingReceipts.length === 0 &&
        (!data.payroll.isPayWindowOpen || data.payroll.unsettledWorkerCount === 0) &&
        data.payroll.pendingAdvanceTotal === 0

    // Setup panel visibility — check if any setup step is incomplete
    // Note: fixed_worker skip is handled client-side in SetupPanel via localStorage
    const setupChecklist = data.setupChecklist
    const activationChecklist = data.activationChecklist
    const hasFirstRunCosting = !!(
        setupChecklist.hasQuality &&
        (activationChecklist?.hasEstimate || activationChecklist?.hasOrder || activationChecklist?.hasMarketRun)
    )
    const hasStartedFirstRun = data.productionMode === 'market_run'
        ? !!activationChecklist?.hasMarketRun
        : data.productionMode === 'order_based'
            ? !!activationChecklist?.hasOrder
            : !!(activationChecklist?.hasOrder || activationChecklist?.hasMarketRun)
    const hasAnyIncompleteSetup = !setupChecklist.hasProductionMode ||
        !setupChecklist.hasMachine ||
        !setupChecklist.hasLoomAssignment ||
        !setupChecklist.hasLoomTarget ||
        !setupChecklist.hasQuality ||
        !setupChecklist.hasMeterWorker ||
        !setupChecklist.hasSupervisor ||
        !setupChecklist.hasPayrollConfig ||
        !setupChecklist.hasPlan ||
        !hasFirstRunCosting ||
        !hasStartedFirstRun ||
        (data.productionMode === 'market_run' && !activationChecklist?.hasStockEntry) ||
        !activationChecklist?.hasProductionLog ||
        !activationChecklist?.hasDispatch ||
        !activationChecklist?.hasCommercial
    // hasFixedWorker is skippable so we don't include it in the server check —
    // the SetupPanel component handles it via localStorage
    const showSetupPanel = hasAnyIncompleteSetup || !setupChecklist.hasFixedWorker

    return (
        <div className="min-w-0 space-y-6">
            {/* Page Header */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-saffron/30 bg-saffron/10">
                            <Factory className="h-5 w-5 text-saffron" />
                        </div>
                        <h1 className="min-w-0 text-xl font-bold leading-tight text-ink">Factory Today</h1>
                    </div>
                    <HeaderDateBadge
                        weekdayLabel={weekdayLabel}
                        dayMonthLabel={dayMonthLabel}
                        fullDateLabel={dateLabel}
                        className="sm:hidden"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                    <HeaderDateBadge
                        weekdayLabel={weekdayLabel}
                        dayMonthLabel={dayMonthLabel}
                        fullDateLabel={dateLabel}
                        className="hidden sm:block"
                    />

                    {/* Action summary pill */}
                    {(actionCounts.critical > 0 || actionCounts.warning > 0) && (
                        <div className="flex items-center gap-2">
                            {actionCounts.critical > 0 && (
                                <span className="rounded-full border border-risk/30 bg-risk-soft px-3 py-1 text-xs font-bold text-risk">
                                    {actionCounts.critical} critical
                                </span>
                            )}
                            {actionCounts.warning > 0 && (
                                <span className="rounded-full border border-warning/30 bg-warning-soft px-3 py-1 text-xs font-bold text-warning">
                                    {actionCounts.warning} warnings
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* KPI Strip */}
            <TodayKpiStrip
                productionMode={data.productionMode}
                production={data.production}
                machines={data.machines}
                dispatch={data.dispatch}
                actionCounts={data.actionCounts}
            />

            {/* All clear state */}
            {isAllClear && <AllClearState />}

            {/* Main Grid — 3 columns when setup panel is active, 2 columns otherwise */}
            {!isAllClear && (
                <div className={cn(
                    'grid min-w-0 gap-4',
                    showSetupPanel
                        ? 'xl:grid-cols-2 min-[1440px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(320px,340px)]'
                        : 'xl:grid-cols-2'
                )}>
                    {/* Left Column */}
                    <div className="min-w-0 space-y-4">
                        <ProductionStatusCard production={data.production} />
                        <MachineAttentionCard machines={data.machines} />
                        <WorkAtRiskCard workAtRisk={data.workAtRisk} productionMode={data.productionMode} />
                    </div>

                    {/* Middle Column */}
                    <div className="min-w-0 space-y-4">
                        <SoldNotDispatchedCard sales={data.dispatch.soldNotDispatched} />
                        <PendingReceiptsCard receipts={data.dispatch.pendingReceipts} />
                        <PayrollHisaabCard payroll={data.payroll} />
                        <QuickActionsCard productionMode={data.productionMode} />
                    </div>

                    {/* Right Column — Setup Panel (desktop only) */}
                    {showSetupPanel && (
                        <div className="min-w-0 xl:col-span-2 min-[1440px]:col-span-1">
                            <SetupPanel
                                checklist={setupChecklist}
                                activationChecklist={data.activationChecklist}
                                productionMode={data.productionMode}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Setup panel for all-clear state — still show setup if incomplete */}
            {isAllClear && showSetupPanel && (
                <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,340px)]">
                    <QuickActionsCard productionMode={data.productionMode} />
                    <SetupPanel
                        checklist={setupChecklist}
                        activationChecklist={data.activationChecklist}
                        productionMode={data.productionMode}
                    />
                </div>
            )}

            {/* Quick Actions always visible on all-clear (without setup panel) */}
            {isAllClear && !showSetupPanel && (
                <QuickActionsCard productionMode={data.productionMode} />
            )}

            {/* Mobile floating setup button */}
            {showSetupPanel && (
                <SetupFloatingButton
                    checklist={setupChecklist}
                    activationChecklist={data.activationChecklist}
                    productionMode={data.productionMode}
                />
            )}
        </div>
    )
}
