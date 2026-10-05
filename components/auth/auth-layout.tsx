'use client'

import { useTranslation } from '@/lib/i18n/context'
import { freeMobileEntryText } from '@/lib/i18n/free-mobile-entry'
import { cn } from '@/lib/utils'
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
    compactMobile?: boolean
}

export default function AuthLayout({ children, title, subtitle, compactMobile = true }: AuthLayoutProps) {
    const { language } = useTranslation()
    return (
        <div className="safe-area-page relative isolate flex min-h-svh w-full items-center justify-center overflow-hidden bg-background [--page-gutter-x:0.75rem] [--page-gutter-y:1rem] xs:[--page-gutter-x:1rem]">
            <BrandBackground variant="auth" />
            <div className={cn("absolute right-[calc(var(--page-gutter-x)+var(--safe-area-right))] top-[calc(0.75rem+var(--safe-area-top))] z-20", compactMobile && "max-sm:hidden")}>
                <LanguageSwitcher placement="bottom" className="border border-[var(--wv-border-subtle)] bg-surface text-ink shadow-sm hover:border-[var(--wv-border-control)]" />
            </div>

            {/* Keep auth content visible in server HTML, before hydration. */}
            <div className="relative z-10 w-full max-w-[440px]">
                <div className={cn("overflow-hidden rounded-2xl border border-[var(--wv-border-default)] bg-surface shadow-[var(--shadow-panel)]", compactMobile && "max-sm:overflow-visible")}>
                    <div className={cn("p-5 pb-3 text-center xs:p-6 xs:pb-4 sm:p-8 sm:pb-4", compactMobile && "max-sm:p-4 max-sm:pb-3")}>
                        {/* App Logo */}
                        <div className={cn(compactMobile && "max-sm:mb-3 max-sm:flex max-sm:flex-wrap max-sm:items-center max-sm:justify-between max-sm:gap-3")}>
                        <div className={cn("relative mx-auto mb-2 flex h-24 w-40 items-center justify-center group cursor-default", compactMobile && "max-sm:mx-0 max-sm:mb-0 max-sm:h-12 max-sm:w-28 max-sm:max-w-full max-sm:shrink-0")}>
                            <div data-weavly-intro-target="app-login" className="relative h-full w-full">
                                <Image src="/images/WeavlyLogo.png" alt="Weavly Logo" fill sizes="10rem" className="object-contain transition-transform group-hover:scale-105 duration-500" priority />
                            </div>
                        </div>

                        {compactMobile && <LanguageSwitcher align="right" placement="bottom" className="min-h-[44px] border border-[var(--wv-border-subtle)] bg-surface text-ink sm:hidden" />}
                        </div>

                        <h1 className="mb-2 text-2xl font-semibold tracking-normal text-ink">
                            {title}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {subtitle}
                        </p>
                    </div>

                    <div className={cn("px-5 pb-6 xs:px-6 xs:pb-8 sm:px-8 sm:pb-10", compactMobile && "max-sm:px-4 max-sm:pb-5 max-sm:[&_input:not([type=checkbox])]:min-h-[44px] max-sm:[&_input:not([type=checkbox])]:h-auto max-sm:[&_button]:min-h-[44px] max-sm:[&_[data-slot=button]]:min-h-[44px] max-sm:[&_[data-slot=button]]:h-auto max-sm:[&_[data-slot=button]]:whitespace-normal")}>
                        {children}
                        <Link href="/install" className="mt-3 flex min-h-[44px] sm:min-h-0 sm:block items-center justify-center rounded py-2 sm:mt-5 text-center text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">
                            {freeMobileEntryText(language, 'installApp')}
                        </Link>
                    </div>
                </div>

                {/* Footer branding */}
                <div className={cn("mt-8 text-center", compactMobile && "max-sm:mt-4")}>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground">
                        Weavly &copy; {getSuratDate().getFullYear()} &bull; Built for India
                    </p>
                </div>
            </div>
        </div>
    )
}
