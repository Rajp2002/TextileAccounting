/** The spreadsheet downloads on /owner/data-export, in page order. */
export const ACCOUNTANT_CSV_AREAS = [
    'costings',
    'qualities',
    'rate_book',
    'challans',
    'challan_payments',
    'daily_production',
] as const

export type AccountantCsvArea = (typeof ACCOUNTANT_CSV_AREAS)[number]

export function isAccountantCsvArea(value: unknown): value is AccountantCsvArea {
    return typeof value === 'string' && (ACCOUNTANT_CSV_AREAS as readonly string[]).includes(value)
}
