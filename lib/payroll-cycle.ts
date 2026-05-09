import { parse, addMonths, subDays, format } from 'date-fns'

function validateCycleStartDay(day: number) {
    if (day < 1 || day > 28) {
        throw new Error('Cycle start day must be between 1 and 28')
    }
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
