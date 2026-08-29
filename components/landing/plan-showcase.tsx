import Link from 'next/link'
import {
    ArrowRight,
    Calculator,
    Check,
    ClipboardCheck,
    Factory,
    FileDown,
    IndianRupee,
    Layers3,
    RefreshCw,
    Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const planPaths = [
    {
        name: 'Weavly Lite',
        eyebrow: 'The costing desk',
        summary: 'For manufacturers who want every costing assumption, margin decision, and reusable quality in one dependable workspace.',
        outcome: 'Quote with a number you can explain.',
        href: '#plan-lite',
        icon: Calculator,
    },
    {
        name: 'Weavly Base',
        eyebrow: 'Costing into production',
        summary: 'For factories ready to carry an approved costing into jobs, daily metres, piece-rate pay, advances, and settlement.',
        outcome: 'Keep the job and its economics connected.',
        href: '#plan-base',
        icon: Factory,
    },
] as const

const liteCapabilities = [
    { title: 'Build the true cost', copy: 'Bring warp, weft, crimp, waste, factory costs, GST, transport, commission, and margin into one guided estimate.', icon: Calculator },
    { title: 'Reuse factory knowledge', copy: 'Save qualities and costing records so repeat enquiries begin from a trusted baseline instead of a blank sheet.', icon: RefreshCw },
    { title: 'Share the decision', copy: 'Export a clean Cost Sheet with the assumptions and commercial outcome ready for the next conversation.', icon: FileDown },
] as const

const baseCapabilities = [
    { title: 'Start from the costing', copy: 'Turn the pricing decision into a production job without re-entering the quality, target metres, or commercial reference.', icon: ClipboardCheck },
    { title: 'See daily progress', copy: 'Record machine output and compare planned, produced, and remaining metres in a focused production view.', icon: Layers3 },
    { title: 'Understand worker pay', copy: 'Use piece-rate metres, rate snapshots, advances, capped recovery, and net payout to prepare a clear settlement.', icon: Users },
] as const

function PlanCapabilityGrid({ items }: { items: typeof liteCapabilities | typeof baseCapabilities }) {
    return (
        <div className="grid gap-px overflow-hidden border border-zinc-200 bg-zinc-200 md:grid-cols-3">
            {items.map((item) => (
                <div key={item.title} className="bg-white p-5 sm:p-6">
                    <item.icon className="h-6 w-6 text-orange-600" aria-hidden="true" />
                    <h3 className="mt-5 text-lg font-black text-zinc-950">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-zinc-700">{item.copy}</p>
                </div>
            ))}
        </div>
    )
}

export default function LandingPlanShowcase() {
    return (
        <>
            <section className="landing-section relative isolate overflow-hidden border-y border-orange-200 bg-[#fff8ea] py-20 sm:py-28 lg:py-12" id="plans">
                <div className="absolute -right-32 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-orange-300/20 blur-3xl" aria-hidden="true" />
                <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-10 px-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:px-8">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.32em] text-orange-700">Two ways to begin</p>
                        <h2 className="mt-4 text-4xl font-black tracking-tight text-zinc-950 sm:text-6xl">
                            Choose how far the costing should travel.
                        </h2>
                        <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-700">
                            Both plans begin with the same complete costing foundation. The difference is what happens after the price is approved.
                        </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        {planPaths.map((plan, index) => (
                            <Link
                                key={plan.name}
                                href={plan.href}
                                className={`group flex min-h-80 flex-col border p-6 transition-all hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(154,52,18,0.14)] sm:p-8 ${index === 0 ? 'border-zinc-200 bg-white' : 'border-orange-300 bg-orange-100/70'}`}
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <span className="flex h-12 w-12 items-center justify-center bg-zinc-950 text-white">
                                        <plan.icon className="h-6 w-6" aria-hidden="true" />
                                    </span>
                                    <span className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">0{index + 1}</span>
                                </div>
                                <p className="mt-8 text-xs font-black uppercase tracking-[0.2em] text-orange-700">{plan.eyebrow}</p>
                                <h3 className="mt-2 text-3xl font-black text-zinc-950">{plan.name}</h3>
                                <p className="mt-4 text-sm leading-6 text-zinc-700">{plan.summary}</p>
                                <div className="mt-auto flex items-end justify-between gap-5 border-t border-zinc-950/10 pt-6">
                                    <p className="max-w-[15rem] text-sm font-black leading-6 text-zinc-950">{plan.outcome}</p>
                                    <ArrowRight className="h-5 w-5 flex-none text-orange-600 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <section className="landing-section relative isolate overflow-hidden py-20 sm:py-28 lg:py-12" id="plan-lite">
                <div className="relative z-10 mx-auto w-full max-w-7xl px-6 lg:px-8">
                    <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
                        <div>
                            <div className="flex items-center gap-3">
                                <span className="bg-zinc-950 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-white">Weavly Lite</span>
                                <span className="text-xs font-black uppercase tracking-[0.2em] text-orange-700">Complete costing</span>
                            </div>
                            <h2 className="mt-5 text-4xl font-black tracking-tight text-zinc-950 sm:text-6xl">
                                Your costing desk, without the spreadsheet drift.
                            </h2>
                        </div>
                        <div className="lg:pb-1">
                            <p className="text-lg leading-8 text-zinc-700">
                                Lite is not a trial version of Base. It is the complete costing-management product for a factory that wants stronger price decisions without adding production administration.
                            </p>
                            <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold text-zinc-950">
                                {['Best for costing teams', 'No production setup needed', 'Upgrade path stays open'].map((item) => (
                                    <span key={item} className="inline-flex items-center gap-2 border border-orange-200 bg-orange-50 px-3 py-2">
                                        <Check className="h-4 w-4 text-orange-600" aria-hidden="true" /> {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-10">
                        <PlanCapabilityGrid items={liteCapabilities} />
                    </div>

                    <div className="mt-5 flex flex-col gap-5 border border-zinc-200 bg-zinc-950 px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-4">
                            <IndianRupee className="mt-1 h-5 w-5 flex-none text-orange-400" aria-hidden="true" />
                            <div>
                                <p className="font-black text-white">The value: fewer rebuilt costings and clearer margin calls.</p>
                                <p className="mt-1 text-sm leading-6 text-zinc-300">Keep the record behind every quote, ready to reuse when yarn rates or customer terms change.</p>
                            </div>
                        </div>
                        <Button asChild className="shrink-0 rounded-md bg-orange-600 px-6 py-5 font-bold text-white hover:bg-orange-500">
                            <Link href="/signup?plan=lite">Choose Lite <ArrowRight className="ml-2 h-4 w-4" /></Link>
                        </Button>
                    </div>
                </div>
            </section>

            <section className="landing-section relative isolate overflow-hidden border-y border-orange-200 bg-orange-50/70 py-20 sm:py-28 lg:py-12" id="plan-base">
                <div className="relative z-10 mx-auto w-full max-w-7xl px-6 lg:px-8">
                    <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
                        <div>
                            <div className="flex items-center gap-3">
                                <span className="bg-orange-600 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-white">Weavly Base</span>
                                <span className="text-xs font-black uppercase tracking-[0.2em] text-orange-700">Costing + production</span>
                            </div>
                            <h2 className="mt-5 text-4xl font-black tracking-tight text-zinc-950 sm:text-6xl">
                                Carry the approved number onto the factory floor.
                            </h2>
                        </div>
                        <div className="lg:pb-1">
                            <p className="text-lg leading-8 text-zinc-700">
                                Base adds a deliberately focused operating loop around the Lite costing foundation—enough to follow a job, record output, and understand piece-rate settlement without adopting a full ERP.
                            </p>
                            <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold text-zinc-950">
                                {['Everything in Lite', 'Best for owner-led production', 'One connected job record'].map((item) => (
                                    <span key={item} className="inline-flex items-center gap-2 border border-orange-300 bg-white px-3 py-2">
                                        <Check className="h-4 w-4 text-orange-600" aria-hidden="true" /> {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-10">
                        <PlanCapabilityGrid items={baseCapabilities} />
                    </div>

                    <div className="mt-5 flex flex-col gap-5 border border-orange-300 bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-4">
                            <Factory className="mt-1 h-5 w-5 flex-none text-orange-600" aria-hidden="true" />
                            <div>
                                <p className="font-black text-zinc-950">The value: the costing remains the commercial reference after production starts.</p>
                                <p className="mt-1 text-sm leading-6 text-zinc-700">See target metres, daily progress, and worker payout in the same focused operating loop.</p>
                            </div>
                        </div>
                        <Button asChild className="shrink-0 rounded-md bg-zinc-950 px-6 py-5 font-bold text-white hover:bg-zinc-800">
                            <Link href="/signup?plan=base">Choose Base <ArrowRight className="ml-2 h-4 w-4" /></Link>
                        </Button>
                    </div>
                </div>
            </section>
        </>
    )
}
