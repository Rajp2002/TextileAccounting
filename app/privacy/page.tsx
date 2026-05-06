import Link from 'next/link'
import type { Metadata } from 'next'
import { Database, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { PolicyCallout, PolicyContactPanel, PolicyPage, PolicySection } from '@/components/policies/legal-page'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
    title: 'Privacy Policy — Weavly',
    description: 'Learn how Weavly collects, uses, and protects your personal data in compliance with India\'s Digital Personal Data Protection Act (DPDP Act) 2023.',
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
    const supabase = await createClient()
    const { data: settings } = await supabase
        .from('compliance_settings')
        .select('*')
        .single()

    const gro = settings || {
        gro_name: 'Raj Patel',
        gro_email: 'rajpatel86420@gmail.com',
    }

    const groName = gro.gro_name ?? 'Raj Patel'
    const groEmail = gro.gro_email ?? 'privacy@weavly.app'

    return (
        <PolicyPage
            activePath="/privacy"
            title="Privacy Policy"
            description="A plain-language view of what Weavly collects, why it is needed for factory operations, and how worker and business data is protected under Indian privacy law."
            lastUpdated="April 26, 2026"
            sections={sections}
            facts={[
                { label: 'Primary law', value: 'DPDP Act 2023', icon: ShieldCheck },
                { label: 'Data role', value: 'Weavly acts as processor for factory owners', icon: Database },
                { label: 'Security model', value: 'Tenant isolation, RLS, encryption, and access codes', icon: LockKeyhole },
                { label: 'Grievance contact', value: groEmail, icon: Mail },
            ]}
        >
            <p className="mb-10 max-w-3xl text-lg font-medium leading-8 text-zinc-700 dark:text-zinc-300">
                Weavly (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is committed to protecting the personal data of our users. This Privacy Policy explains how we collect, use, store, and protect your information when you use the Weavly platform. This policy is drafted in compliance with India&apos;s <strong>Digital Personal Data Protection Act (DPDP Act) 2023</strong>, the <strong>Information Technology Act 2000</strong>, and the <strong>IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021</strong>.
            </p>

            <PolicySection id="data-we-collect" title="1. Data We Collect">
                <p>We collect the following categories of personal and operational data:</p>

                <h3>1.1 Account Data (Owner / Supervisor)</h3>
                <ul>
                    <li>Full name</li>
                    <li>Email address</li>
                    <li>Phone number</li>
                    <li>Role within the organization (owner or supervisor)</li>
                    <li>Organization/factory name</li>
                </ul>

                <h3>1.2 Worker Data</h3>
                <ul>
                    <li>Worker names (piece-rate and fixed/salaried)</li>
                    <li>Worker roles and monthly salary (for fixed workers)</li>
                    <li>Active/inactive status</li>
                </ul>

                <h3>1.3 Operational Data</h3>
                <ul>
                    <li>Daily production logs (meters produced, machine assignments, shift data)</li>
                    <li>Attendance records (day-to-day workers)</li>
                    <li>Payroll calculations and settlement records</li>
                    <li>Cash advance (Upaad) records — amounts, reasons, deduction status</li>
                    <li>Machine details — names, rates per meter, active status</li>
                    <li>Customer order details — party names, fabric quality, target meters, deadlines</li>
                    <li>Yarn batch/beam inventory — batch IDs, weights, quality assignments, yield audit reports</li>
                    <li>Fabric quality definitions — names, target yields, estimated sale prices, worker rates</li>
                </ul>

                <h3>1.4 Communication Data</h3>
                <ul>
                    <li>Owner phone number used for WhatsApp Daily Briefs (Premium feature)</li>
                    <li>Production summaries sent via WhatsApp</li>
                </ul>

                <h3>1.5 Technical Data</h3>
                <ul>
                    <li>Browser type and version</li>
                    <li>Device information</li>
                    <li>Data stored locally via IndexedDB (offline production entries) and Service Worker (PWA caching)</li>
                </ul>
            </PolicySection>

            <PolicySection id="purpose" title="2. Purpose of Data Collection">
                <p>We collect and process data strictly for the following purposes:</p>
                <ul>
                    <li><strong>Factory operations</strong> — enabling production logging, worker assignments, attendance tracking, and machine management</li>
                    <li><strong>Payroll processing</strong> — calculating piece-rate wages, managing salary settlements, tracking advance deductions</li>
                    <li><strong>Inventory &amp; yield analytics</strong> — tracking yarn-to-fabric conversion efficiency, detecting production leakage</li>
                    <li><strong>Order management</strong> — monitoring customer order progress, forecasting completion dates</li>
                    <li><strong>WhatsApp Daily Briefs</strong> — sending automated production summaries to the factory owner (with explicit consent)</li>
                    <li><strong>Account management</strong> — authentication, authorization, organization setup</li>
                </ul>
                <p>We do <strong>not</strong> use your data for advertising, behavioural profiling, or selling to third parties.</p>

                <PolicyCallout tone="blue" title="Role Under the DPDP Act 2023">
                    <p>
                        For the purposes of the Digital Personal Data Protection Act 2023, the <strong>Factory Owner (Subscriber) acts as the Data Fiduciary</strong>, determining the purpose and means of processing worker data. <strong>Weavly acts solely as a Data Processor</strong>, processing data on behalf of the Factory Owner.
                    </p>
                    <p>
                        It is the strict responsibility of the Factory Owner to obtain lawful consent from their workers before entering their personal data into the Weavly platform.
                    </p>
                </PolicyCallout>
            </PolicySection>

            <PolicySection id="consent" title="3. Consent">
                <p>
                    By creating an account on Weavly, you provide explicit consent for the collection and processing of your data for the purposes described above. You may withdraw consent at any time by contacting us (see Section 11). Withdrawal of consent may result in the inability to use certain features of the platform.
                </p>
                <p>
                    For the WhatsApp Daily Briefs feature, separate feature-level consent is obtained within the application.
                </p>
            </PolicySection>

            <PolicySection id="storage-security" title="4. How We Store and Protect Your Data">
                <ul>
                    <li><strong>Cloud infrastructure</strong> — All data is stored on Supabase (hosted on AWS), with servers in secure, SOC 2-compliant data centres.</li>
                    <li><strong>Encryption</strong> — Data is encrypted at rest (AES-256) and in transit (TLS 1.2+).</li>
                    <li><strong>Row Level Security (RLS)</strong> — PostgreSQL-level policies ensure every database query is automatically scoped to the user&apos;s organization. Cross-organization data access is architecturally impossible.</li>
                    <li><strong>JWT-based authentication</strong> — Organization ID and user role are embedded in session tokens and verified on every request.</li>
                    <li><strong>Access code system</strong> — Single-use authorization codes gate sensitive operations (editing locked production, backdated entries, worker deletion).</li>
                    <li><strong>Local storage</strong> — Offline data (IndexedDB) is stored locally on the user&apos;s device and synced to the server when connectivity is restored. This data is scoped to the authenticated user.</li>
                </ul>
            </PolicySection>

            <PolicySection id="retention" title="5. Data Retention">
                <p>We retain your data for the following periods:</p>
                <ul>
                    <li><strong>Production logs, payroll records, attendance records, advance records</strong> — Retained for a minimum of 3 years from creation, as required by Indian labour codes.</li>
                    <li><strong>Yarn batch audit reports</strong> — Retained for 3 years from the audit date.</li>
                    <li><strong>Account data</strong> — Retained for 180 days after account deletion or deactivation, as per IT Intermediary Guidelines 2021, then permanently deleted.</li>
                    <li><strong>Access code records</strong> — Retained for 1 year for audit trail purposes.</li>
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
                    <li><strong>WhatsApp Business API</strong> (Daily Brief delivery) — used only for owners who opt in to WhatsApp notifications</li>
                    <li><strong>Vercel</strong> (application hosting) — <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel Privacy Policy</a></li>
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
                    Weavly does not knowingly collect or process data of individuals under the age of 18. All workers added to the platform must be confirmed as being 18 years of age or older by the person creating the worker record. If we become aware that data of a minor has been collected, we will promptly delete such data.
                </p>
            </PolicySection>

            <PolicySection id="offline-data" title="10. Local Storage &amp; Offline Data">
                <p>
                    The Weavly Progressive Web App (PWA) uses <strong>IndexedDB</strong> to store production entries locally on your device when an internet connection is unavailable. This data is automatically synced to our servers upon reconnection and removed from local storage after sync. The app also uses a <strong>Service Worker</strong> for offline caching of application assets. No cookies are used for tracking purposes.
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
                                    {gro.gro_phone && (
                                        <span className="block text-sm font-medium text-zinc-500 dark:text-zinc-400">Phone: {gro.gro_phone}</span>
                                    )}
                                </>
                            ),
                        },
                        { label: 'Acknowledgment', value: '12 hours via email' },
                        { label: 'Resolution', value: '7 working days' },
                    ]}
                    note={
                        <>
                            Any Data Principal (Worker) or authorized representative may file a grievance regarding data inaccuracy, unauthorized processing, or consent withdrawal. Please include your <strong>Worker ID</strong> and the nature of your concern.
                        </>
                    }
                />

                <PolicyCallout tone="amber" title="Resolution Proof">
                    <p>
                        Upon resolution, Weavly will provide a Resolution Summary. A digital copy of this communication is archived in our secure Compliance Registry for a period of 3 years to ensure auditability under the Indian Code on Wages 2019.
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
