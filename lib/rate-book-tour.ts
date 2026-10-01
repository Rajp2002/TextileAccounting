import type { TourStepSpec } from './tours/tour-types'

export const RATE_BOOK_TOUR_STEPS = ['rb-purpose', 'rb-find', 'rb-update', 'rb-review', 'rb-usage', 'rb-handoff'] as const
export type RateBookStep = typeof RATE_BOOK_TOUR_STEPS[number]

export function rateBookTourSpecs(sampleRow: boolean, hasRealRates: boolean): TourStepSpec<RateBookStep>[] {
    const rowKind = sampleRow ? 'sample' : 'live'
    return [
        { id: 'rb-purpose', anchor: '[data-ratebook-field="overview"]', kind: 'live', detail: true },
        { id: 'rb-find', anchor: '[data-ratebook-field="yarnSearch"]', kind: 'live' },
        { id: 'rb-update', anchor: '[data-ratebook-field="quickEditAction"]', kind: rowKind, detail: true },
        { id: 'rb-review', anchor: '[data-ratebook-field="reviewStatusBadge"]', kind: rowKind, detail: true },
        { id: 'rb-usage', anchor: '[data-ratebook-field="linkedQualitiesPopover"]', kind: rowKind },
        // Step 2 already outlines the search box, so the populated handoff outlines the price to compare instead.
        { id: 'rb-handoff', anchor: hasRealRates ? '[data-ratebook-field="rateAndTrend"]' : '[data-ratebook-field="addRateAction"]', kind: 'handoff' },
    ]
}
