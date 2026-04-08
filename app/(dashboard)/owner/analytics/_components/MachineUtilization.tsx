'use client'

import { motion } from 'framer-motion'
import { Server } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

type Machine = { id: string; name: string; current_order_id: string | null }

export function MachineUtilization({ machines }: { machines: Machine[] | null }) {
  const { t } = useTranslation()
  if (!machines) return null

  const total  = machines.length
  const active = machines.filter(m => m.current_order_id !== null).length
  const idle   = total - active
  const pct    = total === 0 ? 0 : Math.round((active / total) * 100)

  const barColor =
    pct >= 75 ? 'bg-emerald-500' :
    pct >= 40 ? 'bg-amber-500' :
    total === 0 ? 'bg-muted-foreground/20' : 'bg-red-500'

  const pctColor =
    pct >= 75 ? 'text-emerald-600 dark:text-emerald-400' :
    pct >= 40 ? 'text-amber-600 dark:text-amber-400' :
    total === 0 ? 'text-muted-foreground' : 'text-red-600 dark:text-red-400'

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.06 }}
      className="bg-card rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t('machines_util.title')}</h2>
        </div>
        <span className={`text-sm font-bold tabular-nums ${pctColor}`}>
          {pct}%
        </span>
      </div>

      <div className="px-5 py-5 flex-1 flex flex-col gap-5">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground italic">{t('machines_util.no_configured')}</p>
        ) : (
          <>
            {/* Progress bar */}
            <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${barColor}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>

            {/* Counts */}
            <div className="flex items-center gap-5 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="font-semibold text-foreground">{active}</span>
                <span className="text-muted-foreground text-xs">{t('machines_util.active')}</span>
              </div>
              <span className="text-border text-xs">·</span>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-border shrink-0" />
                <span className="font-semibold text-foreground">{idle}</span>
                <span className="text-muted-foreground text-xs">{t('machines_util.idle')}</span>
              </div>
              <span className="text-border text-xs">·</span>
              <span className="text-muted-foreground text-xs">{total} {t('machines_util.total')}</span>
            </div>

            {/* Machine pills — only if ≤ 12 */}
            {total <= 12 && (
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/40">
                {machines.map(m => (
                  <span
                    key={m.id}
                    className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ${
                      m.current_order_id
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${m.current_order_id ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                    {m.name}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </motion.section>
  )
}
