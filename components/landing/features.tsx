'use client'

import { motion } from 'framer-motion'
import { ClipboardList, WifiOff, Calculator, MessageCircle, Smartphone, Users } from 'lucide-react'

const features = [
    {
        name: 'Seamless Daily Production Tracking',
        description: 'Log daily meter production for every worker quickly and easily. The system automatically aggregates these daily logs to calculate the final monthly pay, eliminating manual data entry.',
        icon: ClipboardList,
        className: 'md:col-span-2 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 dark:from-indigo-500/5 dark:via-purple-500/5 dark:to-pink-500/5',
        iconBg: 'bg-gradient-to-br from-indigo-500 to-purple-500',
    },
    {
        name: 'Built for the Factory Floor',
        description: 'Spotty internet? No problem. The app is offline-first. Log data without a connection, and it will securely sync the moment you are back online.',
        icon: WifiOff,
        className: 'md:col-span-1 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5',
        iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-500',
    },
    {
        name: 'Pinpoint Accurate Payroll',
        description: 'Our financial engine uses high-precision calculation technology to eliminate rounding errors common in spreadsheets. Every rupee is accounted for accurately.',
        icon: Calculator,
        className: 'md:col-span-1 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/5 dark:to-teal-500/5',
        iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-500',
    },
    {
        name: 'Automated WhatsApp Briefs',
        description: 'Receive an automated daily production summary delivered straight to your WhatsApp, giving you a reliable overview of output without opening the app.',
        icon: MessageCircle,
        className: 'md:col-span-2 bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5',
        iconBg: 'bg-gradient-to-br from-green-500 to-emerald-500',
    },
    {
        name: 'Instant Access on Any Device',
        description: 'No app store needed. Use "Add to Home Screen" to install directly on any phone or tablet. It functions like a native app for instant access from anywhere.',
        icon: Smartphone,
        className: 'md:col-span-2 bg-gradient-to-br from-orange-500/10 to-red-500/10 dark:from-orange-500/5 dark:to-red-500/5',
        iconBg: 'bg-gradient-to-br from-orange-500 to-red-500',
    },
    {
        name: 'Flexible Team Sizing',
        description: 'Whether you manage a small floor or a large operation, the platform scales with you. Manage up to 15 workers on Base, or unlock unlimited workers on Premium.',
        icon: Users,
        className: 'md:col-span-1 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 dark:from-purple-500/5 dark:to-indigo-500/5',
        iconBg: 'bg-gradient-to-br from-purple-500 to-indigo-500',
    },
]

export default function LandingFeatures() {
    return (
        <div className="bg-white py-16 sm:py-24 dark:bg-zinc-950 relative overflow-hidden" id="features">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60rem] h-[60rem] bg-indigo-500/10 dark:bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
                <div className="mx-auto max-w-2xl lg:text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="text-sm font-bold leading-7 text-indigo-600 dark:text-indigo-400 tracking-widest uppercase">Deploy faster</h2>
                        <p className="mt-2 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
                            Everything you need to run a modern textile factory
                        </p>
                        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
                            Replace manual logbooks and scattered spreadsheets with a unified system designed for the textile industry.
                        </p>
                    </motion.div>
                </div>

                <div className="mx-auto mt-12 max-w-2xl sm:mt-16 lg:mt-20 lg:max-w-5xl">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-auto md:auto-rows-[280px]">
                        {features.map((feature, index) => (
                            <motion.div
                                key={feature.name}
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                className={`relative rounded-[2rem] p-8 ring-1 ring-gray-900/5 dark:ring-white/10 group overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 ${feature.className}`}
                            >
                                <div className="absolute inset-0 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-sm -z-10" />

                                <div className="flex flex-col h-full">
                                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${feature.iconBg} mb-6 shadow-lg shadow-black/10 dark:shadow-black/30 group-hover:scale-110 transition-transform duration-300`}>
                                        <feature.icon className="h-7 w-7 text-white" aria-hidden="true" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                        {feature.name}
                                    </h3>
                                    <p className="text-base leading-relaxed text-gray-600 dark:text-gray-300 mt-auto">
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
