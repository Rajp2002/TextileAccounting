import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
    baseDailySheetHref,
    baseProductionHref,
    baseProductionTabForPath,
    readBaseProductionNavigation,
    safeBaseReturnPath,
} from '../lib/base-production-navigation'

// PI-04: changing the date or shift on the Daily Sheet must keep the owner on the Daily Sheet. The Daily Sheet and the
// Overview are two routes; the client picks its tab from the pathname, and history.replaceState skips the server
// redirect that `?tab=production` relies on. So any href that carries a Daily Sheet selection has to be the Daily
// Sheet's own path.
const read = (file: string) => readFileSync(file, 'utf8')
const pathOf = (href: string) => new URL(href, 'https://example.test').pathname
const selections = [
    { name: 'yesterday, day shift', date: '2026-09-29', shift: 'day' as const },
    { name: 'today, day shift', date: '2026-09-30', shift: 'day' as const },
    { name: 'today, night shift', date: '2026-09-30', shift: 'night' as const },
]

describe('PI-04 Daily Sheet selection keeps the Daily Sheet open', () => {
    it.each(selections)('selecting $name resolves to the Daily Sheet tab', ({ date, shift }) => {
        const href = baseDailySheetHref({ date, shift })
        expect(pathOf(href)).toBe('/owner/production/daily-sheet')
        expect(baseProductionTabForPath(pathOf(href))).toBe('production')
    })

    it('the Overview href stays the Overview, so the two routes are told apart by pathname alone', () => {
        expect(pathOf(baseProductionHref({ date: '2026-09-30', shift: 'day' }))).toBe('/owner/production')
        expect(baseProductionTabForPath('/owner/production')).toBe('jobs')
        expect(baseProductionTabForPath('/owner/production/daily-sheet')).toBe('production')
    })

    it('carries the selection and record context and reads back through the shared parser', () => {
        const context = { date: '2026-09-29', shift: 'night' as const, entry: '11111111-1111-4111-8111-111111111111', worker: '22222222-2222-4222-8222-222222222222', returnTo: '/owner/payroll' }
        const href = baseDailySheetHref(context)
        expect(readBaseProductionNavigation(new URL(href, 'https://example.test').searchParams)).toMatchObject(context)
    })

    it('never writes a tab parameter or empty values, so it cannot bounce through the tab redirect', () => {
        const href = baseDailySheetHref({ date: '2026-09-30', shift: 'day', entry: undefined, tab: 'production' })
        expect(new URL(href, 'https://example.test').searchParams.has('tab')).toBe(false)
        expect(baseDailySheetHref({})).toBe('/owner/production/daily-sheet')
    })

    it('is an allowed return destination, so leaving the sheet and coming back lands on the sheet', () => {
        const href = baseDailySheetHref({ date: '2026-09-29', shift: 'night' })
        expect(safeBaseReturnPath(href)).toBe(href)
    })
})

describe('PI-04 call sites that carry a Daily Sheet selection use the Daily Sheet href', () => {
    const sheet = read('app/(dashboard)/owner/production/BaseDailyProductionSheet.tsx')
    const client = read('app/(dashboard)/owner/production/BaseProductionClient.tsx')
    const readiness = read('app/(dashboard)/owner/production/BasePayrollReadinessPanel.tsx')

    it('changing date or shift rewrites the URL to the Daily Sheet path', () => {
        expect(sheet).toContain("window.history.replaceState(null, '', baseDailySheetHref({ ...navigation, date, shift: nextShift, entry: undefined }))")
        expect(sheet).not.toMatch(/replaceState\([^)]*baseProductionHref\(/)
    })

    it('returns from Assignments and Machine jobs to the Daily Sheet for the same date and shift', () => {
        expect(sheet).toContain('returnTo: baseDailySheetHref({ ...navigation, date: productionDate, shift })')
        expect(sheet).toContain("baseProductionHref({ tab: 'jobs', returnTo: baseDailySheetHref({ ...navigation, date: productionDate, shift }) })")
    })

    it('opens a payroll-readiness entry on the Daily Sheet, where the entry highlight lives', () => {
        expect(readiness).toContain('baseDailySheetHref({ date: item.productionDate')
        expect(readiness).not.toContain('baseProductionHref(')
    })

    it('opens a history entry ("View log") on the Daily Sheet, not the Overview', () => {
        expect(client).toContain('baseDailySheetHref({ date: entry.production_date, shift: entry.shift, entry: entry.id, worker: entry.worker_id })')
        expect(client).not.toContain('baseProductionHref({ date: entry.production_date')
    })

    it('returns from worker and machine setup to the view the owner left', () => {
        expect(client).toContain("baseProductionTabForPath(pathname) === 'production' ? baseDailySheetHref(navigation) : baseProductionHref(navigation)")
    })

    it('derives the active tab through the shared helper, not an inline pathname test', () => {
        expect(client).toContain('baseProductionTabForPath(pathname)')
        expect(client).not.toContain("pathname.endsWith('/daily-sheet')")
    })
})
