import Link from 'next/link'
import type { Metadata } from 'next'
import { CalendarDays, Database, IndianRupee, Scale } from 'lucide-react'
import { PolicyCallout, PolicyContactPanel, PolicyPage, PolicySection } from '@/components/policies/legal-page'

export const metadata: Metadata = {
    title: 'Terms of Service — Weavly',
    description: 'Terms and conditions governing your use of the Weavly Base Plan costing platform.',
}

const sections = [
    { href: '#service-description', title: 'Service Description' },
    { href: '#account-registration', title: 'Account Registration' },
    { href: '#subscription-payment', title: 'Commercial Terms & Payment' },
    { href: '#data-ownership', title: 'Data Ownership' },
    { href: '#acceptable-use', title: 'Acceptable Use' },
    { href: '#costing-disclaimer', title: 'Costing Disclaimer' },
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
        name: 'Weavly Cost Estimate (Base Plan)',
        price: '₹8,260 total first year, then ₹2,360 total/year renewal',
        details: 'Warp and weft yarn cost estimates, fabric templates, saved costing history, Cost Sheet export, and margin and landed-cost visibility',
    },
]

export default function TermsOfServicePage() {
    return (
        <PolicyPage
            activePath="/terms"
            title="Terms of Service"
            description="The operating agreement for using the Weavly Base Plan: what the costing workspace provides, what factory owners remain responsible for, and how billing, data, and disputes are handled."
            lastUpdated="July 13, 2026"
            sections={sections}
            facts={[
                { label: 'Renewal window', value: 'Manual renewal from 30 days before expiry', icon: CalendarDays },
                { label: 'Commercial model', value: 'Upfront first year plus annual renewal', icon: IndianRupee },
                { label: 'Data export', value: 'Saved costing export during a 30-day window', icon: Database },
                { label: 'Jurisdiction', value: 'Surat, Gujarat, India', icon: Scale },
            ]}
        >
            <p className="mb-10 max-w-3xl text-lg font-medium leading-8 text-zinc-700 dark:text-zinc-300">
                These Terms of Service (&quot;Terms&quot;) govern your use of the Weavly Base Plan (&quot;Service&quot;), operated by Weavly (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By creating an account or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
            </p>

            <PolicySection id="service-description" title="1. Service Description">
                <p>
                    Weavly is a multi-tenant Software-as-a-Service (SaaS) platform designed for textile mills and weaving factories. The current paid Service is the Base Plan, a focused costing workspace that provides:
                </p>
                <ul>
                    <li>Warp and weft yarn cost estimation</li>
                    <li>Fabric quality templates and reusable costing assumptions</li>
                    <li>Factory cost, GST, shortage, transport, commission, and margin configuration</li>
                    <li>Saved costing history and draft recovery</li>
                    <li>Production cost, landed cost, break-even price, and margin visibility</li>
                    <li>Cost Sheet export</li>
                </ul>
                <PolicyCallout tone="neutral" title="Current rollout boundary">
                    <p>The Base Plan is the only plan currently available for new subscriptions. Production logging, worker and machine operations, stock, dispatch, payroll, and connected factory analytics are planned for a later Full Suite release and are not available for purchase under these Terms.</p>
                </PolicyCallout>
            </PolicySection>

            <PolicySection id="account-registration" title="2. Account Registration">
                <ul>
                    <li>You must provide accurate and complete information during registration.</li>
                    <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
                    <li>You must not share your account with third parties or allow unauthorized access.</li>
                    <li>You must be at least 18 years of age to create an account.</li>
                    <li>Owners are responsible for the accuracy and lawful use of the information entered into their workspace.</li>
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
                    Listed prices are GST-inclusive totals at the displayed 18% rate. The taxable amount and GST component are shown separately for clarity. Payment receipts are provided after successful payment; GST invoices are issued only when approved billing details and supplier tax configuration are complete.
                </p>
                <p>
                    At this rollout, only the Weavly Cost Estimate (Base Plan) may be selected by a new subscriber. The Full Suite is in development, is not currently available for purchase, and does not create any present entitlement under these Terms.
                </p>

                <h3>3.2 Subscription and Billing</h3>
                <ul>
                    <li>First-year subscription fees are billed upfront and cover platform access, initial setup assistance, training, and standard workflow configuration.</li>
                    <li>Subscription activation and setup begin only after the selected plan and payment terms are confirmed.</li>
                    <li>Subsequent annual renewals are manual and billed in advance for each 12-month service period. Renewal becomes available during the final 30 days of the current paid period; no automatic charge is made.</li>
                    <li>Renewal may be cancelled before the next annual billing cycle. Cancellation stops the next renewal; it does not shorten an already paid service period.</li>
                    <li>All payments are processed through RBI-authorized payment aggregators.</li>
                </ul>
                <p>
                    Refund eligibility depends on the onboarding status and active use of the platform. See our <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link> for the applicable rules.
                </p>
            </PolicySection>

            <PolicySection id="data-ownership" title="4. Data Ownership">
                <p>
                    <strong>Your data belongs to you.</strong> Costing inputs, fabric qualities, saved costings, drafts, customer or party details, and any other content you create in the Base Plan remains your property. We do not claim ownership over your data. We act solely as a data processor on your behalf.
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
                    <li>Circumvent security features including row-level security or authentication mechanisms.</li>
                    <li>Use the Service in a manner that could damage, disable, or impair the platform.</li>
                </ul>
            </PolicySection>

            <PolicySection id="costing-disclaimer" title="6. Costing &amp; Tax Disclaimer">
                <PolicyCallout tone="amber" title="Important: Cost Estimates Are Not Accounting or Tax Advice">
                    <p>
                        Weavly provides software tools to help organize costing inputs and calculate estimates. However, <strong>Weavly is not an accountant, tax advisor, legal advisor, or compliance advisor.</strong> You remain responsible for verifying yarn rates, consumption, factory costs, GST treatment, margin assumptions, and any price or business decision made using the Service.
                    </p>
                    <p>
                        Costing results are mathematical estimates based on the data and configuration you provide. <strong>They should not be treated as guaranteed production costs, tax determinations, statutory records, or the sole basis for a commercial or legal decision.</strong> Weavly is not liable for losses caused by inaccurate inputs, outdated rates, measurement errors, or reliance on an unverified estimate.
                    </p>
                </PolicyCallout>
            </PolicySection>

            <PolicySection id="liability" title="7. Limitation of Liability">
                <ul>
                    <li>The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied.</li>
                    <li>We do not warrant that the Service will be uninterrupted, error-free, or completely secure.</li>
                    <li>Our total liability for any claims arising from or related to the Service shall not exceed the total fees paid by you in the 12 months preceding the claim.</li>
                    <li>We shall not be liable for any indirect, incidental, special, consequential, or punitive damages.</li>
                    <li>We are not responsible for losses arising from inaccurate data entered by users, including but not limited to incorrect yarn rates, cost assumptions, quantities, GST inputs, or quality parameters.</li>
                </ul>
            </PolicySection>

            <PolicySection id="intellectual-property" title="8. Intellectual Property">
                <p>
                    The Weavly platform, including its source code, design, user interface, brand name, logo, and documentation, is the exclusive intellectual property of Weavly. You are granted a limited, non-exclusive, non-transferable license to access and use the Service for the duration of your paid service period.
                </p>
            </PolicySection>

            <PolicySection id="termination" title="9. Termination">
                <ul>
                    <li><strong>By you</strong> — You may cancel annual maintenance before the next renewal. Your access continues until the end of the paid annual service period.</li>
                    <li><strong>By us</strong> — We may suspend or terminate your account for violation of these Terms, non-payment, or any activity that threatens the security or integrity of the platform. We will provide reasonable notice except in cases of severe violations.</li>
                    <li><strong>Post-termination</strong> — You will have 30 days to export your data. After 30 days, data will be deleted per our retention policy. Account information is retained for 180 days per IT Intermediary Guidelines 2021.</li>
                </ul>
                <p>
                    See our <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link> for details on refunds.
                </p>
            </PolicySection>

            <PolicySection id="indemnification" title="10. Indemnification">
                <p>
                    You agree to indemnify, defend, and hold harmless Weavly, its officers, employees, and agents from any claims, damages, losses, fines, or expenses arising from:
                </p>
                <ul>
                    <li>Your use or misuse of the Service.</li>
                    <li>Your violation of these Terms.</li>
                    <li>Your violation of any third-party rights, including privacy rights under the DPDP Act.</li>
                    <li><strong>Any unpaid tax, statutory, or regulatory obligations arising from your business and any related penalties or legal action taken by government authorities.</strong></li>
                </ul>
            </PolicySection>

            <PolicySection id="modifications" title="11. Modifications to Terms">
                <p>
                    We may update these Terms from time to time. Material changes will be communicated via the platform or email at least 30 days before they take effect. Continued use of the Service after changes constitutes acceptance. If you do not agree with the updated Terms, you must stop using the Service and cancel your next renewal.
                </p>
            </PolicySection>

            <PolicySection id="disputes" title="12. Governing Law &amp; Dispute Resolution">
                <p>
                    These Terms shall be governed by and construed in accordance with the laws of the Republic of India. Any dispute arising from these Terms or the use of the Service shall be resolved through:
                </p>
                <ol>
                    <li><strong>Amicable settlement</strong> — The parties shall first attempt to resolve disputes through good-faith negotiation for a period of 30 days.</li>
                    <li><strong>Arbitration</strong> — If negotiation fails, the dispute shall be referred to arbitration under the Arbitration and Conciliation Act, 1996. The arbitration shall be conducted in Surat, Gujarat, India, in English.</li>
                    <li><strong>Jurisdiction</strong> — The courts of Surat, Gujarat, India shall have exclusive jurisdiction for any matters not subject to arbitration.</li>
                </ol>
            </PolicySection>

            <PolicySection id="severability" title="13. Severability">
                <p>
                    If any provision of these Terms is found to be invalid or unenforceable by a court of competent jurisdiction, the remaining provisions shall continue in full force and effect.
                </p>
            </PolicySection>

            <PolicySection id="contact" title="14. Contact">
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
