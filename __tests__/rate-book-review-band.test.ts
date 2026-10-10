import { rateBookHelpCopy } from '../components/rates/RateBookTutorial'
import { describe, expect, it, vi } from 'vitest'
vi.mock('@/components/tours/TourInvitation', () => ({ TourInvitation: () => null, GuideSection: () => null }))
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { rateBookBoardText } from '@/lib/i18n/rate-book-board'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

/**
 * The Rate Book has no side rails: the add action and the Guide (tour, principles, help, archive
 * and restore) sit in the page header, a summary band sits under it, and prices due for a check
 * lead the board as a review queue of cards.
 */
describe('Rate Book summary band, review queue and Guide', () => {
    const rates = read('app/(dashboard)/owner/rates/RatesClient.tsx')
    const styles = read('app/globals.css')

    it('shows where the book stands in one band in the page flow, not a fixed rail or a floating pill', () => {
        const band = rates.slice(rates.indexOf('data-ratebook-field="reviewRailWidget"'), rates.indexOf('{showDeleteNudge'))
        expect(band).toContain('copy.allCurrent')
        expect(band).toContain('copy.toConfirm')
        expect(band).toContain('{nextReviewLine}')
        expect(band).toContain('copy.movesTitle')
        expect(band).toContain('monthMoves.moves.slice(0, 5)')
        expect(rates).toContain('priceMovesInMonth(activeYarnRates, todayDate.slice(0, 7))')
        expect(rates).toContain('upcomingReviews(activeYarnRates)')
        expect(rates).not.toContain('RateReviewStrip')
        expect(rates).not.toContain('RateReviewFloatingButton')
        expect(rates).not.toContain('rates-review-rail-desktop')
        expect(styles).not.toContain('.rates-review-rail')
    })

    it('keeps the header, its Guide and the summary band inside the route wrapper', () => {
        const source = ts.createSourceFile('RatesClient.tsx', rates, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
        const routeWrappers: ts.JsxElement[] = []
        const visit = (node: ts.Node) => {
            if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'div'
                && node.openingElement.attributes.properties.some(attribute => ts.isJsxAttribute(attribute)
                    && attribute.name.getText(source) === 'className'
                    && attribute.initializer?.getText(source).includes('rates-workspace ui-route-enter'))) routeWrappers.push(node)
            ts.forEachChild(node, visit)
        }
        visit(source)
        expect(routeWrappers).toHaveLength(1)
        const wrapper = routeWrappers[0]
        expect(wrapper.openingElement.getText(source)).toContain('isLite && mobileStyles.workspace')
        const inside = (snippet: string) => {
            const at = rates.indexOf(snippet)
            return at > wrapper.getStart(source) && at < wrapper.end
        }
        expect(inside('<PageHeader')).toBe(true)
        expect(inside('<RateBookTutorial')).toBe(true)
        expect(inside('data-ratebook-field="reviewRailWidget"')).toBe(true)
        // The tour's first step frames the header and the band together.
        const overview = rates.indexOf('data-ratebook-field="overview"')
        expect(overview).toBeLessThan(rates.indexOf('<PageHeader'))
        expect(rates.indexOf('data-ratebook-field="reviewRailWidget"')).toBeGreaterThan(rates.indexOf('<PageHeader'))
    })

    it('lists principles, help and archive and restore as Guide topics, in that order', () => {
        const actions = rates.slice(rates.indexOf('<RateBookTutorial'), rates.indexOf('onTourFinish', rates.indexOf('<RateBookTutorial')))
        const principles = actions.indexOf("id: 'rate-book-principles'")
        const help = actions.indexOf('rateBookHelpTopic,')
        const archive = actions.indexOf('archivePolicyTopic,')
        expect(principles).toBeGreaterThanOrEqual(0)
        expect(help).toBeGreaterThan(principles)
        expect(archive).toBeGreaterThan(help)
        expect(actions).toContain('data-ratebook-field="immutabilityNotice"')
        expect(rates).not.toContain('<ArchivePolicyNotice')
        expect(rates).not.toContain('<RateBookHelp')
    })

    it('puts Add rate after the Guide as the header primary action', () => {
        const header = rates.slice(rates.indexOf('<PageHeader'), rates.indexOf('data-ratebook-field="reviewRailWidget"'))
        expect(header.indexOf('<RateBookTutorial')).toBeLessThan(header.indexOf('data-ratebook-field="addRateAction"'))
        expect(rates.match(/data-ratebook-field="addRateAction"/g)).toHaveLength(1)
    })

    it('reads the principles in the Guide instead of a rail pill or an inline disclosure', () => {
        const start = rates.indexOf('function RateBookPrinciples()')
        const card = rates.slice(start, rates.indexOf('export default function RatesClient', start))
        expect(card).not.toContain('<details')
        expect(card).not.toContain('RailDialog')
        expect(card).toContain('copy.principles.map')
        expect(rates).toContain("title: tx('Rate Book Principles'), lang: language, i18nSkip: true")
    })

    it('leads with the prices due for a check as cards, instead of a dialog', () => {
        const queue = rates.slice(rates.indexOf('aria-labelledby="ratebook-review-queue"'), rates.indexOf('{boardSections.map'))
        expect(queue).toContain("{tx('Needs Review')}")
        expect(queue).toContain('queueRates.map(rate => renderYarnCard(rate, true))')
        // The queue and the board split the same filtered list, so a due yarn shows once.
        expect(rates).toContain('const queueRates = showArchived && tourStep === null ? [] : visibleRates.filter(isDue)')
        expect(rates).toContain('const boardRates = queueRates.length ? visibleRates.filter(rate => !isDue(rate)) : visibleRates')
        expect(rates).not.toContain('DueForReviewDialog')
        expect(rates).not.toContain('setShowDueReviews')
    })

    it('offers Confirm All only while the queue shows every due rate', () => {
        const queue = rates.slice(rates.indexOf('aria-labelledby="ratebook-review-queue"'), rates.indexOf('{boardSections.map'))
        expect(queue).toContain('queueRates.length > 1 && queueRates.length === dueCount')
        expect(queue).toContain('data-ratebook-field="confirmAll"')
        expect(queue).toContain('onClick={handleConfirmAll}')
    })

    it('shows rate review status, principles, and commercial memory rules', () => {
        expect(rateBookBoardText.en.allCurrent).toBe('All prices current')
        expect(rates).toContain('Rate Book Principles')
        expect(rateBookHelpCopy.en.principles.join(' ')).toContain('updates matching yarn prices in linked Saved Qualities')
        expect(rateBookHelpCopy.en.principles.join(' ')).toContain('Historical costing snapshots keep their original numbers')
        expect(rateBookHelpCopy.en.principles.join(' ')).toContain('supplier-price check')
    })

    it('keeps the warp and weft split and the full-width route wrapper', () => {
        expect(rates).toContain('warpRatesCount')
        expect(rates).toContain('weftRatesCount')
        expect(rates).toContain('copy.lastReviewed')
        expect(rates).toContain('"rates-workspace ui-route-enter w-full space-y-6"')
    })
})
