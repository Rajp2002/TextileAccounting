import React from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from '@/lib/i18n/context'
import FreeWorkspace from '@/app/free/FreeWorkspace'
import EstimatorClient from '@/app/(dashboard)/owner/estimator/EstimatorClient'
import SavedFreeCostings from '@/app/free/costings/SavedFreeCostings'
import FreeClient from '@/app/free/FreeClient'
import { MobileViewport } from '@/components/mobile-viewport'
import { MobileInputNavigation } from '@/components/mobile-input-navigation'
import { Toaster } from '@/components/ui/sonner'
import '@/app/globals.css'
import '@/app/mobile.css'

const params = new URL(location.href).searchParams
if (params.get('language')) localStorage.setItem('weavly_language', params.get('language')!)
const history = location.pathname === '/free/costings'
const paid = params.get('tier') === 'lite' || params.get('tier') === 'base'
const initialSaved = params.get('scenario') === 'correction' ? await fetch('/__fixture__/saved').then(response => response.json()) : undefined

createRoot(document.getElementById('root')!).render(<I18nProvider><MobileViewport /><MobileInputNavigation /><FreeWorkspace userName="Synthetic Owner" initialTier={paid ? params.get('tier') as 'lite' | 'base' : 'free'}>
    {history ? <SavedFreeCostings userId="synthetic-owner" orgId="synthetic-org" userMetadata={{}} initialCostingId={params.get('costing') ?? undefined} /> : paid ? <EstimatorClient userId="synthetic-owner" orgId="synthetic-org" initialTemplates={[]} initialWorkers={[]} canUseProductionPipeline={false} staleDefaultRateNames={[]} organizationName="Synthetic Textile" tutorialDismissed wizardDismissed freeMode={false} disableAutosave /> : <FreeClient userId="synthetic-owner" orgId="synthetic-org" organizationName="Synthetic Textile" tutorialDismissed={!params.has('guide-invite')} initialFreeCosting={initialSaved} />}
</FreeWorkspace><Toaster /></I18nProvider>)
