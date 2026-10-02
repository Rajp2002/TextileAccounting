import { describe, expect, it, vi } from 'vitest'
import { createRouteMilestoneTracker, diagnosticRoute } from '../lib/route-milestones'

describe('local workspace diagnostic marks', () => {
    it('records readiness transitions once and resets for a different SPA route', () => {
        const mark = vi.fn(), record = createRouteMilestoneTracker(mark)
        record('/owner/production', { shell: true, primary: false, secondary: false })
        record('/owner/production', { shell: true, primary: true, secondary: false })
        record('/owner/production', { shell: true, primary: true, secondary: false })
        expect(mark).toHaveBeenCalledTimes(4)
        record('/owner/payroll', { shell: true, primary: true, secondary: false })
        expect(mark).toHaveBeenCalledTimes(8)
        expect(mark).toHaveBeenLastCalledWith('route_primary_usable:/owner/payroll')
    })
    it('never puts record identifiers or query strings in a diagnostic route', () => {
        expect(diagnosticRoute('/owner/dispatches/private-record?customer=private#secret')).toBe('/owner/dispatches')
        expect(diagnosticRoute('/unknown/private')).toBe('/workspace')
        expect(diagnosticRoute('/owner/production/daily-sheet?worker=private')).toBe('/owner/production/daily-sheet')
        expect(diagnosticRoute('/free/costings')).toBe('/free/costings')
    })
})
