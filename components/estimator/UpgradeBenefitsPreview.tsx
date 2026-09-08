'use client'

import {useRef, useState} from 'react'
import dynamic from 'next/dynamic'
import {BILLING_PLANS, type PurchasablePlanTier} from '@/lib/billing-constants'
import {Button} from '@/components/ui/button'
import {useTranslation} from '@/lib/i18n/context'
import {freeText, type FreeText} from '@/lib/i18n/free-tier'

const SubscribeButton = dynamic(() => import('@/components/billing/SubscribeButton').then(module => module.SubscribeButton))

/** Fixed examples only: this preview neither reads paid data nor runs a calculation. */
export function UpgradeBenefitsPreview({onActivated}: {onActivated: () => void}) {
  const {language} = useTranslation()
  const [updated, setUpdated] = useState(false)
  const [showPricing, setShowPricing] = useState(false)
  const upgradeEventId = useRef<Partial<Record<PurchasablePlanTier, string>>>({})
  const t = (key: FreeText, values: Record<string, string | number> = {}) => freeText(language, key, values)

  return <details className="rounded-lg border border-indigo-100 bg-indigo-50/40 text-slate-800">
    <summary className="cursor-pointer rounded-lg p-3 focus-visible:outline-2 focus-visible:outline-indigo-600">
      <span className="font-semibold">{t('liteHeadline')}</span>
      <span className="mt-1 block text-sm">{t('planSummary')}</span>
      <span className="mt-2 block text-sm font-medium text-indigo-700 underline">{t('planExplore')}</span>
    </summary>
    <div className="space-y-4 border-t border-indigo-100 p-3 sm:p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><h3 className="font-semibold">{t('liteUnlimited')}</h3><p className="mt-1 text-sm">{t('liteUnlimitedBody')}</p></div>
        <div><h3 className="font-semibold">{t('liteReuse')}</h3><p className="mt-1 text-sm">{t('liteReuseBody')}</p></div>
      </div>
      <div>
        <h3 className="font-semibold">{t('liteRateTitle')}</h3>
        <p className="mt-1 text-sm">{t('liteRateBody')}</p>
      </div>
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-xs text-slate-600">{t('liteDemo')}</p>
        <p className="text-sm font-medium">{t('liteYarn')} <span className="font-bold">₹{updated ? 220 : 200}</span></p>
        <Button type="button" variant="outline" className="h-auto whitespace-normal text-left" onClick={() => setUpdated(!updated)}>{t(updated ? 'liteReplay' : 'liteUpdate')}</Button>
        <div aria-live="polite" aria-atomic="true" className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-3">
            {[1, 2, 3].map(number => <div key={number} className={`rounded-md border p-2 text-sm ${updated ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
              <p>{t('liteQuality', {number})}</p><p className="font-semibold">₹{updated ? 220 : 200}/kg</p>
            </div>)}
          </div>
          {updated && <p className="text-sm text-emerald-800">{t('liteUpdated')}</p>}
        </div>
        <p className="text-xs text-slate-600">{t('liteHistory')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(['lite', 'base'] as const).map(tier => <section key={tier} className="flex flex-col gap-3 rounded-lg border border-indigo-100 bg-white p-4" aria-label={BILLING_PLANS[tier].name}>
          <div><h3 className="text-lg font-semibold">{BILLING_PLANS[tier].name}</h3><p className="mt-1 text-sm">{t(tier === 'lite' ? 'planLiteFit' : 'planBaseFit')}</p></div>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>{t('planCosting')}</li>
            <li>{t('planQualities')}</li>
            {tier === 'base' && <><li>{t('planProduction')}</li><li>{t('planPayroll')}</li></>}
          </ul>
          {showPricing && <div className="mt-auto space-y-3" onClickCapture={event => {
            if (event.target instanceof Element && event.target.closest(`#subscribe-btn-${tier}`)) {
              upgradeEventId.current[tier] ??= crypto.randomUUID()
              void fetch('/api/free/events', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({eventId: upgradeEventId.current[tier], name: 'upgrade_started', language, entryPoint: 'billing'})}).catch(() => {})
            }
          }}>
            <p className="text-sm font-medium">{t('price', {
              first: new Intl.NumberFormat(`${language}-IN`, {style: 'currency', currency: 'INR', maximumFractionDigits: 0}).format(BILLING_PLANS[tier].firstYearTotalPaise / 100),
              renewal: new Intl.NumberFormat(`${language}-IN`, {style: 'currency', currency: 'INR', maximumFractionDigits: 0}).format(BILLING_PLANS[tier].renewalTotalPaise / 100),
            })}</p>
            <SubscribeButton planTier={tier} buttonLabel={t(tier === 'lite' ? 'upgradeButton' : 'upgradeBaseButton')} onSuccess={onActivated}/>
          </div>}
        </section>)}
      </div>
      <Button type="button" variant="outline" aria-expanded={showPricing} onClick={() => setShowPricing(!showPricing)}>{t('planPrices')}</Button>
    </div>
  </details>
}
