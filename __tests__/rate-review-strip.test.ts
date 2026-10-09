import { rateBookHelpCopy } from '../components/rates/RateBookTutorial'
import { describe, expect, it, vi } from 'vitest'
vi.mock('@/components/tours/TourInvitation', () => ({ TourInvitation: () => null, GuideSection: () => null }))
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

/**
 * The Rate Book has no side rails: the add action and the Guide (tour, principles, help, archive
 * and restore) sit in the page header, and the review status is one strip under it.
 */
describe('Rate Book review strip and Guide', () => {
    const rates = read('app/(dashboard)/owner/rates/RatesClient.tsx')
    const styles = read('app/globals.css')

    it('renders the review status as a strip in the page flow, not a fixed rail or a floating pill', () => {
        expect(rates).toContain('function RateReviewStrip(')
        expect(rates).toContain('<RateReviewStrip')
        expect(rates).not.toContain('RateReviewFloatingButton')
        expect(rates).not.toContain('rates-review-rail-desktop')
        expect(styles).not.toContain('.rates-review-rail')
    })

    it('keeps the header, its Guide and the review strip inside the route wrapper', () => {
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
        expect(inside('<RateReviewStrip')).toBe(true)
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
        const header = rates.slice(rates.indexOf('<PageHeader'), rates.indexOf('<RateReviewStrip'))
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

    it('provides accessible modal triggers for rates due for review', () => {
        expect(rates).toContain('aria-haspopup="dialog"')
        expect(rates).toContain('dueReviewRates')
        expect(rates).toContain('setShowDueReviews(true)')
        expect(rates).toContain('<DueForReviewDialog')
    })

    it('shows rate review status, principles, and commercial memory rules', () => {
        expect(rates).toContain("tx('Rates Are Current')")
        expect(rates).toContain('Rate Book Principles')
        expect(rateBookHelpCopy.en.principles.join(' ')).toContain('updates matching yarn prices in linked Saved Qualities')
        expect(rateBookHelpCopy.en.principles.join(' ')).toContain('Historical costing snapshots keep their original numbers')
        expect(rateBookHelpCopy.en.principles.join(' ')).toContain('supplier-price check')
    })

    it('summarizes due rates in one line without rendering individual rows', () => {
        const strip = rates.slice(rates.indexOf('function RateReviewStrip('), rates.indexOf('function RateBookPrinciples()'))
        expect(strip).toContain("Rate Needs' : 'Rates Need'} Review`)")
        expect(strip).toContain("tx('Last reviewed')")
        expect(strip).toContain("tx('Cadence')")
        expect(rates).not.toContain('dueReviewRates.slice(0, 3)')
        expect(rates).not.toContain('onReviewRate')
    })

    it('keeps category breakdown and clean summary in the full-width main column', () => {
        expect(rates).toContain('warpRatesCount')
        expect(rates).toContain('weftRatesCount')
        expect(rates).toContain('active yarn rates')
        expect(rates).toContain('Last reviewed')
        expect(rates).toContain('"rates-workspace ui-route-enter w-full space-y-6"')
    })
})
