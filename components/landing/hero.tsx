'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { ArrowRight, PlayCircle } from 'lucide-react'

export default function LandingHero() {
    return (
        <div className="relative isolate overflow-hidden bg-white dark:bg-zinc-950 pt-14">
            {/* Animated Background Gradients */}
            <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#f59e0b] to-[#c2410c] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem] dark:opacity-30"
                    style={{
                        clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
                    }}
                />
            </div>

            {/* Subtle Grid Pattern overlay */}
            <svg
                className="absolute inset-0 -z-10 h-full w-full stroke-gray-200/50 [mask-image:radial-gradient(100%_100%_at_top_center,white,transparent)] dark:stroke-zinc-800/50"
                aria-hidden="true"
            >
                <defs>
                    <pattern id="grid-pattern" width={40} height={40} x="50%" y={-1} patternUnits="userSpaceOnUse">
                        <path d="M40 40V.5M.5 .5H40" fill="none" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" strokeWidth={0} fill="url(#grid-pattern)" />
            </svg>

            <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 sm:pb-32 lg:flex lg:px-8 lg:py-32 lg:items-center">
                <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-xl lg:flex-shrink-0 lg:pt-8">
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
                            className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-lg"
                        >
                            Track production, manage workers, and automate daily reporting. The all-in-one SaaS platform built specifically for modern textile manufacturers.
                        </motion.p>

                        <motion.div
                            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                            className="mt-10 space-y-4"
                        >
                            {/* Two-path CTAs (F1 spec §6) */}
                            <div className="flex flex-col sm:flex-row gap-3">
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
                            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                <p>Already have an account?{' '}
                                    <Link href="/login" className="text-amber-700 hover:underline font-medium dark:text-amber-500">
                                        Log in
                                    </Link>
                                </p>
                                <span className="hidden sm:inline text-gray-300 dark:text-zinc-700">•</span>
                                <Link href="#demo" className="hidden sm:flex items-center gap-1.5 hover:text-gray-700 transition-colors group">
                                    <PlayCircle className="h-4 w-4 text-gray-400 group-hover:text-amber-600 transition-colors" />
                                    Watch demo
                                </Link>
                            </div>
                        </motion.div>
                    </motion.div>
                </div>

                <div className="mt-10 w-full overflow-hidden sm:mt-16 lg:ml-10 lg:mt-0 lg:mr-0 lg:flex-none xl:ml-32">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 40 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{
                            duration: 1,
                            delay: 0.2,
                            type: "spring",
                            bounce: 0.2
                        }}
                        className="relative w-full lg:max-w-none"
                    >
                        {/* Glow Behind the Image */}
                        <div className="absolute -inset-x-4 -inset-y-4 z-0 bg-gradient-to-tr from-amber-500/20 to-orange-500/20 blur-2xl rounded-[3rem] opacity-50 dark:opacity-40" />

                        <div className="relative z-10 -m-2 rounded-2xl bg-gray-900/5 p-2 ring-1 ring-inset ring-gray-900/10 lg:-m-4 lg:rounded-[2rem] lg:p-4 dark:bg-white/5 dark:ring-white/10 backdrop-blur-sm">
                            <motion.div
                                animate={{ y: [0, -10, 0] }}
                                transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                                className="relative group overflow-hidden rounded-xl shadow-2xl ring-1 ring-gray-900/10 dark:ring-white/10"
                            >
                                <video
                                    src="/videos/hero-tutorial.mov"
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    className="w-full max-w-[76rem] object-cover transition-transform duration-500 group-hover:scale-[1.01]"
                                >
                                    Your browser does not support the video tag.
                                </video>
                                <div className="absolute inset-0 bg-black/5 pointer-events-none" />
                                <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 flex items-center justify-between pointer-events-none">
                                    <div className="px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-[10px] font-medium text-white tracking-wider uppercase">
                                        Product Preview
                                    </div>
                                </div>
                            </motion.div>
                        </div>
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
