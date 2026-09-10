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
          className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-sm text-amber-950 shadow-xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-semibold text-amber-950">{t('temporary')}</h3>
              <p className="text-xs text-amber-900 leading-relaxed">{t('retryNote')}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => void onSubmit?.(false)}
                  className="h-8 text-xs bg-amber-800 hover:bg-amber-900 text-white font-medium"
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
                    className="h-8 text-xs border-amber-300 bg-white hover:bg-amber-100/50 text-amber-900 font-medium"
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
          className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-sm text-amber-950 shadow-xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-semibold text-amber-950">{t('warning')}</h3>
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => void onSubmit?.(true)}
                  className="h-8 text-xs bg-amber-800 hover:bg-amber-900 text-white font-medium"
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
          className="rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-sm text-rose-950 shadow-xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="font-medium text-rose-900">{t(freeErrorText(error))}</p>
              <div className="mt-2 flex items-center gap-3">
                {error === 'FREE_QUOTA_EXHAUSTED' ? (
                  <Link
                    href="/plans?from=estimator"
                    className="text-xs font-semibold text-rose-900 hover:underline underline-offset-2"
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
                      className="h-7 text-xs border-rose-300 bg-white hover:bg-rose-100/50 text-rose-900"
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
