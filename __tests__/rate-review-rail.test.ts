import { rateBookHelpCopy } from '../components/rates/RateBookTutorial'
import { describe, expect, it, vi } from 'vitest'
vi.mock('@/components/tours/TourInvitation', () => ({ TourInvitation: () => null }))
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Rate Review Right Rail layout & interaction', () => {
    const rates = read('app/(dashboard)/owner/rates/RatesClient.tsx')
    const styles = read('app/globals.css')

    it('renders the Rate Review widget and reference card inside the dedicated right rail utilizing blank right space', () => {
        expect(rates).toContain('RateReviewRailWidget')
        expect(rates).toContain('RateBookReferenceCard')
        expect(rates).toContain('rates-review-rail-desktop')
        expect(rates).toContain('RateReviewFloatingButton')
        expect(styles).toContain('.rates-review-rail-desktop')
        expect(styles).toContain('position: fixed')
    })

    it('keeps viewport-positioned review controls outside the transformed route wrapper', () => {
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
        const routeWrapper = routeWrappers[0]
        const routeWrapperStart = routeWrapper.getStart(source)
        const routeWrapperEnd = routeWrapper.end
        const viewportControlsStart = rates.indexOf('<aside className="rates-review-rail-desktop')
        const floatingControlStart = rates.indexOf('<RateReviewFloatingButton')
        expect(routeWrapper.openingElement.getText(source)).toContain('isLite && mobileStyles.workspace')

        expect(routeWrapperStart).toBeGreaterThanOrEqual(0)
        expect(routeWrapperEnd).toBeGreaterThan(routeWrapperStart)
        expect(viewportControlsStart).toBeGreaterThan(routeWrapperEnd)
        expect(floatingControlStart).toBeGreaterThan(routeWrapperEnd)
    })

    it('places the archive policy at the bottom of the desktop rail and keeps it reachable on narrow screens', () => {
        const routeArchiveStart = rates.indexOf('<ArchivePolicyNotice />')
        const reviewRailStart = rates.indexOf('<aside className="rates-review-rail-desktop')
        const referenceStart = rates.indexOf('<RateBookReferenceCard />', reviewRailStart)
        const reviewRailEnd = rates.indexOf('</aside>', reviewRailStart)
        const archiveRailStart = rates.indexOf('<aside className="rates-archive-policy-rail-desktop"')
        const archiveStart = rates.indexOf('<ArchivePolicyNotice />', archiveRailStart)
        const archiveRailEnd = rates.indexOf('</aside>', archiveRailStart)

        expect(rates).toContain('<div className="rail-inline-actions">')
        expect(routeArchiveStart).toBeGreaterThanOrEqual(0)
        expect(reviewRailStart).toBeGreaterThan(routeArchiveStart)
        expect(referenceStart).toBeGreaterThan(reviewRailStart)
        expect(reviewRailEnd).toBeGreaterThan(referenceStart)
        expect(archiveRailStart).toBeGreaterThan(reviewRailEnd)
        expect(archiveStart).toBeGreaterThan(archiveRailStart)
        expect(archiveStart).toBeLessThan(archiveRailEnd)
        expect(styles).toContain('.rates-archive-policy-rail-desktop')
        expect(styles).toMatch(/\.rates-archive-policy-rail-desktop,[\s\S]*?\{[\s\S]*?position:\s*fixed;[\s\S]*?bottom:\s*var\(--rail-bottom\);/)
    })

    it('provides accessible modal triggers for rates due for review', () => {
        expect(rates).toContain('aria-haspopup="dialog"')
        expect(rates).toContain('dueReviewRates')
        expect(rates).toContain('setShowDueReviews(true)')
        expect(rates).toContain('<DueForReviewDialog')
    })

    it('shows rate review metrics, principles, and commercial memory rules', () => {
        expect(rates).toContain('Rate Review')
        expect(rates).toContain('Rate Book Principles')
        expect(rates).toContain('copy.principles.map')
        expect(rateBookHelpCopy.en.principles.join(' ')).toContain('updates matching yarn prices in linked Saved Qualities')
        expect(rateBookHelpCopy.en.principles.join(' ')).toContain('Historical costing snapshots keep their original numbers')
        expect(rateBookHelpCopy.en.principles.join(' ')).toContain('supplier-price check')
    })

    it('summarizes pending rates without rendering individual rail rows', () => {
        expect(rates).toContain("tx('Pending Rates')")
        expect(rates).toContain("tx('Awaiting review')")
        expect(rates).toContain('aria-label={tx(`${dueCount} pending ${dueCount === 1 ? \'rate\' : \'rates\'}`)}')
        expect(rates).not.toContain('dueReviewRates.slice(0, 3)')
        expect(rates).not.toContain('onReviewRate')
    })

    it('keeps category breakdown and clean summary in the full-width main column', () => {
        expect(rates).toContain('warpRatesCount')
        expect(rates).toContain('weftRatesCount')
        expect(rates).toContain('active yarn rates')
        expect(rates).toContain('Last reviewed')
    })
})
