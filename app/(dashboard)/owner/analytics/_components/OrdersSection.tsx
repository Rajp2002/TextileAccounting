import { Order } from '../../actions/dashboard'
import { OrderCard } from './OrderCard'
import Link from 'next/link'
import { NewOrderSheet } from './NewOrderSheet'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

function SectionHeader({ title, count, onOrderCreated }: { title: string, count?: number, onOrderCreated?: () => void }) {
  return (
    <div className="flex justify-between items-end mb-4">
      <h2 className="text-xl font-bold">
        {title} {count !== undefined && <span className="text-muted-foreground ml-2">({count})</span>}
      </h2>
      <NewOrderSheet onSuccess={onOrderCreated} />
    </div>
  )
}

function NoActiveOrders({ onOrderCreated }: { onOrderCreated?: () => void }) {
  return (
    <section className="bg-card border border-border shadow-sm rounded-xl p-10 text-center flex flex-col items-center justify-center min-h-[300px]">
      <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mb-6">
        <Plus size={32} className="text-muted-foreground/40" />
      </div>
      <h2 className="text-2xl font-bold mb-3">No active orders</h2>
      <p className="text-muted-foreground max-w-sm mx-auto mb-8">
        Your order queue is currently empty. Create your first order to start tracking production pace and deadlines.
      </p>
      <div className="flex gap-4">
        <NewOrderSheet onSuccess={onOrderCreated} />
        <Link href="/owner/orders">
          <Button variant="outline">View All Orders</Button>
        </Link>
      </div>
    </section>
  )
}

function OrderCarousel({ 
  orders, 
  allMachines,
  onRefresh
}: { 
  orders: Order[], 
  allMachines: Array<{ id: string, name: string, current_order_id: string | null }>,
  onRefresh?: () => void
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 px-1 snap-x">
      {orders.map(o => (
        <div key={o.id} className="snap-start">
          <OrderCard order={o} variant="carousel" allMachines={allMachines} onRefresh={onRefresh} />
        </div>
      ))}
    </div>
  )
}

export function OrdersSection({ 
  orders, 
  allMachines,
  onOrderCreated,
  onRefresh
}: { 
  orders: Order[] | null, 
  allMachines: Array<{ id: string, name: string, current_order_id: string | null }>,
  onOrderCreated?: () => void,
  onRefresh?: () => void
}) {
  if (!orders) {
    return (
      <section className="bg-card border border-border shadow-sm rounded-xl p-10 text-center bg-muted/5">
        <h2 className="text-xl font-bold mb-3 text-muted-foreground/80">Active orders data unavailable</h2>
        <p className="text-muted-foreground/60 mb-0 italic">Network or server error. Could not load orders.</p>
      </section>
    )
  }

  if (orders.length === 0) {
    return <NoActiveOrders onOrderCreated={onOrderCreated} />
  }

  if (orders.length === 1) {
    return (
      <section>
        <SectionHeader title="Active orders" onOrderCreated={onOrderCreated} />
        <OrderCard order={orders[0]} variant="hero" allMachines={allMachines} onRefresh={onRefresh} />
      </section>
    )
  }

  if (orders.length <= 4) {
    return (
      <section>
        <SectionHeader title="Active orders" count={orders.length} onOrderCreated={onOrderCreated} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orders.map(o => <OrderCard key={o.id} order={o} variant="grid" allMachines={allMachines} onRefresh={onRefresh} />)}
        </div>
      </section>
    )
  }

  // 5+ orders: horizontal scroll carousel
  return (
    <section>
      <SectionHeader title="Active orders" count={orders.length} onOrderCreated={onOrderCreated} />
      <OrderCarousel orders={orders} allMachines={allMachines} onRefresh={onRefresh} />
    </section>
  )
}
