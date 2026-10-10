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
  production: '/owner/production', 'daily-sheet': '/owner/production/daily-sheet', 'fabric-stock': '/owner/stock', 'yarn-stock': '/owner/stock/yarn', dispatch: '/owner/dispatches',
  payroll: '/owner/payroll', 'payroll-extra': '/owner/payroll', 'payroll-records': '/owner/payroll', machines: '/owner/machines', workers: '/owner/workers', 'workers-salary': '/owner/workers', estimator: '/owner/estimator', 'free-estimator': '/free',
  rates: '/owner/rates', 'rates-populated': '/owner/rates', quotes: '/owner/quotes', 'quotes-compare': '/owner/quotes', 'free-costings': '/free/costings', assignments: '/owner/assignments',
}[scenario]
// These fixtures use the same path-dependent translation rules as the real app.
if (['production', 'daily-sheet', 'quotes', 'quotes-compare', 'free-costings', 'dispatch', 'fabric-stock', 'yarn-stock', 'rates', 'rates-populated', 'estimator', 'free-estimator', 'workers', 'workers-salary', 'assignments', 'machines'].includes(scenario)) history.replaceState(null, '', (window as any).__harnessPath + location.search)

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

async function SavedQuotesFixture() {
  const { default: C } = await import('@/app/(dashboard)/owner/quotes/QuotesClient')
  const { default: Free } = await import('@/app/free/costings/SavedFreeCostings')
  const { makeSavedCostingTourExamples } = await import('@/lib/saved-costings-tour')
  if (params.get('showcase') === '1') {
    const show = await import('./showcase'); show.installShowcase()
    return <C initialQuotes={show.savedCostings() as any} initialTemplates={show.savedQualities() as any} initialProfile={undefined} initialWorkers={[]} userId="u1" orgId="o1" userMetadata={{}} canUseProductionPipeline={params.get('tier') !== 'lite'} organizationName="Sc pvt" />
  }
  const rows = params.get('populated') === '1' ? makeSavedCostingTourExamples().map((row, index) => ({ ...row, id: `fixture-saved-${index}`, costing_group_id: 'fixture-quality', label: 'Saved fixture quality', quality_label: 'Saved fixture quality' })) : []
  ;(window as any).__fixtureSavedCostings = rows
  return <>{params.get('retained') === '1' && <Free embedded />}<C initialQuotes={rows} initialTemplates={[]} initialProfile={undefined} initialWorkers={[]} userId="u1" orgId="o1" userMetadata={{}} tourUnavailable={params.get('error') === '1'} canUseProductionPipeline={params.get('tier') !== 'lite'} organizationName="Sample Mills" /></>
}

// GT-07 renders the real client with synthetic props; no live loader runs.
function DispatchLiveFixture({ Client, initialData, qualities }: any) {
  React.useEffect(() => {
    ;(window as any).__dispatchMounts = ((window as any).__dispatchMounts ?? 0) + 1
    return () => { (window as any).__dispatchUnmounts = ((window as any).__dispatchUnmounts ?? 0) + 1 }
  }, [])
  return <div data-harness-live="true" data-harness-dispatch-live><Client initialData={initialData} qualities={qualities} /></div>
}
async function DispatchFixture() {
  const { default: Tour } = await import('@/components/dispatches/DispatchGuidedTour')
  const { default: Client } = await import('@/app/(dashboard)/owner/dispatches/ChallansClient')
  if (params.get('pending') === '1') sessionStorage.setItem('weavly-challan-pending', JSON.stringify({ id: 'tour-pending-dispatch', requestId: 'tour-pending-request', version: 1, action: 'confirm', data: {} }))
  const initialData = params.get('populated') === '1' ? [{ id: 'tour-fixture-dispatch', quality_id: 'tour-fixture-quality', quality_label: 'Sample fabric', number: 'SAMPLE-1', selling_rate: 40, document: { date: today, customer_name: 'Sample customer' }, lines: [{ lot: 'SAMPLE-1', meters: 100 }], sent_meters: 100, chargeable_meters: 100, acknowledged_meters: null, delivery_status: 'sent', difference_status: 'none', adjustment_amount: 0, paid_amount: 0, balance: 4000, version: 1, archived_at: null, issued_at: today, created_at: today }] : []
  const qualities = params.get('noStock') === '1' ? [] : [{ id: 'tour-fixture-quality', quality_label: 'Sample fabric', quality_key: 'sample fabric', meters: 600, production_meters: 600, opening_recorded: true }]
  if (params.get('showcase') === '1') { const show = await import('./showcase'); show.installShowcase(); return <Tour userId="u1" orgId="o1" userMetadata={{}}><DispatchLiveFixture Client={Client} initialData={show.challans()} qualities={show.fabricBoard().qualities} /></Tour> }
  return <Tour userId="u1" orgId="o1" userMetadata={{}}><DispatchLiveFixture Client={Client} initialData={initialData} qualities={qualities} /></Tour>
}

