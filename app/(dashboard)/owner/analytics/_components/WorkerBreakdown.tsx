'use client'

import { useState } from 'react'
import { WorkerBreakdownEntry } from '../../actions/dashboard'
import { formatMeters, formatRupees, formatDate } from '@/lib/format'
import { transliterate } from '@/lib/transliterate'
import { ChevronRight, ChevronDown, Lock } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

// Removes the old mock hook

export function WorkerBreakdown({ entries }: { entries: WorkerBreakdownEntry[] | null }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const { language, t } = useTranslation() 

  if (!entries || entries.length === 0) {
    return (
      <section>
        <h2 className="text-xl font-bold mb-4 text-foreground/80 font-heading">{t('worker.title')}</h2>
        <div className="bg-card border border-border shadow-sm rounded-xl p-8 text-center bg-muted/5">
          <p className="text-muted-foreground/60 font-medium italic">{t('worker.no_logs')}</p>
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
      <h2 className="text-xl font-bold mb-4">{t('worker.title')}</h2>
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
        {entries.map((w, index) => {
          const isExpanded = expanded.has(w.worker_id)
          return (
            <div key={w.worker_id} className={`flex flex-col ${index > 0 ? 'border-t border-border' : ''}`}>
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggle(w.worker_id)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0 w-5">
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </span>
                  <span className="font-semibold text-foreground">
                    {transliterate(w.worker_name, language)}
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-muted-foreground w-20 text-right">
                    {formatMeters(w.total_meters) ?? '—'}
                  </span>
                  <span className="font-semibold text-foreground w-24 text-right">
                    {formatRupees(w.total_wages) ?? '—'}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="bg-muted/10 p-4 pt-0">
                  <div className="rounded border border-border bg-card overflow-hidden text-sm">
                    {w.entries.map((entry: any, idx: number) => {
                      const logDateFormatted = formatDate(entry.logged_at)
                      return (
                        <div key={idx} className={`grid grid-cols-4 gap-4 p-3 items-center ${idx > 0 ? 'border-t border-border' : ''}`}>
                          <div className="font-medium text-foreground">
                            {entry.machine_name} <span className="text-muted-foreground font-normal ml-1 capitalize text-xs">({entry.shift})</span>
                          </div>
                          <div className="text-right text-muted-foreground">
                            {formatMeters(entry.meters) ?? '—'}
                          </div>
                          <div className="flex items-center justify-end gap-1 text-muted-foreground group relative cursor-help">
                            {formatRupees(entry.rate) ?? '—'}/m
                            <Lock size={12} className="text-warning ml-1 shrink-0" />
                            {/* Tooltip implementation */}
                            <div className="absolute bottom-full mb-2 right-0 hidden group-hover:block w-48 p-2 bg-popover text-popover-foreground text-xs rounded border shadow-md z-10">
                              {t('worker.rate_locked_on').replace('{date}', logDateFormatted)}
                            </div>
                          </div>
                          <div className="text-right font-medium text-foreground">
                            {formatRupees(entry.wages) ?? '—'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
