import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const plans = [
    {
        name: 'Start with Estimating',
        price: '₹2,000',
        suffix: '/month',
        description: 'For owners who want Weavly as their quoting and costing desk before connecting the floor.',
        guidance: 'Good first step if your biggest leak is wrong costing or manual quote history.',
        features: [
            'Warp and weft cost estimator',
            'Fabric templates and quote history',
            'Margin and landed-cost visibility',
            'Single owner account',
        ],
        excluded: ['Production and order tracking', 'Payroll and advances', 'WhatsApp daily brief'],
    },
    {
        name: 'Run the Full Factory Loop',
        price: '₹5,000',
        suffix: '/month',
        description: 'For factories ready to connect quotes, looms, shift logs, dispatches, payroll, and owner visibility.',
        guidance: 'Most useful when you want supervisors and payroll to run from the same production record.',
        features: [
            'Everything in Estimating',
            'Orders, market runs, and dispatch tracking',
            'Shift production logs with direct shift metres',
            'Payroll, advances, and settlement',
            'WhatsApp briefs, payslips, and receipts',
            'Operational analytics for owners',
            'Unlimited machines and workers',
            'Priority support',
        ],
    },
]

export default function LandingPricing() {
    return (
        <section className="relative overflow-hidden py-20 sm:py-28 snap-start scroll-mt-28" id="pricing">
            <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
                <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
                    <div>
                        <p className="text-xs font-black leading-7 text-orange-700 dark:text-orange-500 tracking-[0.32em] uppercase">Pricing</p>
                        <h2 className="mt-2 text-4xl font-black tracking-tight text-zinc-950 sm:text-6xl dark:text-white">
                        Start with costing, or run the whole factory loop.
                        </h2>
                    </div>
                    <div className="max-w-2xl lg:ml-auto">
                        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-300">
                            Begin with a focused pilot. Add the floor workflow when your team is ready to move daily production and payroll into Weavly.
                        </p>
                        <p className="mt-3 text-sm text-zinc-400 dark:text-zinc-500">
                            All prices are exclusive of 18% GST. Trial includes Premium access for 7 days.
                        </p>
                    </div>
                </div>

                <div className="mt-12 grid gap-5 lg:grid-cols-3">
                    {plans.map((plan, index) => (
                        <div key={plan.name} className={`flex min-h-[42rem] flex-col border p-6 shadow-[0_24px_70px_rgba(154,52,18,0.08)] backdrop-blur sm:p-8 ${index === 1 ? 'border-zinc-950 bg-zinc-950 text-white shadow-[0_30px_90px_rgba(24,24,27,0.2)]' : 'border-zinc-200 bg-white/92 dark:border-white/10 dark:bg-zinc-950/75'}`}>
                            <div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <h3 className={`text-2xl font-black ${index === 1 ? 'text-white' : 'text-zinc-950 dark:text-white'}`}>{plan.name}</h3>
                                    {index === 1 ? (
                                        <span className="border border-orange-300/30 bg-orange-400/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-orange-200">Best pilot</span>
                                    ) : null}
                                </div>
                                <p className={`mt-4 text-sm leading-6 ${index === 1 ? 'text-zinc-300' : 'text-zinc-600 dark:text-zinc-300'}`}>{plan.description}</p>
                                <p className="mt-8 flex items-baseline gap-1">
                                    <span className={`text-5xl font-black tracking-tight ${index === 1 ? 'text-white' : 'text-zinc-950 dark:text-white'}`}>{plan.price}</span>
                                    <span className={`text-sm font-semibold ${index === 1 ? 'text-zinc-400' : 'text-zinc-500'}`}>{plan.suffix}</span>
                                </p>
                            </div>

                            <div className={`mt-7 border-l-2 px-4 py-3 ${index === 1 ? 'border-orange-300 bg-white/5' : 'border-orange-600 bg-orange-50/70 dark:bg-orange-500/10'}`}>
                                <p className={`text-sm font-bold leading-6 ${index === 1 ? 'text-zinc-100' : 'text-zinc-800 dark:text-zinc-100'}`}>{plan.guidance}</p>
                            </div>

                            <Button asChild className={`mt-7 w-full rounded-md py-6 font-bold ${index === 1 ? 'bg-white text-zinc-950 hover:bg-orange-50' : 'bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100'}`}>
                                <a href="/signup">Request pilot access</a>
                            </Button>

                            <div className={`mt-8 grid gap-4 text-sm leading-6 ${index === 1 ? 'text-zinc-300' : 'text-zinc-600 dark:text-zinc-300'}`}>
                                {plan.features.map((feature) => (
                                    <div key={feature} className="flex gap-3">
                                        <Check className={`h-5 w-5 flex-none ${index === 1 ? 'text-orange-300' : 'text-orange-600'}`} aria-hidden="true" />
                                        <span>{feature}</span>
                                    </div>
                                ))}
                                {plan.excluded?.map((feature) => (
                                    <div key={feature} className="flex gap-3 text-zinc-400 dark:text-zinc-500">
                                        <X className="h-5 w-5 flex-none text-zinc-400" aria-hidden="true" />
                                        <span>{feature}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div className="flex min-h-[42rem] flex-col justify-between border border-orange-200 bg-orange-50/85 p-6 shadow-[0_24px_70px_rgba(154,52,18,0.08)] backdrop-blur dark:border-orange-500/20 dark:bg-orange-500/10 sm:p-8">
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-700 dark:text-orange-400">Setup and training add-on</p>
                            <h3 className="mt-5 text-3xl font-black tracking-tight text-zinc-950 dark:text-white">Get the first factory floor configured with your team.</h3>
                            <p className="mt-5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                            We help set up machines, workers, starting data, and staff training so the owner and supervisor can begin with real factory records instead of an empty account.
                            </p>
                        </div>
                        <div className="mt-8 border border-orange-200 bg-white p-5 text-left dark:border-orange-500/20 dark:bg-zinc-950/80">
                            <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">One-time payment</p>
                            <p className="mt-2 text-5xl font-black text-zinc-950 dark:text-white">₹4,999</p>
                            <p className="mt-1 text-xs text-zinc-500">+ GST, optional</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