// GT-08 uses the real Fabric client with synthetic props and records subtree lifetime.
function FabricLiveFixture({ Client, initialData }: any) {
  React.useEffect(() => {
    ;(window as any).__fabricMounts = ((window as any).__fabricMounts ?? 0) + 1
    return () => { (window as any).__fabricUnmounts = ((window as any).__fabricUnmounts ?? 0) + 1 }
  }, [])
  return <div data-harness-live="true" data-harness-fabric-live><Client initialData={initialData} /></div>
}
async function FabricFixture() {
  const { default: Tour } = await import('@/components/stock/StockGuidedTour')
  const { default: Client } = await import('@/app/(dashboard)/owner/stock/QualityStockClient')
  const qualities = params.get('populated') === '1' ? [{ id: 'tour-fixture-fabric', quality_label: 'Retained fabric', quality_key: 'retained fabric', meters: 600, production_meters: 100, opening_recorded: params.get('allOpening') === '1' }] : []
  const initialData = { qualities, total_meters: qualities.length ? 600 : 0, movements: [], nextCursor: null, cutover: null }
  if (params.get('showcase') === '1') { const show = await import('./showcase'); show.installShowcase(); return <Tour kind="fabric-stock" userId="u1" orgId="o1" userMetadata={{}}><FabricLiveFixture Client={Client} initialData={show.fabricBoard()} /></Tour> }
  return <Tour kind="fabric-stock" userId="u1" orgId="o1" userMetadata={{}}><FabricLiveFixture Client={Client} initialData={initialData} /></Tour>
}

// GT-09 mounts the real Yarn client with synthetic props; no live loader runs.
function YarnLiveFixture({ Client, initialData }: any) {
  React.useEffect(() => {
    ;(window as any).__yarnMounts = ((window as any).__yarnMounts ?? 0) + 1
    return () => { (window as any).__yarnUnmounts = ((window as any).__yarnUnmounts ?? 0) + 1 }
  }, [])
  return <div data-harness-live="true" data-harness-yarn-live><Client initialData={initialData} /></div>
}
async function YarnFixture() {
  const { default: Tour } = await import('@/components/stock/StockGuidedTour')
  const { default: Client } = await import('@/app/(dashboard)/owner/stock/YarnStockClient')
  const populated = params.get('populated') === '1'
  const recipe = [{ yarn_name: 'Retained yarn', yarn_key: 'retained yarn', kg_per_100m: 6, role: 'warp' }, { yarn_name: 'Retained yarn', yarn_key: 'retained yarn', kg_per_100m: 4, role: 'weft' }]
  const costings = params.get('unlinked') === '1' ? [] : [{ id: 'tour-fixture-costing', quality_label: 'Retained fabric', quality_key: 'retained fabric', version_number: 2, saved_at: today, recipe }]
  const initialData = { org_id: 'o1', started_at: populated ? today : null, as_of: null,
    yarns: populated ? [{ id: 'tour-fixture-yarn', yarn_name: 'Retained yarn', yarn_key: 'retained yarn', weight_kg: 75, opening_recorded: true }] : [],
    qualities: populated ? [{ id: 'tour-fixture-fabric', quality_label: 'Retained fabric', quality_key: 'retained fabric', meters: 200, recipe: costings.length ? recipe : null, costing_id: costings[0]?.id ?? null, version: 1 }] : [],
    costings: populated ? costings : [], movements: [], nextCursor: null }
  if (params.get('showcase') === '1') { const show = await import('./showcase'); show.installShowcase(); return <Tour kind="yarn-stock" userId="u1" orgId="o1" userMetadata={{}}><YarnLiveFixture Client={Client} initialData={show.yarnBoard()} /></Tour> }
  return <Tour kind="yarn-stock" userId="u1" orgId="o1" userMetadata={{}}><YarnLiveFixture Client={Client} initialData={initialData} /></Tour>
}

