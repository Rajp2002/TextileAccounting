import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildQualityConstructionCue, matchesQualitySearch } from '@/lib/quality-recall'
import { formatRevisionLead } from '@/lib/saved-costings'

// LT04 (P1, LC20/LC27/LC28): find the right quality without opening each one,
// state the save scope plainly, and lead a comparison with the versions and
// the per-metre price difference.

type Row = Record<string, unknown>
const quality = (name: string, warp: Row[], weft: Row[]) => ({ name, warp_rows: warp, weft_rows: weft })

describe('buildQualityConstructionCue', () => {
    it('summarises warp × weft, total picks and width from the recipe', () => {
        expect(buildQualityConstructionCue(quality('Georgette',
            [{ label: '80/72 Micro', calcDenier: 80 }],
            [{ label: '75D Roto', calcDenier: 75, picks: 68, effectiveCostingWidthCm: 160 }],
        ))).toBe('80/72 Micro × 75D Roto · 68 PPI · 160 cm')
    })

    it('joins weft components and sums their own picks (owner decision: 34 + 34 is 68)', () => {
        expect(buildQualityConstructionCue(quality('Two weft',
            [{ label: '40s Cotton', linearDensityUnit: 'cotton_count_ne', cottonCountNe: 40 }],
            [{ label: 'Viscose A', picks: 34, reedSpace: 152 }, { label: 'Viscose B', picks: 34, reedSpace: 152 }],
        ))).toBe('40s Cotton × Viscose A + Viscose B · 68 PPI · 152 cm')
    })

    it('falls back to the density when a row has no label', () => {
        expect(buildQualityConstructionCue(quality('Unlabelled',
            [{ calcDenier: 75 }],
            [{ linearDensityUnit: 'cotton_count_ne', cottonCountNe: 30, picks: 60 }],
        ))).toBe('75 D × 30 Ne · 60 PPI')
    })

    it('returns null when nothing about the construction is known', () => {
        expect(buildQualityConstructionCue({ name: 'Summary only' })).toBeNull()
        expect(buildQualityConstructionCue(quality('Empty rows', [{}], [{}]))).toBeNull()
    })
})

describe('matchesQualitySearch across near-duplicate qualities', () => {
    const yarns = ['75D Roto', '80/72 Micro', '40s Cotton', '2/40 PV']
    const library = Array.from({ length: 24 }, (_, index) => quality(
        index % 6 === 0 ? `સુરત પોપલિન ${index + 1}` : `Poplin ${index + 1}`,
        [{ label: yarns[index % 4], calcDenier: 75 }],
        [{ label: yarns[(index + 1) % 4], picks: 60 + (index % 3) * 4, effectiveCostingWidthCm: 150 + (index % 2) * 10 }],
    ))

    it('finds qualities by a yarn label that is not in the name', () => {
        const matches = library.filter(entry => matchesQualitySearch(entry, '40s'))
        expect(matches).toHaveLength(12)
        expect(matches.every(entry => [...entry.warp_rows, ...entry.weft_rows].some(row => row.label === '40s Cotton'))).toBe(true)
    })

    it('requires every word, across name and construction', () => {
        const matches = library.filter(entry => matchesQualitySearch(entry, 'poplin 64 ppi 160 cm'))
        expect(matches.length).toBeGreaterThan(0)
        expect(matches.every(entry => /Poplin|પોપલિન/.test(entry.name) && entry.weft_rows[0].picks === 64 && entry.weft_rows[0].effectiveCostingWidthCm === 160)).toBe(true)
    })

    it('matches Gujarati names and treats an empty query as everything', () => {
        expect(library.filter(entry => matchesQualitySearch(entry, 'પોપલિન'))).toHaveLength(4)
        expect(library.filter(entry => matchesQualitySearch(entry, '  '))).toHaveLength(24)
    })
})

describe('formatRevisionLead', () => {
    const v1 = { version_number: 1, created_at: '2026-10-03T06:00:00.000Z' }
    const v2 = { version_number: 2, created_at: '2026-10-04T06:00:00.000Z' }

    it('names both versions and dates, then the new-minus-old price per metre', () => {
        expect(formatRevisionLead(v1, v2, { left: 31.44, right: 31.86, delta: 0.42 })).toBe('v1 (3 Oct 2026) → v2 (4 Oct 2026): suggested price ₹0.42/m higher')
        expect(formatRevisionLead(v1, v2, { left: 31.44, right: 31.02, delta: -0.42 })).toBe('v1 (3 Oct 2026) → v2 (4 Oct 2026): suggested price ₹0.42/m lower')
        expect(formatRevisionLead(v1, v2, { left: 31.44, right: 31.44, delta: 0 })).toBe('v1 (3 Oct 2026) → v2 (4 Oct 2026): suggested price unchanged')
    })

    it('says when the difference is unavailable rather than showing zero', () => {
        expect(formatRevisionLead(v1, v2, { left: null, right: 31.44, delta: null })).toBe('v1 (3 Oct 2026) → v2 (4 Oct 2026): suggested price difference not available')
    })
})

describe('estimator and Saved Costings use them', () => {
    const estimator = readFileSync('app/(dashboard)/owner/estimator/EstimatorClient.tsx', 'utf8')
    const quotes = readFileSync('app/(dashboard)/owner/quotes/QuotesClient.tsx', 'utf8')
    const english = readFileSync('lib/i18n/locales/en.ts', 'utf8')

    it('searches qualities by name and construction and shows the cue on each card', () => {
        expect(estimator).toContain('templates.filter(template => matchesQualitySearch(template, templateSearch))')
        expect(estimator).toContain('data-quality-cue')
        expect(estimator).toContain('title={tpl.name}')
    })

    it('states the save scope in the panel line instead of a quality-update dialog', () => {
        expect(english).not.toContain('save_version_only')
        expect(english).not.toContain('save_version_update_quality')
        expect(estimator).toContain("t('estimator.actions.hint.firstCosting', { quality: qualityName ?? '' })")
        expect(estimator).not.toContain('estimator.sprint1.save_version_update_quality')
    })
})
