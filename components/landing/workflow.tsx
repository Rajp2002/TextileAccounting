import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Beam, Eyebrow } from './beam'
import s from './landing.module.css'
import { costSample } from './sample-costing'
import { formatRupees, SAMPLE_START } from './sample-format'
import { BASE_PLAN_OPEN_TO_NEW_ACCOUNTS } from '@/lib/base-plan-visibility'

const example = costSample(SAMPLE_START)

type Plan = 'Free' | 'Lite' | 'Base'

/** Plans this page offers: Base is left out while its launch switch is closed. */
const offeredPlans = (plans: Plan[]): Plan[] => plans.filter((plan) => plan !== 'Base' || BASE_PLAN_OPEN_TO_NEW_ACCOUNTS)

function Plans({ plans }: { plans: Plan[] }) {
    // Every plan on offer is still "Every plan"; otherwise name only the offered plans.
    const offered = offeredPlans(plans)
    const text = plans.length === 3 ? 'Every plan' : offered.join(' and ')
    return <p className={cn(s.label, 'text-[color:var(--lp-saffron-ink)]')}>{text}</p>
}

/** Small, flat renderings of real screens' content. Example data only. */
function Fragment({ children, caption }: { children: ReactNode; caption: string }) {
    return (
        <figure className="min-w-0">
            <div className={cn(s.sheet, 'rounded-[10px] px-4 py-3.5 text-[13px] text-[color:var(--lp-ink)]')}>{children}</div>
            <figcaption className="sr-only">{caption}</figcaption>
        </figure>
    )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-3 py-1">
            <span className="text-[color:var(--lp-muted)]">{label}</span>
            <span className={cn(s.figure, strong ? 'font-semibold text-[color:var(--lp-ink)]' : 'text-[color:var(--lp-ink)]')}>{value}</span>
        </div>
    )
}

const steps: Array<{ title: string; plans: Plan[]; copy: string; fragment: ReactNode }> = [
    {
        title: 'Cost the enquiry',
        plans: ['Free', 'Lite', 'Base'],
        copy: 'A party asks for a rate. Get cost, break-even and price per metre, and keep the costing for when they call back.',
        fragment: (
            <Fragment caption="Example costing result">
                <Row label="Production cost / m" value={formatRupees(example.productionCostPerM)} strong />
                <Row label="Break-even price / m" value={formatRupees(example.breakEvenPricePerM)} />
                <Row label="Suggested price / m" value={formatRupees(example.suggestedPricePerM)} />
            </Fragment>
        ),
    },
    {
        title: 'Send the number, not the working',
        plans: ['Free', 'Lite', 'Base'],
        copy: 'An internal Cost Sheet for your desk, or a customer quotation without your costs.',
        fragment: (
            <Fragment caption="The two Cost Sheet export modes">
                <div className="grid grid-cols-2 gap-2">
                    {['Internal Cost Sheet', 'Customer Quotation'].map((doc, index) => (
                        <div key={doc} className={cn('rounded-[6px] border px-2.5 py-2', index === 0 ? 'border-[color:var(--lp-ink)]' : 'border-[color:var(--lp-line-strong)]')}>
                            <p className={cn(s.label, 'text-[color:var(--lp-muted)]')}>PDF · A4</p>
                            <p className="mt-1 font-semibold leading-tight">{doc}</p>
                            <p className="mt-1 text-[12px] leading-snug text-[color:var(--lp-muted)]">{index === 0 ? 'Costs, margin, assumptions' : 'Price, quantity, terms'}</p>
                        </div>
                    ))}
                </div>
            </Fragment>
        ),
    },
    {
        title: 'Keep the quality, update the rate once',
        plans: ['Lite', 'Base'],
        copy: 'Change a yarn rate once in the Rate Book; saved qualities use it next time, and past costings stay as they were.',
        fragment: (
            <Fragment caption="Example Yarn Rate Book update">
                <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">100D polyester</span>
                    <span className={s.figure}>
                        <span className="text-[color:var(--lp-muted)] line-through">₹112</span> ₹122/kg
                    </span>
                </div>
                <p className="mt-2 border-t border-[color:var(--lp-line)] pt-2 text-[12px] leading-snug text-[color:var(--lp-muted)]">
                    Used by 3 saved qualities. Saved costings keep their original rate.
                </p>
            </Fragment>
        ),
    },
    {
        title: 'Put it on the looms',
        plans: ['Base'],
        copy: 'Activate a costing, assign machines and record day and night metres. Stock follows production; dispatch goes out on challans.',
        fragment: (
            <Fragment caption="Example daily production entries">
                <div className={cn(s.label, 'grid grid-cols-[1fr_auto_auto] gap-x-4 pb-1 text-[color:var(--lp-muted)]')}>
                    <span>Machine</span><span className="text-right">Day</span><span className="text-right">Night</span>
                </div>
                {[['Loom 07', '142 m', '138 m'], ['Loom 08', '136 m', '140 m']].map(([loom, day, night]) => (
                    <div key={loom} className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-t border-[color:var(--lp-line)] py-1.5">
                        <span>{loom}</span>
                        <span className={cn(s.figure, 'text-right')}>{day}</span>
                        <span className={cn(s.figure, 'text-right')}>{night}</span>
                    </div>
                ))}
            </Fragment>
        ),
    },
    {
        title: 'Pay by the metre',
        plans: ['Base'],
        copy: 'Piece-rate pay from recorded metres, less advances. Settle by cash, bank transfer, UPI or cheque.',
        fragment: (
            <Fragment caption="Example piece-rate settlement">
                <Row label="3,420 m × ₹1.10" value="₹3,762.00" />
                <Row label="Advance recovered" value="− ₹1,000.00" />
                <div className="mt-1 border-t border-[color:var(--lp-ink)] pt-1">
                    <Row label="Net pay" value="₹2,762.00" strong />
                </div>
            </Fragment>
        ),
    },
]

