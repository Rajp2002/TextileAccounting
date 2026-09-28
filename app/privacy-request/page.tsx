import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, CheckCircle2, Clock3, Mail, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Beam } from '@/components/landing/beam'
import s from '@/components/landing/landing.module.css'
import { LegalHero, LegalShell } from '@/components/policies/legal-chrome'
import { LEGAL_OPERATOR } from '@/lib/legal-operator'
import {
    buildPrivacyRequestMailto,
    PRIVACY_REQUEST_CATEGORIES,
    PRIVACY_REQUEST_SERVICE_LEVEL,
} from '@/lib/privacy-request'

export const metadata: Metadata = {
    title: 'Privacy & Grievance Requests — Weavly',
    description: 'How to submit and follow up on a privacy request or grievance for a Weavly Free, Lite, or Base workspace.',
}

const steps = [
    { icon: Mail, title: '1. Receipt', copy: `We log the request and aim to acknowledge it within ${PRIVACY_REQUEST_SERVICE_LEVEL.acknowledgementBusinessDays} business days.` },
    { icon: ShieldCheck, title: '2. Verification', copy: 'We verify the requester and locate only the records needed to assess the request.' },
    { icon: Clock3, title: '3. Response', copy: `Our internal target is a substantive response within ${PRIVACY_REQUEST_SERVICE_LEVEL.responseCalendarDays} calendar days of receipt.` },
]

export default function PrivacyRequestPage() {
    return (
        <LegalShell active="/privacy-request">
            <LegalHero
                eyebrow="Weavly privacy channel"
                title="Privacy and grievance requests"
                description="Owners on Free, Lite, and Base can use the monitored channel below to ask about your personal information, request a correction or deletion, report a concern, or challenge an earlier response."
            >
                <Link href="/privacy" className={cn(s.textLink, 'mt-6 inline-flex items-center gap-2 text-[15px]')}>
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Privacy Policy
                </Link>
            </LegalHero>

            <Beam innerClassName="pb-20 sm:pb-24">
                <div className="grid gap-10 border-t-2 border-[color:var(--lp-ink)] pt-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
                    <div className="min-w-0 space-y-12">
                        <section>
                            <h2 className={cn(s.display, 'text-[26px] font-semibold text-[color:var(--lp-ink)]')}>What you can request</h2>
                            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                {PRIVACY_REQUEST_CATEGORIES.map((category) => (
                                    <a
                                        key={category.value}
                                        href={buildPrivacyRequestMailto(category.label)}
                                        className="flex min-h-[56px] items-start gap-3 rounded-[10px] border border-[color:var(--lp-line-strong)] bg-[color:var(--lp-sheet)] p-4 text-[15px] font-semibold text-[color:var(--lp-ink)] transition-colors hover:border-[color:var(--lp-ink)]"
                                    >
                                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--lp-saffron-ink)]" aria-hidden="true" />
                                        {category.label}
                                    </a>
                                ))}
                            </div>
                        </section>

                        <section>
                            <h2 className={cn(s.display, 'text-[26px] font-semibold text-[color:var(--lp-ink)]')}>Information to include</h2>
                            <ol className="mt-4 list-decimal space-y-2 pl-5 text-[16px] leading-7 text-[color:var(--lp-body)]">
                                <li>Send from your registered email address where possible.</li>
                                <li>Include your organization or factory name and the request category.</li>
                                <li>Describe the information involved, what happened, and the outcome you want.</li>
                                <li>Add only the account, payment, or costing reference needed to locate the record.</li>
                            </ol>
                            <p className={cn(s.callout, s.calloutAmber, 'mt-5 p-4 text-[15px] leading-6')}>
                                Do not send passwords, OTPs, card or bank credentials, government ID numbers, or unrelated personal information. We may ask for limited additional information to verify your identity or authority.
                            </p>
                        </section>

                        <section>
                            <h2 className={cn(s.display, 'text-[26px] font-semibold text-[color:var(--lp-ink)]')}>How the request is handled</h2>
                            <ol className="mt-5 grid list-none gap-4 sm:grid-cols-3">
                                {steps.map((step) => (
                                    <li key={step.title} className="border-t-2 border-[color:var(--lp-ink)] pt-4">
                                        <step.icon className="h-5 w-5 text-[color:var(--lp-saffron-ink)]" aria-hidden="true" />
                                        <h3 className="mt-3 text-[16px] font-semibold text-[color:var(--lp-ink)]">{step.title}</h3>
                                        <p className="mt-2 text-[14px] leading-6 text-[color:var(--lp-body)]">{step.copy}</p>
                                    </li>
                                ))}
                            </ol>
                            <p className="mt-5 text-[14px] leading-6 text-[color:var(--lp-muted)]">
                                These are Weavly service targets for the initial rollout. They do not shorten or replace any response period that applicable law may require.
                            </p>
                        </section>
                    </div>

                    <aside className={cn(s.sheet, 'h-fit rounded-[14px] p-6 lg:sticky lg:top-28')}>
                        <p className={cn(s.label, 'text-[color:var(--lp-saffron-ink)]')}>Designated contact</p>
                        <p className={cn(s.display, 'mt-3 text-[22px] font-semibold text-[color:var(--lp-ink)]')}>{LEGAL_OPERATOR.grievanceOfficer}</p>
                        <p className="mt-1 text-[14px] text-[color:var(--lp-muted)]">Grievance Officer and privacy contact</p>
                        <a href={buildPrivacyRequestMailto()} className={cn(s.primary, 'mt-6 w-full')}>
                            <Mail className="h-4 w-4" aria-hidden="true" />
                            Start an email request
                        </a>
                        <a href={`mailto:${LEGAL_OPERATOR.contactEmail}`} className={cn(s.textLink, 'mt-4 block break-all text-center text-[14px]')}>
                            {LEGAL_OPERATOR.contactEmail}
                        </a>
                        <p className="mt-5 border-t border-[color:var(--lp-line)] pt-5 text-[14px] leading-6 text-[color:var(--lp-body)]">
                            Postal correspondence: {LEGAL_OPERATOR.postalAddress}
                        </p>
                    </aside>
                </div>
            </Beam>
        </LegalShell>
    )
}
