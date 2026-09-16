import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'
import path from 'node:path'
import { rateBookTutorialCopy } from '../lib/i18n/rate-book-tutorial'
import { RATE_BOOK_TOUR_STEPS, RATE_BOOK_HELP_FIELDS, formatRateBookTourText } from '../lib/rate-book-tour'

const state = vi.hoisted(() => ({ language: 'en' as 'en' | 'hi' | 'gu' }))
vi.mock('@/lib/i18n/context', () => ({
    useTranslation: () => ({ language: state.language, tx: (label: string) => label }),
}))
vi.mock('@/components/tours/TourInvitation', () => ({ TourInvitation: () => null }))
vi.mock('@/app/(dashboard)/owner/rates/tutorial-actions', () => ({ dismissRatebookTutorial: vi.fn() }))
import { RateBookHelp } from '../components/rates/RateBookTutorial'

const tutorial = fs.readFileSync(path.resolve(__dirname, '../components/rates/RateBookTutorial.tsx'), 'utf8')
const rates = fs.readFileSync(path.resolve(__dirname, '../app/(dashboard)/owner/rates/RatesClient.tsx'), 'utf8')

describe('Rate Book core learning flow', () => {
    it('keeps purpose, usage, dates and consequences in the core without requiring DOM targets', () => {
        expect(RATE_BOOK_TOUR_STEPS.map(step => step.field)).toEqual([
            'overview', 'yarnSearch', 'linkedQualitiesPopover', 'quickEditAction', 'reviewStatusBadge', 'immutabilityNotice',
        ])
        expect(tutorial).toContain('setSteps(RATE_BOOK_TOUR_STEPS.map(')
        expect(tutorial).not.toContain('RATE_BOOK_TOUR_STEPS.filter(')
        expect(tutorial).not.toContain('if (!root)')
    })

    it('preserves filters and drafts by removing tour callbacks that reset or open editors', () => {
        expect(rates).not.toContain('prepareTutorial')
        expect(rates).not.toContain('handleOpenQuickEditFromTour')
        expect(rates).not.toContain('handleOpenRateDrawerFromTour')
        expect(tutorial).not.toContain('onOpenQuickEdit')
        expect(tutorial).not.toContain('onOpenRateDrawer')
        expect(rates).toContain('if (isTutorialActive || event.ctrlKey')
        expect(tutorial).toContain('el.inert = prior[i]')
        expect(tutorial).not.toContain('el.inert = false')
    })

    it('notifies completion only at Finish, without changing the sample on Skip or Escape', () => {
        const close = tutorial.slice(tutorial.indexOf('const close = useCallback'), tutorial.indexOf('const handleNext'))
        expect(close).not.toContain('onTourFinish')
        const next = tutorial.slice(tutorial.indexOf('const handleNext'), tutorial.indexOf('const handleBack'))
        expect(next).toContain('if (index === steps.length - 1)')
        expect(next).toContain('onTourFinish?.()')
    })

    it('teaches a numeric price example and distinguishes updated recipes from historical snapshots', () => {
        const copy = rateBookTutorialCopy.en.fields
        expect(copy.overview.description).toContain('supplier quote or invoice')
        expect(copy.overview.description).toContain('you maintain these rates yourself')
        expect(copy.linkedQualitiesPopover.description).toContain('adding a rate alone does not link a recipe')
        expect(copy.quickEditAction.description).toContain('₹200/kg to ₹220/kg')
        expect(copy.quickEditAction.description).toContain('+₹20 (+10%)')
        expect(copy.immutabilityNotice.description).toContain('updates matching yarn prices in linked Saved Qualities')
        expect(copy.immutabilityNotice.description).toContain('Historical costing snapshots keep their original numbers')
        expect(copy.immutabilityNotice.description).toContain('Cost Estimator')
        expect(copy.reviewStatusBadge.description).toContain('when you checked it')
        expect(copy.reviewStatusBadge.description).toContain('next reminder from that review date')
    })

    it.each(['en', 'hi', 'gu'] as const)('retains all core and contextual explanations in %s', language => {
        state.language = language
        const copy = rateBookTutorialCopy[language]
        for (const field of [...RATE_BOOK_TOUR_STEPS.map(step => step.field), ...RATE_BOOK_HELP_FIELDS]) {
            const text = copy.fields[field]
            expect(text.title.trim()).not.toBe('')
            expect(text.description.trim()).not.toBe('')
            expect(formatRateBookTourText(text.title, label => label)).not.toMatch(/\{\w+\}/)
            expect(formatRateBookTourText(text.description, label => label)).not.toMatch(/\{\w+\}/)
        }
        const html = renderToStaticMarkup(<RateBookHelp />)
        expect(html).toContain(`lang="${language}"`)
        expect(html).toContain(copy.helpTitle)
        expect(html.match(/<details\b/g)).toHaveLength(RATE_BOOK_HELP_FIELDS.length + 1)
        expect(html).not.toContain('<details open')
        for (const field of RATE_BOOK_HELP_FIELDS) {
            expect(html).toContain(formatRateBookTourText(copy.fields[field].title, label => label))
        }
        expect(rates).toContain('<RateBookHelp />')
    })

    it('uses the same translated action labels as the page controls', () => {
        const tx = vi.fn((label: string) => `translated:${label}`)
        const result = formatRateBookTourText('{editRate} → {saveRate}; {advancedEdit}', tx)
        expect(result).toBe('translated:Edit rate → translated:Save Rate; translated:Advanced edit')
        expect(tx).toHaveBeenCalledWith('Edit rate')
        expect(tx).toHaveBeenCalledWith('Save Rate')
    })
})
