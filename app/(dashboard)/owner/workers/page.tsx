import { requireRole } from '@/lib/auth'
import { getSuratTodayString } from '@/lib/time'
import { loadWorkersRegister } from '../production/registers/loaders'
import WorkersRegister from '../production/registers/WorkersRegister'
export default async function WorkersPage() {
  const today = getSuratTodayString()
  const data = await loadWorkersRegister(today)
  if (!data) return null
  const { user } = await requireRole(['owner'])
  return <WorkersRegister userId={user.id} orgId={data.orgId} userMetadata={{ tour_preferences: user.user_metadata?.tour_preferences }} key={data.orgId} workers={data.workers} today={today} />
}
