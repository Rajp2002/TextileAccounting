/* eslint-disable -- guided-tour harness: a local diagnostic tool, not application code. */
import '@/app/globals.css'
import '@/app/mobile.css'
import React, { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import * as require_i18n from '@/lib/i18n/context'
import { I18nProvider } from '@/lib/i18n/context'
if (new URLSearchParams(location.search).get('s') === 'labels') { const pth = new URLSearchParams(location.search).get('path') ?? '/owner/production'; history.replaceState(null, '', pth + location.search) }

const params = new URLSearchParams(location.search)
const scenario = params.get('s') ?? 'production'
const lang = params.get('lang') ?? 'en'
try { localStorage.setItem('weavly_language', lang) } catch {}
if (params.get('fresh') === '1') { try { Object.keys(localStorage).filter(k => k.startsWith('weavly:tour')).forEach(k => localStorage.removeItem(k)); sessionStorage.clear() } catch {} }
;(window as any).__harnessPath = params.get('path') ?? {
  production: '/owner/production', 'fabric-stock': '/owner/stock', 'yarn-stock': '/owner/stock/yarn', dispatch: '/owner/dispatches',
  payroll: '/owner/payroll', machines: '/owner/machines', workers: '/owner/workers', estimator: '/owner/estimator', 'free-estimator': '/free',
  rates: '/owner/rates', quotes: '/owner/quotes', 'free-costings': '/free/costings', assignments: '/owner/assignments',
}[scenario]

const today = '2026-09-27'
const Live = ({ label }: { label: string }) => (
  <div data-harness-live="true" className="space-y-4">
    <h1 className="text-xl font-bold text-ink">{label} (live page placeholder)</h1>
    {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-40 rounded-xl border border-hairline bg-surface" />)}
  </div>
)

function LabelProbe() {
  const { tx, language } = (require_i18n as any).useTranslation()
  const [out, setOut] = React.useState<any>(null)
  React.useEffect(() => {
    if (language !== lang) return
    const t = window.setTimeout(async () => {
      const all: any = (await import('./labels.json')).default
      const path = location.pathname
      const res: any = {}
      for (const label of all[path] ?? []) res[label] = tx(label)
      ;(window as any).__labels = res; setOut(res)
    }, 300)
    return () => window.clearTimeout(t)
  }, [language, tx])
  return <pre data-labels>{JSON.stringify(out, null, 1)}</pre>
}
const scenarios: Record<string, () => Promise<React.ReactElement>> = {
  labels: async () => <LabelProbe />,
  production: async () => { const { default: C } = await import('@/components/production/ProductionGuidedTour'); return <C userId="u1" orgId="o1" userMetadata={{}}><Live label="Production" /></C> },
  'fabric-stock': async () => { const { default: C } = await import('@/components/stock/StockGuidedTour'); return <C kind="fabric-stock" userId="u1" orgId="o1" userMetadata={{}}><Live label="Fabric stock" /></C> },
  'yarn-stock': async () => { const { default: C } = await import('@/components/stock/StockGuidedTour'); return <C kind="yarn-stock" userId="u1" orgId="o1" userMetadata={{}}><Live label="Yarn stock" /></C> },
  dispatch: async () => { const { default: C } = await import('@/components/dispatches/DispatchGuidedTour'); return <C userId="u1" orgId="o1" userMetadata={{}}><Live label="Dispatches" /></C> },
  payroll: async () => { const { default: C } = await import('@/components/payroll/PayrollGuidedTour'); return <C variant="base" userId="u1" orgId="o1" userMetadata={{}}><Live label="Payroll" /></C> },
  machines: async () => { const { default: C } = await import('@/app/(dashboard)/owner/production/registers/MachinesRegister'); return <C userId="u1" orgId="o1" userMetadata={{}} machines={[]} today={today} /> },
  estimator: async () => { const { default: C } = await import('@/app/(dashboard)/owner/estimator/EstimatorClient'); return <C initialProfile={null as any} initialTemplates={undefined} initialWorkers={undefined} tutorialDismissed={false} wizardDismissed userId="u1" orgId="o1" canUseProductionPipeline={params.get('tier') !== 'lite'} staleDefaultRateNames={[]} organizationName="Sample Mills" /> },
  'free-estimator': async () => { const { default: C } = await import('@/app/(dashboard)/owner/estimator/EstimatorClient'); return <C freeMode disableAutosave onFreeUpgrade={() => {}} userId="u1" orgId="o1" organizationName="Sample Mills" initialTemplates={[]} initialWorkers={[]} staleDefaultRateNames={[]} canUseProductionPipeline={false} tutorialDismissed={false} wizardDismissed /> },
  rates: async () => { const { default: C } = await import('@/app/(dashboard)/owner/rates/RatesClient'); return <C initialRates={[]} initialConflicts={[]} defaultReviewIntervalDays={90} tutorialDismissed={false} userId="u1" orgId="o1" /> },
  quotes: async () => { const { default: C } = await import('@/app/(dashboard)/owner/quotes/QuotesClient'); return <C initialQuotes={[]} initialTemplates={[]} initialProfile={undefined} initialWorkers={[]} userId="u1" orgId="o1" canUseProductionPipeline={params.get('tier') !== 'lite'} organizationName="Sample Mills" /> },
  'free-costings': async () => { const { default: C } = await import('@/app/free/costings/SavedFreeCostings'); return <C /> },
  assignments: async () => { const { default: C } = await import('@/app/(dashboard)/owner/production/BaseProductionClient'); const empty: any = { orgId: 'o1', actorId: 'u1', today, payrollPeriod: { start: '2026-09-01', end: '2026-09-30' }, costings: [], jobs: [], entries: [], workers: [], machines: [], assignments: [], machineJobContexts: [], dailyBatches: [], batchRevisions: [], advances: [], settlements: [], settlementLines: [], payrollPeriods: [], payables: [], allocations: [] }; return <C initialData={empty} view="operations" tourMetadata={{}} /> },
  workers: async () => { const { default: C } = await import('@/app/(dashboard)/owner/production/registers/WorkersRegister'); return <C userId="u1" orgId="o1" userMetadata={{}} workers={[]} today={today} /> },
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-svh overflow-x-hidden bg-background" data-owner-shell>
      <div className="weavly-app-bg fixed inset-0 -z-10" />
      <aside className="harness-sidebar" data-harness-sidebar="true" />
      <div className="mobile-workspace-content relative z-10 min-w-0 px-safe">
        <main id="owner-main" tabIndex={-1} className="dashboard-main mx-auto min-h-svh w-full min-w-0 max-w-7xl px-3 pb-5 pt-4 xs:px-4 md:px-6 md:py-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}

async function start() {
  const make = scenarios[scenario]
  const el = make ? await make() : <p>Unknown scenario {scenario}</p>
  createRoot(document.getElementById('root')!).render(<I18nProvider><Shell><Suspense fallback={null}>{el}</Suspense></Shell></I18nProvider>)
  ;(window as any).__harnessReady = true
}
start().catch(error => { document.body.textContent = 'Harness error: ' + error?.stack; (window as any).__harnessError = String(error?.stack ?? error) })
