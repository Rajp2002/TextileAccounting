import { getSuratTodayString } from '../time'

export type CommercialDueBucket = 'overdue' | 'due_today' | 'due_this_week' | 'upcoming' | 'paid'

export interface CommercialDueBucketInput {
    due_date?: string | null
    payment_status?: string | null
    balance_amount?: number | null
}

export function normalizeCommercialDateOnly(value?: Date | string | null): string {
    if (!value) return ''
    if (value instanceof Date) {
        const y = value.getFullYear()
        const m = String(value.getMonth() + 1).padStart(2, '0')
        const d = String(value.getDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
    }
    return value.split('T')[0].split(' ')[0]
}

function epochDay(dateString: string): number | null {
    const [year, month, day] = normalizeCommercialDateOnly(dateString).split('-').map(Number)
    if (![year, month, day].every(Number.isFinite)) return null
    return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

export function daysBetweenCommercialDates(fromDate: string, toDate: string): number {
    const from = epochDay(fromDate)
    const to = epochDay(toDate)
    if (from == null || to == null) return 0
    return to - from
}

export function getCommercialDueBucket(
    receivable: CommercialDueBucketInput,
    today = getSuratTodayString()
): CommercialDueBucket {
    const balance = Number(receivable.balance_amount ?? 0)
    if (receivable.payment_status === 'paid' || balance <= 0) {
        return 'paid'
    }

    const due = normalizeCommercialDateOnly(receivable.due_date)
    if (!due) return 'upcoming'

    const todayStr = normalizeCommercialDateOnly(today)
    if (due < todayStr) return 'overdue'
    if (due === todayStr) return 'due_today'

    const diffDays = daysBetweenCommercialDates(todayStr, due)
    if (diffDays > 0 && diffDays <= 7) return 'due_this_week'
    return 'upcoming'
}

export function getCommercialDaysLate(
    receivable: CommercialDueBucketInput,
    today = getSuratTodayString()
): number {
    if (!receivable.due_date || Number(receivable.balance_amount ?? 0) <= 0) return 0
    return Math.max(0, daysBetweenCommercialDates(normalizeCommercialDateOnly(receivable.due_date), normalizeCommercialDateOnly(today)))
}