// GT-11 uses the real Overview client with in-memory fixture props; no loader runs.
function ProductionLiveFixture({ Client, initialData }: any) {
  React.useEffect(() => {
    ;(window as any).__productionMounts = ((window as any).__productionMounts ?? 0) + 1
    return () => { (window as any).__productionUnmounts = ((window as any).__productionUnmounts ?? 0) + 1 }
  }, [])
  return <div data-harness-live="true" data-harness-production-live><Client initialData={initialData} view="production" tourMetadata={{}} /></div>
}
async function ProductionFixture() {
  const { default: Tour } = await import('@/components/production/ProductionGuidedTour')
  const { default: Client } = await import('@/app/(dashboard)/owner/production/BaseProductionClient')
  const initialData: any = { orgId: 'o1', actorId: 'u1', today, payrollPeriod: { start: '2026-09-01', end: '2026-09-30' }, costings: [], jobs: [], entries: [], workers: [], machines: [], assignments: [], machineJobContexts: [], dailyBatches: [], batchRevisions: [], advances: [], settlements: [], settlementLines: [], payrollPeriods: [], payables: [], allocations: [] }
  if (params.get('populated') === '1') {
    initialData.jobs = [{ id: 'tour-fixture-quality', quality_label: 'Sample fabric', status: 'active', start_date: today, created_at: today, planned_cost_per_meter: 40, worker_rate_per_meter: 2, costing_id: null }]
    initialData.machines = [{ id: 'tour-fixture-loom', name: 'Sample loom 1', custom_label: null, machine_type: 'power_loom', is_active: true }]
    initialData.workers = [{ id: 'tour-fixture-worker', name: 'Sample worker', is_active: true, pay_type: 'per_meter', shift_availability: 'both', worker_rate_per_meter: 2 }]
    initialData.machineJobContexts = [{ id: 'tour-fixture-context', machine_id: 'tour-fixture-loom', job_id: 'tour-fixture-quality', active: true, effective_from: today, effective_to: null }]
  }
  if (params.get('populated') === 'rich') {
    const yesterday = '2026-09-26'
    const jobs = [
      { id: 'q-demo', quality_label: 'Demo - Signature Polyester', status: 'active', start_date: '2026-09-02', created_at: '2026-09-02', planned_cost_per_meter: 35.22, worker_rate_per_meter: 16, costing_id: 'c-demo-2', costing_group_id: 'g-demo', costing_version: 2 },
      { id: 'q-d345', quality_label: 'D.345', status: 'active', start_date: '2026-08-19', created_at: '2026-08-19', planned_cost_per_meter: 33.15, worker_rate_per_meter: 8.25, costing_id: 'c-d345-1', costing_group_id: 'g-d345', costing_version: 1 },
    ]
    initialData.jobs = jobs
    initialData.costings = [
      { id: 'c-demo-2', costing_group_id: 'g-demo', version_number: 2, quality_label: 'Demo - Signature Polyester', worker_rate_per_meter: 16, production_cost_per_meter: 35.22 },
      { id: 'c-d345-1', costing_group_id: 'g-d345', version_number: 1, quality_label: 'D.345', worker_rate_per_meter: 8.25, production_cost_per_meter: 33.15 },
      { id: 'c-d345-2', costing_group_id: 'g-d345', version_number: 2, quality_label: 'D.345', worker_rate_per_meter: 8.5, production_cost_per_meter: 33.4 },
    ]
    const looms: [string, string, string, number, number][] = [
      ['m01', '01', 'q-demo', 125, 128], ['m06', '06', 'q-demo', 126, 121], ['m03', '03', 'q-d345', 134, 123],
      ['m05', '05', 'q-d345', 115, 107], ['mj1', 'jacquard 1', 'q-d345', 111, 105], ['m04', '04', 'q-d345', 79, 102],
    ]
    initialData.machines = looms.map(([id, label]) => ({ id, name: label, custom_label: null, machine_type: 'power_loom', is_active: true }))
    initialData.machineJobContexts = looms.map(([id, , job]) => ({ id: `ctx-${id}`, machine_id: id, job_id: job, active: true, effective_from: '2026-09-01', effective_to: null }))
    initialData.workers = ['Ramesh', 'Suresh', 'Mahesh', 'Dinesh'].map(name => ({ id: `w-${name}`, name, is_active: true, pay_type: 'per_meter', shift_availability: 'both', worker_rate_per_meter: 8 }))
    initialData.assignments = initialData.workers.map((worker: any, index: number) => ({ id: `a-${index}`, worker_id: worker.id, machine_id: looms[index][0], shift: 'day', active: true, effective_from: '2026-09-01', effective_to: null }))
    initialData.entries = looms.flatMap(([id, label, job, todayMeters, yesterdayMeters], index) => [
      { id: `e-t-${id}`, production_date: today, shift: 'day', worker_id: initialData.workers[index % 4].id, job_id: job, machine_id: id, machine_label: label, meters: todayMeters, entry_status: 'recorded', allocation_mode: 'worker_total' },
      { id: `e-y-${id}`, production_date: yesterday, shift: 'day', worker_id: initialData.workers[index % 4].id, job_id: job, machine_id: id, machine_label: label, meters: yesterdayMeters, entry_status: 'recorded', allocation_mode: 'worker_total' },
    ])
    initialData.dailyBatches = [{ id: 'b-t', production_date: today, shift: 'day' }, { id: 'b-y', production_date: yesterday, shift: 'day' }]
  }
  return <Tour userId="u1" orgId="o1" userMetadata={{}}><ProductionLiveFixture Client={Client} initialData={initialData} /></Tour>
}

