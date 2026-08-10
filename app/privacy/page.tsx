import Link from 'next/link'
import type { Metadata } from 'next'
import { Database, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { PolicyCallout, PolicyContactPanel, PolicyPage, PolicySection } from '@/components/policies/legal-page'

export const metadata: Metadata = {
    title: 'Privacy Policy — Weavly',
    description: 'Learn how Weavly collects, uses, and protects the account and costing data used by the Base Plan in compliance with India\'s Digital Personal Data Protection Act (DPDP Act) 2023.',
}

const sections = [
    { href: '#data-we-collect', title: 'Data We Collect' },
    { href: '#purpose', title: 'Purpose' },
    { href: '#consent', title: 'Consent' },
    { href: '#storage-security', title: 'Storage & Security' },
    { href: '#retention', title: 'Retention' },
    { href: '#rights', title: 'Your Rights' },
    { href: '#processors', title: 'Processors' },
    { href: '#breach-notification', title: 'Breach Notification' },
    { href: '#children', title: 'Children\'s Data' },
    { href: '#offline-data', title: 'Offline Data' },
    { href: '#grievance', title: 'Grievance Redressal' },
    { href: '#changes', title: 'Changes' },
    { href: '#governing-law', title: 'Governing Law' },
]

export default async function PrivacyPolicyPage() {
    const groName = 'Raj Patel'
    const groEmail = 'privacy@weavly.app'
    const groPhone: string | null = null

    return (
        <PolicyPage
            activePath="/privacy"
            title="Privacy Policy"
            description="A plain-language view of what Weavly collects for the current Base Plan, why it is needed for costing work, and how account and business data is protected under Indian privacy law."
            lastUpdated="August 10, 2026"
            sections={sections}
            facts={[
                { label: 'Primary law', value: 'DPDP Act 2023', icon: ShieldCheck },
                { label: 'Data role', value: 'Weavly processes Base Plan data for factory owners', icon: Database },
                { label: 'Security model', value: 'Tenant isolation, RLS, encryption, and authenticated access', icon: LockKeyhole },
                { label: 'Grievance contact', value: groEmail, icon: Mail },
            ]}
        >
            <p className="mb-10 max-w-3xl text-lg font-medium leading-8 text-zinc-700 dark:text-zinc-300">
                Weavly (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is committed to protecting the personal data of our users. This Privacy Policy explains how we collect, use, store, and protect your information when you use the current Base Plan. This policy is drafted in compliance with India&apos;s <strong>Digital Personal Data Protection Act (DPDP Act) 2023</strong>, the <strong>Information Technology Act 2000</strong>, and the <strong>IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021</strong>. The initial rollout is limited to the Base Plan costing workspace; any future Full Suite release will be covered by separate applicable terms and notices.
            </p>

            <PolicyCallout tone="neutral" title="Initial rollout boundary">
                <p>
                    This policy covers only the Weavly Estimator (Base Plan), which is the only plan available for the initial rollout. Production logging, orders, stock or inventory, dispatch, payroll, and connected factory analytics are not available under this rollout, so Weavly is not collecting those operational records as part of the Base Plan service.
                </p>
            </PolicyCallout>

            <PolicySection id="data-we-collect" title="1. Data We Collect">
                <p>For the current Base Plan, we collect the following categories of account and costing data:</p>

                <h3>1.1 Account Data (Owner)</h3>
                <ul>
                    <li>Full name</li>
                    <li>Email address</li>
                    <li>Phone number</li>
                    <li>Role within the organization</li>
                    <li>Organization/factory name</li>
                </ul>

                <h3>1.2 Costing and Business Data</h3>
                <ul>
                    <li>Fabric quality names and construction details</li>
                    <li>Warp and weft yarn details, rates, weights, consumption, and related costing assumptions</li>
                    <li>Factory cost assumptions, GST, shortage, commission, transport, target margin, and quantity inputs</li>
                    <li>Saved costings, drafts, and any customer or party details you choose to enter alongside a costing</li>
                    <li>Cost Sheet exports generated from the estimator</li>
                </ul>

                <h3>1.3 Technical Data</h3>
                <ul>
                    <li>Browser type and version</li>
                    <li>Device information</li>
                    <li>Limited browser storage for cached screens, local drafts, and Progressive Web App assets</li>
                </ul>

                <p>Production logs, worker records, payroll, inventory, dispatch, orders, and factory-floor activity are not part of the current Base Plan data model.</p>
            </PolicySection>

            <PolicySection id="purpose" title="2. Purpose of Data Collection">
                <p>For the current Base Plan, we collect and process data strictly for the following purposes:</p>
                <ul>
                    <li><strong>Cost estimation</strong> — calculating material, factory, landed, break-even, and margin figures from the inputs you provide</li>
                    <li><strong>Saved costing work</strong> — storing fabric qualities, costing assumptions, drafts, and saved costings so you can reuse them</li>
                    <li><strong>Cost Sheet export</strong> — generating the export you request from a saved or active costing</li>
                    <li><strong>Account management</strong> — authentication, authorization, organization setup</li>
                    <li><strong>Billing and support</strong> — processing payments, maintaining receipts, handling renewals, and responding to requests</li>
                </ul>
                <p>We do <strong>not</strong> use your data for advertising, behavioural profiling, or selling to third parties.</p>

                <PolicyCallout tone="blue" title="Role Under the DPDP Act 2023">
                    <p>
                        For the purposes of the Digital Personal Data Protection Act 2023, the <strong>Factory Owner (Subscriber) acts as the Data Fiduciary</strong>, determining the purpose and means of processing the personal data entered into the Base Plan. <strong>Weavly acts solely as a Data Processor</strong>, processing data on behalf of the Factory Owner.
                    </p>
                    <p>
                        It is the responsibility of the Factory Owner to ensure that any personal data, including customer or party details, is entered lawfully and accurately.
                    </p>
                </PolicyCallout>
            </PolicySection>

            <PolicySection id="consent" title="3. Consent">
                <p>
                    By creating an account on Weavly, you provide explicit consent for the collection and processing of your data for the purposes described above. You may withdraw consent at any time by contacting us (see Section 11). Withdrawal of consent may result in the inability to use certain features of the platform.
                </p>
                <p>Any optional communication or future feature that requires additional personal data will request separate consent within the application where applicable.</p>
            </PolicySection>

            <PolicySection id="storage-security" title="4. How We Store and Protect Your Data">
                <ul>
                    <li><strong>Cloud infrastructure</strong> — Base Plan account and costing-workspace data is stored on Supabase (hosted on AWS), with servers in secure, SOC 2-compliant data centres. Payment details are handled by Razorpay; Weavly receives payment references and billing status.</li>
                    <li><strong>Encryption</strong> — Data is encrypted at rest (AES-256) and in transit (TLS 1.2+).</li>
                    <li><strong>Row Level Security (RLS)</strong> — PostgreSQL-level policies ensure every database query is automatically scoped to the user&apos;s organization. Cross-organization data access is architecturally impossible.</li>
                    <li><strong>JWT-based authentication</strong> — Organization ID and user role are embedded in session tokens and verified on every request.</li>
                    <li><strong>Authenticated access</strong> — Account sessions and role checks restrict access to the organization and costing workspace associated with the signed-in user.</li>
                    <li><strong>Local storage</strong> — The app may keep temporary browser data such as cached screens, local drafts, and app assets. Logging out clears user-specific local cache and offline queues on that browser profile.</li>
                </ul>
            </PolicySection>

            <PolicySection id="retention" title="5. Data Retention">
                <p>We retain your data for the following periods:</p>
                <ul>
                    <li><strong>Saved costings and fabric qualities</strong> — Retained while your account and paid service remain active, with a 30-day export window after termination.</li>
                    <li><strong>Billing and payment records</strong> — Retained for the period required for accounting, tax, fraud prevention, dispute handling, and other legal obligations.</li>
                    <li><strong>Account data</strong> — Retained for 180 days after account deletion or deactivation, as per IT Intermediary Guidelines 2021, then permanently deleted.</li>
                    <li><strong>Browser drafts and cached assets</strong> — Retained on the signed-in browser until cleared by logout, browser storage controls, or normal cache expiry.</li>
                </ul>
                <p>After the retention period, data is permanently and irreversibly deleted from our systems.</p>
            </PolicySection>

            <PolicySection id="rights" title="6. Your Rights (Data Principal Rights)">
                <p>Under the DPDP Act 2023, you have the following rights:</p>
                <ul>
                    <li><strong>Right to Access</strong> — You may request a copy of all personal data we hold about you or your organization.</li>
                    <li><strong>Right to Correction</strong> — You may request correction of inaccurate data.</li>
                    <li><strong>Right to Erasure</strong> — You may request deletion of your personal data, subject to our legal retention obligations.</li>
                    <li><strong>Right to Withdraw Consent</strong> — You may withdraw your consent for data processing at any time.</li>
                    <li><strong>Right to Grievance Redressal</strong> — You may raise concerns with our Grievance Officer (see Section 11).</li>
                </ul>
                <p>To exercise these rights, email us at the address listed in Section 11. We will respond within 30 days.</p>
            </PolicySection>

            <PolicySection id="processors" title="7. Third-Party Data Processors">
                <p>We use the following third-party services to operate the platform:</p>
                <ul>
                    <li><strong>Supabase</strong> (database hosting, authentication) — <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase Privacy Policy</a></li>
                    <li><strong>Vercel</strong> (application hosting) — <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel Privacy Policy</a></li>
                    <li><strong>Razorpay</strong> (Base Plan payment processing and billing records)</li>
                </ul>
                <p>We maintain Data Processing Agreements (DPAs) with our third-party processors to ensure equivalent data protection standards.</p>
            </PolicySection>

            <PolicySection id="breach-notification" title="8. Data Breach Notification">
                <p>
                    In the event of a data breach that may compromise the security of your personal data, we will notify the <strong>Data Protection Board of India</strong> and all affected users within <strong>72 hours</strong> of becoming aware of the breach, as required by the DPDP Act 2023.
                </p>
            </PolicySection>

            <PolicySection id="children" title="9. Children&apos;s Data">
                <p>
                    Weavly does not knowingly collect or process data from individuals under the age of 18. Account holders must be at least 18 years old. If we become aware that data from a minor has been collected, we will promptly delete such data.
                </p>
            </PolicySection>

            <PolicySection id="offline-data" title="10. Local Storage &amp; Offline Data">
                <p>
                    The Weavly Progressive Web App (PWA) uses a <strong>Service Worker</strong> to cache application assets and may keep temporary browser drafts for costings you are editing. Saving costings and generating Cost Sheet exports require an internet connection. Logging out clears user-specific cached data and local drafts on that browser profile. No cookies are used for tracking purposes.
                </p>
            </PolicySection>

            <PolicySection id="grievance" title="11. Grievance Redressal Policy (Effective April 2026)">
                <p>We take your privacy concerns seriously. If you have any grievances regarding your data processing, you may reach out to our designated officer.</p>

                <PolicyContactPanel
                    title="Grievance Redressal Officer"
                    rows={[
                        {
                            label: 'Officer',
                            value: (
                                <>
                                    {groName}
                                    <span className="block text-sm font-medium text-zinc-500 dark:text-zinc-400">Weavly Compliance Dept.</span>
                                </>
                            ),
                        },
                        {
                            label: 'Primary Contact',
                            value: (
                                <>
                                    <a href={`mailto:${groEmail}`} className="text-orange-700 hover:underline dark:text-orange-300">{groEmail}</a>
                                    {groPhone && (
                                        <span className="block text-sm font-medium text-zinc-500 dark:text-zinc-400">Phone: {groPhone}</span>
                                    )}
                                </>
                            ),
                        },
                        { label: 'Acknowledgment', value: '12 hours via email' },
                        { label: 'Resolution', value: '7 working days' },
                    ]}
                    note={
                        <>
                             Any Data Principal or authorized representative may file a grievance regarding data inaccuracy, unauthorized processing, or consent withdrawal. Please include the relevant account or costing reference and the nature of your concern.
                        </>
                    }
                />

                <PolicyCallout tone="amber" title="Resolution Proof">
                    <p>
                        Upon resolution, Weavly will provide a Resolution Summary. A digital copy of this communication is archived in our secure Compliance Registry for the period required by applicable legal and accounting obligations.
                    </p>
                </PolicyCallout>
            </PolicySection>

            <PolicySection id="changes" title="12. Changes to This Policy">
                <p>
                    We may update this Privacy Policy from time to time. Material changes will be communicated via the platform or email. Continued use of the service after changes constitutes acceptance of the updated policy.
                </p>
            </PolicySection>

            <PolicySection id="governing-law" title="13. Governing Law">
                <p>
                    This Privacy Policy is governed by the laws of the Republic of India. Any disputes arising from this policy will be subject to the exclusive jurisdiction of the courts in Surat, Gujarat, India.
                </p>
                <p>
                    For service-specific obligations, review the <Link href="/terms">Terms of Service</Link> and the <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>.
                </p>
            </PolicySection>
        </PolicyPage>
    )
}
