'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Check, Eye, Lock, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SubscribeButton } from '@/components/billing/SubscribeButton'
import { BILLING_PLANS, type PurchasablePlanTier } from '@/lib/billing-constants'
import {
  UPGRADE_FEATURE_IMAGES,
  upgradeText,
  type UpgradeFeature,
  type UpgradePlan,
} from '@/lib/upgrade-wall'
import { useTranslation } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

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
  busy: boolean
  onSelectFree: () => void
  onOpenPreview: (feature: UpgradeFeature, tier: UpgradePlan) => void
}

export function PlanCard({
  planTier,
  currentPlan,
  isOnboarding,
  freeAvailable,
  billingReady,
  busy,
  onSelectFree,
  onOpenPreview,
}: PlanCardProps) {
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

  const isCurrent = currentPlan === planTier
  const isLite = planTier === 'lite'
  const isBase = planTier === 'base'
  const isFree = planTier === 'free'

  const activeImage = UPGRADE_FEATURE_IMAGES[activeFeature]
  const activeFeatureName = upgradeText(language, activeFeature)

  return (
    <div
      className={cn(
        'relative flex flex-col justify-between rounded-2xl border bg-surface p-6 shadow-sm transition-all duration-200',
        isLite
          ? 'border-saffron/40 shadow-md ring-1 ring-saffron/30 hover:border-saffron/60'
          : 'border-hairline hover:border-hairline-strong hover:shadow-md'
      )}
    >
      {/* Popular/Recommended badge for Lite */}
      {isLite && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-saffron-deep px-3 py-0.5 text-[11px] font-bold tracking-wide text-white shadow-sm">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            <span>{tx('RECOMMENDED')}</span>
          </span>
        </div>
      )}

      {/* Card Header & Pricing */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xl font-bold text-ink">
              {isFree ? 'Weavly Free' : BILLING_PLANS[planTier].name}
            </h3>
            {isCurrent && (
              <span className="rounded-md border border-hairline bg-surface-soft px-2 py-0.5 text-[11px] font-semibold text-subtle">
                {upgradeText(language, 'current')}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs font-medium text-saffron-deep">
            {upgradeText(language, isFree ? 'freeFit' : isLite ? 'liteFit' : 'baseFit')}
          </p>
        </div>

        {/* Price display */}
        <div className="border-y border-hairline/60 py-3.5 space-y-1">
          {isFree ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight text-ink">₹0</span>
                <span className="text-xs font-medium text-subtle">
                  / {upgradeText(language, 'freeForever')}
                </span>
              </div>
              <p className="text-xs font-medium text-body">
                {upgradeText(language, 'twoEstimatesPerWeek')}
              </p>
              <p className="text-[11px] text-subtle">{upgradeText(language, 'freePrice')}</p>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight text-ink">
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
              <p className="text-[11px] text-subtle">{upgradeText(language, 'tax')}</p>
            </>
          )}
        </div>

        {/* Interactive Feature Preview Carousel */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-subtle">
              {tx('Feature Preview')}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenPreview(activeFeature, planTier)}
              className="h-6 gap-1 px-1.5 text-[11px] font-semibold text-saffron-deep hover:bg-saffron/10 hover:text-saffron-deep"
            >
              <Eye className="h-3 w-3" aria-hidden="true" />
              <span>{upgradeText(language, 'viewPreview')}</span>
            </Button>
          </div>

          {/* Feature Selector Tabs */}
          <div className="flex flex-wrap gap-1" role="tablist" aria-label={tx('Plan preview features')}>
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
                    'rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
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

          {/* Preview Image Container */}
          <div
            onClick={() => onOpenPreview(activeFeature, planTier)}
            className="group relative flex aspect-[16/9] w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-hairline bg-surface-soft p-2 transition-colors hover:border-saffron/40"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpenPreview(activeFeature, planTier)
              }
            }}
            aria-label={`${activeFeatureName} preview. Click to enlarge.`}
          >
            <Image
              src={activeImage.src}
              alt={upgradeText(language, 'picture', { feature: activeFeatureName })}
              width={activeImage.width}
              height={activeImage.height}
              className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-semibold text-ink shadow-md">
                <Eye className="h-3.5 w-3.5 text-saffron-deep" aria-hidden="true" />
                <span>{upgradeText(language, 'enlargePreview')}</span>
              </span>
            </div>
          </div>
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

          <ul className="space-y-2 text-xs leading-relaxed text-body">
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

      {/* Action CTA Button */}
      <div className="mt-6 pt-4 border-t border-hairline/60">
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
                disabled={busy || !freeAvailable}
                onClick={onSelectFree}
                className="w-full font-semibold"
                size="lg"
              >
                {busy ? tx('Opening your workspace…') : upgradeText(language, 'continueFree')}
              </Button>
            )}
            {!freeAvailable && !isCurrent && (
              <p className="mt-2 text-center text-[11px] text-destructive">
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
            ) : billingReady ? (
              <SubscribeButton
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
                {tx('Payments unavailable')}
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
                planTier="base"
                tierName={BILLING_PLANS.base.name}
                displayAmount={formatPaise(BILLING_PLANS.base.firstYearTotalPaise)}
                buttonLabel={
                  currentPlan === 'free' || currentPlan === 'lite'
                    ? `${upgradeText(language, 'upgradeToBase')} · ${formatPaise(BILLING_PLANS.base.firstYearTotalPaise)}`
                    : `${upgradeText(language, 'chooseBase')} · ${formatPaise(BILLING_PLANS.base.firstYearTotalPaise)}`
                }
                successHref="/owner/estimator"
                className="w-full"
              />
            ) : (
              <Button type="button" disabled className="w-full">
                {tx('Payments unavailable')}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
