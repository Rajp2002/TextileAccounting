'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, AlertTriangle, XCircle, Package } from 'lucide-react'
import type { Order } from '../../actions/dashboard'
import { useTranslation } from '@/lib/i18n/context'

// ─── Pace classification ─────────────────────────────────────────────────────

function classifyOrder(order: Order): 'on-track' | 'at-risk' | 'critical' {
  if (order.days_remaining <= 0)   return 'critical'
  if (order.pace_index >= 1.0)     return 'on-track'
  if (order.pace_index >= 0.8)     return 'at-risk'
  return 'critical'
}

// ─── Individual order row ─────────────────────────────────────────────────────

function OrderRow({ order }: { order: Order }) {
  const { t } = useTranslation()
  const status = classifyOrder(order)

  const statusConfig = {
    'on-track': {
      icon:  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />,
      label: t('analytics.orders.card.active'), 
      bar:   'bg-success',
    },
    'at-risk': {
      icon:  <AlertTriangle className="h-4 w-4 text-warning shrink-0" />,
      label: t('analytics.orders.card.at_risk'),
      bar:   'bg-warning',
    },
    'critical': {
      icon:  <XCircle className="h-4 w-4 text-danger shrink-0" />,
      label: order.days_remaining <= 0 ? t('analytics.orders.card.overdue') : t('analytics.orders.card.at_risk'),
      bar:   'bg-danger',
    },
  }[status]

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/60 last:border-0">
      {statusConfig.icon}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-sm font-semibold text-foreground truncate">{order.party_name}</span>
          <span className="text-xs text-muted-foreground shrink-0">{order.progress_pct}%</span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${statusConfig.bar}`}
            style={{ width: `${Math.min(100, order.progress_pct)}%` }}
          />
        </div>
      </div>
      <span className={`text-xs font-medium shrink-0 hidden sm:block ${
        status === 'on-track' ? 'text-success' : status === 'at-risk' ? 'text-warning' : 'text-danger'
      }`}>
        {statusConfig.label}
      </span>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function OrderHealthSummary({ orders }: { orders: Order[] | null }) {
  const { t } = useTranslation()
  
  if (!orders || orders.length === 0) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-2xl border border-border bg-card shadow-sm p-5"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            {t('analytics.orders.card.health_index')}
          </h2>
          <Link
            href="/owner/orders"
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            Manage <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4 italic">{t('analytics.orders.no_active')}</p>
      </motion.section>
    )
  }

  const counts = orders.reduce(
    (acc, o) => {
      acc[classifyOrder(o)]++
      return acc
    },
    { 'on-track': 0, 'at-risk': 0, 'critical': 0 } as Record<string, number>
  )

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-border bg-card shadow-sm flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/60">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          {t('analytics.orders.card.health_index')}
          <span className="text-muted-foreground font-normal text-sm">({orders.length})</span>
        </h2>
        <Link
          href="/owner/orders"
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          Manage <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Summary pills */}
      <div className="grid grid-cols-3 divide-x divide-border/60 border-b border-border/60">
        {[
          { label: t('analytics.orders.card.active'),  count: counts['on-track'], color: 'text-success',  bg: 'bg-success/8' },
          { label: t('analytics.orders.card.at_risk'),   count: counts['at-risk'],  color: 'text-warning',  bg: 'bg-warning/8' },
          { label: t('analytics.orders.card.at_risk'),  count: counts['critical'], color: 'text-danger',   bg: 'bg-danger/8'  },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={`flex flex-col items-center py-3 ${bg}`}>
            <span className={`text-2xl font-bold tabular-nums ${color}`}>{count}</span>
            <span className="text-[11px] text-muted-foreground font-medium mt-0.5">{label}</span>
          </div>
        ))}
      </div>

      {/* Per-order rows */}
      <div className="px-5 pb-2">
        {orders.map(o => <OrderRow key={o.id} order={o} />)}
      </div>
    </motion.section>
  )
}
