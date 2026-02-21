import LandingHeader from "@/components/landing/header";
import LandingHero from "@/components/landing/hero";
import LandingFeatures from "@/components/landing/features";
import LandingPricing from "@/components/landing/pricing";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 font-sans selection:bg-indigo-500/30">
      <LandingHeader />
      <LandingHero />
      <LandingFeatures />
      <LandingPricing />

      {/* Pre-footer CTA */}
      <section className="relative isolate overflow-hidden bg-zinc-900 border-y border-white/10 mt-24">
        <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Ready to scale your production?
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Start your free trial today.</span>
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

        {/* Subtle Background Glow */}
        <div className="absolute -top-24 -right-24 -z-10 transform-gpu overflow-hidden blur-3xl" aria-hidden="true">
          <div className="aspect-[1155/678] w-[36.125rem] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-20" />
        </div>
      </section>

      {/* Upgraded Footer */}
      <footer className="bg-zinc-950 py-12 px-6 border-t border-white/10 text-white">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-base">T</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-white">Textile SaaS</span>
          </div>
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} Textile SaaS. All rights reserved.
          </p>
          <div className="flex gap-8 text-sm font-medium text-gray-400">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
