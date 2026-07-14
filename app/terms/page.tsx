import Link from 'next/link'
import type { Metadata } from 'next'
import { CalendarDays, Database, IndianRupee, Scale } from 'lucide-react'
import { PolicyCallout, PolicyContactPanel, PolicyPage, PolicySection } from '@/components/policies/legal-page'

export const metadata: Metadata = {
    title: 'Terms of Service — Weavly',
    description: 'Terms and conditions governing your use of the Weavly textile production management platform.',
}

const sections = [
    { href: '#service-description', title: 'Service Description' },
    { href: '#account-registration', title: 'Account Registration' },
    { href: '#subscription-payment', title: 'Commercial Terms & Payment' },
    { href: '#data-ownership', title: 'Data Ownership' },
    { href: '#acceptable-use', title: 'Acceptable Use' },
    { href: '#labor-compliance', title: 'Labor Compliance' },
    { href: '#analytics-disclaimer', title: 'Analytics Disclaimer' },
    { href: '#liability', title: 'Liability' },
    { href: '#intellectual-property', title: 'Intellectual Property' },
    { href: '#termination', title: 'Termination' },
    { href: '#indemnification', title: 'Indemnification' },
    { href: '#modifications', title: 'Modifications' },
    { href: '#disputes', title: 'Disputes' },
    { href: '#severability', title: 'Severability' },
    { href: '#contact', title: 'Contact' },
]

const plans = [
    {
        name: 'Free Trial',
        price: '₹0',
        details: '7 days, all features, no credit card required',
    },
    {
        name: 'Factory digitisation & implementation',
        price: '₹49,999 one-time + GST',
        details: 'Factory configuration, data setup, workflow mapping, and team training',
    },
    {
        name: 'Annual maintenance',
        price: '₹19,999/year + GST',
        details: 'Continued platform access, maintenance, updates, and standard support',
    },
]

