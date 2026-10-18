import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BILLING_PLANS, BILLING_SELF_SERVE_PLAN_TIERS } from '@/lib/billing-constants'
import { BASE_PLAN_OPEN_TO_NEW_ACCOUNTS } from '@/lib/base-plan-visibility'
import { LITE_TRIAL_DAYS } from '@/lib/lite-trial'
import { Beam } from './beam'
import s from './landing.module.css'

const summaries = {
    lite: 'Unlimited costings, reusable qualities and the Yarn Rate Book.',
    base: 'Everything in Lite, plus production, stock, dispatch and piece-rate pay.',
} as const

function formatRupees(paise: number) {
    return `₹${(paise / 100).toLocaleString('en-IN')}`
}

const terms = [
    'New accounts get a three-month Lite free trial. No payment is needed to start it.',
    'Paid prices include 18% GST and cover 365 days.',
    'No automatic charge. Renew by hand in the last 30 days.',
    'Free resets on the 1st of each month, 12:00 am IST. No rollover.',
    'Free needs an internet connection to calculate, save and export.',
]

export default function LandingPricing() {
    // Base is not offered while the launch switch is closed: no card and no signup CTA.
    const offered = BILLING_SELF_SERVE_PLAN_TIERS.filter((tier) => tier !== 'base' || BASE_PLAN_OPEN_TO_NEW_ACCOUNTS)
    const plans = offered.map((tier) => ({ ...BILLING_PLANS[tier], summary: summaries[tier] }))

    return (
        <Beam id="pricing" labelledBy="pricing-title" innerClassName="pb-20 pt-14 sm:pb-24 sm:pt-16 lg:pb-28">
            <h2 id="pricing-title" className={cn(s.label, 'text-[color:var(--lp-saffron-ink)]')}>Pricing</h2>

            <div className={cn('mt-4 grid border-y-2 border-[color:var(--lp-ink)]', BASE_PLAN_OPEN_TO_NEW_ACCOUNTS ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
                <article aria-labelledby="pricing-free-title" className="flex min-w-0 flex-col border-b border-[color:var(--lp-line)] py-7 md:border-b-0 md:border-r md:pr-7">
                    <h3 id="pricing-free-title" className={cn(s.display, 'text-[22px] font-semibold text-[color:var(--lp-ink)]')}>Weavly Free</h3>
                    <p className="mt-2 text-[15px] leading-6 text-[color:var(--lp-body)]">Two costings a month, saved, with Cost Sheet export.</p>
                    <p className="mt-6 flex items-baseline gap-2">
                        <span className={cn(s.figure, 'text-[44px] font-semibold leading-none text-[color:var(--lp-ink)]')}>₹0</span>
                        <span className="text-[14px] text-[color:var(--lp-muted)]">no subscription fee</span>
                    </p>
                    <p className="mt-3 text-[14px] leading-6 text-[color:var(--lp-muted)]">No card required. No annual renewal.</p>
                    <div className="mt-auto pt-7">
                        <Link href="/signup?plan=free" className={cn(s.secondary, 'w-full')}>
                            Start with Free
                        </Link>
                    </div>
                </article>

                {plans.map((plan, index) => (
                    <article
                        key={plan.tier}
                        aria-labelledby={`pricing-${plan.tier}-title`}
                        className={cn(
                            'flex min-w-0 flex-col py-7',
                            index < plans.length - 1 ? 'border-b border-[color:var(--lp-line)] md:border-b-0 md:border-r md:px-7' : 'md:pl-7',
                        )}
                    >
                        <h3 id={`pricing-${plan.tier}-title`} className={cn(s.display, 'text-[22px] font-semibold text-[color:var(--lp-ink)]')}>{plan.name}</h3>
                        <p className="mt-2 text-[15px] leading-6 text-[color:var(--lp-body)]">{plan.summary}</p>
                        {plan.tier === 'lite' && (
                            <p className="mt-3 text-[15px] font-semibold leading-6 text-[color:var(--lp-ink)]">First three months free for new accounts</p>
                        )}
                        <div className="mt-6">
                            <p className={cn(s.label, 'text-[color:var(--lp-muted)]')}>First year</p>
                            <p className="mt-1 flex items-baseline gap-2">
                                <span className={cn(s.figure, 'text-[44px] font-semibold leading-none text-[color:var(--lp-ink)]')}>{formatRupees(plan.firstYearTotalPaise)}</span>
                                <span className="text-[14px] text-[color:var(--lp-muted)]">total</span>
                            </p>
                            <p className={cn(s.figure, 'mt-2 text-[13px] text-[color:var(--lp-muted)]')}>
                                {formatRupees(plan.firstYearBasePaise)} + {formatRupees(plan.firstYearGstPaise)} GST
                            </p>
                        </div>
                        <div className="mt-5 border-t border-[color:var(--lp-line)] pt-4">
                            <p className={cn(s.label, 'text-[color:var(--lp-muted)]')}>Renewal from year 2</p>
                            <p className="mt-1 flex items-baseline gap-2">
                                <span className={cn(s.figure, 'text-[24px] font-semibold leading-none text-[color:var(--lp-ink)]')}>{formatRupees(plan.renewalTotalPaise)}</span>
                                <span className="text-[14px] text-[color:var(--lp-muted)]">total a year</span>
                            </p>
                            <p className={cn(s.figure, 'mt-2 text-[13px] text-[color:var(--lp-muted)]')}>
                                {formatRupees(plan.renewalBasePaise)} + {formatRupees(plan.renewalGstPaise)} GST
                            </p>
                        </div>
                        <div className="mt-auto pt-7">
                            <Link href={`/signup?plan=${plan.tier}`} className={cn(plan.tier === 'lite' ? s.primary : s.secondary, 'w-full')}>
                                {plan.tier === 'lite' ? 'Start 3-month free trial' : <>Choose {plan.name}</>}
                                {plan.tier === 'lite' && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                            </Link>
                            {plan.tier === 'lite' && (
                                <p className="mt-3 text-[13px] leading-5 text-[color:var(--lp-muted)]">
                                    {`No payment to start. After ${LITE_TRIAL_DAYS} days, pay to stay on Lite or continue on Free.`}
                                </p>
                            )}
                        </div>
                    </article>
                ))}
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16">
                <ul className="grid list-none gap-2.5 sm:grid-cols-2 sm:gap-x-10">
                    {terms.map((term) => (
                        <li key={term} className="flex gap-3 text-[14px] leading-6 text-[color:var(--lp-body)]">
                            <span className="mt-[11px] h-px w-3 flex-none bg-[color:var(--lp-ink)]" aria-hidden="true" />
                            {term}
                        </li>
                    ))}
                </ul>
                <p className="text-[14px] leading-6 text-[color:var(--lp-muted)]">
                    Read the <Link href="/terms" className={s.textLink}>Terms of Service</Link>,{' '}
                    <Link href="/privacy" className={s.textLink}>Privacy Policy</Link> and{' '}
                    <Link href="/refund-policy" className={s.textLink}>Refund Policy</Link> before choosing a plan.
                </p>
            </div>
        </Beam>
    )
}
