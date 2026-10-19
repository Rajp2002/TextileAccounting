import type { Metadata } from 'next'
import { CalendarDays, Clock3, Mail, RefreshCw } from 'lucide-react'
import { PolicyCallout, PolicyContactPanel, PolicyPage, PolicySection } from '@/components/policies/legal-page'
import { LEGAL_OPERATOR } from '@/lib/legal-operator'
import { LEGAL_DOCUMENTS } from '@/lib/legal-documents'
import { ACCESS_DAYS, BILLING_PLANS, BILLING_SELF_SERVE_PLAN_TIERS } from '@/lib/billing-constants'
import { formatINR } from '@/lib/finance'

export const metadata: Metadata = {
    title: 'Refund & Cancellation Policy — Weavly',
    description: 'Refund and cancellation rules for Weavly Free and Lite, the three-month Lite free trial, paid upgrades, manual renewal, and billing errors.',
}

const sections = [
    { href: '#scope', title: 'Scope' },
    { href: '#lite-trial', title: 'Lite Free Trial' },
    { href: '#non-renewal', title: 'Non-Renewal & Deletion' },
    { href: '#initial-payment', title: 'Initial Payment Refunds' },
    { href: '#renewal-payment', title: 'Renewal Refunds' },
    { href: '#processing', title: 'Refund Processing' },
    { href: '#data-export', title: 'Data Export' },
    { href: '#changes', title: 'Changes' },
    { href: '#contact', title: 'Contact' },
]

