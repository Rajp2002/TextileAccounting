'use client'

import Link from 'next/link'
import { Clock3 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { liteTrialText } from '@/lib/i18n/lite-trial'
import { trialDaysLeft } from '@/lib/lite-trial'
import { cn } from '@/lib/utils'

/** The trial is emphasised once this many days or fewer remain. */
const EMPHASISED_DAYS_LEFT = 7

/**
 * Owner shell notice for an in-force Lite trial: the days left and a route to
 * subscribe. Calm while the trial is young, and emphasised in its last week.
 */
export function TrialBanner({ endsAt }: { endsAt: string }) {
  const { language } = useTranslation()
  const days = trialDaysLeft(endsAt)
  const emphasised = days <= EMPHASISED_DAYS_LEFT
  const message = days === 0
    ? liteTrialText(language, 'trialBannerLastDay')
    : liteTrialText(language, 'trialBannerDays', { days })

  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border px-4 py-3 text-sm',
        emphasised
          ? 'border-wv-status-warning-border bg-wv-status-warning-bg text-wv-status-warning-fg'
          : 'border-hairline bg-surface text-body',
      )}
    >
      <p className="flex min-w-0 items-center gap-2 font-semibold">
        <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 break-words">{message}</span>
      </p>
      <Link
        href="/owner/billing"
        className="inline-flex min-h-[44px] items-center font-semibold text-ink underline underline-offset-4 hover:text-ink"
      >
        {liteTrialText(language, 'trialSubscribe')}
      </Link>
    </div>
  )
}
