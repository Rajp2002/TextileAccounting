import { getDashboardData } from '../actions/dashboard'
import { DashboardClient } from './_components/DashboardClient'
import { createClient } from '@/lib/supabase/server'
import { parseJWT } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return null
  }

  const { org_id } = parseJWT(session.access_token)
  const initialData = await getDashboardData()

  return (
    <div className="mx-auto max-w-7xl">
      <DashboardClient initialData={initialData} orgId={org_id} />
    </div>
  )
}
