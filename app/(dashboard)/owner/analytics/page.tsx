import { getOwnerAnalytics } from '../actions/analytics'
import { OwnerAnalyticsClient } from './_components/OwnerAnalyticsClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Analytics — Weavly',
  description: 'Production, profitability, loom performance, and cash insights for factory owners.',
}

export default async function AnalyticsPage() {
  const initialData = await getOwnerAnalytics(30)

  return (
    <div className="mx-auto max-w-7xl">
      <OwnerAnalyticsClient initialData={initialData} />
    </div>
  )
}
