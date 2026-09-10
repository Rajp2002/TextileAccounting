import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

const proofItems = ['Free · Lite · Base', 'No card needed for Free', 'GST included on paid plans']

const estimatorSignals = [
    'Production cost per metre',
    'Warp and weft assumptions',
    'Margin and break-even price',
    'Save Costing and Export Cost Sheet',
]

export default function LandingHero() {
    return (
        <>
            <section className="landing-section relative z-10 isolate overflow-hidden pt-[calc(5.5rem+env(safe-area-inset-top,0px))] xs:pt-24">
                <div className="mx-auto w-full max-w-7xl px-3 py-8 xs:px-6 xs:py-14 lg:px-8 lg:pb-12 lg:pt-28">
                    <div className="mx-auto max-w-6xl text-center">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-700 dark:text-orange-400 xs:text-xs xs:tracking-[0.32em]">
                            Estimator-first for grey fabric weaving factories
                        </p>

                        <h1 className="mx-auto mt-5 max-w-6xl text-4xl font-black leading-[1.02] tracking-normal text-zinc-950 xs:mt-7 xs:text-5xl sm:text-7xl lg:text-[5.25rem] dark:text-white">
                            Know your cost before you commit to the next order.
                        </h1>

                        <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-zinc-700 xs:mt-7 sm:text-lg sm:leading-8 dark:text-zinc-300">
                            Start with two free costings per week. Choose Lite for unlimited costings, saved qualities, and yarn rates, or Base to connect costing with production and worker pay.
                        </p>

                        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                            <Link href="/signup?plan=free" className="w-full sm:w-auto">
                                <Button
                                    id="hero-owner-signup-btn"
                                    size="lg"
                                    className="w-full rounded-md bg-zinc-950 px-8 py-6 text-base font-bold text-white shadow-xl shadow-zinc-950/10 transition-all hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 sm:w-auto"
                                >
                                    Start with Free
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                            <Link href="#pricing" className="w-full sm:w-auto">
                                <Button
                                    id="hero-product-btn"
                                    size="lg"
                                    variant="outline"
                                    className="w-full rounded-md border border-zinc-300 bg-white/80 px-8 py-6 text-base font-bold transition-all hover:border-orange-500 hover:text-orange-700 dark:border-zinc-600 dark:bg-zinc-950/50 dark:text-white dark:hover:border-orange-500 sm:w-auto"
                                >
                                    Compare all plans
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                        </div>

                        <div className="mx-auto mt-6 grid max-w-3xl gap-2 text-left text-sm font-semibold text-zinc-700 dark:text-zinc-400 xs:grid-cols-3 xs:text-center">
                            {proofItems.map((item) => (
                                <p key={item} className="flex min-w-0 items-center gap-2 xs:justify-center">
                                    <CheckCircle2 className="h-4 w-4 flex-none text-emerald-600" />
                                    <span className="min-w-0">{item}</span>
                                </p>
                            ))}
                        </div>

                        <p className="mt-5 text-sm text-zinc-700 dark:text-zinc-400">
                            Already have an account?{' '}
                            <Link href="/login" className="font-semibold text-orange-700 hover:underline dark:text-orange-500">
                                Log in
                            </Link>
                        </p>
                    </div>
                </div>
            </section>

            <section className="landing-section relative z-10 isolate overflow-hidden" id="product" aria-label="Current Weavly estimator view">
                <div className="mx-auto grid w-full max-w-7xl gap-7 px-3 py-14 xs:px-6 sm:py-20 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:px-8 lg:py-12">
                    <div className="max-w-xl">
                        <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-700 dark:text-orange-400">The Weavly costing workspace</p>
                        <h2 className="mt-4 text-4xl font-black leading-[1.05] text-zinc-950 sm:text-6xl dark:text-white">
                            Open the app. See the numbers before you quote.
                        </h2>
                        <p className="mt-5 text-lg leading-8 text-zinc-700 dark:text-zinc-300">
                            Free lets you calculate, save, and export occasional costings. Lite gives you the complete costing desk: build a reliable estimate, save the quality and rates, and return to the decision whenever you need it. When the decision becomes a production job, Base carries that costing into the production workflow.
                        </p>
                        <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                            {estimatorSignals.map((signal) => (
                                <li key={signal} className="flex items-start gap-3 text-sm font-bold leading-6 text-zinc-800 dark:text-zinc-200">
                                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-orange-600" aria-hidden="true" />
                                    {signal}
                                </li>
                            ))}
                        </ul>
                        <p className="mt-7 border-l-2 border-orange-500 pl-4 text-xs leading-5 text-zinc-700 dark:text-zinc-400">
                            Weavly Lite costing workspace. Example costing data shown.
                        </p>
                    </div>

                    <div className="relative min-w-0">
                        <div className="absolute -inset-6 -z-10 bg-gradient-to-tr from-orange-500/20 via-orange-200/20 to-transparent blur-2xl" aria-hidden="true" />
                        <div className="overflow-hidden rounded-xl border border-zinc-900/10 bg-white shadow-[0_34px_110px_rgba(154,52,18,0.18)] dark:border-white/10">
                            <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-zinc-900">
                                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                                <span className="ml-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-600">Cost Estimate · Owner view</span>
                            </div>
                            <div className="relative aspect-[16/10] overflow-hidden bg-[#fff8ea]">
                                <Image
                                    src="/images/estimator-base-owner.png"
                                    alt="Current Weavly costing workspace showing production cost, suggested price, margin, break-even price, and pricing assumptions"
                                    fill
                                    priority
                                    sizes="(max-width: 1024px) 100vw, 62vw"
                                    className="object-cover object-top"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    )
}
