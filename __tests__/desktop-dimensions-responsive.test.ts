import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Desktop workspace composition (sidebar | full-width workspace)', () => {
    const styles = read('app/globals.css')
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const rates = read('app/(dashboard)/owner/rates/RatesClient.tsx')
    const shells = ['estimator-workspace-shell', 'stock-workspace-shell', 'payroll-workspace-shell', 'workers-workspace-shell',
        'machines-workspace-shell', 'dispatch-workspace-shell', 'production-overview-workspace', 'production-daily-sheet-workspace',
        'configuration-page-frame', 'saved-costings-workspace', 'rates-workspace', 'billing-workspace-shell']

    it('renders text at its real size instead of zooming the whole document', () => {
        expect(styles).not.toMatch(/:root\s*\{[^}]*\bzoom:/)
        expect(styles).not.toContain('--app-desktop-zoom')
    })

    it('derives the content column from one set of shell tokens and keeps no rail tokens', () => {
        for (const token of ['--shell-sidebar-w', '--shell-area', '--main-pad', '--main-max', '--main-inset']) expect(styles).toContain(`${token}:`)
        expect(styles).not.toMatch(/--rail-[a-z]+:|--workspace-w:/)
        // No route hard-codes its own viewport offset.
        expect(styles).not.toMatch(/left:\s*calc\(248px\s*\+/)
    })

    it('gives every route workspace the full content width at every breakpoint', () => {
        const composition = styles.slice(styles.indexOf('/* ── Workspace composition'), styles.indexOf('.estimator-workspace-main {'))
        for (const shell of shells) expect(composition).toContain(`.${shell}`)
        expect(composition).toMatch(/\.billing-workspace-shell \{\s*width: 100%;\s*\}/)
        // Nothing reserves a gutter for a rail or centres the workspace between rails any more.
        expect(styles).not.toMatch(/margin-right:\s*var\(--rail-span\)|width:\s*min\(100%,\s*var\(--workspace-w\)\)/)
        expect(rates).toMatch(/<div\b[^>]*className=\{cn\("rates-workspace ui-route-enter w-full space-y-6",\s*isLite && mobileStyles\.workspace\)\}/)
        expect(rates).toContain("useOwnerPlan() === 'lite'")
        const mobileStyles = read('components/estimator/lite-records.module.css')
        // The default composition class remains unconditional; only mobile rules add Lite layout.
        expect(mobileStyles.slice(0, mobileStyles.indexOf('@media'))).not.toMatch(/\.workspace[^{}]*\{/)
        expect(mobileStyles).toMatch(/@media[^{}]*max-width: 767\.98px[^{}]*\{[\s\S]*?\.workspace \{ margin-top: 0;/)
    })

    it('keeps a lane beside the page for the tour card while a tour runs on wide screens', () => {
        expect(styles).toMatch(/@media \(min-width: 1280px\) \{\s*:root:has\(\.guided-tour-panel\) \.dashboard-main \{\s*padding-right: calc\(360px \+ 2rem\);/)
        // The lane matches the tour card's width.
        expect(read('components/tours/TourPanel.tsx')).toContain('w-[360px]')
    })

    it('anchors the live cost floating shortcut cleanly without overflowing into center container', () => {
        expect(estimator).toContain('data-testid="mobile-live-estimate-shortcut"')
        expect(estimator).toMatch(/className="[^"]*fixed mobile-floating-action bottom-6 right-4[^"]*lg:right-6 xl:right-8"/)
        // From 1280px it docks to the content column's right edge.
        expect(styles).toMatch(/@media \(min-width: 1280px\) \{\s*\[data-testid="mobile-live-estimate-shortcut"\] \{\s*right: var\(--main-inset\);/)
    })

    it('renders one Rate Book tutorial, in the page header', () => {
        expect(rates.match(/<RateBookTutorial\b/g)).toHaveLength(1)
        expect(rates).not.toContain('RateBookTutorialLauncher')
        expect(rates.indexOf('<RateBookTutorial')).toBeGreaterThan(rates.indexOf('<PageHeader'))
    })
})
