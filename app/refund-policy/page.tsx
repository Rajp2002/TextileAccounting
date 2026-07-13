import type { Metadata } from 'next'
import { CalendarDays, Clock3, Mail, RefreshCw } from 'lucide-react'
import { PolicyContactPanel, PolicyPage, PolicySection } from '@/components/policies/legal-page'

export const metadata: Metadata = {
    title: 'Refund & Cancellation Policy — Weavly',
    description: 'Learn about Weavly\'s refund, cancellation, and data export policies for implementation services and annual maintenance.',
}

const sections = [
    { href: '#free-trial', title: 'Free Trial' },
    { href: '#cancellation', title: 'Cancellation' },
    { href: '#refunds', title: 'Refund Policy' },
    { href: '#renewals', title: 'Annual Renewals' },
    { href: '#data-export', title: 'Data Export' },
    { href: '#exceptions', title: 'Exceptional Circumstances' },
    { href: '#changes', title: 'Changes' },
    { href: '#contact', title: 'Contact' },
]

export default function RefundPolicyPage() {
    return (
        <PolicyPage
            activePath="/refund-policy"
            title="Refund & Cancellation Policy"
            description="Clear rules for trials, implementation work, annual maintenance, cancellations, refunds, and data export when service ends."
            lastUpdated="July 13, 2026"
            sections={sections}
            facts={[
                { label: 'Free trial', value: '7 days, no payment required', icon: CalendarDays },
                { label: 'Before work starts', value: 'Setup fee fully refundable', icon: RefreshCw },
                { label: 'Refund timing', value: '5-7 business days to original method', icon: Clock3 },
                { label: 'Support', value: 'support@weavly.app', icon: Mail },
            ]}
        >
            <p className="mb-10 max-w-3xl text-lg font-medium leading-8 text-zinc-700 dark:text-zinc-300">
                This Refund &amp; Cancellation Policy applies to Weavly&apos;s setup and implementation services and annual platform maintenance. It explains how refund eligibility changes as onboarding work is delivered and the platform enters active use.
            </p>

            <PolicySection id="free-trial" title="1. Free Trial">
                <ul>
                    <li>The 7-day free trial provides full access to all features at no cost.</li>
                    <li>No credit card or payment information is required to start a trial.</li>
                    <li>The trial does <strong>not</strong> automatically convert to a paid service. You must explicitly accept a commercial proposal and complete payment to continue after the trial.</li>
                    <li>No refund applies to the free trial as no charges are made.</li>
                </ul>
            </PolicySection>

            <PolicySection id="cancellation" title="2. Subscription Cancellation">
                <h3>2.1 How to Cancel</h3>
                <p>
                    You may cancel your next annual renewal at any time through:
                </p>
                <ul>
                    <li>The account settings page within the Weavly dashboard, or</li>
                    <li>By emailing <a href="mailto:support@weavly.app">support@weavly.app</a> with your registered email address</li>
                </ul>
                <p>
                    We will provide a clear and accessible cancellation process and confirm when your renewal has been cancelled.
                </p>

                <h3>2.2 What Happens After Cancellation</h3>
                <ul>
                    <li>Your access will continue until the end of the paid annual service period.</li>
                    <li>No further annual renewal charge will be made after cancellation is confirmed.</li>
                    <li>Your data will remain accessible for <strong>30 days</strong> after the paid service period ends, during which you may export your data.</li>
                    <li>After the 30-day export window, your production logs, payroll records, and operational data will be permanently deleted.</li>
                    <li>Account information (name, email) is retained for 180 days per regulatory requirements, then deleted.</li>
                </ul>
            </PolicySection>

            <PolicySection id="refunds" title="3. Refund Policy">
                <h3>3.1 Setup &amp; Implementation Fee (₹49,999 + GST)</h3>
                <ul>
                    <li><strong>Before onboarding work starts</strong> — The setup and implementation fee is fully refundable.</li>
                    <li><strong>After account configuration starts, but before substantive delivery</strong> — A partial refund may be issued after deducting the reasonable value of work already completed and any non-recoverable third-party costs disclosed to you.</li>
                    <li><strong>After training, data setup, workflow configuration, or production handover is delivered</strong> — The fee is non-refundable because the implementation service has been substantially delivered.</li>
                    <li>If Weavly cannot complete the agreed implementation, we will refund the undelivered portion after accounting for work you have accepted.</li>
                </ul>

                <h3>3.2 Annual Maintenance (₹19,999/year + GST)</h3>
                <ul>
                    <li><strong>First annual payment</strong> — Fully refundable when requested within 7 days of payment if onboarding has not started and the production workspace has not been activated.</li>
                    <li><strong>After onboarding or active use starts</strong> — No pro-rata refund applies to the remaining annual period, except for a verified billing error, a service Weavly cannot provide, or where a refund is required by law.</li>
                    <li><strong>Renewal payments</strong> — Refundable if charged after a cancellation confirmed before the renewal date or if charged in error.</li>
                    <li><strong>Service outage</strong> — For a material outage attributable to Weavly, we may provide a proportionate service credit or other remedy under the applicable order form.</li>
                </ul>

                <h3>3.3 How Refunds Are Processed</h3>
                <ul>
                    <li>Refunds are processed to the original payment method within <strong>5-7 business days</strong>.</li>
                    <li>Any tax adjustment or credit note will be handled as required by applicable GST rules.</li>
                    <li>To request a refund, email <a href="mailto:support@weavly.app">support@weavly.app</a> with your account details and reason for the request.</li>
                </ul>
            </PolicySection>

            <PolicySection id="renewals" title="4. Annual Renewal Cancellation">
                <p>
                    You may cancel annual renewal at any time before the next billing date. Cancellation prevents the next renewal charge and does not create a pro-rata refund for the current paid period. Access continues until that period ends unless the account is suspended or terminated under the Terms of Service.
                </p>
            </PolicySection>

            <PolicySection id="data-export" title="5. Data Export">
                <p>
                    Upon cancellation, you have a 30-day window to export your data. We provide data export functionality within the application. Exported data includes:
                </p>
                <ul>
                    <li>Production logs</li>
                    <li>Payroll settlement records</li>
                    <li>Worker and machine data</li>
                    <li>Attendance records</li>
                    <li>Advance/Upaad records</li>
                    <li>Order and inventory data</li>
                </ul>
            </PolicySection>

            <PolicySection id="exceptions" title="6. Exceptional Circumstances">
                <p>
                    In cases of billing errors, unauthorized charges, or other exceptional circumstances, please contact us immediately at <a href="mailto:support@weavly.app">support@weavly.app</a>. We will investigate and resolve such issues promptly.
                </p>
            </PolicySection>

            <PolicySection id="changes" title="7. Changes to This Policy">
                <p>
                    We may update this policy from time to time. Material changes will be communicated via the platform or email at least 30 days before they take effect.
                </p>
            </PolicySection>

            <PolicySection id="contact" title="8. Contact">
                <PolicyContactPanel
                    title="Weavly Support"
                    rows={[
                        {
                            label: 'Email',
                            value: <a href="mailto:support@weavly.app" className="text-orange-700 hover:underline dark:text-orange-300">support@weavly.app</a>,
                        },
                        { label: 'Response time', value: 'Within 2 business days' },
                    ]}
                    note="Please include your account details and the reason for the request so the billing team can trace the payment quickly."
                />
            </PolicySection>
        </PolicyPage>
    )
}