// GT-12: real Daily Sheet client; synthetic one-machine or empty props only.
async function DailySheetFixture() {
  const { default: Tour } = await import('@/components/production/ProductionGuidedTour')
  const { default: Client } = await import('@/app/(dashboard)/owner/production/BaseProductionClient')
  const initialData: any = { orgId: 'o1', actorId: 'u1', today, payrollPeriod: { start: '2026-09-01', end: '2026-09-30' }, costings: [], jobs: [], entries: [], workers: [], machines: [], assignments: [], machineJobContexts: [], dailyBatches: [], batchRevisions: [], advances: [], settlements: [], settlementLines: [], payrollPeriods: [], payables: [], allocations: [] }
  if (params.get('populated') === '1') {
    initialData.jobs = [{ id: 'tour-fixture-quality', quality_label: 'Retained fabric', status: 'active', start_date: today, worker_rate_per_meter: 2 }]
    initialData.machines = [{ id: 'tour-fixture-loom', name: 'Retained loom', machine_type: 'power_loom', is_active: true }]
    initialData.workers = [{ id: 'tour-fixture-worker', name: 'Retained worker', is_active: true, pay_type: 'per_meter', shift_availability: 'both' }]
    initialData.assignments = [{ id: 'tour-fixture-assignment', machine_id: 'tour-fixture-loom', worker_id: 'tour-fixture-worker', shift: 'day', active: true, effective_from: today, effective_to: null }]
    initialData.machineJobContexts = [{ id: 'tour-fixture-context', machine_id: 'tour-fixture-loom', job_id: 'tour-fixture-quality', active: true, effective_from: today, effective_to: null }]
  }
  return <div data-harness-daily-live><Tour userId="u1" orgId="o1" userMetadata={{}}><Client initialData={initialData} view="production" /></Tour></div>
}

