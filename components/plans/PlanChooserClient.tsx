'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { PlanCard } from './PlanCard'
import { PlanPreviewModal } from './PlanPreviewModal'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { completePlanSelection } from '@/app/(auth)/onboarding/plans/actions'
import { upgradeText, type UpgradeFeature, type UpgradePlan } from '@/lib/upgrade-wall'
import { PlanTrustTiles } from './PlanTrustTiles'
import { planSelectionText } from '@/lib/i18n/plan-selection'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/context'
import styles from './plan-selection.module.css'

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
  const [mobilePlan, setMobilePlan] = useState<UpgradePlan>(baseVisible && currentPlan === 'base' ? 'base' : currentPlan === 'lite' || liteTrialEligible ? 'lite' : 'free')
  const [previewState, setPreviewState] = useState<{
    feature: UpgradeFeature | null
    planTier: UpgradePlan
    returnFocusElement: HTMLElement | null
  }>({
    feature: null,
    planTier: 'free',
    returnFocusElement: null,
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

  const handleOpenPreview = (feature: UpgradeFeature, planTier: UpgradePlan, trigger?: HTMLElement) => {
    setPreviewState({ feature, planTier, returnFocusElement: trigger ?? null })
  }

  const handleClosePreview = () => {
    setPreviewState({ feature: null, planTier: 'free', returnFocusElement: null })
  }

  return (
    <div className={styles.chooser}>
      <div className={cn(styles.intro, 'mx-auto max-w-3xl text-center')}>
        <h1 className="text-3xl font-semibold leading-tight text-ink sm:text-4xl">
          <span className="hidden md:inline">{planSelectionText(language, 'title')}</span>
          <span className="md:hidden">{upgradeText(language, 'title')}</span>
        </h1>
        <p className="mx-auto max-w-2xl text-base leading-relaxed text-subtle">
          {baseVisible ? upgradeText(language, 'upgradeSubtitle') : planSelectionText(language, 'subtitle')}
        </p>
      </div>

      <div className={cn(styles.mobilePlans, baseVisible && styles.basePlanControls)} role="group" aria-label={upgradeText(language, 'title')}>
        {(['free', 'lite', ...(baseVisible ? ['base'] : [])] as UpgradePlan[]).map(plan => (
          <Button key={plan} type="button" variant={mobilePlan === plan ? 'default' : 'outline'} aria-pressed={mobilePlan === plan} onClick={() => setMobilePlan(plan)}>
            Weavly {plan === 'free' ? 'Free' : plan === 'lite' ? 'Lite' : 'Base'}
          </Button>
        ))}
      </div>

      {/* Payment Recovery / In-progress notice */}
      {paymentRecovery && (
        <Dialog defaultOpen>
          <DialogTrigger asChild><Button variant="outline" className="min-h-[44px] shrink-0 self-center">{planSelectionText(language, 'paymentStatus')}</Button></DialogTrigger>
          <DialogContent mobilePresentation="center" showCloseButton={false} aria-describedby={undefined}>
            <DialogTitle>{planSelectionText(language, 'paymentStatus')}</DialogTitle>
            {paymentRecovery}
            <DialogClose asChild><Button size="lg" className="min-h-[44px] justify-self-end">{planSelectionText(language, 'close')}</Button></DialogClose>
          </DialogContent>
        </Dialog>
      )}

      {/* Error alert */}
      <Dialog open={Boolean(error)} onOpenChange={open => { if (!open) setError('') }}>
        <DialogContent mobilePresentation="center" showCloseButton={false} onCloseAutoFocus={event => { event.preventDefault(); document.getElementById('continue-free-btn')?.focus() }}>
          <DialogTitle>{planSelectionText(language, 'activationError')}</DialogTitle>
          <DialogDescription role="alert">{tx(error)}</DialogDescription>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void finish('paid')}
            disabled={busy}
          >
            {tx('Check activation and continue')}
          </Button>
          <DialogClose asChild><Button size="lg" className="min-h-[44px]">{planSelectionText(language, 'close')}</Button></DialogClose>
        </DialogContent>
      </Dialog>

      {/* Pricing grid: three columns when Base is visible, otherwise Free and Lite only */}
      <div className={cn(styles.cards, baseVisible && styles.baseCards, "mx-auto grid w-full grid-cols-1 gap-4", baseVisible ? "max-w-7xl lg:grid-cols-3" : "max-w-6xl md:grid-cols-2")}>
        <div className={cn(styles.cardSlot, mobilePlan !== 'free' && styles.mobileHidden)}>
          <PlanCard
            planTier="free"
            currentPlan={currentPlan}
            isOnboarding={isOnboarding}
            freeAvailable={freeAvailable}
            billingReady={billingReady}
            busy={busy}
            onSelectFree={() => void finish('free')}
            onOpenPreview={handleOpenPreview}
          />
        </div>

        <div className={cn(styles.cardSlot, mobilePlan !== 'lite' && styles.mobileHidden)}>
          <PlanCard
            planTier="lite"
            currentPlan={currentPlan}
            isOnboarding={isOnboarding}
            freeAvailable={freeAvailable}
            billingReady={billingReady}
            busy={busy}
            onSelectFree={() => void finish('free')}
            onOpenPreview={handleOpenPreview}
            liteTrialEligible={liteTrialEligible}
          />
        </div>

        {baseVisible && (
          <div className={cn(styles.cardSlot, mobilePlan !== 'base' && styles.mobileHidden)}>
            <PlanCard
              planTier="base"
              currentPlan={currentPlan}
              isOnboarding={isOnboarding}
              freeAvailable={freeAvailable}
              billingReady={billingReady}
              busy={busy}
              onSelectFree={() => void finish('free')}
              onOpenPreview={handleOpenPreview}
            />
          </div>
        )}
      </div>

      <PlanTrustTiles mobileCompact={mobileCompact} />

      {/* Enlarged Feature Preview Modal */}
      <PlanPreviewModal
        feature={previewState.feature}
        planTier={previewState.planTier}
        baseVisible={baseVisible}
        onClose={handleClosePreview}
        returnFocusElement={previewState.returnFocusElement}
      />
    </div>
  )
}
