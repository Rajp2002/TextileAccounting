import { OrdersClient } from './OrdersClient'
import { getOrdersWithProgress } from './actions'

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const { data: initialOrders } = await getOrdersWithProgress()
  
  return <OrdersClient initialOrders={initialOrders || []} />
}
