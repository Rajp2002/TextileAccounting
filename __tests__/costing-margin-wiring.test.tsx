import fs from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CostingMarginScope, type MarginReadOnlyReason } from '@/components/estimator/SavedCostingMargin'
import { I18nContext } from '@/lib/i18n/context'
import { costingMarginText } from '@/lib/i18n/costing-margin'
import { makeSavedCostingTourExamples } from '@/lib/saved-costings-tour'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const [sampleV2] = makeSavedCostingTourExamples()

function renderScope(options: { readOnly?: MarginReadOnlyReason | null; base?: typeof sampleV2.estimate | null; saved?: typeof sampleV2.result; language?: 'en' | 'hi' | 'gu' } = {}) {
    let paused: boolean | null = null
    const scope = (
        <CostingMarginScope
            base={options.base === undefined ? sampleV2.estimate : options.base}
            saved={options.saved ?? sampleV2.result}
            readOnly={options.readOnly ?? null}
            versionNumber={2}
            latestVersionNumber={2}
            isSample
            costLabel="Production Cost / m"
            priceLabel="Suggested price / m"
            onSave={async () => true}
        >
            {(state) => {
                paused = state.paused
                return state.economics
            }}
        </CostingMarginScope>
    )
    const language = options.language ?? 'en'
    const value = {
        language,
        setLanguage: async () => ({ ok: true as const, language }),
        languageStatus: 'ready' as const,
        pendingLanguage: null,
        languageError: null,
        t: (key: string) => key,
        tx: (text: string) => text,
    }
    const html = renderToStaticMarkup(createElement(I18nContext.Provider, { value }, scope))
    return { html, paused }
}

describe('margin slider copy', () => {
    const keys = Object.keys(costingMarginText.en).sort()

    it('has every string in English, Hindi and Gujarati', () => {
        expect(Object.keys(costingMarginText.hi).sort()).toEqual(keys)
        expect(Object.keys(costingMarginText.gu).sort()).toEqual(keys)
    })

    it('writes Hindi and Gujarati in their own script and keeps every placeholder', () => {
        for (const [language, script] of [['hi', /\p{Script=Devanagari}/u], ['gu', /\p{Script=Gujarati}/u]] as const) {
            for (const key of keys as Array<keyof typeof costingMarginText.en>) {
                const english = costingMarginText.en[key]
                const translated = costingMarginText[language][key]
                expect(translated, `${language}.${key}`).toMatch(script)
                expect(translated.match(/\{\w+\}/g)?.sort() ?? [], `${language}.${key}`).toEqual(english.match(/\{\w+\}/g)?.sort() ?? [])
            }
        }
    })
})

describe('margin control in the breakdown', () => {
    it('shows the saved margin on the shared slider and offers no Save until it moves', () => {
        const { html, paused } = renderScope()
        expect(html).toContain('type="range"')
        expect(html).toContain('value="12"')
        expect(html).toContain('12.0%')
        expect(html).toContain('₹17.44')
        expect(html).toContain('₹19.82')
        expect(html).not.toContain('Save as v3')
        expect(html).not.toContain('Reset')
        expect(paused).toBe(false)
    })

    it('names the sample as explore-only', () => {
        expect(renderScope().html).toContain(costingMarginText.en.sampleHelp)
    })

    it('keeps the touch targets at 44px on phones', () => {
        const { html } = renderScope()
        expect(html).toContain('max-md:size-11')
    })

    it('shows the margin without a slider for an archived costing, with the reason', () => {
        const { html } = renderScope({ readOnly: 'archived' })
        expect(html).not.toContain('type="range"')
        expect(html).toContain(costingMarginText.en.readOnlyArchived)
        expect(html).toContain('12.0%')
    })

    it('keeps the margin the saved price really earns when the costing cannot be adjusted', () => {
        const saved = { ...sampleV2.result, actualMarginPct: 8.3 }
        const { html } = renderScope({ readOnly: 'older', saved })
        expect(html).toContain(costingMarginText.en.actual)
        expect(html).toContain('8.3%')
        expect(html).not.toContain(costingMarginText.en.title)
        // An adjustable costing reads out the margin the slider sets.
        expect(renderScope({ saved }).html).toContain(costingMarginText.en.title)
    })

    it('shows the margin without a slider for an older version, naming the latest', () => {
        const { html } = renderScope({ readOnly: 'older' })
        expect(html).not.toContain('type="range"')
        expect(html).toContain('Only the latest version can be changed. Open v2 to change its margin.')
    })

    it('shows the margin without a slider when the saved inputs cannot be rebuilt', () => {
        const { html } = renderScope({ base: null })
        expect(html).not.toContain('type="range"')
        expect(html).toContain(costingMarginText.en.readOnlyChecked)
    })

    it('does not let a saved costing that fails its own checks be moved', () => {
        const broken = { ...sampleV2.estimate, warpRows: [{ ...sampleV2.estimate.warpRows[0], yarnRate: -5 }] }
        const { html } = renderScope({ base: broken })
        expect(html).not.toContain('type="range"')
        expect(html).toContain(costingMarginText.en.readOnlyChecked)
    })

    it('renders in Hindi and Gujarati', () => {
        expect(renderScope({ language: 'hi' }).html).toContain(costingMarginText.hi.title)
        expect(renderScope({ language: 'gu' }).html).toContain(costingMarginText.gu.title)
    })
})

