import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, CheckCircle2, MessageCircle, ReceiptText } from 'lucide-react'

const loomRows = [
    { loom: 'Loom 04', fabric: 'Canvas Shine 100D', shift: 'Day', output: '186 m', status: 'On pace' },
    { loom: 'Loom 11', fabric: 'Order #214', shift: 'Night', output: '142 m', status: 'Needs worker' },
    { loom: 'Loom 18', fabric: 'Market run', shift: 'Day', output: '201 m', status: 'Payroll ready' },
]

const loopSteps = ['Estimate', 'Assign looms', 'Log shift', 'Settle']

const proofItems = ['7-day Premium trial', 'No credit card', 'Floor-ready PWA']

export default function LandingHero() {
    return (
        <section className="relative z-10 isolate overflow-hidden pt-[calc(5.5rem+env(safe-area-inset-top,0px))] snap-start scroll-mt-28 xs:pt-24">
            <div className="mx-auto max-w-7xl px-3 pb-14 pt-8 xs:px-6 xs:pb-16 xs:pt-14 sm:pb-24 lg:px-8 lg:pb-28 lg:pt-24">
                <div className="mx-auto max-w-6xl text-center">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-700 dark:text-orange-400 xs:text-xs xs:tracking-[0.32em]">
                        Built for grey fabric weaving factories
                    </p>

                    <h1 className="mx-auto mt-5 max-w-6xl text-4xl font-black leading-[1.02] tracking-normal text-zinc-950 xs:mt-7 xs:text-5xl sm:text-7xl lg:text-8xl dark:text-white">
                        One system for the whole factory floor. No notebook. No WhatsApp. No missed meters.
                    </h1>

                    <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-zinc-600 xs:mt-7 sm:text-lg sm:leading-8 dark:text-zinc-300">
                        Weavly connects fabric estimates, loom assignments, shift meter logs, dispatches, advances, and payroll so owners know what happened on the floor without chasing registers and WhatsApp messages.
                    </p>

                    <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <Link href="/signup" className="w-full sm:w-auto">
                            <Button
                                id="hero-owner-signup-btn"
                                size="lg"
                                className="w-full rounded-md bg-zinc-950 px-8 py-6 text-base font-bold text-white shadow-xl shadow-zinc-950/10 transition-all hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 sm:w-auto"
                            >
                                Request pilot access
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </Link>
                        <Link href="#workflow" className="w-full sm:w-auto">
                            <Button
                                id="hero-workflow-btn"
                                size="lg"
                                variant="outline"
                                className="w-full rounded-md border border-zinc-300 bg-white/80 px-8 py-6 text-base font-bold transition-all hover:border-orange-500 hover:text-orange-700 dark:border-zinc-600 dark:bg-zinc-950/50 dark:text-white dark:hover:border-orange-500 sm:w-auto"
                            >
                                See factory workflow
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </Link>
                    </div>

                    <div className="mx-auto mt-6 grid max-w-2xl gap-2 text-left text-sm font-semibold text-zinc-600 dark:text-zinc-400 xs:grid-cols-3 xs:text-center">
                        {proofItems.map((item) => (
                            <p key={item} className="flex min-w-0 items-center gap-2 xs:justify-center">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                <span className="min-w-0">{item}</span>
                            </p>
                        ))}
                    </div>

                    <p className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">
                        Already have an account?{' '}
                        <Link href="/login" className="font-semibold text-orange-700 hover:underline dark:text-orange-500">
                            Log in
                        </Link>
                        <span className="px-2 text-zinc-300">|</span>
                        <Link href="/join" className="font-semibold text-zinc-600 hover:text-zinc-950 hover:underline dark:text-zinc-300 dark:hover:text-white">
                            Supervisor join
                        </Link>
                    </p>
                </div>

                <div className="relative mx-auto mt-14 max-w-6xl">
                    <div className="absolute -inset-x-8 bottom-0 top-12 -z-10 bg-gradient-to-tr from-orange-500/20 via-orange-200/20 to-transparent blur-3xl" />
                    <div className="overflow-hidden rounded-lg border border-zinc-900/10 bg-white/96 shadow-[0_34px_110px_rgba(154,52,18,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/85">
                        <div className="grid lg:grid-cols-[4.5rem_1fr]">
                            <div className="hidden bg-zinc-950 p-4 text-white lg:block">
                                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-md border border-white/15 text-sm font-black text-orange-300">W</div>
                                <div className="mt-10 grid gap-4">
                                    {loopSteps.map((step, index) => (
                                        <div key={step} className="mx-auto flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-[10px] font-black text-zinc-400">
                                            0{index + 1}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <div className="border-b border-zinc-200/80 bg-zinc-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/5 sm:px-6">
                                    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-[0.26em] text-orange-700 dark:text-orange-400">Owner floor view</p>
                                            <p className="text-base font-black text-zinc-950 dark:text-white">Shift production workspace</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-zinc-500 sm:justify-end">
                                            <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                                Synced
                                            </span>
                                            <span className="hidden rounded-md border border-zinc-200 bg-white px-3 py-1.5 sm:inline dark:border-white/10 dark:bg-zinc-900">Today, 8 May</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-0 xl:grid-cols-[1fr_18rem]">
                                    <div className="p-4 sm:p-6">
                                        <div className="grid gap-2 xs:grid-cols-2 sm:grid-cols-4">
                                            {loopSteps.map((step, index) => (
                                                <div key={step} className={`min-w-0 border px-3 py-3 xs:px-4 xs:py-4 ${index === 2 ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-zinc-200 bg-white text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200'}`}>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-50">0{index + 1}</p>
                                                    <p className="mt-1 text-sm font-black">{step}</p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mobile-scroll-x mt-5 overflow-y-hidden border border-zinc-200 dark:border-white/10">
                                            {loomRows.map((row) => (
                                                <div key={row.loom} className="grid min-w-[36rem] grid-cols-[0.72fr_1.15fr_0.56fr_0.72fr] items-center gap-2 border-b border-zinc-200 bg-white px-3 py-4 text-sm last:border-b-0 dark:border-white/10 dark:bg-zinc-900/80 sm:min-w-0 sm:px-4">
                                                    <div>
                                                        <p className="font-black text-zinc-950 dark:text-white">{row.loom}</p>
                                                        <p className="text-xs text-zinc-500">{row.shift}</p>
                                                    </div>
                                                    <p className="truncate font-semibold text-zinc-700 dark:text-zinc-300">{row.fabric}</p>
                                                    <p className="font-black text-zinc-950 dark:text-white">{row.output}</p>
                                                    <p className="text-xs font-bold text-orange-700 dark:text-orange-400">{row.status}</p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.72fr]">
                                            <div className="border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900/80">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Order #214 progress</p>
                                                        <p className="mt-1 text-lg font-black text-zinc-950 dark:text-white">34,820 m of 50,000 m</p>
                                                    </div>
                                                    <span className="border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-black text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-400">
                                                        Pace watch
                                                    </span>
                                                </div>
                                                <div className="mt-4 h-2 overflow-hidden bg-zinc-100 dark:bg-white/10">
                                                    <div className="h-full w-[70%] bg-orange-600" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 border border-zinc-200 bg-zinc-50/70 dark:border-white/10 dark:bg-white/5">
                                                {[
                                                    ['12', 'looms'],
                                                    ['2 shifts', 'logged'],
                                                    ['₹8.40/m', 'rate'],
                                                ].map(([value, label]) => (
                                                    <div key={label} className="border-r border-zinc-200 p-4 last:border-r-0 dark:border-white/10">
                                                        <p className="font-black text-zinc-950 dark:text-white">{value}</p>
                                                        <p className="mt-1 text-xs text-zinc-500">{label}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-zinc-200 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-white/5 xl:border-l xl:border-t-0">
                                        <div className="grid gap-3">
                                            <div className="border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
                                                <ReceiptText className="h-5 w-5 text-orange-600" />
                                                <p className="mt-3 text-3xl font-black text-zinc-950 dark:text-white">₹48,240</p>
                                                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Payroll preview</p>
                                            </div>
                                            <div className="border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
                                                <MessageCircle className="h-5 w-5 text-emerald-600" />
                                                <p className="mt-3 text-sm font-black text-zinc-950 dark:text-white">Daily brief queued</p>
                                                <p className="mt-1 text-xs leading-5 text-zinc-500">Production, advances, and order pace sent over WhatsApp.</p>
                                            </div>
                                            <div className="border border-orange-200 bg-orange-50 p-4 dark:border-orange-500/20 dark:bg-orange-500/10">
                                                <p className="text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">Market run</p>
                                                <p className="mt-2 text-sm font-black text-zinc-950 dark:text-white">Keep looms moving when client orders dip.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
