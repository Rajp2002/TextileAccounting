'use client'

import React, { useState, useId, useMemo } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { freeText } from '@/lib/i18n/free-tier'
import { Button } from '@/components/ui/button'

export interface FreeUsageCardProps {
  quota?: {
    limit: number
    remaining: number
    resetsAt: string
  } | null
  loading?: boolean
  error?: string | null
  stale?: boolean
  isPending?: boolean
  onRefresh?: () => Promise<unknown> | void
  isDocked?: boolean
  dockStyle?: React.CSSProperties
  className?: string
  initialExpanded?: boolean
}

export function FreeUsageCard({
  quota,
  loading = false,
  error = null,
  stale = false,
  isPending = false,
  onRefresh,
  isDocked = false,
  dockStyle,
  className = '',
  initialExpanded = false,
}: FreeUsageCardProps) {
  const { language } = useTranslation()
  const [expanded, setExpanded] = useState(initialExpanded)
  const detailsId = useId()

  const t = (key: Parameters<typeof freeText>[1], values: Record<string, string | number> = {}) =>
    freeText(language, key, values)

  const limit = quota?.limit ?? 2
  const remaining = quota ? Math.max(0, Math.min(quota.remaining, limit)) : null
  const isExhausted = remaining === 0

  const resetsAt = quota?.resetsAt
  const formattedResetDate = useMemo(() => {
    if (!resetsAt) return ''
    try {
      const date = new Date(resetsAt)
      if (isNaN(date.getTime())) return ''
      return new Intl.DateTimeFormat(`${language}-IN`, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
      }).format(date)
    } catch {
      return ''
    }
  }, [resetsAt, language])

  // Honest loading without quota
  const isInitialLoading = loading && remaining === null

  // Error without prior balance
  const hasFatalError = Boolean(error && remaining === null)

  const containerClasses = [
    'rounded-xl border border-stone-200/90 bg-white/95 backdrop-blur-xs p-3.5 shadow-sm transition-all duration-200 text-stone-900',
    isDocked ? 'pointer-events-auto' : 'w-full max-w-sm',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <aside
      data-testid="free-usage-card"
      data-free-usage-card="true"
      data-docked={isDocked ? 'true' : 'false'}
      className={containerClasses}
      style={isDocked && dockStyle ? dockStyle : undefined}
      aria-label={t('freeCostings')}
    >
      {/* Header Row: Label & Disclosure Toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-stone-800 tracking-wide uppercase">
            {t('freeCostings')}
          </span>
          {isPending && (
            <span
              className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
              title={t('confirmingCosting')}
            >
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              {t('confirmationPending')}
            </span>
          )}
          {stale && !isPending && (
            <span
              className="inline-flex items-center rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600"
              title={t('offlineStale')}
            >
              {t('lastConfirmed')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {onRefresh && (
            <button
              type="button"
              onClick={() => void onRefresh()}
              aria-label={t('refresh')}
              disabled={loading || isPending}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-stone-400 transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            type="button"
            data-testid="free-usage-toggle"
            onClick={() => setExpanded(prev => !prev)}
            aria-expanded={expanded}
            aria-controls={detailsId}
            aria-label={t('toggleDetails')}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-stone-500 hover:text-stone-900 hover:bg-stone-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-stone-400 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Counter & Meter State */}
      {isInitialLoading ? (
        <div className="mt-2 space-y-2" aria-busy="true">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-stone-400 tabular-nums animate-pulse">
              – / –
            </span>
            <span className="text-xs text-stone-400">{t('checkingUsage')}</span>
          </div>
          <div className="flex gap-1.5 h-1.5 w-full">
            <div className="h-full flex-1 rounded-full bg-stone-200 animate-pulse" />
            <div className="h-full flex-1 rounded-full bg-stone-200 animate-pulse" />
          </div>
        </div>
      ) : hasFatalError ? (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-rose-700 font-medium">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{t('usageUnavailable')}</span>
          </div>
          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onRefresh()}
              className="h-7 text-xs px-2.5 mt-1 border-stone-300 text-stone-700"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              {t('refresh')}
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-2">
          <div className="flex items-baseline justify-between gap-1">
            <div className="flex items-baseline gap-1.5" data-testid="free-usage-counter">
              <span className="text-xl font-bold tracking-tight text-stone-900 tabular-nums">
                {remaining} / {limit}
              </span>
              <span className="text-xs font-medium text-stone-600">
                {t('leftThisMonth')}
              </span>
            </div>

            {isExhausted && (
              <span className="inline-flex rounded bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                {t('monthlyLimitReached')}
              </span>
            )}
          </div>

          {/* Two-Segment Meter: Filled segments represent REMAINING costings */}
          <div
            data-testid="free-usage-meter"
            className="flex gap-1.5 h-1.5 w-full my-2"
            role="presentation"
          >
            {Array.from({ length: limit }).map((_, index) => {
              const isFilled = remaining !== null && index < remaining
              return (
                <div
                  key={index}
                  className={`h-full flex-1 rounded-full transition-colors duration-300 ${
                    isFilled ? 'bg-stone-800' : 'bg-stone-200'
                  }`}
                />
              )
            })}
          </div>

          {/* Accessible semantic meter for assistive technology */}
          <meter
            className="sr-only"
            min={0}
            max={limit}
            value={remaining ?? 0}
            aria-label={t('quota', { remaining: remaining ?? 0, limit })}
          />

          {/* Confirmed 0/2 Exhausted State: Clean, calm reset date and view plans link */}
          {isExhausted && (
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-600">
              {formattedResetDate && (
                <span className="truncate">
                  {t('reset', { date: formattedResetDate })}
                </span>
              )}
              <Link
                href="/plans?from=estimator"
                data-testid="free-usage-plans-link"
                className="font-medium text-stone-900 hover:text-stone-700 underline underline-offset-2 shrink-0 ml-2"
              >
                {t('viewPlans')}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Expanded Disclosure Region */}
      {expanded && (
        <div
          id={detailsId}
          data-testid="free-usage-details"
          className="mt-3 pt-2.5 border-t border-stone-200/80 space-y-2 text-xs"
        >
          <div className="font-semibold text-stone-900">
            {t('yourMonthlyAllowance')}
          </div>
          <div className="text-stone-600">
            {t('remainingOfLimit', { remaining: remaining ?? 0, limit })}.
          </div>
          {formattedResetDate && (
            <div className="text-stone-500 text-[11px]">
              {t('reset', { date: formattedResetDate })}
            </div>
          )}
          <p className="text-[11px] leading-relaxed text-stone-500">
            {t('costingConsumptionExplanation')}
          </p>
          <div className="pt-1">
            <Link
              href="/plans?from=estimator"
              className="inline-flex items-center text-xs font-semibold text-stone-900 hover:text-stone-700 hover:underline"
            >
              {t('explorePlansArrow')}
            </Link>
          </div>
        </div>
      )}
    </aside>
  )
}
