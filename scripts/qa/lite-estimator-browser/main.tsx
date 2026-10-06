import React from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from '@/lib/i18n/context'
import { OwnerPlanProvider } from '@/components/providers/owner-plan-provider'
import { OwnerSidebar } from '@/components/navigation/owner-sidebar'
import { MobileWorkflowNavigation } from '@/components/navigation/mobile-workflow-navigation'
import { BrandBackground } from '@/components/brand-background'
import EstimatorClient from '@/app/(dashboard)/owner/estimator/EstimatorClient'
import FreeWorkspace from '@/app/free/FreeWorkspace'
import FreeClient from '@/app/free/FreeClient'
import { MobileViewport } from '@/components/mobile-viewport'
import { MobileInputNavigation } from '@/components/mobile-input-navigation'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { usePathname } from './navigation'
import '@/app/globals.css'
import '@/app/mobile.css'

const params = new URLSearchParams(location.search)
if (params.get('language')) localStorage.setItem('weavly_language', params.get('language')!)
const tier = params.get('tier') === 'base' ? 'base' : 'lite'
const userId = params.get('user') ?? 'synthetic-owner'
const orgId = params.get('org') ?? 'synthetic-org'
const templates = await fetch('/__fixture__/templates').then(response => response.json())
// Explicit fixture-only notices for actual Toaster/modal paint-order checks.
Object.assign(window, { __fixtureToast: (type: 'success' | 'warning' | 'error', message: string) => {
    toast.dismiss()
    toast[type](message, { duration: 60000 })
} })
const profile = { factory_id: orgId, updated_at: '2026-10-01T00:00:00Z', is_configured: true, overhead_mode: 'direct' as const, overhead_override_per_m: 3, default_margin_pct: 15, default_commission_pct: 0, default_transport_per_m: 0, default_warp_yarn_rate_per_kg: 120, default_weft_yarn_rate_per_kg: 112, loom_count: 10, monthly_working_days: 26, avg_output_per_loom_per_day: 300, monthly_output_m: 78000 }
const PaidEstimator = EstimatorClient as React.ComponentType<React.ComponentProps<typeof EstimatorClient> & { mobileTier?: 'lite' | 'base' }>
function App() {
    const pathname = usePathname()
    if (pathname.startsWith('/free')) return <FreeWorkspace userName="Synthetic Owner"><FreeClient userId={userId} orgId={orgId} organizationName="Synthetic Textile" tutorialDismissed /></FreeWorkspace>
    return <OwnerPlanProvider access={{ subscriptionTier: tier, effectiveTier: tier }}><div className="relative isolate min-h-svh overflow-x-hidden bg-background" data-owner-shell>
        <BrandBackground variant="app" /><OwnerSidebar factoryName="Synthetic Textile" userName="Synthetic Owner" subscriptionTier={tier} productionMode="market_run" />
        <div className="mobile-workspace-content relative z-10 min-w-0 px-safe"><main id="owner-main" tabIndex={-1} className="dashboard-main mx-auto min-h-svh w-full min-w-0 max-w-7xl px-3 pb-5 pt-[calc(1rem+env(safe-area-inset-top,0px))] xs:px-4 md:px-6 md:pb-6 md:pt-[calc(1.5rem+var(--safe-area-top))] lg:px-8">
            <MobileWorkflowNavigation tier={tier} productionMode="market_run" />
            {pathname === '/owner/estimator' ? <PaidEstimator mobileTier={tier} initialProfile={profile} initialTemplates={params.has('qualities-loading') ? undefined : templates} initialWorkers={[]} staleDefaultRateNames={[]} canUseProductionPipeline={tier === 'base'} organizationName="Synthetic Textile" tutorialDismissed={!params.has('guide-invite')} wizardDismissed userId={userId} orgId={orgId} /> : <section data-synthetic-destination><h1>Synthetic {pathname} destination</h1><p>Navigation fixture only; records screen verified separately.</p></section>}
        </main></div>
    </div></OwnerPlanProvider>
}
createRoot(document.getElementById('root')!).render(<I18nProvider><MobileViewport /><MobileInputNavigation /><App /><Toaster /></I18nProvider>)
