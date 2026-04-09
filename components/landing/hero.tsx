'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export default function LandingHero() {
    return (
        <div className="relative isolate overflow-hidden pt-14">
            <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 sm:pb-32 lg:px-8 lg:py-32">
                <div className="mx-auto max-w-3xl text-center">
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={{
                            hidden: { opacity: 0, y: 30 },
                            visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
                        }}
                    >
                        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="mt-24 sm:mt-32 lg:mt-16">
                            <a href="#" className="inline-flex space-x-6">
                                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-sm font-semibold leading-6 text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:text-amber-500 dark:ring-amber-500/20 dark:bg-amber-500/10">
                                    What's new
                                </span>
                                <span className="inline-flex items-center space-x-2 text-sm font-medium leading-6 text-gray-600 dark:text-gray-300 group">
                                    <span>Just shipped v1.0</span>
                                    <ArrowRight className="h-4 w-4 text-gray-400 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                                </span>
                            </a>
                        </motion.div>

                        <motion.h1
                            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                            className="mt-10 text-5xl font-extrabold tracking-tight text-gray-900 sm:text-7xl dark:text-white leading-[1.1]"
                        >
                            Optimize your <br />textile production <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-500 dark:to-orange-500 block mt-2">in real-time</span>
                        </motion.h1>

                        <motion.p
                            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                            className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-2xl mx-auto"
                        >
                            Track production, manage workers, and automate daily reporting. The all-in-one SaaS platform built specifically for modern textile manufacturers.
                        </motion.p>

                        <motion.div
                            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                            className="mt-10 space-y-4"
                        >
                            {/* Two-path CTAs */}
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <Link href="/signup" className="flex-1 sm:flex-none">
                                    <Button
                                        id="hero-owner-signup-btn"
                                        size="lg"
                                        className="w-full sm:w-auto rounded-full px-7 py-6 text-base font-semibold bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 shadow-xl shadow-gray-900/10 dark:shadow-white/10 transition-all hover:-translate-y-1 hover:scale-105"
                                    >
                                        Start as owner
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                                <Link href="/join" className="flex-1 sm:flex-none">
                                    <Button
                                        id="hero-supervisor-join-btn"
                                        size="lg"
                                        variant="outline"
                                        className="w-full sm:w-auto rounded-full px-7 py-6 text-base font-semibold border-2 border-gray-300 hover:border-amber-500 hover:text-amber-700 dark:border-zinc-600 dark:hover:border-amber-500 dark:text-white transition-all hover:-translate-y-1"
                                    >
                                        Join as supervisor
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                            <div className="flex items-center justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                <p>Already have an account?{' '}
                                    <Link href="/login" className="text-amber-700 hover:underline font-medium dark:text-amber-500">
                                        Log in
                                    </Link>
                                </p>
                            </div>
                        </motion.div>
                    </motion.div>
                </div>
            </div>

            {/* Bottom Gradient Blob */}
            <div className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]" aria-hidden="true">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1.5, delay: 0.5 }}
                    className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-[#f59e0b] to-[#c2410c] opacity-20 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem] dark:opacity-30"
                    style={{
                        clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
                    }}
                />
            </div>
        </div>
    )
}
