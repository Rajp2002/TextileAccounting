import Link from 'next/link'
import type { Metadata } from 'next'
import { CalendarDays, Database, IndianRupee, Scale } from 'lucide-react'
import { PolicyCallout, PolicyContactPanel, PolicyPage, PolicySection } from '@/components/policies/legal-page'
import { LEGAL_DOCUMENTS } from '@/lib/legal-documents'
import { LEGAL_OPERATOR } from '@/lib/legal-operator'
import { ACCESS_DAYS, BILLING_PLANS, BILLING_SELF_SERVE_PLAN_TIERS, RENEWAL_ELIGIBILITY_DAYS } from '@/lib/billing-constants'
import { formatINR } from '@/lib/finance'

export const metadata: Metadata = {
    title: 'Terms of Service — Weavly',
    description: 'Terms for Weavly Free, Lite, and Base: costing allowances, plan features, annual pricing, renewal, and account data.',
}

const sections = [
    { href: '#parties-acceptance', title: 'Parties & Acceptance' },
    { href: '#base-plan', title: 'Free, Lite & Base Scope' },
    { href: '#free-allowance', title: 'Free Allowance' },
    { href: '#accounts', title: 'Accounts' },
    { href: '#commercial-terms', title: 'Price & Payment' },
    { href: '#customer-data', title: 'Customer Data' },
    { href: '#acceptable-use', title: 'Acceptable Use' },
    { href: '#estimates', title: 'Costing Disclaimer' },
    { href: '#availability', title: 'Availability & Changes' },
    { href: '#ip', title: 'Intellectual Property' },
    { href: '#termination', title: 'Suspension & Termination' },
    { href: '#refunds', title: 'Refunds' },
    { href: '#liability', title: 'Liability' },
    { href: '#indemnity', title: 'Indemnity' },
    { href: '#term-changes', title: 'Changes to Terms' },
    { href: '#disputes', title: 'Disputes' },
    { href: '#general', title: 'General' },
    { href: '#contact', title: 'Contact' },
]

const plans = [
    { name: 'Weavly Free', firstYear: '₹0 — no subscription fee', renewal: 'No annual renewal' },
    ...BILLING_SELF_SERVE_PLAN_TIERS.map((tier) => ({
        name: BILLING_PLANS[tier].name,
        firstYear: `${formatINR(BILLING_PLANS[tier].firstYearTotalPaise / 100, { hideDecimals: true })} total (GST included)`,
        renewal: `${formatINR(BILLING_PLANS[tier].renewalTotalPaise / 100, { hideDecimals: true })} total/year (GST included)`,
    })),
]

