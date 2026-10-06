'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ShieldCheck, Calendar, Receipt, Sparkles, CheckCircle2 } from 'lucide-react'
import { PlanCard } from './PlanCard'
import { PlanPreviewModal } from './PlanPreviewModal'
import { Button } from '@/components/ui/button'
import { completePlanSelection } from '@/app/(auth)/onboarding/plans/actions'
import { upgradeText, type UpgradeFeature, type UpgradePlan } from '@/lib/upgrade-wall'
import { BILLING_DOCUMENT_POLICY } from '@/lib/billing-document-policy'
import { freeMobileEntryText } from '@/lib/i18n/free-mobile-entry'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/context'

interface PlanChooserClientProps {
  currentPlan: UpgradePlan | 'unassigned'
  isOnboarding: boolean
  freeAvailable: boolean
  billingReady: boolean
  paid: boolean
  paymentRecovery?: ReactNode
}

export function PlanChooserClient({
  currentPlan,
  isOnboarding,
  freeAvailable,
  billingReady,
  paid,
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

  const { language, tx, t } = useTranslation()

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
    <div className={cn("space-y-10 pb-16 pt-4", mobileCompact && "max-md:space-y-5 max-md:pb-6 max-md:pt-3")}>
      {/* Title & Subheading */}
      <div className={cn("mx-auto max-w-2xl text-center space-y-3", mobileCompact && "max-md:space-y-2 max-md:text-left")}>
        <div className={cn("inline-flex items-center gap-1.5 rounded-full border border-saffron/30 bg-saffron/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-saffron-deep", mobileCompact && "max-md:hidden")}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{tx('TRANSPARENT PRICING · NO HIDDEN FEES')}</span>
        </div>
        <h1 className={cn("text-3xl font-extrabold tracking-tight text-ink sm:text-4xl md:text-5xl", mobileCompact && "max-md:text-2xl")}>
          {upgradeText(language, 'title')}
        </h1>
        <p className="text-sm leading-relaxed text-body sm:text-base">
          {upgradeText(language, 'upgradeSubtitle')}
        </p>
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

      {/* 3-Column Pricing Grid */}
      <div className={cn("mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-3", mobileCompact && "max-md:gap-4")}>
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
        />

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
      </div>

      {/* Commercial Terms & Purchase Disclosure Panel */}
      <section
        aria-label={freeMobileEntryText(language, 'billingTerms')}
        className={cn("mx-auto max-w-4xl rounded-2xl border border-hairline bg-surface-soft/60 p-6 shadow-sm", mobileCompact && "max-md:p-4")}
        data-billing-document-state={BILLING_DOCUMENT_POLICY.state}
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
          <div className="flex items-start gap-3">
            <Receipt className="h-5 w-5 shrink-0 text-saffron-deep mt-0.5" aria-hidden="true" />
            <div>
              <h4 className="text-xs font-bold text-ink">{freeMobileEntryText(language, 'receiptDocument')}</h4>
              <p className={cn("mt-1 text-[11px] leading-relaxed text-subtle", mobileCompact && "max-md:text-xs")}>
                {t('base_plan.billing.receipt_only')}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 shrink-0 text-saffron-deep mt-0.5" aria-hidden="true" />
            <div>
              <h4 className="text-xs font-bold text-ink">{freeMobileEntryText(language, 'manualRenewal')}</h4>
              <p className={cn("mt-1 text-[11px] leading-relaxed text-subtle", mobileCompact && "max-md:text-xs")}>
                {freeMobileEntryText(language, 'manualRenewalDescription')}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-saffron-deep mt-0.5" aria-hidden="true" />
            <div>
              <h4 className="text-xs font-bold text-ink">{freeMobileEntryText(language, 'verifiedActivation')}</h4>
              <p className={cn("mt-1 text-[11px] leading-relaxed text-subtle", mobileCompact && "max-md:text-xs")}>
                {freeMobileEntryText(language, 'verifiedActivationDescription')}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-saffron-deep mt-0.5" aria-hidden="true" />
            <div>
              <h4 className="text-xs font-bold text-ink">{freeMobileEntryText(language, 'secureCheckout')}</h4>
              <p className={cn("mt-1 text-[11px] leading-relaxed text-subtle", mobileCompact && "max-md:text-xs")}>
                {freeMobileEntryText(language, 'secureCheckoutDescription')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Enlarged Feature Preview Modal */}
      <PlanPreviewModal
        feature={previewState.feature}
        planTier={previewState.planTier}
        onClose={handleClosePreview}
      />
    </div>
  )
}
