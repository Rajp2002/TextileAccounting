import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hasCapability } from '../lib/subscription-access'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Settings payroll-cycle query is Base-only', () => {
    const settings = read('app/(dashboard)/owner/settings/page.tsx')
    const productionActions = read('app/(dashboard)/owner/production/actions.ts')

    // The server action rejects any tier without this capability, so the
    // client must not call it for those tiers (Lite reaches Settings via
    // account_data but has no production capability).
    it('the server action requires the production capability that Lite lacks', () => {
        expect(hasCapability('lite', 'account_data')).toBe(true)
        expect(hasCapability('lite', 'production')).toBe(false)
        expect(hasCapability('base', 'production')).toBe(true)
        expect(productionActions).toContain("hasCapability(tier, 'production')")
    })

    it('does not request the payroll cycle config unless the plan has production', () => {
        const query = settings.match(/useQuery\(\{\s*queryKey: \['base_payroll_cycle_config'[\s\S]*?\}\)/)?.[0]
        expect(query, 'base_payroll_cycle_config query not found').toBeTruthy()
        expect(query).toContain("hasCapability(tier, 'production')")
        expect(query).toMatch(/enabled:[^\n]*hasCapability\(tier, 'production'\)/)
    })
})
