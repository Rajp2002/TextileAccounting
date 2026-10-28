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
 * open from that band in a review modal instead of taking room on the page.
 */
describe('Rate Book summary band, review modal and Guide', () => {
    const rates = read('app/(dashboard)/owner/rates/RatesClient.tsx')
    const dialog = read('components/rates/RateReviewDialog.tsx')
    const styles = read('app/globals.css')

    it('shows where the book stands in one band: all clear with a check, or the prices due with a Review button', () => {
        const band = rates.slice(rates.indexOf('data-ratebook-field="reviewRailWidget"'), rates.indexOf('{showDeleteNudge'))
        expect(band).toContain('copy.allCurrent')
        expect(band).toContain('copy.toConfirm')
        expect(band).toContain('{dueLine ?? statusReviewLine}')
        expect(band).toContain('<Check className="size-5" strokeWidth={2.5} />')
        expect(band).toContain('data-ratebook-field="reviewPricesAction"')
        expect(band).toContain('onClick={() => setReviewSession(startRateReview(dueReviewRates))}')
        expect(band.indexOf('data-ratebook-field="reviewPricesAction"')).toBeGreaterThan(band.indexOf('{dueCount > 0 && ('))
        expect(rates).toContain('upcomingReviews(activeYarnRates)')
        // The month's price moves no longer share the band.
        expect(rates).not.toContain('movesTitle')
        expect(rates).not.toContain('priceMovesInMonth')
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

    it('confirms due prices in the review modal, while every yarn stays on the board once', () => {
        expect(rates).not.toContain('ratebook-review-queue')
        expect(rates).not.toContain('queueRates')
        expect(rates).toContain('rates: visibleRates.filter(rate => rate.category === category)')
        expect(rates.match(/<RateReviewDialog/g)).toHaveLength(1)
        expect(rates).toContain('onConfirm={handleQuickReview}')
        expect(rates).toContain("onSavePrice={(rate, value) => handleQuickSave(rate, value, '')}")
        // A due card on the board says so in its status instead of carrying the confirm action.
        const card = rates.slice(rates.indexOf('const renderYarnCard = '), rates.indexOf('<PlanAnalyticsBeacon'))
        expect(card).toContain('due ? dueStatus(rate)')
        expect(card).not.toContain('quickReviewAction')
        // Each row asks whether the price still holds, and keeps its place once checked.
        expect(dialog).toContain('fillCopy(copy.stillPrice')
        expect(dialog).toContain('onClick={save}')
        // One field per row: empty or the same price confirms it, a different price saves it.
        expect(dialog).toContain('data-ratebook-field="reviewPriceInput"')
        expect(dialog).toContain('if (price === null) onConfirm(rate)')
        expect(dialog).toContain('else onSavePrice(rate, price)')
        expect(dialog).not.toContain('queueHint')
        expect(dialog).toContain("outcome !== 'waiting'")
        expect(dialog).toContain('fillCopy(copy.reviewProgress')
    })

    it('offers Confirm All only while the modal lists every due rate still waiting', () => {
        const footer = dialog.slice(dialog.indexOf('<DialogFooter'))
        expect(footer).toContain('waiting > 1 && waiting === dueCount')
        expect(footer).toContain('data-ratebook-field="confirmAll"')
        expect(footer).toContain('onClick={onConfirmAll} disabled={busy} className={railPrimaryAction}')
        expect(rates).toContain('onConfirmAll={handleConfirmAll}')
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
