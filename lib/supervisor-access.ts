// Client-safe constants and helpers for Base supervisors. Authorization lives
// in the database functions; nothing here grants access.

export const SUPERVISOR_HOME_PATH = '/supervisor'
export const SUPERVISOR_SHEET_PATH = '/supervisor/daily-sheet'
export const SUPERVISOR_JOIN_PATH = '/join'

const JOIN_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/

/** What people type: any case, spaces, and the display hyphen. */
export function normalizeJoinCode(input: string): string {
    return input.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

export function isValidJoinCode(code: string): boolean {
    return JOIN_CODE_PATTERN.test(code)
}

export function formatJoinCode(code: string): string {
    return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code
}

/** Supervisors record the Surat-date `today` and the day before it. */
export function supervisorDateWindow(today: string): { min: string; max: string } {
    const [year, month, day] = today.split('-').map(Number)
    const previous = new Date(Date.UTC(year, month - 1, day - 1))
    return { min: previous.toISOString().slice(0, 10), max: today }
}
