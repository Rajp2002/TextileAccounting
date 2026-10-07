import React, { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import type { DynamicOptionsLoadingProps } from 'next/dynamic'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as payrollCore from '../lib/base-production-core'
import * as readinessCore from '../lib/base-payroll-readiness'
import { payrollSampleData, productionSampleData } from '../lib/tours/sample-data/production'
import type { BaseProductionInitialData } from '../app/(dashboard)/owner/production/loaders'
import BaseProductionClient, { payrollImportRecovery, useBasePayrollForView } from '../app/(dashboard)/owner/production/BaseProductionClient'

// Exercise the actual shared client and calculation hook without mounting the
// child workspaces or importing server actions into this isolated React test.
vi.mock('../app/(dashboard)/owner/production/actions', () => ({
    createBaseWorkerAdvance: vi.fn(), createBaseWorkerDeduction: vi.fn(), settleBaseWorkerPayroll: vi.fn(),
}))
vi.mock('../app/(dashboard)/owner/production/BaseActiveQualities', () => ({ default: () => null }))
vi.mock('../app/(dashboard)/owner/production/BaseAssignmentWorkspace', () => ({ default: () => null }))
vi.mock('../app/(dashboard)/owner/production/BaseDailyProductionSheet', () => ({ default: () => null }))
vi.mock('../app/(dashboard)/owner/production/BaseWorkerIncentives', () => ({ default: () => null }))
vi.mock('../app/(dashboard)/owner/production/BasePayrollReadinessPanel', () => ({ default: () => null }))
vi.mock('../components/tours/TourSampleBanner', () => ({ TourSampleBanner: () => null }))
vi.mock('../lib/tours/sample-context', () => ({ useTourSample: () => null }))
vi.mock('../lib/i18n/context', () => ({ useTranslation: () => ({ t: (key: string) => key, tx: (text: string) => text }) }))
vi.mock('../hooks/use-localized-page-title', () => ({ useLocalizedPageTitle: () => undefined }))
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
    usePathname: () => '/owner/production/daily-sheet',
    useSearchParams: () => new URLSearchParams(),
}))

class HostElement extends EventTarget {
    nodeType = 1
    tagName = 'DIV'
    namespaceURI = 'http://www.w3.org/1999/xhtml'
    textContent = ''
    constructor(public ownerDocument: EventTarget) { super() }
}

let root: Root | null = null
let current: ReturnType<typeof useBasePayrollForView>

function Probe({ view, data, period = data.payrollPeriod }: {
    view: 'production' | 'operations' | 'payroll'
    data: BaseProductionInitialData
    period?: BaseProductionInitialData['payrollPeriod']
}) {
    const payroll = useBasePayrollForView(view, data, period)
    useLayoutEffect(() => { current = payroll })
    return null
}

async function mountElement(element: React.ReactNode) {
    if (!root) {
        const documentHost = Object.assign(new EventTarget(), { nodeType: 9, activeElement: null })
        const windowHost = Object.assign(new EventTarget(), { document: documentHost, HTMLIFrameElement: class {} })
        vi.stubGlobal('document', documentHost)
        vi.stubGlobal('window', windowHost)
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
        root = createRoot(new HostElement(documentHost) as unknown as HTMLElement)
    }
    await act(() => root!.render(element))
}

const mountProbe = (props: React.ComponentProps<typeof Probe>) => mountElement(<Probe {...props} />)

beforeEach(() => {
    vi.spyOn(payrollCore, 'calculateBaseWorkerPayables')
    vi.spyOn(payrollCore, 'calculateBasePayrollPeriodSummary')
    vi.spyOn(readinessCore, 'buildBasePayrollReadiness')
})

