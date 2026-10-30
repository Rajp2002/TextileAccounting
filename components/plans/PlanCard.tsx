'use client'

import { useId, useState } from 'react'
import Image from 'next/image'
import { Check, Play, Loader2, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SubscribeButton } from '@/components/billing/SubscribeButton'
import { StartTrialButton, TRIAL_PAY_NOW_LINK_CLASS } from '@/components/plans/StartTrialButton'
import { BILLING_PLANS } from '@/lib/billing-constants'
import {
  upgradeText,
  type UpgradeText,
  type UpgradeFeature,
  type UpgradePlan,
} from '@/lib/upgrade-wall'
import { useTranslation } from '@/lib/i18n/context'
import { freeMobileEntryText } from '@/lib/i18n/free-mobile-entry'
import { liteTrialText } from '@/lib/i18n/lite-trial'
import { cn } from '@/lib/utils'
import { FEATURE_DEMOS } from '@/lib/feature-demos'

// Explicit feature lists per card with specific starting feature
export const CARD_FEATURE_PREVIEWS: Record<UpgradePlan, readonly UpgradeFeature[]> = {
  free: ['estimator', 'costings'],
  lite: ['qualities', 'rates', 'estimator', 'costings'],
  base: ['production', 'payroll', 'qualities', 'rates', 'estimator', 'costings'],
}

interface PlanCardProps {
  planTier: UpgradePlan
  currentPlan: UpgradePlan | 'unassigned'
  isOnboarding: boolean
  freeAvailable: boolean
  billingReady: boolean
  mobileCompact?: boolean
  busy: boolean
  onSelectFree: () => void
  onOpenPreview: (feature: UpgradeFeature, tier: UpgradePlan) => void
  /** Lite only: the org may start the 90-day trial. Defaults to hidden. */
  liteTrialEligible?: boolean
}

