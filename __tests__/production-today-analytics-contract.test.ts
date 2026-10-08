import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'

const read = (relPath: string) => readFileSync(join(process.cwd(), relPath), 'utf8')

const clientPath = 'app/(dashboard)/owner/production/BaseProductionClient.tsx'
const qualitiesPath = 'app/(dashboard)/owner/production/BaseActiveQualities.tsx'
const chartPath = 'app/(dashboard)/owner/production/BaseProductionLoomChart.tsx'

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
    'loomOutputTitle',
    'yesterday',
    'qualityAverage',
    'belowQualityAverage',
    'belowAverage',
    'changeVsYday',
    'openDailySheet',
    'barsAppearWhenSaved',
    'rankedByToday',
    'rankedByYesterday',
    'noLoomOutput',
] as const

const PLACEHOLDERS: Record<string, string> = {
    vsYesterday: '{change}',
    yesterdayTotal: '{meters}',
    otherQualities: '{meters}',
    changeVsYday: '{change}',
}

describe('Production overview: today analytics', () => {
    it('computes today and yesterday from the data the page already loads, with no new query', () => {
        const client = read(clientPath)

        expect(client).toContain("from '@/lib/base-production-analytics'")
        expect(client).toContain('calculateBaseProductionDay(')
        expect(client).toContain('getBasePreviousDate(initialData.today)')
        expect(client).toContain('compareBaseProductionDays(')
        expect(client).toContain('metersOutsideBaseJobs(')
        expect(client).toContain('buildBaseLoomOutputRows(')
        expect(client).not.toMatch(/\.from\('base_(daily_)?production/)
    })

    it('keeps the stats card to its four tiles and puts the loom chart under Active Qualities', () => {
        const client = read(clientPath)
        const card = client.slice(client.indexOf('data-production-tour="overview"'))
        const tilesOnly = card.slice(0, card.indexOf('</Card>'))

        // The overview card (and its tour anchor) is untouched by the chart.
        expect(tilesOnly).not.toContain('production.todayProduction')
        expect(tilesOnly).toContain('Active Qualities')

        expect(client).toContain("import BaseProductionLoomChart from './BaseProductionLoomChart'")
        const qualities = client.indexOf('<BaseActiveQualities')
        const chart = client.indexOf('<BaseProductionLoomChart')
        expect(qualities).toBeGreaterThan(-1)
        expect(chart).toBeGreaterThan(qualities)
    })

    it('draws yesterday as a taller frame with today inside it, so neither bar can hide the other', () => {
        expect(existsSync(join(process.cwd(), chartPath))).toBe(true)
        const chart = read(chartPath)

        const yesterdayBar = chart.indexOf('data-bar="yesterday"')
        const todayBar = chart.indexOf('data-bar="today"')
        expect(yesterdayBar).toBeGreaterThan(-1)
        // Yesterday is painted first, so today sits on top of it.
        expect(todayBar).toBeGreaterThan(yesterdayBar)

        const frameHeight = chart.match(/const FRAME_HEIGHT = (\d+)/)
        const barHeight = chart.match(/const BAR_HEIGHT = (\d+)/)
        expect(frameHeight).not.toBeNull()
        expect(barHeight).not.toBeNull()
        // The frame must stand clear of today's bar above and below, or yesterday's end is hidden.
        expect(Number(frameHeight![1]) - Number(barHeight![1])).toBeGreaterThanOrEqual(6)
    })

    it('never shows "not entered" as zero and offers the way to enter it', () => {
        const chart = read(chartPath)

        expect(chart).toContain("t('production.notEnteredYet')")
        expect(chart).toContain("t('production.barsAppearWhenSaved')")
        expect(chart).toContain("t('production.openDailySheet')")
        expect(chart).toContain("t('production.vsYesterday'")
        expect(chart).toContain("t('production.noLoomOutput')")
    })

    it('flags a lagging loom with an icon and words as well as colour', () => {
        const chart = read(chartPath)

        expect(chart).toContain('row.lagging')
        expect(chart).toContain("t('production.belowAverage')")
        expect(chart).toContain("t('production.belowQualityAverage')")
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
        for (const [key, placeholder] of Object.entries(PLACEHOLDERS)) {
            expect(production[key], key).toContain(placeholder)
        }
        expect(production.vsYesterday).toContain('{meters}')
    })
})
