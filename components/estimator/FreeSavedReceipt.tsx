'use client'

import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { freeText } from '@/lib/i18n/free-tier'
import type { FreeReceiptQuota } from '@/lib/free-transaction'

/**
 * Server-confirmed save of the current inputs. The confirmation time is this
 * server's saved-at time (older responses use this device's receipt time). The
 * receipt's own balance belongs to its accounting period, so the current
 * balance stays with the usage card.
 */
export function FreeSavedReceipt({ label, confirmedAt, quota, costingsUsed = 1 }: { label: string; confirmedAt: string; quota: FreeReceiptQuota; costingsUsed?: number }) {
  const { language } = useTranslation()
  const time = new Intl.DateTimeFormat(`${language}-IN`, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(confirmedAt))
  return (
    <section role="status" data-testid="free-saved-receipt" className="rounded-xl border border-wv-status-success-border bg-wv-status-success-bg p-4 text-sm text-wv-status-success-fg">
      <div className="flex items-start gap-2.5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <h2 className="font-semibold break-words">{freeText(language, 'savedReceipt', { label })}</h2>
          <p className="text-xs">{freeText(language, 'confirmedAt', { time })} · {freeText(language, costingsUsed === 0 ? 'recalculatedNoCharge' : quota.replayed ? 'replayNoCharge' : 'costingUsed')}</p>
          <Link href="/free/costings" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2">
            {freeText(language, 'savedCostings')}
          </Link>
        </div>
      </div>
    </section>
  )
}
