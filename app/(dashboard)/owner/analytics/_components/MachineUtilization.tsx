'use client'

import { motion } from 'framer-motion'
import { Server, Zap } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

type Machine = { id: string; name: string; current_order_id: string | null }

export function MachineUtilization({ machines }: { machines: Machine[] | null }) {
  const { t } = useTranslation()
  if (!machines) return null

  const total  = machines.length
  const active = machines.filter(m => m.current_order_id !== null).length
  const idle   = total - active
  const pct    = total === 0 ? 0 : Math.round((active / total) * 100)

  // Colour thresholds: ≥75% green, ≥40% amber, else red
  const barColor =
    pct >= 75 ? 'bg-success' :
    pct >= 40 ? 'bg-warning' :
    total === 0 ? 'bg-muted' : 'bg-danger'

  const labelColor =
    pct >= 75 ? 'text-success' :
    pct >= 40 ? 'text-warning' :
    total === 0 ? 'text-muted-foreground' : 'text-danger'

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      className="rounded-2xl border border-border bg-card shadow-sm p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          {t('machines_util.title')}
        </h2>
        <div className={`flex items-center gap-1.5 text-sm font-bold tabular-nums ${labelColor}`}>
          <Zap className="h-3.5 w-3.5" />
          {pct}%
        </div>
      </div>

      {/* Big progress bar */}
      {total === 0 ? (
        <p className="text-sm text-muted-foreground italic">{t('machines_util.no_configured')}</p>
      ) : (
        <>
          <div className="h-3 w-full bg-muted rounded-full overflow-hidden mb-4">
            <motion.div
              className={`h-full rounded-full ${barColor}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          </div>

          {/* Active / Idle chips */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-success" />
              <span className="text-sm font-semibold text-foreground">{active}</span>
              <span className="text-xs text-muted-foreground">{t('machines_util.active')}</span>
            </div>
            <span className="text-border">·</span>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" />
              <span className="text-sm font-semibold text-foreground">{idle}</span>
              <span className="text-xs text-muted-foreground">{t('machines_util.idle')}</span>
            </div>
            <span className="text-border">·</span>
            <span className="text-xs text-muted-foreground">{total} {t('machines_util.total')}</span>
          </div>

          {/* Individual machine pills — only shows if ≤ 12 machines */}
          {total <= 12 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/60">
              {machines.map(m => (
                <span
                  key={m.id}
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                    m.current_order_id
                      ? 'bg-success/10 text-success border border-success/20'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${m.current_order_id ? 'bg-success' : 'bg-muted-foreground/40'}`} />
                  {m.name}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </motion.section>
  )
}
