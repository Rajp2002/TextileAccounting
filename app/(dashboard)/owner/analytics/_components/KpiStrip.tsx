import { formatMeters, formatRupees, formatPct, formatDate } from '@/lib/format'
import { getSuratTodayString, getSuratYesterdayString } from '@/lib/time'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/lib/i18n/context'

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
  if (pct === null) return 'text-secondary'    // no data yet
  if (pct >= 95)    return 'text-success'       // green
  if (pct >= 85)    return 'text-warning'       // amber
  return 'text-danger'                          // red
}

export function KpiStrip({ yesterday, today, isConnected = true, selectedDate }: KpiStripProps) {
  const { t } = useTranslation()
  // Graceful empty states handling
  const yData = yesterday || { total_meters: null, piece_rate_wages: null, fixed_payroll: null, efficiency_pct: null }
  const tData = today || { total_meters: null, piece_rate_wages: null, active_machines: null, date: getSuratTodayString() }
  
  const isHistorical = selectedDate && selectedDate !== getSuratTodayString()

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Historical OR Yesterday Row */}
      <div className={`flex flex-col space-y-4 p-5 ${!isHistorical ? 'bg-muted/30 border-b border-border' : ''}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-foreground/80">
            {isHistorical ? t('kpi_strip.selected_date') : t('kpi_strip.yesterday')} · {" "}
            {isHistorical 
              ? formatDate(selectedDate)
              : yesterday 
                ? formatDate(getSuratYesterdayString())
                : t('kpi_strip.no_data')}
          </h3>
          <Badge variant="secondary" className="uppercase tracking-wider text-[10px] font-medium">{t('kpi_strip.finalized')}</Badge>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <div className="text-2xl font-semibold">
              {yData.total_meters !== null ? formatMeters(yData.total_meters) : '—'}
            </div>
            <div className="text-sm text-muted-foreground mt-1">{t('kpi_strip.meters_produced')}</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">
              {yData.piece_rate_wages !== null ? formatRupees(yData.piece_rate_wages) : '—'}
            </div>
            <div className="text-sm text-muted-foreground mt-1">{t('kpi_strip.floor_wages_today')}</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">
              {yData.fixed_payroll !== null ? formatRupees(yData.fixed_payroll) : '—'}
            </div>
            <div className="text-sm text-muted-foreground mt-1">{t('kpi_strip.salary_burden_today')}</div>
          </div>
          <div>
            <div className={`text-2xl font-semibold ${efficiencyColor(yData.efficiency_pct)}`}>
              {yData.efficiency_pct === null ? '—' : formatPct(yData.efficiency_pct)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">{t('kpi_strip.overall_efficiency')}</div>
          </div>
        </div>
      </div>

      {/* Today Row (Hidden in Historical View) */}
      {!isHistorical && (
        <div className="flex flex-col space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-foreground/80">
              {t('kpi_strip.today')} · {formatDate(tData.date)}
            </h3>
            <Badge variant="outline" className="uppercase tracking-wider text-[10px] font-medium bg-success/10 text-success border-success/20 flex items-center gap-1.5">
              {t('kpi_strip.live')}
              {isConnected ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                </span>
              ) : (
                <span className="relative flex h-2 w-2 inline-flex rounded-full bg-muted-foreground"></span>
              )}
            </Badge>
          </div>
          {!today ? (
            <div className="text-sm text-muted-foreground">{t('kpi_strip.no_logs_yet')}</div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-semibold text-foreground">{tData.total_meters !== null ? formatMeters(tData.total_meters) : '—'}</div>
                <div className="text-sm text-muted-foreground mt-1">{t('kpi_strip.meters_produced')}</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-foreground">{tData.piece_rate_wages !== null ? formatRupees(tData.piece_rate_wages) : '—'} <span className="text-sm text-muted-foreground font-normal">{t('kpi_strip.est')}</span></div>
                <div className="text-sm text-muted-foreground mt-1">{t('kpi_strip.floor_wages_today')}</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-foreground">{tData.active_machines ?? '—'} <span className="text-sm font-normal text-muted-foreground">{t('kpi_strip.machines')}</span></div>
                <div className="text-sm text-muted-foreground mt-1">{t('kpi_strip.machines_running')}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
