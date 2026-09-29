import { freeContext } from '@/lib/free-service'
import SavedFreeCostings from './SavedFreeCostings'

export default async function Page() {
  const { user, profile } = await freeContext({ allowInactive: true })
  return <SavedFreeCostings userId={user.id} orgId={profile.org_id} userMetadata={{ tour_preferences: user.user_metadata?.tour_preferences }} />
}
