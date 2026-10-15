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
import { getMachineTypeLabel, onboardingCycleRule } from '@/lib/base-onboarding'
import { formatGoLiveDate, nextGoLiveDate } from '@/lib/base-go-live'
import { validateCycleRule } from '@/lib/payroll-cycle-engine'
import { getSuratTodayString } from '@/lib/time'

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
    const { tx, t, language } = useTranslation()
    // Daily recording starts at the next start of the chosen cycle, the date completing setup schedules.
    const today = getSuratTodayString()
    const goLiveRule = validateCycleRule(onboardingCycleRule(draft.payroll, today)).normalizedRule
    const goLiveDate = goLiveRule ? nextGoLiveDate(today, goLiveRule) : null

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
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wv-moss-200)] bg-[var(--wv-moss-50)] px-3 py-1 text-xs font-semibold text-[var(--wv-moss-700)]">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{tx('Step 6 of 6 · Factory Readiness Review')}</span>
                </div>

                <h2 className="text-2xl font-bold tracking-tight text-[var(--wv-neel-900)] sm:text-3xl">
                    {tx('Your factory setup summary')}
                </h2>
                <p className="text-sm text-[var(--wv-neel-700)]">
                    {tx('Review your configuration before activating your Base workspace. You can edit any section at any time.')}
                </p>
            </div>

            <div className="space-y-4">
                {/* 1. Factory Profile */}
                <div className="rounded-2xl border border-[var(--wv-cotton-400)] bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <Building2 className="h-5 w-5 text-[var(--wv-brand-accent-strong)]" />
                            <h3 className="text-sm font-bold text-[var(--wv-neel-900)]">
                                {tx('Factory Profile')}
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => onEditStep('factory')}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--wv-brand-accent-strong)] hover:bg-[var(--wv-saffron-50)]"
                        >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>{tx('Edit')}</span>
                        </button>
                    </div>

                    <div className="mt-3 grid gap-2 border-t border-[var(--wv-cotton-200)] pt-3 text-xs text-[var(--wv-neel-700)] sm:grid-cols-2">
                        <div>
                            <span className="font-semibold text-[var(--wv-neel-800)]">{tx('Factory Name')}:</span>{' '}
                            <span className="font-medium text-[var(--wv-neel-900)]">{draft.factory.name || '—'}</span>
                        </div>
                        {draft.factory.ownerContact && (
                            <div>
                                <span className="font-semibold text-[var(--wv-neel-800)]">{tx('Contact')}:</span>{' '}
                                <span className="font-medium text-[var(--wv-neel-900)]">{draft.factory.ownerContact}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Factory & Costing Defaults */}
                <div className="rounded-2xl border border-[var(--wv-cotton-400)] bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <Sliders className="h-5 w-5 text-[var(--wv-brand-accent-strong)]" />
                            <h3 className="text-sm font-bold text-[var(--wv-neel-900)]">
                                {tx('Factory & Costing Defaults')}
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => onEditStep('defaults')}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--wv-brand-accent-strong)] hover:bg-[var(--wv-saffron-50)]"
                        >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>{tx('Edit')}</span>
                        </button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--wv-cotton-200)] pt-3 text-xs text-[var(--wv-neel-700)] sm:grid-cols-3">
                        <div>
                            <span className="text-[var(--wv-neel-600)]">{tx('Wastage')}:</span>{' '}
                            <span className="font-bold text-[var(--wv-neel-900)]">{draft.defaults.yarnShortagePct}%</span>
                        </div>
                        <div>
                            <span className="text-[var(--wv-neel-600)]">{tx('Margin')}:</span>{' '}
                            <span className="font-bold text-[var(--wv-neel-900)]">{draft.defaults.defaultMarginPct}%</span>
                        </div>
                        <div>
                            <span className="text-[var(--wv-neel-600)]">{tx('Overhead')}:</span>{' '}
                            <span className="font-medium text-[var(--wv-neel-900)]">
                                {draft.defaults.overheadMode === 'direct' ? tx('Direct') : tx('Monthly Allocation')}
                            </span>
                        </div>
                        <div>
                            <span className="text-[var(--wv-neel-600)]">{tx('Warping')}:</span>{' '}
                            <span className="font-medium text-[var(--wv-neel-900)]">
                                {draft.defaults.warpingMode === 'in_house' ? tx('In-house') : tx('Outsourced')}
                            </span>
                        </div>
                        <div>
                            <span className="text-[var(--wv-neel-600)]">{tx('Sizing')}:</span>{' '}
                            <span className="font-medium text-[var(--wv-neel-900)]">
                                {draft.defaults.sizingMode === 'in_house' ? tx('In-house') : tx('Outsourced')}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3. Machines */}
                <div className="rounded-2xl border border-[var(--wv-cotton-400)] bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <Cpu className="h-5 w-5 text-[var(--wv-brand-accent-strong)]" />
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-[var(--wv-neel-900)]">
                                    {tx('Machines')}
                                </h3>
                                <span className="rounded-full bg-[var(--wv-saffron-100)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--wv-brand-ink)]">
                                    {totalDraftMachines} {tx('machines')}
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => onEditStep('machines')}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--wv-brand-accent-strong)] hover:bg-[var(--wv-saffron-50)]"
                        >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>{tx('Edit')}</span>
                        </button>
                    </div>

                    <div className="mt-3 border-t border-[var(--wv-cotton-200)] pt-3 text-xs text-[var(--wv-neel-700)]">
                        {machineTypeBreakdown.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {machineTypeBreakdown.map(m => (
                                    <span key={m.type} className="inline-flex items-center gap-1 rounded-md bg-[var(--wv-cotton-200)] px-2.5 py-1 font-medium text-[var(--wv-neel-800)]">
                                        <span>{tx(m.label)}:</span>
                                        <span className="font-bold text-[var(--wv-neel-900)]">{m.count}</span>
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-[var(--wv-neel-600)]">
                                <AlertCircle className="h-3.5 w-3.5 text-[var(--wv-ochre-700)]" />
                                <span>{tx('No machines added yet. You can add them later in Machines.')}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. Workforce */}
                <div className="rounded-2xl border border-[var(--wv-cotton-400)] bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <Users className="h-5 w-5 text-[var(--wv-brand-accent-strong)]" />
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-[var(--wv-neel-900)]">
                                    {tx('Workforce')}
                                </h3>
                                <span className="rounded-full bg-[var(--wv-saffron-100)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--wv-brand-ink)]">
                                    {totalDraftWorkers} {tx('workers')}
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => onEditStep('workers')}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--wv-brand-accent-strong)] hover:bg-[var(--wv-saffron-50)]"
                        >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>{tx('Edit')}</span>
                        </button>
                    </div>

                    <div className="mt-3 border-t border-[var(--wv-cotton-200)] pt-3 text-xs text-[var(--wv-neel-700)]">
                        {totalDraftWorkers > 0 ? (
                            <div className="flex gap-4">
                                <div>
                                    <span className="text-[var(--wv-neel-600)]">{tx('Piece Rate')}:</span>{' '}
                                    <span className="font-bold text-[var(--wv-neel-900)]">{draftPieceRateCount}</span>
                                </div>
                                <div>
                                    <span className="text-[var(--wv-neel-600)]">{tx('Fixed Salary')}:</span>{' '}
                                    <span className="font-bold text-[var(--wv-neel-900)]">{draftFixedSalaryCount}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-[var(--wv-neel-600)]">
                                <AlertCircle className="h-3.5 w-3.5 text-[var(--wv-ochre-700)]" />
                                <span>{tx('No workers added yet. You can add them later in Workforce.')}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 5. Payroll Cycle */}
                <div className="rounded-2xl border border-[var(--wv-cotton-400)] bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <Calendar className="h-5 w-5 text-[var(--wv-brand-accent-strong)]" />
                            <h3 className="text-sm font-bold text-[var(--wv-neel-900)]">
                                {tx('Payroll Cycle')}
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => onEditStep('payroll')}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--wv-brand-accent-strong)] hover:bg-[var(--wv-saffron-50)]"
                        >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>{tx('Edit')}</span>
                        </button>
                    </div>

                    <div className="mt-3 border-t border-[var(--wv-cotton-200)] pt-3 text-xs text-[var(--wv-neel-700)]">
                        <span className="font-semibold text-[var(--wv-neel-900)]">
                            {tx(payrollDescription)}
                        </span>
                        {goLiveDate && (
                            <p className="mt-1.5" data-i18n-skip="true">{t('goLive.wizardStarts', { date: formatGoLiveDate(goLiveDate, language) })}</p>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="rounded-lg border border-[var(--wv-madder-200)] bg-[var(--wv-madder-50)] p-3 text-sm text-[var(--wv-madder-700)]">
                        {tx(error)}
                    </div>
                )}
            </div>
        </div>
    )
}
