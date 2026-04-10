import LandingHeader from "@/components/landing/header";
import LandingHero from "@/components/landing/hero";
import LandingFeatures from "@/components/landing/features";
import LandingPricing from "@/components/landing/pricing";
import LandingFAQ from "@/components/landing/faq";
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

import LandingBackground from "@/components/landing/background";
import LandingFooter from "@/components/landing/footer";

export default function Home() {
  return (
    <main className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden snap-y snap-mandatory font-sans selection:bg-indigo-500/30 scroll-smooth">
      <div className="relative w-full min-h-max">
        <LandingBackground />
        <LandingHeader />
        
        <div className="snap-start shrink-0">
          <LandingHero />
        </div>
        
        <div className="snap-start shrink-0">
          <LandingFeatures />
        </div>
        
        <div className="snap-start shrink-0">
          <LandingPricing />
        </div>
        
        <div className="snap-start shrink-0">
          <LandingFAQ />
        </div>

        {/* Pre-footer CTA */}
        <div className="snap-start shrink-0">
          <section className="relative isolate overflow-hidden bg-zinc-900 border-y border-white/10 mt-24">
            <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
                  Ready to scale your production?
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-400">Start your free trial today.</span>
                </h2>
                <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-gray-300">
                  Join leading textile manufacturers who have transformed their operations with our platform.
                </p>
                <div className="mt-10 flex items-center justify-center gap-x-6">
                  <Link href="/signup">
                    <Button size="lg" className="rounded-full px-8 py-6 text-base font-semibold bg-white text-gray-900 hover:bg-gray-100 shadow-xl shadow-white/10 transition-all hover:-translate-y-1 hover:scale-105 group">
                      Get Started <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>

        <LandingFooter />
      </div>
    </main>
  );
}
