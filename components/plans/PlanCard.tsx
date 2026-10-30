'use client'

import { useRef } from 'react'
import { ArrowUpRight, Check, Loader2, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { SubscribeButton } from '@/components/billing/SubscribeButton'
import { usePaidPlans } from '@/components/billing/PaidPlansProvider'
import { StartTrialButton, TRIAL_PAY_NOW_LINK_CLASS } from '@/components/plans/StartTrialButton'
import { PlanFeaturePreview } from './PlanFeaturePreview'
import { BILLING_PLANS } from '@/lib/billing-constants'
import { upgradeText, type UpgradeText, type UpgradeFeature, type UpgradePlan } from '@/lib/upgrade-wall'
import { useTranslation } from '@/lib/i18n/context'
import { freeMobileEntryText } from '@/lib/i18n/free-mobile-entry'
import { liteTrialText } from '@/lib/i18n/lite-trial'
import { planSelectionText } from '@/lib/i18n/plan-selection'
import { cn } from '@/lib/utils'
import styles from './plan-selection.module.css'

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
  onOpenPreview: (feature: UpgradeFeature, tier: UpgradePlan, trigger?: HTMLElement) => void
  liteTrialEligible?: boolean
}

export function PlanCard({
  planTier, currentPlan, isOnboarding, freeAvailable, billingReady, busy,
  onSelectFree, onOpenPreview, liteTrialEligible = false,
}: PlanCardProps) {
  const { language, tx } = useTranslation()
  const { checkoutOpen } = usePaidPlans()
  const detailsTriggerRef = useRef<HTMLButtonElement | null>(null)
  const formatPaise = (paise: number) => new Intl.NumberFormat(`${language}-IN`, {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(paise / 100)
  const isCurrent = currentPlan === planTier && !isOnboarding
  const isLite = planTier === 'lite'
  const isBase = planTier === 'base'
  const isFree = planTier === 'free'
  // Match the CTA eligibility: never advertise a new trial on a current paid plan.
  const showTrial = isLite && liteTrialEligible && !isCurrent && currentPlan !== 'base'
  const includedFeatures: readonly UpgradeText[] = isFree
    ? ['create', 'freeHistory', 'limit', 'viewExport']
    : isLite
      ? ['unlimited', 'construction', 'linkRates', 'linked']
      : ['jobs', 'metres', 'daily', 'settlements']

  return (
    <Dialog>
      <Card
        data-plan={planTier}
        className={cn('h-full min-h-0 w-full gap-3 rounded-xl p-4 shadow-xs lg:p-5', isLite && 'border-saffron/60')}
      >
        <header className="shrink-0 space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-ink">{isFree ? 'Weavly Free' : BILLING_PLANS[planTier].name}</h2>
            {isCurrent && <span className="text-sm font-medium text-subtle">{upgradeText(language, 'current')}</span>}
            <DialogTrigger asChild><Button type="button" variant="ghost" className="min-h-[44px] gap-1 px-2 text-sm" onClick={event => { detailsTriggerRef.current = event.currentTarget }} aria-label={`${isFree ? 'Weavly Free' : BILLING_PLANS[planTier].name} · ${planSelectionText(language, 'planDetails')}`}>{planSelectionText(language, 'details')}<ArrowUpRight className="size-3" aria-hidden="true" /></Button></DialogTrigger>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-1"><p className="text-sm text-subtle">{upgradeText(language, isFree ? 'freeFit' : isLite ? 'liteFit' : 'baseFit')}</p>{isLite && <span className="rounded-md bg-saffron-soft px-2 py-1 text-xs font-semibold text-saffron-deep">{freeMobileEntryText(language, 'recommended')}</span>}</div>
        </header>

        <div className="shrink-0 space-y-1 border-b border-hairline pb-3">
          {showTrial && <p className={styles.extraPriceContext + " text-sm font-semibold text-success"}>{planSelectionText(language, 'launchOffer')}</p>}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-3xl font-semibold tabular-nums text-ink">{isFree || showTrial ? '₹0' : formatPaise(BILLING_PLANS[planTier].firstYearTotalPaise)}</span>
            <span className="text-sm font-medium text-body">{isFree ? upgradeText(language, 'freeForever') : showTrial ? planSelectionText(language, 'first90Days') : `/ ${upgradeText(language, 'firstYear')}`}</span>
          </div>
          {isFree ? (
            <p className="text-sm leading-relaxed text-subtle">{upgradeText(language, 'twoEstimatesPerMonth')} · {upgradeText(language, 'freePrice')}</p>
          ) : (
            <div className="space-y-1 text-sm leading-snug text-subtle">
              {showTrial && <p className={styles.extraPriceContext}>{planSelectionText(language, 'noPayment')}</p>}
              {showTrial && <p className="font-medium text-body">{planSelectionText(language, 'afterTrial')}: {planSelectionText(language, 'firstYear', { amount: formatPaise(BILLING_PLANS[planTier].firstYearTotalPaise) })}</p>}
              <p>{upgradeText(language, 'renewal', { amount: formatPaise(BILLING_PLANS[planTier].renewalTotalPaise) })}</p>
            </div>
          )}
        </div>

        <PlanFeaturePreview planTier={planTier} features={CARD_FEATURE_PREVIEWS[planTier]} onOpenPreview={onOpenPreview} />

        <DialogContent mobilePresentation="center" showCloseButton={false} className="gap-6 sm:max-w-xl" onCloseAutoFocus={event => { event.preventDefault(); detailsTriggerRef.current?.focus() }}>
          <div className="space-y-1">
            <DialogTitle>{isFree ? 'Weavly Free' : BILLING_PLANS[planTier].name}</DialogTitle>
            <DialogDescription>{upgradeText(language, isFree ? 'freeFit' : isLite ? 'liteFit' : 'baseFit')}</DialogDescription>
          </div>
          <div className="space-y-2 border-b border-hairline pb-4 text-base leading-relaxed text-body">
            {isFree ? <p>₹0 · {upgradeText(language, 'freeForever')} · {upgradeText(language, 'freePrice')}</p> : <>
              {showTrial && <p>{liteTrialText(language, 'trialDisclosure')}</p>}
              <p className="font-semibold text-ink">{planSelectionText(language, 'firstYear', { amount: formatPaise(BILLING_PLANS[planTier].firstYearTotalPaise) })}</p>
              <p>{formatPaise(BILLING_PLANS[planTier].firstYearBasePaise)} + {formatPaise(BILLING_PLANS[planTier].firstYearGstPaise)} GST (18%)</p>
              <p>{upgradeText(language, 'renewal', { amount: formatPaise(BILLING_PLANS[planTier].renewalTotalPaise) })}</p>
              <p className="text-sm text-subtle">{upgradeText(language, 'tax')}</p>
            </>}
          </div>
          <section className="space-y-3" aria-label={isFree ? planSelectionText(language, 'included') : upgradeText(language, isLite ? 'everythingInFree' : 'everythingInLite')}>
            <h3 className="text-base font-semibold text-ink">
              {isFree && planSelectionText(language, 'included')}
              {isLite && upgradeText(language, 'everythingInFree')}
              {isBase && upgradeText(language, 'everythingInLite')}
            </h3>
            <ul className="space-y-3 text-base leading-relaxed text-body">
              {includedFeatures.map(key => <li key={key} className="flex items-start gap-3"><Check className="mt-1 size-4 shrink-0 text-success" aria-hidden="true" /><span>{upgradeText(language, key)}</span></li>)}
              {isFree && <li className="flex items-start gap-3 text-subtle"><Minus className="mt-1 size-4 shrink-0" aria-hidden="true" /><span>{upgradeText(language, 'noQuality')}</span></li>}
            </ul>
          </section>
          {showTrial && billingReady && checkoutOpen && (
            <SubscribeButton
              interestSource="plan_card"
              planTier="lite"
              tierName={BILLING_PLANS.lite.name}
              displayAmount={formatPaise(BILLING_PLANS.lite.firstYearTotalPaise)}
              buttonLabel={liteTrialText(language, 'trialPayNow')}
              successHref="/owner/estimator"
              className="w-full"
            />
          )}
          <DialogClose asChild><Button size="lg" className="min-h-[44px] justify-self-end">{planSelectionText(language, 'close')}</Button></DialogClose>
        </DialogContent>

        {/* Action CTA Button */}
        <div className="shrink-0 border-t border-hairline pt-3 [&_button]:min-h-[44px] [&_button]:h-auto [&_button]:whitespace-normal [&_button]:py-3">
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
                  variant="outline"
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
                  <StartTrialButton className="w-full" errorPresentation="dialog" />
                  <p className="text-xs leading-relaxed text-body">{liteTrialText(language, 'trialDisclosure')}</p>
                  {billingReady && (checkoutOpen ? (
                    <DialogTrigger asChild><Button type="button" className={TRIAL_PAY_NOW_LINK_CLASS} onClick={event => { detailsTriggerRef.current = event.currentTarget }}>{liteTrialText(language, 'trialPayNow')}</Button></DialogTrigger>
                  ) : (
                    <SubscribeButton
                      interestSource="plan_card"
                      planTier="lite"
                      tierName={BILLING_PLANS.lite.name}
                      displayAmount={formatPaise(BILLING_PLANS.lite.firstYearTotalPaise)}
                      buttonLabel={liteTrialText(language, 'trialPayNow')}
                      successHref="/owner/estimator"
                      className={TRIAL_PAY_NOW_LINK_CLASS}
                    />
                  ))}
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
      </Card>
    </Dialog>
  )
}
