import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import LandingFooter from '@/components/landing/footer'

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

const legalLinks = [
    { name: 'Terms', href: '/terms' },
    { name: 'Privacy', href: '/privacy' },
    { name: 'Refunds', href: '/refund-policy' },
] as const

function linkClasses(isActive: boolean) {
    return [
        'inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-200',
        isActive
            ? 'bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950'
            : 'text-zinc-600 hover:bg-white hover:text-zinc-950 hover:shadow-sm dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white',
    ].join(' ')
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
        <main className="min-h-screen bg-white text-zinc-950 selection:bg-orange-200 selection:text-zinc-950 dark:bg-zinc-950 dark:text-white">
            <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/90 shadow-sm shadow-zinc-950/[0.03] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/85">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
                    <Link href="/" className="flex items-center transition-opacity hover:opacity-80" aria-label="Weavly home">
                        <span className="relative block h-11 w-32 sm:h-12 sm:w-36">
                            <Image
                                src="/images/WeavlyLogo.png"
                                alt="Weavly Logo"
                                fill
                                sizes="9rem"
                                className="object-contain object-left"
                                priority
                            />
                        </span>
                    </Link>

                    <nav className="hidden items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100/70 p-1 dark:border-white/10 dark:bg-white/5 md:flex" aria-label="Legal pages">
                        {legalLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={linkClasses(activePath === link.href)}
                                aria-current={activePath === link.href ? 'page' : undefined}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </nav>

                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:text-zinc-950 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-white"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        Home
                    </Link>
                </div>
            </header>

            <section className="relative isolate overflow-hidden bg-zinc-950 text-white">
                <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(to_right,rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.1)_1px,transparent_1px)] [background-size:36px_36px]" aria-hidden="true" />
                <div className="absolute -left-32 top-8 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" aria-hidden="true" />
                <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-amber-300/[0.07] blur-3xl" aria-hidden="true" />
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-orange-400/70 to-transparent" aria-hidden="true" />

                <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-center lg:px-8 lg:py-20">
                    <div className="max-w-3xl">
                        <Link
                            href="/"
                            className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-orange-200 transition-colors hover:text-white"
                        >
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            Back to Weavly
                        </Link>
                        <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-orange-300">Weavly legal</p>
                        <h1 className="bg-gradient-to-br from-white via-white to-zinc-400 bg-clip-text text-4xl font-bold leading-[1.05] text-transparent sm:text-5xl lg:text-6xl">
                            {title}
                        </h1>
                        <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
                            {description}
                        </p>
                    </div>

                    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        <div className="rounded-xl border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-black/20 backdrop-blur-md">
                            <dt className="text-sm font-semibold text-zinc-400">Last updated</dt>
                            <dd className="mt-1 text-xl font-bold text-white">{lastUpdated}</dd>
                        </div>
                        {facts.map((fact) => {
                            const Icon = fact.icon

                            return (
                                <div key={`${fact.label}-${fact.value}`} className="group rounded-xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-md transition-colors hover:border-orange-300/30 hover:bg-white/[0.1]">
                                    <dt className="flex items-center gap-2 text-sm font-semibold text-zinc-400">
                                        <Icon className="h-4 w-4 text-orange-300 transition-transform group-hover:scale-110" aria-hidden="true" />
                                        {fact.label}
                                    </dt>
                                    <dd className="mt-2 text-base font-semibold leading-6 text-white">{fact.value}</dd>
                                </div>
                            )
                        })}
                    </dl>
                </div>
            </section>

            <section className="border-b border-zinc-200 bg-gradient-to-r from-orange-50 via-[#f7f2e8] to-amber-50 dark:border-white/10 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900">
                <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8" aria-label="Legal page shortcuts">
                    {legalLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={linkClasses(activePath === link.href)}
                            aria-current={activePath === link.href ? 'page' : undefined}
                        >
                            {link.name}
                        </Link>
                    ))}
                </div>
            </section>

            <div className="bg-white dark:bg-zinc-950">
                <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:px-8">
                    <aside className="hidden border-r border-zinc-200 py-14 pr-8 dark:border-white/10 lg:block">
                        <div className="sticky top-28">
                            <p className="text-sm font-bold text-zinc-950 dark:text-white">In this document</p>
                            <nav className="mt-5 flex flex-col gap-1" aria-label={`${title} sections`}>
                                {sections.map((section) => (
                                    <a
                                        key={section.href}
                                        href={section.href}
                                        className="rounded-md px-3 py-2 text-sm font-medium leading-5 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
                                    >
                                        {section.title}
                                    </a>
                                ))}
                            </nav>
                        </div>
                    </aside>

                    <article className="min-w-0 py-10 sm:py-14 lg:py-16">
                        <div className="max-w-4xl">
                            {children}

                            <div className="mt-12 flex flex-col gap-3 border-t border-zinc-200 pt-8 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
                                <span>Need a different legal page?</span>
                                <Link href={nextLegalLink.href} className="inline-flex items-center gap-2 font-semibold text-orange-700 hover:text-orange-800 dark:text-orange-300 dark:hover:text-orange-200">
                                    {nextLegalLink.label}
                                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                </Link>
                            </div>
                        </div>
                    </article>
                </div>
            </div>

            <LandingFooter />
        </main>
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
        <section id={id} className="group scroll-mt-28 border-b border-zinc-200 py-10 first:pt-0 last:border-b-0 dark:border-white/10">
            <div className="flex items-start gap-4">
                <span className="mt-1 hidden h-8 w-1 shrink-0 rounded-full bg-gradient-to-b from-orange-400 to-amber-200 opacity-60 transition-opacity group-hover:opacity-100 sm:block" aria-hidden="true" />
                <h2 className="text-2xl font-bold leading-tight tracking-tight text-zinc-950 dark:text-white sm:text-3xl">
                    {title}
                </h2>
            </div>
            <div className="mt-5 max-w-none font-medium text-zinc-700 prose prose-zinc prose-p:leading-7 prose-p:text-zinc-700 prose-a:font-semibold prose-a:text-orange-700 prose-a:underline-offset-4 prose-strong:text-zinc-950 prose-h3:mt-8 prose-h3:text-xl prose-h3:font-bold prose-li:my-1 prose-ul:my-5 prose-ol:my-5 prose-table:text-sm prose-th:border-b prose-th:border-zinc-200 prose-th:pb-3 prose-th:font-bold prose-td:border-b prose-td:border-zinc-100 prose-td:py-3 dark:prose-invert dark:text-zinc-300 dark:prose-p:text-zinc-300 dark:prose-a:text-orange-300 dark:prose-strong:text-white dark:prose-th:border-white/10 dark:prose-td:border-white/10">
                {children}
            </div>
        </section>
    )
}

