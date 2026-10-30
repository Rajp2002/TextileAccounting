'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BILLING_PLANS, type PurchasablePlanTier } from '@/lib/billing-constants'
import { Button } from '@/components/ui/button'
import { UpgradeWall } from '@/components/billing/UpgradeWall'
import { StartTrialButton, TRIAL_PAY_NOW_LINK_CLASS } from '@/components/plans/StartTrialButton'
import { useTranslation } from '@/lib/i18n/context'
import { freeText } from '@/lib/i18n/free-tier'
import { liteTrialText } from '@/lib/i18n/lite-trial'
import { upgradeText } from '@/lib/upgrade-wall'

const SubscribeButton = dynamic(() => import('@/components/billing/SubscribeButton').then(module => module.SubscribeButton))

/**
 * Keep the estimator mounted while exploring plans and completing checkout.
 * Checkout defers its router refresh; `onActivated` verifies access through
 * the Free status read, which switches to the paid estimator in place.
 */
export function UpgradeBenefitsPreview({ onActivated, open: controlledOpen, onOpenChange, baseVisible = false, liteTrialEligible = false }: {
  onActivated: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Base is offered only to organizations that may see it. Defaults to hidden. */
  baseVisible?: boolean
  /** The Lite trial is offered first only to organizations that may still start it. Defaults to hidden. */
  liteTrialEligible?: boolean
}) {
  const { language } = useTranslation()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = (next: boolean) => { setUncontrolledOpen(next); onOpenChange?.(next) }
  const summaryRef = useRef<HTMLElement>(null)
  const upgradeEventId = useRef<Partial<Record<PurchasablePlanTier, string>>>({})
  const format = (paise: number) => new Intl.NumberFormat(`${language}-IN`, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100)
  const checkout = (tier: PurchasablePlanTier, buttonLabel?: string, className?: string) => <div onClickCapture={event => {
    if (event.target instanceof Element && event.target.closest(`#subscribe-btn-${tier}`)) {
      upgradeEventId.current[tier] ??= crypto.randomUUID()
      void fetch('/api/free/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: upgradeEventId.current[tier], name: 'upgrade_started', language, entryPoint: 'billing' }) }).catch(() => {})
    }
  }}>
    <SubscribeButton planTier={tier} deferRefresh interestSource="upgrade_preview" buttonLabel={buttonLabel ?? freeText(language, tier === 'lite' ? 'upgradeButton' : 'upgradeBaseButton')} className={className} onSuccess={() => { setOpen(false); onActivated() }} />
  </div>
  const paidAction = (tier: PurchasablePlanTier, trialFirst = false) => <>
    <div className="space-y-1">
      <p><span className="text-3xl font-bold tracking-tight text-ink">{format(BILLING_PLANS[tier].firstYearTotalPaise)}</span><span className="ml-2 text-sm text-subtle">/ {upgradeText(language, 'firstYear')}</span></p>
      <p className="text-sm text-body">{upgradeText(language, 'renewal', { amount: format(BILLING_PLANS[tier].renewalTotalPaise) })}</p>
      <p className="text-xs text-subtle">{upgradeText(language, 'tax')}</p>
    </div>
    {trialFirst ? <div className="space-y-2">
      <StartTrialButton className="w-full" />
      <p className="text-xs leading-relaxed text-body">{liteTrialText(language, 'trialDisclosure')}</p>
      {checkout(tier, liteTrialText(language, 'trialPayNow'), TRIAL_PAY_NOW_LINK_CLASS)}
    </div> : checkout(tier)}
  </>

  return <details open={open} onToggle={event => setOpen(event.currentTarget.open)} className="ui-details overflow-hidden rounded-xl border border-saffron/30 bg-saffron-soft/40">
    <summary ref={summaryRef} className="flex cursor-pointer list-none flex-col gap-3 p-4 outline-none focus-visible:ring-2 focus-visible:ring-saffron sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
      <span><span className="block font-semibold text-ink">{freeText(language, 'liteHeadline')}</span><span className="mt-1 block text-sm text-body">{freeText(language, baseVisible ? 'planSummary' : 'planLiteFit')}</span></span>
      <span className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-loom px-4 py-2 text-sm font-semibold text-white">{upgradeText(language, 'title')}<ArrowRight className="size-4" aria-hidden="true" /></span>
    </summary>
    {open && <div className="border-t border-saffron/20 bg-surface-soft p-3 sm:p-5">
      <UpgradeWall currentPlan="free" baseVisible={baseVisible} actions={{
        free: <><div className="space-y-1"><p className="text-3xl font-bold tracking-tight text-ink">{format(0)}</p><p className="text-sm text-body">{upgradeText(language, 'freePrice')}</p></div><Button type="button" variant="outline" className="w-full" onClick={() => { setOpen(false); summaryRef.current?.focus() }}>{upgradeText(language, 'continueFree')}</Button></>,
        lite: paidAction('lite', liteTrialEligible),
        base: baseVisible ? paidAction('base') : undefined,
      }} />
      <div className="mt-3 flex justify-end">
        <Button asChild variant="ghost" size="sm" className="gap-1 text-xs text-saffron-deep hover:text-saffron-deep">
          <Link href="/plans?from=estimator">
            <span>{upgradeText(language, 'compareAllPlans')}</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>}
  </details>
}
