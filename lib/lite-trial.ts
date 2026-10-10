/**
 * Lite trial length. Client-importable: keep this file free of server-only and
 * heavy imports so trial copy and countdowns can render in the browser.
 */
export const LITE_TRIAL_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Whole days left until `endsAt`, rounded up, never below zero. An invalid
 * timestamp reads as no time left rather than NaN.
 */
export function trialDaysLeft(endsAt: string, nowMs = Date.now()): number {
  const endMs = new Date(endsAt).getTime()
  if (!Number.isFinite(endMs)) return 0
  const remainingMs = endMs - nowMs
  if (remainingMs <= 0) return 0
  return Math.ceil(remainingMs / DAY_MS)
}
