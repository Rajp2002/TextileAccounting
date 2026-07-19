import { Calculator, ClipboardList, Factory, MessageCircle, ReceiptIndianRupee, Truck } from 'lucide-react'

const painPoints = [
    'Shift production arrives late from notebooks or WhatsApp.',
    'Worker Hisaab depends on production totals that workers can dispute.',
    'Orders fall behind pace before the owner notices.',
    'Godown Stock, Delivery Challans, shortages, and Party collections live in separate places.',
    'Yarn price changes make quotation margins hard to trust.',
]

const replaces = ['Production register', 'Hajiri book', 'Excel costing sheet', 'Delivery Challan', 'WhatsApp follow-ups', 'Worker Hisaab slips']

const workflow = [
    {
        title: 'Create a Cost Estimate',
        description: 'Enter warp and weft details, factory costs, GST, shortage, and margin. Save the costing as a reusable quality or lock it into a Quotation.',
        outcome: 'Know landed cost, selling price, and expected margin before saying yes.',
        icon: Calculator,
    },
    {
        title: 'Start an Order or Market Run',
        description: 'Convert an accepted Quotation into a Party Order, or start market maal when client demand is light. Then assign machines and workers.',
        outcome: 'Every running machine is tied to a costed production target.',
        icon: Factory,
    },
    {
        title: 'Log every shift',
        description: 'Supervisors enter machine status, worker assignment, and total metres produced from the mobile floor workflow.',
        outcome: 'The same shift record updates progress, expected stock, and Worker Hisaab.',
        icon: ClipboardList,
    },
    {
        title: 'Sell, dispatch, and settle',
        description: 'Track Godown Stock, Party sales, Delivery Challan batches, received metres, shortages, collections, Upaad, and Worker Hisaab.',
        outcome: 'Close the loop from metres produced to cash collected and workers paid.',
        icon: Truck,
    },
]

const trustItems = [
    {
        title: 'Factory vocabulary inside the product',
        copy: 'Market runs, Upaad, Kharchi, metres produced each shift, machine assignments, worker rates, and dispatch shortages are first-class workflows.',
        icon: ReceiptIndianRupee,
    },
    {
        title: 'Built for the floor, not just the office',
        copy: 'Built for repeated supervisor use in patchy factory conditions. Mobile screens are designed for quick daily entry.',
        icon: ClipboardList,
    },
    {
        title: 'WhatsApp where it actually helps',
        copy: 'Daily briefs, payslips, Upaad receipts, and access-code requests reach owners and workers without replacing core records.',
        icon: MessageCircle,
    },
]

