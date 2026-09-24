import { requireRole } from '@/lib/auth'
import { getSuratTodayString } from '@/lib/time'
import { loadMachinesRegister } from '../production/registers/loaders'
import MachinesRegister from '../production/registers/MachinesRegister'
export default async function MachinesPage() {
 const { profile, user } = await requireRole(['owner'])
 const today = getSuratTodayString()
 const data = await loadMachinesRegister(today)
 if (!data) return null
 return <MachinesRegister userId={user.id} orgId={data.orgId} userMetadata={{ tour_preferences: user.user_metadata?.tour_preferences }} key={data.orgId} machines={data.machines} today={today} />
}
