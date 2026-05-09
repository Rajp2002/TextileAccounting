'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'
import Image from 'next/image'
import { getSuratDate } from '@/lib/time'
import { BrandBackground } from '@/components/brand-background'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'

interface AuthLayoutProps {
    children: ReactNode
    title: string
    subtitle: string
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
    return (
        <div className="relative isolate flex min-h-[100svh] w-full items-center justify-center overflow-hidden bg-background p-4">
            <BrandBackground variant="auth" />
            <div className="absolute right-4 top-4 z-20">
                <LanguageSwitcher placement="bottom" className="bg-surface/80 text-ink shadow-sm backdrop-blur hover:bg-surface" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 w-full max-w-[440px]"
            >
                <div className="overflow-hidden rounded-2xl border border-hairline bg-surface/88 shadow-[var(--shadow-panel)] backdrop-blur-xl">
                    <div className="p-8 pb-4 text-center">
                        {/* App Logo */}
                        <div className="mx-auto mb-2 h-24 w-40 relative flex items-center justify-center group cursor-default">
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2, duration: 0.5 }}
                                className="relative h-full w-full"
                            >
                                <Image src="/images/WeavlyLogo.png" alt="Weavly Logo" fill sizes="10rem" className="object-contain transition-transform group-hover:scale-105 duration-500" priority />
                            </motion.div>
                        </div>

                        <motion.h1 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="mb-2 text-2xl font-semibold tracking-normal text-ink"
                        >
                            {title}
                        </motion.h1>
                        <motion.p 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="text-sm text-muted-foreground"
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
                    <p className="text-xs font-medium tracking-wide text-muted-foreground">
                        Weavly &copy; {getSuratDate().getFullYear()} &bull; Built for India
                    </p>
                </motion.div>
            </motion.div>
        </div>
    )
}
