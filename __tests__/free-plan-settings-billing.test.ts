import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Free plan Setting and Billing sections', () => {
    const sidebar = read('components/navigation/owner-sidebar.tsx')
    const ownerLayout = read('app/(dashboard)/owner/layout.tsx')

    it('includes Setting and Billing sections in the Free plan navigation', () => {
        expect(sidebar).toContain('const freeNavGroups = [')
        expect(sidebar).toContain('subscriptionTier === \'free\' ? freeNavGroups : navGroups')
        
        // Check all three navigation groups for Free plan
        expect(sidebar).toContain("href: \"/free\"")
        expect(sidebar).toContain("href: \"/free/costings\"")
        expect(sidebar).toContain("href: \"/free/billing\"")
        expect(sidebar).toContain("href: \"/free/account\"")

        // Items and icons
        expect(sidebar).toContain("{ name: \"Billing\", href: \"/free/billing\"")
        expect(sidebar).toContain("{ name: \"Settings\", href: \"/free/account\"")
    })

    it('updates sidebar footer link to route free accounts to /free/billing', () => {
        expect(sidebar).toContain("href={subscriptionTier === 'free' ? '/free/billing' : '/owner/billing'}")
        expect(sidebar).toContain('Subscription & Billing')
    })

    it('creates dedicated Free billing page and client with UpgradeWall and SubscribeButton', () => {
        expect(existsSync(join(root, 'app/free/billing/page.tsx'))).toBe(true)
        expect(existsSync(join(root, 'app/free/billing/FreeBillingClient.tsx'))).toBe(true)

        const billingPage = read('app/free/billing/page.tsx')
        const billingClient = read('app/free/billing/FreeBillingClient.tsx')

        expect(billingPage).toContain('FreeBillingClient')
        expect(billingPage).toContain('getOrgPlanAccess')
        expect(billingPage).toContain('getFreeGrant')

        expect(billingClient).toContain('UpgradeWall')
        expect(billingClient).toContain('SubscribeButton')
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