async function RateBookFixture(populated: boolean) {
  const { default: C, DEMO_YARN_STORAGE_KEY } = await import('@/app/(dashboard)/owner/rates/RatesClient')
  // Fresh runs are deterministic even after a sample-deletion probe.
  if (params.get('demoDeleted') === '1') localStorage.setItem(DEMO_YARN_STORAGE_KEY, 'true')
  else if (params.get('fresh') === '1') localStorage.removeItem(DEMO_YARN_STORAGE_KEY)
  const rows = populated ? [
    { id: '11111111-1111-4111-8111-111111111111', name: 'Fixture Cotton', category: 'yarn_warp' as const, unit: 'per_kg' as const,
      current_value: 285, previous_value: 280, effective_date: today, last_reviewed_at: '2026-06-01', review_interval_days: 30,
      source: 'Fixture supplier A', notes: null, apply_as_default: false, updated_at: '2026-09-27T00:00:00Z', is_active: true, is_reviewed: false },
    { id: '22222222-2222-4222-8222-222222222222', name: 'Fixture Polyester', category: 'yarn_weft' as const, unit: 'per_kg' as const,
      current_value: 230, previous_value: 220, effective_date: today, last_reviewed_at: '2099-01-01', review_interval_days: 90,
      source: 'Fixture supplier B', notes: null, apply_as_default: false, updated_at: '2026-09-27T00:00:00Z', is_active: true, is_reviewed: true },
  ] : []
  if (params.get('showcase') === '1') {
    const show = await import('./showcase'); show.installShowcase()
    return <C initialRates={show.rateBook(params.get('due') === '1') as any} initialConflicts={[]} defaultReviewIntervalDays={30} userMetadata={{}} userId="u1" orgId="o1" />
  }
  return <C initialRates={params.get('archivedOnly') === '1' ? rows.map(row => ({ ...row, is_active: false })) : rows}
    initialConflicts={[]} defaultReviewIntervalDays={90} userMetadata={{}} userId="u1" orgId="o1" />
}

async function WorkersFixture() {
  const { default: C } = await import('@/app/(dashboard)/owner/production/registers/WorkersRegister')
  const query = new URLSearchParams()
  for (const key of ['search', 'shift', 'status', 'inactive', 'payType', 'worker', 'returnTo', 'add']) {
    if (params.has(key)) query.set(key, params.get(key)!)
  }
  ;(window as any).__harnessSearch = query.toString()
  const rows = params.get('populated') === '1' ? [
    { id: '11111111-1111-4111-8111-111111111111', name: 'Retained worker', pay_type: 'piece_rate' as const, shift_availability: 'night' as const, rate_per_meter: 0, is_active: true, assignedMachineCount: 1 },
    { id: '22222222-2222-4222-8222-222222222222', name: 'Retained staff', pay_type: 'fixed_monthly' as const, shift_availability: 'both' as const, rate_per_meter: 0, monthly_salary: 18000, start_date: '2026-09-16', is_active: false, assignedMachineCount: 0 },
  ] : []
  return <C userId="u1" orgId="o1" userMetadata={{}} workers={rows} today={today} />
}

async function AssignmentsFixture() {
  const { default: C } = await import('@/app/(dashboard)/owner/production/BaseProductionClient')
  const data: any = { orgId: 'o1', actorId: 'u1', today, payrollPeriod: { start: '2026-09-01', end: '2026-09-30' }, costings: [], jobs: [], entries: [], workers: [], machines: [], assignments: [], machineJobContexts: [], dailyBatches: [], batchRevisions: [], advances: [], settlements: [], settlementLines: [], payrollPeriods: [], payables: [], allocations: [] }
  if (params.get('populated') === '1') {
    data.workers = [{ id: '11111111-1111-4111-8111-111111111111', name: 'Retained worker', pay_type: 'piece_rate', rate_per_meter: 0, shift_availability: params.get('availability') ?? 'both', is_active: true }]
    data.machines = [{ id: '22222222-2222-4222-8222-222222222222', name: 'Retained loom', machine_type: 'power_loom', custom_label: null, is_active: true }]
  }
  const query = new URLSearchParams()
  for (const key of ['shift', 'worker', 'machine']) if (params.has(key)) query.set(key, params.get(key)!)
  ;(window as any).__harnessSearch = query.toString()
  return <C initialData={data} view="operations" tourMetadata={{}} />
}