export default function LandingWorkflow() {
    return (
        <Beam id="workflow" labelledBy="workflow-title" innerClassName="py-20 sm:py-24 lg:py-28">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
                <div>
                    <Eyebrow>From enquiry to pay slip</Eyebrow>
                    <h2 id="workflow-title" className={cn(s.display, 'mt-5 text-[34px] font-semibold leading-[1.05] text-[color:var(--lp-ink)] sm:text-[46px]')}>
                        One costing, carried all the way through.
                    </h2>
                </div>
                <p className="max-w-[26rem] text-[17px] leading-[1.6] text-[color:var(--lp-body)]">
                    Start with the number. Grow into the rest. Each step names the plan it needs.
                </p>
            </div>

            <ol className="mt-14 list-none border-t border-[color:var(--lp-ink)]">
                {steps.filter((step) => offeredPlans(step.plans).length > 0).map((step, index) => (
                    <li
                        key={step.title}
                        className={cn(s.rise, 'grid gap-5 border-b border-[color:var(--lp-line)] py-8 md:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,19rem)] md:gap-8 lg:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,22rem)] lg:gap-12')}
                    >
                        <span className={cn(s.figure, 'pt-[3px] text-[15px] text-[color:var(--lp-muted)]')} aria-hidden="true">
                            {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                            <Plans plans={step.plans} />
                            <h3 className={cn(s.display, 'mt-2 text-[22px] font-semibold leading-tight text-[color:var(--lp-ink)] sm:text-[26px]')}>{step.title}</h3>
                            <p className="mt-3 max-w-[30rem] text-[15px] leading-[1.6] text-[color:var(--lp-body)]">{step.copy}</p>
                        </div>
                        {step.fragment}
                    </li>
                ))}
            </ol>
            <p className="mt-5 text-[13px] leading-5 text-[color:var(--lp-muted)]">Figures in these panels are examples, not customer data.</p>
        </Beam>
    )
}