export default function TermsOfServicePage() {
    return (
        <PolicyPage
            activePath="/terms"
            title="Terms of Service"
            description="The contract for Weavly Free costing, the complete Lite costing workspace, and Base costing with connected production and worker settlement."
            lastUpdated={LEGAL_DOCUMENTS.terms.displayDate}
            sections={sections}
            facts={[
                { label: 'Available plans', value: 'Weavly Free, Lite, and Base', icon: Database },
                { label: 'Starting price', value: '₹0 on Free; paid catalog below', icon: IndianRupee },
                { label: 'Renewal', value: `Manual from ${RENEWAL_ELIGIBILITY_DAYS} days before expiry`, icon: CalendarDays },
                { label: 'Contract location', value: 'Surat, Gujarat, India', icon: Scale },
            ]}
        >
            <p className="mb-10 max-w-3xl text-lg font-medium leading-8 text-zinc-700 dark:text-zinc-300">
                These Terms of Service (&quot;Terms&quot;) govern use of Weavly Free and paid subscriptions to Weavly Lite and Weavly Base. Until a company is incorporated and these Terms are updated, the Service is offered by {LEGAL_OPERATOR.displayName} (&quot;Weavly&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). The person accepting these Terms for a factory or business confirms that they are authorized to bind that business.
            </p>

            <PolicySection id="parties-acceptance" title="1. Parties and Acceptance">
                <p>
                    These Terms form an agreement between Weavly and the individual, proprietorship, firm, company, or other organization identified in the account or billing details (&quot;Customer&quot;, &quot;you&quot;, or &quot;your&quot;). By affirmatively accepting these Terms at signup, purchasing a plan, or using the Service after acceptance, you agree to these Terms, the <Link href="/privacy">Privacy Policy</Link>, and the <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>.
                </p>
                <p>
                    You must be at least 18 years old and legally competent to contract. If you lack authority to bind the named business, do not create or purchase an account on its behalf.
                </p>
            </PolicySection>

            <PolicySection id="base-plan" title="2. Free, Lite, and Base Plan Scope">
                <p>Weavly offers three current plans for one Customer organization or factory workspace:</p>
                <ul>
                    <li><strong>Weavly Free:</strong> two successful costings per week, automatic saving of completed costings, viewing their breakdowns, and Cost Sheet export. Reusable qualities, Rate Book, costing defaults, and production management are not included.</li>
                    <li><strong>Weavly Lite:</strong> the complete textile estimator, unlimited costings, live costing calculations, saved costings and history, reusable qualities, Rate Book references, costing tools, and hosted account data.</li>
                    <li><strong>Weavly Base:</strong> all Lite functionality plus production jobs created from saved costings, planned/produced/remaining metres, machine or loom allocation where enabled, owner production updates, piece-rate worker records, advances, and production settlement records.</li>
                    <li>Cost Sheets, exports, costing breakdowns, and other costing-management workflows where enabled in the selected workspace</li>
                    <li>Owner-accessible organization data export and billing history</li>
                </ul>
                <p>
                    Each plan covers one Customer organization or factory workspace. Individual user credentials may not be shared. All three plans use the same underlying costing engine. Free applies a weekly calculation allowance; Lite and Base do not have that weekly limit. Free requires an internet connection for calculations and does not provide recoverable unfinished drafts.
                </p>
                <PolicyCallout tone="neutral" title="Choose the workflow you need">
                    <p>
                        Free supports occasional costings. Lite is a complete costing-management product for customers who do not need production management. Base adds only the production workflow currently described in the product, with the originating costing and quality carried into the production record where supported. Separate supervisor accounts, attendance, statutory payroll, and other broader operational modules shown in internal plans or development materials are outside the current Lite and Base catalog and are not promised under these Terms.
                    </p>
                </PolicyCallout>
            </PolicySection>

            <PolicySection id="free-allowance" title="2.1 Free Plan Allowance">
                <ul>
                    <li>The current Free allowance is two successful new calculations per week for the verified owner. It resets every Monday at 12:00 am India Standard Time (Asia/Kolkata). Unused allowance does not roll over; switching devices or workspaces does not create an extra allowance.</li>
                    <li>A successful calculation saves its inputs and result to your account and uses one allowance. A new calculation after changing inputs uses another allowance. Validation failures and retries of the same completed request do not use an additional allowance.</li>
                    <li>Viewing saved costings, exporting their Cost Sheets, and using the example-data walkthrough do not use the weekly allowance.</li>
                    <li>Free has no subscription fee, card requirement, or paid trial expiry. Enrollment and continued use are subject to account verification, availability, and these Terms. Changes to the Free offer will be disclosed in the product and these Terms.</li>
                    <li>When the allowance is exhausted, wait for the next reset or choose Lite or Base. A paid upgrade requires your explicit purchase; reaching the Free limit never triggers a charge.</li>
                </ul>
            </PolicySection>

            <PolicySection id="accounts" title="3. Accounts and Customer Responsibilities">
                <ul>
                    <li>You must provide accurate account, organization, billing, and contact information and keep it reasonably current.</li>
                    <li>You are responsible for protecting account credentials and devices and for activity performed through authorized accounts.</li>
                    <li>You must notify us promptly if you suspect unauthorized access or a compromised account.</li>
                    <li>You are responsible for the legality, accuracy, quality, and permitted use of information entered into the workspace.</li>
                    <li>You must maintain your own source records and independently verify important costing, tax, accounting, and commercial decisions.</li>
                </ul>
            </PolicySection>

            <PolicySection id="commercial-terms" title="4. Price, Payment, Renewal, and Referrals">
                <h3>4.1 Current Free, Lite, and Base catalog</h3>
                <div className="not-prose my-6 overflow-x-auto rounded-lg border border-zinc-200 dark:border-white/10">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-50 text-zinc-600 dark:bg-white/5 dark:text-zinc-300">
                            <tr>
                                <th className="px-4 py-3 font-bold">Plan</th>
                                <th className="px-4 py-3 font-bold">First year</th>
                                <th className="px-4 py-3 font-bold">Later annual renewal</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white text-zinc-700 dark:bg-[#09090b] dark:text-zinc-300">
                            {plans.map((plan) => (
                                <tr key={plan.name}>
                                    <td className="px-4 py-3 font-semibold text-zinc-950 dark:text-white">{plan.name}</td>
                                    <td className="px-4 py-3">{plan.firstYear}</td>
                                    <td className="px-4 py-3">{plan.renewal}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <ul>
                    <li>Free requires no payment. For Lite or Base, the selected first-year fee is paid upfront for {ACCESS_DAYS} days of access. Any onboarding assistance included with a purchase is limited to what is described at checkout or agreed in writing; custom implementation or data migration is not included unless expressly agreed.</li>
                    <li>The final amount, tax treatment, and supplier details shown at live checkout or on the applicable order control if they differ from this page because of a lawful tax or catalog update.</li>
                    <li>Live payment collection and GST tax invoices are subject to completion of the required supplier, payment-provider, and tax configuration. A payment receipt is not a GST tax invoice.</li>
                    <li>Razorpay or another disclosed payment provider may process the payment. You authorize the selected provider to process the transaction information needed to complete it.</li>
                </ul>

                <h3>4.2 Manual renewal</h3>
                <ul>
                    <li>Paid-plan renewal is manual and may be purchased during the final {RENEWAL_ELIGIBILITY_DAYS} days of the current paid period. Free has no annual renewal.</li>
                    <li>We do not automatically charge a Lite or Base renewal. If you do not wish to renew, no cancellation action is required; simply do not complete a renewal payment.</li>
                    <li>A renewal adds the next {ACCESS_DAYS}-day period for the selected plan after successful payment and server-side activation.</li>
                </ul>

                <h3>4.3 Referral program</h3>
                <p>
                    A referral program applies only while it is displayed as active in the product. Under the current program, an eligible active Weavly Base Customer that has paid its initial year may earn one non-cash Base renewal credit when a referred organization pays its own initial Base year, subject to the displayed annual cap and anti-abuse checks. Credits are not transferable, cannot be redeemed for cash or an initial purchase, and may be reversed for duplicate, fraudulent, refunded, or chargeback transactions.
                </p>
            </PolicySection>

            <PolicySection id="customer-data" title="5. Customer Data and Privacy">
                <p>
                    As between the parties, Customer retains its rights in costing inputs, fabric qualities, saved costings, drafts, contact details, and other content submitted to the Service (&quot;Customer Data&quot;). Customer grants Weavly a limited right to host, copy, transmit, calculate, format, back up, and otherwise process Customer Data only as needed to provide, secure, support, and lawfully operate the Service.
                </p>
                <p>
                    Weavly is responsible for account, authentication, billing, security, support, and service-administration processing it controls. Where Customer enters personal information about another person for Customer&apos;s own business purposes, Customer is responsible for having authority or another lawful basis to do so, and Weavly processes that information to provide the Service. Further details are in the <Link href="/privacy">Privacy Policy</Link>.
                </p>
                <p>
                    The owner-only organization export remains available while the account is retained, including when paid feature access has expired. Customer may permanently delete the workspace using the available account-deletion control, subject to limited records that must be retained by law or for permitted unresolved purposes described in the Privacy Policy.
                </p>
            </PolicySection>

            <PolicySection id="acceptable-use" title="6. Acceptable Use">
                <p>You must not, and must not help another person to:</p>
                <ul>
                    <li>Use the Service unlawfully, fraudulently, or to infringe another person&apos;s rights</li>
                    <li>Access or attempt to access another organization&apos;s account, data, credentials, or security controls</li>
                    <li>Probe, scan, disrupt, overload, bypass, or defeat authentication, rate limits, tenant isolation, or other safeguards</li>
                    <li>Upload malicious code or use automated means that materially burden the Service without written permission</li>
                    <li>Copy, resell, sublicense, reverse engineer, or create a competing service from protected parts of the Service except to the extent a restriction is prohibited by law</li>
                    <li>Enter information you are not authorized to use or disclose</li>
                </ul>
            </PolicySection>

            <PolicySection id="estimates" title="7. Costing, GST, and Business-Decision Disclaimer">
                <PolicyCallout tone="amber" title="Costing outputs are estimates">
                    <p>
                        Weavly organizes inputs and performs calculations; it does not provide accounting, tax, legal, engineering, or investment advice. Outputs depend on the rates, units, formula selections, assumptions, and other information supplied by Customer.
                    </p>
                    <p>
                        Customer must independently verify yarn rates, construction, consumption, wastage, factory costs, GST treatment, margins, quantities, and commercial suitability. An estimator output is not a guaranteed production cost, binding quotation, tax determination, statutory invoice, or substitute for professional advice or source records.
                    </p>
                </PolicyCallout>
            </PolicySection>

            <PolicySection id="availability" title="8. Availability, Support, and Service Changes">
                <p>
                    We aim to keep Free, Lite, and Base available but do not promise uninterrupted or error-free operation. Access may be affected by maintenance, internet or provider outages, security incidents, force majeure events, or emergency remediation.
                </p>
                <p>
                    We may improve, replace, or discontinue individual features. During a paid period, we will not intentionally remove the core ability to calculate, save, and export Lite costings without a security, legal, provider, or technical reason. If we permanently discontinue a paid Lite or Base plan for convenience before the end of a Customer&apos;s current period, we will provide a reasonable export opportunity and a pro-rata refund or comparable remedy for the unused period.
                </p>
            </PolicySection>

            <PolicySection id="ip" title="9. Intellectual Property and Feedback">
                <p>
                    The Service, software, interface, documentation, formulas as implemented, branding, and other materials supplied by Weavly are owned by {LEGAL_OPERATOR.grievanceOfficer} or the applicable licensors and are protected by law. Subject to these Terms and any applicable payment, Customer receives a limited, non-exclusive, non-transferable, non-sublicensable right to use the selected plan internally during the applicable access period.
                </p>
                <p>
                    If you provide suggestions or feedback, you permit us to use it without payment or restriction, provided we do not identify you publicly without permission.
                </p>
            </PolicySection>

            <PolicySection id="termination" title="10. Suspension, Expiry, and Termination">
                <ul>
                    <li><strong>Expiry</strong> — Paid access lasts for the current {ACCESS_DAYS}-day period unless renewed. On Lite expiry, paid costing access is restricted unless another entitlement applies. Under the current access policy, an organization with a completed paid Base period retains the Lite costing desk after Base expires; Base-only production creation and mutation actions are unavailable until Base is reactivated. A paid account does not automatically revert to Free on expiry.</li>
                    <li><strong>Production records</strong> — A plan change or expiry does not delete production history. Existing production records remain retained with the organization, and Base capability is restored when an eligible Base renewal is activated.</li>
                    <li><strong>Customer deletion</strong> — The owner may permanently delete the workspace through Settings. Deletion also attempts to cancel any applicable provider subscription before database removal.</li>
                    <li><strong>Immediate protective suspension</strong> — We may restrict access without advance notice when reasonably necessary to address a security threat, unlawful use, fraud, payment reversal, or risk to another customer or the Service.</li>
                    <li><strong>Other material breach</strong> — Where reasonably curable, we will give notice and a reasonable opportunity to cure before terminating for material breach.</li>
                    <li><strong>Effect</strong> — Ending paid access does not transfer Customer Data to Weavly or remove accrued payment, confidentiality, intellectual-property, liability, dispute, or other provisions intended to survive.</li>
                </ul>
            </PolicySection>

            <PolicySection id="refunds" title="11. Cancellations, Refunds, and Billing Errors">
                <p>
                    Because renewal is manual, choosing not to renew prevents a future renewal charge. Refund eligibility for completed payments, billing errors, duplicate or unauthorized charges, onboarding status, and service discontinuation is described in the <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>. Nothing in these Terms limits a refund, chargeback, warranty, or other remedy that cannot lawfully be excluded.
                </p>
            </PolicySection>

            <PolicySection id="liability" title="12. Warranties and Limitation of Liability">
                <p>
                    To the maximum extent permitted by law, the Service is provided &quot;as is&quot; and &quot;as available&quot;. We disclaim implied warranties that may lawfully be disclaimed and do not warrant that every estimate will be commercially suitable or that the Service will always be uninterrupted, error-free, or immune from security incidents.
                </p>
                <p>
                    To the maximum extent permitted by law, neither party is liable to the other for indirect, incidental, special, exemplary, punitive, or consequential loss, or for lost profits, revenue, goodwill, or business opportunity, arising from these Terms, even if advised that such loss was possible.
                </p>
                <p>
                    Except for liability that cannot lawfully be limited, each party&apos;s aggregate liability arising from the Service will not exceed the fees paid or payable for the selected plan during the 12 months immediately preceding the event giving rise to the claim. The limitations do not exclude liability for fraud, wilful misconduct, infringement or misappropriation of the other party&apos;s intellectual property, or Customer&apos;s payment obligations.
                </p>
            </PolicySection>

            <PolicySection id="indemnity" title="13. Customer Indemnity">
                <p>
                    Customer will defend and indemnify Weavly against a third-party claim, regulatory demand, or resulting reasonable cost to the extent caused by Customer&apos;s unlawful Customer Data, infringement of third-party rights, unauthorized disclosure, fraud, or material violation of the Acceptable Use section. Weavly must give prompt notice and reasonable cooperation, and Customer may not settle a claim in a way that admits fault or imposes an obligation on Weavly without written consent. This section does not require indemnification to the extent a claim was caused by Weavly.
                </p>
            </PolicySection>

            <PolicySection id="term-changes" title="14. Changes to These Terms">
                <p>
                    We may update these Terms when Free, Lite, Base, provider arrangements, or law changes. We will update the displayed version and date. A change will not retroactively increase the price already paid for a current period. We will give reasonable advance notice of a materially adverse change where practicable and request fresh acceptance where required by law or where the change materially expands Customer obligations. If you reject a materially adverse change, you may stop using the Service and decline the next manual renewal.
                </p>
            </PolicySection>

            <PolicySection id="disputes" title="15. Governing Law and Disputes">
                <p>These Terms are governed by Indian law. Before starting arbitration, either party must send written notice describing the dispute and requested resolution, and the parties will attempt good-faith resolution for 30 days.</p>
                <p>
                    An unresolved dispute arising out of or relating to these Terms will be finally resolved by a sole arbitrator mutually appointed by the parties under the Arbitration and Conciliation Act, 1996. If the parties do not agree on the arbitrator within the statutory period, either party may seek appointment through the court or institution authorized by that Act. The seat and legal place of arbitration is Surat, Gujarat, India; the language is English; and hearings may be conducted remotely where the arbitrator permits.
                </p>
                <p>
                    Courts having lawful jurisdiction at Surat, Gujarat may hear applications relating to the arbitration and matters that are not legally arbitrable. Nothing in this section prevents either party from seeking urgent interim relief or using a statutory forum or remedy that cannot lawfully be waived.
                </p>
            </PolicySection>

            <PolicySection id="general" title="16. General Terms">
                <ul>
                    <li><strong>Entire agreement</strong> — These Terms, the accepted order or checkout, Privacy Policy, and Refund Policy form the agreement for the selected plan and replace prior statements about the same subject.</li>
                    <li><strong>Order of precedence</strong> — A signed written order controls over conflicting general language in these Terms for that order; the Privacy Policy controls for privacy disclosures.</li>
                    <li><strong>Assignment</strong> — Customer may not transfer the account or agreement without written consent. We may transfer the agreement to a successor entity or incorporated Weavly business that assumes the obligations, with notice to Customer.</li>
                    <li><strong>Force majeure</strong> — Neither party is liable for delay caused by events beyond reasonable control, except that this does not excuse amounts already due.</li>
                    <li><strong>No waiver</strong> — Delay in enforcing a right is not a waiver.</li>
                    <li><strong>Severability</strong> — If part of these Terms is unenforceable, it will be limited to the minimum extent necessary and the remainder continues.</li>
                    <li><strong>Electronic communications</strong> — You consent to receive account, billing, security, and legal notices electronically at the registered email or within the Service.</li>
                </ul>
            </PolicySection>

            <PolicySection id="contact" title="17. Contract and Legal Contact">
                <PolicyContactPanel
                    title="Current Weavly Operator"
                    rows={[
                        { label: 'Operator', value: LEGAL_OPERATOR.displayName },
                        {
                            label: 'Email',
                            value: <a href={`mailto:${LEGAL_OPERATOR.contactEmail}`} className="text-orange-700 hover:underline dark:text-orange-300">{LEGAL_OPERATOR.contactEmail}</a>,
                        },
                        { label: 'Postal address', value: LEGAL_OPERATOR.postalAddress },
                    ]}
                    note="These details are the pre-incorporation contracting contact and will be updated when the operating company is incorporated."
                />
            </PolicySection>
        </PolicyPage>
    )
}
