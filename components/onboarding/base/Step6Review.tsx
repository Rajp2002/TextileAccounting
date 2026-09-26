'use client'

import React from 'react'
import {
    AlertCircle,
    Edit3,
    Sparkles,
    Building2,
    Cpu,
    Users,
    Calendar,
    Sliders,
} from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import type {
    BaseOnboardingDraft,
    BaseOnboardingStep,
    FactoryReadiness,
} from '@/lib/base-onboarding'
import { getMachineTypeLabel } from '@/lib/base-onboarding'

interface Step6ReviewProps {
    draft: BaseOnboardingDraft
    readiness: FactoryReadiness
    onEditStep: (step: BaseOnboardingStep) => void
    error?: string
}

export function Step6Review({
    draft,
    onEditStep,
    error,
}: Step6ReviewProps) {
    const { tx } = useTranslation()

    // Calculate live counts from draft
    let totalDraftMachines = 0
    const machineTypeBreakdown: Array<{ type: string; label: string; count: number }> = []
    for (const [type, rows] of Object.entries(draft.machines)) {
        const count = rows.filter(r => r.name && r.name.trim().length > 0).length
        if (count > 0) {
            machineTypeBreakdown.push({
                type,
                label: getMachineTypeLabel(type),
                count,
            })
            totalDraftMachines += count
        }
    }

    const draftPieceRateCount = draft.workers.pieceRate.filter(w => w.name && w.name.trim().length > 0).length
    const draftFixedSalaryCount = draft.workers.fixedSalary.filter(w => w.name && w.name.trim().length > 0).length
    const totalDraftWorkers = draftPieceRateCount + draftFixedSalaryCount

    const payrollDescription =
        draft.payroll.cycleType === 'monthly'
            ? `Monthly (${draft.payroll.anchorDay || 1}${draft.payroll.anchorDay === 1 ? 'st' : draft.payroll.anchorDay === 2 ? 'nd' : draft.payroll.anchorDay === 3 ? 'rd' : 'th'} of month)`
            : draft.payroll.cycleType === 'weekly'
            ? `Weekly (${(draft.payroll.anchorWeekday || 'monday').toUpperCase()})`
            : `${draft.payroll.intervalDays || 14}-day recurring cycle`

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <div className="space-y-2 text-center sm:text-left">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{tx('Step 6 of 6 · Factory Readiness Review')}</span>
                </div>

                <h2 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 sm:text-3xl">
                    {tx('Your factory setup summary')}
                </h2>
                <p className="text-sm text-stone-600 dark:text-stone-400">
                    {tx('Review your configuration before activating your Base workspace. You can edit any section at any time.')}
                </p>
            </div>

            <div className="space-y-4">
                {/* 1. Factory Profile */}
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900 sm:p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <Building2 className="h-5 w-5 text-amber-600" />
                            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                                {tx('Factory Profile')}
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => onEditStep('factory')}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                        >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>{tx('Edit')}</span>
                        </button>
                    </div>

                    <div className="mt-3 grid gap-2 border-t border-stone-100 pt-3 text-xs text-stone-600 dark:border-stone-800 dark:text-stone-400 sm:grid-cols-2">
                        <div>
                            <span className="font-semibold text-stone-700 dark:text-stone-300">{tx('Factory Name')}:</span>{' '}
                            <span className="font-medium text-stone-900 dark:text-stone-100">{draft.factory.name || '—'}</span>
                        </div>
                        {draft.factory.ownerContact && (
                            <div>
                                <span className="font-semibold text-stone-700 dark:text-stone-300">{tx('Contact')}:</span>{' '}
                                <span className="font-medium text-stone-900 dark:text-stone-100">{draft.factory.ownerContact}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Factory & Costing Defaults */}
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900 sm:p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <Sliders className="h-5 w-5 text-amber-600" />
                            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                                {tx('Factory & Costing Defaults')}
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => onEditStep('defaults')}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                        >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>{tx('Edit')}</span>
                        </button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-stone-100 pt-3 text-xs text-stone-600 dark:border-stone-800 dark:text-stone-400 sm:grid-cols-3">
                        <div>
                            <span className="text-stone-500">{tx('Wastage')}:</span>{' '}
                            <span className="font-bold text-stone-900 dark:text-stone-100">{draft.defaults.yarnShortagePct}%</span>
                        </div>
                        <div>
                            <span className="text-stone-500">{tx('Margin')}:</span>{' '}
                            <span className="font-bold text-stone-900 dark:text-stone-100">{draft.defaults.defaultMarginPct}%</span>
                        </div>
                        <div>
                            <span className="text-stone-500">{tx('Overhead')}:</span>{' '}
                            <span className="font-medium text-stone-900 dark:text-stone-100">
                                {draft.defaults.overheadMode === 'direct' ? tx('Direct') : tx('Monthly Allocation')}
                            </span>
                        </div>
                        <div>
                            <span className="text-stone-500">{tx('Warping')}:</span>{' '}
                            <span className="font-medium text-stone-900 dark:text-stone-100">
                                {draft.defaults.warpingMode === 'in_house' ? tx('In-house') : tx('Outsourced')}
                            </span>
                        </div>
                        <div>
                            <span className="text-stone-500">{tx('Sizing')}:</span>{' '}
                            <span className="font-medium text-stone-900 dark:text-stone-100">
                                {draft.defaults.sizingMode === 'in_house' ? tx('In-house') : tx('Outsourced')}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3. Machines */}
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900 sm:p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <Cpu className="h-5 w-5 text-amber-600" />
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                                    {tx('Machines')}
                                </h3>
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                    {totalDraftMachines} {tx('machines')}
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => onEditStep('machines')}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                        >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>{tx('Edit')}</span>
                        </button>
                    </div>

                    <div className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-600 dark:border-stone-800 dark:text-stone-400">
                        {machineTypeBreakdown.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {machineTypeBreakdown.map(m => (
                                    <span key={m.type} className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2.5 py-1 font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                                        <span>{tx(m.label)}:</span>
                                        <span className="font-bold text-stone-900 dark:text-stone-100">{m.count}</span>
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-stone-400">
                                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                <span>{tx('No machines added yet. You can add them later in Machines.')}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. Workforce */}
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900 sm:p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <Users className="h-5 w-5 text-amber-600" />
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                                    {tx('Workforce')}
                                </h3>
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                    {totalDraftWorkers} {tx('workers')}
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => onEditStep('workers')}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                        >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>{tx('Edit')}</span>
                        </button>
                    </div>

                    <div className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-600 dark:border-stone-800 dark:text-stone-400">
                        {totalDraftWorkers > 0 ? (
                            <div className="flex gap-4">
                                <div>
                                    <span className="text-stone-500">{tx('Piece Rate')}:</span>{' '}
                                    <span className="font-bold text-stone-900 dark:text-stone-100">{draftPieceRateCount}</span>
                                </div>
                                <div>
                                    <span className="text-stone-500">{tx('Fixed Salary')}:</span>{' '}
                                    <span className="font-bold text-stone-900 dark:text-stone-100">{draftFixedSalaryCount}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-stone-400">
                                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                <span>{tx('No workers added yet. You can add them later in Workforce.')}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 5. Payroll Cycle */}
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900 sm:p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <Calendar className="h-5 w-5 text-amber-600" />
                            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                                {tx('Payroll Cycle')}
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => onEditStep('payroll')}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                        >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>{tx('Edit')}</span>
                        </button>
                    </div>

                    <div className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-600 dark:border-stone-800 dark:text-stone-400">
                        <span className="font-semibold text-stone-900 dark:text-stone-100">
                            {tx(payrollDescription)}
                        </span>
                    </div>
                </div>

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        {tx(error)}
                    </div>
                )}
            </div>
        </div>
    )
}
