import { cn } from '@/lib/utils'
import { Beam, Eyebrow } from './beam'
import s from './landing.module.css'

const leaks = [
    {
        title: 'Last month’s yarn rate',
        copy: 'It still looks right, and gives the difference away on every metre.',
    },
    {
        title: 'A guessed loom charge',
        copy: 'At 64 picks, one paisa more per pick is 64 paise a metre.',
    },
    {
        title: 'A forgotten commission',
        copy: 'It is a share of the selling price. Miss it and break-even is wrong.',
    },
]

/** The page's argument, made as arithmetic rather than a claim. */
export default function LandingPaise() {
    return (
        <Beam tone="loom" labelledBy="paise-title" innerClassName="py-20 sm:py-24 lg:py-28">
            <Eyebrow tone="loom">Why a costing has to be exact</Eyebrow>
            <h2 id="paise-title" className={cn(s.display, 'mt-6 max-w-[44rem] text-[32px] font-semibold leading-[1.08] text-[color:var(--lp-on-loom)] sm:text-[44px]')}>
                In grey fabric, the margin is counted in paise.
            </h2>

            <div className={cn(s.rise, 'mt-12 sm:mt-16')}>
                <p className={cn(s.figure, 'flex flex-wrap items-baseline gap-x-[0.3em] text-[36px] font-medium leading-[1.1] text-[color:var(--lp-on-loom)] xs:text-[42px] sm:text-[64px] lg:text-[84px]')}>
                    <span className="whitespace-nowrap">10 paise</span>
                    <span className="text-[color:var(--lp-on-loom-muted)]" aria-hidden="true">×</span>
                    <span className="sr-only"> times </span>
                    <span className="whitespace-nowrap">1,00,000 m</span>
                </p>
                {/* One saffron pick, running across the whole cloth. */}
                <div className={cn(s.thread, 'relative left-1/2 my-6 w-screen -translate-x-1/2 sm:my-8')} aria-hidden="true" />
                <p className={cn(s.figure, 'text-[36px] font-medium leading-[1.1] text-[color:var(--lp-saffron)] xs:text-[42px] sm:text-[64px] lg:text-[84px]')}>
                    <span aria-hidden="true">= </span>
                    <span className="sr-only">equals </span>
                    ₹10,000
                </p>
                <p className="mt-6 text-[16px] leading-[1.6] text-[color:var(--lp-on-loom-muted)] sm:text-[17px]">
                    Too small to notice on a metre. Too big to ignore on an order.
                </p>
            </div>

            <div className="mt-14 grid gap-8 border-t border-[color:var(--lp-loom-line)] pt-8 md:grid-cols-3 md:gap-10">
                {leaks.map((leak) => (
                    <div key={leak.title} className="min-w-0">
                        <p className="text-[16px] font-semibold text-[color:var(--lp-on-loom)]">{leak.title}</p>
                        <p className="mt-2 text-[15px] leading-[1.6] text-[color:var(--lp-on-loom-muted)]">{leak.copy}</p>
                    </div>
                ))}
            </div>
        </Beam>
    )
}