// GT-10: real Payroll client, synthetic empty data and retained local state only.
function PayrollLiveFixture({ Client, initialData }: any) {
  React.useEffect(() => {
    ;(window as any).__payrollMounts = ((window as any).__payrollMounts ?? 0) + 1
    return () => { (window as any).__payrollUnmounts = ((window as any).__payrollUnmounts ?? 0) + 1 }
  }, [])
  return <div data-harness-live="true" data-harness-payroll-live><Client initialData={initialData} view="payroll" /></div>
}
async function PayrollFixture() {
  const { default: Tour } = await import('@/components/payroll/PayrollGuidedTour')
  const { default: Client } = await import('@/app/(dashboard)/owner/production/BaseProductionClient')
  const initialData: any = { orgId: 'o1', actorId: 'u1', today, payrollPeriod: { start: '2026-09-01', end: '2026-09-30' }, costings: [], jobs: [], entries: [], workers: [], machines: [], assignments: [], machineJobContexts: [], dailyBatches: [], batchRevisions: [], advances: [], settlements: [], settlementLines: [], payrollPeriods: [], payables: [], allocations: [] }
  return <Tour variant="base" userId="u1" orgId="o1" userMetadata={{}}><PayrollLiveFixture Client={Client} initialData={initialData} /></Tour>
}


