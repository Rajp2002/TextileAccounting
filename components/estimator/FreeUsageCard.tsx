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
  /** Balance from an earlier read; the latest refresh failed. */
  stale?: boolean
  /** A costing was saved after the last good read, so that balance is out of date. */
  unverified?: boolean
  isPending?: boolean
  onRefresh?: () => Promise<unknown> | void
  /** Opens the plan comparison in place, keeping the mounted estimator; without it, plan actions link to /plans. */
  onViewPlans?: () => void
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
  unverified = false,
  isPending = false,
  onRefresh,
  onViewPlans,
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

  const plansAction = (label: string, className: string, testId?: string) => onViewPlans
    ? <button type="button" data-testid={testId} data-free-plan-action="compare" onClick={onViewPlans} className={className}>{label}</button>
    : <Link href="/plans?from=estimator" data-testid={testId} className={className}>{label}</Link>

  // Error without prior balance, or a balance that predates the latest save
  const hasFatalError = Boolean(error && remaining === null) || unverified

  const containerClasses = [
    'rounded-xl border border-wv-border-default/90 bg-surface/95 backdrop-blur-xs p-3.5 shadow-sm transition-all duration-200 text-ink',
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
          <span className="text-xs font-semibold text-ink tracking-wide uppercase">
            {t('freeCostings')}
          </span>
          {isPending && (
            <span
              className="inline-flex items-center gap-1 rounded bg-wv-status-warning-bg px-1.5 py-0.5 text-[10px] font-medium text-wv-status-warning-fg"
              title={t('confirmingCosting')}
            >
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              {t('confirmationPending')}
            </span>
          )}
          {stale && !isPending && (
            <span
              className="inline-flex items-center rounded bg-surface-soft px-1.5 py-0.5 text-[10px] font-medium text-body"
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
              className="inline-flex h-6 w-6 items-center justify-center rounded text-subtle hover:text-body hover:bg-surface-soft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-wv-border-focus transition-colors"
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
            className="inline-flex h-6 w-6 items-center justify-center rounded text-subtle hover:text-ink hover:bg-surface-soft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-wv-border-focus transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Counter & Meter State */}
      {isInitialLoading ? (
        <div className="mt-2 space-y-2" aria-busy="true">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-subtle tabular-nums">
              – / –
            </span>
            <span className="text-xs text-subtle">{t('checkingUsage')}</span>
          </div>
          <div className="flex gap-1.5 h-1.5 w-full">
            <div className="ui-skeleton h-full flex-1 rounded-full bg-wv-cotton-300" />
            <div className="ui-skeleton h-full flex-1 rounded-full bg-wv-cotton-300" />
          </div>
        </div>
      ) : hasFatalError ? (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-wv-status-danger-fg font-medium">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{t(unverified ? 'balanceUnverified' : 'usageUnavailable')}</span>
          </div>
          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onRefresh()}
              className="h-7 text-xs px-2.5 mt-1 border-wv-border-control text-body"
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
              <span className="text-xl font-bold tracking-tight text-ink tabular-nums">
                {remaining} / {limit}
              </span>
              <span className="text-xs font-medium text-body">
                {t('leftThisMonth')}
              </span>
            </div>

            {isExhausted && (
              <span className="inline-flex rounded bg-wv-status-warning-bg border border-wv-status-warning-border/80 px-1.5 py-0.5 text-[10px] font-semibold text-wv-status-warning-fg">
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
                    isFilled ? 'bg-wv-neel-600' : 'bg-wv-cotton-300'
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

          {/* Completed work stays useful at zero. */}
          {isExhausted && (
            <Link href="/free/costings" className="mt-1 block text-[11px] font-medium text-ink underline underline-offset-2">
              {t('zeroHistory')}
            </Link>
          )}

          {/* Confirmed 0/2 Exhausted State: Clean, calm reset date and view plans link */}
          {isExhausted && (
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-body">
              {formattedResetDate && (
                <span className="truncate">
                  {t('reset', { date: formattedResetDate })}
                </span>
              )}
              {plansAction(t('viewPlans'), 'font-medium text-ink hover:text-body underline underline-offset-2 shrink-0 ml-2', 'free-usage-plans-link')}
            </div>
          )}
        </div>
      )}

      {/* Expanded Disclosure Region */}
      {expanded && (
        <div
          id={detailsId}
          data-testid="free-usage-details"
          className="mt-3 pt-2.5 border-t border-wv-border-default/80 space-y-2 text-xs"
        >
          <div className="font-semibold text-ink">
            {t('yourMonthlyAllowance')}
          </div>
          <div className="text-body">
            {t('remainingOfLimit', { remaining: remaining ?? 0, limit })}.
          </div>
          {formattedResetDate && (
            <div className="text-subtle text-[11px]">
              {t('reset', { date: formattedResetDate })}
            </div>
          )}
          <p className="text-[11px] leading-relaxed text-subtle">
            {t('costingConsumptionExplanation')}
          </p>
          <div className="pt-1">
            {plansAction(t('explorePlansArrow'), 'inline-flex items-center text-xs font-semibold text-ink hover:text-body hover:underline')}
          </div>
        </div>
      )}
    </aside>
  )
}
