'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { Check, ArrowRight, ShieldCheck } from 'lucide-react'
import { BrandBackground } from '@/components/brand-background'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { UpgradeWall } from '@/components/billing/UpgradeWall'
import { SubscribeButton } from '@/components/billing/SubscribeButton'
import { Button } from '@/components/ui/button'
import { BILLING_PLANS } from '@/lib/billing-constants'
import { upgradeText, type UpgradePlan } from '@/lib/upgrade-wall'
import { useTranslation } from '@/lib/i18n/context'
import { completePlanSelection } from '@/app/(auth)/onboarding/plans/actions'

export function PlanSelection({ freeAvailable, billingReady, paid, paymentRecovery }: { freeAvailable: boolean; billingReady: boolean; paid: boolean; paymentRecovery?: ReactNode }) {
    const [selected, setSelected] = useState<UpgradePlan>('free')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const { language, tx } = useTranslation()
    const format = (paise: number) => new Intl.NumberFormat(`${language}-IN`, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100)

    const finish = useCallback(async (plan: 'free' | 'paid') => {
        setBusy(true)
        setError('')
        try {
            const result = await completePlanSelection(plan)
            if (result.href) window.location.assign(result.href)
            else { setError(result.error ?? 'Please try again.'); setBusy(false) }
        } catch { setError('Unable to finish setup. Please try again.'); setBusy(false) }
    }, [])

    useEffect(() => {
        if (!paid) return
        const timer = window.setTimeout(() => { void finish('paid') }, 0)
        return () => window.clearTimeout(timer)
    }, [paid, finish])

    const action = (plan: UpgradePlan) => <>
        <div className="space-y-1">
            <p><span className="text-3xl font-bold tracking-tight text-ink">{format(plan === 'free' ? 0 : BILLING_PLANS[plan].firstYearTotalPaise)}</span>{plan !== 'free' && <span className="ml-2 text-sm text-subtle">/ {upgradeText(language, 'firstYear')}</span>}</p>
            <p className="text-sm text-body">{plan === 'free' ? upgradeText(language, 'freePrice') : upgradeText(language, 'renewal', { amount: format(BILLING_PLANS[plan].renewalTotalPaise) })}</p>
            {plan !== 'free' && <p className="text-xs text-subtle">{upgradeText(language, 'tax')}</p>}
        </div>
        <Button
            type="button"
            aria-pressed={selected === plan}
            disabled={busy || paid || (plan === 'free' && !freeAvailable)}
            variant={selected === plan ? 'default' : 'outline'}
            className="w-full gap-2"
            onClick={() => {
                setSelected(plan)
                setError('')
                if (plan === 'free' && freeAvailable) {
                    void finish('free')
                }
            }}
        >
            {selected === plan && <Check className="size-4" aria-hidden="true" />}
            {plan === 'free' && busy
                ? tx('Opening your workspace…')
                : tx(selected === plan ? `${plan === 'free' ? 'Free' : BILLING_PLANS[plan].name.replace('Weavly ', '')} selected` : `Choose ${plan === 'free' ? 'Free' : BILLING_PLANS[plan].name.replace('Weavly ', '')}`)}
        </Button>
    </>

    return <main className="relative isolate min-h-svh overflow-x-hidden bg-background px-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] sm:px-8">
        <BrandBackground />
        <div className="relative z-10 mx-auto max-w-6xl">
            <header className="flex items-center justify-between gap-4">
                <Image src="/images/WeavlyLogo.png" alt="Weavly" width={140} height={80} priority className="h-16 w-28 object-contain" />
                <LanguageSwitcher placement="bottom" className="bg-surface/90" />
            </header>
            <div className="mx-auto mb-8 mt-5 max-w-2xl text-center sm:mt-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-saffron-deep">{tx('Your account is ready')}</p>
                <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">{upgradeText(language, 'title')}</h1>
                <p className="mt-4 text-base leading-7 text-body">{tx('Start with the tools you need today. Your first cost estimate is next.')}</p>
            </div>
            <UpgradeWall showHeading={false} selectedPlan={selected} actions={{ free: action('free'), lite: action('lite'), base: action('base') }} />
            <section aria-label={tx('Continue with your plan')} className="mx-auto mt-6 max-w-xl space-y-4 rounded-2xl border border-hairline bg-surface/95 p-5 shadow-[var(--shadow-panel)] sm:p-6">
                {paymentRecovery}
                {paid ? <>
                    <p role="status" className="text-center font-semibold text-success">{tx('Your paid plan is active. Continue to your cost estimator.')}</p>
                    <Button disabled={busy} onClick={() => void finish('paid')} className="w-full">{tx(busy ? 'Opening your workspace…' : 'Continue to cost estimator')}</Button>
                </> : selected === 'free' ? <>
                    <p className="text-center text-sm text-body">{tx('No payment needed. Explore the cost estimator and your saved costings.')}</p>
                    {!freeAvailable && <p role="status" className="text-sm text-body">{tx('Free enrollment is not available for this account yet. You can choose Lite or Base to continue.')}</p>}
                    <Button disabled={busy || !freeAvailable} onClick={() => void finish('free')} className="w-full gap-2" size="lg">{tx(busy ? 'Opening your workspace…' : 'Continue with Free')}<ArrowRight className="size-4" aria-hidden="true" /></Button>
                </> : billingReady ? <SubscribeButton
                    key={selected} planTier={selected} tierName={BILLING_PLANS[selected].name}
                    displayAmount={format(BILLING_PLANS[selected].firstYearTotalPaise)}
                    buttonLabel={`Continue with ${selected === 'lite' ? 'Lite' : 'Base'} · ${format(BILLING_PLANS[selected].firstYearTotalPaise)}`}
                /> : <p role="status" className="text-center text-sm text-body">{tx('Plan payments are temporarily unavailable. Please try again shortly, or continue with Free if available.')}</p>}
                {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{tx(error)}</p>{selected !== 'free' && <Button variant="outline" disabled={busy} onClick={() => void finish('paid')}>{tx('Check activation and continue')}</Button>}</div>}
                <p className="flex items-center justify-center gap-2 text-center text-xs text-subtle"><ShieldCheck className="size-4 shrink-0" aria-hidden="true" />{tx('Secure Razorpay checkout for paid plans')}</p>
            </section>
        </div>
    </main>
}