// Payroll records review: several months of realistic payments on a monthly cycle.
async function PayrollRecordsFixture() {
  const { default: Client } = await import('@/app/(dashboard)/owner/production/BaseProductionClient')
  const pay = (id: string, worker: string, start: string, end: string, gross: number, recovered = 0, extra: any = {}) => ({
    id, worker_id: `w-${worker}`, worker_name_snapshot: worker, period_start: start, period_end: end, gross_pay: gross,
    advance_balance_before: extra.before ?? recovered, advance_deducted: recovered, remaining_advance_balance: extra.after ?? 0,
    net_payout: gross - recovered, payment_mode: extra.mode ?? 'cash', paid_at: `${extra.paid ?? end}T11:00:00+05:30`,
    status: extra.status ?? 'paid', reversal_reason: extra.reason ?? null, reversed_at: extra.reversedAt ?? null, recovery_receipt_complete: true,
  })
  const piece = (id: string, settlement: string, worker: string, date: string, machine: string, costing: string, rate: number, meters: number) => ({
    id, settlement_id: settlement, worker_id: `w-${worker}`, production_date: date, shift: 'day', machine_id: `m-${machine}`, machine_label: machine,
    job_id: 'j1', costing_label: costing, meters, worker_rate_snapshot: rate, gross_pay: Math.round(rate * meters * 100) / 100, source_kind: 'machine_allocation',
  })
  const salary = (id: string, settlement: string, start: string, end: string) => ({
    id, settlement_id: settlement, worker_id: 'w-Mahesh', production_date: start, shift: null, machine_id: null, machine_label: 'Fixed salary', job_id: null,
    costing_label: `${start} to ${end}`, meters: 0, worker_rate_snapshot: 15000, gross_pay: 15000, source_kind: 'fixed_salary',
  })
  const period = (start: string, end: string, settledAt: string) => ({ id: `p-${start}`, period_start: start, period_end: end, status: 'settled', total_gross: 0, total_recovery: 0, total_net: 0, total_workers: 0, paid_workers: 0, settled_at: settledAt, settled_by: 'u1', calculation_snapshot: null })
  const settlements = [
    pay('jul-ramesh', 'Ramesh', '2026-07-01', '2026-07-31', 8200, 0, { paid: '2026-08-01' }),
    pay('jul-mahesh', 'Mahesh', '2026-07-01', '2026-07-31', 15000, 0, { mode: 'bank_transfer', paid: '2026-08-01' }),
    pay('aug-ramesh', 'Ramesh', '2026-08-01', '2026-08-31', 8680, 1000, { before: 3000, after: 2000, paid: '2026-09-01' }),
    pay('aug-mahesh', 'Mahesh', '2026-08-01', '2026-08-31', 15000, 0, { mode: 'bank_transfer', paid: '2026-09-01' }),
    pay('aug-suresh', 'Suresh', '2026-07-20', '2026-08-31', 6020, 0, { mode: 'upi', paid: '2026-09-01' }),
    pay('aug-kalpesh', 'Kalpesh', '2026-08-01', '2026-08-31', 4000, 0, { paid: '2026-09-01', status: 'reversed', reason: 'Recorded twice by mistake', reversedAt: '2026-09-03' }),
    pay('sep-dinesh-1', 'Dinesh', '2026-09-01', '2026-09-19', 2100, 0, { paid: '2026-09-19' }),
    pay('sep-dinesh-2', 'Dinesh', '2026-09-20', '2026-09-30', 2450, 0, { paid: '2026-10-01' }),
    pay('sep-ramesh', 'Ramesh', '2026-09-01', '2026-09-30', 9120, 1000, { before: 2000, after: 1000, paid: '2026-10-01' }),
    pay('sep-mahesh', 'Mahesh', '2026-09-01', '2026-09-30', 15000, 0, { mode: 'bank_transfer', paid: '2026-10-01' }),
    pay('sep-suresh', 'Suresh', '2026-09-01', '2026-09-30', 6300, 0, { mode: 'upi', paid: '2026-10-01' }),
    pay('oct-ramesh', 'Ramesh', '2026-10-01', '2026-10-05', 1400, 0, { paid: '2026-10-05' }),
  ]
  const settlementLines = [
    piece('l1', 'jul-ramesh', 'Ramesh', '2026-07-15', 'Loom 3', 'Cotton navy 60s', 7, 1171.43),
    salary('l2', 'jul-mahesh', '2026-07-01', '2026-07-31'),
    piece('l3', 'aug-ramesh', 'Ramesh', '2026-08-10', 'Loom 3', 'Cotton navy 60s', 7, 800),
    piece('l4', 'aug-ramesh', 'Ramesh', '2026-08-20', 'Loom 5', 'Rayon white 40s', 7, 440),
    salary('l5', 'aug-mahesh', '2026-08-01', '2026-08-31'),
    piece('l6', 'aug-suresh', 'Suresh', '2026-07-25', 'Loom 7', 'Poly grey twill', 7, 860),
    piece('l7', 'aug-kalpesh', 'Kalpesh', '2026-08-12', 'Loom 5', 'Rayon white 40s', 8, 500),
    piece('l8', 'sep-dinesh-1', 'Dinesh', '2026-09-10', 'Loom 7', 'Poly grey twill', 7, 300),
    piece('l9', 'sep-dinesh-2', 'Dinesh', '2026-09-25', 'Loom 7', 'Poly grey twill', 7, 350),
    piece('l10', 'sep-ramesh', 'Ramesh', '2026-09-12', 'Loom 3', 'Cotton navy 60s', 7, 900),
    piece('l11', 'sep-ramesh', 'Ramesh', '2026-09-22', 'Loom 5', 'Rayon white 40s', 7, 402.86),
    salary('l12', 'sep-mahesh', '2026-09-01', '2026-09-30'),
    piece('l13', 'sep-suresh', 'Suresh', '2026-09-18', 'Loom 3', 'Cotton navy 60s', 7, 900),
    piece('l14', 'oct-ramesh', 'Ramesh', '2026-10-03', 'Loom 3', 'Cotton navy 60s', 7, 200),
  ]
  const empty = params.get('empty') === '1'
  const initialData: any = { orgId: 'o1', actorId: 'u1', factoryName: 'Sample Mills', today: '2026-10-08', payrollPeriod: { start: '2026-10-01', end: '2026-10-31' }, costings: [], jobs: [], entries: [], workers: [], machines: [], assignments: [], machineJobContexts: [], dailyBatches: [], batchRevisions: [], advances: [], settlements: empty ? [] : settlements, settlementLines: empty ? [] : settlementLines, payrollPeriods: empty ? [] : [period('2026-07-01', '2026-07-31', '2026-08-02T10:00:00+05:30'), period('2026-08-01', '2026-08-31', '2026-09-02T10:00:00+05:30')], payables: [], allocations: [] }
  return <div data-harness-live="true"><Client initialData={initialData} view="payroll" /></div>
}

