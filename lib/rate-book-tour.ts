import type { RatebookTutorialField } from './i18n/rate-book-tutorial'

// Core lessons must survive an empty list, active filters and hidden desktop rails.
// Targets provide a spotlight when available; they never determine lesson inclusion.
export const RATE_BOOK_TOUR_STEPS: { section: number; field: RatebookTutorialField }[] = [
    { section: 0, field: 'overview' },
    { section: 1, field: 'yarnSearch' },
    { section: 2, field: 'linkedQualitiesPopover' },
    { section: 3, field: 'quickEditAction' },
    { section: 4, field: 'reviewStatusBadge' },
    { section: 5, field: 'immutabilityNotice' },
]

export const RATE_BOOK_HELP_FIELDS: RatebookTutorialField[] = [
    'directionFilter',
    'quickReviewAction',
    'rateAndTrend',
    'rateDrawerFields',
    'reviewRailWidget',
    'activityAndArchive',
]

const RATE_BOOK_ACTION_LABELS = {
    addRate: 'Add Yarn Rate',
    editRate: 'Edit rate',
    saveRate: 'Save Rate',
    advancedEdit: 'Advanced edit',
    effectiveDate: 'Effective from',
    reviewDate: 'Review date',
    reviewEvery: 'Review every',
    activity: 'Activity',
    archiveRate: 'Archive rate',
    archivedRates: 'Archived rates',
    restoreRate: 'Restore rate',
} as const

// Resolve action names through the same phrase translator as the real controls.
export function formatRateBookTourText(text: string, tx: (phrase: string) => string): string {
    return Object.entries(RATE_BOOK_ACTION_LABELS).reduce(
        (result, [token, label]) => result.replaceAll(`{${token}}`, tx(label)),
        text,
    )
}
