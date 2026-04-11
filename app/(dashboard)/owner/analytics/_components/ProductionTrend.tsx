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

      <div className="px-5 pb-5 pt-8">
        {/* Chart Container */}
        <div className="relative h-32 w-full group/chart pt-2">
          {/* Simple Bar Chart */}
          <div className="absolute inset-0 flex items-end gap-2.5">
            {data.map((point, i) => {
              const chartMax = maxVal === 0 ? 100 : Math.max(maxVal * 1.15, maxVal + 20)
              const heightPct = chartMax === 0 ? 0 : (point.total_meters / chartMax) * 100
              const isLast    = i === data.length - 1

              return (
                <div key={point.date} className="flex-1 flex flex-col items-center gap-0.5 group relative h-full">
                  {/* Slot Background Highlight */}
                  <div className="absolute inset-x-[-2px] inset-y-[-10px] bg-slate-50/50 dark:bg-slate-900/20 opacity-0 group-hover:opacity-100 rounded-lg transition-opacity -z-10" />

                  {/* Value Label */}
                  <div className="absolute bottom-full mb-1.5 flex flex-col items-center z-20 pointer-events-none">
                    <div className={`text-[10px] font-bold whitespace-nowrap px-1.5 py-0.5 rounded-md transition-colors ${
                      isLast ? 'text-primary bg-primary/10' : 'text-slate-500 bg-background/80 backdrop-blur-sm shadow-sm'
                    }`}>
                      {point.total_meters > 0 ? formatMeters(point.total_meters) : '0'}
                    </div>
                  </div>

                  {/* Bar */}
                  <div className="w-full h-full flex flex-col justify-end">
                    <motion.div
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        isLast
                          ? 'bg-primary shadow-lg shadow-primary/20'
                          : point.total_meters === 0
                          ? 'bg-slate-100 dark:bg-slate-800'
                          : 'bg-primary/20 dark:bg-primary/30 hover:bg-primary/30 dark:hover:bg-primary/40'
                      }`}
                      style={{ height: `${Math.max(heightPct, point.total_meters === 0 ? 2 : 4)}%` }}
                      initial={{ scaleY: 0, originY: 1 }}
                      animate={{ scaleY: 1 }}
                      transition={{ duration: 0.45, delay: i * 0.04, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* X-axis labels */}
        <div className="flex gap-2.5 mt-4">
          {data.map((point, i) => (
            <div key={point.date} className="flex-1 text-center">
              <span className={`text-[10px] font-bold tracking-tight ${
                i === data.length - 1 ? 'text-primary' : 'text-slate-400'
              }`}>
                {shortDate(point.date).toUpperCase()}
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
