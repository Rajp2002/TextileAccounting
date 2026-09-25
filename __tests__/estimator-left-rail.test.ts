import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Estimator Left Rail & Guided Tour CTA', () => {
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const styles = read('app/globals.css')
    const tutorialComponent = read('components/estimator/CostEstimateTutorial.tsx')

    it('renders the left rail inside the estimator workspace shell before main content and reference rail', () => {
        const shellStart = estimator.indexOf('className="estimator-workspace-shell"')
        const leftRailStart = estimator.indexOf('<aside\n                    className="estimator-left-rail', shellStart)
        const tutorialStart = estimator.indexOf('<CostEstimateTutorial', leftRailStart)
        const leftRailEnd = estimator.indexOf('</aside>', leftRailStart)
        const mainContentStart = estimator.indexOf('className="estimator-workspace-main min-w-0"', leftRailEnd)
        const referenceRailStart = estimator.indexOf('className="estimator-reference-rail', mainContentStart)

        expect(shellStart).toBeGreaterThanOrEqual(0)
        expect(leftRailStart).toBeGreaterThan(shellStart)
        expect(tutorialStart).toBeGreaterThan(leftRailStart)
        expect(tutorialStart).toBeLessThan(leftRailEnd)
        expect(mainContentStart).toBeGreaterThan(leftRailEnd)
        expect(referenceRailStart).toBeGreaterThan(mainContentStart)
    })

    it('defines responsive positioning for .estimator-left-rail in globals.css matching the layout system', () => {
        expect(styles).toContain('.estimator-left-rail')
        expect(styles).toMatch(/\.estimator-left-rail,[^{]*\{[^}]*width:\s*100%/)
        expect(styles).toMatch(/@media\s*\(min-width:\s*1440px\)\s*\{[\s\S]*?\.estimator-left-rail,[\s\S]*?position:\s*fixed;[\s\S]*?top:\s*var\(--rail-top\);[\s\S]*?left:\s*var\(--rail-left\);[\s\S]*?width:\s*var\(--rail-w\);/)
    })

    it('gives the guided tour button an interactive subtle muted background and clear affordance', () => {
        expect(tutorialComponent).toContain('<TourInvitation')
        const invitation = read('components/tours/TourInvitation.tsx')
        const rail = read('components/ui/rail.ts')
        expect(invitation).toContain('Compass')
        expect(invitation).toContain('railSurface')
        expect(rail).toContain('hover:bg-surface-soft')
        expect(rail).toContain('shadow-xs')
        // The guide card owns its look; callers only size it.
        const invitationStart = tutorialComponent.indexOf('<TourInvitation')
        expect(tutorialComponent.slice(invitationStart, tutorialComponent.indexOf('/>', invitationStart))).not.toContain('amber')
        expect(tutorialComponent).toContain('estimator-touch-target')
        expect(tutorialComponent).toContain('railButton')
    })
})
