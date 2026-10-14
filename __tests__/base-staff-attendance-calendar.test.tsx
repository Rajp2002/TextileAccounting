import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import BaseStaffAttendanceCalendar from '../app/(dashboard)/owner/production/BaseStaffAttendanceCalendar'
import { calculateBaseSalaryLines } from '../lib/base-salary'
import type { BaseProductionWorker } from '../lib/base-production-core'

const mahesh: BaseProductionWorker = { id: 'mahesh', name: 'Mahesh', pay_type: 'fixed_monthly', monthly_salary: 30000, start_date: '2026-09-01', end_date: null,
    salary_history: [{ effective_from: '2026-09-01', monthly_salary: 30000 }], days_off: ['2026-09-25', '2026-10-03'],
    rate_per_meter: 0, shift_availability: 'both', is_active: true }
const lines = calculateBaseSalaryLines(mahesh, '2026-09-23', '2026-10-14')
const render = (props: Partial<Parameters<typeof BaseStaffAttendanceCalendar>[0]> = {}) => renderToStaticMarkup(
    <BaseStaffAttendanceCalendar lines={lines} locked={false} onToggle={() => {}} {...props} />,
)
const count = (html: string, needle: string) => html.split(needle).length - 1

describe('fixed-salary attendance calendar', () => {
    it('ticks every paid day, shows days off, and fades days outside the period', () => {
        const html = render()
        expect(count(html, 'data-day-state="present"')).toBe(20)
        expect(count(html, 'data-day-state="off"')).toBe(2)
        // 1-22 Sep before the period and 15-31 Oct after it.
        expect(count(html, 'data-day-state="outside"')).toBe(39)
        // Monday-first: 1 Sep 2026 is a Tuesday and 1 Oct 2026 a Thursday.
        expect(count(html, 'data-day-blank')).toBe(4)
    })

    it('shows each month as day rate, days worked, days off and pay', () => {
        const html = render()
        expect(html).toContain('September 2026')
        expect(html).toContain('October 2026')
        expect(html).toContain('₹30,000 ÷ 30 days ≈ ₹1,000.00 a day')
        expect(html).toContain('₹30,000 ÷ 31 days ≈ ₹967.74 a day')
        expect(html).toContain('7 days worked · 1 off → ₹7,000.00')
        expect(html).toContain('13 days worked · 1 off → ₹12,580.65')
        expect(html).toContain('₹19,580.65')
    })

    it('lets the owner tap worked and off days, and marks a saving day busy', () => {
        const html = render({ pendingDates: new Set(['2026-10-05']) })
        expect(count(html, '<button')).toBe(22)
        expect(html).toContain('aria-pressed="true"')
        expect(count(html, 'aria-busy="true"')).toBe(1)
        expect(html).toContain('Tap a day to mark it off.')
    })

    it('locks a paid period and shows a save error under the grid', () => {
        const locked = render({ locked: true })
        expect(locked).toContain('Paid · days locked')
        expect(count(locked, '<button')).toBe(0)
        expect(locked).not.toContain('Tap a day to mark it off.')
        expect(render({ error: 'This day is already paid.' })).toContain('role="alert"')
    })

    it('replaces the one-line salary text in the payroll breakdown modal', () => {
        const client = readFileSync('app/(dashboard)/owner/production/BaseProductionClient.tsx', 'utf8')
        const modal = client.slice(client.indexOf('open={Boolean(breakdownPayable)}'))
        expect(modal).toContain('<BaseStaffAttendanceCalendar')
        expect(modal.slice(0, modal.indexOf('</Dialog>'))).not.toContain('× {line.days}/{line.monthDays} days')
        expect(client).toContain('setBaseStaffDayOff(')
    })
})
