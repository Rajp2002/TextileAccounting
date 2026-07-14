import LandingHeader from "@/components/landing/header";
import LandingHero from "@/components/landing/hero";
import LandingFeatures from "@/components/landing/features";
import LandingPricing from "@/components/landing/pricing";
import LandingFAQ from "@/components/landing/faq";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

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
        <section className="landing-section relative isolate overflow-hidden border-y border-zinc-900 bg-zinc-950">
          <div className="absolute inset-0 bg-grid-pattern opacity-15" aria-hidden="true" />
          <div className="absolute left-1/2 top-0 h-80 w-[52rem] -translate-x-1/2 rounded-full bg-orange-500/20 blur-3xl" aria-hidden="true" />
          <div className="px-6 py-20 sm:px-6 sm:py-28 lg:px-8">
            <div className="relative mx-auto max-w-5xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-orange-300">
                Start with one factory floor
              </p>
              <h2 className="mx-auto mt-5 max-w-4xl text-3xl font-black tracking-normal text-white xs:text-4xl sm:text-6xl">
                Bring your active orders, supervisors, looms, and payroll into one record.
                <br />
                <span className="text-orange-300">See the difference in the first week.</span>
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-zinc-300 sm:text-lg">
                A focused pilot is enough: one supervisor logs shift meters, the owner sees order pace, and payroll starts from the same production data.
              </p>
              <div className="mt-9 flex items-center justify-center gap-x-6">
                <Link href="/signup">
                  <Button size="lg" className="rounded-md px-8 py-6 text-base font-bold bg-white text-zinc-950 hover:bg-orange-50 shadow-xl shadow-orange-500/10 transition-all group">
                    Request Pilot Access <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
 
        <LandingFooter />
      </div>
    </main>
  );
}
