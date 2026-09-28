import Link from 'next/link'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Beam } from '@/components/landing/beam'
import s from '@/components/landing/landing.module.css'
import { LegalHero, LegalShell } from './legal-chrome'

type PolicyFact = {
    label: string
    value: string
    icon: LucideIcon
}

type PolicySectionLink = {
    href: string
    title: string
}

type PolicyPageProps = {
    activePath: '/privacy' | '/terms' | '/refund-policy'
    title: string
    description: string
    lastUpdated: string
    facts: PolicyFact[]
    sections: PolicySectionLink[]
    children: ReactNode
}

function SectionLinks({ sections, title }: { sections: PolicySectionLink[]; title: string }) {
    return (
        <nav aria-label={`${title} sections`}>
            <ol className="grid list-none gap-0.5">
                {sections.map((section) => (
                    <li key={section.href}>
                        <a
                            href={section.href}
                            className="flex min-h-[40px] items-center rounded-md px-2 py-2 text-[14px] leading-5 text-[color:var(--lp-body)] transition-colors hover:bg-[color:var(--lp-paper-deep)] hover:text-[color:var(--lp-ink)]"
                        >
                            {section.title}
                        </a>
                    </li>
                ))}
            </ol>
        </nav>
    )
}

export function PolicyPage({
    activePath,
    title,
    description,
    lastUpdated,
    facts,
    sections,
    children,
}: PolicyPageProps) {
    const nextLegalLink =
        activePath === '/privacy'
            ? { href: '/terms', label: 'Review service terms' }
            : activePath === '/terms'
                ? { href: '/refund-policy', label: 'Review refund rules' }
                : { href: '/privacy', label: 'Review privacy commitments' }

    return (
        <LegalShell active={activePath}>
            <LegalHero eyebrow="Weavly legal" title={title} description={description}>
                <dl className="mt-10 grid gap-px border-y-2 border-[color:var(--lp-ink)] bg-[color:var(--lp-line)] sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
                    {[{ label: 'Last updated', value: lastUpdated, icon: null }, ...facts].map((fact) => {
                        const Icon = fact.icon
                        return (
                            <div key={`${fact.label}-${fact.value}`} className="min-w-0 bg-[color:var(--lp-paper)] py-4 pr-3 sm:px-3">
                                <dt className={cn(s.label, 'flex items-center gap-2 text-[color:var(--lp-muted)]')}>
                                    {Icon && <Icon className="h-3.5 w-3.5 text-[color:var(--lp-saffron-ink)]" aria-hidden="true" />}
                                    {fact.label}
                                </dt>
                                <dd className="mt-1.5 break-words text-[14px] font-semibold leading-6 text-[color:var(--lp-ink)]">{fact.value}</dd>
                            </div>
                        )
                    })}
                </dl>
            </LegalHero>

            <Beam innerClassName="pb-20 sm:pb-24">
                <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
                    <aside className="hidden lg:block">
                        <div className="sticky top-28">
                            <p className={cn(s.label, 'mb-3 px-2 text-[color:var(--lp-muted)]')}>In this document</p>
                            <SectionLinks sections={sections} title={title} />
                        </div>
                    </aside>

                    <div className={cn(s.legalBody, 'min-w-0 max-w-[46rem]')}>
                        <details className={cn(s.faq, 'mb-8 rounded-[10px] border border-[color:var(--lp-line-strong)] bg-[color:var(--lp-sheet)] lg:hidden')}>
                            <summary className="flex min-h-[48px] items-center justify-between px-4 text-[15px] font-semibold text-[color:var(--lp-ink)]">
                                In this document
                                <ChevronDown className={cn(s.marker, 'h-4 w-4 text-[color:var(--lp-muted)]')} aria-hidden="true" />
                            </summary>
                            <div className="border-t border-[color:var(--lp-line)] px-2 py-2">
                                <SectionLinks sections={sections} title={title} />
                            </div>
                        </details>

                        {children}

                        <div className="mt-12 flex flex-col gap-3 border-t-2 border-[color:var(--lp-ink)] pt-6 text-[15px] text-[color:var(--lp-body)] sm:flex-row sm:items-center sm:justify-between">
                            <span>Need a different legal page?</span>
                            <Link href={nextLegalLink.href} className={cn(s.textLink, 'inline-flex items-center gap-2')}>
                                {nextLegalLink.label}
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </Link>
                        </div>
                    </div>
                </div>
            </Beam>
        </LegalShell>
    )
}

export function PolicySection({
    id,
    title,
    children,
}: {
    id: string
    title: string
    children: ReactNode
}) {
    return (
        <section id={id} className="scroll-mt-28 border-t border-[color:var(--lp-line)] py-10 first:border-t-0 first:pt-0">
            <h2 className={cn(s.display, 'text-[24px] font-semibold leading-tight text-[color:var(--lp-ink)] sm:text-[28px]')}>{title}</h2>
            <div className={cn('prose mt-5', s.legalProse)}>{children}</div>
        </section>
    )
}

const calloutTones = {
    blue: s.calloutBlue,
    amber: s.calloutAmber,
    red: s.calloutRed,
    neutral: s.calloutNeutral,
} as const

export function PolicyCallout({
    tone = 'neutral',
    title,
    children,
}: {
    tone?: keyof typeof calloutTones
    title: string
    children: ReactNode
}) {
    return (
        <div className={cn('not-prose my-7 p-5', s.callout, calloutTones[tone])}>
            <p className="text-[15px] font-semibold">{title}</p>
            <div className="mt-3 space-y-3 text-[15px] leading-[1.65] [&_li]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1.5">
                {children}
            </div>
        </div>
    )
}

export function PolicyContactPanel({
    title,
    rows,
    note,
}: {
    title: string
    rows: Array<{ label: string; value: ReactNode }>
    note?: ReactNode
}) {
    return (
        <div className={cn(s.sheet, 'not-prose my-7 rounded-[12px] p-5 sm:p-6')}>
            <p className="text-[15px] font-semibold text-[color:var(--lp-ink)]">{title}</p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                {rows.map((row) => (
                    <div key={row.label} className="min-w-0">
                        <dt className={cn(s.label, 'text-[color:var(--lp-muted)]')}>{row.label}</dt>
                        <dd className="mt-1 break-words text-[15px] font-semibold text-[color:var(--lp-ink)]">{row.value}</dd>
                    </div>
                ))}
            </dl>
            {note && (
                <div className="mt-5 border-t border-[color:var(--lp-line)] pt-4 text-[14px] leading-6 text-[color:var(--lp-body)]">
                    {note}
                </div>
            )}
        </div>
    )
}
