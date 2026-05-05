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
    <main className="h-screen w-full overflow-x-hidden overflow-y-auto font-sans selection:bg-amber-500/30 scroll-smooth snap-y snap-proximity">
      <div className="relative w-full">
        <LandingBackground />
        <LandingHeader />
        <LandingHero />
        
        <LandingFeatures />
        
        <LandingPricing />
        
        <LandingFAQ />
 
        {/* Pre-footer CTA */}
        <section className="relative isolate overflow-hidden bg-zinc-950 border-y border-white/10 mt-24 snap-start scroll-mt-28">
          <div className="absolute inset-0 bg-grid-pattern opacity-20" aria-hidden="true" />
          <div className="absolute left-1/2 top-0 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-orange-500/20 blur-3xl" aria-hidden="true" />
          <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
            <div className="relative mx-auto max-w-3xl text-center">
              <p className="text-sm font-bold uppercase tracking-widest text-amber-400">
                Start with one factory floor
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
                Bring your active orders, supervisors, looms, and payroll into one record.
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-400">See the difference in the first week.</span>
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-gray-300">
                A focused pilot is enough: one supervisor logs shift meters, the owner sees order pace, and payroll starts from the same production data.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Link href="/signup">
                  <Button size="lg" className="rounded-md px-8 py-6 text-base font-semibold bg-white text-gray-900 hover:bg-gray-100 shadow-xl shadow-white/10 transition-all group">
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
