import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Beam, Eyebrow } from './beam'
import { CostSheetDemo } from './cost-sheet-demo'
import s from './landing.module.css'

export default function LandingHero() {
    return (
        <Beam
            labelledBy="hero-title"
            innerClassName="grid gap-10 pb-16 pt-[calc(118px+env(safe-area-inset-top,0px))] sm:pb-20 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center lg:gap-14 lg:pb-24 lg:pt-[9.5rem] xl:gap-20"
        >
            <div className="min-w-0 max-w-[36rem]">
                <Eyebrow>For grey-fabric weaving units</Eyebrow>
                <h1
                    id="hero-title"
                    className={cn(s.display, 'mt-6 text-[40px] font-semibold leading-[1.02] text-[color:var(--lp-ink)] xs:text-[44px] sm:text-[58px] lg:text-[64px] xl:text-[70px]')}
                >
                    Price every metre down to the paisa.
                </h1>
                <p className="mt-6 max-w-[30rem] text-[17px] leading-[1.6] text-[color:var(--lp-body)] sm:text-[18px]">
                    The costing desk for weaving units. Put in the construction and your rates; get the cost, break-even and price of
                    every metre.
                </p>
                <div className="mt-8 flex flex-col gap-3 xs:flex-row xs:flex-wrap xs:items-center">
                    <Link href="/signup?plan=free" className={s.primary}>
                        Start free
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <Link href="#pricing" className={s.secondary}>
                        Plans and pricing
                    </Link>
                </div>
                <p className="mt-5 text-[14px] leading-6 text-[color:var(--lp-muted)]">
                    Free: two costings a month, no card.{' '}
                    Lite: first three months free for new accounts.{' '}
                    <span className="whitespace-nowrap">
                        Already on Weavly? <Link href="/login" className={s.textLink}>Log in</Link>
                    </span>
                </p>
            </div>

            <div className="min-w-0">
                <CostSheetDemo />
            </div>
        </Beam>
    )
}
