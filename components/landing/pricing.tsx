import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BILLING_PLANS, BILLING_SELF_SERVE_PLAN_TIERS } from '@/lib/billing-constants'

const planDetails = {
    lite: {
        badge: 'Complete costing desk',
        description: 'Build unlimited costings, save reusable fabric qualities, and keep yarn rates current in one complete costing desk.',
        features: [
            'Unlimited costings with the complete estimator',
            'Saved costing history, reuse, and recalculation',
            'Saved qualities and textile specifications',
            'Rate Book with yarn rates linked to saved qualities',
            'Cost breakdowns, margin visibility, and Cost Sheet export',
            'Costing defaults and owner data export',
        ],
    },
    base: {
        badge: 'Costing + production',
        description: 'Everything in Lite, connected to a focused production workflow for jobs, metres, machines, piece-rate pay, advances, and settlement.',
        features: [
            'Everything in Weavly Lite',
            'Create production directly from saved costings',
            'Track planned, produced, and remaining metres',
            'Machines and daily production entries',
            'Piece-rate worker pay, advances, and basic settlement',
            'Production history with costing references',
        ],
    },
} as const

function formatRupees(paise: number) {
    return `₹${(paise / 100).toLocaleString('en-IN')}`
}

export default function LandingPricing() {
    const plans = BILLING_SELF_SERVE_PLAN_TIERS.map((tier) => ({
        ...BILLING_PLANS[tier],
        ...planDetails[tier],
    }))

    return (
        <section className="landing-section relative overflow-hidden py-20 sm:py-28 lg:py-16" id="pricing">
            <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
                <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
                    <div>
                        <p className="text-xs font-black uppercase leading-7 tracking-[0.32em] text-orange-700 dark:text-orange-500">Pricing</p>
                        <h2 className="mt-2 text-4xl font-black tracking-tight text-zinc-950 sm:text-6xl dark:text-white">
                            Start free. Add the tools your factory needs.
                        </h2>
                    </div>
                    <div className="max-w-2xl lg:ml-auto">
                        <p className="text-lg leading-8 text-zinc-700 dark:text-zinc-300">
                            Free covers occasional costings. Lite gives you unlimited costings, reusable qualities, and Rate Book. Base adds owner-led production and piece-rate worker settlement.
                        </p>
                        <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
                            Paid plans include 18% GST and 365 days of access. Renewal is manual, with no automatic charge, and opens during the final 30 days of the current paid period.
                        </p>
                    </div>
                </div>

                <div className="mx-auto mt-10 grid max-w-7xl gap-6 lg:grid-cols-3">
                    <article id="pricing-free" aria-labelledby="pricing-free-title" className="flex min-w-0 flex-col border border-zinc-200 bg-white/95 p-6 sm:p-8">
                        <p className="text-sm font-bold text-zinc-600">For occasional costings</p>
                        <h3 id="pricing-free-title" className="mt-2 text-3xl font-black text-zinc-950">Weavly Free</h3>
                        <p className="mt-4 text-sm leading-6 text-zinc-700 lg:min-h-32 xl:min-h-24">Get a reliable fabric cost, keep the completed record, and export a Cost Sheet without a subscription fee.</p>
                        <div className="mt-7 border border-zinc-200 bg-zinc-50 p-5 lg:min-h-44">
                            <p className="text-sm font-bold text-zinc-600">No subscription fee</p>
                            <p className="mt-3 text-5xl font-black tracking-tight text-zinc-950">₹0</p>
                            <p className="mt-2 text-sm text-zinc-600">No card required. No paid trial countdown.</p>
                        </div>
                        <div className="mt-3 border border-zinc-200 p-5 lg:min-h-40">
                            <p className="text-sm font-bold text-zinc-950">2 costings per week</p>
                            <p className="mt-2 text-sm leading-6 text-zinc-600">Resets every Monday at 12:00 am IST. Unused costings do not roll over.</p>
                        </div>
                        <Button asChild variant="outline" className="mt-6 w-full rounded-md border-zinc-300 bg-white py-6 font-bold text-zinc-950 hover:bg-zinc-100">
                            <Link href="/signup?plan=free">Start with Free</Link>
                        </Button>
                        <ul className="mt-7 space-y-3 text-sm leading-6 text-zinc-700">
                            {[
                                'Complete fabric cost and selling-price calculation',
                                'Successful costings saved automatically',
                                'View saved breakdowns and export Cost Sheets',
                                'Viewing and export use no weekly allowance',
                                'Guided walkthrough with example data',
                            ].map((feature) => (
                                <li key={feature} className="flex gap-3">
                                    <Check className="mt-0.5 h-5 w-5 flex-none text-orange-600" aria-hidden="true" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                        <p className="mt-6 border-t border-zinc-200 pt-5 text-sm leading-6 text-zinc-600">Reusable qualities and Rate Book start with Lite. Production and worker settlement require Base.</p>
                    </article>
                    {plans.map((plan) => {
                        const firstYearBase = formatRupees(plan.firstYearBasePaise)
                        const firstYearGst = formatRupees(plan.firstYearGstPaise)
                        const firstYearTotal = formatRupees(plan.firstYearTotalPaise)
                        const renewalBase = formatRupees(plan.renewalBasePaise)
                        const renewalGst = formatRupees(plan.renewalGstPaise)
                        const renewalTotal = formatRupees(plan.renewalTotalPaise)

                        return (
                            <article
                                key={plan.tier}
                                aria-labelledby={`pricing-${plan.tier}-title`}
                                className="flex min-w-0 flex-col border border-orange-300 bg-orange-50/80 p-6 shadow-[0_30px_90px_rgba(154,52,18,0.14)] backdrop-blur sm:p-8"
                            >
                                <p className="text-sm font-bold text-orange-700">{plan.badge}</p>
                                <h3 id={`pricing-${plan.tier}-title`} className="mt-2 text-3xl font-black text-zinc-950">{plan.name}</h3>
                                <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-700 lg:min-h-32 xl:min-h-24">{plan.description}</p>

                                <div className="mt-7 grid gap-3">
                                    <div className="border border-orange-200 bg-white/70 p-5 lg:min-h-44">
                                        <p className="text-sm font-bold text-orange-700">First year</p>
                                        <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
                                            <span className="text-5xl font-black tracking-tight text-zinc-950">{firstYearTotal}</span>
                                            <span className="text-sm font-semibold text-zinc-600">total</span>
                                        </p>
                                        <p className="mt-2 text-sm leading-6 text-zinc-600">{firstYearBase} + {firstYearGst} GST = {firstYearTotal}</p>
                                    </div>
                                    <div className="border border-orange-300 bg-orange-100/60 p-5 lg:min-h-40">
                                        <p className="text-sm font-bold text-orange-700">Renewal from year 2</p>
                                        <p className="mt-3 flex flex-wrap items-baseline gap-x-1">
                                            <span className="text-3xl font-black tracking-tight text-zinc-950">{renewalTotal}</span>
                                            <span className="text-sm font-semibold text-zinc-600">total / year</span>
                                        </p>
                                        <p className="mt-2 text-sm leading-6 text-zinc-600">{renewalBase} + {renewalGst} GST</p>
                                    </div>
                                </div>

                                <Button asChild className="mt-6 w-full rounded-md bg-orange-600 py-6 font-bold text-white shadow-md shadow-orange-500/20 hover:bg-orange-700">
                                    <Link href={`/signup?plan=${plan.tier}`}>Choose {plan.name}</Link>
                                </Button>

                                <ul className="mt-7 space-y-3 text-sm leading-6 text-zinc-700">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex gap-3">
                                            <Check className="mt-0.5 h-5 w-5 flex-none text-orange-600" aria-hidden="true" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-6 border-t border-orange-200 pt-5 text-sm leading-6 text-zinc-700">
                                    {plan.tier === 'lite' ? 'For a complete costing desk. Production and worker settlement require Base.' : 'For owner-led production. Separate supervisor accounts and statutory payroll are outside this plan.'}
                                </p>
                            </article>
                        )
                    })}
                </div>

                <div className="mx-auto mt-5 flex max-w-6xl flex-col gap-2 border border-orange-200 bg-orange-50/80 px-5 py-4 text-sm text-zinc-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-zinc-300">
                    <p><span className="font-bold text-zinc-950 dark:text-white">One factory workspace per plan.</span> Start with Free and choose a paid plan when you need more. Broader ERP modules are outside the current catalog.</p>
                    <p>Free calculations, saving, and Cost Sheet exports need an internet connection. Read the <Link href="/terms" className="font-semibold text-orange-700 underline underline-offset-4">Terms of Service</Link>, <Link href="/privacy" className="font-semibold text-orange-700 underline underline-offset-4">Privacy Policy</Link>, and <Link href="/refund-policy" className="font-semibold text-orange-700 underline underline-offset-4">Refund Policy</Link> before choosing a plan.</p>
                </div>
            </div>
        </section>
    )
}
