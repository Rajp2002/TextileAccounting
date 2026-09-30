import type { TourStepSpec } from './tours/tour-types'

export const dailySheetTourSteps = ['ds-sheet', 'ds-shift', 'ds-reading', 'ds-pending', 'ds-earnings', 'ds-draft', 'ds-save', 'ds-correct', 'ds-handoff'] as const
export type DailySheetTourStep = typeof dailySheetTourSteps[number]

export function dailySheetTourSelector(step: DailySheetTourStep, empty = false) {
    if (step === 'ds-handoff') return `[data-tour-anchor="daily.${empty ? 'empty-action' : 'first-reading'}"]`
    return `[data-daily-tour="${step === 'ds-earnings' ? 'review' : step.slice(3)}"]`
}

export function dailySheetTourSpecs(empty: boolean): readonly TourStepSpec<DailySheetTourStep>[] {
    return dailySheetTourSteps.map(id => ({
        id, anchor: dailySheetTourSelector(id, empty), kind: id === 'ds-handoff' ? 'handoff' : 'sample',
        ...(['ds-earnings', 'ds-correct'].includes(id) ? { context: '[data-daily-tour-preview="true"]' } : {}),
        ...(!['ds-draft', 'ds-handoff'].includes(id) ? { detail: true } : {}),
    }))
}

/** Display values only; never used as business records or action payloads. */
export const dailySheetTourExample = { date: '2026-09-16', metres: 120, rate: 2, earnings: 240 } as const
