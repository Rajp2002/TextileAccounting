'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { PlanCard } from './PlanCard'
import { PlanPreviewModal } from './PlanPreviewModal'
import { PlanTrustTiles } from './PlanTrustTiles'
import { Button } from '@/components/ui/button'
import { completePlanSelection } from '@/app/(auth)/onboarding/plans/actions'
import { upgradeText, type UpgradeFeature, type UpgradePlan } from '@/lib/upgrade-wall'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/context'

interface PlanChooserClientProps {
  currentPlan: UpgradePlan | 'unassigned'
  isOnboarding: boolean
  freeAvailable: boolean
  billingReady: boolean
  paid: boolean
  /** Whether this organization may see Base. Hidden orgs see Free and Lite only. */
  baseVisible: boolean
  /** Whether this organization may start the Lite trial. The trial replaces the Lite primary action. */
  liteTrialEligible: boolean
  paymentRecovery?: ReactNode
}

export function PlanChooserClient({
  currentPlan,
  isOnboarding,
  freeAvailable,
  billingReady,
  paid,
  baseVisible,
  liteTrialEligible,
  paymentRecovery,
}: PlanChooserClientProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [previewState, setPreviewState] = useState<{
    feature: UpgradeFeature | null
    planTier: UpgradePlan
  }>({
    feature: null,
    planTier: 'free',
  })

  const { language, tx } = useTranslation()

  const mobileCompact = currentPlan === 'free' || currentPlan === 'lite' || currentPlan === 'unassigned'

  const finish = useCallback(async (plan: 'free' | 'paid') => {
    setBusy(true)
    setError('')
    try {
      const result = await completePlanSelection(plan)
      if (result.href) {
        window.location.assign(result.href)
      } else {
        setError(result.error ?? 'Please try again.')
        setBusy(false)
      }
    } catch {
      setError('Unable to finish setup. Please try again.')
      setBusy(false)
    }
  }, [])

  // Auto-finalize if user already paid during checkout return
  useEffect(() => {
    if (!paid || !isOnboarding) return
    const timer = window.setTimeout(() => {
      void finish('paid')
    }, 0)
    return () => window.clearTimeout(timer)
  }, [paid, isOnboarding, finish])

  const handleOpenPreview = (feature: UpgradeFeature, planTier: UpgradePlan) => {
    setPreviewState({ feature, planTier })
  }

  const handleClosePreview = () => {
    setPreviewState({ feature: null, planTier: 'free' })
  }

  return (
    <div className={cn("space-y-10 pb-16 pt-4 lg:space-y-4 lg:pb-0 lg:pt-0", mobileCompact && "max-md:space-y-5 max-md:pb-6 max-md:pt-3")}>
      {/* Title. On desktop it shares a band with the floating header, centred beside the logo, so the
          cards always start below the logo whatever the screen width. */}
      <div className={cn("mx-auto max-w-2xl text-center space-y-3 lg:flex lg:min-h-[148px] lg:items-center lg:justify-center lg:space-y-0", mobileCompact && "max-md:space-y-2 max-md:text-left")}>
        <h1 className={cn("text-3xl font-extrabold tracking-tight text-ink sm:text-4xl md:text-5xl lg:text-4xl", mobileCompact && "max-md:text-2xl")}>
          {upgradeText(language, 'title')}
        </h1>
      </div>

      {/* Payment Recovery / In-progress notice */}
      {paymentRecovery && (
        <div className="mx-auto max-w-xl">
          {paymentRecovery}
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div
          role="alert"
          className="mx-auto max-w-xl rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center text-sm font-medium text-destructive space-y-2"
        >
          <p>{tx(error)}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void finish('paid')}
            disabled={busy}
          >
            {tx('Check activation and continue')}
          </Button>
        </div>
      )}

      {/* Pricing grid: each plan keeps a readable width, and the spare width becomes equal gaps
          before, between and after the cards. Three columns when Base is visible. */}
      <div className={cn("grid grid-cols-1 gap-6 lg:justify-evenly", baseVisible ? "lg:grid-cols-[repeat(3,minmax(0,500px))]" : "lg:grid-cols-[repeat(2,minmax(0,600px))]", mobileCompact && "max-md:gap-4")}>
        <PlanCard
          planTier="free"
          currentPlan={currentPlan}
          isOnboarding={isOnboarding}
          freeAvailable={freeAvailable}
          billingReady={billingReady}
          busy={busy}
          mobileCompact={mobileCompact}
          onSelectFree={() => void finish('free')}
          onOpenPreview={handleOpenPreview}
        />

        <PlanCard
          planTier="lite"
          currentPlan={currentPlan}
          isOnboarding={isOnboarding}
          freeAvailable={freeAvailable}
          billingReady={billingReady}
          busy={busy}
          mobileCompact={mobileCompact}
          onSelectFree={() => void finish('free')}
          onOpenPreview={handleOpenPreview}
          liteTrialEligible={liteTrialEligible}
        />

        {baseVisible && (
          <PlanCard
            planTier="base"
            currentPlan={currentPlan}
            isOnboarding={isOnboarding}
            freeAvailable={freeAvailable}
            billingReady={billingReady}
            busy={busy}
            mobileCompact={mobileCompact}
            onSelectFree={() => void finish('free')}
            onOpenPreview={handleOpenPreview}
          />
        )}
      </div>

      {/* Billing terms: tiles that open a full explanation */}
      <PlanTrustTiles mobileCompact={mobileCompact} />

      {/* Enlarged Feature Preview Modal */}
      <PlanPreviewModal
        feature={previewState.feature}
        planTier={previewState.planTier}
        baseVisible={baseVisible}
        onClose={handleClosePreview}
      />
    </div>
  )
}