export default function RefundPolicyPage() {
    return (
        <PolicyPage
            activePath="/refund-policy"
            title="Refund & Cancellation Policy"
            description="How refunds, the three-month Lite free trial, paid upgrades, manual renewal, and account deletion work across Free, Lite, and Base."
            lastUpdated={LEGAL_DOCUMENTS.terms.displayDate}
            sections={sections}
            facts={[
                { label: 'Billing model', value: 'Manual annual renewal; no automatic charge', icon: CalendarDays },
                { label: 'Before substantive delivery', value: 'Seven-day initial-payment review window', icon: RefreshCw },
                { label: 'Provider processing', value: 'Usually initiated within 5–7 business days', icon: Clock3 },
                { label: 'Contact', value: LEGAL_OPERATOR.contactEmail, icon: Mail },
            ]}
        >
            <p className="mb-10 max-w-3xl text-lg font-medium leading-8 text-body">
                This policy covers Weavly Free accounts, the three-month Weavly Lite free trial, and Weavly Lite and Weavly Base purchases offered by {LEGAL_OPERATOR.displayName}. It should be read with the <a href="/terms">Terms of Service</a>. Free has no subscription payment to cancel or refund. If you purchase Lite or Base from Free, the paid-plan rules below apply to that purchase.
            </p>

            <PolicySection id="scope" title="1. Scope and Plan Boundary">
                <p>
                    Weavly Free includes two costings per month, saved completed costings, and Cost Sheet exports at no subscription fee. Weavly Lite covers the complete textile costing-management product with unlimited costings: estimator calculations, saved costings, qualities, Rate Book, costing history, and hosted account data. Weavly Base includes all Lite functionality and adds the current Base Production Core, including production records linked to costing/quality data where supported. Other operational modules outside the current catalog are not included in these plans, and their absence is not grounds for a refund.
                </p>
                <p>Weavly Base is not offered to new customers during the initial rollout. Its rules below apply to organizations that already hold a Base subscription.</p>
                <PolicyCallout tone="blue" title="Current catalog">
                    <ul>
                        {BILLING_SELF_SERVE_PLAN_TIERS.map((tier) => (
                            <li key={tier}>
                                <strong>{BILLING_PLANS[tier].name}:</strong> {formatINR(BILLING_PLANS[tier].firstYearTotalPaise / 100, { hideDecimals: true })} for the first {ACCESS_DAYS}-day period; {formatINR(BILLING_PLANS[tier].renewalTotalPaise / 100, { hideDecimals: true })} for each later annual renewal.
                            </li>
                        ))}
                    </ul>
                    <p>Each displayed paid total includes the indicated 18% GST component. The final lawful price and tax treatment displayed at live checkout control. GST tax invoices are issued only after the required supplier registration and tax configuration are complete.</p>
                </PolicyCallout>
            </PolicySection>

            <PolicySection id="lite-trial" title="1.1 Lite Free Trial">
                <ul>
                    <li><strong>No payment</strong> — The three-month Lite free trial takes no payment and needs no card, so there is nothing to cancel or refund. It ends on its own when the three-month (90-day) trial period is over.</li>
                    <li><strong>After the trial</strong> — If Lite is not purchased, the organization moves to Free when the trial ends. Nothing is charged.</li>
                    <li><strong>Buying Lite during or after the trial</strong> — The purchase is an initial payment under Section 3. Use of Lite during the free trial does not by itself count as use of that paid purchase.</li>
                </ul>
            </PolicySection>

            <PolicySection id="non-renewal" title="2. Non-Renewal, Expiry, and Account Deletion">
                <ul>
                    <li><strong>No automatic renewal</strong> — Lite and Base use manual renewal. We do not automatically charge the next annual period.</li>
                    <li><strong>Choosing not to renew</strong> — No cancellation switch or cancellation request is required. Do not complete a renewal payment.</li>
                    <li><strong>Paid access</strong> — The selected plan remains available until the current paid period expires, unless access is suspended or terminated under the Terms.</li>
                    <li><strong>After expiry</strong> — On Lite expiry, paid costing access is restricted unless another entitlement applies. Under the current access policy, a completed paid Base period retains Lite costing access after Base expiry, while Base-only production actions are restricted until reactivation. Expiry does not automatically enroll a paid account in Free. Existing records are retained and the owner-only organization export remains available while the account is retained.</li>
                    <li><strong>Permanent deletion</strong> — The owner may delete the workspace through Settings. Deletion follows the Privacy Policy and is different from allowing paid access to expire.</li>
                </ul>
            </PolicySection>

            <PolicySection id="initial-payment" title="3. Initial Plan Payment Refunds">
                <p>We review initial-payment requests according to the following rules:</p>
                <ul>
                    <li><strong>Duplicate charge, verified unauthorized payment, or billing error</strong> — Eligible for correction or refund after verification.</li>
                    <li><strong>Request within seven days and before substantive delivery or use</strong> — Eligible for a full refund when no material onboarding assistance has been delivered and the purchased plan has not been substantively used to save, export, or rely on costing or production work. Use of Free before purchasing a paid plan does not by itself count as use of that paid purchase.</li>
                    <li><strong>Configuration started but not substantially delivered</strong> — We may offer a partial refund after explaining and deducting the reasonable value of completed work and non-recoverable provider costs, where legally permitted.</li>
                    <li><strong>After substantive delivery or use</strong> — The payment is ordinarily non-refundable after material onboarding, configuration, training, saved costing use, or export has occurred, except for verified billing errors, material service deficiency, misdescription, or another remedy required by law.</li>
                </ul>
                <p>Submitting a request does not itself terminate or delete the account. If a refund is approved for the entire initial payment, paid Lite or Base access may be withdrawn when the refund is processed.</p>
            </PolicySection>

            <PolicySection id="renewal-payment" title="4. Manual Renewal Payment Refunds">
                <ul>
                    <li><strong>Before payment</strong> — Simply do not purchase the renewal; no charge will occur.</li>
                    <li><strong>Paid before the next period starts</strong> — A renewal may be refunded if requested before the renewed period begins and the renewal has not been used or applied to extend access.</li>
                    <li><strong>After the renewed period starts</strong> — Renewal payments are ordinarily non-refundable and are not refunded pro rata, except for duplicate or unauthorized charges, billing error, material service deficiency, discontinuation by Weavly, or a remedy required by law.</li>
                    <li><strong>Referral renewal credits</strong> — Credits are service entitlements, not cash. They are not refundable or transferable and may be reversed for a refunded, duplicate, fraudulent, or chargeback referral transaction.</li>
                </ul>
            </PolicySection>

            <PolicySection id="processing" title="5. Request and Refund Processing">
                <ul>
                    <li>Send the request from the registered email to <a href={`mailto:${LEGAL_OPERATOR.contactEmail}`}>{LEGAL_OPERATOR.contactEmail}</a> with the organization name, payment reference, payment date, amount, and reason.</li>
                    <li>Do not email complete card, bank-account, UPI PIN, password, or other payment credentials.</li>
                    <li>We may request limited additional information needed to verify the account, transaction, or claimed error.</li>
                    <li>Approved refunds are submitted to the original payment method, where supported. We generally initiate an approved refund within 5–7 business days; the payment provider or bank may take additional time to display it.</li>
                    <li>The refunded tax component, credit note, or invoice adjustment will be handled as required by the supplier&apos;s applicable tax status and law.</li>
                </ul>
            </PolicySection>

            <PolicySection id="data-export" title="6. Data Export">
                <p>
                    The owner-only structured organization export remains available while the account is retained, including after paid Base access expires. Production records are not deleted merely because a Base subscription expires or becomes Lite; Base-only actions are restricted until renewal. Download important records before requesting permanent account deletion. Deletion is designed to remove the active workspace and cannot be undone through the product.
                </p>
            </PolicySection>

            <PolicySection id="changes" title="7. Changes to This Policy">
                <p>
                    We may update this policy for future purchases or renewals by changing the displayed date and providing reasonable notice of materially adverse changes. A later policy will not retroactively remove a refund already required for a completed transaction under the policy and law applicable to that transaction.
                </p>
            </PolicySection>

            <PolicySection id="contact" title="8. Billing and Refund Contact">
                <PolicyContactPanel
                    title="Current Weavly Operator"
                    rows={[
                        { label: 'Operator', value: LEGAL_OPERATOR.displayName },
                        {
                            label: 'Email',
                            value: <a href={`mailto:${LEGAL_OPERATOR.contactEmail}`} className="text-saffron-deep hover:underline">{LEGAL_OPERATOR.contactEmail}</a>,
                        },
                        { label: 'Postal address', value: LEGAL_OPERATOR.postalAddress },
                    ]}
                    note="A custom-domain billing address may replace this interim email after incorporation; the policy will be updated when that happens."
                />
            </PolicySection>
        </PolicyPage>
    )
}
