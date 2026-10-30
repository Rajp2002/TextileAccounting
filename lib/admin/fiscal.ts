/**
 * India-time calendar helpers for founder metrics (spec 2026-10-30). The financial
 * year runs 1 April to 31 March; its label uses an en dash, e.g. 2026–27.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })

export function indiaDay(at: string): string {
    return dayFormat.format(new Date(at))
}

export function indiaMonth(at: string): string {
    return indiaDay(at).slice(0, 7)
}

export type FinancialYear = { label: string; start: string; end: string }

function yearFromStart(startYear: number): FinancialYear {
    return {
        label: `${startYear}–${String(startYear + 1).slice(2)}`,
        start: new Date(Date.UTC(startYear, 3, 1) - IST_OFFSET_MS).toISOString(),
        end: new Date(Date.UTC(startYear + 1, 3, 1) - IST_OFFSET_MS).toISOString(),
    }
}

export function financialYear(at: string): FinancialYear {
    const [year, month] = indiaDay(at).split('-').map(Number)
    return yearFromStart(month >= 4 ? year : year - 1)
}

/** Parse a label such as 2026–27 (or 2026-27). Returns null for anything else. */
export function financialYearFromLabel(label: string): FinancialYear | null {
    const match = /^(\d{4})[–-](\d{2})$/.exec(label)
    if (!match) return null
    const start = Number(match[1])
    return String(start + 1).slice(2) === match[2] ? yearFromStart(start) : null
}

export function financialYearMonths(label: string): string[] {
    const year = financialYearFromLabel(label)
    if (!year) return []
    const startYear = Number(year.label.slice(0, 4))
    return Array.from({ length: 12 }, (_, index) => {
        const month = index + 4
        return month <= 12 ? `${startYear}-${String(month).padStart(2, '0')}` : `${startYear + 1}-${String(month - 12).padStart(2, '0')}`
    })
}
