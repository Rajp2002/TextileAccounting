import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import LandingFooter from "@/components/landing/footer"
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
    title: 'Privacy Policy — Weavly',
    description: 'Learn how Weavly collects, uses, and protects your personal data in compliance with India\'s Digital Personal Data Protection Act (DPDP Act) 2023.',
}

export default async function PrivacyPolicyPage() {
    // Fetch GRO details
    const supabase = await createClient()
    const { data: settings } = await supabase
        .from('compliance_settings')
        .select('*')
        .single()

    const gro = settings || {
        gro_name: 'Raj Patel',
        gro_email: 'rajpatel86420@gmail.com'
    }

    return (
        <main className="min-h-screen bg-gray-50 dark:bg-zinc-950 relative selection:bg-amber-100 selection:text-amber-900 overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 inset-x-0 h-[40rem] bg-gradient-to-b from-amber-500/10 to-transparent dark:from-amber-500/5 pointer-events-none" />

            {/* Sticky Header */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-gray-200 dark:border-white/10">
                <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
                        <div className="relative h-12 w-32">
                            <Image src="/images/WeavlyLogo.png" alt="Weavly Logo" fill className="object-contain" />
                        </div>
                    </Link>
                    <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600 dark:text-gray-300">
                        <Link href="/terms" className="hover:text-amber-700 dark:hover:text-amber-500 transition-colors">Terms</Link>
                        <Link href="/privacy" className="hover:text-amber-700 dark:hover:text-amber-500 transition-colors">Privacy</Link>
                        <Link href="/refund-policy" className="hover:text-amber-700 dark:hover:text-amber-500 transition-colors">Refunds</Link>
                    </nav>
                </div>
            </header>

            {/* Main Content Card */}
            <div className="relative mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
                <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl shadow-gray-200/40 dark:shadow-none ring-1 ring-gray-200 dark:ring-white/10 overflow-hidden">
                    
                    {/* Card Header */}
                    <div className="border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-zinc-800/50 px-8 py-10 sm:px-12 sm:py-14 text-center">
                        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                            Privacy Policy
                        </h1>
                        <p className="mt-4 text-sm font-medium text-amber-700 dark:text-amber-500 tracking-wide uppercase">
                            Last updated: April 26, 2026
                        </p>
                    </div>

                    {/* Prose Content */}
                    <article className="px-8 py-10 sm:px-12 sm:py-12 prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-amber-600 hover:prose-a:text-amber-700 prose-a:underline-offset-4 prose-a:decoration-amber-200 hover:prose-a:decoration-amber-600 transition-all font-medium">

                        <p className="lead text-lg text-gray-600 dark:text-gray-400 mb-8">
                        Weavly (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is committed to protecting the personal data of our users. This Privacy Policy explains how we collect, use, store, and protect your information when you use the Weavly platform. This policy is drafted in compliance with India&apos;s <strong>Digital Personal Data Protection Act (DPDP Act) 2023</strong>, the <strong>Information Technology Act 2000</strong>, and the <strong>IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021</strong>.
                    </p>

                    <h2>1. Data We Collect</h2>
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

                    <h2>2. Purpose of Data Collection</h2>
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

                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 not-prose my-6">
                        <p className="text-sm font-semibold text-blue-900 mb-2">Role Under the DPDP Act 2023</p>
                        <p className="text-sm text-blue-800">
                            For the purposes of the Digital Personal Data Protection Act 2023, the <strong>Factory Owner (Subscriber) acts as the Data Fiduciary</strong>, determining the purpose and means of processing worker data. <strong>Weavly acts solely as a Data Processor</strong>, processing data on behalf of the Factory Owner.
                        </p>
                        <p className="text-sm text-blue-800 mt-3">
                            It is the strict responsibility of the Factory Owner to obtain lawful consent from their workers before entering their personal data into the Weavly platform.
                        </p>
                    </div>

                    <h2>3. Consent</h2>
                    <p>
                        By creating an account on Weavly, you provide explicit consent for the collection and processing of your data for the purposes described above. You may withdraw consent at any time by contacting us (see Section 11). Withdrawal of consent may result in the inability to use certain features of the platform.
                    </p>
                    <p>
                        For the WhatsApp Daily Briefs feature, separate feature-level consent is obtained within the application.
                    </p>

                    <h2>4. How We Store and Protect Your Data</h2>
                    <ul>
                        <li><strong>Cloud infrastructure</strong> — All data is stored on Supabase (hosted on AWS), with servers in secure, SOC 2-compliant data centres.</li>
                        <li><strong>Encryption</strong> — Data is encrypted at rest (AES-256) and in transit (TLS 1.2+).</li>
                        <li><strong>Row Level Security (RLS)</strong> — PostgreSQL-level policies ensure every database query is automatically scoped to the user&apos;s organization. Cross-organization data access is architecturally impossible.</li>
                        <li><strong>JWT-based authentication</strong> — Organization ID and user role are embedded in session tokens and verified on every request.</li>
                        <li><strong>Access code system</strong> — Single-use authorization codes gate sensitive operations (editing locked production, backdated entries, worker deletion).</li>
                        <li><strong>Local storage</strong> — Offline data (IndexedDB) is stored locally on the user&apos;s device and synced to the server when connectivity is restored. This data is scoped to the authenticated user.</li>
                    </ul>

                    <h2>5. Data Retention</h2>
                    <p>We retain your data for the following periods:</p>
                    <ul>
                        <li><strong>Production logs, payroll records, attendance records, advance records</strong> — Retained for a minimum of 3 years from creation, as required by Indian labour codes.</li>
                        <li><strong>Yarn batch audit reports</strong> — Retained for 3 years from the audit date.</li>
                        <li><strong>Account data</strong> — Retained for 180 days after account deletion or deactivation, as per IT Intermediary Guidelines 2021, then permanently deleted.</li>
                        <li><strong>Access code records</strong> — Retained for 1 year for audit trail purposes.</li>
                    </ul>
                    <p>After the retention period, data is permanently and irreversibly deleted from our systems.</p>

                    <h2>6. Your Rights (Data Principal Rights)</h2>
                    <p>Under the DPDP Act 2023, you have the following rights:</p>
                    <ul>
                        <li><strong>Right to Access</strong> — You may request a copy of all personal data we hold about you or your organization.</li>
                        <li><strong>Right to Correction</strong> — You may request correction of inaccurate data.</li>
                        <li><strong>Right to Erasure</strong> — You may request deletion of your personal data, subject to our legal retention obligations.</li>
                        <li><strong>Right to Withdraw Consent</strong> — You may withdraw your consent for data processing at any time.</li>
                        <li><strong>Right to Grievance Redressal</strong> — You may raise concerns with our Grievance Officer (see Section 11).</li>
                    </ul>
                    <p>To exercise these rights, email us at the address listed in Section 11. We will respond within 30 days.</p>

                    <h2>7. Third-Party Data Processors</h2>
                    <p>We use the following third-party services to operate the platform:</p>
                    <ul>
                        <li><strong>Supabase</strong> (database hosting, authentication) — <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase Privacy Policy</a></li>
                        <li><strong>WhatsApp Business API</strong> (Daily Brief delivery) — used only for owners who opt in to WhatsApp notifications</li>
                        <li><strong>Vercel</strong> (application hosting) — <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel Privacy Policy</a></li>
                    </ul>
                    <p>We maintain Data Processing Agreements (DPAs) with our third-party processors to ensure equivalent data protection standards.</p>

                    <h2>8. Data Breach Notification</h2>
                    <p>
                        In the event of a data breach that may compromise the security of your personal data, we will notify the <strong>Data Protection Board of India</strong> and all affected users within <strong>72 hours</strong> of becoming aware of the breach, as required by the DPDP Act 2023.
                    </p>

                    <h2>9. Children&apos;s Data</h2>
                    <p>
                        Weavly does not knowingly collect or process data of individuals under the age of 18. All workers added to the platform must be confirmed as being 18 years of age or older by the person creating the worker record. If we become aware that data of a minor has been collected, we will promptly delete such data.
                    </p>

                    <h2>10. Local Storage &amp; Offline Data</h2>
                    <p>
                        The Weavly Progressive Web App (PWA) uses <strong>IndexedDB</strong> to store production entries locally on your device when an internet connection is unavailable. This data is automatically synced to our servers upon reconnection and removed from local storage after sync. The app also uses a <strong>Service Worker</strong> for offline caching of application assets. No cookies are used for tracking purposes.
                    </p>

                    <h2>11. Grievance Redressal Policy (Effective April 2026)</h2>
                    <p>We take your privacy concerns seriously. If you have any grievances regarding your data processing, you may reach out to our designated officer.</p>
                    
                    <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-2xl p-6 sm:p-8 not-prose border border-gray-200 dark:border-white/10 my-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-2">Grievance Redressal Officer (GRO)</h3>
                                    <p className="text-lg font-semibold text-amber-700 dark:text-amber-500">{gro.gro_name}</p>
                                    <p className="text-gray-600 dark:text-gray-400">Weavly Compliance Dept.</p>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-2">Primary Contact</h3>
                                    <div className="space-y-1">
                                        <a href={`mailto:${gro.gro_email}`} className="text-lg font-medium text-gray-900 dark:text-white hover:text-amber-600 transition-colors break-all">
                                            {gro.gro_email}
                                        </a>
                                        {gro.gro_phone && (
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Phone: {gro.gro_phone}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-2">Statutory Timelines</h3>
                                <ul className="space-y-2">
                                    <li className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                                        <div className="h-2 w-2 rounded-full bg-amber-500" />
                                        <span className="font-medium">Acknowledgment:</span> 12 Hours (via email)
                                    </li>
                                    <li className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                                        <div className="h-2 w-2 rounded-full bg-amber-500" />
                                        <span className="font-medium">Resolution:</span> 7 Working Days
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-white/10">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3">How to File a Grievance:</h3>
                            <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                                Any Data Principal (Worker) or authorized representative may file a grievance regarding data inaccuracy, unauthorized processing, or consent withdrawal. Please include your <strong>Worker ID</strong> and the nature of your concern.
                            </p>
                        </div>

                        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/30">
                            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-2">Resolution Proof:</h3>
                            <p className="text-sm text-amber-800 dark:text-amber-200/80 leading-relaxed">
                                Upon resolution, Weavly will provide a Resolution Summary. A digital copy of this communication is archived in our secure Compliance Registry for a period of 3 years to ensure auditability under the Indian Code on Wages 2019.
                            </p>
                        </div>
                    </div>

                    <h2>12. Changes to This Policy</h2>
                    <p>
                        We may update this Privacy Policy from time to time. Material changes will be communicated via the platform or email. Continued use of the service after changes constitutes acceptance of the updated policy.
                    </p>

                    <h2>13. Governing Law</h2>
                    <p>
                        This Privacy Policy is governed by the laws of the Republic of India. Any disputes arising from this policy will be subject to the exclusive jurisdiction of the courts in Surat, Gujarat, India.
                    </p>
                    </article>
                </div>
            </div>

            {/* Footer */}
            <LandingFooter />
        </main>
    )
}
