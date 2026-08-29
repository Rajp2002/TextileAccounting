import LandingHeader from "@/components/landing/header";
import LandingHero from "@/components/landing/hero";
import LandingFeatures from "@/components/landing/features";
import LandingPricing from "@/components/landing/pricing";
import LandingFAQ from "@/components/landing/faq";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Calculator, CheckCircle2 } from 'lucide-react';

import LandingBackground from "@/components/landing/background";
import LandingFooter from "@/components/landing/footer";

export default function Home() {
  return (
    <main className="landing-scroll h-[100svh] w-full overflow-x-hidden overflow-y-auto bg-white font-sans text-zinc-950 selection:bg-orange-500/20 scroll-smooth">
      <div className="relative w-full min-h-max">
        <LandingBackground />
        <LandingHeader />
        <LandingHero />
        
        <div>
          <LandingFeatures />
        </div>
        
        <div>
          <LandingPricing />
        </div>
        
        <div>
          <LandingFAQ />
        </div>
 
        {/* Pre-footer CTA */}
        <section className="landing-section relative isolate overflow-hidden border-y border-orange-200 bg-orange-50/70">
          <div className="absolute left-1/2 top-0 h-80 w-[52rem] -translate-x-1/2 rounded-full bg-orange-400/15 blur-2xl" aria-hidden="true" />
          <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-6 py-20 sm:py-28 lg:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.8fr)] lg:gap-20 lg:px-8">
            <div className="relative max-w-3xl lg:pr-4">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-orange-700">
                Start with one factory and one costing desk
              </p>
              <h2 className="mt-5 max-w-4xl text-3xl font-black tracking-normal text-zinc-950 xs:text-4xl sm:text-6xl">
                Bring your yarn assumptions, factory costs, and margin into one costing record.
                <br />
                <span className="text-orange-600">Make the next price conversation clearer.</span>
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-700 sm:text-lg">
                Start with complete costing management in Lite, then carry the same costing into production with Weavly Base when your factory is ready.
              </p>
              <div className="mt-9 flex items-center gap-x-6">
                <Link href="/signup">
                  <Button size="lg" className="rounded-md px-8 py-6 text-base font-bold bg-zinc-950 text-white hover:bg-zinc-800 shadow-xl shadow-zinc-950/10 transition-all group">
                    Choose Weavly Lite or Base <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end" aria-label="Example Weavly cost sheet summary">
              <div className="absolute -inset-5 rounded-[2rem] bg-orange-300/30 blur-2xl" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-[1.75rem] border border-zinc-900/10 bg-white/95 p-5 shadow-[0_24px_80px_rgba(154,52,18,0.16)] sm:p-6">
                <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                      <Calculator className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Cost sheet</p>
                      <p className="mt-1 text-sm font-bold text-zinc-950">Cotton grey 40s · 2026</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Saved</span>
                </div>

                <div className="flex items-end justify-between gap-4 py-6">
                  <div>
                    <p className="text-xs font-semibold text-zinc-500">Estimated cost / metre</p>
                    <p className="mt-1 text-4xl font-black tracking-tight text-zinc-950">₹82.40</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-zinc-500">Target margin</p>
                    <p className="mt-1 text-xl font-black text-orange-600">18.6%</p>
                  </div>
                </div>

                <div className="space-y-3 border-t border-zinc-200 pt-5 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-600">Yarn assumptions</span>
                    <span className="font-bold text-zinc-950">₹51.20</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-600">Factory costs</span>
                    <span className="font-bold text-zinc-950">₹19.80</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-600">Transport + GST</span>
                    <span className="font-bold text-zinc-950">₹11.40</span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-[#fff8ea] px-4 py-3">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-600">Break-even price</span>
                  <span className="text-base font-black text-zinc-950">₹76.10</span>
                </div>

                <div className="mt-5 flex items-start gap-3 border-t border-zinc-200 pt-5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-600" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-800">Ready for the next quote</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">Warp, weft, rates, overheads, and margin stay in one record.</p>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 -left-4 hidden items-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-xs font-bold text-white shadow-xl shadow-zinc-950/20 sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                Exportable Cost Sheet
              </div>
            </div>
          </div>
        </section>
 
        <LandingFooter />
      </div>
    </main>
  );
}
