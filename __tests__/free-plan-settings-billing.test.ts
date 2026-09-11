import { visibleOwnerNavigation } from '../lib/owner-navigation'
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Free plan Setting and Billing sections', () => {
    const groups = visibleOwnerNavigation({ tier: 'free', productionMode: 'market_run' })
    const ownerLayout = read('app/(dashboard)/owner/layout.tsx')

    it('keeps Free account destinations in the consolidated footer', () => {
        expect(groups.map(group => [group.id, group.items.map(item => item.href)])).toEqual([
            ['costing', ['/free', '/free/costings']],
            ['utilities', ['/free/account', '/free/billing']],
        ])
    })

    it('creates dedicated Free billing page and client with Active Workspace, standalone Plans link, and PaymentHistoryDialog', () => {
        expect(existsSync(join(root, 'app/free/billing/page.tsx'))).toBe(true)
        expect(existsSync(join(root, 'app/free/billing/FreeBillingClient.tsx'))).toBe(true)

        const billingPage = read('app/free/billing/page.tsx')
        const billingClient = read('app/free/billing/FreeBillingClient.tsx')

        expect(billingPage).toContain('FreeBillingClient')
        expect(billingPage).toContain('getOrgPlanAccess')
        expect(billingPage).toContain('getFreeGrant')

        expect(billingClient).toContain('PaymentHistoryDialog')
        expect(billingClient).toContain('/plans?from=billing')
        expect(billingClient).toContain('useFreeWorkspace')
        expect(billingClient).toContain('Weavly Free workspace')
    })

    it('provides /free/settings redirecting to /free/account', () => {
        expect(existsSync(join(root, 'app/free/settings/page.tsx'))).toBe(true)
        const settingsRedirect = read('app/free/settings/page.tsx')
        expect(settingsRedirect).toContain("redirect('/free/account')")
    })

    it('handles direct owner layout navigation with contextual redirects for free tier', () => {
        expect(ownerLayout).toContain("pathname.startsWith('/owner/billing')")
        expect(ownerLayout).toContain("redirect('/free/billing')")
        expect(ownerLayout).toContain("pathname.startsWith('/owner/settings')")
        expect(ownerLayout).toContain("redirect('/free/account')")
        expect(ownerLayout).toContain("redirect('/free')")
    })
})
