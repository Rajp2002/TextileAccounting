import { freeContext } from '@/lib/free-service'
import SavedFreeCostings from './SavedFreeCostings'

export default async function Page({ searchParams }: { searchParams: Promise<{ costing?: string | string[] }> }) {
  const { user, profile } = await freeContext({ allowInactive: true })
  const query = await searchParams
  const initialCostingId = typeof query.costing === 'string' ? query.costing : undefined
  return <SavedFreeCostings initialCostingId={initialCostingId} userId={user.id} orgId={profile.org_id} userMetadata={{ tour_preferences: user.user_metadata?.tour_preferences }} />
}
