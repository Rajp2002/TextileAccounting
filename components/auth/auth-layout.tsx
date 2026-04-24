'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'
import Image from 'next/image'
import { getSuratDate } from '@/lib/time'

interface AuthLayoutProps {
    children: ReactNode
    title: string
    subtitle: string
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
    return (
        <div className="relative min-h-[100svh] w-full overflow-hidden bg-white dark:bg-zinc-950 flex items-center justify-center p-4">
            {/* Premium Decorative background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-amber-500/10 blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-orange-600/10 blur-[120px] animate-pulse [animation-delay:2s]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.05)_0%,transparent_70%)]" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 w-full max-w-[440px]"
            >
                <div className="backdrop-blur-2xl bg-white/80 dark:bg-zinc-900/80 border border-white/50 dark:border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] rounded-[2.5rem] overflow-hidden">
                    <div className="p-8 pb-4 text-center">
                        {/* App Logo */}
                        <div className="mx-auto mb-2 h-24 w-40 relative flex items-center justify-center group cursor-default">
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2, duration: 0.5 }}
                                className="relative h-full w-full"
                            >
                                <Image src="/images/WeavlyLogo.png" alt="Weavly Logo" fill className="object-contain transition-transform group-hover:scale-105 duration-500" priority />
                            </motion.div>
                        </div>

                        <motion.h1 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-2"
                        >
                            {title}
                        </motion.h1>
                        <motion.p 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="text-sm text-gray-500 dark:text-gray-400"
                        >
                            {subtitle}
                        </motion.p>
                    </div>

                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="px-8 pb-10"
                    >
                        {children}
                    </motion.div>
                </div>

                {/* Footer branding */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-8 text-center"
                >
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium tracking-wide">
                        Weavly &copy; {getSuratDate().getFullYear()} &bull; Built for India
                    </p>
                </motion.div>
            </motion.div>
        </div>
    )
}
