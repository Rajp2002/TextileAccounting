'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Factory,
  Gauge,
  IndianRupee,
  PackageCheck,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from 'lucide-react'
import { getOwnerAnalytics } from '../../actions/analytics'
import type { AnalyticsPeriod, OwnerAnalyticsData } from '@/lib/owner-analytics'
import { cn } from '@/lib/utils'

const PERIODS: Array<{ value: AnalyticsPeriod; label: string }> = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
]

const numberFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const rupeeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

function formatMeters(value: number) {
  return `${numberFormatter.format(Math.round(value))} m`
}

function formatRupees(value: number) {
  return rupeeFormatter.format(Math.round(value))
}

function formatDate(date: string, options?: Intl.DateTimeFormatOptions) {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-IN', options ?? { day: 'numeric', month: 'short' }).format(
    new Date(year, month - 1, day)
  )
}

function ChangeBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs font-medium text-body">No prior-period baseline</span>
  const improved = value >= 0
  const Icon = improved ? TrendingUp : TrendingDown

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-bold', improved ? 'text-success' : 'text-risk')}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(value).toFixed(0)}% {improved ? 'up' : 'down'}
    </span>
  )
}

function MetricCard({
  label,
  value,
  detail,
  change,
  icon: Icon,
}: {
  label: string
  value: string
  detail: string
  change?: number | null
  icon: typeof Factory
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-body">{label}</p>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-saffron-soft text-saffron-deep">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-ink">{value}</p>
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1">
        {change !== undefined && <ChangeBadge value={change} />}
        <span className="text-xs text-body">{detail}</span>
      </div>
    </section>
  )
}

