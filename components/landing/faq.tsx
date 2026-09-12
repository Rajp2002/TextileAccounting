import Link from 'next/link'

const faqs = [
    {
        question: 'Which plan should I choose?',
        answer: 'Choose Weavly Free for occasional fabric costings, Weavly Lite for unlimited costings, reusable qualities, and Rate Book, or Weavly Base for everything in Lite plus owner-led production, machines, piece-rate worker earnings, advances, and settlements.',
    },
    {
        question: 'What can I do on Free?',
        answer: 'Create two costings per month with no subscription fee or card required. Successful calculations are saved automatically so you can return to their breakdowns and export Cost Sheets. Reusable saved qualities, Rate Book, production, and worker settlement are available on the paid plans described above.',
    },
    {
        question: 'How does the Free monthly allowance work?',
        answer: 'The allowance resets on the first day of every month at 12:00 am IST, with no rollover. Each successful new calculation uses one costing, including a new calculation after changing inputs. Viewing saved costings and exporting their Cost Sheets use no allowance. When you reach the limit, you can wait for the reset or choose Lite or Base.',
    },
    {
        question: 'Are GST and renewals included in the prices?',
        answer: 'The paid prices shown include 18% GST. The first-year payment covers 365 days; the lower renewal price applies from year two. Renewals are manual, with no automatic debit. Same-plan renewal opens in the final 30 days of your paid period. Free has no subscription payment or annual renewal.',
    },
    {
        question: 'Can I start on Free and upgrade later?',
        answer: 'Yes. Compare plans from your account and choose Lite or Base when you need more. Your existing Free costing records remain in your account. Lite removes the monthly limit; Base also unlocks the production and piece-rate settlement workflow.',
    },
    {
        question: 'What happens if the factory internet is unreliable?',
        answer: 'Weavly is an installable PWA. Free needs an internet connection to calculate and save a costing; unfinished Free inputs are not saved as recoverable drafts. Lite and Base can keep local estimator drafts while you are signed in. Saving a costing and exporting a Cost Sheet requires an internet connection.',
    },
    {
        question: 'Does Base include a separate supervisor app or statutory payroll?',
        answer: 'Base is for owner-led production entry and piece-rate worker settlement. Separate supervisor accounts, attendance, statutory payroll, and broader ERP modules are outside the current plan. The production and worker-pay features listed above are included.',
    },
    {
        question: 'What happens if I do not renew a paid plan?',
        answer: 'There is no automatic charge. An expired Lite subscription restricts paid costing access unless another entitlement applies. After a paid Base period ends, the current access policy retains the Lite costing desk and restricts Base production actions. Records are retained while the account is retained; expiry does not automatically move a paid account onto Free.',
    },
    {
        question: 'How do you handle my data and refund requests?',
        answer: 'Costing records are stored in your account, including completed Free costings. We use account access controls and tenant-scoped storage, and provide privacy request, export, and deletion options. Paid refunds follow the Refund Policy; the seven-day initial-payment review window depends on substantive delivery and use.',
    },
]

export default function LandingFAQ() {
    return (
        <section className="landing-section py-20 sm:py-28 lg:py-12 relative overflow-hidden" id="faq">
            <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
                <div className="mx-auto max-w-3xl text-center">
                    <p className="text-xs font-black leading-7 text-orange-700 dark:text-orange-500 tracking-[0.28em] uppercase">FAQ</p>
                    <h2 className="mt-2 text-4xl font-black tracking-tight text-zinc-950 sm:text-5xl dark:text-white">
                        Questions a factory owner should ask before switching.
                    </h2>
                    <p className="mt-6 text-lg leading-8 text-[var(--color-body)]">
                        Practical answers about adoption, floor usage, data, and what Weavly replaces.
                    </p>
                </div>

                <div className="mx-auto mt-12 max-w-5xl border-y border-zinc-200 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-zinc-950/60">
                    {faqs.map((faq, index) => (
                        <div key={faq.question} className="grid gap-3 border-b border-zinc-200 px-4 py-6 last:border-b-0 dark:border-white/10 md:grid-cols-[4rem_0.8fr_1.2fr] md:gap-6 md:px-6">
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-600">0{index + 1}</p>
                            <h3 className="text-lg font-black leading-7 text-zinc-950 dark:text-white">{faq.question}</h3>
                            <p className="text-sm leading-6 text-[var(--color-body)]">{faq.answer}</p>
                        </div>
                    ))}
                </div>
                <p className="mx-auto mt-6 max-w-5xl text-center text-sm leading-6 text-zinc-700">
                    Read the <Link href="/terms" className="font-semibold text-orange-700 underline underline-offset-4">Terms of Service</Link>, <Link href="/privacy" className="font-semibold text-orange-700 underline underline-offset-4">Privacy Policy</Link>, and <Link href="/refund-policy" className="font-semibold text-orange-700 underline underline-offset-4">Refund Policy</Link> for the full details.
                </p>
            </div>
        </section>
    )
}
