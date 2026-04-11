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
        <div className="relative h-28 w-full group/chart">
          {/* SVG Line Overlay */}
          <svg
            className="absolute inset-0 z-10 pointer-events-none overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="line-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.8" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            {/* Area under the line */}
            <motion.path
              d={(() => {
                const pts = data.map((p, i) => {
                  const x = (i / (data.length - 1)) * 100
                  const y = 100 - (maxVal === 0 ? 0 : (p.total_meters / maxVal) * 90) // scale to 90% height
                  return { x, y }
                })
                const pathStr = pts.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '')
                return `${pathStr} L 100 100 L 0 100 Z`
              })()}
              fill="url(#line-gradient)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.15 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            />
            {/* The Line */}
            <motion.path
              d={(() => {
                const pts = data.map((p, i) => {
                  const x = (i / (data.length - 1)) * 100
                  const y = 100 - (maxVal === 0 ? 0 : (p.total_meters / maxVal) * 90)
                  return { x, y }
                })
                return pts.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '')
              })()}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
          </svg>

          {/* HTML Data Points Layer for Perfect Circles */}
          <div className="absolute inset-0 z-20 pointer-events-none">
            {data.map((point, i) => {
              const x = (i / (data.length - 1)) * 100
              const y = 100 - (maxVal === 0 ? 0 : (point.total_meters / maxVal) * 90)
              const isLast = i === data.length - 1
              return (
                <motion.div
                  key={point.date}
                  className={`absolute w-3 h-3 bg-white border-2 border-primary rounded-full flex items-center justify-center -ml-1.5 -mt-1.5 ${
                    isLast ? 'shadow-[0_0_12px_rgba(var(--primary),0.5)] ring-4 ring-primary/20' : ''
                  }`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.05 }}
                />
              )
            })}
          </div>

          {/* Bar chart behind */}
          <div className="absolute inset-0 flex items-end gap-2.5">
            {data.map((point, i) => {
              const heightPct = maxVal === 0 ? 0 : (point.total_meters / maxVal) * 90
              const isLast    = i === data.length - 1

              return (
                <div key={point.date} className="flex-1 flex flex-col items-center gap-0.5 group relative h-full">
                  {/* Slot Background Highlight */}
                  <div className="absolute inset-x-[-2px] bottom-0 top-[-20px] bg-slate-50/50 dark:bg-slate-900/10 opacity-0 group-hover:opacity-100 rounded-lg transition-opacity -z-10" />

                  {/* Value Label */}
                  <div className="absolute bottom-full mb-1 flex flex-col items-center z-20 pointer-events-none">
                    <div className={`text-[9px] font-black whitespace-nowrap bg-background/80 backdrop-blur-[2px] px-1 rounded-md ${
                      isLast ? 'text-primary' : 'text-slate-500'
                    }`}>
                      {point.total_meters > 0 ? formatMeters(point.total_meters) : ''}
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
                          : 'bg-primary/5 group-hover:bg-primary/10'
                      }`}
                      style={{ height: `${Math.max(heightPct, point.total_meters === 0 ? 4 : 8)}%` }}
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
