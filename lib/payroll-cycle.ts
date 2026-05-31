import { parse, addMonths, subDays, format, differenceInCalendarDays } from 'date-fns'

function validateCycleStartDay(day: number) {
    if (day < 1 || day > 28) {
        throw new Error('Cycle start day must be between 1 and 28')
    }
}

function validatePayDateDay(day: number) {
    if (day < 1 || day > 28) {
        throw new Error('Pay date day must be between 1 and 28')
    }
}

function validateReminderDays(days: number) {
    if (days < 0 || days > 14) {
        throw new Error('Reminder days must be between 0 and 14')
    }
}

function parseDate(dateStr: string) {
    return parse(dateStr, 'yyyy-MM-dd', new Date())
}

function previousMonth(ym: string) {
    const date = parse(`${ym}-01`, 'yyyy-MM-dd', new Date())
    date.setMonth(date.getMonth() - 1)
    return format(date, 'yyyy-MM')
}

export function getPreviousPayrollMonth(monthStr: string) {
    return previousMonth(monthStr)
}

/**
 * Returns the cycle bounds for a cycle starting in the given month.
 * e.g. For "2026-05" and cycleStartDay 15, returns bounds for 2026-05-15 to 2026-06-14.
 */
export function getPayrollCycleBounds(monthStr: string, cycleStartDay: number) {
    validateCycleStartDay(cycleStartDay)
    
    const date = parse(`${monthStr}-01`, 'yyyy-MM-dd', new Date())
    
    const cycleStart = new Date(date.getFullYear(), date.getMonth(), cycleStartDay)
    const nextCycleStart = addMonths(cycleStart, 1)
    const cycleEnd = subDays(nextCycleStart, 1)
    
    return {
        cycle_start: format(cycleStart, 'yyyy-MM-dd'),
        cycle_end: format(cycleEnd, 'yyyy-MM-dd'),
        next_cycle_start: format(nextCycleStart, 'yyyy-MM-dd')
    }
}

/**
 * Returns the first configured day-of-month after the cycle closes.
 * For a 1st-to-month-end cycle with pay date day 10, January pays on February 10.
 */
export function getPayrollPayDate(cycleEndStr: string, payDateDay: number) {
    validatePayDateDay(payDateDay)

    const cycleEnd = parseDate(cycleEndStr)
    let payDate = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth(), payDateDay)

    if (payDate <= cycleEnd) {
        payDate = addMonths(payDate, 1)
    }

    return format(payDate, 'yyyy-MM-dd')
}

export function getPayrollCycleDetails(monthStr: string, cycleStartDay: number, payDateDay: number) {
    const bounds = getPayrollCycleBounds(monthStr, cycleStartDay)

    return {
        ...bounds,
        pay_date: getPayrollPayDate(bounds.cycle_end, payDateDay),
    }
}

export function getPayrollMonthForDate(dateStr: string, cycleStartDay: number) {
    const bounds = getCycleBoundsForDate(dateStr, cycleStartDay)
    return bounds.cycle_start.substring(0, 7)
}

export function getPayrollCycleStatus(
    monthStr: string,
    cycleStartDay: number,
    payDateDay: number,
    todayStr: string,
    reminderDays = 3
) {
    validateReminderDays(reminderDays)

    const details = getPayrollCycleDetails(monthStr, cycleStartDay, payDateDay)
    const today = parseDate(todayStr)
    const cycleStart = parseDate(details.cycle_start)
    const cycleEnd = parseDate(details.cycle_end)
    const payDate = parseDate(details.pay_date)
    const daysUntilPayDate = differenceInCalendarDays(payDate, today)
    const isCycleStarted = differenceInCalendarDays(today, cycleStart) >= 0
    const isCycleClosed = differenceInCalendarDays(today, cycleEnd) > 0
    const isPayDateDue = daysUntilPayDate <= 0
    const isPayDateApproaching = isCycleClosed && daysUntilPayDate > 0 && daysUntilPayDate <= reminderDays
    const isPayrollWindowOpen = isCycleClosed && (isPayDateDue || isPayDateApproaching)

    let status: 'not_started' | 'in_progress' | 'scheduled' | 'approaching' | 'due_today' | 'overdue'
    if (!isCycleStarted) {
        status = 'not_started'
    } else if (!isCycleClosed) {
        status = 'in_progress'
    } else if (daysUntilPayDate > reminderDays) {
        status = 'scheduled'
    } else if (daysUntilPayDate > 0) {
        status = 'approaching'
    } else if (daysUntilPayDate === 0) {
        status = 'due_today'
    } else {
        status = 'overdue'
    }

    return {
        ...details,
        days_until_pay_date: daysUntilPayDate,
        is_cycle_closed: isCycleClosed,
        is_pay_date_due: isPayDateDue,
        is_pay_date_approaching: isPayDateApproaching,
        is_payroll_window_open: isPayrollWindowOpen,
        status,
    }
}

export function getLatestOpenPayrollMonth(
    todayStr: string,
    cycleStartDay: number,
    payDateDay: number,
    reminderDays = 3
) {
    let month = getPayrollMonthForDate(todayStr, cycleStartDay)

    for (let i = 0; i < 24; i += 1) {
        const status = getPayrollCycleStatus(month, cycleStartDay, payDateDay, todayStr, reminderDays)
        if (status.is_payroll_window_open) {
            return month
        }

        month = previousMonth(month)
    }

    return getPayrollMonthForDate(todayStr, cycleStartDay)
}

/**
 * Returns the cycle bounds for the cycle containing the given date.
 * Matches the logic of the DB RPC `get_cycle_bounds`.
 */
export function getCycleBoundsForDate(dateStr: string, cycleStartDay: number) {
    validateCycleStartDay(cycleStartDay)
    
    const date = parse(dateStr, 'yyyy-MM-dd', new Date())
    const day = date.getDate()
    
    let cycleStart: Date
    if (day >= cycleStartDay) {
        cycleStart = new Date(date.getFullYear(), date.getMonth(), cycleStartDay)
    } else {
        cycleStart = new Date(date.getFullYear(), date.getMonth() - 1, cycleStartDay)
    }
    
    const nextCycleStart = addMonths(cycleStart, 1)
    const cycleEnd = subDays(nextCycleStart, 1)
    
    return {
        cycle_start: format(cycleStart, 'yyyy-MM-dd'),
        cycle_end: format(cycleEnd, 'yyyy-MM-dd'),
        next_cycle_start: format(nextCycleStart, 'yyyy-MM-dd')
    }
}
