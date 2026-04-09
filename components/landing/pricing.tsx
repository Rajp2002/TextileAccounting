'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const tiers = [
    {
        name: 'Free Trial',
        id: 'tier-trial',
        href: '/signup',
        priceMonthly: '₹0',
        description: 'Try all premium features free for 7 days.',
        features: [
            'All core functionalities',
            'Unlimited workers during trial',
            'Daily WhatsApp brief',
            'No credit card required',
        ],
        featured: false,
    },
    {
        name: 'Base',
        id: 'tier-base',
        href: '/signup',
        priceMonthly: '₹1,200',
        priceSuffix: '/month',
        description: 'Perfect for smaller textile factories getting started.',
        features: [
            'All core functionalities',
            'Up to 15 workers',
            'Basic email support',
        ],
        notIncluded: [
            'Daily WhatsApp brief',
            'Unlimited workers',
        ],
        featured: false,
    },
    {
        name: 'Premium',
        id: 'tier-premium',
        href: '/signup',
        priceMonthly: '₹3,500',
        priceSuffix: '/month',
        description: 'Everything you need to scale your production.',
        features: [
            'All core functionalities',
            'Unlimited workers',
            'Daily WhatsApp brief',
            'Priority support',
            'Advanced analytics',
        ],
        featured: true,
        highlight: 'Most Popular',
    },
]

