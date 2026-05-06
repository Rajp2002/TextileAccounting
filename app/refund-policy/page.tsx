import type { Metadata } from 'next'
import { CalendarDays, Clock3, Mail, RefreshCw } from 'lucide-react'
import { PolicyContactPanel, PolicyPage, PolicySection } from '@/components/policies/legal-page'

export const metadata: Metadata = {
    title: 'Refund & Cancellation Policy — Weavly',
    description: 'Learn about Weavly\'s refund, cancellation, and data export policies for subscription plans.',
}

const sections = [
    { href: '#free-trial', title: 'Free Trial' },
    { href: '#cancellation', title: 'Cancellation' },
    { href: '#refunds', title: 'Refund Policy' },
    { href: '#downgrades', title: 'Plan Downgrades' },
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
            description="Clear rules for trials, cancellations, first-payment refunds, setup services, and data export after a subscription ends."
            lastUpdated="March 25, 2026"
            sections={sections}
            facts={[
                { label: 'Free trial', value: '7 days, no payment required', icon: CalendarDays },
                { label: 'First payment refund', value: 'Full refund within 7 days', icon: RefreshCw },
                { label: 'Refund timing', value: '5-7 business days to original method', icon: Clock3 },
                { label: 'Support', value: 'support@weavly.app', icon: Mail },
            ]}
        >
            <p className="mb-10 max-w-3xl text-lg font-medium leading-8 text-zinc-700 dark:text-zinc-300">
                This Refund &amp; Cancellation Policy applies to all paid subscriptions and services offered by Weavly. We aim to make our policies transparent and fair in compliance with the <strong>Consumer Protection Act, 2019</strong> and the <strong>Consumer Protection (E-Commerce) Rules, 2020</strong>.
            </p>

            <PolicySection id="free-trial" title="1. Free Trial">
                <ul>
                    <li>The 7-day free trial provides full access to all features at no cost.</li>
                    <li>No credit card or payment information is required to start a trial.</li>
                    <li>The trial does <strong>not</strong> automatically convert to a paid subscription. You must explicitly choose a plan and complete payment to continue using the Service after the trial period.</li>
                    <li>No refund applies to the free trial as no charges are made.</li>
                </ul>
            </PolicySection>

            <PolicySection id="cancellation" title="2. Subscription Cancellation">
                <h3>2.1 How to Cancel</h3>
                <p>
                    You may cancel your subscription at any time through:
                </p>
                <ul>
                    <li>The account settings page within the Weavly dashboard, or</li>
                    <li>By emailing <a href="mailto:support@weavly.app">support@weavly.app</a> with your registered email address</li>
                </ul>
                <p>
                    Cancellation is designed to be at least as easy as the subscription process, in compliance with Consumer Protection rules.
                </p>

                <h3>2.2 What Happens After Cancellation</h3>
                <ul>
                    <li>Your access to paid features will continue until the end of the current billing period.</li>
                    <li>No further charges will be made after cancellation.</li>
                    <li>Your data will remain accessible for <strong>30 days</strong> after the billing period ends, during which you may export your data.</li>
                    <li>After the 30-day export window, your production logs, payroll records, and operational data will be permanently deleted.</li>
                    <li>Account information (name, email) is retained for 180 days per regulatory requirements, then deleted.</li>
                </ul>
            </PolicySection>

            <PolicySection id="refunds" title="3. Refund Policy">
                <h3>3.1 Monthly Subscriptions (Base &amp; Premium)</h3>
                <ul>
                    <li><strong>Within 7 days of first payment</strong> — Full refund, no questions asked. If you&apos;re not satisfied after upgrading from the free trial, we&apos;ll refund you completely.</li>
                    <li><strong>After 7 days</strong> — No pro-rata refund for the remaining days of the current billing period. You will continue to have access until the period ends.</li>
                    <li><strong>Service outage</strong> — If the platform is unavailable for more than 48 consecutive hours (excluding scheduled maintenance), you are entitled to a pro-rata credit for the downtime period.</li>
                </ul>

                <h3>3.2 Setup &amp; Training Add-on (₹4,999 + GST)</h3>
                <ul>
                    <li><strong>Before the training session</strong> — Full refund if the training session has not yet been conducted.</li>
                    <li><strong>After the training session</strong> — No refund, as the service has been delivered.</li>
                    <li><strong>Partial delivery</strong> — If only the account configuration was completed but the training session was not conducted, a partial refund of ₹2,500 will be issued.</li>
                </ul>

                <h3>3.3 How Refunds Are Processed</h3>
                <ul>
                    <li>Refunds are processed to the original payment method within <strong>5-7 business days</strong>.</li>
                    <li>GST paid on refunded amounts will also be refunded.</li>
                    <li>To request a refund, email <a href="mailto:support@weavly.app">support@weavly.app</a> with your account details and reason for the request.</li>
                </ul>
            </PolicySection>

            <PolicySection id="downgrades" title="4. Plan Downgrades">
                <p>
                    If you downgrade from Premium to Base, the change takes effect at the start of the next billing cycle. You will continue to have Premium access until the current period ends. If your worker count exceeds the Base plan limit (15 workers), you will need to deactivate excess workers before the downgrade takes effect.
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
