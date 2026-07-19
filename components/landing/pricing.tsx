import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BILLING_PLANS, type PurchasablePlanTier } from '@/lib/billing-constants'

const planDetails: Record<PurchasablePlanTier, {
    badge: string
    description: string
    features: string[]
}> = {
    base: {
        badge: 'Costing desk',
        description: 'For owners who want reliable Cost Estimates, Quotation history, and margin control without moving factory-floor operations yet.',
        features: [
            'Warp Yarn and Weft Yarn Cost Estimate',
            'Fabric templates and saved qualities',
            'Quotation history and draft recovery',
            'Margin and landed-cost visibility',
            'Independent owner access',
        ],
    },
    premium: {
        badge: 'Complete factory',
        description: 'For factories ready to connect Quotations, Machines, shift logs, Godown Stock, dispatches, Worker Hisaab, and owner visibility.',
        features: [
            'Everything in Weavly Cost Estimate',
            'Production and order tracking',
            'Metres Produced This Shift logs',
            'Market Runs and Godown Stock',
            'Dispatches and sale records',
            'Worker Hisaab and Upaad',
            'Operational analytics for owners',
            'Unlimited machines and workers',
        ],
    },
}

function formatRupees(paise: number) {
    return `₹${(paise / 100).toLocaleString('en-IN')}`
}

export default function LandingPricing() {
    const plans = (['base', 'premium'] as const).map((tier) => ({
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
                            Pay for the first year. Renew for less.
                        </h2>
                    </div>
                    <div className="max-w-2xl lg:ml-auto">
                        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-300">
                            Start with Cost Estimate or bring the full factory workflow into Weavly. Both plans include a full year of access, with a lower annual renewal from year two.
                        </p>
                        <p className="mt-3 text-sm text-zinc-400 dark:text-zinc-500">
                            Start with a 7-day Premium trial. Prices below show 18% GST separately and include one factory.
                        </p>
                    </div>
                </div>

                <div className="mt-10 grid gap-5 lg:grid-cols-2">
                    {plans.map((plan, index) => {
                        const isPremium = index === 1
                        const firstYearBase = formatRupees(plan.firstYearBasePaise)
                        const firstYearGst = formatRupees(plan.firstYearGstPaise)
                        const firstYearTotal = formatRupees(plan.firstYearTotalPaise)
                        const renewalBase = formatRupees(plan.renewalBasePaise)
                        const renewalGst = formatRupees(plan.renewalGstPaise)
                        const renewalTotal = formatRupees(plan.renewalTotalPaise)

                        return (
                            <div
                                key={plan.tier}
                                className={`flex flex-col border p-6 shadow-[0_24px_70px_rgba(154,52,18,0.08)] backdrop-blur sm:p-8 ${isPremium ? 'border-zinc-950 bg-zinc-950 text-white shadow-[0_30px_90px_rgba(24,24,27,0.2)]' : 'border-zinc-200 bg-white/92 dark:border-white/10 dark:bg-zinc-950/75'}`}
                            >
                                <div className="flex flex-wrap items-center gap-3">
                                    <h3 className={`text-2xl font-black ${isPremium ? 'text-white' : 'text-zinc-950 dark:text-white'}`}>{plan.name}</h3>
                                    <span className={`border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${isPremium ? 'border-orange-300/30 bg-orange-400/10 text-orange-200' : 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300'}`}>
                                        {plan.badge}
                                    </span>
                                </div>
                                <p className={`mt-4 max-w-xl text-sm leading-6 ${isPremium ? 'text-zinc-300' : 'text-zinc-600 dark:text-zinc-300'}`}>{plan.description}</p>

                                <div className="mt-7 grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
                                    <div className={`border p-5 ${isPremium ? 'border-white/10 bg-white/5' : 'border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/5'}`}>
                                        <p className={`text-xs font-black uppercase tracking-[0.18em] ${isPremium ? 'text-orange-300' : 'text-orange-700 dark:text-orange-400'}`}>First year</p>
                                        <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
                                            <span className={`text-5xl font-black tracking-tight ${isPremium ? 'text-white' : 'text-zinc-950 dark:text-white'}`}>{firstYearBase}</span>
                                            <span className={`text-sm font-semibold ${isPremium ? 'text-zinc-400' : 'text-zinc-500'}`}>+ GST</span>
                                        </p>
                                        <p className={`mt-2 text-xs ${isPremium ? 'text-zinc-400' : 'text-zinc-500'}`}>{firstYearBase} + {firstYearGst} GST = {firstYearTotal}</p>
                                    </div>
                                    <div className={`border p-5 ${isPremium ? 'border-orange-300/25 bg-orange-400/10' : 'border-orange-200 bg-orange-50/70 dark:border-orange-500/20 dark:bg-orange-500/10'}`}>
                                        <p className={`text-xs font-black uppercase tracking-[0.18em] ${isPremium ? 'text-orange-300' : 'text-orange-700 dark:text-orange-400'}`}>Renewal from year 2</p>
                                        <p className="mt-3 flex flex-wrap items-baseline gap-x-1">
                                            <span className={`text-3xl font-black tracking-tight ${isPremium ? 'text-white' : 'text-zinc-950 dark:text-white'}`}>{renewalBase}</span>
                                            <span className={`text-sm font-semibold ${isPremium ? 'text-zinc-400' : 'text-zinc-500'}`}>/year + GST</span>
                                        </p>
                                        <p className={`mt-2 text-xs ${isPremium ? 'text-zinc-400' : 'text-zinc-500'}`}>{renewalGst} GST · {renewalTotal} total</p>
                                    </div>
                                </div>

                                <Button asChild className={`mt-6 w-full rounded-md py-6 font-bold ${isPremium ? 'bg-white text-zinc-950 hover:bg-orange-50' : 'bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100'}`}>
                                    <a href="/signup">Start 7-day trial</a>
                                </Button>

                                <div className={`mt-7 grid gap-3 text-sm leading-6 sm:grid-cols-2 ${isPremium ? 'text-zinc-300' : 'text-zinc-600 dark:text-zinc-300'}`}>
                                    {plan.features.map((feature) => (
                                        <div key={feature} className="flex gap-3">
                                            <Check className={`mt-0.5 h-5 w-5 flex-none ${isPremium ? 'text-orange-300' : 'text-orange-600'}`} aria-hidden="true" />
                                            <span>{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="mt-5 flex flex-col gap-2 border border-orange-200 bg-orange-50/80 px-5 py-4 text-sm text-zinc-700 sm:flex-row sm:items-center sm:justify-between dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-zinc-300">
                    <p><span className="font-bold text-zinc-950 dark:text-white">One factory included.</span> Multi-factory pricing is set after a workflow review.</p>
                    <a className="font-bold text-orange-700 underline decoration-orange-300 underline-offset-4 hover:text-orange-800 dark:text-orange-300" href="/signup">Request pilot access</a>
                </div>
            </div>
        </section>
    )
}
