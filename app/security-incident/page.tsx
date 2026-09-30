import Link from 'next/link'
import type { Metadata } from 'next'
import { AlertTriangle, ArrowLeft, Clock3, KeyRound, Mail, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Beam } from '@/components/landing/beam'
import s from '@/components/landing/landing.module.css'
import { LegalHero, LegalShell } from '@/components/policies/legal-chrome'
import { LEGAL_OPERATOR } from '@/lib/legal-operator'
import {
    BASE_SECURITY_INCIDENT_DATA_CATEGORIES,
    buildSecurityIncidentMailto,
    SECURITY_INCIDENT_REPORT_CATEGORIES,
    SECURITY_INCIDENT_SERVICE_LEVEL,
} from '@/lib/security-incident'

export const metadata: Metadata = {
    title: 'Report a Security Incident — Weavly',
    description: 'How to report a suspected account or data-security incident affecting a Weavly Free, Lite, or Base workspace.',
}

export default function SecurityIncidentPage() {
    return (
        <LegalShell active="/security-incident">
            <LegalHero
                eyebrow="Weavly security channel"
                title="Report a suspected security incident"
                description="Use this monitored channel for suspicious account activity, possible unauthorized access, billing-reference concerns, impersonation, or a potential vulnerability affecting Weavly."
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
                            <h2 className={cn(s.display, 'text-[26px] font-semibold text-[color:var(--lp-ink)]')}>Choose the closest report type</h2>
                            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                {SECURITY_INCIDENT_REPORT_CATEGORIES.map((category) => (
                                    <a
                                        key={category.value}
                                        href={buildSecurityIncidentMailto(category.label)}
                                        className="flex min-h-[56px] items-start gap-3 rounded-[10px] border border-[color:var(--lp-line-strong)] bg-[color:var(--lp-sheet)] p-4 text-[15px] font-semibold text-[color:var(--lp-ink)] transition-colors hover:border-[color:var(--lp-ink)]"
                                    >
                                        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#a8361c]" aria-hidden="true" />
                                        {category.label}
                                    </a>
                                ))}
                            </div>
                        </section>

                        <section className={cn(s.callout, s.calloutAmber, 'p-6')}>
                            <div className="flex items-center gap-3">
                                <KeyRound className="h-6 w-6" aria-hidden="true" />
                                <h2 className={cn(s.display, 'text-[22px] font-semibold')}>If you suspect account compromise</h2>
                            </div>
                            <ol className="mt-4 list-decimal space-y-2 pl-5 text-[15px] leading-6">
                                <li>Change your Weavly password from a trusted device and do not reuse the old password.</li>
                                <li>Secure the email account connected to Weavly and review it for unfamiliar access.</li>
                                <li>Send the report promptly with the time you noticed the activity and any safe, relevant reference.</li>
                            </ol>
                        </section>

                        <section>
                            <h2 className={cn(s.display, 'text-[26px] font-semibold text-[color:var(--lp-ink)]')}>What this channel covers</h2>
                            <ul className="mt-4 grid list-none gap-px border-y border-[color:var(--lp-line)] bg-[color:var(--lp-line)] sm:grid-cols-2">
                                {BASE_SECURITY_INCIDENT_DATA_CATEGORIES.map((category) => (
                                    <li key={category} className="bg-[color:var(--lp-paper)] py-3 pr-4 text-[15px] text-[color:var(--lp-body)] sm:odd:pr-4 sm:even:pl-4">{category}</li>
                                ))}
                            </ul>
                            <p className="mt-4 text-[15px] leading-7 text-[color:var(--lp-body)]">
                                Weavly Free stores account details, completed costings, and monthly-allowance records. Weavly Lite stores costing records, qualities, rates, and account data. Weavly Base additionally stores owner-run production records, piece-rate workers, advances, and basic settlement data. Report incidents affecting any of these workspaces through this channel.
                            </p>
                        </section>

                        <section className={cn(s.callout, s.calloutRed, 'p-6')}>
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="h-6 w-6" aria-hidden="true" />
                                <h2 className={cn(s.display, 'text-[22px] font-semibold')}>Send only what is safe and necessary</h2>
                            </div>
                            <p className="mt-4 text-[15px] leading-6">
                                Include your organization, registered email, when you noticed the issue, a concise description, and a relevant costing, billing, or support reference. Do not send passwords, OTPs, card or bank credentials, government ID numbers, private keys, or active exploit instructions by email.
                            </p>
                        </section>
                    </div>

                    <aside className={cn(s.sheet, 'h-fit rounded-[14px] p-6 lg:sticky lg:top-28')}>
                        <p className={cn(s.label, 'text-[#a8361c]')}>Monitored security contact</p>
                        <a href={buildSecurityIncidentMailto()} className={cn(s.primary, 'mt-5 w-full')}>
                            <Mail className="h-4 w-4" aria-hidden="true" />
                            Start a security report
                        </a>
                        <a href={`mailto:${LEGAL_OPERATOR.contactEmail}`} className={cn(s.textLink, 'mt-4 block break-all text-center text-[14px]')}>{LEGAL_OPERATOR.contactEmail}</a>
                        <div className="mt-5 flex gap-3 border-t border-[color:var(--lp-line)] pt-5 text-[14px] leading-6 text-[color:var(--lp-body)]">
                            <Clock3 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                            <p>We aim to acknowledge a report within {SECURITY_INCIDENT_SERVICE_LEVEL.acknowledgementBusinessDays} business day. This service target does not replace any faster legal reporting clock that may apply to us.</p>
                        </div>
                    </aside>
                </div>
            </Beam>
        </LegalShell>
    )
}
