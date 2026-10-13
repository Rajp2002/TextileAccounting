import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { costingCatalogueText } from '@/lib/i18n/costing-catalogue'
import { rateBookBoardText } from '@/lib/i18n/rate-book-board'
import { fillCopy } from '@/lib/i18n/fill'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()

describe.each([
    ['Rate Book board', rateBookBoardText],
    ['Saved Costings catalogue', costingCatalogueText],
] as const)('%s copy', (_name, dictionary) => {
    it('has the same keys and placeholders in English, Hindi and Gujarati', () => {
        const english = dictionary.en as Record<string, string>
        for (const language of ['hi', 'gu'] as const) {
            const local = dictionary[language] as Record<string, string>
            expect(Object.keys(local)).toEqual(Object.keys(english))
            for (const [key, text] of Object.entries(english)) expect(placeholders(local[key]), `${language}.${key}`).toEqual(placeholders(text))
        }
    })

    it('writes Hindi in Devanagari and Gujarati in Gujarati script', () => {
        for (const [language, script] of [['hi', /[ऀ-ॿ]/], ['gu', /[઀-૿]/]] as const) {
            for (const [key, text] of Object.entries(dictionary[language] as Record<string, string>)) {
                const words = text.replace(/\{\w+\}/g, '').replace(/v\d*|[+·:…?,.%₹\d\s()-]/g, '')
                if (words) expect(text, `${language}.${key}`).toMatch(script)
            }
        }
    })
})

describe('fillCopy', () => {
    it('fills every placeholder, including repeated ones', () => {
        expect(fillCopy('{n} of {n} · {name}', { n: 2, name: 'D.345' })).toBe('2 of 2 · D.345')
    })
})

describe('Rate Book data for the board', () => {
    const actions = read('app/(dashboard)/owner/rates/actions.ts')

    it('reads each yarn’s recorded prices from the history it already loads, with no new query', () => {
        expect(actions).toContain(".select('rate_id, value, effective_date')")
        expect(actions).toContain('price_points: (pricePoints.get(rate.id) ?? []).sort((left, right) => left.date.localeCompare(right.date)).slice(-PRICE_TRAIL_POINTS)')
        expect((actions.match(/\.from\('cost_rate_history'\)/g) ?? []).length).toBe(2)
    })
})

describe('Saved Costings catalogue', () => {
    const client = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')
    const estimatorActions = read('app/(dashboard)/owner/estimator/actions.ts')
    const library = client.slice(client.indexOf('function SavedQualityLibraryView('), client.indexOf('export default function QuotesClient'))
    const card = library.slice(library.indexOf('<article'), library.indexOf('<Dialog modal={!tourStep}'))

    it('reads the saved breakdown and the recipe yarn names with the library summary', () => {
        expect(estimatorActions).toContain('cost_breakdown:costing_result_snapshot->breakdown')
        expect(estimatorActions).toContain("'id,name,updated_at,is_active,warp_rows,weft_rows'")
    })

    it('shows each quality as a card with cost, selling price, margin, cost mix and yarns', () => {
        expect(library).toContain('grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,30rem),1fr))]')
        expect(card).toContain('{copy.cost}')
        expect(card).toContain('{copy.sellsAt}')
        expect(card).toContain('{copy.margin}')
        expect(library).toContain('costMix(latest.cost_breakdown ?? getHistoricalCostingResult(latest)?.breakdown)')
        expect(card).toContain('<CompositionBar')
        expect(library).toContain('qualityYarns(group.template)')
        expect(card).toContain("tx('Current recipe')")
        expect(card).toContain("tx('Not calculated')")
    })

    it('compares the costing shown with the version saved before it', () => {
        expect(library).toContain('.filter(record => Number(record.version_number ?? 1) < Number(latest.version_number ?? 1))')
        expect(card).toContain('fillCopy(copy.fromVersion, { n: Number(prior.version_number ?? 1)')
    })

    it('opens the breakdown from a tap anywhere on the card, keeping each button’s own action', () => {
        expect(card).toContain('onClick={tourStep ? undefined : event => openBreakdownFromCard(event, openGroupDetails)}')
        expect(card).toContain("!tourStep && 'cursor-pointer")
        expect(client).toContain('if (!target || !event.currentTarget.contains(target)) return')
        expect(client).toContain(`if (target.closest('button, a, input, select, textarea, label, [role="button"], [role="dialog"]')) return`)
        expect(client).toContain('if (window.getSelection()?.toString()) return')
        expect(card).toContain('aria-haspopup="dialog"')
        expect(card).toContain('{copy.breakdown}')
        expect(card).not.toContain("tourControls.savedCostings.use")
        expect(card).toContain("{tx('Export')}")
        expect(card).toContain('aria-pressed={Boolean(latest.is_favorite)}')
    })

    it('keeps the tour anchors on the first card and the breakdown inside the dialog', () => {
        expect(card).toContain('data-costing-tour={tourStep && groupIndex === 0 ? "sample" : undefined}')
        expect(card).toContain('costings.first-card')
        for (const anchor of ['breakdown', 'economics', 'reuse', 'versions']) expect(library).toContain(`data-costing-tour="${anchor}"`)
    })

    it('summarises the whole active library in a band, whatever the search or view', () => {
        expect(client).toContain('const showLibraryBand = !tourSampleActive && !loadError && !showArchived && libraryLatest.length > 0')
        expect(client).toContain('const marginBars = marginRanking(bandMargins)')
        expect(client).toContain('averageMargin(bandMargins.map(entry => entry.margin))')
        expect(client).toContain('if (isSavedCostingArchived(record, template)) continue')
    })

    it('switches All, Favourites and Archived from one segmented control, with Compare as a pressed button', () => {
        expect(client).toContain('<LiquidSegmented')
        expect(client).toContain("{ value: 'archived', label: t('tourControls.savedCostings.archived') }")
        expect(client).toContain('data-tour-anchor="costings.compare"')
        expect(client).toContain('aria-pressed={comparisonMode}')
        expect(client).not.toContain('<Toolbar')
    })
})
