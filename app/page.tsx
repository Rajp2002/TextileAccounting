import { cn } from "@/lib/utils";
import LandingHeader from "@/components/landing/header";
import LandingHero from "@/components/landing/hero";
import LandingProduct from "@/components/landing/product";
import LandingPaise from "@/components/landing/paise";
import LandingWorkflow from "@/components/landing/workflow";
import LandingFit from "@/components/landing/fit";
import LandingPlans from "@/components/landing/plans";
import LandingPricing from "@/components/landing/pricing";
import LandingFAQ from "@/components/landing/faq";
import LandingClosing from "@/components/landing/closing";
import LandingFooter from "@/components/landing/footer";
import { landingFontVariables } from "@/components/landing/fonts";
import { SampleCostingProvider } from "@/components/landing/sample-costing-context";
import { costSample } from "@/components/landing/sample-costing";
import { SAMPLE_START } from "@/components/landing/sample-format";
import s from "@/components/landing/landing.module.css";
import { IntroPrePaintScript } from "@/components/intro/intro-pre-paint-script";
import { WeavingIntro } from "@/components/intro/weaving-intro";

export default function Home() {
  return (
    <main className="landing-scroll scroll-pt-28 h-[100svh] w-full overflow-x-hidden overflow-y-auto bg-[#f4f2ec] font-sans text-zinc-950 selection:bg-orange-500/20 scroll-smooth motion-reduce:scroll-auto">
      <IntroPrePaintScript surface="landing" />
      <WeavingIntro surface="landing" />
      {/* The fixed header sits outside the page plane so the intro can give the page a
          little depth while the navbar lands. Landing type and colour live on the plane
          only, so the navbar keeps its own. */}
      <LandingHeader />
      <div className={cn(s.page, landingFontVariables, "w-full min-h-max")} data-weavly-intro-page>
        <SampleCostingProvider start={costSample(SAMPLE_START)}>
          <LandingHero />
          <LandingProduct />
        </SampleCostingProvider>
        <LandingPaise />
        <LandingWorkflow />
        <LandingFit />
        <LandingPlans />
        <LandingPricing />
        <LandingFAQ />
        <LandingClosing />
        <LandingFooter />
      </div>
    </main>
  );
}
