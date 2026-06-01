import { getDashboardData } from '../actions/dashboard'
import { DashboardClient } from './_components/DashboardClient'
import { getAuthenticatedUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const { profile } = await getAuthenticatedUser()
  const initialData = await getDashboardData()

  return (
    <div className="mx-auto max-w-7xl">
      <DashboardClient initialData={initialData} orgId={profile.org_id} />
    </div>
  )
}
