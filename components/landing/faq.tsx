import type { ReactNode } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Beam, Eyebrow } from './beam'
import s from './landing.module.css'

const faqs = [
    {
        question: 'Which plan should I start with?',
        answer: 'Start with Free if you cost an enquiry now and then. Choose Lite when costing is a daily job and you want reusable qualities and the Yarn Rate Book. Choose Base when you also want production, stock, dispatch and piece-rate pay to run from the same costings.',
    },
    {
        question: 'How does the Free allowance work?',
        answer: 'Free gives two successful costings a month, with no subscription fee and no card. The allowance resets on the first day of every month at 12:00 am IST and does not roll over. A new calculation after changing inputs counts as a new costing. Viewing saved costings and exporting their Cost Sheets does not use the allowance.',
    },
    {
        question: 'Can I start on Free and upgrade later?',
        answer: 'Yes. Choose Lite or Base from your account when you need more. Your Free costing records stay in your account. Lite removes the monthly limit; Base also unlocks production and piece-rate settlement.',
    },
    {
        question: 'Are GST and renewals included in the prices?',
        answer: 'The paid prices shown include 18% GST. The first-year payment covers 365 days, and the lower renewal price applies from year two. Renewal is manual, with no automatic debit, and opens in the final 30 days of your paid period.',
    },
    {
        question: 'What happens if I do not renew?',
        answer: 'Nothing is charged. An expired Lite subscription restricts paid costing access unless another entitlement applies. When a paid Base period ends, the Lite costing desk stays available and Base production actions are restricted. Records are kept while the account is kept, and expiry does not move a paid account onto Free.',
    },
    {
        question: 'Does it work when the factory internet is poor?',
        answer: 'Weavly is an installable web app. Calculating, saving and exporting need an internet connection. On Lite and Base, unfinished estimator drafts are kept on your device while you are signed in; on Free, unfinished inputs are not kept as drafts.',
    },
    {
        question: 'Does Base include supervisor accounts or statutory payroll?',
        answer: 'No. Base is for owner-led production entry and piece-rate worker settlement. Separate supervisor accounts, attendance, statutory payroll and broader ERP modules are outside the current plans.',
    },
    {
        question: 'How is my data handled, and what about refunds?',
        answer: (
            <>
                Costing records are stored in your account, including completed Free costings, with account access controls and
                storage separated by business. You can ask for access, export or deletion through the{' '}
                <Link href="/privacy-request" className={s.textLink}>privacy request page</Link>. Paid refunds follow the Refund
                Policy; the seven-day review window for an initial payment depends on substantive delivery and use.
            </>
        ),
    },
] satisfies Array<{ question: string; answer: ReactNode }>

export default function LandingFAQ() {
    return (
        <Beam id="faq" tone="deep" labelledBy="faq-title" innerClassName="py-20 sm:py-24 lg:py-28">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
                <div className="lg:sticky lg:top-36 lg:self-start">
                    <Eyebrow>Questions</Eyebrow>
                    <h2 id="faq-title" className={cn(s.display, 'mt-5 text-[34px] font-semibold leading-[1.05] text-[color:var(--lp-ink)] sm:text-[46px]')}>
                        What owners ask before they switch.
                    </h2>
                    <p className="mt-5 max-w-[26rem] text-[15px] leading-[1.6] text-[color:var(--lp-body)]">
                        The full detail is in the <Link href="/terms" className={s.textLink}>Terms</Link>,{' '}
                        <Link href="/privacy" className={s.textLink}>Privacy Policy</Link> and{' '}
                        <Link href="/refund-policy" className={s.textLink}>Refund Policy</Link>.
                    </p>
                </div>

                <div className="border-t-2 border-[color:var(--lp-ink)]">
                    {faqs.map((faq) => (
                        <details key={faq.question} name="landing-faq" className={cn(s.faq, 'group border-b border-[color:var(--lp-line-strong)]')}>
                            <summary className="flex min-h-[56px] items-center justify-between gap-6 py-4 text-[16px] font-semibold leading-snug text-[color:var(--lp-ink)] sm:text-[17px]">
                                {faq.question}
                                <Plus className={cn(s.marker, 'h-5 w-5 flex-none text-[color:var(--lp-muted)]')} aria-hidden="true" />
                            </summary>
                            <p className="max-w-[40rem] pb-6 pr-10 text-[15px] leading-[1.65] text-[color:var(--lp-body)]">{faq.answer}</p>
                        </details>
                    ))}
                </div>
            </div>
        </Beam>
    )
}
