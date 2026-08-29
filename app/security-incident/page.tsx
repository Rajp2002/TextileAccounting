import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { AlertTriangle, ArrowLeft, Clock3, KeyRound, Mail, ShieldAlert } from 'lucide-react'
import LandingFooter from '@/components/landing/footer'
import { LEGAL_OPERATOR } from '@/lib/legal-operator'
import {
    BASE_SECURITY_INCIDENT_DATA_CATEGORIES,
    buildSecurityIncidentMailto,
    SECURITY_INCIDENT_REPORT_CATEGORIES,
    SECURITY_INCIDENT_SERVICE_LEVEL,
} from '@/lib/security-incident'

export const metadata: Metadata = {
    title: 'Report a Security Incident — Weavly',
    description: 'How to report a suspected account or data-security incident affecting a Weavly Lite or Base workspace.',
}

export default function SecurityIncidentPage() {
    return (
        <main className="min-h-screen bg-white text-zinc-950 dark:bg-zinc-950 dark:text-white">
            <header className="border-b border-zinc-200 bg-white/95 dark:border-white/10 dark:bg-zinc-950/95">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
                    <Link href="/" aria-label="Weavly home" className="relative block h-11 w-32">
                        <Image src="/images/WeavlyLogo.png" alt="Weavly Logo" fill sizes="8rem" className="object-contain object-left" priority />
                    </Link>
                    <Link href="/privacy" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        Privacy Policy
                    </Link>
                </div>
            </header>

            <section className="border-b border-red-400/20 bg-zinc-950 text-white">
                <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">Weavly security channel</p>
                    <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Report a suspected security incident</h1>
                    <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">
                        Use this monitored channel for suspicious account activity, possible unauthorized access, billing-reference concerns, impersonation, or a potential vulnerability affecting Weavly.
                    </p>
                </div>
            </section>

            <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-8">
                <div className="space-y-10">
                    <section>
                        <h2 className="text-2xl font-bold">Choose the closest report type</h2>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            {SECURITY_INCIDENT_REPORT_CATEGORIES.map((category) => (
                                <a key={category.value} href={buildSecurityIncidentMailto(category.label)} className="flex items-start gap-3 rounded-xl border border-zinc-200 p-4 font-semibold text-zinc-800 transition-colors hover:border-red-300 hover:bg-red-50 dark:border-white/10 dark:text-zinc-100 dark:hover:border-red-300/40 dark:hover:bg-red-400/10">
                                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-300" aria-hidden="true" />
                                    {category.label}
                                </a>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                        <div className="flex items-center gap-3">
                            <KeyRound className="h-6 w-6" aria-hidden="true" />
                            <h2 className="text-xl font-bold">If you suspect account compromise</h2>
                        </div>
                        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm font-medium leading-6">
                            <li>Change your Weavly password from a trusted device and do not reuse the old password.</li>
                            <li>Secure the email account connected to Weavly and review it for unfamiliar access.</li>
                            <li>Send the report promptly with the time you noticed the activity and any safe, relevant reference.</li>
                        </ol>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold">What this channel covers at launch</h2>
                        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                            {BASE_SECURITY_INCIDENT_DATA_CATEGORIES.map((category) => (
                                <li key={category} className="rounded-lg border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 dark:border-white/10 dark:text-zinc-300">{category}</li>
                            ))}
                        </ul>
                        <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                            Weavly Lite stores costing records, qualities, rates, and account data. Weavly Base additionally stores owner-run production records, piece-rate workers, advances, and basic settlement data. Report incidents affecting either workspace through this channel.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-white/10 dark:bg-white/5">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                            <h2 className="text-xl font-bold">Send only what is safe and necessary</h2>
                        </div>
                        <p className="mt-4 text-sm font-medium leading-6 text-zinc-700 dark:text-zinc-300">
                            Include your organization, registered email, when you noticed the issue, a concise description, and a relevant costing, billing, or support reference. Do not send passwords, OTPs, card or bank credentials, government ID numbers, private keys, or active exploit instructions by email.
                        </p>
                    </section>
                </div>

                <aside className="h-fit rounded-2xl border border-red-200 bg-red-50 p-6 text-zinc-950 lg:sticky lg:top-6 dark:border-red-400/20 dark:bg-red-400/10 dark:text-white">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-800 dark:text-red-200">Monitored security contact</p>
                    <a href={buildSecurityIncidentMailto()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 py-3 text-sm font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200">
                        <Mail className="h-4 w-4" aria-hidden="true" />
                        Start a security report
                    </a>
                    <a href={`mailto:${LEGAL_OPERATOR.contactEmail}`} className="mt-4 block break-all text-center text-sm font-semibold text-red-800 underline underline-offset-4 dark:text-red-200">{LEGAL_OPERATOR.contactEmail}</a>
                    <div className="mt-5 flex gap-3 border-t border-red-200 pt-5 text-sm leading-6 dark:border-red-400/20">
                        <Clock3 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                        <p>We aim to acknowledge a report within {SECURITY_INCIDENT_SERVICE_LEVEL.acknowledgementBusinessDays} business day. This service target does not replace any faster legal reporting clock that may apply to us.</p>
                    </div>
                </aside>
            </div>

            <LandingFooter />
        </main>
    )
}