export default function LandingFeatures() {
    return (
        <>
            <section className="landing-section relative z-10 py-20 sm:py-28 lg:py-12" id="problem">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
                        <div className="lg:sticky lg:top-36">
                            <p className="text-xs font-black uppercase tracking-[0.32em] text-orange-700 dark:text-orange-400">The daily pain</p>
                            <h2 className="mt-4 text-4xl font-black tracking-tight text-zinc-950 sm:text-6xl dark:text-white">
                                Stop running the factory from registers, memory, and missed calls.
                            </h2>
                            <p className="mt-5 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
                                Weavly is built for owners who need production, dispatch, and Worker Hisaab to agree with each other before small mistakes become expensive disputes.
                            </p>
                        </div>

                        <div className="grid gap-4">
                            <div className="border border-zinc-200 bg-white/92 shadow-[0_24px_70px_rgba(154,52,18,0.08)] backdrop-blur dark:border-white/10 dark:bg-zinc-950/70">
                                <div className="grid border-b border-zinc-200 px-5 py-4 text-xs font-black uppercase tracking-[0.22em] text-zinc-400 dark:border-white/10 sm:grid-cols-[5rem_1fr_8rem]">
                                    <span>Item</span>
                                    <span>Operational leak</span>
                                    <span className="hidden sm:block">Status</span>
                                </div>
                                {painPoints.map((point, index) => (
                                    <div key={point} className="grid gap-3 border-b border-zinc-200 px-5 py-5 last:border-b-0 dark:border-white/10 sm:grid-cols-[5rem_1fr_8rem] sm:items-center">
                                        <span className="text-xs font-black uppercase tracking-[0.22em] text-zinc-400">0{index + 1}</span>
                                        <p className="text-lg font-black leading-7 text-zinc-900 dark:text-zinc-50">{point}</p>
                                        <span className="w-fit border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300">
                                            Recurring
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="grid gap-3 border border-orange-200 bg-orange-50/75 p-5 backdrop-blur dark:border-orange-500/20 dark:bg-orange-500/10 lg:grid-cols-[12rem_1fr]">
                                <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-700 dark:text-orange-400">What Weavly replaces</p>
                                <div className="flex flex-wrap gap-2">
                                    {replaces.map((item) => (
                                        <span key={item} className="border border-orange-200 bg-white px-3 py-1.5 text-xs font-black text-zinc-700 dark:border-orange-500/20 dark:bg-zinc-900 dark:text-zinc-200">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="landing-section relative z-10 py-20 sm:py-28 lg:py-12" id="workflow">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
                        <div>
                            <p className="text-xs font-black leading-7 text-orange-700 dark:text-orange-500 tracking-[0.32em] uppercase">Factory workflow</p>
                            <h2 className="mt-2 text-4xl font-black tracking-tight text-zinc-950 sm:text-6xl dark:text-white">
                                One operating loop from costing to collection.
                            </h2>
                        </div>
                        <p className="max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300 lg:ml-auto">
                            Weavly follows how a weaving unit actually moves work: calculate the Cost Estimate, issue the Quotation, run an Order or market maal, log shift totals, manage Godown Stock, dispatch, collect, and settle workers.
                        </p>
                    </div>

                    <div className="relative mt-14">
                        <div className="absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-orange-300 to-transparent lg:block" />
                        <div className="grid gap-5 lg:grid-cols-4">
                            {workflow.map((step, index) => (
                                <div key={step.title} className="relative border border-zinc-200 bg-white/92 p-6 shadow-[0_20px_60px_rgba(154,52,18,0.07)] backdrop-blur dark:border-white/10 dark:bg-zinc-950/75">
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-orange-200 bg-white text-sm font-black text-orange-700 shadow-sm dark:border-orange-500/20 dark:bg-zinc-900 dark:text-orange-300">
                                            0{index + 1}
                                        </span>
                                        <div className="flex h-11 w-11 items-center justify-center bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
                                            <step.icon className="h-5 w-5" aria-hidden="true" />
                                        </div>
                                    </div>
                                    <h3 className="mt-8 text-xl font-black text-zinc-950 dark:text-white">{step.title}</h3>
                                    <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{step.description}</p>
                                    <p className="mt-6 border-t border-zinc-200 pt-5 text-sm font-bold leading-6 text-zinc-900 dark:border-white/10 dark:text-zinc-100">
                                        <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.2em] text-orange-700 dark:text-orange-400">Outcome</span>
                                        {step.outcome}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="landing-section relative z-10 py-20 sm:py-28 lg:py-12" id="features">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="overflow-hidden border border-zinc-900 bg-zinc-950 text-white shadow-[0_28px_90px_rgba(24,24,27,0.18)]">
                        <div className="grid gap-10 border-b border-white/10 p-6 sm:p-10 lg:grid-cols-[0.95fr_1.05fr] lg:p-12">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.32em] text-orange-300">FACTORY-FIRST, NOT ERP-RETROFITTED</p>
                                <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">
                                    Every term in the product is a term from your factory floor.
                                </h2>
                            </div>
                            <p className="text-lg leading-8 text-zinc-300 lg:pt-12">
                                The product vocabulary, mobile workflows, and WhatsApp touchpoints are designed around the operating reality of Indian weaving units.
                            </p>
                        </div>

                        <div className="grid divide-y divide-white/10 md:grid-cols-3 md:divide-x md:divide-y-0">
                            {trustItems.map((item) => (
                                <div key={item.title} className="p-6 sm:p-8">
                                    <item.icon className="h-7 w-7 text-orange-300" aria-hidden="true" />
                                    <h3 className="mt-6 text-xl font-black text-white">{item.title}</h3>
                                    <p className="mt-4 text-sm leading-6 text-zinc-300">{item.copy}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </>
    )
}
