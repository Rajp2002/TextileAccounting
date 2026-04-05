'use client'

import { Order } from '../../actions/dashboard'
import { OrderCard } from './OrderCard'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, PackagePlus, LayoutDashboard, Users } from 'lucide-react'
import { motion } from 'framer-motion'

// ─── Section Header (no create button — creation lives on Orders page) ─────────

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex justify-between items-end mb-4">
      <h2 className="text-xl font-bold">
        {title} {count !== undefined && <span className="text-muted-foreground ml-2">({count})</span>}
      </h2>
      <Link
        href="/owner/orders"
        className="flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
      >
        Manage <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function NoActiveOrders() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      {/* Subtle gradient accent */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 0%, hsl(var(--primary)/0.06) 0%, transparent 100%)',
        }}
      />

      <div className="relative flex flex-col items-center px-8 py-16 text-center">
        {/* Icon ring */}
        <div className="mb-6 relative">
          <div className="w-20 h-20 rounded-2xl bg-primary/8 border border-primary/12 flex items-center justify-center shadow-inner">
            <PackagePlus className="h-9 w-9 text-primary/50" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-primary/60" />
          </span>
        </div>

        {/* Headline */}
        <h2 className="text-2xl font-bold tracking-tight mb-2">No active orders</h2>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-8 leading-relaxed">
          Create an order to start tracking production pace and deadlines.
        </p>

        {/* Primary CTA → navigates to orders page */}
        <Link href="/owner/orders">
          <Button
            size="lg"
            className="gap-2 rounded-full px-8 h-12 font-semibold text-base shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Go to Orders
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>

        {/* Steps guide */}
        <div className="mt-10 grid grid-cols-3 gap-6 w-full max-w-sm text-left">
          {[
            { icon: PackagePlus, label: 'Create order', sublabel: 'Party + fabric + meters', active: true },
            { icon: LayoutDashboard, label: 'Assign machine', sublabel: 'Link loom to order', active: false },
            { icon: Users, label: 'Log shifts', sublabel: 'Supervisor enters meters', active: false },
          ].map((step, i) => (
            <div key={i} className="flex flex-col items-center text-center gap-1.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-1 ${
                step.active
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                  : 'bg-muted text-muted-foreground'
              }`}>
                <step.icon className="h-4 w-4" />
              </div>
              <p className={`text-xs font-semibold ${step.active ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
              </p>
              <p className="text-[10px] text-muted-foreground/70 leading-tight">{step.sublabel}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

// ─── Carousel ─────────────────────────────────────────────────────────────────

function OrderCarousel({
  orders,
  allMachines,
  onRefresh,
}: {
  orders: Order[]
  allMachines: Array<{ id: string; name: string; current_order_id: string | null }>
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

// ─── Main Export ──────────────────────────────────────────────────────────────

export function OrdersSection({
  orders,
  allMachines,
  onRefresh,
}: {
  orders: Order[] | null
  allMachines: Array<{ id: string; name: string; current_order_id: string | null }>
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
    return <NoActiveOrders />
  }

  if (orders.length === 1) {
    return (
      <section>
        <SectionHeader title="Active orders" />
        <OrderCard order={orders[0]} variant="hero" allMachines={allMachines} onRefresh={onRefresh} />
      </section>
    )
  }

  if (orders.length <= 4) {
    return (
      <section>
        <SectionHeader title="Active orders" count={orders.length} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orders.map(o => <OrderCard key={o.id} order={o} variant="grid" allMachines={allMachines} onRefresh={onRefresh} />)}
        </div>
      </section>
    )
  }

  return (
    <section>
      <SectionHeader title="Active orders" count={orders.length} />
      <OrderCarousel orders={orders} allMachines={allMachines} onRefresh={onRefresh} />
    </section>
  )
}
