import type { Metadata } from 'next'
import { CalendarDays, Clock3, Mail, RefreshCw } from 'lucide-react'
import { PolicyCallout, PolicyContactPanel, PolicyPage, PolicySection } from '@/components/policies/legal-page'
import { LEGAL_OPERATOR } from '@/lib/legal-operator'

export const metadata: Metadata = {
    title: 'Refund & Cancellation Policy — Weavly',
    description: 'Base Plan initial-rollout rules for manual renewal, refunds, billing errors, and data export.',
}

const sections = [
    { href: '#scope', title: 'Scope' },
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
            description="The payment, non-renewal, refund, and export rules for the Base Plan initial rollout."
            lastUpdated="August 24, 2026"
            sections={sections}
            facts={[
                { label: 'Billing model', value: 'Manual annual renewal; no automatic charge', icon: CalendarDays },
                { label: 'Before substantive delivery', value: 'Seven-day initial-payment review window', icon: RefreshCw },
                { label: 'Provider processing', value: 'Usually initiated within 5–7 business days', icon: Clock3 },
                { label: 'Contact', value: LEGAL_OPERATOR.contactEmail, icon: Mail },
            ]}
        >
            <p className="mb-10 max-w-3xl text-lg font-medium leading-8 text-zinc-700 dark:text-zinc-300">
                This policy applies only to the Weavly Estimator (Base Plan) initial rollout offered by {LEGAL_OPERATOR.displayName}. It should be read with the <a href="/terms">Terms of Service</a>. It does not apply to any future Full Suite offering.
            </p>

            <PolicySection id="scope" title="1. Scope and Base Plan Boundary">
                <p>
                    The current Base Plan purchase covers the single-factory costing workspace described in the Terms. Production, orders, worker or machine management, stock, dispatch, payroll, advances, analytics, WhatsApp operations, and other Full Suite modules are future scope. A Base payment does not purchase those modules, and their absence is not grounds for a refund.
                </p>
                <PolicyCallout tone="blue" title="Current catalog">
                    <p>
                        The current catalog displays ₹8,260 total for the first 365-day Base period and ₹2,360 total for a later 365-day renewal, including the indicated 18% GST component. The final lawful price and tax treatment displayed at live checkout control. GST tax invoices are issued only after the required supplier registration and tax configuration are complete.
                    </p>
                </PolicyCallout>
            </PolicySection>

            <PolicySection id="non-renewal" title="2. Non-Renewal, Expiry, and Account Deletion">
                <ul>
                    <li><strong>No automatic renewal</strong> — The Base Plan initial rollout uses manual renewal. We do not automatically charge the next annual period.</li>
                    <li><strong>Choosing not to renew</strong> — No cancellation switch or cancellation request is required. Do not complete a renewal payment.</li>
                    <li><strong>Paid access</strong> — Base features remain available until the current paid period expires, unless access is suspended or terminated under the Terms.</li>
                    <li><strong>After expiry</strong> — Paid Base features may be restricted, but the owner-only organization export remains available while the account is retained.</li>
                    <li><strong>Permanent deletion</strong> — The owner may delete the workspace through Settings. Deletion follows the Privacy Policy and is different from allowing paid access to expire.</li>
                </ul>
            </PolicySection>

            <PolicySection id="initial-payment" title="3. Initial Base Plan Payment Refunds">
                <p>We review initial-payment requests according to the following rules:</p>
                <ul>
                    <li><strong>Duplicate charge, verified unauthorized payment, or billing error</strong> — Eligible for correction or refund after verification.</li>
                    <li><strong>Request within seven days and before substantive delivery or use</strong> — Eligible for a full refund when no material onboarding assistance has been delivered and the workspace has not been substantively used to save, export, or rely on costing work.</li>
                    <li><strong>Configuration started but not substantially delivered</strong> — We may offer a partial refund after explaining and deducting the reasonable value of completed work and non-recoverable provider costs, where legally permitted.</li>
                    <li><strong>After substantive delivery or use</strong> — The payment is ordinarily non-refundable after material onboarding, configuration, training, saved costing use, or export has occurred, except for verified billing errors, material service deficiency, misdescription, or another remedy required by law.</li>
                </ul>
                <p>Submitting a request does not itself terminate or delete the account. If a refund is approved for the entire initial payment, paid Base access may be withdrawn when the refund is processed.</p>
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
                    The owner-only structured organization export remains available while the account is retained, including after paid Base access expires. Download important records before requesting permanent account deletion. Deletion is designed to remove the active workspace and cannot be undone through the product.
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
                            value: <a href={`mailto:${LEGAL_OPERATOR.contactEmail}`} className="text-orange-700 hover:underline dark:text-orange-300">{LEGAL_OPERATOR.contactEmail}</a>,
                        },
                        { label: 'Postal address', value: LEGAL_OPERATOR.postalAddress },
                    ]}
                    note="A custom-domain billing address may replace this interim email after incorporation; the policy will be updated when that happens."
                />
            </PolicySection>
        </PolicyPage>
    )
}
