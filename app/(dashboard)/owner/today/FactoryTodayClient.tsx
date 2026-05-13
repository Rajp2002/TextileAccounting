'use client'

import type { FactoryTodayData } from './actions'
import { TodayKpiStrip } from '@/components/factory-today/TodayKpiStrip'
import { ProductionStatusCard } from '@/components/factory-today/ProductionStatusCard'
import { MachineAttentionCard } from '@/components/factory-today/MachineAttentionCard'
import { WorkAtRiskCard } from '@/components/factory-today/WorkAtRiskCard'
import { PendingStockDraftsCard } from '@/components/factory-today/PendingStockDraftsCard'
import { SoldNotDispatchedCard } from '@/components/factory-today/SoldNotDispatchedCard'
import { PendingReceiptsCard } from '@/components/factory-today/PendingReceiptsCard'
import { PayrollHisaabCard } from '@/components/factory-today/PayrollHisaabCard'
import { QuickActionsCard } from '@/components/factory-today/QuickActionsCard'
import { ActivationChecklistCard } from '@/components/factory-today/ActivationChecklistCard'
import { CheckCircle2, Factory } from 'lucide-react'

interface FactoryTodayClientProps {
    initialData: FactoryTodayData
}

function AllClearState() {
    return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-success/20 bg-success-soft px-6 py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-success/30 bg-success/10">
                <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-success">Factory is clear today.</h2>
            <p className="max-w-sm text-sm text-body">
                Production has been logged, stock is confirmed, no dispatches pending, and payroll is up to date.
            </p>
        </div>
    )
}

export function FactoryTodayClient({ initialData }: FactoryTodayClientProps) {
    const data = initialData
    const { actionCounts } = data

    const dateLabel = new Date(data.date).toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    })

    // All-clear: every actionable item must be resolved.
    // Adding night shift to the check would be too strict (many factories run day-only).
    // We check: production logged, all looms assigned, no risks, no pending stock/dispatch, no pending advances.
    const isAllClear =
        data.production.hasLogsToday &&
        data.machines.unassigned === 0 &&
        data.workAtRisk.ordersBehindPace.length === 0 &&
        data.workAtRisk.inactiveMarketRuns.length === 0 &&
        data.stock.pendingInwardDrafts.length === 0 &&
        data.dispatch.soldNotDispatched.length === 0 &&
        data.dispatch.pendingReceipts.length === 0 &&
        data.payroll.pendingAdvanceTotal === 0
    const checklist = data.activationChecklist || {
        hasEstimate: false,
        hasQuality: false,
        hasOrder: false,
        hasProductionLog: false,
        hasStockEntry: false,
    }

    const isCollapsed = checklist.hasEstimate && checklist.hasQuality
    const isHidden = checklist.hasEstimate && checklist.hasQuality && (checklist.hasOrder || checklist.hasProductionLog)

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-saffron/30 bg-saffron/10">
                        <Factory className="h-5 w-5 text-saffron" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-ink">Factory Today</h1>
                        <p className="text-sm text-muted">{dateLabel}</p>
                    </div>
                </div>

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

            {/* Activation Checklist */}
            {!isHidden && (
                <ActivationChecklistCard checklist={checklist} isCollapsed={isCollapsed} />
            )}

            {/* KPI Strip */}
            <TodayKpiStrip
                production={data.production}
                machines={data.machines}
                stock={data.stock}
                dispatch={data.dispatch}
                actionCounts={data.actionCounts}
            />

            {/* All clear state */}
            {isAllClear && <AllClearState />}

            {/* Main Grid */}
            {!isAllClear && (
                <div className="grid gap-4 lg:grid-cols-2">
                    {/* Left Column */}
                    <div className="space-y-4">
                        <ProductionStatusCard production={data.production} />
                        <MachineAttentionCard machines={data.machines} />
                        <WorkAtRiskCard workAtRisk={data.workAtRisk} />
                        <PendingStockDraftsCard drafts={data.stock.pendingInwardDrafts} />
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                        <SoldNotDispatchedCard sales={data.dispatch.soldNotDispatched} />
                        <PendingReceiptsCard receipts={data.dispatch.pendingReceipts} />
                        <PayrollHisaabCard payroll={data.payroll} />
                        <QuickActionsCard />
                    </div>
                </div>
            )}

            {/* Quick Actions always visible on all-clear */}
            {isAllClear && (
                <QuickActionsCard />
            )}
        </div>
    )
}
