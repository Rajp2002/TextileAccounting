'use client'

import React from 'react'
import Link from 'next/link'
import { AlertTriangle, AlertCircle, Loader2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { freeText, freeErrorText } from '@/lib/i18n/free-tier'
import { Button } from '@/components/ui/button'
import type { FreeTransaction } from '@/lib/free-transaction'

export interface FreeTransactionRecoveryProps {
  transaction: FreeTransaction
  busy?: boolean
  /** The shared validator's messages for the fields the server flagged, already translated. */
  reviewMessages?: string[]
  onConfirm?: () => Promise<void> | void
  onCorrect?: () => void
  onRetry?: () => Promise<void> | void
  onRelease?: () => void
  /** Opens the plan comparison in place; without it, the quota action links to /plans. */
  onViewPlans?: () => void
  className?: string
}

const SAVED_COSTINGS = '/free/costings'
const warningPanel = 'rounded-xl border border-wv-status-warning-border bg-wv-status-warning-bg/90 p-4 text-sm text-wv-status-warning-fg shadow-xs'
const dangerPanel = 'rounded-xl border border-wv-status-danger-border bg-wv-status-danger-bg/90 p-4 text-sm text-wv-status-danger-fg shadow-xs'

/**
 * One card per transaction phase. Review is a known, non-debited answer with
 * two real choices; unknown keeps the original request until the same request
 * answers. Saved history opens in a new tab so these inputs stay on this page.
 */
export function FreeTransactionRecovery({
  transaction,
  busy = false,
  reviewMessages = [],
  onConfirm,
  onCorrect,
  onRetry,
  onRelease,
  onViewPlans,
  className = '',
}: FreeTransactionRecoveryProps) {
  const { language } = useTranslation()
  const t = (key: Parameters<typeof freeText>[1], values: Record<string, string | number> = {}) =>
    freeText(language, key, values)

  const replaying = transaction.phase === 'submitting' && transaction.attempt.possiblyCommitted
  if (transaction.phase === 'editing' || transaction.phase === 'submitting' && !replaying) return null

  const savedLink = (
    <Link
      href={SAVED_COSTINGS}
      target="_blank"
      rel="noopener"
      data-free-recovery-action="saved-costings"
      className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2"
    >
      {t('openSavedCostings')}
    </Link>
  )

  return (
    <div data-testid="free-transaction-recovery" className={`space-y-3 ${className}`} aria-live="polite">
      {transaction.phase === 'review' && (
        <section role="alert" data-testid="free-recovery-warning" className={warningPanel}>
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 space-y-2">
              <h3 className="font-semibold">{t('warning')}</h3>
              {reviewMessages.length > 0 && (
                <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed">
                  {reviewMessages.map(message => <li key={message}>{message}</li>)}
                </ul>
              )}
              <p className="text-xs leading-relaxed">{t('reviewNoCharge')}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" variant="outline" size="lg" disabled={busy} data-free-recovery-action="correct" onClick={() => onCorrect?.()}>
                  {t('correctInputs')}
                </Button>
                <Button type="button" size="lg" disabled={busy} data-free-recovery-action="confirm" onClick={() => void onConfirm?.()}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {t('confirm')}
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {(replaying || transaction.phase === 'unknown' && transaction.retryable) && (
        <section role="status" data-testid="free-recovery-pending" className={warningPanel}>
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 space-y-2">
              <h3 className="font-semibold">{t('temporary')}</h3>
              <p className="text-xs leading-relaxed">{t('retryNote')}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                <Button type="button" size="lg" disabled={busy} data-free-recovery-action="retry" onClick={() => void onRetry?.()}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {busy ? t('retrying') : t('retry')}
                </Button>
                {savedLink}
              </div>
            </div>
          </div>
        </section>
      )}

      {transaction.phase === 'unknown' && !transaction.retryable && (
        <section role="alert" data-testid="free-recovery-blocked" className={warningPanel}>
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 space-y-2">
              <h3 className="font-semibold">{t(transaction.code === 'FREE_PAID_ACTIVE' ? 'paidActiveUnknown' : 'unknownBlocked')}</h3>
              {transaction.code !== 'FREE_PAID_ACTIVE' && <p className="text-xs leading-relaxed">{t(freeErrorText(transaction.code))}</p>}
              <p className="text-xs leading-relaxed">{t('unknownBlockedNote')}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                {savedLink}
                <Button type="button" variant="outline" size="lg" data-free-recovery-action="release" onClick={() => onRelease?.()}>
                  {t('releaseAttempt')}
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {transaction.phase === 'rejected' && (
        <section role="alert" data-testid="free-recovery-error" className={dangerPanel}>
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 space-y-2">
              <p className="font-medium">{t(freeErrorText(transaction.code))}</p>
              {transaction.code === 'FREE_QUOTA_EXHAUSTED' && (onViewPlans
                ? <button type="button" data-free-plan-action="compare" onClick={onViewPlans} className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2">{t('viewPlans')}</button>
                : <Link href="/plans?from=estimator" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2">{t('viewPlans')}</Link>)}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
