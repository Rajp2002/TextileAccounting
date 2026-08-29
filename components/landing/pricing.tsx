import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BILLING_PLANS, BILLING_SELF_SERVE_PLAN_TIERS } from '@/lib/billing-constants'

const basePlanDetails = {
    badge: 'Base Plan · available now',
    description: 'A focused owner workspace that takes reliable fabric costing into a simple production job, owner-entered metres, piece-rate pay, and basic settlement without adding a full ERP.',
    features: [
        'Warp and weft cost estimator',
        'Fabric templates and saved qualities',
        'Saved costing history and draft recovery',
        'Margin, break-even, and landed-cost visibility',
        'Cost Sheet export',
        'Create production jobs from saved costings',
        'Owner-entered production metres',
        'Piece-rate worker pay and advances',
        '50% capped advance recovery and basic settlement',
        'Independent owner access',
    ],
} as const

function formatRupees(paise: number) {
    return `₹${(paise / 100).toLocaleString('en-IN')}`
}

export default function LandingPricing() {
    const plans = BILLING_SELF_SERVE_PLAN_TIERS.flatMap((tier) => {
        if (tier !== 'base') return []

        return [{
            ...BILLING_PLANS.base,
            ...basePlanDetails,
        }]
    })

    return (
        <section className="landing-section relative overflow-hidden py-20 sm:py-28 lg:py-16" id="pricing">
            <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
                <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
                    <div>
                        <p className="text-xs font-black uppercase leading-7 tracking-[0.32em] text-orange-700 dark:text-orange-500">Pricing</p>
                        <h2 className="mt-2 text-4xl font-black tracking-tight text-zinc-950 sm:text-6xl dark:text-white">
                            Start with the Base Estimator.
                        </h2>
                    </div>
                    <div className="max-w-2xl lg:ml-auto">
                        <p className="text-lg leading-8 text-zinc-700 dark:text-zinc-300">
                            The current rollout keeps the Base Plan focused: cost the fabric, run a simple production job, record output, and settle piece-rate pay from one owner workspace.
                        </p>
                        <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
                            Prices below show the GST-inclusive total and its 18% breakdown. Renewal is manual and opens 30 days before expiry. Payment receipts are provided after successful payment; GST invoices are issued only when approved billing details and supplier tax configuration are complete.
                        </p>
                    </div>
                </div>

                <div className="mx-auto mt-10 max-w-3xl">
                    {plans.map((plan) => {
                        const firstYearBase = formatRupees(plan.firstYearBasePaise)
                        const firstYearGst = formatRupees(plan.firstYearGstPaise)
                        const firstYearTotal = formatRupees(plan.firstYearTotalPaise)
                        const renewalBase = formatRupees(plan.renewalBasePaise)
                        const renewalGst = formatRupees(plan.renewalGstPaise)
                        const renewalTotal = formatRupees(plan.renewalTotalPaise)

                        return (
                            <div
                                key={plan.tier}
                                className="flex flex-col border border-orange-300 bg-orange-50/80 p-6 shadow-[0_30px_90px_rgba(154,52,18,0.14)] backdrop-blur sm:p-8"
                            >
                                <div className="flex flex-wrap items-center gap-3">
                                    <h3 className="text-2xl font-black text-zinc-950">{plan.name}</h3>
                                    <span className="border border-orange-400 bg-orange-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-orange-700">
                                        {plan.badge}
                                    </span>
                                </div>
                                <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-700">{plan.description}</p>

                                <div className="mt-7 grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
                                    <div className="border border-orange-200 bg-white/70 p-5">
                                        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">First year</p>
                                        <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
                                            <span className="text-5xl font-black tracking-tight text-zinc-950">{firstYearTotal}</span>
                                            <span className="text-sm font-semibold text-zinc-600">total</span>
                                        </p>
                                        <p className="mt-2 text-xs text-zinc-600">{firstYearBase} + {firstYearGst} GST = {firstYearTotal}</p>
                                    </div>
                                    <div className="border border-orange-300 bg-orange-100/60 p-5">
                                        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Renewal from year 2</p>
                                        <p className="mt-3 flex flex-wrap items-baseline gap-x-1">
                                            <span className="text-3xl font-black tracking-tight text-zinc-950">{renewalTotal}</span>
                                            <span className="text-sm font-semibold text-zinc-600">total / year</span>
                                        </p>
                                        <p className="mt-2 text-xs text-zinc-600">{renewalBase} + {renewalGst} GST</p>
                                    </div>
                                </div>

                                <Button asChild className="mt-6 w-full rounded-md bg-orange-600 py-6 font-bold text-white shadow-md shadow-orange-500/20 hover:bg-orange-700">
                                    <a href="/signup">Request Base Plan access</a>
                                </Button>

                                <div className="mt-7 grid gap-3 text-sm leading-6 text-zinc-700 sm:grid-cols-2">
                                    {plan.features.map((feature) => (
                                        <div key={feature} className="flex gap-3">
                                            <Check className="mt-0.5 h-5 w-5 flex-none text-orange-600" aria-hidden="true" />
                                            <span>{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="mx-auto mt-5 flex max-w-3xl flex-col gap-2 border border-orange-200 bg-orange-50/80 px-5 py-4 text-sm text-zinc-700 sm:flex-row sm:items-center sm:justify-between dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-zinc-300">
                    <p><span className="font-bold text-zinc-950 dark:text-white">One factory included.</span> Full Suite formal orders, supervisor production, looms, inventory/stock, dispatch, fixed-worker payroll, and analytics remain separate, are in development, and are not available for purchase yet.</p>
                    <a className="shrink-0 font-bold text-orange-700 underline decoration-orange-300 underline-offset-4 hover:text-orange-800 dark:text-orange-300" href="/signup">Request access</a>
                </div>
            </div>
        </section>
    )
}