afterEach(async () => {
    if (root) await act(() => root!.unmount())
    root = null
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('Base production task loading', () => {
    it.each(['production', 'operations'] as const)('does no payroll calculation when rendering the real %s view', view => {
        renderToStaticMarkup(<BaseProductionClient view={view} initialData={productionSampleData('en')} />)
        expect(payrollCore.calculateBaseWorkerPayables).not.toHaveBeenCalled()
        expect(payrollCore.calculateBasePayrollPeriodSummary).not.toHaveBeenCalled()
        expect(readinessCore.buildBasePayrollReadiness).not.toHaveBeenCalled()
    })

    it('keeps settlement dormant on the initial payroll view while computing its real financial summary', () => {
        const markup = renderToStaticMarkup(<BaseProductionClient view="payroll" initialData={payrollSampleData('en')} />)
        expect(payrollCore.calculateBaseWorkerPayables).toHaveBeenCalledTimes(1)
        expect(readinessCore.buildBasePayrollReadiness).toHaveBeenCalledTimes(1)
        expect(markup).not.toContain('payroll.loadingSettlement')
        expect(markup).toContain('20,000')
    })

    it('passes every historical source row through unchanged, including older unpaid work', async () => {
        const data = payrollSampleData('en')
        const earlier = { ...data.entries[0], id: 'older-unpaid', production_date: '2026-08-01', meters: 100, allocation_mode: 'worker_total' as const }
        data.entries = [...data.entries, earlier]
        data.today = '2026-09-16'
        data.payrollPeriod = { start: '2026-09-01', end: '2026-09-30' }
        await mountProbe({ view: 'payroll', data })
        const input = vi.mocked(payrollCore.calculateBaseWorkerPayables).mock.calls[0][0]
        for (const key of ['workers', 'entries', 'allocations', 'incentives', 'advances', 'settlements'] as const) {
            expect(input[key]).toBe(data[key])
        }
        expect(input.periodEnd).toBe('2026-09-16')
        expect(current?.payables.find(worker => worker.worker_id === 'tour-worker-1')).toMatchObject({
            period_start: '2026-08-01', meters: 1100, gross_pay: 2200, net_payout: 1200,
        })
        expect(vi.mocked(readinessCore.buildBasePayrollReadiness).mock.calls[0][0].entries).toBe(data.entries)
        expect(vi.mocked(readinessCore.buildBasePayrollReadiness).mock.calls[0][0].allocations).toBe(data.allocations)
    })

    it('reuses calculations across unrelated renders and recalculates after a period or source change', async () => {
        const data = payrollSampleData('en')
        await mountProbe({ view: 'payroll', data })
        const first = current
        await mountProbe({ view: 'payroll', data: { ...data, jobs: [...data.jobs] } })
        expect(current).toBe(first)
        expect(payrollCore.calculateBaseWorkerPayables).toHaveBeenCalledTimes(1)
        await mountProbe({ view: 'payroll', data, period: { start: '2026-07-01', end: '2026-07-31' } })
        expect(payrollCore.calculateBaseWorkerPayables).toHaveBeenCalledTimes(2)
        expect(vi.mocked(payrollCore.calculateBaseWorkerPayables).mock.lastCall?.[0].periodEnd).toBe('2026-07-31')
        expect(current?.periodRecord?.period_start).toBe('2026-07-01')
        await mountProbe({ view: 'payroll', data: { ...data, entries: [...data.entries] } })
        expect(payrollCore.calculateBaseWorkerPayables).toHaveBeenCalledTimes(3)
        expect(current?.payables).toEqual(first?.payables)
    })

    it('starts payroll calculation when entering payroll and stops again when leaving it', async () => {
        const data = payrollSampleData('en')
        await mountProbe({ view: 'production', data })
        expect(current).toBeNull()
        await mountProbe({ view: 'payroll', data })
        expect(current?.payables).toHaveLength(data.workers.length)
        expect(payrollCore.calculateBaseWorkerPayables).toHaveBeenCalledTimes(1)
        await mountProbe({ view: 'operations', data })
        expect(current).toBeNull()
        expect(payrollCore.calculateBaseWorkerPayables).toHaveBeenCalledTimes(1)
    })

    it('recovers a rejected optional chunk without reloading or changing its props', async () => {
        let fallback: DynamicOptionsLoadingProps = {}
        let loadedValue = ''
        const initialError = new Error('Disconnected')
        const retryError = new Error('Still disconnected')
        function Loading(props: DynamicOptionsLoadingProps) {
            useLayoutEffect(() => { fallback = props })
            return null
        }
        function Loaded({ value }: { value: string }) {
            useLayoutEffect(() => { loadedValue = value })
            return null
        }
        const load = vi.fn<() => Promise<{ default: typeof Loaded }>>()
            .mockRejectedValueOnce(retryError)
            .mockResolvedValueOnce({ default: Loaded })
        const Recovery = payrollImportRecovery(load, Loading, initialError)
        await mountElement(<Recovery value="current payroll" />)
        expect(fallback.error).toBe(initialError)
        expect(load).not.toHaveBeenCalled()
        await act(async () => { await fallback.retry?.() })
        expect(fallback.error).toBe(retryError)
        expect(fallback.isLoading).toBe(false)
        await act(async () => { await fallback.retry?.() })
        expect(loadedValue).toBe('current payroll')
        // The successful module stays available when the records tab mounts again.
        await mountElement(null)
        await mountElement(<Recovery value="reopened payroll" />)
        expect(loadedValue).toBe('reopened payroll')
        expect(load).toHaveBeenCalledTimes(2)
    })

    it('uses the latest open state if a deferred chunk resolves after its screen was closed', async () => {
        let fallback: DynamicOptionsLoadingProps = {}
        let loadedOpen: boolean | undefined
        let resolveLoad!: (module: { default: typeof Loaded }) => void
        function Loading(props: DynamicOptionsLoadingProps) {
            useLayoutEffect(() => { fallback = props })
            return null
        }
        function Loaded({ open }: { open: boolean }) {
            useLayoutEffect(() => { loadedOpen = open })
            return null
        }
        const load = vi.fn(() => new Promise<{ default: typeof Loaded }>(resolve => { resolveLoad = resolve }))
        const Recovery = payrollImportRecovery(load, Loading, new Error('Disconnected'))
        await mountElement(<Recovery open />)
        await act(() => { fallback.retry?.() })
        expect(fallback.isLoading).toBe(true)
        expect(fallback.error).toBeNull()
        await mountElement(<Recovery open={false} />)
        await act(async () => { resolveLoad({ default: Loaded }) })
        expect(loadedOpen).toBe(false)
    })
})
