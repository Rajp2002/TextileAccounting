import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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
        const routeWrapperStart = rates.indexOf('<div className="premium-route-enter')
        const viewportControlsStart = rates.indexOf('<aside className="rates-review-rail-desktop')
        const floatingControlStart = rates.indexOf('<RateReviewFloatingButton')
        const routeWrapperEnd = rates.indexOf('\n            </div>\n\n            {/* Keep viewport-positioned review controls')

        expect(routeWrapperStart).toBeGreaterThanOrEqual(0)
        expect(routeWrapperEnd).toBeGreaterThan(routeWrapperStart)
        expect(viewportControlsStart).toBeGreaterThan(routeWrapperEnd)
        expect(floatingControlStart).toBeGreaterThan(routeWrapperEnd)
    })

    it('places the archive policy at the bottom of the desktop rail and keeps it reachable on narrow screens', () => {
        const routeArchiveStart = rates.indexOf('<ArchivePolicyNotice />')
        const railStart = rates.indexOf('<aside className="rates-review-rail-desktop')
        const referenceStart = rates.indexOf('<RateBookReferenceCard />', railStart)
        const railArchiveStart = rates.indexOf('<ArchivePolicyNotice />', railStart)
        const railEnd = rates.indexOf('</aside>', railStart)

        expect(rates).toContain('<div className="min-[1540px]:hidden">')
        expect(routeArchiveStart).toBeGreaterThanOrEqual(0)
        expect(railStart).toBeGreaterThan(routeArchiveStart)
        expect(referenceStart).toBeGreaterThan(railStart)
        expect(railArchiveStart).toBeGreaterThan(referenceStart)
        expect(railArchiveStart).toBeLessThan(railEnd)
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
        expect(rates).toContain('Future Estimates:')
        expect(rates).toContain('Audit Integrity:')
        expect(rates).toContain('Auto-Discovery:')
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
