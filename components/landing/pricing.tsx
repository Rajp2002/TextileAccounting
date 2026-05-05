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
            'Shift production logs with meter readings',
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
        <section className="relative overflow-hidden py-16 sm:py-24 snap-start scroll-mt-20" id="pricing">
            <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
                <div className="mx-auto max-w-4xl text-center">
                    <p className="text-sm font-bold leading-7 text-amber-700 dark:text-amber-500 tracking-[0.22em] uppercase">Pricing</p>
                    <h2 className="mt-2 text-4xl font-extrabold tracking-tight text-gray-950 sm:text-5xl dark:text-white">
                        Start with costing, or run the whole factory loop.
                    </h2>
                    <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 dark:text-gray-300">
                        Begin with a focused pilot. Add the floor workflow when your team is ready to move daily production and payroll into Weavly.
                    </p>
                    <p className="mx-auto mt-2 text-sm text-gray-400 dark:text-gray-500">
                        All prices are exclusive of 18% GST. Trial includes Premium access for 7 days.
                    </p>
                </div>

                <div className="mx-auto mt-12 grid max-w-6xl gap-6 lg:grid-cols-2">
                    {plans.map((plan) => (
                        <div key={plan.name} className="flex flex-col border border-gray-200 bg-white/90 p-6 shadow-xl shadow-orange-900/5 backdrop-blur dark:border-white/10 dark:bg-zinc-950/75 sm:p-8">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-950 dark:text-white">{plan.name}</h3>
                                    <p className="mt-3 max-w-xl text-sm leading-6 text-gray-600 dark:text-gray-300">{plan.description}</p>
                                </div>
                                <p className="flex shrink-0 items-baseline gap-1">
                                    <span className="text-4xl font-extrabold tracking-tight text-gray-950 dark:text-white">{plan.price}</span>
                                    <span className="text-sm font-semibold text-gray-500">{plan.suffix}</span>
                                </p>
                            </div>

                            <div className="mt-6 border-l-2 border-amber-600 bg-amber-50/70 px-4 py-3 dark:bg-amber-500/10">
                                <p className="text-sm font-semibold leading-6 text-gray-800 dark:text-gray-100">{plan.guidance}</p>
                            </div>

                            <Button asChild className="mt-7 w-full rounded-md bg-gray-950 py-6 font-semibold text-white hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-100">
                                <a href="/signup">Request pilot access</a>
                            </Button>

                            <div className="mt-8 grid gap-4 text-sm leading-6 text-gray-600 dark:text-gray-300">
                                {plan.features.map((feature) => (
                                    <div key={feature} className="flex gap-3">
                                        <Check className="h-5 w-5 flex-none text-amber-600" aria-hidden="true" />
                                        <span>{feature}</span>
                                    </div>
                                ))}
                                {plan.excluded?.map((feature) => (
                                    <div key={feature} className="flex gap-3 text-gray-400 dark:text-gray-500">
                                        <X className="h-5 w-5 flex-none text-gray-400" aria-hidden="true" />
                                        <span>{feature}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mx-auto mt-8 grid max-w-6xl gap-6 border border-amber-200 bg-amber-50/85 p-6 shadow-sm backdrop-blur dark:border-amber-500/20 dark:bg-amber-500/10 lg:grid-cols-[1fr_0.42fr] lg:items-center">
                    <div>
                        <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400">Setup and training add-on</p>
                        <h3 className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">Get the first factory floor configured with your team.</h3>
                        <p className="mt-3 text-sm leading-6 text-gray-700 dark:text-gray-300">
                            We help set up machines, workers, starting data, and staff training so the owner and supervisor can begin with real factory records instead of an empty account.
                        </p>
                    </div>
                    <div className="border border-amber-200 bg-white p-5 text-left dark:border-amber-500/20 dark:bg-zinc-950/80 lg:text-center">
                        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">One-time payment</p>
                        <p className="mt-2 text-4xl font-extrabold text-gray-950 dark:text-white">₹4,999</p>
                        <p className="mt-1 text-xs text-gray-500">+ GST, optional</p>
                    </div>
                </div>
            </div>
        </section>
    )
}
