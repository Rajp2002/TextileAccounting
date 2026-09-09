import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('P1 Billing Gates Coverage', () => {
    it('verifies /owner/quotes has AccessGate with the saved-costings capability', () => {
        const content = readProjectFile('app/(dashboard)/owner/quotes/layout.tsx')
        expect(content).toContain('AccessGate')
        expect(content).toContain('requiredCapability="saved_costings"')
    })

    it('verifies /owner/market-runs has AccessGate with premium tier', () => {
        const content = readProjectFile('app/(dashboard)/owner/market-runs/layout.tsx')
        expect(content).toContain('AccessGate')
        expect(content).toContain('requiredTier="premium"')
    })

    it('verifies /owner/stock has AccessGate with production capability', () => {
        const content = readProjectFile('app/(dashboard)/owner/stock/layout.tsx')
        expect(content).toContain('AccessGate')
        expect(content).toContain('requiredCapability="production"')
    })

    it('verifies /owner/dispatches has AccessGate with production capability', () => {
        const content = readProjectFile('app/(dashboard)/owner/dispatches/layout.tsx')
        expect(content).toContain('AccessGate')
        expect(content).toContain('requiredCapability="production"')
    })

    it('verifies /owner/commercials has AccessGate with premium tier', () => {
        const content = readProjectFile('app/(dashboard)/owner/commercials/layout.tsx')
        expect(content).toContain('AccessGate')
        expect(content).toContain('requiredTier="premium"')
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