const scenarios: Record<string, () => Promise<React.ReactElement>> = {
  'payroll-records': PayrollRecordsFixture,
  foundation: async () => <Foundation />,
  labels: async () => <LabelProbe />,
  production: ProductionFixture,
  'daily-sheet': DailySheetFixture,
  'fabric-stock': FabricFixture,
  'yarn-stock': YarnFixture,
  dispatch: DispatchFixture,
  payroll: PayrollFixture,
  'payroll-extra': PayrollFixture,
  machines: async () => { const { default: C } = await import('@/app/(dashboard)/owner/production/registers/MachinesRegister'); return <C userId="u1" orgId="o1" userMetadata={{}} machines={params.get('populated') === '1' ? [
    { id: '22222222-2222-4222-8222-222222222222', name: 'Retained loom', machine_type: 'rapier', custom_label: null, is_active: true, hasWorker: false, hasCosting: false, assignedWorkerName: null, assignedCostingLabel: null },
    { id: '33333333-3333-4333-8333-333333333333', name: 'Retained ready loom', machine_type: 'power_loom', custom_label: null, is_active: true, hasWorker: true, hasCosting: true, assignedWorkerName: 'Retained worker', assignedCostingLabel: 'Retained quality' },
  ] : []} today={today} /> },
  estimator: async () => { const { default: C } = await import('@/app/(dashboard)/owner/estimator/EstimatorClient'); return <C initialProfile={null as any} initialTemplates={undefined} initialWorkers={undefined} tutorialDismissed={false} userMetadata={{ tour_preferences: {} }} wizardDismissed userId="u1" orgId="o1" canUseProductionPipeline={params.get('tier') !== 'lite'} staleDefaultRateNames={[]} organizationName="Sample Mills" /> },
  'free-estimator': async () => { const { default: C } = await import('@/app/(dashboard)/owner/estimator/EstimatorClient'); return <C freeMode disableAutosave onFreeUpgrade={() => {}} userId="u1" orgId="o1" organizationName="Sample Mills" initialTemplates={[]} initialWorkers={[]} staleDefaultRateNames={[]} canUseProductionPipeline={false} tutorialDismissed={false} userMetadata={{ tour_preferences: {} }} wizardDismissed /> },
  rates: () => RateBookFixture(false),
  'rates-populated': () => RateBookFixture(true),
  quotes: SavedQuotesFixture,
  'quotes-compare': SavedQuotesFixture,
  'free-costings': async () => {
    const { default: C } = await import('@/app/free/costings/SavedFreeCostings')
    const { makeSavedCostingTourExamples } = await import('@/lib/saved-costings-tour')
    ;(window as any).__fixtureSavedCostings = params.get('populated') === '1' ? makeSavedCostingTourExamples().map((row, index) => ({ ...row, id: `fixture-free-${index}`, label: 'Retained Free snapshot' })) : []
    return <C userId="u1" orgId="o1" userMetadata={{}} embedded={params.get('embedded') === '1'} />
  },
  assignments: AssignmentsFixture,
  workers: WorkersFixture,
  'workers-salary': WorkersFixture,
}

function SearchFixture() {
  React.useEffect(() => {
    const search = params.get('search')
    if (!search) return
    let frame = 0
    const apply = () => {
      const input = document.querySelector<HTMLInputElement>('#saved-costings-search')
      if (!input) { frame = requestAnimationFrame(apply); return }
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, search)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      ;(window as any).__searchFixture = search
    }
    frame = requestAnimationFrame(apply)
    return () => cancelAnimationFrame(frame)
  }, [])
  return null
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-svh overflow-x-hidden bg-background" data-owner-shell>
      <div className="weavly-app-bg fixed inset-0 -z-10" />
      {scenario !== 'foundation' && <aside className="harness-sidebar" data-harness-sidebar="true" />}
      <div className="mobile-workspace-content relative z-10 min-w-0 px-safe">
        <main id="owner-main" tabIndex={-1} className="dashboard-main mx-auto min-h-svh w-full min-w-0 max-w-7xl px-3 pb-5 pt-4 xs:px-4 md:px-6 md:py-6 lg:px-8">{children}<SearchFixture /></main>
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
