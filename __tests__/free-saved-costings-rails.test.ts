import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Free Saved Costings right rail', () => {
    const free = read('app/free/costings/SavedFreeCostings.tsx')
    const tutorial = read('components/estimator/SavedCostingsTutorial.tsx')
    const styles = read('app/globals.css')

    const actionRailStart = free.indexOf('<aside className="saved-costings-action-rail-desktop"')
    const actionRailEnd = free.indexOf('</aside>', actionRailStart)
    const helpRailStart = free.indexOf('<div className="saved-costings-help-rail-desktop"')
    const helpRailEnd = free.indexOf('</div>', helpRailStart)

    it('puts New Costing at the top of the desktop rail as an ink rail action', () => {
        expect(actionRailStart).toBeGreaterThanOrEqual(0)
        const rail = free.slice(actionRailStart, actionRailEnd)
        expect(rail).toContain('data-tour-anchor="free-costings.new"')
        expect(rail).toContain("router.push('/free')")
        expect(rail).toContain("cn(railPrimaryAction, 'w-full')")
        expect(rail).not.toContain('variant="saffron"')
    })

    it('keeps the saffron New Costing in the page header only below the pinned-rail tier', () => {
        const header = free.slice(free.indexOf('<PageHeader'), actionRailStart)
        expect(header).toContain('data-tour-anchor="free-costings.new"')
        expect(header).toMatch(/className=\{!embedded \? 'rail-inline-actions' : undefined\}/)
    })

    it('puts More help at the bottom of the desktop rail, below the action', () => {
        expect(helpRailStart).toBeGreaterThan(actionRailEnd)
        expect(free.slice(helpRailStart, helpRailEnd)).toContain('<SavedCostingsHelp')
    })

    it('does not render either rail when embedded in Lite or Base history', () => {
        expect(free).toMatch(/\{!embedded && \(\s*<>\s*<aside className="saved-costings-action-rail-desktop"/)
    })

    it('shares one help disclosure and keeps an inline copy in the left rail below the pinned tier', () => {
        expect(tutorial).toMatch(/export function SavedCostingsHelp\(/)
        expect(tutorial.match(/<SavedCostingsHelp\b/g)?.length).toBe(1)
        expect(tutorial).toContain("cn('@container left-rail-bottom mt-auto pt-3', free && 'rail-inline-actions')")
    })

    it('opens the help in a modal from a rail pill instead of expanding inline', () => {
        const help = tutorial.slice(tutorial.indexOf('export function SavedCostingsHelp('), tutorial.indexOf('export function SavedCostingsTutorial('))
        expect(help).toContain('<RailDialog')
        expect(help).toContain('<RailDialogSection')
        expect(help).not.toContain('<details')
        expect(help).not.toContain('<summary')
    })

    it('hides the help rail below 1280px, anchors it to the bottom edge above that, and reserves the gutter for it', () => {
        expect(styles).toMatch(/\.saved-costings-archive-rail-desktop,\s*\.saved-costings-help-rail-desktop,[\s\S]*?\{\s*display:\s*none;/)
        expect(styles).toMatch(/\.saved-costings-help-rail-desktop,[\s\S]*?\{[\s\S]*?position:\s*fixed;[\s\S]*?bottom:\s*var\(--rail-bottom\);/)
        expect(styles).toMatch(/:root:has\(:is\([\s\S]*?\.saved-costings-help-rail-desktop[\s\S]*?\)\) :is\([\s\S]*?\.saved-costings-workspace/)
    })
})