export default function TermsOfServicePage() {
    return (
        <PolicyPage
            activePath="/terms"
            title="Terms of Service"
            description="The operating agreement for using Weavly: what the platform provides, what factory owners remain responsible for, and how billing, data, and disputes are handled."
            lastUpdated="July 13, 2026"
            sections={sections}
            facts={[
                { label: 'Trial', value: '7 days with all features', icon: CalendarDays },
                { label: 'Commercial model', value: 'Setup plus annual maintenance', icon: IndianRupee },
                { label: 'Data export', value: '30-day window after termination', icon: Database },
                { label: 'Jurisdiction', value: 'Surat, Gujarat, India', icon: Scale },
            ]}
        >
            <p className="mb-10 max-w-3xl text-lg font-medium leading-8 text-zinc-700 dark:text-zinc-300">
                These Terms of Service (&quot;Terms&quot;) govern your use of the Weavly platform (&quot;Service&quot;), operated by Weavly (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By creating an account or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
            </p>

            <PolicySection id="service-description" title="1. Service Description">
                <p>
                    Weavly is a multi-tenant Software-as-a-Service (SaaS) platform designed for textile mills and weaving factories. The Service provides:
                </p>
                <ul>
                    <li>Daily production logging and shift management</li>
                    <li>Piece-rate and fixed-salary payroll calculation and settlement</li>
                    <li>Worker and machine management</li>
                    <li>Attendance tracking for day-to-day workers</li>
                    <li>Cash advance (Upaad) tracking and auto-deduction</li>
                    <li>Customer order management with progress tracking and forecasting</li>
                    <li>Yarn-to-fabric inventory management and yield analytics</li>
                    <li>Optional WhatsApp production summaries, where enabled</li>
                </ul>
            </PolicySection>

            <PolicySection id="account-registration" title="2. Account Registration">
                <ul>
                    <li>You must provide accurate and complete information during registration.</li>
                    <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
                    <li>You must not share your account with third parties or allow unauthorized access.</li>
                    <li>You must be at least 18 years of age to create an account.</li>
                    <li>Factory Owners are responsible for the actions of Supervisors they authorize via the Factory Join Code.</li>
                </ul>
            </PolicySection>

            <PolicySection id="subscription-payment" title="3. Commercial Terms &amp; Payment">
                <h3>3.1 Plans</h3>
                <div className="not-prose my-6 grid gap-3 sm:hidden">
                    {plans.map((plan) => (
                        <div key={plan.name} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/5">
                            <div className="flex items-start justify-between gap-4">
                                <p className="font-bold text-zinc-950 dark:text-white">{plan.name}</p>
                                <p className="text-right text-sm font-bold text-orange-700 dark:text-orange-300">{plan.price}</p>
                            </div>
                            <p className="mt-3 text-sm font-medium leading-6 text-zinc-600 dark:text-zinc-300">{plan.details}</p>
                        </div>
                    ))}
                </div>
                <div className="not-prose my-6 hidden overflow-hidden rounded-lg border border-zinc-200 dark:border-white/10 sm:block">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-50 text-zinc-600 dark:bg-white/5 dark:text-zinc-300">
                            <tr>
                                <th className="px-4 py-3 font-bold">Plan</th>
                                <th className="px-4 py-3 font-bold">Price</th>
                                <th className="px-4 py-3 font-bold">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 bg-white text-zinc-700 dark:divide-white/10 dark:bg-zinc-950 dark:text-zinc-300">
                            {plans.map((plan) => (
                                <tr key={plan.name}>
                                    <td className="px-4 py-3 font-semibold text-zinc-950 dark:text-white">{plan.name}</td>
                                    <td className="px-4 py-3">{plan.price}</td>
                                    <td className="px-4 py-3">{plan.details}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Listed prices are exclusive of Goods and Services Tax (GST). GST will be added at the rate applicable on the invoice date. Final tax treatment, invoice description, and place of supply may vary as required by law.
                </p>

                <h3>3.2 Implementation and Billing</h3>
                <ul>
                    <li>The setup and implementation fee is billed separately from annual maintenance and covers agreed onboarding work, including configuration, data setup, workflow mapping, and training.</li>
                    <li>Implementation begins only after the scope, delivery plan, and payment terms are confirmed with you.</li>
                    <li>Annual maintenance is billed in advance for each 12-month service period. Unless otherwise stated in your order form, the first annual period begins when the production workspace is activated.</li>
                    <li>The free trial does not automatically convert to a paid service. You must explicitly accept the commercial proposal and complete payment.</li>
                    <li>Renewal may be cancelled before the next annual billing cycle. Cancellation stops the next renewal; it does not shorten an already paid service period.</li>
                    <li>All payments are processed through RBI-authorized payment aggregators.</li>
                </ul>
                <p>
                    Refund eligibility depends on the implementation stage and active use of the platform. See our <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link> for the applicable rules.
                </p>
            </PolicySection>

            <PolicySection id="data-ownership" title="4. Data Ownership">
                <p>
                    <strong>Your data belongs to you.</strong> All production logs, payroll records, worker information, order details, inventory data, and any other content you create on the platform remains your property. We do not claim ownership over your data. We act solely as a data processor on your behalf.
                </p>
                <p>
                    Upon account termination, you will have a 30-day window to export your data. After this period, your data will be deleted in accordance with our <Link href="/privacy">Privacy Policy</Link>.
                </p>
            </PolicySection>

            <PolicySection id="acceptable-use" title="5. Acceptable Use">
                <p>You agree not to:</p>
                <ul>
                    <li>Use the Service for any unlawful purpose or in violation of any applicable laws.</li>
                    <li>Attempt to gain unauthorized access to other organizations&apos; data.</li>
                    <li>Reverse engineer, decompile, or disassemble any part of the Service.</li>
                    <li>Use the Service to store or process data of individuals under 18 years of age.</li>
                    <li>Circumvent security features including the access code system, row-level security, or authentication mechanisms.</li>
                    <li>Use the Service in a manner that could damage, disable, or impair the platform.</li>
                </ul>
            </PolicySection>

            <PolicySection id="labor-compliance" title="6. Labor Law &amp; Statutory Compliance Disclaimer">
                <PolicyCallout tone="red" title="Important Legal Disclaimer regarding OSHWC, ESI, EPF, and Minimum Wages">
                    <p>
                        Weavly provides software tools to assist with factory management and calculation. However, <strong>Weavly is NOT a legal, HR, or compliance advisor.</strong> You, as the factory owner, are solely responsible for ensuring that your factory complies with all applicable local, state, and central labor laws, including but not limited to the Occupational Safety, Health and Working Conditions Code (OSHWC), the Employees&apos; Provident Funds and Miscellaneous Provisions Act, the Employees&apos; State Insurance Act, and the Code on Wages.
                    </p>
                    <p>
                        <strong>We accept zero liability</strong> for any statutory fines, penalties, labor disputes, unpaid wages, or compensation claims resulting from data entered into Weavly, algorithmic output, or your use (or misuse) of the platform. The platform&apos;s fields for ESI and PF tracking are provided for your administrative convenience only and do not guarantee legal compliance.
                    </p>
                </PolicyCallout>
            </PolicySection>

            <PolicySection id="analytics-disclaimer" title="7. Analytics Disclaimer">
                <PolicyCallout tone="amber" title="Important: Yield Analytics &amp; Loss Estimates">
                    <p>
                        The Yarn-to-Fabric Yield Engine provides <strong>estimated</strong> efficiency variances and monetary loss calculations based on data you provide (batch weights, target yields, production logs, and sale prices). These calculations are mathematical estimates and may be subject to inaccuracies arising from measurement errors, data entry errors, or incorrect configuration of quality parameters.
                    </p>
                    <p>
                        <strong>Yield analytics should not be used as the sole basis for employment decisions, accusations of theft or misconduct, or legal proceedings.</strong> Weavly is not liable for any decisions made based on yield analytics outputs. Users are responsible for independently verifying analytical findings before taking action.
                    </p>
                </PolicyCallout>
            </PolicySection>

            <PolicySection id="liability" title="8. Limitation of Liability">
                <ul>
                    <li>The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied.</li>
                    <li>We do not warrant that the Service will be uninterrupted, error-free, or completely secure.</li>
                    <li>Our total liability for any claims arising from or related to the Service shall not exceed the total fees paid by you in the 12 months preceding the claim.</li>
                    <li>We shall not be liable for any indirect, incidental, special, consequential, or punitive damages.</li>
                    <li>We are not responsible for losses arising from inaccurate data entered by users, including but not limited to incorrect production figures, machine rates, or quality parameters.</li>
                </ul>
            </PolicySection>

            <PolicySection id="intellectual-property" title="9. Intellectual Property">
                <p>
                    The Weavly platform, including its source code, design, user interface, brand name, logo, and documentation, is the exclusive intellectual property of Weavly. You are granted a limited, non-exclusive, non-transferable license to access and use the Service for the duration of your paid service period.
                </p>
            </PolicySection>

            <PolicySection id="termination" title="10. Termination">
                <ul>
                    <li><strong>By you</strong> — You may cancel annual maintenance before the next renewal. Your access continues until the end of the paid annual service period.</li>
                    <li><strong>By us</strong> — We may suspend or terminate your account for violation of these Terms, non-payment, or any activity that threatens the security or integrity of the platform. We will provide reasonable notice except in cases of severe violations.</li>
                    <li><strong>Post-termination</strong> — You will have 30 days to export your data. After 30 days, data will be deleted per our retention policy. Account information is retained for 180 days per IT Intermediary Guidelines 2021.</li>
                </ul>
                <p>
                    See our <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link> for details on refunds.
                </p>
            </PolicySection>

            <PolicySection id="indemnification" title="11. Indemnification">
                <p>
                    You agree to indemnify, defend, and hold harmless Weavly, its officers, employees, and agents from any claims, damages, losses, fines, or expenses arising from:
                </p>
                <ul>
                    <li>Your use or misuse of the Service.</li>
                    <li>Your violation of these Terms.</li>
                    <li>Your violation of any third-party rights (including worker data privacy right under the DPDP Act).</li>
                    <li><strong>Any unpaid statutory dues, including but not limited to EPF, ESI, TDS, or minimum wages, and any related penalties or legal action taken against your factory by government authorities.</strong></li>
                </ul>
            </PolicySection>

            <PolicySection id="modifications" title="12. Modifications to Terms">
                <p>
                    We may update these Terms from time to time. Material changes will be communicated via the platform or email at least 30 days before they take effect. Continued use of the Service after changes constitutes acceptance. If you do not agree with the updated Terms, you must stop using the Service and cancel your next renewal.
                </p>
            </PolicySection>

            <PolicySection id="disputes" title="13. Governing Law &amp; Dispute Resolution">
                <p>
                    These Terms shall be governed by and construed in accordance with the laws of the Republic of India. Any dispute arising from these Terms or the use of the Service shall be resolved through:
                </p>
                <ol>
                    <li><strong>Amicable settlement</strong> — The parties shall first attempt to resolve disputes through good-faith negotiation for a period of 30 days.</li>
                    <li><strong>Arbitration</strong> — If negotiation fails, the dispute shall be referred to arbitration under the Arbitration and Conciliation Act, 1996. The arbitration shall be conducted in Surat, Gujarat, India, in English.</li>
                    <li><strong>Jurisdiction</strong> — The courts of Surat, Gujarat, India shall have exclusive jurisdiction for any matters not subject to arbitration.</li>
                </ol>
            </PolicySection>

            <PolicySection id="severability" title="14. Severability">
                <p>
                    If any provision of these Terms is found to be invalid or unenforceable by a court of competent jurisdiction, the remaining provisions shall continue in full force and effect.
                </p>
            </PolicySection>

            <PolicySection id="contact" title="15. Contact">
                <p>For questions about these Terms, contact:</p>
                <PolicyContactPanel
                    title="Weavly Legal"
                    rows={[
                        {
                            label: 'Email',
                            value: <a href="mailto:legal@weavly.app" className="text-orange-700 hover:underline dark:text-orange-300">legal@weavly.app</a>,
                        },
                    ]}
                />
            </PolicySection>
        </PolicyPage>
    )
}
