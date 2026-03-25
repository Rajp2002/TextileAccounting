import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Terms of Service — Vastra',
    description: 'Terms and conditions governing your use of the Vastra textile production management platform.',
}

export default function TermsOfServicePage() {
    return (
        <main className="min-h-screen bg-white">
            {/* Header */}
            <header className="border-b border-gray-100">
                <div className="mx-auto max-w-4xl px-6 py-6 flex items-center gap-3">
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="relative h-10 w-10">
                            <Image src="/logo.png" alt="Vastra Logo" fill className="object-contain" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-gray-900">Vastra</span>
                    </Link>
                </div>
            </header>

            {/* Content */}
            <article className="mx-auto max-w-4xl px-6 py-12 pb-24">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
                <p className="text-sm text-gray-500 mb-10">Last updated: March 25, 2026</p>

                <div className="prose prose-gray max-w-none prose-headings:font-semibold prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-lg prose-h3:mt-6 prose-p:text-gray-600 prose-li:text-gray-600 prose-a:text-amber-700 prose-a:no-underline hover:prose-a:underline">

                    <p>
                        These Terms of Service (&quot;Terms&quot;) govern your use of the Vastra platform (&quot;Service&quot;), operated by Vastra (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By creating an account or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
                    </p>

                    <h2>1. Service Description</h2>
                    <p>
                        Vastra is a multi-tenant Software-as-a-Service (SaaS) platform designed for textile mills and weaving factories. The Service provides:
                    </p>
                    <ul>
                        <li>Daily production logging and shift management</li>
                        <li>Piece-rate and fixed-salary payroll calculation and settlement</li>
                        <li>Worker and machine management</li>
                        <li>Attendance tracking for day-to-day workers</li>
                        <li>Cash advance (Upaad) tracking and auto-deduction</li>
                        <li>Customer order management with progress tracking and forecasting</li>
                        <li>Yarn-to-fabric inventory management and yield analytics</li>
                        <li>WhatsApp Daily Briefs (Premium tier)</li>
                    </ul>

                    <h2>2. Account Registration</h2>
                    <ul>
                        <li>You must provide accurate and complete information during registration.</li>
                        <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
                        <li>You must not share your account with third parties or allow unauthorized access.</li>
                        <li>You must be at least 18 years of age to create an account.</li>
                        <li>Factory Owners are responsible for the actions of Supervisors they authorize via the Factory Join Code.</li>
                    </ul>

                    <h2>3. Subscription Plans &amp; Payment</h2>

                    <h3>3.1 Plans</h3>
                    <table className="w-full text-sm">
                        <thead>
                            <tr>
                                <th className="text-left py-2">Plan</th>
                                <th className="text-left py-2">Price</th>
                                <th className="text-left py-2">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="py-2">Free Trial</td>
                                <td className="py-2">₹0</td>
                                <td className="py-2">7 days, all features, no credit card required</td>
                            </tr>
                            <tr>
                                <td className="py-2">Base</td>
                                <td className="py-2">₹600/month + GST</td>
                                <td className="py-2">Up to 15 workers, basic support</td>
                            </tr>
                            <tr>
                                <td className="py-2">Premium</td>
                                <td className="py-2">₹1,700/month + GST</td>
                                <td className="py-2">Unlimited workers, WhatsApp briefs, priority support</td>
                            </tr>
                            <tr>
                                <td className="py-2">Setup &amp; Training</td>
                                <td className="py-2">₹4,999 one-time + GST</td>
                                <td className="py-2">Configuration, data import, training session</td>
                            </tr>
                        </tbody>
                    </table>
                    <p className="text-sm text-gray-500">
                        All prices are exclusive of Goods and Services Tax (GST) at the applicable rate (currently 18%). GST will be added to all invoices.
                    </p>

                    <h3>3.2 Billing</h3>
                    <ul>
                        <li>Subscriptions are billed monthly in advance.</li>
                        <li>The free trial does not automatically convert to a paid plan. You must explicitly subscribe after the trial ends.</li>
                        <li>We will send a pre-debit notification at least 24 hours before each recurring charge.</li>
                        <li>All payments are processed through RBI-authorized payment aggregators.</li>
                    </ul>

                    <h2>4. Data Ownership</h2>
                    <p>
                        <strong>Your data belongs to you.</strong> All production logs, payroll records, worker information, order details, inventory data, and any other content you create on the platform remains your property. We do not claim ownership over your data. We act solely as a data processor on your behalf.
                    </p>
                    <p>
                        Upon account termination, you will have a 30-day window to export your data. After this period, your data will be deleted in accordance with our <Link href="/privacy">Privacy Policy</Link>.
                    </p>

                    <h2>5. Acceptable Use</h2>
                    <p>You agree not to:</p>
                    <ul>
                        <li>Use the Service for any unlawful purpose or in violation of any applicable laws.</li>
                        <li>Attempt to gain unauthorized access to other organizations&apos; data.</li>
                        <li>Reverse engineer, decompile, or disassemble any part of the Service.</li>
                        <li>Use the Service to store or process data of individuals under 18 years of age.</li>
                        <li>Circumvent security features including the access code system, row-level security, or authentication mechanisms.</li>
                        <li>Use the Service in a manner that could damage, disable, or impair the platform.</li>
                    </ul>

                    <h2>6. Labor Law &amp; Statutory Compliance Disclaimer</h2>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5 not-prose my-6 flex flex-col gap-3">
                        <p className="text-sm font-semibold text-red-900">Important Legal Disclaimer regarding OSHWC, ESI, EPF, and Minimum Wages</p>
                        <p className="text-sm text-red-800">
                            Vastra provides software tools to assist with factory management and calculation. However, <strong>Vastra is NOT a legal, HR, or compliance advisor.</strong> You, as the factory owner, are solely responsible for ensuring that your factory complies with all applicable local, state, and central labor laws, including but not limited to the Occupational Safety, Health and Working Conditions Code (OSHWC), the Employees' Provident Funds and Miscellaneous Provisions Act, the Employees' State Insurance Act, and the Code on Wages.
                        </p>
                        <p className="text-sm text-red-800">
                            <strong>We accept zero liability</strong> for any statutory fines, penalties, labor disputes, unpaid wages, or compensation claims resulting from data entered into Vastra, algorithmic output, or your use (or misuse) of the platform. The platform's fields for ESI, PF, and OSHWC incident tracking are provided for your administrative convenience only and do not guarantee legal compliance.
                        </p>
                    </div>

                    <h2>7. Analytics Disclaimer</h2>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 not-prose my-6">
                        <p className="text-sm font-semibold text-amber-900 mb-2">Important: Yield Analytics &amp; Loss Estimates</p>
                        <p className="text-sm text-amber-800">
                            The Yarn-to-Fabric Yield Engine provides <strong>estimated</strong> efficiency variances and monetary loss calculations based on data you provide (batch weights, target yields, production logs, and sale prices). These calculations are mathematical estimates and may be subject to inaccuracies arising from measurement errors, data entry errors, or incorrect configuration of quality parameters.
                        </p>
                        <p className="text-sm text-amber-800 mt-3">
                            <strong>Yield analytics should not be used as the sole basis for employment decisions, accusations of theft or misconduct, or legal proceedings.</strong> Vastra is not liable for any decisions made based on yield analytics outputs. Users are responsible for independently verifying analytical findings before taking action.
                        </p>
                    </div>

                    <h2>8. Limitation of Liability</h2>
                    <ul>
                        <li>The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied.</li>
                        <li>We do not warrant that the Service will be uninterrupted, error-free, or completely secure.</li>
                        <li>Our total liability for any claims arising from or related to the Service shall not exceed the total subscription fees paid by you in the 12 months preceding the claim.</li>
                        <li>We shall not be liable for any indirect, incidental, special, consequential, or punitive damages.</li>
                        <li>We are not responsible for losses arising from inaccurate data entered by users, including but not limited to incorrect production figures, machine rates, or quality parameters.</li>
                    </ul>

                    <h2>9. Intellectual Property</h2>
                    <p>
                        The Vastra platform, including its source code, design, user interface, brand name, logo, and documentation, is the exclusive intellectual property of Vastra. You are granted a limited, non-exclusive, non-transferable license to access and use the Service for the duration of your subscription.
                    </p>

                    <h2>10. Termination</h2>
                    <ul>
                        <li><strong>By you</strong> — You may cancel your subscription at any time. Upon cancellation, your access continues until the end of the current billing period.</li>
                        <li><strong>By us</strong> — We may suspend or terminate your account for violation of these Terms, non-payment, or any activity that threatens the security or integrity of the platform. We will provide reasonable notice except in cases of severe violations.</li>
                        <li><strong>Post-termination</strong> — You will have 30 days to export your data. After 30 days, data will be deleted per our retention policy. Account information is retained for 180 days per IT Intermediary Guidelines 2021.</li>
                    </ul>
                    <p>
                        See our <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link> for details on refunds.
                    </p>

                    <h2>11. Indemnification</h2>
                    <p>
                        You agree to indemnify, defend, and hold harmless Vastra, its officers, employees, and agents from any claims, damages, losses, fines, or expenses arising from:
                    </p>
                    <ul>
                        <li>Your use or misuse of the Service.</li>
                        <li>Your violation of these Terms.</li>
                        <li>Your violation of any third-party rights (including worker data privacy right under the DPDP Act).</li>
                        <li><strong>Any unpaid statutory dues, including but not limited to EPF, ESI, TDS, or minimum wages, and any related penalties or legal action taken against your factory by government authorities.</strong></li>
                    </ul>

                    <h2>12. Modifications to Terms</h2>
                    <p>
                        We may update these Terms from time to time. Material changes will be communicated via the platform or email at least 30 days before they take effect. Continued use of the Service after changes constitutes acceptance. If you do not agree with the updated Terms, you must stop using the Service and cancel your subscription.
                    </p>

                    <h2>13. Governing Law &amp; Dispute Resolution</h2>
                    <p>
                        These Terms shall be governed by and construed in accordance with the laws of the Republic of India. Any dispute arising from these Terms or the use of the Service shall be resolved through:
                    </p>
                    <ol>
                        <li><strong>Amicable settlement</strong> — The parties shall first attempt to resolve disputes through good-faith negotiation for a period of 30 days.</li>
                        <li><strong>Arbitration</strong> — If negotiation fails, the dispute shall be referred to arbitration under the Arbitration and Conciliation Act, 1996. The arbitration shall be conducted in Surat, Gujarat, India, in English.</li>
                        <li><strong>Jurisdiction</strong> — The courts of Surat, Gujarat, India shall have exclusive jurisdiction for any matters not subject to arbitration.</li>
                    </ol>

                    <h2>14. Severability</h2>
                    <p>
                        If any provision of these Terms is found to be invalid or unenforceable by a court of competent jurisdiction, the remaining provisions shall continue in full force and effect.
                    </p>

                    <h2>15. Contact</h2>
                    <p>For questions about these Terms, contact:</p>
                    <div className="bg-gray-50 rounded-xl p-6 not-prose text-sm text-gray-700 space-y-1 my-4">
                        <p className="font-semibold text-gray-900">Vastra Legal</p>
                        <p>Email: <a href="mailto:legal@vastra.app" className="text-amber-700 hover:underline">legal@vastra.app</a></p>
                    </div>
                </div>
            </article>

            {/* Footer */}
            <footer className="border-t border-gray-100 bg-gray-50 py-8 px-6">
                <div className="mx-auto max-w-4xl flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-500">
                    <p>© {new Date().getFullYear()} Vastra. All rights reserved.</p>
                    <div className="flex gap-6">
                        <Link href="/privacy" className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
                        <Link href="/refund-policy" className="hover:text-gray-900 transition-colors">Refund Policy</Link>
                    </div>
                </div>
            </footer>
        </main>
    )
}