describe('margin slider wiring (source contract)', () => {
    const quotes = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')

    it('wraps the open breakdown in the margin scope, keyed by the costing version', () => {
        expect(quotes).toContain('<CostingMarginScope')
        expect(quotes).toContain('key={activeRecord.id}')
        expect(quotes).toContain('data-costing-tour="economics"')
    })

    it('only builds an adjustable base for the open, latest, verified, unarchived costing', () => {
        const start = quotes.indexOf('const marginReadOnly')
        const block = quotes.slice(start, quotes.indexOf('const marginBase', start))
        expect(block).toContain("'archived'")
        expect(block).toContain("'older'")
        expect(block).toContain("getCostingStatus")
        expect(block).toContain("'verified'")
        expect(quotes).toContain('const marginBase = isOpen && activeRecord && !marginReadOnly ? buildDraftStateFromQuote(activeRecord) : null')
    })

    it('holds Use, Duplicate, Export, Save as separate quality and the production link while the margin is unsaved', () => {
        const scope = quotes.slice(quotes.indexOf('<CostingMarginScope'), quotes.indexOf('</CostingMarginScope>'))
        expect(scope).toMatch(/onClick=\{\(\) => onOpen\(activeRecord\)\} disabled=\{paused \|\| updatingId === activeRecord\.id\}/)
        expect(scope).toMatch(/onClick=\{\(\) => onStartFrom\(activeRecord\)\} disabled=\{paused\}/)
        expect(scope).toMatch(/onClick=\{\(\) => onExport\(activeRecord\)\} disabled=\{paused\}/)
        expect(scope).toMatch(/onClick=\{\(\) => onSaveAsNewQuality\(activeRecord\)\} disabled=\{paused\}/)
        expect(scope).toContain("aria-disabled={paused || undefined}")
        expect(scope).toContain('if (paused) event.preventDefault()')
    })

    it('saves through the Cost Estimate save action as the next version of the same costing', () => {
        const start = quotes.indexOf('const saveCostingMargin')
        const block = quotes.slice(start, quotes.indexOf('const restoreQuoteToEstimator', start))
        expect(block).toContain('saveEstimatorQuoteV3({')
        expect(block).toContain('sourceQuoteId: record.id')
        expect(block).toContain('expectedSourceUpdatedAt: record.updated_at')
        expect(block).toContain("recordKind: 'costing'")
        expect(block).toContain('profitPct: marginPct')
        expect(block).toContain('isSampleRecordId(record.id)')
        expect(block).toContain('navigator.onLine')
    })

    it('never saves from the guided tour sample', () => {
        expect(quotes).toContain('onSaveMargin={async () => false}')
    })

    it('docks the breakdown as a bottom sheet on phones instead of an inline left offset', () => {
        expect(quotes).toContain('--costing-dialog-left')
        expect(quotes).toContain('sm:left-[var(--costing-dialog-left)]')
        expect(quotes).not.toMatch(/style=\{\{\s*left:/)
    })
})

describe('one shared range slider', () => {
    it('is the same component on the landing cost sheet and in the saved costing margin', () => {
        expect(read('components/landing/cost-sheet-demo.tsx')).toContain("from '@/components/ui/range-slider'")
        expect(read('components/estimator/SavedCostingMargin.tsx')).toContain("from '@/components/ui/range-slider'")
    })

    it('keeps the slider styles in one place', () => {
        const landing = read('components/landing/landing.module.css')
        expect(landing).not.toMatch(/\.range\b/)
        expect(landing).toContain('--range-thumb')
        const shared = read('components/ui/range-slider.module.css')
        expect(shared).toContain('::-webkit-slider-thumb')
        expect(shared).toContain('::-moz-range-thumb')
        expect(shared).toContain('height: 44px')
    })
})
