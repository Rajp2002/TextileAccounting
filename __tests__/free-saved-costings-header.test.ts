import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

/** Free Saved Costings has no rails: its Guide and New Costing are the page header's actions. */
describe('Free Saved Costings header', () => {
    const free = read('app/free/costings/SavedFreeCostings.tsx')
    const tutorial = read('components/estimator/SavedCostingsTutorial.tsx')
    const styles = read('app/globals.css')
    const header = free.slice(free.indexOf('<PageHeader'), free.indexOf('/>\n', free.indexOf('</>', free.indexOf('<PageHeader'))))

    it('ends the header with New Costing as the ink primary action, once', () => {
        expect(header).toContain('data-tour-anchor="free-costings.new"')
        expect(header).toContain("router.push('/free')")
        expect(header).toContain('className={railPrimaryAction}')
        expect(header).not.toContain('variant="saffron"')
        expect(free.match(/data-tour-anchor="free-costings\.new"/g)).toHaveLength(1)
    })

    it('puts the Guide before New Costing, and only on the Free page itself', () => {
        expect(header.indexOf('<SavedCostingsTutorial free')).toBeLessThan(header.indexOf('data-tour-anchor="free-costings.new"'))
        // Embedded in Lite or Base history, the host page owns its own Guide.
        expect(header).toContain('{!embedded && <SavedCostingsTutorial free')
        expect(free.match(/<SavedCostingsTutorial\b/g)).toHaveLength(1)
    })

    it('lists Free help as a Guide topic that opens in the modal instead of expanding inline', () => {
        const help = tutorial.slice(tutorial.indexOf('export function useSavedCostingsHelpTopic('), tutorial.indexOf('export function SavedCostingsTutorial('))
        expect(help).toContain('free ? [copy.fields.freeHelp, copy.fields.customer, copy.fields.share]')
        expect(help).toContain('<GuideSection')
        expect(help).not.toContain('<details')
        expect(help).not.toContain('<summary')
    })

    it('keeps no rail rules for Saved Costings in the global styles', () => {
        expect(styles).not.toMatch(/saved-costings-(left|action|help|archive)-rail/)
        expect(free).not.toMatch(/saved-costings-(left|action|help)-rail|rail-inline-actions/)
    })
})
