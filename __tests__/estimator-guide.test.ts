import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Estimator Guide & Guided Tour CTA', () => {
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const styles = read('app/globals.css')
    const tutorialComponent = read('components/estimator/CostEstimateTutorial.tsx')

    it('renders the tutorial as the page header Guide, before the full-width workspace', () => {
        const headerStart = estimator.indexOf('<PageHeader')
        const tutorialStart = estimator.indexOf('<CostEstimateTutorial', headerStart)
        const shellStart = estimator.indexOf('className="estimator-workspace-shell"')
        const mainContentStart = estimator.indexOf('className="estimator-workspace-main min-w-0"', shellStart)

        expect(headerStart).toBeGreaterThanOrEqual(0)
        expect(tutorialStart).toBeGreaterThan(headerStart)
        expect(shellStart).toBeGreaterThan(tutorialStart)
        expect(mainContentStart).toBeGreaterThan(shellStart)
        expect(estimator.match(/<CostEstimateTutorial\b/g)).toHaveLength(1)
        // The glossary and archive policy are Guide topics, not a reference rail.
        expect(estimator).toContain('topics={[factoryGlossaryTopic, archivePolicyTopic]}')
        expect(estimator).not.toMatch(/estimator-(left|reference)-rail/)
    })

    it('gives the estimator workspace the full content width in globals.css', () => {
        expect(styles).not.toContain('.estimator-left-rail')
        expect(styles).not.toContain('.estimator-reference-rail')
        expect(styles).toMatch(/\.estimator-workspace-main \{\s*min-width: 0;\s*width: 100%;/)
    })

    it('gives the guided tour card a prominent saffron-tinted surface and clear affordance', () => {
        expect(tutorialComponent).toContain('<TourInvitation')
        const invitation = read('components/tours/TourInvitation.tsx')
        const rail = read('components/ui/rail.ts')
        expect(invitation).toContain('Compass')
        expect(invitation).toContain('railGuideSurface')
        expect(rail).toContain('bg-saffron-soft')
        // The guide card owns its look; callers only pass the tour and its topics.
        const invitationStart = tutorialComponent.indexOf('<TourInvitation')
        expect(tutorialComponent.slice(invitationStart, tutorialComponent.indexOf('/>', invitationStart))).not.toContain('amber')
        // Saving or an unconfigured estimate disables the start, but the Guide stays mounted and readable.
        expect(tutorialComponent).toContain('launchDisabled={!enabled}')
        expect(tutorialComponent).not.toContain('fieldGuide')
    })
})
