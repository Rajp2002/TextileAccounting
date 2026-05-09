import { Suspense } from 'react'
import { OrdersClient } from './OrdersClient'
import { getOrdersWithProgress } from './actions'
import { Loader2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const { data: initialOrders } = await getOrdersWithProgress()
  
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>}>
      <OrdersClient initialOrders={initialOrders || []} />
    </Suspense>
  )
}