const calloutStyles = {
    blue: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-100',
    amber: 'border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-400/20 dark:bg-orange-400/10 dark:text-orange-100',
    red: 'border-red-200 bg-red-50 text-red-950 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100',
    neutral: 'border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100',
} as const

export function PolicyCallout({
    tone = 'neutral',
    title,
    children,
}: {
    tone?: keyof typeof calloutStyles
    title: string
    children: ReactNode
}) {
    return (
        <div className={`not-prose my-7 rounded-lg border p-5 ${calloutStyles[tone]}`}>
            <p className="text-sm font-bold">{title}</p>
            <div className="mt-3 space-y-3 text-sm font-medium leading-6 opacity-90">
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
        <div className="not-prose my-7 rounded-lg border border-zinc-200 bg-zinc-50 p-5 dark:border-white/10 dark:bg-white/5">
            <p className="text-sm font-bold text-zinc-950 dark:text-white">{title}</p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                {rows.map((row) => (
                    <div key={row.label}>
                        <dt className="text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400">{row.label}</dt>
                        <dd className="mt-1 break-words text-base font-semibold text-zinc-900 dark:text-white">{row.value}</dd>
                    </div>
                ))}
            </dl>
            {note && (
                <div className="mt-5 border-t border-zinc-200 pt-4 text-sm font-medium leading-6 text-zinc-600 dark:border-white/10 dark:text-zinc-300">
                    {note}
                </div>
            )}
        </div>
    )
}