function InsightLink({
  href,
  tone,
  title,
  detail,
}: {
  href: string
  tone: 'risk' | 'warning' | 'neutral'
  title: string
  detail: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-colors',
        tone === 'risk' && 'border-risk/25 bg-risk-soft hover:border-risk/40',
        tone === 'warning' && 'border-warning/25 bg-warning-soft hover:border-warning/40',
        tone === 'neutral' && 'border-border bg-surface-soft hover:border-saffron/30'
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">{title}</p>
        <p className="mt-0.5 text-xs text-body">{detail}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-body transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

function bucketTrend(data: OwnerAnalyticsData['productionTrend']) {
  const bucketSize = Math.max(1, Math.ceil(data.length / 15))
  const buckets: Array<{ start: string; end: string; meters: number }> = []

  for (let index = 0; index < data.length; index += bucketSize) {
    const rows = data.slice(index, index + bucketSize)
    buckets.push({
      start: rows[0].date,
      end: rows[rows.length - 1].date,
      meters: rows.reduce((sum, row) => sum + row.meters, 0),
    })
  }

  return buckets
}

function ProductionChart({ data }: { data: OwnerAnalyticsData }) {
  const buckets = bucketTrend(data.productionTrend)
  const maximum = Math.max(...buckets.map((bucket) => bucket.meters), 1)
  const average = data.summary.meters / Math.max(data.productionTrend.length, 1)

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-bold text-ink">Production performance</h2>
          <p className="mt-0.5 text-xs text-body">Output across the selected period</p>
        </div>
        <p className="text-sm font-semibold text-ink">Daily average: {formatMeters(average)}</p>
      </div>
      <div className="px-4 pb-5 pt-8 sm:px-5">
        <div className="flex h-44 items-end gap-1.5 border-b border-border sm:gap-2">
          {buckets.map((bucket) => {
            const height = bucket.meters === 0 ? 2 : Math.max(5, (bucket.meters / maximum) * 100)
            const label = bucket.start === bucket.end
              ? formatDate(bucket.start, { day: 'numeric', month: 'short' })
              : `${formatDate(bucket.start, { day: 'numeric', month: 'short' })}–${formatDate(bucket.end, { day: 'numeric', month: 'short' })}`
            return (
              <div key={bucket.start} className="group relative flex h-full min-w-0 flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-saffron/65 transition-colors group-hover:bg-saffron"
                  style={{ height: `${height}%` }}
                  aria-label={`${label}: ${formatMeters(bucket.meters)}`}
                />
                <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10px] font-semibold text-white group-hover:block">
                  {formatMeters(bucket.meters)}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-body">
          <span>{formatDate(data.periodStart)}</span>
          <span>{formatDate(data.periodEnd)}</span>
        </div>
      </div>
    </section>
  )
}

function LoomPerformance({ data }: { data: OwnerAnalyticsData }) {
  const rows = data.loomPerformance.slice(0, 6)

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-bold text-ink">Loom output</h2>
        <p className="mt-0.5 text-xs text-body">
          {data.producingLooms} of {data.totalLooms} active looms recorded production
        </p>
      </div>
      <div className="space-y-4 p-5">
        {rows.length === 0 && <p className="py-6 text-center text-sm text-body">No loom production in this period.</p>}
        {rows.map((row, index) => (
          <div key={row.machineId}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-semibold text-ink">{index + 1}. {row.name}</span>
              <span className="shrink-0 font-bold text-ink">{formatMeters(row.meters)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-soft">
              <div className="h-full rounded-full bg-saffron" style={{ width: `${Math.max(row.sharePct, 2)}%` }} />
            </div>
            <p className="mt-1 text-right text-[11px] text-body">{row.sharePct.toFixed(0)}% of output</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function QualityPerformance({ data }: { data: OwnerAnalyticsData }) {
  const rows = data.qualityPerformance.slice(0, 6)

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-bold text-ink">Quality profitability</h2>
          <p className="mt-0.5 text-xs text-body">Realised sales ranked by value</p>
        </div>
        <Link href="/owner/commercials" className="text-xs font-bold text-saffron-deep hover:underline">Party Ledger</Link>
      </div>
      {rows.length === 0 ? (
        <p className="p-8 text-center text-sm text-body">No realised sales in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] text-sm">
            <thead className="bg-surface-soft text-left text-[11px] uppercase tracking-wide text-body">
              <tr>
                <th className="px-5 py-3 font-bold">Quality</th>
                <th className="px-3 py-3 text-right font-bold">Sales</th>
                <th className="px-3 py-3 text-right font-bold">Gross profit</th>
                <th className="px-5 py-3 text-right font-bold">Margin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.quality} className="border-t border-border">
                  <td className="max-w-56 truncate px-5 py-3.5 font-semibold text-ink">{row.quality}</td>
                  <td className="px-3 py-3.5 text-right text-ink">{formatRupees(row.revenue)}</td>
                  <td className={cn('px-3 py-3.5 text-right font-semibold', row.grossProfit < 0 ? 'text-risk' : 'text-success')}>
                    {formatRupees(row.grossProfit)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-ink">
                    {row.marginPct === null ? '—' : `${row.marginPct.toFixed(1)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function CashPosition({ data }: { data: OwnerAnalyticsData }) {
  const rows = data.receivableParties.slice(0, 6)

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-bold text-ink">Cash to collect</h2>
          <p className="mt-0.5 text-xs text-body">Current outstanding balances, regardless of selected period</p>
        </div>
        <Link href="/owner/commercials" className="text-xs font-bold text-saffron-deep hover:underline">Collect payments</Link>
      </div>
      <div className="divide-y divide-border">
        {rows.length === 0 && <p className="p-8 text-center text-sm text-body">No outstanding receivables.</p>}
        {rows.map((row) => (
          <div key={row.party} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{row.party}</p>
              <p className={cn('mt-0.5 text-xs', row.overdue > 0 ? 'font-semibold text-risk' : 'text-body')}>
                {row.overdue > 0 ? `${formatRupees(row.overdue)} overdue` : 'Not overdue'}
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold text-ink">{formatRupees(row.outstanding)}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function OwnerAnalyticsClient({ initialData }: { initialData: OwnerAnalyticsData }) {
  const [data, setData] = useState(initialData)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectPeriod = (period: AnalyticsPeriod) => {
    if (period === data.period || isPending) return
    setLoadError(null)
    startTransition(async () => {
      try {
        setData(await getOwnerAnalytics(period))
      } catch (error) {
        console.error('Failed to load owner analytics', error)
        setLoadError('Analytics could not be refreshed. The last confirmed period remains visible.')
      }
    })
  }

  const attentionCount = data.orderHealth.atRisk + data.orderHealth.critical

  return (
    <div className={cn('space-y-6 pb-24 transition-opacity md:pb-0', isPending && 'opacity-70')} aria-busy={isPending}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-saffron/30 bg-saffron/10">
              <BarChart3 className="h-5 w-5 text-saffron-deep" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-ink">Analytics</h1>
              <p className="mt-0.5 text-sm text-body">See what is improving, what is slipping, and where money is held up.</p>
            </div>
          </div>
        </div>
        <div className="flex rounded-xl border border-border bg-card p-1 shadow-sm" aria-label="Analytics period">
          {PERIODS.map((period) => (
            <button
              key={period.value}
              type="button"
              onClick={() => selectPeriod(period.value)}
              disabled={isPending}
              className={cn(
                'min-h-9 rounded-lg px-3 text-xs font-bold transition-colors disabled:cursor-wait',
                data.period === period.value ? 'bg-saffron-deep text-white' : 'text-body hover:bg-surface-soft hover:text-ink'
              )}
            >
              {period.label}
            </button>
          ))}
        </div>
      </header>

      {loadError && <div role="alert" className="rounded-xl border border-risk/30 bg-risk-soft px-4 py-3 text-sm font-medium text-risk">{loadError}</div>}

      <p className="text-xs font-semibold uppercase tracking-wide text-body">
        {formatDate(data.periodStart, { day: 'numeric', month: 'long', year: 'numeric' })} – {formatDate(data.periodEnd, { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Production"
          value={formatMeters(data.summary.meters)}
          detail={`${data.producingLooms} looms produced`}
          change={data.summary.metersChangePct}
          icon={Factory}
        />
        <MetricCard
          label="Realised sales"
          value={formatRupees(data.summary.realizedRevenue)}
          detail="Sold and booked in the ledger"
          change={data.summary.revenueChangePct}
          icon={IndianRupee}
        />
        <MetricCard
          label="Gross profit"
          value={formatRupees(data.summary.grossProfit)}
          detail={data.summary.grossMarginPct === null ? 'No realised margin yet' : `${data.summary.grossMarginPct.toFixed(1)}% booked margin`}
          change={data.summary.profitChangePct}
          icon={Gauge}
        />
        <MetricCard
          label="Outstanding cash"
          value={formatRupees(data.summary.outstanding)}
          detail={`${formatRupees(data.summary.overdue)} overdue`}
          icon={WalletCards}
        />
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <h2 className="font-bold text-ink">Owner attention</h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {data.summary.overdue > 0 ? (
            <InsightLink href="/owner/commercials" tone="risk" title={`${formatRupees(data.summary.overdue)} is overdue`} detail="Prioritise parties with the oldest unpaid balances." />
          ) : (
            <InsightLink href="/owner/commercials" tone="neutral" title="Collections are current" detail="No overdue receivables need attention." />
          )}
          {attentionCount > 0 ? (
            <InsightLink href="/owner/orders" tone={data.orderHealth.critical > 0 ? 'risk' : 'warning'} title={`${attentionCount} orders need attention`} detail={`${data.orderHealth.critical} critical · ${data.orderHealth.atRisk} at risk`} />
          ) : (
            <InsightLink href="/owner/orders" tone="neutral" title="Active orders are on pace" detail={`${data.orderHealth.onTrack} orders currently on track.`} />
          )}
          <InsightLink
            href="/owner/payroll"
            tone="neutral"
            title={`${formatRupees(data.summary.floorWages)} floor wages`}
            detail={data.summary.floorWagesPerMeter === null ? 'No production baseline yet.' : `${formatRupees(data.summary.floorWagesPerMeter)} per produced metre`}
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <ProductionChart data={data} />
        <LoomPerformance data={data} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <QualityPerformance data={data} />
        <CashPosition data={data} />
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-soft px-4 py-3 text-xs text-body">
        <PackageCheck className="h-4 w-4 shrink-0 text-saffron-deep" />
        Sales and gross profit use realised commercial ledger entries. Expected quotations and open estimates are excluded.
      </div>
    </div>
  )
}
