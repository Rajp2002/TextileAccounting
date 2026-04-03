import { Order } from '../../actions/dashboard'
import { OrderCard } from './OrderCard'
import Link from 'next/link'

function SectionHeader({ title, count }: { title: string, count?: number }) {
  return (
    <div className="flex justify-between items-end mb-4">
      <h2 className="text-xl font-bold">
        {title} {count !== undefined && <span className="text-muted-foreground ml-2">({count})</span>}
      </h2>
    </div>
  )
}

function NoActiveOrders() {
  return (
    <section className="bg-card border border-border shadow-sm rounded-xl p-8 text-center">
      <h2 className="text-xl font-bold mb-2">Active orders</h2>
      <p className="text-muted-foreground mb-4">No active orders. Create an order to start tracking deadlines and machine assignments.</p>
      <Link href="/owner/orders" className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium inline-block relative overflow-hidden transition-all hover:scale-105 shadow hover:shadow-md">
        Go to Orders
      </Link>
    </section>
  )
}

function OrderCarousel({ orders }: { orders: Order[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 px-1 snap-x">
      {orders.map(o => (
        <div key={o.id} className="snap-start">
          <OrderCard order={o} variant="carousel" />
        </div>
      ))}
    </div>
  )
}

export function OrdersSection({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return <NoActiveOrders />
  }

  if (orders.length === 1) {
    return (
      <section>
        <SectionHeader title="Active orders" />
        <OrderCard order={orders[0]} variant="hero" />
      </section>
    )
  }

  if (orders.length <= 4) {
    return (
      <section>
        <SectionHeader title="Active orders" count={orders.length} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orders.map(o => <OrderCard key={o.id} order={o} variant="grid" />)}
        </div>
      </section>
    )
  }

  // 5+ orders: horizontal scroll carousel
  return (
    <section>
      <SectionHeader title="Active orders" count={orders.length} />
      <OrderCarousel orders={orders} />
    </section>
  )
}
