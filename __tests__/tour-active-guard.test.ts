import { afterEach, expect, it } from 'vitest'
import { acquireTour, releaseTour } from '../lib/tours/active-tour'
afterEach(() => { releaseTour('production'); releaseTour('payroll') })
it('refuses a second owner, including the same id, until the first owner releases', () => {
    expect(acquireTour('production')).toBe(true)
    expect(acquireTour('production')).toBe(false)
    expect(acquireTour('payroll')).toBe(false)
    releaseTour('payroll')
    expect(acquireTour('payroll')).toBe(false)
    releaseTour('production')
    expect(acquireTour('payroll')).toBe(true)
})
