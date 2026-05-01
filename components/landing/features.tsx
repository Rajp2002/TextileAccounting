'use client'

import { motion } from 'framer-motion'
import { Calculator, ClipboardList, Factory, MessageCircle, ReceiptIndianRupee, Truck } from 'lucide-react'

const features = [
    {
        name: 'Quote with factory math',
        description: 'Build fabric estimates with warp, weft, GST, crimp, shortage, conversion, overhead, and margin visible before an order reaches the floor.',
        icon: Calculator,
        accent: 'border-amber-200 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/10',
        metric: 'Estimator',
    },
    {
        name: 'Keep looms assigned',
        description: 'Move accepted quotes into orders, run speculative market production when demand dips, and see which machines need a worker or assignment.',
        icon: Factory,
        accent: 'border-sky-200 bg-sky-50/80 dark:border-sky-500/20 dark:bg-sky-500/10',
        metric: 'Orders + runs',
    },
    {
        name: 'Log production by shift',
        description: 'Supervisors enter opening and closing meter readings by machine, worker, shift, and order or market run, even when the internet is patchy.',
        icon: ClipboardList,
        accent: 'border-indigo-200 bg-indigo-50/80 dark:border-indigo-500/20 dark:bg-indigo-500/10',
        metric: 'Floor source',
    },
    {
        name: 'Settle payroll and advances',
        description: 'Turn piece-rate logs, fixed wages, Upaad recovery, PF/ESI fields, payment modes, and final settlements into a clear worker record.',
        icon: ReceiptIndianRupee,
        accent: 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/20 dark:bg-emerald-500/10',
        metric: 'Worker trust',
    },
    {
        name: 'Look professional to parties',
        description: 'Send quotes, create dispatches, generate challans, and share tracking links without turning Phase 1 into a heavy accounting suite.',
        icon: Truck,
        accent: 'border-rose-200 bg-rose-50/80 dark:border-rose-500/20 dark:bg-rose-500/10',
        metric: 'Dispatch',
    },
    {
        name: 'Communicate where work happens',
        description: 'Daily briefs, payslips, advance receipts, access-code requests, and operational notifications flow through WhatsApp without blocking core writes.',
        icon: MessageCircle,
        accent: 'border-green-200 bg-green-50/80 dark:border-green-500/20 dark:bg-green-500/10',
        metric: 'WhatsApp',
    },
]

export default function LandingFeatures() {
    return (
        <div className="py-16 sm:py-24 relative overflow-hidden" id="features">
            <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
                <div className="grid gap-8 lg:grid-cols-[0.78fr_1fr] lg:items-end">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="text-sm font-bold leading-7 text-amber-700 dark:text-amber-500 tracking-widest uppercase">Phase 1 scope</h2>
                        <p className="mt-2 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
                            Built around the daily factory loop, not ERP sprawl.
                        </p>
                    </motion.div>
                    <p className="text-lg leading-8 text-gray-600 dark:text-gray-300">
                        The first release keeps the main path sharp: estimate the work, keep looms productive, log what happened, pay people correctly, and keep owners and parties informed.
                    </p>
                </div>

                <div className="mx-auto mt-12 sm:mt-16 lg:mt-18">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {features.map((feature, index) => (
                            <motion.div
                                key={feature.name}
                                initial={{ opacity: 0, y: 18 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.45, delay: index * 0.06 }}
                                className={`relative min-h-[230px] overflow-hidden rounded-lg border p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/10 ${feature.accent}`}
                            >
                                <div className="absolute inset-0 -z-10 bg-white/70 backdrop-blur-sm dark:bg-zinc-950/55" />

                                <div className="flex h-full flex-col">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-gray-950 text-white shadow-lg shadow-black/10 dark:bg-white dark:text-gray-950">
                                            <feature.icon className="h-5 w-5" aria-hidden="true" />
                                        </div>
                                        <span className="border border-gray-900/10 bg-white/70 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                                            {feature.metric}
                                        </span>
                                    </div>
                                    <h3 className="mt-7 text-xl font-bold text-gray-900 dark:text-white">
                                        {feature.name}
                                    </h3>
                                    <p className="mt-3 text-base leading-relaxed text-gray-600 dark:text-gray-300">
                                        {feature.description}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
