import { formatRupees, formatPct, formatMeters } from '@/lib/format'
import Link from 'next/link'

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
    <div className="rounded-lg border border-danger bg-background-danger p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-danger">
            You&apos;re losing money on {alert.batch_count} batch{alert.batch_count > 1 ? 'es' : ''}.
          </p>
          <p className="mt-1 text-2xl font-medium text-danger">
            {formatRupees(alert.loss_rupees) ?? '₹0'} in estimated losses
          </p>
          <p className="mt-1 text-sm text-danger-secondary mt-2">
            Average yield is {formatPct(alert.efficiency_pct)} — that&apos;s {formatMeters(leakage_meters)} of your yarn producing nothing.
          </p>
        </div>
        <Link href="/owner/inventory?filter=leaking" className="shrink-0 text-sm font-medium underline text-danger">
          View batches
        </Link>
      </div>
    </div>
  )
}
