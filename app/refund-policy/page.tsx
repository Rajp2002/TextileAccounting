import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import LandingFooter from "@/components/landing/footer"
export const metadata: Metadata = {
    title: 'Refund & Cancellation Policy — Weavly',
    description: 'Learn about Weavly\'s refund, cancellation, and data export policies for subscription plans.',
}

export default function RefundPolicyPage() {
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
                            Refund &amp; Cancellation Policy
                        </h1>
                        <p className="mt-4 text-sm font-medium text-amber-700 dark:text-amber-500 tracking-wide uppercase">
                            Last updated: March 25, 2026
                        </p>
                    </div>

                    {/* Prose Content */}
                    <article className="px-8 py-10 sm:px-12 sm:py-12 prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-amber-600 hover:prose-a:text-amber-700 prose-a:underline-offset-4 prose-a:decoration-amber-200 hover:prose-a:decoration-amber-600 transition-all font-medium">

                        <p className="lead text-lg text-gray-600 dark:text-gray-400 mb-8">
                        This Refund &amp; Cancellation Policy applies to all paid subscriptions and services offered by Weavly. We aim to make our policies transparent and fair in compliance with the <strong>Consumer Protection Act, 2019</strong> and the <strong>Consumer Protection (E-Commerce) Rules, 2020</strong>.
                    </p>

                    <h2>1. Free Trial</h2>
                    <ul>
                        <li>The 7-day free trial provides full access to all features at no cost.</li>
                        <li>No credit card or payment information is required to start a trial.</li>
                        <li>The trial does <strong>not</strong> automatically convert to a paid subscription. You must explicitly choose a plan and complete payment to continue using the Service after the trial period.</li>
                        <li>No refund applies to the free trial as no charges are made.</li>
                    </ul>

                    <h2>2. Subscription Cancellation</h2>

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

                    <h2>3. Refund Policy</h2>

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
                        <li>Refunds are processed to the original payment method within <strong>5–7 business days</strong>.</li>
                        <li>GST paid on refunded amounts will also be refunded.</li>
                        <li>To request a refund, email <a href="mailto:support@weavly.app">support@weavly.app</a> with your account details and reason for the request.</li>
                    </ul>

                    <h2>4. Plan Downgrades</h2>
                    <p>
                        If you downgrade from Premium to Base, the change takes effect at the start of the next billing cycle. You will continue to have Premium access until the current period ends. If your worker count exceeds the Base plan limit (15 workers), you will need to deactivate excess workers before the downgrade takes effect.
                    </p>

                    <h2>5. Data Export</h2>
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

                    <h2>6. Exceptional Circumstances</h2>
                    <p>
                        In cases of billing errors, unauthorized charges, or other exceptional circumstances, please contact us immediately at <a href="mailto:support@weavly.app">support@weavly.app</a>. We will investigate and resolve such issues promptly.
                    </p>

                    <h2>7. Changes to This Policy</h2>
                    <p>
                        We may update this policy from time to time. Material changes will be communicated via the platform or email at least 30 days before they take effect.
                    </p>

                    <h2>8. Contact</h2>
                    <div className="bg-gray-50 rounded-xl p-6 not-prose text-sm text-gray-700 space-y-1 my-4">
                        <p className="font-semibold text-gray-900">Weavly Support</p>
                        <p>Email: <a href="mailto:support@weavly.app" className="text-amber-700 hover:underline">support@weavly.app</a></p>
                        <p className="text-xs text-gray-500 mt-2">We aim to respond to all refund requests within 2 business days.</p>
                    </div>
                    </article>
                </div>
            </div>

            {/* Footer */}
            <LandingFooter />
        </main>
    )
}
