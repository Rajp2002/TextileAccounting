import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, CheckCircle2, MessageCircle, ReceiptText } from 'lucide-react'

const loomRows = [
    { loom: 'Loom 04', fabric: 'Canvas Shine 100D', shift: 'Day', output: '186 m', status: 'On pace' },
    { loom: 'Loom 11', fabric: 'Order #214', shift: 'Night', output: '142 m', status: 'Needs worker' },
    { loom: 'Loom 18', fabric: 'Market run', shift: 'Day', output: '201 m', status: 'Payroll ready' },
]

const loopSteps = ['Estimate', 'Assign looms', 'Log shift', 'Settle']

export default function LandingHero() {
    return (
        <div className="relative z-10 isolate overflow-hidden pt-24 snap-start scroll-mt-28">
            <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-16 pt-14 sm:pb-24 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:pb-28 lg:pt-24">
                <div className="max-w-3xl">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.28em] text-orange-700 dark:text-orange-400">
                            Built for grey fabric weaving factories
                        </p>

                        <h1
                            className="mt-7 max-w-4xl text-5xl font-black tracking-tight text-zinc-950 sm:text-6xl lg:text-7xl dark:text-white leading-[0.98]"
                        >
                            One system for the whole factory floor. No notebook. No WhatsApp. No missed meters.
                        </h1>

                        <p
                            className="mt-7 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300"
                        >
                            Weavly connects fabric estimates, loom assignments, shift meter logs, dispatches, advances, and payroll so owners know what happened on the floor without chasing registers and WhatsApp messages.
                        </p>

                        <div
                            className="mt-9 space-y-5"
                        >
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <Link href="/signup" className="flex-1 sm:flex-none">
                                    <Button
                                        id="hero-owner-signup-btn"
                                        size="lg"
                                        className="w-full rounded-md bg-zinc-950 px-7 py-6 text-base font-bold text-white shadow-xl shadow-zinc-950/10 transition-all hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 sm:w-auto"
                                    >
                                        Request pilot access
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                                <Link href="#workflow" className="flex-1 sm:flex-none">
                                    <Button
                                        id="hero-workflow-btn"
                                        size="lg"
                                        variant="outline"
                                        className="w-full rounded-md border border-zinc-300 bg-white/80 px-7 py-6 text-base font-bold transition-all hover:border-orange-500 hover:text-orange-700 dark:border-zinc-600 dark:bg-zinc-950/50 dark:text-white dark:hover:border-orange-500 sm:w-auto"
                                    >
                                        See factory workflow
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                            <div className="grid gap-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400 sm:grid-cols-3">
                                <p className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> 7-day Premium trial
                                </p>
                                <p className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> No credit card
                                </p>
                                <p className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Floor-ready PWA
                                </p>
                            </div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Already have an account?{' '}
                                <Link href="/login" className="text-orange-700 hover:underline font-semibold dark:text-orange-500">
                                    Log in
                                </Link>
                                <span className="px-2 text-zinc-300">|</span>
                                <Link href="/join" className="text-zinc-600 hover:text-zinc-950 hover:underline font-semibold dark:text-zinc-300 dark:hover:text-white">
                                    Supervisor join
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>

                <div
                    className="relative"
                >
                    <div className="absolute -inset-6 -z-10 bg-gradient-to-tr from-orange-500/20 via-amber-500/10 to-transparent blur-3xl" />
                    <div className="overflow-hidden rounded-lg border border-zinc-900/10 bg-white/95 shadow-[0_28px_90px_rgba(154,52,18,0.16)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/85">
                        <div className="border-b border-zinc-200/80 bg-zinc-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-700 dark:text-orange-400">Owner floor view</p>
                                    <p className="text-sm font-black text-zinc-950 dark:text-white">Shift production workspace</p>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                    Synced
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-0 lg:grid-cols-[1fr_0.72fr]">
                            <div className="p-4 sm:p-5">
                                <div className="grid grid-cols-4 gap-2">
                                    {loopSteps.map((step, index) => (
                                        <div key={step} className="border border-zinc-200 bg-zinc-50 px-3 py-3 text-center dark:border-white/10 dark:bg-white/5">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">0{index + 1}</p>
                                            <p className="mt-1 text-xs font-black text-zinc-800 dark:text-zinc-100">{step}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 overflow-hidden border border-zinc-200 dark:border-white/10">
                                    {loomRows.map((row) => (
                                        <div key={row.loom} className="grid grid-cols-[0.7fr_1.2fr_0.55fr_0.65fr] items-center gap-2 border-b border-zinc-200 bg-white px-3 py-3 text-sm last:border-b-0 dark:border-white/10 dark:bg-zinc-900/80">
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

                                <div className="mt-4 border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900/80">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Order #214</p>
                                            <p className="mt-1 text-sm font-black text-zinc-950 dark:text-white">34,820 m of 50,000 m</p>
                                        </div>
                                        <span className="border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-black text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-400">
                                            Pace watch
                                        </span>
                                    </div>
                                    <div className="mt-4 h-2 overflow-hidden bg-zinc-100 dark:bg-white/10">
                                        <div className="h-full w-[70%] bg-orange-600" />
                                    </div>
                                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                                        <div>
                                            <p className="font-black text-zinc-950 dark:text-white">12</p>
                                            <p className="text-zinc-500">looms</p>
                                        </div>
                                        <div>
                                            <p className="font-black text-zinc-950 dark:text-white">2 shifts</p>
                                            <p className="text-zinc-500">logged</p>
                                        </div>
                                        <div>
                                            <p className="font-black text-zinc-950 dark:text-white">₹8.40/m</p>
                                            <p className="text-zinc-500">rate</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-zinc-200 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-white/5 lg:border-l lg:border-t-0">
                                <div className="grid gap-3">
                                    <div className="border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
                                        <ReceiptText className="h-5 w-5 text-orange-600" />
                                        <p className="mt-3 text-2xl font-black text-zinc-950 dark:text-white">₹48,240</p>
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
    )
}
