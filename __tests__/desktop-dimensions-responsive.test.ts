import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Desktop workspace composition (sidebar | left rail | workspace | right rail)', () => {
    const styles = read('app/globals.css')
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const rates = read('app/(dashboard)/owner/rates/RatesClient.tsx')

    it('renders text at its real size instead of zooming the whole document', () => {
        expect(styles).not.toMatch(/:root\s*\{[^}]*\bzoom:/)
        expect(styles).not.toContain('--app-desktop-zoom')
    })

    it('derives every rail offset from one set of composition tokens', () => {
        for (const token of ['--shell-sidebar-w', '--rail-w', '--rail-gap', '--rail-top', '--rail-bottom', '--rail-span', '--workspace-w', '--rail-outer', '--rail-left', '--rail-right']) {
            expect(styles).toContain(`${token}:`)
        }
        expect(styles).toMatch(/--workspace-w:\s*min\(var\(--workspace-max\),\s*calc\(var\(--shell-area\)\s*-\s*2 \* var\(--rail-edge\)\s*-\s*2 \* var\(--rail-span\)\)\)/)
        expect(styles).toMatch(/--rail-left:\s*calc\(var\(--shell-sidebar-w\)\s*\+\s*var\(--rail-outer\)\)/)
        // No route hard-codes its own viewport offset any more.
        expect(styles).not.toMatch(/left:\s*calc\(248px\s*\+/)
    })

    it('lifts the right rail out of the flow at 1280px and both rails at 1440px', () => {
        expect(styles).toMatch(/@media\s*\(min-width:\s*1280px\)\s*\{[\s\S]*?\.estimator-reference-rail[\s\S]*?position:\s*fixed;[\s\S]*?right:\s*var\(--rail-right\)/)
        expect(styles).toMatch(/@media\s*\(min-width:\s*1440px\)\s*\{[\s\S]*?\.estimator-left-rail[\s\S]*?position:\s*fixed;[\s\S]*?left:\s*var\(--rail-left\)/)
        expect(styles).toMatch(/@media\s*\(min-width:\s*1440px\)\s*\{[\s\S]*?\.rates-left-rail-desktop[\s\S]*?position:\s*fixed/)
        expect(styles).toMatch(/@media\s*\(min-width:\s*1440px\)\s*\{[\s\S]*?\.saved-costings-left-rail[\s\S]*?position:\s*fixed/)
    })

    it('reserves the workspace width from the tokens so the centre never collides with a rail', () => {
        expect(styles).toMatch(/@media\s*\(min-width:\s*1440px\)\s*\{[\s\S]*?\.estimator-workspace-shell[\s\S]*?width:\s*min\(100%,\s*var\(--workspace-w\)\)/)
        expect(styles).toMatch(/margin-right:\s*var\(--rail-span\)/)
        expect(rates).toContain('<div className="rates-workspace ui-route-enter')
    })

    it('anchors the live cost floating shortcut cleanly without overflowing into center container', () => {
        expect(estimator).toContain('data-testid="mobile-live-estimate-shortcut"')
        expect(estimator).toMatch(/className="[^"]*fixed bottom-\[calc\(76px\+env\(safe-area-inset-bottom,0px\)\)\] right-4[^"]*lg:right-6 xl:right-8"/)
    })

    it('shows the inline Rate Book tour launcher only on phones, where the guide rail is hidden', () => {
        expect(rates).toContain('className="lg:hidden"')
    })

    it('orders the inline rail rules before the tier media queries so a rail never expands to full width on desktop', () => {
        const baseReferenceIndex = styles.indexOf('  .estimator-reference-rail,\n  .workers-reference-rail,')
        const tierIndex = styles.indexOf('@media (min-width: 1280px) {', baseReferenceIndex)
        expect(baseReferenceIndex).toBeGreaterThan(0)
        expect(tierIndex).toBeGreaterThan(baseReferenceIndex)

        const afterTier = styles.slice(tierIndex)
        expect(afterTier).not.toMatch(/\.estimator-reference-rail\s*\{[^}]*width:\s*100%/)
        expect(afterTier).not.toMatch(/\.estimator-left-rail\s*\{[^}]*width:\s*100%/)
    })
})
