import { formatInTimeZone, toZonedTime } from 'date-fns-tz'

export const SURAT_TIMEZONE = 'Asia/Kolkata'

/**
 * Returns a new Date object representing the current moment, 
 * but safely mapped to the Asia/Kolkata timezone context for calculating "Today".
 */
export function getSuratDate(): Date {
    // Current UTC moment
    const now = new Date()
    // Convert to a Date object that internally represents the local time in Surat
    return toZonedTime(now, SURAT_TIMEZONE)
}

/**
 * Formats a Date object specifically in the Surat timezone.
 * Example: formatToSurat(new Date(), 'yyyy-MM-dd') -> "2026-03-31" (even if server is in UTC and it's 11PM Mar 30)
 */
export function formatToSurat(date: Date | number | string, pattern: string): string {
    return formatInTimeZone(date, SURAT_TIMEZONE, pattern)
}

export function formatSuratDateTime(date: Date | number | string): string {
    return `${formatToSurat(date, 'd MMM yyyy, h:mm a')} IST`
}

/**
 * Helper to get strictly today's date formatted as YYYY-MM-DD in Surat.
 * Use this when checking attendance bounds or defaults.
 */
export function getSuratTodayString(): string {
    return formatToSurat(new Date(), 'yyyy-MM-dd')
}

export function getSuratMonthToDateBounds(now: Date | number | string = new Date()) {
    const end = formatToSurat(now, 'yyyy-MM-dd')
    return {
        start: `${end.slice(0, 7)}-01`,
        end,
    }
}

export function getCurrentSuratHour(): number {
    return Number(formatToSurat(new Date(), 'H'))
}

export function getCurrentSuratYear(): string {
    return formatToSurat(new Date(), 'yyyy')
}

export function getCurrentTimestampMs(): number {
    return Date.now()
}

export function getCurrentIsoString(): string {
    return new Date().toISOString()
}

/**
 * Helper to get strictly yesterday's date formatted as YYYY-MM-DD in Surat.
 * Fixes timezone drift where yesterday might compute incorrectly.
 */
export function getSuratYesterdayString(): string {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return formatToSurat(yesterday, 'yyyy-MM-dd')
}

/**
 * Checks if a specific date/time string is strictly "in the past or today" based on Surat bounds. 
 */
export function isBeforeOrTodayInSurat(dateString: string): boolean {
    const todaySurat = getSuratTodayString()
    return dateString <= todaySurat
}