export default function LandingPricing() {
    return (
        <div className="py-16 sm:py-24 relative overflow-hidden" id="pricing">
            <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
                <div className="mx-auto max-w-4xl text-center">
                    <h2 className="text-base font-semibold leading-7 text-amber-700 dark:text-amber-500 tracking-widest uppercase">Pricing</h2>
                    <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
                        Simple, transparent pricing
                    </p>
                </div>
                <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-gray-600 dark:text-gray-300">
                    Choose the plan that fits your factory&apos;s size. No hidden fees.
                </p>
                <p className="mx-auto mt-2 text-center text-sm text-gray-400 dark:text-gray-500">
                    All prices are exclusive of 18% GST
                </p>

                <div className="isolate mx-auto mt-12 sm:mt-16 grid max-w-md grid-cols-1 gap-8 lg:max-w-7xl lg:grid-cols-3">
                    {tiers.map((tier, tierIdx) => (
                        <motion.div
                            key={tier.id}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: tierIdx * 0.15 }}
                            className={cn(
                                tier.featured ? 'ring-2 ring-amber-600 dark:ring-amber-500 shadow-2xl lg:scale-105 my-2 lg:my-0' : 'ring-1 ring-gray-200 dark:ring-white/10 bg-white/60 dark:bg-zinc-900/40 backdrop-blur-sm',
                                'p-8 xl:p-10 rounded-[2rem] relative flex flex-col justify-between transition-transform duration-300 hover:-translate-y-2'
                            )}
                        >
                            {tier.featured && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                    <span className="bg-amber-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg shadow-amber-500/30 flex items-center gap-1">
                                        <Sparkles className="h-3 w-3" /> {tier.highlight}
                                    </span>
                                </div>
                            )}

                            {tier.featured && (
                                <div className="absolute inset-0 bg-gradient-to-b from-amber-50/50 to-white dark:from-amber-950/20 dark:to-zinc-900/80 -z-10 rounded-[2rem]" />
                            )}

                            <div>
                                <div className="flex items-center justify-between gap-x-4">
                                    <h3
                                        id={tier.id}
                                        className={cn(
                                            tier.featured ? 'text-amber-700 dark:text-amber-500' : 'text-gray-900 dark:text-white',
                                            'text-2xl font-bold leading-8'
                                        )}
                                    >
                                        {tier.name}
                                    </h3>
                                </div>
                                <p className="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-300 h-10">
                                    {tier.description}
                                </p>
                                <p className="mt-6 flex items-baseline gap-x-1">
                                    <span className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                                        {tier.priceMonthly}
                                    </span>
                                    {tier.priceSuffix && (
                                        <span className="text-sm font-semibold leading-6 text-gray-600 dark:text-gray-400">
                                            {tier.priceSuffix}
                                        </span>
                                    )}
                                    {tier.priceSuffix && (
                                        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 ml-1">
                                            + GST
                                        </span>
                                    )}
                                </p>
                                <Button
                                    asChild
                                    variant={tier.featured ? 'default' : 'outline'}
                                    className={cn(
                                        "mt-8 w-full rounded-full py-6 font-semibold shadow-md transition-all",
                                        tier.featured
                                            ? "bg-amber-600 hover:bg-amber-700 hover:shadow-amber-500/25 dark:bg-amber-600 dark:hover:bg-amber-500"
                                            : "hover:bg-gray-50 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800"
                                    )}
                                >
                                    <a href={tier.href}>Get started today</a>
                                </Button>

                                <ul role="list" className="mt-10 space-y-4 text-sm leading-6 text-gray-600 dark:text-gray-300">
                                    {tier.features.map((feature) => (
                                        <li key={feature} className="flex gap-x-3 items-start">
                                            <Check className="h-6 w-5 flex-none text-amber-600 dark:text-amber-500" aria-hidden="true" />
                                            {feature}
                                        </li>
                                    ))}
                                    {tier.notIncluded?.map((feature) => (
                                        <li key={feature} className="flex gap-x-3 items-start text-gray-400 dark:text-gray-500">
                                            <X className="h-6 w-5 flex-none text-gray-400 dark:text-gray-600" aria-hidden="true" />
                                            <span className="line-through">{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Add-on Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="mx-auto mt-12 max-w-2xl rounded-[2rem] bg-amber-50 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/5 dark:ring-amber-500/20 sm:mt-16 lg:mx-0 lg:flex lg:max-w-none shadow-sm"
                >
                    <div className="p-8 sm:p-10 lg:flex-auto">
                        <h3 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Setup & Training Add-on</h3>
                        <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-gray-300">
                            Skip the learning curve. Our team will handle the initial software configuration, data import, and provide a comprehensive training session for your staff so you can hit the ground running.
                        </p>
                        <div className="mt-8 flex items-center gap-x-4">
                            <h4 className="flex-none text-sm font-semibold leading-6 text-amber-700 dark:text-amber-500">What's included</h4>
                            <div className="h-px flex-auto bg-gray-100 dark:bg-zinc-800" />
                        </div>
                        <ul role="list" className="mt-8 grid grid-cols-1 gap-4 text-sm leading-6 text-gray-600 dark:text-gray-300 sm:grid-cols-2 sm:gap-6">
                            <li className="flex gap-x-3">
                                <Check className="h-6 w-5 flex-none text-amber-600 dark:text-amber-500" aria-hidden="true" />
                                Initial account configuration
                            </li>
                            <li className="flex gap-x-3">
                                <Check className="h-6 w-5 flex-none text-amber-600 dark:text-amber-500" aria-hidden="true" />
                                Machine and worker data import
                            </li>
                            <li className="flex gap-x-3">
                                <Check className="h-6 w-5 flex-none text-amber-600 dark:text-amber-500" aria-hidden="true" />
                                1-on-1 staff training session (Virtual)
                            </li>
                            <li className="flex gap-x-3">
                                <Check className="h-6 w-5 flex-none text-amber-600 dark:text-amber-500" aria-hidden="true" />
                                Dedicated onboarding manager
                            </li>
                        </ul>
                    </div>
                    <div className="-mt-2 p-2 lg:mt-0 lg:w-full lg:max-w-md lg:flex-shrink-0">
                        <div className="rounded-[1.5rem] bg-white dark:bg-zinc-900/80 py-10 text-center ring-1 ring-inset ring-gray-900/5 dark:ring-white/10 lg:flex lg:flex-col lg:justify-center lg:py-16 h-full shadow-md">
                            <div className="mx-auto max-w-xs px-8">
                                <p className="text-base font-semibold text-gray-600 dark:text-gray-300">One-time payment</p>
                                <p className="mt-6 flex items-baseline justify-center gap-x-2">
                                    <span className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white">₹4,999</span>
                                    <span className="text-sm font-medium text-gray-400 dark:text-gray-500">+ GST</span>
                                </p>
                                <Button className="mt-10 w-full bg-amber-600 hover:bg-amber-700 text-white rounded-full py-6 font-semibold shadow-md dark:bg-amber-600 dark:hover:bg-amber-500 transition-all hover:-translate-y-1">
                                    Add Setup Service
                                </Button>
                                <p className="mt-4 text-xs leading-5 text-gray-500">
                                    Optional. Invoices and receipts available.
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
