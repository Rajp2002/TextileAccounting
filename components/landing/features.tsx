import { Calculator, ClipboardList, Factory, MessageCircle, ReceiptIndianRupee, Truck } from 'lucide-react'

const painPoints = [
    'Shift production arrives late from notebooks or WhatsApp.',
    'Payroll depends on meter totals that workers can dispute.',
    'Orders fall behind pace before the owner notices.',
    'Challans, shortages, and party follow-ups live in separate places.',
    'Yarn price changes make quote margins hard to trust.',
]

const replaces = ['Production register', 'Hajiri book', 'Excel costing sheet', 'Paper challan', 'WhatsApp follow-ups', 'Parchi payroll slips']

const workflow = [
    {
        title: 'Estimate the job',
        description: 'Enter yarn specs, crimp, conversion, overhead, GST, shortage, and margin before the order reaches the loom.',
        outcome: 'Know the quote price per meter and protect margin before saying yes.',
        icon: Calculator,
    },
    {
        title: 'Assign looms and workers',
        description: 'Turn accepted quotes or market runs into live factory work with machine, worker, shift, and order visibility.',
        outcome: 'See idle looms, missing assignments, and active orders without asking the floor.',
        icon: Factory,
    },
    {
        title: 'Log every shift',
        description: 'Supervisors enter opening and closing meter readings from the floor, with offline-safe capture for patchy internet.',
        outcome: 'Create one source of truth for production, payroll, and order progress.',
        icon: ClipboardList,
    },
    {
        title: 'Dispatch and settle',
        description: 'Create challans, share tracking links, record shortages, settle advances, and send payroll summaries on WhatsApp.',
        outcome: 'Close the loop from produced meters to party records and worker payments.',
        icon: Truck,
    },
]

const trustItems = [
    {
        title: 'Factory vocabulary inside the product',
        copy: 'Market runs, Upaad, Kharchi, shift meters, loom assignments, worker rates, and dispatch shortages are first-class workflows.',
        icon: ReceiptIndianRupee,
    },
    {
        title: 'Built for the floor, not just the office',
        copy: 'Supervisors can log shift production from mobile screens designed for repeated daily use and unreliable internet.',
        icon: ClipboardList,
    },
    {
        title: 'WhatsApp where it actually helps',
        copy: 'Daily briefs, payslips, advance receipts, and access-code requests reach owners and workers without replacing core records.',
        icon: MessageCircle,
    },
]

export default function LandingFeatures() {
    return (
        <div className="relative overflow-hidden">
            <section className="py-16 sm:py-24" id="problem">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="grid gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-400">The daily pain</p>
                            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-gray-950 sm:text-5xl dark:text-white">
                                Stop running the factory from registers, memory, and missed calls.
                            </h2>
                            <p className="mt-5 text-lg leading-8 text-gray-600 dark:text-gray-300">
                                Weavly is built for owners who need production, dispatch, and payroll to agree with each other before small mistakes become expensive disputes.
                            </p>
                        </div>

                        <div className="border border-gray-200 bg-white/85 p-5 shadow-xl shadow-orange-900/5 backdrop-blur dark:border-white/10 dark:bg-zinc-950/70 sm:p-6">
                            <div className="grid gap-3">
                                {painPoints.map((point) => (
                                    <div key={point} className="flex gap-3 border border-gray-200 bg-gray-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                                        <span className="mt-2 h-2 w-2 flex-none rounded-full bg-amber-600" />
                                        <p className="text-sm font-semibold leading-6 text-gray-800 dark:text-gray-100">{point}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6 border-t border-gray-200 pt-5 dark:border-white/10">
                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">What Weavly replaces</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {replaces.map((item) => (
                                        <span key={item} className="border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 dark:border-white/10 dark:bg-zinc-900 dark:text-gray-200">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-16 sm:py-24" id="workflow">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="grid gap-8 lg:grid-cols-[0.78fr_1fr] lg:items-end">
                        <div>
                            <p className="text-sm font-bold leading-7 text-amber-700 dark:text-amber-500 tracking-[0.22em] uppercase">Factory workflow</p>
                            <h2 className="mt-2 text-4xl font-extrabold tracking-tight text-gray-950 sm:text-5xl dark:text-white">
                                One operating loop from costing to settlement.
                            </h2>
                        </div>
                        <p className="text-lg leading-8 text-gray-600 dark:text-gray-300">
                            Weavly follows how a weaving unit actually moves work: quote the fabric, assign the floor, log meters, dispatch stock, and settle people correctly.
                        </p>
                    </div>

                    <div className="mt-12 border border-gray-200 bg-white/90 shadow-2xl shadow-orange-900/5 backdrop-blur dark:border-white/10 dark:bg-zinc-950/75">
                        <div className="grid divide-y divide-gray-200 dark:divide-white/10 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
                            {workflow.map((step, index) => (
                                <div key={step.title} className="p-6">
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">0{index + 1}</span>
                                        <div className="flex h-10 w-10 items-center justify-center bg-gray-950 text-white dark:bg-white dark:text-gray-950">
                                            <step.icon className="h-5 w-5" aria-hidden="true" />
                                        </div>
                                    </div>
                                    <h3 className="mt-6 text-xl font-bold text-gray-950 dark:text-white">{step.title}</h3>
                                    <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">{step.description}</p>
                                    <p className="mt-5 border-l-2 border-amber-600 pl-3 text-sm font-semibold leading-6 text-gray-800 dark:text-gray-100">
                                        {step.outcome}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-16 sm:py-24" id="features">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="grid gap-8 lg:grid-cols-[0.78fr_1fr] lg:items-end">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-400">FACTORY-FIRST, NOT ERP-RETROFITTED</p>
                            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-gray-950 sm:text-5xl dark:text-white">
                                Every term in the product is a term from your factory floor.
                            </h2>
                        </div>
                        <p className="text-lg leading-8 text-gray-600 dark:text-gray-300">
                            The product vocabulary, mobile workflows, and WhatsApp touchpoints are designed around the operating reality of Indian weaving units.
                        </p>
                    </div>

                    <div className="mt-12 grid gap-4 md:grid-cols-3">
                        {trustItems.map((item) => (
                            <div key={item.title} className="border border-gray-200 bg-white/85 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-950/70">
                                <item.icon className="h-6 w-6 text-amber-600" aria-hidden="true" />
                                <h3 className="mt-5 text-lg font-bold text-gray-950 dark:text-white">{item.title}</h3>
                                <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">{item.copy}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    )
}
