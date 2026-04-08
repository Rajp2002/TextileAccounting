'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, BarChart2 } from 'lucide-react'
import { formatMeters } from '@/lib/format'
import { useTranslation } from '@/lib/i18n/context'

export type DailyMeterPoint = {
  date: string       // 'YYYY-MM-DD'
  total_meters: number
}

function shortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })
}

export function ProductionTrend({ data }: { data: DailyMeterPoint[] | null }) {
  const { t } = useTranslation()

  if (!data || data.length === 0) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="bg-card rounded-2xl border border-border shadow-sm p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t('trend.title')}</h2>
        </div>
        <p className="text-sm text-muted-foreground italic text-center py-6">
          {t('trend.no_data')}
        </p>
      </motion.section>
    )
  }

  const values  = data.map(d => d.total_meters)
  const maxVal  = Math.max(...values, 1)
  const avg     = values.reduce((s, v) => s + v, 0) / values.length

  const last    = values[values.length - 1] ?? 0
  const prev    = values[values.length - 2] ?? 0
  const delta   = prev === 0 ? 0 : ((last - prev) / prev) * 100

  const TrendIcon = delta > 3 ? TrendingUp : delta < -3 ? TrendingDown : Minus
  const trendColor = delta > 3 ? 'text-emerald-600 dark:text-emerald-400' : delta < -3 ? 'text-red-500' : 'text-muted-foreground'
  const trendLabel = Math.abs(delta) < 1
    ? t('trend.steady')
    : `${delta > 0 ? '+' : ''}${delta.toFixed(0)}% ${t('trend.vs_yesterday')}`

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t('trend.title')}</h2>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-semibold ${trendColor}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          {trendLabel}
        </div>
      </div>

      <div className="px-5 pb-5 pt-5">
        {/* Bar chart */}
        <div className="flex items-end gap-1 h-20">
          {data.map((point, i) => {
            const heightPct = maxVal === 0 ? 0 : (point.total_meters / maxVal) * 100
            const isLast    = i === data.length - 1

            return (
              <div key={point.date} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                  <div className="bg-popover border border-border text-popover-foreground text-[11px] font-medium rounded-lg px-2 py-1 shadow-md whitespace-nowrap">
                    {formatMeters(point.total_meters)}
                  </div>
                  <div className="w-1.5 h-1.5 bg-popover border-r border-b border-border rotate-45 -mt-1" />
                </div>

                {/* Bar */}
                <motion.div
                  className={`w-full rounded-sm transition-colors ${
                    isLast
                      ? 'bg-primary'
                      : point.total_meters === 0
                      ? 'bg-border/60'
                      : 'bg-primary/20 group-hover:bg-primary/40'
                  }`}
                  style={{ height: `${Math.max(heightPct, point.total_meters === 0 ? 3 : 6)}%` }}
                  initial={{ scaleY: 0, originY: 1 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.45, delay: i * 0.04, ease: 'easeOut' }}
                />
              </div>
            )
          })}
        </div>

        {/* X-axis labels */}
        <div className="flex gap-1 mt-2">
          {data.map((point, i) => (
            <div key={point.date} className="flex-1 text-center">
              <span className={`text-[10px] font-medium ${
                i === data.length - 1 ? 'text-primary' : 'text-muted-foreground/50'
              }`}>
                {shortDate(point.date)}
              </span>
            </div>
          ))}
        </div>

        {/* Avg line */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/40">
          <span className="inline-block h-px w-5 border-t border-dashed border-muted-foreground/40" />
          <span className="text-xs text-muted-foreground">
            {t('trend.avg_7_day')} <span className="font-semibold text-foreground">{formatMeters(avg)}</span>
          </span>
        </div>
      </div>
    </motion.section>
  )
}
