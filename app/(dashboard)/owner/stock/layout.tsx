import AccessGate from '@/components/billing/AccessGate'
import { getCachedSession } from '@/lib/auth'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { usesCollapsibleNavigation } from '@/lib/disclosure-navigation'
import StockPageTitle from './StockPageTitle'
import StockNavigation from './StockNavigation'

async function LegacyStockNavigation() {
    const session = await getCachedSession()
    if (!session) return null
    const access = await getCachedOrgPlanAccess(session.profile.org_id)
    return usesCollapsibleNavigation(access.effectiveTier) ? null : <StockNavigation />
}
export default function StockLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredCapability="production" routeName="/owner/stock"><StockPageTitle /><LegacyStockNavigation />{children}</AccessGate>
}
