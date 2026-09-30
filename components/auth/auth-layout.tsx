'use client'

import { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
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
        <div className="relative isolate flex min-h-[100svh] w-full items-center justify-center overflow-hidden bg-background px-3 py-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] xs:p-4">
            <BrandBackground variant="auth" />
            <div className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-20 xs:right-4">
                <LanguageSwitcher placement="bottom" className="border border-[var(--wv-border-subtle)] bg-surface text-ink shadow-sm hover:border-[var(--wv-border-control)]" />
            </div>

            {/* Keep auth content visible in server HTML, before hydration. */}
            <div className="relative z-10 w-full max-w-[440px]">
                <div className="overflow-hidden rounded-2xl border border-[var(--wv-border-default)] bg-surface shadow-[var(--shadow-panel)]">
                    <div className="p-5 pb-3 text-center xs:p-6 xs:pb-4 sm:p-8 sm:pb-4">
                        {/* App Logo */}
                        <div className="mx-auto mb-2 h-24 w-40 relative flex items-center justify-center group cursor-default">
                            <div data-weavly-intro-target="app-login" className="relative h-full w-full">
                                <Image src="/images/WeavlyLogo.png" alt="Weavly Logo" fill sizes="10rem" className="object-contain transition-transform group-hover:scale-105 duration-500" priority />
                            </div>
                        </div>

                        <h1 className="mb-2 text-2xl font-semibold tracking-normal text-ink">
                            {title}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {subtitle}
                        </p>
                    </div>

                    <div className="px-5 pb-6 xs:px-6 xs:pb-8 sm:px-8 sm:pb-10">
                        {children}
                        <Link href="/install" className="mt-5 block rounded py-2 text-center text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">
                            Install Weavly on desktop or mobile
                        </Link>
                    </div>
                </div>

                {/* Footer branding */}
                <div className="mt-8 text-center">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground">
                        Weavly &copy; {getSuratDate().getFullYear()} &bull; Built for India
                    </p>
                </div>
            </div>
        </div>
    )
}
