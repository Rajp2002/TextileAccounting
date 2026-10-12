import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('app/(dashboard)/owner/production/BaseDailyProductionSheet.tsx', 'utf8')
const fitSource = readFileSync('lib/fit-region-to-window.ts', 'utf8')
const mobileCss = readFileSync('app/mobile.css', 'utf8')

describe('Base daily sheet scroll region', () => {
    it('fits the machine readings to the window so only the rows scroll', () => {
        const region = source.match(/<div ref=\{fitReadingsToWindow\} role="region" aria-label="Machine readings" className="([^"]+)"/)
        expect(region?.[1]).toContain('overflow-y-auto')
        expect(region?.[1]).toContain('h-[max(20rem,var(--daily-readings-fit,')
        expect(source).toContain("fitRegionToWindow('--daily-readings-fit')")
        expect(fitSource).toContain('region.style.setProperty(property')
    })

    it('does not stretch the sheet past the window', () => {
        expect(source).not.toMatch(/min-h-\[calc\(100(?:vh|svh|dvh)/)
        expect(source).not.toContain('2xl:pb-20')
    })

    it('keeps phone entry on the page scroll', () => {
        expect(mobileCss).toMatch(/\.production-daily-readings,\s*\.production-loom-rows \{\s*height: auto;\s*max-height: none;\s*overflow-y: visible;/)
    })
})
