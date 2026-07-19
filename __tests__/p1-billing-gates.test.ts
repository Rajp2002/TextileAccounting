import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('P1 Billing Gates Coverage', () => {
    it('verifies /owner/quotes has AccessGate with base tier', () => {
        const content = readProjectFile('app/(dashboard)/owner/quotes/layout.tsx')
        expect(content).toContain('AccessGate')
        expect(content).toContain('requiredTier="base"')
    })

    it.each([
        ['/owner/today', 'app/(dashboard)/owner/today/layout.tsx'],
        ['/owner/machines', 'app/(dashboard)/owner/machines/layout.tsx'],
        ['/owner/payroll', 'app/(dashboard)/owner/payroll/layout.tsx'],
        ['/owner/analytics', 'app/(dashboard)/owner/analytics/layout.tsx'],
        ['/owner/market-runs', 'app/(dashboard)/owner/market-runs/layout.tsx'],
        ['/owner/stock', 'app/(dashboard)/owner/stock/layout.tsx'],
        ['/owner/dispatches', 'app/(dashboard)/owner/dispatches/layout.tsx'],
        ['/owner/commercials', 'app/(dashboard)/owner/commercials/layout.tsx'],
    ])('verifies %s has AccessGate with premium tier', (_route, layoutPath) => {
        const content = readProjectFile(layoutPath)
        expect(content).toContain('AccessGate')
        expect(content).toContain('requiredTier="premium"')
    })

    it('keeps Factory Today on the shared Base upgrade wall without a route-local redirect', () => {
        const todayLayout = readProjectFile('app/(dashboard)/owner/today/layout.tsx')
        const todayPage = readProjectFile('app/(dashboard)/owner/today/page.tsx')
        const gate = readProjectFile('components/billing/AccessGate.tsx')

        expect(todayLayout).toContain('routeName="/owner/today"')
        expect(todayLayout).not.toContain('redirect(')
        expect(todayLayout).not.toContain('/owner/estimator')
        expect(todayPage).not.toContain('redirect(')
        expect(todayPage).not.toContain("router.replace('/owner/estimator")
        expect(gate).toContain('return <UpgradeWall currentTier={tier} />')
        expect(gate).toContain('Return to Cost Estimate')
        expect(gate).not.toContain("redirect('/owner/estimator')")
    })

    it('verifies /owner/billing is not accidentally gated by this change', () => {
        const layoutPath = join(root, 'app/(dashboard)/owner/billing/layout.tsx')
        if (existsSync(layoutPath)) {
            const content = readFileSync(layoutPath, 'utf8')
            expect(content).not.toContain('AccessGate')
        } else {
            // If it doesn't exist, it's definitely not gated by AccessGate in a layout
            expect(true).toBe(true)
        }
    })
})
