import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Beam, Eyebrow } from './beam'
import s from './landing.module.css'

export default function LandingClosing() {
    return (
        <Beam tone="loom" labelledBy="closing-title" innerClassName="pb-20 pt-20 sm:pb-24 sm:pt-24 lg:pb-28 lg:pt-28">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-end lg:gap-16">
                <div>
                    <Eyebrow tone="loom">Start with the next enquiry</Eyebrow>
                    <h2 id="closing-title" className={cn(s.display, 'mt-6 text-[36px] font-semibold leading-[1.04] text-[color:var(--lp-on-loom)] sm:text-[52px] lg:text-[60px]')}>
                        Cost it before you quote it.
                    </h2>
                    <p className="mt-6 max-w-[34rem] text-[17px] leading-[1.6] text-[color:var(--lp-on-loom-muted)]">
                        Two free costings a month, the full breakdown and a Cost Sheet to send. No card. New accounts can also try Lite free for the first three months.
                    </p>
                </div>
                <div className="flex flex-col gap-3 xs:flex-row lg:flex-col lg:items-stretch">
                    <Link href="/signup?plan=free" className={cn(s.primary, s.primaryOnLoom)}>
                        Start free
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <Link href="/login" className={cn(s.secondary, s.secondaryOnLoom)}>
                        Log in to your workspace
                    </Link>
                    <Link href="/install" className="inline-flex min-h-[44px] items-center justify-center text-[14px] font-semibold text-[color:var(--lp-on-loom)] underline decoration-[color:var(--lp-on-loom-muted)] underline-offset-4 hover:decoration-[color:var(--lp-saffron)]">
                        How to install Weavly on your phone
                    </Link>
                </div>
            </div>
        </Beam>
    )
}
