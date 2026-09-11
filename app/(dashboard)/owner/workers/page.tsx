import { getSuratTodayString } from '@/lib/time'
import { loadWorkersRegister } from '../production/registers/loaders'
import WorkersRegister from '../production/registers/WorkersRegister'
export default async function WorkersPage() {
 const data = await loadWorkersRegister()
 if (!data) return null
 return <WorkersRegister key={data.orgId} workers={data.workers} today={getSuratTodayString()} />
}
