/* eslint-disable -- guided-tour harness: a local diagnostic tool, not application code. */
import '@/app/globals.css'
import '@/app/mobile.css'
import React, { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { GuidedTour } from '@/components/tours/GuidedTour'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
import type { TourStepSpec } from '@/lib/tours/tour-types'
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

const foundationSteps: TourStepSpec[] = [
  { id: 'top-left', anchor: '[data-foundation-target="top-left"]', kind: 'live' },
  { id: 'centre', anchor: '[data-foundation-target="centre"]', kind: 'live' },
  { id: 'right-edge', anchor: '[data-foundation-target="right-edge"]', kind: 'live' },
  { id: 'bottom-edge', anchor: '[data-foundation-target="bottom-edge"]', kind: 'live' },
  { id: 'scroller', anchor: '[data-foundation-target="scroller"]', kind: 'live' },
  { id: 'dialog', anchor: '[data-foundation-target="dialog"]', context: '#sandbox-dialog', kind: 'sample' },
]
function Foundation() {
  const { language } = require_i18n.useTranslation()
  const common = tourCommonCopy[language]
  const [step, setStep] = React.useState<string | null>(null)
  const launcher = React.useRef<HTMLButtonElement>(null)
  const box: React.CSSProperties = { background: '#fff8ea', border: '1px solid #bbb3a5', borderRadius: 8, padding: 12, width: 90, height: 56, fontSize: 14 }
  return <section data-foundation data-i18n-skip="true" style={{ minHeight: 1800 }}>
    <button type="button" ref={launcher} data-tour-control="take-tour" onClick={() => setStep('top-left')} style={{ position: 'fixed', top: 16, left: window.innerWidth < 768 ? 16 : 280, zIndex: 2, background: '#1b2930', color: 'white', borderRadius: 8, padding: 12 }}>{common.startGuide}</button>
    <div data-foundation-target="top-left" style={{ ...box, position: 'fixed', left: 24, top: 96 }}>1</div>
    <div data-foundation-target="centre" style={{ ...box, position: 'fixed', left: window.innerWidth < 768 ? '50vw' : 'calc(50vw - 45px)', top: 230 }}>2</div>
    <div data-foundation-target="right-edge" style={{ ...box, position: 'fixed', right: 24, top: 96 }}>3</div>
    <div data-foundation-target="bottom-edge" style={{ ...box, position: 'absolute', left: '50%', top: 1100 }}>4</div>
    <div data-foundation-scroller style={{ position: 'fixed', left: 24, top: 160, width: 150, height: 300, overflow: 'auto', background: '#f4ebda', border: '1px solid #aaa' }}>
      <div style={{ height: 1000, position: 'relative' }}><div data-foundation-target="scroller" style={{ ...box, position: 'absolute', top: 700, left: 16 }}>5</div></div>
    </div>
    {step === 'dialog' && <div id="sandbox-dialog" role="dialog" aria-label={common.sample} style={{ position: 'fixed', top: 90, left: window.innerWidth < 768 ? 16 : 280, width: window.innerWidth < 768 ? 'calc(100vw - 32px)' : 320, height: 300, background: '#fff', border: '1px solid #aaa', borderRadius: 14, padding: 20 }}>
      <p style={{ border: '1px solid #ddd', background: '#fbf6eb', padding: 8 }}>{common.sampleBanner}</p>
      <div data-foundation-target="dialog" style={{ ...box, marginTop: 28 }}>6</div>
    </div>}
    {step && <GuidedTour tourId="configuration" steps={foundationSteps} step={step} copy={() => ({ title: common.sample, body: common.sampleBanner, detail: common.unavailable })} onStepChange={setStep} launcher={launcher} recordCompletion={false} />}
  </section>
}

const scenarios: Record<string, () => Promise<React.ReactElement>> = {
  foundation: async () => <Foundation />,
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
      {scenario !== 'foundation' && <aside className="harness-sidebar" data-harness-sidebar="true" />}
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
