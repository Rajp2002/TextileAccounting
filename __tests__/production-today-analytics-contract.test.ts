import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'

const read = (relPath: string) => readFileSync(join(process.cwd(), relPath), 'utf8')

const clientPath = 'app/(dashboard)/owner/production/BaseProductionClient.tsx'
const qualitiesPath = 'app/(dashboard)/owner/production/BaseActiveQualities.tsx'

const TODAY_KEYS = [
    'todayProduction',
    'notEnteredYet',
    'shiftsSavedBoth',
    'shiftsSavedDay',
    'shiftsSavedNight',
    'recorded',
    'vsYesterday',
    'yesterdayTotal',
    'otherQualities',
] as const

describe('Production overview: today analytics', () => {
    it('computes today and yesterday from the data the page already loads, with no new query', () => {
        const client = read(clientPath)

        expect(client).toContain("from '@/lib/base-production-analytics'")
        expect(client).toContain('calculateBaseProductionDay(')
        expect(client).toContain('getBasePreviousDate(initialData.today)')
        expect(client).toContain('compareBaseProductionDays(')
        expect(client).toContain('metersOutsideBaseJobs(')
        expect(client).not.toMatch(/\.from\('base_(daily_)?production/)
    })

    it('leads the existing overview card with the total and keeps the tour anchor', () => {
        const client = read(clientPath)
        const card = client.slice(client.indexOf('data-production-tour="overview"'))

        expect(card).toContain("t('production.todayProduction')")
        expect(card.indexOf("t('production.todayProduction')")).toBeLessThan(card.indexOf('Active Qualities'))
        // Not-entered is a state of its own, never a zero.
        expect(card).toContain("t('production.notEnteredYet')")
        expect(card).toContain("t('production.vsYesterday'")
    })

    it('hands each quality card its own figure for today', () => {
        const client = read(clientPath)
        const qualities = read(qualitiesPath)

        expect(client).toContain('todayMetersByJobId={todayProduction.metersByJobId}')
        expect(client).toContain('todayEntered={todayProduction.hasSavedSheet}')
        expect(qualities).toContain('todayMetersByJobId?: ReadonlyMap<string, number>')
        expect(qualities).toContain('todayEntered?: boolean')
        expect(qualities).toContain("t('production.today')")
        expect(qualities).toContain('todayMetersByJobId.get(job.id)')
    })

    it.each([['en', en], ['hi', hi], ['gu', gu]] as const)('ships every new string in %s', (_language, locale) => {
        const production = locale.production as Record<string, string>
        for (const key of TODAY_KEYS) {
            expect(production[key], key).toEqual(expect.any(String))
            expect(production[key].length, key).toBeGreaterThan(0)
        }
        // Placeholders must survive translation.
        for (const key of ['vsYesterday', 'yesterdayTotal', 'otherQualities'] as const) {
            expect(production[key], key).toContain(key === 'vsYesterday' ? '{change}' : '{meters}')
        }
        expect(production.vsYesterday).toContain('{meters}')
    })
})
