import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { legacyManagementHref } from '@/lib/management-navigation'
export default async function LegacyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
 const { profile } = await requireRole(['owner'])
 const access = await getCachedOrgPlanAccess(profile.org_id)
 if (!hasCapability(access.effectiveTier, 'production_management')) return null
 const params = new URLSearchParams()
 for (const [key, value] of Object.entries(await searchParams)) if (typeof value === 'string') params.set(key, value)
 redirect(legacyManagementHref('setup', params))
}
