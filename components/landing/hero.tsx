import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, CheckCircle2, MessageCircle, ReceiptText } from 'lucide-react'

const loomRows = [
    { loom: 'Loom 04', fabric: 'Canvas Shine 100D', shift: 'Day', output: '186 m', status: 'On pace' },
    { loom: 'Loom 11', fabric: 'Order #214', shift: 'Night', output: '142 m', status: 'Needs assign' },
    { loom: 'Loom 18', fabric: 'Market run', shift: 'Day', output: '201 m', status: 'Ready payroll' },
]

const loopSteps = ['Estimate', 'Assign looms', 'Log shift', 'Settle']

export default function LandingHero() {
    return (
        <div className="relative isolate overflow-hidden pt-20">
            <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-12 sm:pb-28 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:pb-32 lg:pt-28">
                <div className="max-w-3xl">
                    <div>
                        <div>
                            <div className="inline-flex items-center gap-2 border border-amber-500/20 bg-white/70 px-3 py-1.5 text-sm font-semibold text-amber-800 shadow-sm backdrop-blur dark:bg-zinc-950/60 dark:text-amber-400">
                                <span className="h-2 w-2 rounded-full bg-amber-600" />
                                Phase 1: the weaving factory operating loop
                            </div>
                        </div>

                        <h1
                            className="mt-8 max-w-4xl text-5xl font-extrabold tracking-tight text-gray-950 sm:text-6xl dark:text-white leading-[1.04]"
                        >
                            From quote to loom to payroll, without the factory notebook.
                        </h1>

                        <p
                            className="mt-6 max-w-2xl text-lg leading-8 text-gray-600 dark:text-gray-300"
                        >
                            Weavly is focused on the Phase 1 work that actually moves a weaving unit: fabric estimating, order and market-run tracking, shift production logs, advances, payroll, dispatches, and WhatsApp updates.
                        </p>

                        <div
                            className="mt-9 space-y-5"
                        >
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <Link href="/signup" className="flex-1 sm:flex-none">
                                    <Button
                                        id="hero-owner-signup-btn"
                                        size="lg"
                                        className="w-full rounded-md bg-amber-600 px-7 py-6 text-base font-semibold text-white shadow-xl shadow-amber-500/20 transition-all hover:-translate-y-0.5 hover:bg-amber-700 sm:w-auto"
                                    >
                                        Start free 7-day trial
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                                <Link href="/join" className="flex-1 sm:flex-none">
                                    <Button
                                        id="hero-supervisor-join-btn"
                                        size="lg"
                                        variant="outline"
                                        className="w-full rounded-md border-2 border-gray-300 px-7 py-6 text-base font-semibold transition-all hover:-translate-y-0.5 hover:border-amber-500 hover:text-amber-700 dark:border-zinc-600 dark:text-white dark:hover:border-amber-500 sm:w-auto"
                                    >
                                        Join as supervisor
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                            <div className="grid gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 sm:grid-cols-3">
                                <p className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Full Premium access
                                </p>
                                <p className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> No credit card
                                </p>
                                <p className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Floor-ready PWA
                                </p>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Already have an account?{' '}
                                <Link href="/login" className="text-amber-700 hover:underline font-medium dark:text-amber-500">
                                    Log in
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>

                <div
                    className="relative"
                >
                    <div className="absolute -inset-6 -z-10 bg-gradient-to-tr from-amber-500/20 via-orange-500/10 to-transparent blur-3xl" />
                    <div className="overflow-hidden rounded-lg border border-gray-900/10 bg-white/85 shadow-2xl shadow-orange-900/10 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/80">
                        <div className="border-b border-gray-200/80 px-4 py-3 dark:border-white/10">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Today on floor</p>
                                    <p className="text-sm font-bold text-gray-950 dark:text-white">Shift production workspace</p>
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
                                        <div key={step} className="border border-gray-200 bg-gray-50 px-3 py-3 text-center dark:border-white/10 dark:bg-white/5">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">0{index + 1}</p>
                                            <p className="mt-1 text-xs font-bold text-gray-800 dark:text-gray-100">{step}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 overflow-hidden border border-gray-200 dark:border-white/10">
                                    {loomRows.map((row) => (
                                        <div key={row.loom} className="grid grid-cols-[0.7fr_1.2fr_0.55fr_0.65fr] items-center gap-2 border-b border-gray-200 bg-white px-3 py-3 text-sm last:border-b-0 dark:border-white/10 dark:bg-zinc-900/80">
                                            <div>
                                                <p className="font-bold text-gray-950 dark:text-white">{row.loom}</p>
                                                <p className="text-xs text-gray-500">{row.shift}</p>
                                            </div>
                                            <p className="truncate font-medium text-gray-700 dark:text-gray-300">{row.fabric}</p>
                                            <p className="font-bold text-gray-950 dark:text-white">{row.output}</p>
                                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">{row.status}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900/80">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Order #214</p>
                                            <p className="mt-1 text-sm font-bold text-gray-950 dark:text-white">34,820 m of 50,000 m</p>
                                        </div>
                                        <span className="border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                                            Pace watch
                                        </span>
                                    </div>
                                    <div className="mt-4 h-2 overflow-hidden bg-gray-100 dark:bg-white/10">
                                        <div className="h-full w-[70%] bg-amber-600" />
                                    </div>
                                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                                        <div>
                                            <p className="font-bold text-gray-950 dark:text-white">12</p>
                                            <p className="text-gray-500">looms</p>
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-950 dark:text-white">2 shifts</p>
                                            <p className="text-gray-500">logged</p>
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-950 dark:text-white">₹8.40/m</p>
                                            <p className="text-gray-500">rate</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-gray-200 bg-gray-50/80 p-4 dark:border-white/10 dark:bg-white/5 lg:border-l lg:border-t-0">
                                <div className="grid gap-3">
                                    <div className="border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
                                        <ReceiptText className="h-5 w-5 text-amber-600" />
                                        <p className="mt-3 text-2xl font-black text-gray-950 dark:text-white">₹48,240</p>
                                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Payroll preview</p>
                                    </div>
                                    <div className="border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
                                        <MessageCircle className="h-5 w-5 text-emerald-600" />
                                        <p className="mt-3 text-sm font-bold text-gray-950 dark:text-white">Daily brief queued</p>
                                        <p className="mt-1 text-xs leading-5 text-gray-500">Production, advances, and order pace sent over WhatsApp.</p>
                                    </div>
                                    <div className="border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Market run</p>
                                        <p className="mt-2 text-sm font-bold text-gray-950 dark:text-white">Keep looms moving when client orders dip.</p>
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
