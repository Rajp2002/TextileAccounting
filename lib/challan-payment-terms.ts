/** Calendar-date comparisons use the business timezone, not elapsed 24-hour periods. */
export function businessDate(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(now)
}
export function validPaymentDueDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000'))
        return false
    const parsed = new Date(`${value}T00:00:00Z`)
    return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
    )
}
export function challanDueStatus(
    d: {
        payment_due_date?: string | null
        balance: number
        delivery_status: string
    },
    today = businessDate(),
) {
    if (
        d.delivery_status === 'draft' ||
        d.delivery_status === 'reversed' ||
        Number(d.balance) <= 0
    )
        return null
    if (!d.payment_due_date || !validPaymentDueDate(d.payment_due_date))
        return { kind: 'dueDateNotSet' as const, days: 0 }
    const days = Math.round(
        (Date.parse(`${d.payment_due_date}T00:00:00Z`) -
            Date.parse(`${today}T00:00:00Z`)) /
            86400000,
    )
    return {
        kind:
            days < 0
                ? ('overdueDays' as const)
                : days === 0
                  ? ('dueToday' as const)
                  : ('dueInDays' as const),
        days: Math.abs(days),
    }
}
