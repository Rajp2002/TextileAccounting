import { formatMeters, formatRupees, formatPct, formatDate } from '@/lib/format'
import { getSuratTodayString, getSuratYesterdayString } from '@/lib/time'
import { useTranslation } from '@/lib/i18n/context'
import { Activity, IndianRupee, WalletCards, Zap, Factory } from 'lucide-react'

type KpiStripProps = {
  yesterday: {
    total_meters: number
    piece_rate_wages: number
    fixed_payroll: number
    efficiency_pct: number | null
  } | null
  today: {
    total_meters: number
    piece_rate_wages: number
    active_machines: number
    date: string
  } | null
  isConnected?: boolean
  selectedDate?: string
}

function efficiencyColor(pct: number | null): string {
  if (pct === null) return 'text-muted-foreground'
  if (pct >= 95)    return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 85)    return 'text-amber-500 dark:text-amber-400'
  return 'text-red-500 dark:text-red-400'
}

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  accent?: string
  dimmed?: boolean
  icon?: React.ReactNode
}

function KpiCard({ label, value, sub, accent, dimmed, icon }: KpiCardProps) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-medium text-muted-foreground/70 truncate">
        {icon && <span className="opacity-70">{icon}</span>}
        <span>{label}</span>
      </div>
      <div className={`text-xl font-semibold leading-tight tracking-tight truncate ${accent ?? 'text-foreground'} ${dimmed ? 'opacity-50' : ''}`}>
        {value}
        {sub && <span className="text-sm font-normal text-muted-foreground ml-1">{sub}</span>}
      </div>
    </div>
  )
}

export function KpiStrip({ yesterday, today, isConnected = true, selectedDate }: KpiStripProps) {
  const { t } = useTranslation()
  const yData = yesterday || { total_meters: null, piece_rate_wages: null, fixed_payroll: null, efficiency_pct: null }
  const tData = today || { total_meters: null, piece_rate_wages: null, active_machines: null, date: getSuratTodayString() }
  const isHistorical = selectedDate && selectedDate !== getSuratTodayString()

  const sectionLabel = isHistorical
    ? `${t('kpi_strip.selected_date')} · ${formatDate(selectedDate)}`
    : `${t('kpi_strip.yesterday')} · ${formatDate(getSuratYesterdayString())}`

  return (
    <div className="grid grid-cols-1 gap-3">

      {/* ── Historical / Yesterday row ─────────────────── */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {/* Row header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/50">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {sectionLabel}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 bg-muted px-2 py-0.5 rounded-full">
            {t('kpi_strip.finalized')}
          </span>
        </div>

        {/* KPI columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/40">
          {[
            { label: t('kpi_strip.meters_produced'), value: yData.total_meters !== null ? formatMeters(yData.total_meters) : '—', icon: <Activity className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" /> },
            { label: t('kpi_strip.floor_wages'), value: yData.piece_rate_wages !== null ? formatRupees(yData.piece_rate_wages) : '—', icon: <IndianRupee className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" /> },
            { label: t('kpi_strip.salary_burden'), value: yData.fixed_payroll !== null ? formatRupees(yData.fixed_payroll) : '—', icon: <WalletCards className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" /> },
            {
              label: t('kpi_strip.overall_efficiency'),
              value: yData.efficiency_pct === null ? '—' : formatPct(yData.efficiency_pct),
              accent: efficiencyColor(yData.efficiency_pct as number | null),
              icon: <Zap className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
            },
          ].map(({ label, value, accent, icon }) => (
            <div key={label} className="bg-card px-5 py-4">
              <KpiCard label={label} value={value ?? '—'} accent={accent} icon={icon} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Today (live) row ──────────────────────────── */}
      {!isHistorical && (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          {/* Row header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/50">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {t('kpi_strip.today')} · {formatDate(tData.date)}
            </span>
            {/* Live pill */}
            <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
              isConnected
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                : 'text-muted-foreground bg-muted'
            }`}>
              {isConnected
                ? <><span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>{t('kpi_strip.live')}</>
                : t('kpi_strip.live')
              }
            </span>
          </div>

          {!today ? (
            <div className="px-5 py-6 text-sm text-muted-foreground italic">
              {t('kpi_strip.no_logs_yet')}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border/40">
              {[
                { label: t('kpi_strip.meters_produced'), value: tData.total_meters !== null ? formatMeters(tData.total_meters) : '—', icon: <Activity className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" /> },
                { label: t('kpi_strip.floor_wages'), value: tData.piece_rate_wages !== null ? formatRupees(tData.piece_rate_wages) : '—', sub: t('kpi_strip.est'), icon: <IndianRupee className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" /> },
                { label: t('kpi_strip.machines_running'), value: tData.active_machines !== null ? String(tData.active_machines) : '—', sub: t('kpi_strip.machines'), icon: <Factory className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" /> },
              ].map(({ label, value, sub, icon }) => (
                <div key={label} className="bg-card px-5 py-4">
                  <KpiCard label={label} value={value ?? '—'} sub={sub} icon={icon} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
