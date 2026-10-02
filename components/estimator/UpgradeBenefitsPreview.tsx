'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BILLING_PLANS, type PurchasablePlanTier } from '@/lib/billing-constants'
import { Button } from '@/components/ui/button'
import { UpgradeWall } from '@/components/billing/UpgradeWall'
import { useTranslation } from '@/lib/i18n/context'
import { freeText } from '@/lib/i18n/free-tier'
import { upgradeText } from '@/lib/upgrade-wall'

const SubscribeButton = dynamic(() => import('@/components/billing/SubscribeButton').then(module => module.SubscribeButton))

/** Keep the estimator mounted while exploring plans and completing checkout. */
export function UpgradeBenefitsPreview({ onActivated }: { onActivated: () => void }) {
  const { language } = useTranslation()
  const [open, setOpen] = useState(false)
  const summaryRef = useRef<HTMLElement>(null)
  const upgradeEventId = useRef<Partial<Record<PurchasablePlanTier, string>>>({})
  const format = (paise: number) => new Intl.NumberFormat(`${language}-IN`, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100)
  const paidAction = (tier: PurchasablePlanTier) => <>
    <div className="space-y-1">
      <p><span className="text-3xl font-bold tracking-tight text-ink">{format(BILLING_PLANS[tier].firstYearTotalPaise)}</span><span className="ml-2 text-sm text-subtle">/ {upgradeText(language, 'firstYear')}</span></p>
      <p className="text-sm text-body">{upgradeText(language, 'renewal', { amount: format(BILLING_PLANS[tier].renewalTotalPaise) })}</p>
      <p className="text-xs text-subtle">{upgradeText(language, 'tax')}</p>
    </div>
    <div onClickCapture={event => {
      if (event.target instanceof Element && event.target.closest(`#subscribe-btn-${tier}`)) {
        upgradeEventId.current[tier] ??= crypto.randomUUID()
        void fetch('/api/free/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: upgradeEventId.current[tier], name: 'upgrade_started', language, entryPoint: 'billing' }) }).catch(() => {})
      }
    }}>
      <SubscribeButton planTier={tier} buttonLabel={freeText(language, tier === 'lite' ? 'upgradeButton' : 'upgradeBaseButton')} onSuccess={() => { setOpen(false); onActivated() }} />
    </div>
  </>

  return <details open={open} onToggle={event => setOpen(event.currentTarget.open)} className="ui-details overflow-hidden rounded-xl border border-saffron/30 bg-saffron-soft/40">
    <summary ref={summaryRef} className="flex cursor-pointer list-none flex-col gap-3 p-4 outline-none focus-visible:ring-2 focus-visible:ring-saffron sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
      <span><span className="block font-semibold text-ink">{freeText(language, 'liteHeadline')}</span><span className="mt-1 block text-sm text-body">{freeText(language, 'planSummary')}</span></span>
      <span className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-loom px-4 py-2 text-sm font-semibold text-white">{upgradeText(language, 'title')}<ArrowRight className="size-4" aria-hidden="true" /></span>
    </summary>
    {open && <div className="border-t border-saffron/20 bg-surface-soft p-3 sm:p-5">
      <UpgradeWall currentPlan="free" actions={{
        free: <><div className="space-y-1"><p className="text-3xl font-bold tracking-tight text-ink">{format(0)}</p><p className="text-sm text-body">{upgradeText(language, 'freePrice')}</p></div><Button type="button" variant="outline" className="w-full" onClick={() => { setOpen(false); summaryRef.current?.focus() }}>{upgradeText(language, 'continueFree')}</Button></>,
        lite: paidAction('lite'),
        base: paidAction('base'),
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
