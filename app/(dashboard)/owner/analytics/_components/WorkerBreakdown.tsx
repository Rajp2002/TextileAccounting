'use client'

import { useState } from 'react'
import { WorkerBreakdownEntry } from '../../actions/dashboard'
import { formatMeters, formatRupees, formatDate } from '@/lib/format'
import { transliterate } from '@/lib/transliterate'
import { ChevronRight, ChevronDown, Lock, Users } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { motion, AnimatePresence } from 'framer-motion'
import { getSuratTodayString } from '@/lib/time'

type WorkerBreakdownLogEntry = WorkerBreakdownEntry['entries'][number]

export function WorkerBreakdown({ entries, selectedDate }: { entries: WorkerBreakdownEntry[] | null, selectedDate?: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const { language, t } = useTranslation()
  const isHistorical = Boolean(selectedDate && selectedDate !== getSuratTodayString())
  const sectionTitle = isHistorical ? `Workers · ${formatDate(selectedDate!)}` : t('worker.title')
  const emptyMessage = isHistorical ? 'No production logged on selected date' : t('worker.no_logs')

  if (!entries || entries.length === 0) {
    return (
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{sectionTitle}</h2>
        </div>
        <div className="bg-card border border-border rounded-2xl shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground italic">{emptyMessage}</p>
        </div>
      </section>
    )
  }

  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">{sectionTitle}</h2>
        <span className="text-xs text-muted-foreground">({entries.length})</span>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2.5 border-b border-border/50 bg-muted/30">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">Worker</span>
          <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60 text-right w-20">Output</span>
          <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60 text-right w-24">Wages</span>
        </div>

        {entries.map((w, index) => {
          const isExpanded = expanded.has(w.worker_id)

          return (
            <div key={w.worker_id} className={index > 0 ? 'border-t border-border/40' : ''}>
              {/* Worker row */}
              <button
                className="w-full grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3.5 items-center cursor-pointer hover:bg-muted/20 transition-colors text-left"
                onClick={() => toggle(w.worker_id)}
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-muted-foreground shrink-0 transition-transform">
                    {isExpanded
                      ? <ChevronDown size={15} className="text-primary" />
                      : <ChevronRight size={15} />
                    }
                  </span>
                  <span className="text-sm font-medium text-foreground truncate">
                    {transliterate(w.worker_name, language)}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground tabular-nums text-right w-20">
                  {formatMeters(w.total_meters) ?? '—'}
                </span>
                <span className="text-sm font-semibold text-foreground tabular-nums text-right w-24">
                  {formatRupees(w.total_wages) ?? '—'}
                </span>
              </button>

              {/* Expanded detail */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="mx-4 mb-3 rounded-xl border border-border/60 overflow-hidden bg-muted/10">
                      {/* Sub-header */}
                      <div className="grid grid-cols-4 gap-3 px-4 py-2 bg-muted/30 border-b border-border/40">
                        {['Loom', 'Metres Produced', 'Rate', 'Earnings'].map(h => (
                          <span key={h} className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/50 last:text-right">{h}</span>
                        ))}
                      </div>
                      {w.entries.map((entry: WorkerBreakdownLogEntry, idx: number) => {
                        const logDateFormatted = formatDate(entry.logged_at)
                        return (
                          <div
                            key={idx}
                            className={`grid grid-cols-4 gap-3 px-4 py-3 items-center text-sm ${idx > 0 ? 'border-t border-border/30' : ''}`}
                          >
                            <div className="font-medium text-foreground truncate">
                              {entry.machine_name}
                              <span className="text-muted-foreground font-normal ml-1 text-xs capitalize">({entry.shift})</span>
                            </div>
                            <div className="text-right text-muted-foreground tabular-nums">
                              {formatMeters(entry.meters) ?? '—'}
                            </div>
                            <div className="flex items-center justify-end gap-1 text-muted-foreground tabular-nums group relative cursor-help">
                              {formatRupees(entry.rate) ?? '—'}/m
                              <Lock size={10} className="text-amber-500 ml-0.5 shrink-0" />
                              <div className="absolute bottom-full mb-2 right-0 hidden group-hover:block w-48 p-2 bg-popover text-popover-foreground text-xs rounded-xl border shadow-md z-10">
                                {t('worker.rate_locked_on').replace('{date}', logDateFormatted)}
                              </div>
                            </div>
                            <div className="text-right font-semibold text-foreground tabular-nums">
                              {formatRupees(entry.wages) ?? '—'}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </section>
  )
}
