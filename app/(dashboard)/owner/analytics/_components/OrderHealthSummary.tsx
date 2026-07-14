'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, AlertTriangle, XCircle, Package } from 'lucide-react'
import type { Order } from '../../actions/dashboard'
import { useTranslation } from '@/lib/i18n/context'

// ─── Pace classification ─────────────────────────────────────────────────────

export function classifyOrder(order: Order): 'on-track' | 'at-risk' | 'critical' | 'no-data' {
  if (order.meters_produced === 0) return 'no-data'
  if (order.days_remaining <= 0)   return 'critical'
  if (order.pace_index >= 1.0)     return 'on-track'
  if (order.pace_index >= 0.8)     return 'at-risk'
  return 'critical'
}

// ─── Individual order row ─────────────────────────────────────────────────────

function OrderRow({ order, index }: { order: Order; index: number }) {
  const { t } = useTranslation()
  const status = classifyOrder(order)

  const statusConfig = {
    'on-track': {
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />,
      label: t('analytics.orders.card.active'),
      track: 'bg-emerald-500',
      trackBg: 'bg-emerald-500/10',
    },
    'at-risk': {
      icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />,
      label: t('analytics.orders.card.at_risk'),
      track: 'bg-amber-500',
      trackBg: 'bg-amber-500/10',
    },
    'critical': {
      icon: <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />,
      label: order.days_remaining <= 0 ? t('analytics.orders.card.overdue') : t('analytics.orders.card.at_risk'),
      track: 'bg-red-500',
      trackBg: 'bg-red-500/10',
    },
    'no-data': {
      icon: <Package className="h-3.5 w-3.5 text-slate-400 shrink-0" />,
      label: t('analytics.orders.card.waiting_for_logs'),
      track: 'bg-slate-300',
      trackBg: 'bg-slate-300/10',
    },
  }[status]

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="flex items-center gap-3 py-3 border-b border-border/40 last:border-0"
    >
      {statusConfig.icon}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-sm font-medium text-foreground truncate">{order.party_name}</span>
          <span className="text-xs tabular-nums text-muted-foreground shrink-0">{order.progress_pct}%</span>
        </div>
        <div className={`h-1 w-full ${statusConfig.trackBg} rounded-full overflow-hidden`}>
          <div
            className={`h-full rounded-full transition-all ${statusConfig.track}`}
            style={{ width: `${Math.min(100, order.progress_pct)}%` }}
          />
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function OrderHealthSummary({ orders }: { orders: Order[] | null }) {
  const { t } = useTranslation()

  const empty = !orders || orders.length === 0

  const counts = !empty ? orders.reduce(
    (acc, o) => { 
      const s = classifyOrder(o)
      const key = s === 'no-data' ? 'at-risk' : s
      acc[key]++
      return acc 
    },
    { 'on-track': 0, 'at-risk': 0, 'critical': 0 } as Record<string, number>
  ) : null

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-card rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            {t('analytics.orders.card.health_index')}
            {counts && <span className="text-muted-foreground font-normal ml-1.5 text-xs">({orders!.length})</span>}
          </h2>
        </div>
        <Link
          href="/owner/orders"
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          Manage <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {empty ? (
        <div className="flex-1 flex items-center justify-center py-10">
          <p className="text-sm text-muted-foreground italic">{t('analytics.orders.no_active')}</p>
        </div>
      ) : (
        <>
          {/* Summary tally */}
          <div className="grid grid-cols-3 divide-x divide-border/40 border-b border-border/50">
            {[
              { label: t('analytics.orders.card.active'),  count: counts!['on-track'], color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50/60 dark:bg-emerald-900/10' },
              { label: t('analytics.orders.card.at_risk'),   count: counts!['at-risk'],  color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50/60 dark:bg-amber-900/10'   },
              { label: t('analytics.orders.card.critical'), count: counts!['critical'], color: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50/60 dark:bg-red-900/10'       },
            ].map(({ label, count, color, bg }) => (
              <div key={label} className={`flex flex-col items-center py-3 ${bg}`}>
                <span className={`text-xl font-bold tabular-nums ${color}`}>{count}</span>
                <span className="text-[10px] text-muted-foreground font-medium mt-0.5 uppercase tracking-wider">{label}</span>
              </div>
            ))}
          </div>

          {/* Per-order rows */}
          <div className="px-5 py-1 overflow-auto max-h-52">
            {orders!.map((o, i) => <OrderRow key={o.id} order={o} index={i} />)}
          </div>
        </>
      )}
    </motion.section>
  )
}