export function PlanCard({
  planTier,
  currentPlan,
  isOnboarding,
  freeAvailable,
  billingReady,
  busy,
  mobileCompact = false,
  onSelectFree,
  onOpenPreview,
  liteTrialEligible = false,
}: PlanCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const detailsId = useId()
  const { language, tx } = useTranslation()
  const availableFeatures = CARD_FEATURE_PREVIEWS[planTier]
  // Start on the first feature in the card's array (Free: estimator, Lite: qualities, Base: production)
  const [activeFeature, setActiveFeature] = useState<UpgradeFeature>(availableFeatures[0])

  const formatPaise = (paise: number) =>
    new Intl.NumberFormat(`${language}-IN`, {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(paise / 100)

  const isCurrent = currentPlan === planTier && !isOnboarding
  const isLite = planTier === 'lite'
  // Same condition as the Start trial button below, so the badge never promises a trial the card can't start.
  const showTrialBadge = isLite && liteTrialEligible && !isCurrent && currentPlan !== 'base'
  const isBase = planTier === 'base'
  const isFree = planTier === 'free'

  const summaryFeatures: readonly UpgradeText[] = isFree
    ? ['viewExport', 'noQuality']
    : isLite
      ? ['unlimited', 'savedQualitiesLibrary', 'rateBookYarnLinking']
      : ['everythingInLite', 'productionLoomTracking', 'payrollPieceRate']

  const activeDemo = FEATURE_DEMOS[activeFeature]
  const activeFeatureName = upgradeText(language, activeFeature)

  return (
    <div
      className={cn(
        'relative flex flex-col justify-between rounded-2xl border bg-surface p-6 lg:p-5 shadow-sm transition-all duration-200',
        mobileCompact && 'max-md:p-[16px]',
        isLite
          ? 'border-saffron/40 shadow-md ring-1 ring-saffron/30 hover:border-saffron/60'
          : 'border-hairline hover:border-hairline-strong hover:shadow-md'
      )}
    >
      {/* Popular/Recommended badge for Lite */}
      {isLite && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-saffron-deep px-3 py-0.5 text-xs font-bold text-white shadow-sm">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            <span>{freeMobileEntryText(language, 'recommended')}</span>
          </span>
        </div>
      )}

      {/* Card Header & Pricing */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xl font-bold text-ink">
                {isFree ? 'Weavly Free' : BILLING_PLANS[planTier].name}
              </h3>
              {isCurrent && (
                <span className="rounded-md border border-hairline bg-surface-soft px-2 py-0.5 text-xs font-semibold text-subtle">
                  {upgradeText(language, 'current')}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-medium text-saffron-deep">
              {upgradeText(language, isFree ? 'freeFit' : isLite ? 'liteFit' : 'baseFit')}
            </p>
          </div>
          {/* The eye lands on the plan names first, so the free trial is said up here as well as on
              the button: a large tag in the card's top-right corner, as tall as the name and tagline. */}
          {showTrialBadge && (
            <span className="inline-flex min-h-[64px] shrink-0 items-center rounded-xl bg-success px-6 text-xl font-bold text-white">
              {liteTrialText(language, 'freeForThreeMonths')}
            </span>
          )}
        </div>

        {/* Price display */}
        <div className="border-y border-hairline/60 py-3.5 space-y-1">
          {isFree ? (
            <>
              <div className={cn("flex items-baseline gap-1", mobileCompact && "max-md:flex-wrap")}>
                <span className={cn("text-3xl font-bold tracking-tight text-ink", mobileCompact && "max-md:text-2xl")}>₹0</span>
                <span className="text-xs font-medium text-subtle">
                  / {upgradeText(language, 'freeForever')}
                </span>
              </div>
              <p className="text-xs font-medium text-body">
                {upgradeText(language, 'twoEstimatesPerMonth')}
              </p>
              <p className="text-xs text-subtle">{upgradeText(language, 'freePrice')}</p>
            </>
          ) : (
            <>
              <div className={cn("flex items-baseline gap-1", mobileCompact && "max-md:flex-wrap")}>
                <span className={cn("text-3xl font-bold tracking-tight text-ink", mobileCompact && "max-md:text-2xl")}>
                  {formatPaise(BILLING_PLANS[planTier].firstYearTotalPaise)}
                </span>
                <span className="text-xs font-medium text-subtle">
                  / {upgradeText(language, 'firstYear')}
                </span>
              </div>
              <p className="text-xs text-body">
                {formatPaise(BILLING_PLANS[planTier].firstYearBasePaise)} +{' '}
                {formatPaise(BILLING_PLANS[planTier].firstYearGstPaise)} GST (18%)
              </p>
              <p className="text-xs font-medium text-body">
                {upgradeText(language, 'renewal', {
                  amount: formatPaise(BILLING_PLANS[planTier].renewalTotalPaise),
                })}
              </p>
              <p className="text-xs text-subtle">{upgradeText(language, 'tax')}</p>
            </>
          )}
        </div>

        {mobileCompact && (
          <>
            <ul className="space-y-1.5 text-xs leading-relaxed text-body md:hidden">
              {summaryFeatures.map(key => <li key={key}>{upgradeText(language, key)}</li>)}
            </ul>
            <button
              type="button"
              aria-expanded={detailsOpen}
              aria-controls={detailsId}
              onClick={() => setDetailsOpen(open => !open)}
              className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg border border-hairline px-3 py-2 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron md:hidden"
            >
              <span>{upgradeText(language, detailsOpen ? 'hidePlanDetails' : 'planDetails')}</span>
              <span aria-hidden="true">{detailsOpen ? '−' : '+'}</span>
            </button>
          </>
        )}

        <div id={detailsId} className={cn('space-y-4', mobileCompact && !detailsOpen && 'max-md:hidden')}>
        {/* Interactive Feature Preview Carousel */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-subtle">
              {freeMobileEntryText(language, 'featurePreview')}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenPreview(activeFeature, planTier)}
              className={cn("h-6 gap-1 px-1.5 text-xs font-semibold text-saffron-deep hover:bg-saffron/10 hover:text-saffron-deep", mobileCompact && "max-md:min-h-[44px]")}
            >
              <Play className="h-3 w-3" aria-hidden="true" />
              <span>{upgradeText(language, 'watchDemo')}</span>
            </Button>
          </div>

          {/* Feature Selector Tabs */}
          <div className="flex flex-wrap gap-1" role="tablist" aria-label={freeMobileEntryText(language, 'previewFeatures')}>
            {availableFeatures.map((feat) => {
              const active = activeFeature === feat
              return (
                <button
                  key={feat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveFeature(feat)}
                  className={cn(
                    'rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
                    mobileCompact && 'max-md:min-h-[44px]',
                    active
                      ? 'bg-loom text-white font-semibold'
                      : 'bg-surface-soft text-body hover:bg-surface-soft/80 hover:text-ink'
                  )}
                >
                  {upgradeText(language, feat)}
                </button>
              )
            })}
          </div>

          {/* Posters keep all video downloads behind an explicit request. */}
          <button
            type="button"
            onClick={() => onOpenPreview(activeFeature, planTier)}
            className="group relative flex aspect-[16/9] w-full lg:max-h-[clamp(110px,12vh,280px)] cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-hairline bg-surface-soft p-2 transition-colors hover:border-saffron/40"
            aria-label={upgradeText(language, 'watchFeatureDemo', { feature: activeFeatureName })}
          >
            <Image
              src={activeDemo.poster}
              alt={upgradeText(language, 'picture', { feature: activeFeatureName })}
              width={activeDemo.posterSize[0]}
              height={activeDemo.posterSize[1]}
              sizes="(min-width: 1024px) 45vw, (min-width: 640px) 600px, 90vw"
              className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/15 transition-colors group-hover:bg-black/25">
              <span className="inline-flex items-center gap-2 rounded-full bg-surface/95 px-3 py-2 text-xs font-semibold text-ink shadow-md">
                <Play className="h-4 w-4 fill-current text-saffron-deep" aria-hidden="true" />
                <span>{upgradeText(language, 'watchDemo')}</span>
              </span>
            </div>
          </button>
        </div>

        {/* Feature List & Incremental Inheritance */}
        <div className="space-y-2 pt-2">
          {isLite && (
            <p className="text-xs font-bold text-ink">
              {upgradeText(language, 'everythingInFree')}
            </p>
          )}
          {isBase && (
            <p className="text-xs font-bold text-ink">
              {upgradeText(language, 'everythingInLite')}
            </p>
          )}

          <ul className="space-y-2 text-xs leading-relaxed text-body 2xl:grid 2xl:grid-cols-2 2xl:gap-x-6 2xl:gap-y-2 2xl:space-y-0">
            {isFree && (
              <>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                  <span>{upgradeText(language, 'create')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                  <span>{upgradeText(language, 'limit')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                  <span>{upgradeText(language, 'freeHistory')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                  <span>{upgradeText(language, 'viewExport')}</span>
                </li>
                <li className="flex items-start gap-2 text-subtle">
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
                  <span>{upgradeText(language, 'noQuality')}</span>
                </li>
              </>
            )}

            {isLite && (
              <>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                  <span>{upgradeText(language, 'unlimited')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                  <span>{upgradeText(language, 'construction')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                  <span>{upgradeText(language, 'linkRates')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                  <span>{upgradeText(language, 'linked')}</span>
                </li>
              </>
            )}

            {isBase && (
              <>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                  <span>{upgradeText(language, 'jobs')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                  <span>{upgradeText(language, 'metres')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                  <span>{upgradeText(language, 'daily')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                  <span>{upgradeText(language, 'settlements')}</span>
                </li>
              </>
            )}
          </ul>
        </div>
        </div>
      </div>

      {/* Action CTA Button */}
      <div className={cn("mt-6 pt-4 border-t border-hairline/60 lg:mt-4", mobileCompact && "max-md:mt-3 max-md:[&_button]:min-h-[44px] max-md:[&_button]:h-auto max-md:[&_button]:whitespace-normal max-md:[&_button]:py-3")}>
        {isFree && (
          <>
            {isCurrent ? (
              <Button type="button" variant="outline" disabled className="w-full gap-2">
                <Check className="h-4 w-4 text-success" aria-hidden="true" />
                <span>{upgradeText(language, 'current')}</span>
              </Button>
            ) : currentPlan === 'lite' || currentPlan === 'base' ? (
              <Button type="button" variant="ghost" disabled className="w-full text-subtle">
                <span>{upgradeText(language, 'comparison')}</span>
              </Button>
            ) : (
              <Button
                type="button"
                id="continue-free-btn"
                disabled={busy || !freeAvailable}
                onClick={onSelectFree}
                className="w-full font-semibold gap-2"
                size="lg"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                <span>{busy ? tx('Opening your workspace…') : upgradeText(language, 'continueFree')}</span>
              </Button>
            )}
            {!freeAvailable && !isCurrent && (
              <p className="mt-2 text-center text-xs text-destructive">
                {tx('Free enrollment unavailable for this account.')}
              </p>
            )}
          </>
        )}

        {isLite && (
          <>
            {isCurrent ? (
              <Button type="button" variant="outline" disabled className="w-full gap-2">
                <Check className="h-4 w-4 text-success" aria-hidden="true" />
                <span>{upgradeText(language, 'current')}</span>
              </Button>
            ) : currentPlan === 'base' ? (
              <Button type="button" variant="ghost" disabled className="w-full text-subtle text-xs">
                <span>{upgradeText(language, 'includedInBase')}</span>
              </Button>
            ) : liteTrialEligible ? (
              <div className="space-y-2">
                <StartTrialButton className="w-full" />
                <p className="text-xs leading-relaxed text-body">{liteTrialText(language, 'trialDisclosure')}</p>
                {billingReady && (
                  <SubscribeButton
                    interestSource="plan_card"
                    planTier="lite"
                    tierName={BILLING_PLANS.lite.name}
                    displayAmount={formatPaise(BILLING_PLANS.lite.firstYearTotalPaise)}
                    buttonLabel={liteTrialText(language, 'trialPayNow')}
                    successHref="/owner/estimator"
                    className={TRIAL_PAY_NOW_LINK_CLASS}
                  />
                )}
              </div>
            ) : billingReady ? (
              <SubscribeButton
                interestSource="plan_card"
                planTier="lite"
                tierName={BILLING_PLANS.lite.name}
                displayAmount={formatPaise(BILLING_PLANS.lite.firstYearTotalPaise)}
                buttonLabel={
                  currentPlan === 'free'
                    ? `${upgradeText(language, 'upgradeToLite')} · ${formatPaise(BILLING_PLANS.lite.firstYearTotalPaise)}`
                    : `${upgradeText(language, 'chooseLite')} · ${formatPaise(BILLING_PLANS.lite.firstYearTotalPaise)}`
                }
                successHref="/owner/estimator"
                className="w-full"
              />
            ) : (
              <Button type="button" disabled className="w-full">
                {freeMobileEntryText(language, 'paymentsUnavailable')}
              </Button>
            )}
          </>
        )}

        {isBase && (
          <>
            {isCurrent ? (
              <Button type="button" variant="outline" disabled className="w-full gap-2">
                <Check className="h-4 w-4 text-success" aria-hidden="true" />
                <span>{upgradeText(language, 'current')}</span>
              </Button>
            ) : billingReady ? (
              <SubscribeButton
                interestSource="plan_card"
                planTier="base"
                tierName={BILLING_PLANS.base.name}
                displayAmount={formatPaise(BILLING_PLANS.base.firstYearTotalPaise)}
                buttonLabel={
                  currentPlan === 'free' || currentPlan === 'lite'
                    ? `${upgradeText(language, 'upgradeToBase')} · ${formatPaise(BILLING_PLANS.base.firstYearTotalPaise)}`
                    : `${upgradeText(language, 'chooseBase')} · ${formatPaise(BILLING_PLANS.base.firstYearTotalPaise)}`
                }
                successHref="/onboarding/base"
                className="w-full"
              />
            ) : (
              <Button type="button" disabled className="w-full">
                {freeMobileEntryText(language, 'paymentsUnavailable')}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
