'use client'

import React from 'react'
import Link from 'next/link'
import { AlertTriangle, AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { freeText, freeErrorText } from '@/lib/i18n/free-tier'
import { Button } from '@/components/ui/button'

export interface FreeTransactionRecoveryProps {
  pending?: boolean
  warning?: boolean
  error?: string | null
  busy?: boolean
  onSubmit?: (ack?: boolean) => Promise<void> | void
  onRefresh?: () => Promise<unknown> | void
  className?: string
}

export function FreeTransactionRecovery({
  pending = false,
  warning = false,
  error = null,
  busy = false,
  onSubmit,
  onRefresh,
  className = '',
}: FreeTransactionRecoveryProps) {
  const { language } = useTranslation()
  const t = (key: Parameters<typeof freeText>[1], values: Record<string, string | number> = {}) =>
    freeText(language, key, values)

  // Nothing to recover or warn
  if (!pending && !warning && !error) {
    return null
  }

  return (
    <div
      data-testid="free-transaction-recovery"
      className={`space-y-3 ${className}`}
      aria-live="polite"
    >
      {/* 1. Pending Transaction Recovery (Connection interrupted, uncertain outcome) */}
      {pending && (
        <section
          role="status"
          data-testid="free-recovery-pending"
          className="rounded-xl border border-wv-status-warning-border bg-wv-status-warning-bg/90 p-4 text-sm text-wv-status-warning-fg shadow-xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 shrink-0 text-wv-status-warning-fg mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-semibold text-wv-status-warning-fg">{t('temporary')}</h3>
              <p className="text-xs text-wv-status-warning-fg leading-relaxed">{t('retryNote')}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => void onSubmit?.(false)}
                  className="h-8 text-xs bg-ink hover:bg-body text-wv-text-on-action font-medium"
                >
                  {busy && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                  {t('retry')}
                </Button>
                {onRefresh && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void onRefresh()}
                    className="h-8 text-xs border-wv-border-control bg-surface hover:bg-surface-soft text-ink font-medium"
                  >
                    <RefreshCw className="h-3 w-3 mr-1.5" />
                    {t('refresh')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 2. Review Confirmation Warning */}
      {!pending && warning && (
        <section
          role="alert"
          data-testid="free-recovery-warning"
          className="rounded-xl border border-wv-status-warning-border bg-wv-status-warning-bg/90 p-4 text-sm text-wv-status-warning-fg shadow-xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 shrink-0 text-wv-status-warning-fg mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-semibold text-wv-status-warning-fg">{t('warning')}</h3>
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => void onSubmit?.(true)}
                  className="h-8 text-xs bg-ink hover:bg-body text-wv-text-on-action font-medium"
                >
                  {busy && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                  {t('confirm')}
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. Explicit Error Banner */}
      {!pending && !warning && error && (
        <section
          role="alert"
          data-testid="free-recovery-error"
          className="rounded-xl border border-wv-status-danger-border bg-wv-status-danger-bg/90 p-4 text-sm text-wv-status-danger-fg shadow-xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 text-wv-status-danger-fg mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="font-medium text-wv-status-danger-fg">{t(freeErrorText(error))}</p>
              <div className="mt-2 flex items-center gap-3">
                {error === 'FREE_QUOTA_EXHAUSTED' ? (
                  <Link
                    href="/plans?from=estimator"
                    className="text-xs font-semibold text-wv-status-danger-fg hover:underline underline-offset-2"
                  >
                    {t('viewPlans')}
                  </Link>
                ) : (
                  onRefresh && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void onRefresh()}
                      className="h-7 text-xs border-wv-border-control bg-surface hover:bg-surface-soft text-ink"
                    >
                      <RefreshCw className="h-3 w-3 mr-1.5" />
                      {t('refresh')}
                    </Button>
                  )
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
