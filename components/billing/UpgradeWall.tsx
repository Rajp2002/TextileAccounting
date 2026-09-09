'use client'

import Image from 'next/image'
import { useId, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useTranslation } from '@/lib/i18n/context'
import { BILLING_PLANS } from '@/lib/billing-constants'
import { UPGRADE_PLAN_FEATURES, UPGRADE_FEATURE_IMAGES, upgradeFeatureBullets, upgradeText, type UpgradePlan } from '@/lib/upgrade-wall'

function FeaturePlanCard({ plan, current, children }: { plan: UpgradePlan; current: boolean; children?: ReactNode }) {
  const { language } = useTranslation()
  const [index, setIndex] = useState(0)
  const [pictureOpen, setPictureOpen] = useState(false)
  const swiped = useRef(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const id = useId()
  const features = UPGRADE_PLAN_FEATURES[plan]
  const feature = features[index]
  const picture = UPGRADE_FEATURE_IMAGES[feature]
  const t = (key: Parameters<typeof upgradeText>[1], values?: Record<string, string | number>) => upgradeText(language, key, values)
  const name = plan === 'free' ? 'Free' : plan === 'lite' ? 'Lite' : 'Base'
  const format = (paise: number) => new Intl.NumberFormat(`${language}-IN`, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100)
  const move = (direction: number) => setIndex(value => (value + direction + features.length) % features.length)

  return (
    <article aria-labelledby={`${id}-plan`} className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-surface shadow-[var(--shadow-card)] ${plan === 'lite' ? 'border-saffron/60' : 'border-hairline'}`}>
      <div className={`h-1.5 ${plan === 'free' ? 'bg-slate-300' : plan === 'lite' ? 'bg-saffron' : 'bg-loom'}`} />
      <header data-i18n-skip="true" className="px-5 pb-4 pt-5">
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
          <h3 id={`${id}-plan`} className="text-2xl font-bold tracking-tight text-ink">{name}</h3>
          {current && <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">{t('current')}</span>}
        </div>
        <p className="mt-2 text-sm text-body">{t(plan === 'free' ? 'freeFit' : plan === 'lite' ? 'liteFit' : 'baseFit')}</p>
      </header>

      <section
        data-i18n-skip="true"
        aria-label={`${name} — ${t('featureCount', { current: index + 1, total: features.length })}`}
        aria-roledescription="carousel"
        className="mx-4 rounded-xl border border-hairline bg-surface-soft outline-none focus-visible:ring-2 focus-visible:ring-saffron"
        tabIndex={0}
        onKeyDown={event => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault()
            move(event.key === 'ArrowRight' ? 1 : -1)
          }
        }}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <h4 id={`${id}-feature`} className="text-sm font-semibold text-ink">{t(feature)}</h4>
          <span className="shrink-0 rounded-md border border-hairline bg-surface px-2 py-1 text-xs font-semibold tabular-nums text-body" aria-hidden="true">{index + 1}/{features.length}</span>
        </div>
        <div
          className="relative touch-pan-y"
          onTouchStart={event => {
            swiped.current = false
            const touch = event.touches[0]
            touchStart.current = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null
          }}
          onTouchEnd={event => {
            const start = touchStart.current
            touchStart.current = null
            const touch = event.changedTouches[0]
            if (!start || !touch) return
            const dx = touch.clientX - start.x
            const dy = touch.clientY - start.y
            if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
              swiped.current = true
              move(dx < 0 ? 1 : -1)
            }
          }}
          onTouchCancel={() => { touchStart.current = null }}
        >
          <Dialog open={pictureOpen} onOpenChange={value => { if (!value || !swiped.current) setPictureOpen(value) }}>
            <DialogTrigger asChild>
              <button type="button" aria-label={`${name}: ${t('enlarge')} — ${t(feature)}`} className="group relative block w-full cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-saffron" onPointerDown={event => { if (event.pointerType !== 'touch') swiped.current = false }} onKeyDown={() => { swiped.current = false }}>
                <Image src={picture.src} alt={t('picture', { feature: t(feature) })} width={picture.width} height={picture.height} sizes="(min-width: 1280px) 340px, 90vw" draggable={false} className="aspect-[16/11] w-full select-none object-contain" />
                <span className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-md border border-hairline bg-surface/95 px-2 py-1 text-xs font-medium text-ink"><Maximize2 className="size-3" aria-hidden="true" />{t('enlarge')}</span>
              </button>
            </DialogTrigger>
            <DialogContent data-i18n-skip="true" className="sm:max-w-6xl" showCloseButton={false} aria-describedby={undefined}>
              <DialogHeader><div className="flex items-center justify-between gap-3"><DialogTitle>{t(feature)}</DialogTitle><Button variant="ghost" onClick={() => setPictureOpen(false)}>{t('close')}</Button></div></DialogHeader>
              <Image src={picture.src} alt={t('picture', { feature: t(feature) })} width={picture.width} height={picture.height} sizes="90vw" className="max-h-[75dvh] w-full rounded-lg object-contain" />
              <p className="text-sm text-subtle">{t('sample')}</p>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex items-center justify-between gap-1 px-2 py-1">
          <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={`${name}: ${t('previous')}`} aria-controls={`${id}-details`} onClick={() => move(-1)}><ChevronLeft aria-hidden="true" /></Button>
          <div className="flex flex-wrap justify-center" aria-label={t('featureCount', { current: index + 1, total: features.length })}>
            {features.map((item, position) => <button type="button" key={item} onClick={() => setIndex(position)} aria-label={`${name}: ${t(item)}`} aria-current={index === position ? 'true' : undefined} className="flex size-7 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-saffron"><span className={`h-1.5 rounded-full transition-[width] motion-reduce:transition-none ${index === position ? 'w-5 bg-saffron-deep' : 'w-1.5 bg-subtle/40'}`} /></button>)}
          </div>
          <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={`${name}: ${t('next')}`} aria-controls={`${id}-details`} onClick={() => move(1)}><ChevronRight aria-hidden="true" /></Button>
        </div>
        <p className="px-3 pb-3 text-center text-xs text-subtle">{t('sample')}</p>
      </section>

      <div data-i18n-skip="true" id={`${id}-details`} aria-live="polite" aria-atomic="true" className="flex-1 px-5 py-5">
        <span className="sr-only">{t(feature)}. {t('featureCount', { current: index + 1, total: features.length })}</span>
        <ul className="space-y-3">
          {upgradeFeatureBullets(plan, feature).map(key => <li key={key} className="flex items-start gap-2.5 text-sm leading-6 text-body"><Check className="mt-1 size-4 shrink-0 text-saffron-deep" aria-hidden="true" /><span>{t(key)}</span></li>)}
        </ul>
      </div>

      <footer data-i18n-skip={children ? undefined : "true"} className="space-y-4 border-t border-hairline bg-surface-soft/50 p-5">
        {children ?? <>
          <div className="space-y-1">
            <p><span className="text-3xl font-bold tracking-tight text-ink">{plan === 'free' ? format(0) : format(BILLING_PLANS[plan].firstYearTotalPaise)}</span>{plan !== 'free' && <span className="ml-2 text-sm text-subtle">/ {t('firstYear')}</span>}</p>
            <p className="text-sm text-body">{plan === 'free' ? t('freePrice') : t('renewal', { amount: format(BILLING_PLANS[plan].renewalTotalPaise) })}</p>
            {plan !== 'free' && <p className="text-xs text-subtle">{t('tax')}</p>}
          </div>
          <Button type="button" variant="outline" disabled className="w-full">{t(current ? 'current' : 'comparison')}</Button>
        </>}
      </footer>
    </article>
  )
}

/** Feature exploration is local UI state. Purchase eligibility stays with the caller. */
export function UpgradeWall({ currentPlan, actions, showHeading = true }: {
  currentPlan?: string
  actions?: Partial<Record<UpgradePlan, ReactNode>>
  showHeading?: boolean
}) {
  const { language } = useTranslation()
  const id = useId()
  return <section aria-label={upgradeText(language, 'title')} className="@container space-y-5">
    {showHeading && <div data-i18n-skip="true"><h2 className="text-2xl font-bold tracking-tight text-ink">{upgradeText(language, 'title')}</h2><p className="mt-2 text-sm text-body">{upgradeText(language, 'intro')}</p></div>}
    <p data-i18n-skip="true" id={id} className="text-sm text-subtle">{upgradeText(language, 'swipe')}</p>
    <div aria-describedby={id} className="grid items-stretch gap-4 @4xl:grid-cols-3">
      {(['free', 'lite', 'base'] as const).map(plan => <FeaturePlanCard key={plan} plan={plan} current={currentPlan === plan}>{actions?.[plan]}</FeaturePlanCard>)}
    </div>
  </section>
}
