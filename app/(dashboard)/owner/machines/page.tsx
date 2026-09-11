import LegacyMachinesPage from './LegacyMachinesPage'
import { requireRole } from '@/lib/auth'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { getSuratTodayString } from '@/lib/time'
import { loadMachinesRegister } from '../production/registers/loaders'
import MachinesRegister from '../production/registers/MachinesRegister'
export default async function MachinesPage({ searchParams }: { searchParams: Promise<{ register?: string }> }) {
 const { profile } = await requireRole(['owner'])
 const access = await getCachedOrgPlanAccess(profile.org_id)
 if ((await searchParams).register !== 'base' && hasCapability(access.effectiveTier, 'legacy_full_suite')) return <LegacyMachinesPage />
 const data = await loadMachinesRegister()
 if (!data) return null
 return <MachinesRegister key={data.orgId} machines={data.machines} today={getSuratTodayString()} />
}
