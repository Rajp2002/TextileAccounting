import type { BasePlanLocalLanguage } from '../base-plan-phrases'
import { ACCOUNT_PHRASES } from './account'
import { ESTIMATOR_PHRASES } from './estimator'
import { RATE_BOOK_PHRASES } from './rates'
import { SAVED_COSTINGS_PHRASES } from './saved-costings'
import { SETUP_PHRASES } from './setup'
import { VALIDATION_PHRASES } from './validation'

/**
 * Complete Hindi and Gujarati sentences for every Lite screen. Lite routes
 * translate only from complete phrases (lib/i18n/lite-surface.ts), so a
 * sentence missing here shows in English. One file per screen keeps parallel
 * edits apart; __tests__/lite-translation-coverage.test.ts lists anything new
 * that still needs a row. A native review of both languages is still pending.
 */
const ROWS = [
    ...ESTIMATOR_PHRASES,
    ...SAVED_COSTINGS_PHRASES,
    ...SETUP_PHRASES,
    ...RATE_BOOK_PHRASES,
    ...ACCOUNT_PHRASES,
    ...VALIDATION_PHRASES,
]

export const LITE_SCREEN_PHRASES: Record<BasePlanLocalLanguage, Record<string, string>> = {
    hi: Object.fromEntries(ROWS.map(([english, hindi]) => [english, hindi])),
    gu: Object.fromEntries(ROWS.map(([english, , gujarati]) => [english, gujarati])),
}
