'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Clock3, X } from 'lucide-react'
import { useTranslation, type Language } from '@/lib/i18n/context'
import { liteTrialText } from '@/lib/i18n/lite-trial'
import { trialDaysLeft } from '@/lib/lite-trial'
import { cn } from '@/lib/utils'

/** The trial is emphasised once this many days or fewer remain. */
const EMPHASISED_DAYS_LEFT = 7

/** How long the nudge stays up after each launch or sign-in. */
export const TRIAL_NUDGE_VISIBLE_MS = 2 * 60 * 1000

/**
 * Per-tab marker: a launch (new tab or PWA window) starts without it, and
 * sign-out clears it (lib/client-storage-cleanup.ts), so each launch or
 * sign-in shows the nudge once. Holds the first-shown time, or "dismissed".
 */
export const TRIAL_NUDGE_STORAGE_KEY = 'weavly_trial_nudge_shown_at'
const DISMISSED = 'dismissed'

/**
 * How much longer the nudge stays up, given the stored marker. No marker means
 * a fresh launch, so the full window; a navigation inside the window resumes
 * with what is left; a dismissal or a lapsed window keeps it hidden.
 */
export function trialNudgeRemainingMs(stored: string | null, nowMs: number): number {
  if (stored === null) return TRIAL_NUDGE_VISIBLE_MS
  if (stored === DISMISSED) return 0
  const shownAt = Number(stored)
  if (!Number.isFinite(shownAt)) return TRIAL_NUDGE_VISIBLE_MS
  return Math.max(0, Math.min(TRIAL_NUDGE_VISIBLE_MS, shownAt + TRIAL_NUDGE_VISIBLE_MS - nowMs))
}

function readMarker() {
  try { return window.sessionStorage.getItem(TRIAL_NUDGE_STORAGE_KEY) } catch { return null }
}

function writeMarker(value: string) {
  try { window.sessionStorage.setItem(TRIAL_NUDGE_STORAGE_KEY, value) } catch {}
}

/**
 * Whole days are rounded up, so the final 24 hours count as one day left. That
 * day gets its own singular copy instead of "1 days left". Zero days (a trial
 * that has run out) keeps the ends-today copy as a defensive fallback.
 */
function countdownMessage(language: Language, days: number) {
  if (days <= 0) return liteTrialText(language, 'trialBannerLastDay')
  if (days === 1) return liteTrialText(language, 'trialBannerOneDay')
  return liteTrialText(language, 'trialBannerDays', { days })
}

/** The nudge card itself: days left, a route to subscribe, and a dismiss. */
export function TrialNudgeCard({ endsAt, onDismiss }: { endsAt: string; onDismiss?: () => void }) {
  const { language } = useTranslation()
  const days = trialDaysLeft(endsAt)
  const emphasised = days <= EMPHASISED_DAYS_LEFT

  return (
    <aside
      role="status"
      data-trial-nudge="true"
      className={cn(
        'trial-nudge fixed inset-x-3 top-[calc(env(safe-area-inset-top,0px)+12px)] z-40 flex items-center gap-3 rounded-xl border py-1.5 pl-4 pr-1.5 text-sm shadow-xs',
        'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 motion-safe:duration-300',
        'sm:left-auto sm:right-6 sm:top-4 sm:max-w-[26rem]',
        emphasised
          ? 'border-wv-status-warning-border bg-wv-status-warning-bg text-wv-status-warning-fg'
          : 'border-hairline bg-surface text-body',
      )}
    >
      <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3">
        <p className="min-w-0 break-words font-semibold">{countdownMessage(language, days)}</p>
        <Link
          href="/owner/billing"
          onClick={onDismiss}
          className="inline-flex min-h-[44px] items-center font-semibold text-ink underline underline-offset-4 hover:text-ink"
        >
          {liteTrialText(language, 'trialSubscribe')}
        </Link>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={liteTrialText(language, 'trialDismiss')}
        className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg hover:bg-surface-soft"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </aside>
  )
}

/**
 * Owner shell nudge for an in-force Lite trial. It floats over the page for
 * two minutes after each launch or sign-in, then gets out of the way; the days
 * left stay on Plan & Billing.
 */
export function TrialNudge({ endsAt }: { endsAt: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = readMarker()
    const remaining = trialNudgeRemainingMs(stored, Date.now())
    if (remaining <= 0) return
    if (stored === null || !Number.isFinite(Number(stored))) writeMarker(String(Date.now()))
    // Both state changes run from timers: the marker lives in sessionStorage,
    // which the server render cannot read, so the nudge only mounts after hydration.
    const show = window.setTimeout(() => setVisible(true), 0)
    const hide = window.setTimeout(() => setVisible(false), remaining)
    return () => {
      window.clearTimeout(show)
      window.clearTimeout(hide)
    }
  }, [])

  const dismiss = useCallback(() => {
    writeMarker(DISMISSED)
    setVisible(false)
  }, [])

  if (!visible) return null
  return <TrialNudgeCard endsAt={endsAt} onDismiss={dismiss} />
}
