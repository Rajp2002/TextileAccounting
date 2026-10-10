'use client'

import { useCallback, useId, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'
import { liteTrialText } from '@/lib/i18n/lite-trial'
import { cn } from '@/lib/utils'

/** Client-side key for this organization's dismissal of the trial-ended notice. */
export function trialEndedDismissKey(orgId: string) {
  return `weavly:lite-trial-ended:${orgId}`
}

/**
 * Storage access can throw (blocked site data, some private windows), so the
 * window and storage are both read inside a guard. A missing storage is treated
 * the same as a throwing one.
 */
function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/**
 * Whether this lapse of this organization's trial was dismissed on this device.
 * The stored value is the lapse instant, so a dismissal never carries over to a
 * different trial. Any storage failure reads as not dismissed.
 */
export function readTrialEndedDismissal(orgId: string, endedAt: string): boolean {
  try {
    return getStorage()?.getItem(trialEndedDismissKey(orgId)) === endedAt
  } catch {
    return false
  }
}

/** Remember the dismissal for this device. A failed write only means the notice may return next visit. */
export function writeTrialEndedDismissal(orgId: string, endedAt: string): void {
  try {
    getStorage()?.setItem(trialEndedDismissKey(orgId), endedAt)
  } catch {
    // Storage is unavailable; the notice is still hidden for this visit.
  }
}

function subscribeToStorage(onChange: () => void) {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}

// The server cannot know this device's dismissal, so the notice renders until a
// client reads storage. The first client render then agrees with the server.
const notDismissedOnServer = () => false

/**
 * One-time notice on the Free workspace after an in-force Lite trial lapsed.
 * It is in-app only, and dismissing it stores the dismissal on this device.
 */
export function TrialEndedNotice({ orgId, endedAt }: { orgId: string; endedAt: string }) {
  const { language } = useTranslation()
  const titleId = useId()
  const [dismissedNow, setDismissedNow] = useState(false)
  const readDismissed = useCallback(() => readTrialEndedDismissal(orgId, endedAt), [orgId, endedAt])
  const dismissedBefore = useSyncExternalStore(subscribeToStorage, readDismissed, notDismissedOnServer)

  if (dismissedNow || dismissedBefore) return null

  const dismiss = () => {
    writeTrialEndedDismissal(orgId, endedAt)
    setDismissedNow(true)
  }

  return (
    <section
      role="status"
      aria-labelledby={titleId}
      className={cn(
        'mb-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5',
        'border-wv-status-warning-border bg-wv-status-warning-bg text-wv-status-warning-fg',
      )}
    >
      <div className="min-w-0">
        <h2 id={titleId} className="text-sm font-bold text-ink">
          {liteTrialText(language, 'trialEndedTitle')}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-body">
          {liteTrialText(language, 'trialEndedBody')}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        <Button asChild className="min-h-[44px]">
          <Link href="/free/billing">{liteTrialText(language, 'trialSubscribe')}</Link>
        </Button>
        <Button type="button" variant="outline" className="min-h-[44px]" onClick={dismiss}>
          {liteTrialText(language, 'trialDismiss')}
        </Button>
      </div>
    </section>
  )
}
