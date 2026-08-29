import Link from 'next/link'
import type { Metadata } from 'next'
import { Database, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { PolicyContactPanel, PolicyPage, PolicySection } from '@/components/policies/legal-page'
import { LEGAL_DOCUMENTS } from '@/lib/legal-documents'
import { LEGAL_OPERATOR } from '@/lib/legal-operator'
import { PRIVACY_REQUEST_SERVICE_LEVEL } from '@/lib/privacy-request'

export const metadata: Metadata = {
    title: 'Privacy Policy — Weavly',
    description: 'How Weavly collects, uses, shares, retains, and protects personal information used by the Base Plan.',
}

const sections = [
    { href: '#scope', title: 'Scope & Roles' },
    { href: '#data-we-collect', title: 'Data We Collect' },
    { href: '#purpose', title: 'How We Use Data' },
    { href: '#choice', title: 'Consent & Choice' },
    { href: '#sharing', title: 'Sharing & Providers' },
    { href: '#storage-security', title: 'Storage & Security' },
    { href: '#retention', title: 'Retention & Deletion' },
    { href: '#rights', title: 'Your Choices & Rights' },
    { href: '#breach-notification', title: 'Security Incidents' },
    { href: '#children', title: 'Children' },
    { href: '#browser-data', title: 'Cookies & Browser Data' },
    { href: '#grievance', title: 'Grievance Redressal' },
    { href: '#changes', title: 'Changes' },
    { href: '#governing-law', title: 'Governing Law' },
]

export default function PrivacyPolicyPage() {
    return (
        <PolicyPage
            activePath="/privacy"
            title="Privacy Policy"
            description="What the Weavly Base Plan collects, why it is needed, who receives it, and the controls available to account owners."
            lastUpdated={LEGAL_DOCUMENTS.privacy.displayDate}
            sections={sections}
            facts={[
                { label: 'Current framework', value: 'IT Act 2000 and SPDI Rules 2011', icon: ShieldCheck },
                { label: 'DPDP readiness', value: 'Prepared for the phased DPDP framework', icon: Database },
                { label: 'Account controls', value: 'Owner export and permanent deletion', icon: LockKeyhole },
                { label: 'Privacy contact', value: LEGAL_OPERATOR.contactEmail, icon: Mail },
            ]}
        >
            <p className="mb-10 max-w-3xl text-lg font-medium leading-8 text-zinc-700 dark:text-zinc-300">
                Weavly (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) provides a business-to-business textile costing and lightweight production-record service. Until a company is incorporated and this policy is updated, Weavly means {LEGAL_OPERATOR.displayName}. This policy explains our practices for personal information associated with the current Weavly Estimator (Base Plan). It is intended to meet the privacy-policy requirements presently applicable under India&apos;s Information Technology Act, 2000 and the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, while preparing for the phased commencement of the Digital Personal Data Protection Act, 2023 and Digital Personal Data Protection Rules, 2025.
            </p>

            <PolicySection id="scope" title="1. Scope and Our Data Roles">
                <p>
                    For account registration, authentication, billing, product security, support, and our own service administration, Weavly determines why and how personal information is processed. For those activities, Weavly is responsible for the processing it controls.
                </p>
                <p>
                    An account owner may also enter personal information about customers, suppliers, brokers, employees, or other business contacts into a costing workspace. For that customer-provided information, the account owner decides what to enter and why, and Weavly processes it to provide the subscribed service. The account owner is responsible for having an appropriate basis to provide that information to Weavly.
                </p>
                <p>
                    This notice covers the Base Plan offered in the initial rollout, including owner-created production jobs, production metre entries, piece-rate worker names and rates, advances, and basic payroll settlement records. It does not cover formal party orders, supervisor or machine management, inventory, dispatch, fixed-worker salary payroll, advanced payroll, analytics, WhatsApp operations, or other Full Suite features. The Base workflow does not require worker phone numbers, supervisor accounts, attendance, or statutory payroll identifiers.
                </p>
            </PolicySection>

            <PolicySection id="data-we-collect" title="2. Information We Collect">
                <h3>2.1 Account and identity information</h3>
                <ul>
                    <li>Owner name, email address, mobile number, role, and organization or factory name</li>
                    <li>Authentication credentials processed through Supabase Auth; Weavly does not display or retrieve your plaintext password</li>
                    <li>The versions of the Terms and Privacy Policy accepted at signup, acceptance time, and limited browser information used as acceptance evidence</li>
                </ul>

                <h3>2.2 Costing and business information</h3>
                <ul>
                    <li>Fabric qualities, construction details, yarn descriptions, rates, weights, consumption, and costing assumptions</li>
                    <li>Factory costs, GST assumptions, shortage, commission, transport, target margin, quantity, notes, drafts, and saved costings</li>
                    <li>Customer, party, broker, supplier, or other contact details you choose to associate with a costing</li>
                    <li>Cost Sheet and organization-export activity, including export-history metadata; downloaded files are saved wherever you choose on your device</li>
                </ul>

                <h3>2.3 Production and worker-pay information</h3>
                <ul>
                    <li>Production job quality labels, targets, dates, optional customer or internal references, notes, and status</li>
                    <li>Owner-entered production dates, metres, short notes, and the worker rate snapshot used for each entry</li>
                    <li>Piece-rate worker names, metre rates, active status, advance amounts and descriptions, and basic settlement totals and payment mode</li>
                </ul>

                <h3>2.4 Billing and support information</h3>
                <ul>
                    <li>Billing name and address, GSTIN if supplied, plan and subscription status, payment references, receipts, and refund or dispute records</li>
                    <li>Messages, attachments, and account references you send in support, privacy, or grievance communications</li>
                    <li>Razorpay processes payment-instrument information. Weavly receives transaction references and status information, not complete card, bank-account, or UPI credentials</li>
                </ul>

                <h3>2.5 Technical, security, and browser information</h3>
                <ul>
                    <li>IP address, request time, browser and device information, session identifiers, authentication events, and security or rate-limit events</li>
                    <li>Error reports, performance traces, route information, and diagnostic context sent to our monitoring provider after application-level redaction</li>
                    <li>Essential cookies and limited browser storage used for login sessions, security, cached application assets, and temporary or locally persisted drafts</li>
                </ul>
            </PolicySection>

            <PolicySection id="purpose" title="3. How We Use Information">
                <p>We use the information described above to:</p>
                <ul>
                    <li>Create and secure accounts, authenticate users, and isolate each organization&apos;s workspace</li>
                    <li>Calculate, save, restore, and export costing work requested by the account owner</li>
                    <li>Record owner-run production jobs and metres, calculate piece-rate pay from saved rate snapshots, and record basic advance recovery and settlement information</li>
                    <li>Process subscriptions, payments, renewals, receipts, refunds, and billing support</li>
                    <li>Provide support, respond to privacy requests and grievances, and maintain request and resolution records</li>
                    <li>Detect abuse, enforce rate limits, investigate errors, maintain availability, and respond to security incidents</li>
                    <li>Comply with accounting, tax, cybersecurity, court, regulatory, and other legal obligations</li>
                </ul>
                <p>We do not sell personal information or use Base Plan workspace data for third-party or behavioural advertising.</p>
            </PolicySection>

            <PolicySection id="choice" title="4. Consent and Choice">
                <p>
                    At signup, the owner must affirmatively accept the displayed versions of the Terms of Service and this Privacy Policy. We keep a server-side record of that acceptance. Where applicable law requires consent for a particular collection, disclosure, or communication, we will request it through the relevant product flow or another written or electronic method.
                </p>
                <p>
                    You may decline optional information. If information is necessary to create an account, secure the service, process payment, or perform a requested feature, we may be unable to provide that part of the service without it. You may withdraw consent for consent-based processing by contacting the privacy address in Section 12 or by using an available in-product control. Withdrawal does not affect processing already lawfully completed and may require account or feature termination.
                </p>
            </PolicySection>

            <PolicySection id="sharing" title="5. Disclosures and Service Providers">
                <p>We disclose information only as needed to operate the service, follow your instructions, protect the service, complete a transaction, or comply with law. Current provider categories include:</p>
                <ul>
                    <li><strong>Supabase</strong> — database, authentication, and related backend infrastructure</li>
                    <li><strong>Vercel</strong> — application hosting, content delivery, and server execution</li>
                    <li><strong>Razorpay</strong> — payment, subscription, refund, and transaction processing</li>
                    <li><strong>Sentry</strong> — redacted error monitoring, performance diagnostics, and masked error-session replay</li>
                    <li><strong>Upstash</strong> — rate limiting and abuse-prevention infrastructure when configured</li>
                </ul>
                <p>
                    These providers process information under their own service terms and data-protection commitments. Their infrastructure may process or store information in India or other locations based on our project configuration and their service architecture. We may also disclose information to professional advisers, courts, regulators, law-enforcement bodies, or government agencies when authorized or required by applicable law, and in connection with a merger, financing, reorganization, or sale subject to appropriate confidentiality and notice requirements.
                </p>
            </PolicySection>

            <PolicySection id="storage-security" title="6. Storage and Security">
                <p>We use safeguards proportionate to the service and the information handled, including:</p>
                <ul>
                    <li>Encrypted network connections and provider-managed encryption for hosted data</li>
                    <li>Authenticated sessions, role checks, tenant-scoped database access, and PostgreSQL Row Level Security policies</li>
                    <li>Restricted service credentials, input validation, rate limiting, audit records, and redaction of diagnostic events</li>
                    <li>Account-owner controls for structured data export and permanent deletion from the active product database</li>
                </ul>
                <p>
                    No online service can guarantee absolute security. Access controls reduce cross-organization risk but do not make unauthorized access impossible. Please protect your password and device, and notify us promptly if you suspect unauthorized account use.
                </p>
            </PolicySection>

            <PolicySection id="retention" title="7. Retention and Deletion">
                <ul>
                    <li><strong>Active account and costing data</strong> — kept while the account remains active and as needed to provide the requested service. An owner may permanently delete the workspace through Settings.</li>
                    <li><strong>After owner-initiated deletion</strong> — organization and account records are removed from the active product database. Residual encrypted backup copies, provider logs, or cached copies may remain temporarily until the applicable provider&apos;s normal protection and deletion cycle completes.</li>
                    <li><strong>Billing and legal records</strong> — retained for the period needed to satisfy tax, accounting, fraud-prevention, chargeback, dispute, and legal requirements.</li>
                    <li><strong>Security logs</strong> — ICT system logs covered by applicable CERT-In directions are maintained securely for a rolling period of 180 days in India. Other diagnostic records are kept only as long as needed for security, reliability, or legal purposes.</li>
                    <li><strong>Support and grievance records</strong> — kept while a request is open and afterwards for the period reasonably needed to document the response, handle disputes, and meet legal obligations.</li>
                    <li><strong>Browser data</strong> — remains until removed by logout cleanup, application expiry, browser settings, or manual clearing, depending on the storage mechanism.</li>
                </ul>
                <p>We may retain a limited record instead of deleting it when retention is required by applicable law or necessary for an unresolved legal claim, payment dispute, fraud investigation, or security incident.</p>
            </PolicySection>

            <PolicySection id="rights" title="8. Your Choices and Rights">
                <p>Depending on the information and the law in force, you may:</p>
                <ul>
                    <li>Review and correct owner and billing information, or request correction of inaccurate information</li>
                    <li>Download a structured owner-only organization export from Settings</li>
                    <li>Withdraw consent for processing that relies on consent</li>
                    <li>Request deletion, subject to records that must be retained by law or for a permitted unresolved purpose</li>
                    <li>Raise a grievance about our processing or response to a privacy request</li>
                </ul>
                <p>
                    The DPDP Act&apos;s access, correction, erasure, grievance, and nomination provisions have a phased statutory commencement. We are building these controls in advance, but this policy does not represent that every DPDP provision is already in force. We may need to verify your identity and authority before acting on a request.
                </p>
            </PolicySection>

            <PolicySection id="breach-notification" title="9. Security Incidents and Notifications">
                <p>
                    We investigate suspected security incidents and notify CERT-In, affected individuals, the Data Protection Board of India, or other authorities when and within the time required by the law then in force. Certain reportable cyber incidents are currently subject to CERT-In&apos;s six-hour reporting direction. The DPDP framework&apos;s separate personal-data-breach notification requirements will apply according to their notified commencement schedule.
                </p>
                <p>
                    If you notice suspicious account activity or a possible exposure, use our <Link href="/security-incident">security incident reporting channel</Link>. Do not send passwords, OTPs, payment credentials, or other secrets in the report.
                </p>
            </PolicySection>

            <PolicySection id="children" title="10. Children">
                <p>
                    The Base Plan is a business service and is not directed to children. Account owners must be at least 18 years old. We do not knowingly request children&apos;s personal information for the Base Plan. If you believe a child&apos;s information has been entered, contact us so we can review and take appropriate action.
                </p>
            </PolicySection>

            <PolicySection id="browser-data" title="11. Cookies, Local Storage, and Offline Data">
                <p>
                    We use essential authentication cookies and may use a short-lived diagnostic cookie to understand whether sign-in completed successfully. The Progressive Web App service worker caches application assets, and the app may keep temporary or locally persisted costing drafts in browser storage. Saving costings and generating Cost Sheet exports require an internet connection. Logging out clears user-specific cached data and local drafts on that browser profile. These technologies support login, security, reliability, and draft recovery; they are not used for third-party advertising.
                </p>
            </PolicySection>

            <PolicySection id="grievance" title="12. Privacy Requests and Grievance Redressal">
                <p>
                    Use our <Link href="/privacy-request">privacy and grievance request page</Link> or contact the designated Grievance Officer for access, correction, withdrawal, deletion, security, or other privacy concerns.
                </p>
                <PolicyContactPanel
                    title="Grievance Officer"
                    rows={[
                        { label: 'Officer', value: LEGAL_OPERATOR.grievanceOfficer },
                        {
                            label: 'Email',
                            value: <a href={`mailto:${LEGAL_OPERATOR.contactEmail}`} className="text-orange-700 hover:underline dark:text-orange-300">{LEGAL_OPERATOR.contactEmail}</a>,
                        },
                        { label: 'Postal address', value: LEGAL_OPERATOR.postalAddress },
                        { label: 'Internal response target', value: `${PRIVACY_REQUEST_SERVICE_LEVEL.responseCalendarDays} calendar days from receipt` },
                    ]}
                    note={
                        <>
                            We aim to acknowledge a request within {PRIVACY_REQUEST_SERVICE_LEVEL.acknowledgementBusinessDays} business days. Send it from your registered email where possible and include the organization name, relevant account or costing reference, the nature of the request, and the outcome sought. Do not email passwords, payment credentials, or unnecessary identity documents. These are Weavly service targets; where the SPDI Rules apply, a grievance will be addressed expeditiously and within one month of receipt, and any other applicable legal period will also control.
                        </>
                    }
                />
            </PolicySection>

            <PolicySection id="changes" title="13. Changes to This Policy">
                <p>
                    We may update this policy when the service, providers, or legal requirements change. We will change the displayed version and date, and will provide additional notice or obtain fresh consent where required by applicable law or where a change materially expands consent-based processing.
                </p>
            </PolicySection>

            <PolicySection id="governing-law" title="14. Governing Law">
                <p>
                    This policy is governed by the laws of India. Subject to applicable statutory remedies, disputes arising from this policy are subject to the dispute provisions in the <Link href="/terms">Terms of Service</Link>.
                </p>
                <p>
                    For service-specific obligations, review the <Link href="/terms">Terms of Service</Link> and the <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>.
                </p>
            </PolicySection>
        </PolicyPage>
    )
}
