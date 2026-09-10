import { Calculator, ClipboardList, Copy, Download, Factory, MessageCircle, ReceiptIndianRupee, WalletCards } from 'lucide-react'

const painPoints = [
    'Yarn price changes make quotation margins hard to trust.',
    'Cost assumptions are spread across spreadsheets, notebooks, and memory.',
    'The same fabric quality gets rebuilt from scratch for every new costing.',
    'Landed cost, break-even price, and target margin are hard to see together.',
    'Draft costings disappear before the next customer conversation.',
]

const replaces = ['Excel costing sheet', 'Handwritten yarn rates', 'Repeated calculations', 'Margin guesswork', 'Scattered price notes', 'Lost costing drafts']

const workflow = [
    {
        title: 'Create a Cost Estimate',
        plans: 'Free · Lite · Base',
        description: 'Enter warp and weft details, factory costs, GST, shortage, transport, commission, and margin in one guided workspace.',
        outcome: 'Know landed cost, break-even price, and expected margin before saying yes.',
        icon: Calculator,
    },
    {
        title: 'Reuse a Saved Quality',
        plans: 'Lite · Base',
        description: 'Keep fabric construction and costing assumptions together so the next estimate starts from a known baseline.',
        outcome: 'Spend less time re-entering the same factory knowledge.',
        icon: Copy,
    },
    {
        title: 'Check the margin',
        plans: 'Free · Lite · Base',
        description: 'See production cost per metre, suggested price, actual margin, break-even price, and the assumptions behind the result.',
        outcome: 'Make pricing decisions from visible inputs instead of a guessed total.',
        icon: ClipboardList,
    },
    {
        title: 'Save or export the costing',
        plans: 'Free · Lite · Base',
        description: 'Save a costing for later comparison or export a clean cost sheet when you need to share the numbers.',
        outcome: 'Keep the decision record ready for the next customer conversation.',
        icon: Download,
    },
    {
        title: 'Run a simple production job',
        plans: 'Base',
        description: 'Start a production job from the costing, record metres as the owner, and keep the target and economics together.',
        outcome: 'Move from a price decision to a useful production record without opening a full ERP.',
        icon: Factory,
    },
    {
        title: 'Settle piece-rate pay',
        plans: 'Base',
        description: 'Use recorded metres, rate snapshots, and owner-entered advances to see gross pay, capped recovery, and net payout.',
        outcome: 'Know what each worker is owed while broader payroll workflows remain outside the current catalog.',
        icon: WalletCards,
    },
]

const trustItems = [
    {
        title: 'Factory vocabulary inside the estimator',
        copy: 'Warp, weft, PPI, crimp, waste, pick rate, costing, quotation, margin, and GST are explained in the language your costing desk already uses.',
        icon: ReceiptIndianRupee,
    },
    {
        title: 'Built for the costing conversation',
        copy: 'Open the installable PWA on the device you already use, keep the assumptions visible, and return to saved work when the next price request arrives.',
        icon: ClipboardList,
    },
    {
        title: 'Choose the operational layer you need',
        copy: 'Free covers two costings per week with saved records and exports. Lite adds unlimited costings, reusable qualities, and Rate Book. Base connects costing with owner-led production and worker settlement.',
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
                            <p className="mt-5 text-lg leading-8 text-zinc-700 dark:text-zinc-300">
                                Weavly is built for owners who need yarn inputs, factory costs, and margin to agree before a price becomes a promise.
                            </p>
                        </div>

                        <div className="grid gap-4">
                            <div className="border border-zinc-200 bg-white/92 shadow-[0_24px_70px_rgba(154,52,18,0.08)] backdrop-blur dark:border-white/10 dark:bg-zinc-950/70">
                                <div className="grid border-b border-zinc-200 px-5 py-4 text-xs font-black uppercase tracking-[0.22em] text-zinc-600 dark:border-white/10 sm:grid-cols-[5rem_1fr_8rem]">
                                    <span>Item</span>
                                    <span>Operational leak</span>
                                    <span className="hidden sm:block">Status</span>
                                </div>
                                {painPoints.map((point, index) => (
                                    <div key={point} className="grid gap-3 border-b border-zinc-200 px-5 py-5 last:border-b-0 dark:border-white/10 sm:grid-cols-[5rem_1fr_8rem] sm:items-center">
                                        <span className="text-xs font-black uppercase tracking-[0.22em] text-zinc-600">0{index + 1}</span>
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
                            <p className="text-xs font-black leading-7 text-orange-700 dark:text-orange-500 tracking-[0.32em] uppercase">Estimator workflow</p>
                            <h2 className="mt-2 text-4xl font-black tracking-tight text-zinc-950 sm:text-6xl dark:text-white">
                                 One clear loop from inputs to worker pay.
                            </h2>
                        </div>
                        <p className="max-w-2xl text-lg leading-8 text-[var(--color-body)] lg:ml-auto">
                            Weavly follows the costing decision a weaving unit makes before work begins: define the fabric quality, capture yarn rates, apply factory costs, review margin, save the costing, and export the Cost Sheet.
                        </p>
                    </div>

                    <div className="relative mt-14">
                        <div className="absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-orange-300 to-transparent lg:block" />
                        <div className="grid gap-5 lg:grid-cols-3 xl:grid-cols-6">
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
                                    <p className="mt-6 text-sm font-bold text-orange-700 dark:text-orange-400">{step.plans}</p>
                                    <h3 className="mt-2 text-xl font-black text-zinc-950 dark:text-white">{step.title}</h3>
                                    <p className="mt-3 text-sm leading-6 text-[var(--color-body)]">{step.description}</p>
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
                    <div className="overflow-hidden border border-orange-200 bg-orange-50/60 shadow-[0_28px_90px_rgba(154,52,18,0.08)]">
                        <div className="grid gap-10 border-b border-orange-200/70 p-6 sm:p-10 lg:grid-cols-[0.95fr_1.05fr] lg:p-12">
                            <div>
                            <p className="text-xs font-black uppercase tracking-[0.32em] text-orange-700">ESTIMATOR-FIRST, FACTORY-LITERATE</p>
                                <h2 className="mt-4 text-4xl font-black tracking-tight text-zinc-950 sm:text-6xl">
                                    Every number in the estimator should make sense on your factory floor.
                                </h2>
                            </div>
                            <p className="text-lg leading-8 text-zinc-700 lg:pt-12">
                                The Base release stays deliberately focused on a small operating loop: capture the right assumptions, start a job, record output, and understand piece-rate pay without bringing every factory module into the workspace.
                            </p>
                        </div>

                        <div className="grid divide-y divide-orange-200/60 md:grid-cols-3 md:divide-x md:divide-y-0">
                            {trustItems.map((item) => (
                                <div key={item.title} className="p-6 sm:p-8">
                                    <item.icon className="h-7 w-7 text-orange-600" aria-hidden="true" />
                                    <h3 className="mt-6 text-xl font-black text-zinc-950">{item.title}</h3>
                                    <p className="mt-4 text-sm leading-6 text-zinc-700">{item.copy}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </>
    )
}
