import { formatRupees, formatPct, formatMeters } from '@/lib/format'
import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'

type YieldAlertBannerProps = {
  alert: {
    efficiency_pct: number
    loss_rupees: number
    batch_count: number
    expected_meters: number
    actual_meters: number
  }
}

export function YieldAlertBanner({ alert }: YieldAlertBannerProps) {
  const leakage_meters = alert.expected_meters - alert.actual_meters

  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 px-5 py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
            {formatRupees(alert.loss_rupees)} in estimated losses across {alert.batch_count} batch{alert.batch_count > 1 ? 'es' : ''}
          </p>
          <p className="text-xs text-red-600/70 dark:text-red-400/60 mt-1">
            Average yield is {formatPct(alert.efficiency_pct)} — {formatMeters(leakage_meters)} of yarn is producing nothing.
          </p>
        </div>
      </div>
      <Link
        href="/feature-archived"
        className="flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-700 transition-colors shrink-0 mt-0.5"
      >
        View <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}
