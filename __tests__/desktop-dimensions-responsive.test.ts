import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Desktop Dimensions Responsive Scaling & Layout', () => {
    const styles = read('app/globals.css')
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const rates = read('app/(dashboard)/owner/rates/RatesClient.tsx')

    it('defines calibrated proportional desktop scaling across laptop and desktop viewport brackets', () => {
        expect(styles).toMatch(/@media\s*\(min-width:\s*1024px\)\s*and\s*\(max-width:\s*1279px\)\s*\{[\s\S]*?:root\s*\{[\s\S]*?zoom:\s*0\.74;/)
        expect(styles).toMatch(/@media\s*\(min-width:\s*1280px\)\s*and\s*\(max-width:\s*1439px\)\s*\{[\s\S]*?:root\s*\{[\s\S]*?zoom:\s*0\.80;/)
        expect(styles).toMatch(/@media\s*\(min-width:\s*1440px\)\s*and\s*\(max-width:\s*1659px\)\s*\{[\s\S]*?:root\s*\{[\s\S]*?zoom:\s*0\.88;/)
        expect(styles).toMatch(/@media\s*\(min-width:\s*1660px\)\s*and\s*\(max-width:\s*1799px\)\s*\{[\s\S]*?:root\s*\{[\s\S]*?zoom:\s*0\.94;/)
    })

    it('enables fixed left and reference rails from 1024px desktop upwards', () => {
        expect(styles).toMatch(/@media\s*\(min-width:\s*1024px\)\s*\{[\s\S]*?\.estimator-left-rail\s*\{[\s\S]*?position:\s*fixed/)
        expect(styles).toMatch(/@media\s*\(min-width:\s*1024px\)\s*\{[\s\S]*?\.estimator-reference-rail\s*\{[\s\S]*?position:\s*fixed/)
        expect(styles).toMatch(/@media\s*\(min-width:\s*1024px\)\s*\{[\s\S]*?\.rates-left-rail-desktop\s*\{[\s\S]*?display:\s*block/)
        expect(styles).toMatch(/@media\s*\(min-width:\s*1024px\)\s*\{[\s\S]*?\.saved-costings-left-rail\s*\{[\s\S]*?position:\s*fixed/)
    })

    it('reserves dedicated side gutters on desktop so center workspace never collides with rails or live cost pill', () => {
        expect(styles).toMatch(/@media\s*\(min-width:\s*1024px\)\s*\{[\s\S]*?\.estimator-workspace-shell\s*\{[\s\S]*?width:\s*min\(100%,\s*calc\(100vw\s*-\s*248px\s*-\s*31rem\)\)/)
    })

    it('anchors the live cost floating shortcut cleanly without overflowing into center container', () => {
        expect(estimator).toContain('data-testid="mobile-live-estimate-shortcut"')
        expect(estimator).toMatch(/className="[^"]*fixed bottom-\[calc\(76px\+env\(safe-area-inset-bottom,0px\)\)\] right-4[^"]*lg:right-6 xl:right-8"/)
    })

    it('hides duplicate inline tour launcher on rates page when left rail is active', () => {
        expect(rates).toContain('className="lg:hidden min-[1660px]:hidden"')
    })
})
