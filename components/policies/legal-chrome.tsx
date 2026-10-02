import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import LandingFooter from '@/components/landing/footer'
import { Beam, Eyebrow } from '@/components/landing/beam'
import { landingFontVariables } from '@/components/landing/fonts'
import s from '@/components/landing/landing.module.css'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'

const legalLinks = [
    { name: 'Terms', href: '/terms' },
    { name: 'Privacy', href: '/privacy' },
    { name: 'Refunds', href: '/refund-policy' },
] as const

export type LegalPath = (typeof legalLinks)[number]['href'] | '/privacy-request' | '/security-incident'

/**
 * Shared chrome for the public policy pages. It uses the landing page's type,
 * colour and warp lines, and a black header panel in the navbar's proportions.
 * It is a separate component: the landing navbar itself is not reused here,
 * because its links are in-page anchors.
 */
export function LegalShell({ active, children }: { active: LegalPath; children: ReactNode }) {
    return (
        <div className={cn(s.page, landingFontVariables, 'min-h-screen')}>
            <header className="safe-area-header sticky top-0 z-40 bg-[var(--lp-paper)] [--page-gutter-x:0.75rem] xs:[--page-gutter-x:1rem] sm:[--page-gutter-x:1.5rem] lg:[--page-gutter-x:2rem]">
                <div className={cn(s.legalBar, 'mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-b-xl px-3 py-1.5 xs:px-4 md:px-6 lg:px-8')}>
                    <Link href="/" aria-label="Weavly home" className="relative block h-11 w-28 shrink-0 transition-opacity hover:opacity-80 sm:h-14 sm:w-36">
                        <Image src="/images/WeavlyLogo.png" alt="" fill sizes="9rem" className="object-contain object-left" priority />
                    </Link>
                    <nav aria-label="Legal pages" className="order-last flex w-full items-center justify-center gap-0.5 sm:order-none sm:w-auto sm:gap-2">
                        {legalLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                aria-current={active === link.href ? 'page' : undefined}
                                className={s.legalLink}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </nav>
                    <LanguageSwitcher placement="bottom" className="min-h-[44px] text-white/80 hover:text-white hover:bg-white/10" />
                    {/* Wrapped: the module's display rule would otherwise beat Tailwind's `hidden`. */}
                    <span className="hidden md:block">
                        <Link href="/" className={s.legalLink}>
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            Weavly home
                        </Link>
                    </span>
                </div>
            </header>
            <main>{children}</main>
            <LandingFooter />
        </div>
    )
}

export function LegalHero({
    eyebrow,
    title,
    description,
    children,
}: {
    eyebrow: string
    title: string
    description: ReactNode
    children?: ReactNode
}) {
    return (
        <Beam labelledBy="legal-title" innerClassName="pb-10 pt-12 sm:pb-12 sm:pt-16 lg:pt-20">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 id="legal-title" className={cn(s.display, 'mt-5 max-w-[48rem] text-[36px] font-semibold leading-[1.05] text-[color:var(--lp-ink)] sm:text-[52px]')}>
                {title}
            </h1>
            <p className="mt-5 max-w-[42rem] text-[17px] leading-[1.6] text-[color:var(--lp-body)] sm:text-[18px]">{description}</p>
            {children}
        </Beam>
    )
}
