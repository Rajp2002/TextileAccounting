import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, CheckCircle2, Clock3, Mail, ShieldCheck } from 'lucide-react'
import LandingFooter from '@/components/landing/footer'
import { LEGAL_OPERATOR } from '@/lib/legal-operator'
import {
    buildPrivacyRequestMailto,
    PRIVACY_REQUEST_CATEGORIES,
    PRIVACY_REQUEST_SERVICE_LEVEL,
} from '@/lib/privacy-request'

export const metadata: Metadata = {
    title: 'Privacy & Grievance Requests — Weavly',
    description: 'How to submit and follow up on a privacy request or grievance for the Weavly Base Plan.',
}

export default function PrivacyRequestPage() {
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

            <section className="border-b border-white/10 bg-zinc-950 text-white">
                <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">Base Plan privacy channel</p>
                    <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">Privacy and grievance requests</h1>
                    <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">
                        Use the monitored channel below to ask about your personal information, request a correction or deletion, report a concern, or challenge an earlier response.
                    </p>
                </div>
            </section>

            <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-8">
                <div className="space-y-10">
                    <section>
                        <h2 className="text-2xl font-bold">What you can request</h2>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            {PRIVACY_REQUEST_CATEGORIES.map((category) => (
                                <a
                                    key={category.value}
                                    href={buildPrivacyRequestMailto(category.label)}
                                    className="flex items-start gap-3 rounded-xl border border-zinc-200 p-4 font-semibold text-zinc-800 transition-colors hover:border-orange-300 hover:bg-orange-50 dark:border-white/10 dark:text-zinc-100 dark:hover:border-orange-300/40 dark:hover:bg-orange-400/10"
                                >
                                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-orange-600 dark:text-orange-300" aria-hidden="true" />
                                    {category.label}
                                </a>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-white/10 dark:bg-white/5">
                        <h2 className="text-2xl font-bold">Information to include</h2>
                        <ol className="mt-4 list-decimal space-y-2 pl-5 font-medium leading-7 text-zinc-700 dark:text-zinc-300">
                            <li>Send from your registered email address where possible.</li>
                            <li>Include your organization or factory name and the request category.</li>
                            <li>Describe the information involved, what happened, and the outcome you want.</li>
                            <li>Add only the account, payment, or costing reference needed to locate the record.</li>
                        </ol>
                        <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium leading-6 text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                            Do not send passwords, OTPs, card or bank credentials, government ID numbers, or unrelated personal information. We may ask for limited additional information to verify your identity or authority.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold">How the request is handled</h2>
                        <div className="mt-5 grid gap-4 sm:grid-cols-3">
                            <div className="rounded-xl border border-zinc-200 p-5 dark:border-white/10">
                                <Mail className="h-5 w-5 text-orange-600 dark:text-orange-300" aria-hidden="true" />
                                <h3 className="mt-3 font-bold">1. Receipt</h3>
                                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">We log the request and aim to acknowledge it within {PRIVACY_REQUEST_SERVICE_LEVEL.acknowledgementBusinessDays} business days.</p>
                            </div>
                            <div className="rounded-xl border border-zinc-200 p-5 dark:border-white/10">
                                <ShieldCheck className="h-5 w-5 text-orange-600 dark:text-orange-300" aria-hidden="true" />
                                <h3 className="mt-3 font-bold">2. Verification</h3>
                                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">We verify the requester and locate only the records needed to assess the request.</p>
                            </div>
                            <div className="rounded-xl border border-zinc-200 p-5 dark:border-white/10">
                                <Clock3 className="h-5 w-5 text-orange-600 dark:text-orange-300" aria-hidden="true" />
                                <h3 className="mt-3 font-bold">3. Response</h3>
                                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Our internal target is a substantive response within {PRIVACY_REQUEST_SERVICE_LEVEL.responseCalendarDays} calendar days of receipt.</p>
                            </div>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                            These are Weavly service targets for the initial rollout. They do not shorten or replace any response period that applicable law may require.
                        </p>
                    </section>
                </div>

                <aside className="h-fit rounded-2xl border border-orange-200 bg-orange-50 p-6 text-zinc-950 lg:sticky lg:top-6">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-800 dark:text-orange-200">Designated contact</p>
                    <p className="mt-3 text-xl font-bold">{LEGAL_OPERATOR.grievanceOfficer}</p>
                    <p className="mt-1 text-sm text-zinc-600">Grievance Officer and privacy contact</p>
                    <a href={buildPrivacyRequestMailto()} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 py-3 text-sm font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200">
                        <Mail className="h-4 w-4" aria-hidden="true" />
                        Start an email request
                    </a>
                    <a href={`mailto:${LEGAL_OPERATOR.contactEmail}`} className="mt-4 block break-all text-center text-sm font-semibold text-orange-800 underline underline-offset-4 dark:text-orange-200">
                        {LEGAL_OPERATOR.contactEmail}
                    </a>
                    <p className="mt-5 border-t border-orange-200 pt-5 text-sm leading-6 text-zinc-700">
                        Postal correspondence: {LEGAL_OPERATOR.postalAddress}
                    </p>
                </aside>
            </div>

            <LandingFooter />
        </main>
    )
}
