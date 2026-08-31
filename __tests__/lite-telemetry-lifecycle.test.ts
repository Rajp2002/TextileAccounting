import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { PLAN_ANALYTICS_EVENTS } from '../lib/plan-analytics'

const observers = vi.hoisted(() => ({ onCLS: vi.fn(), onINP: vi.fn(), onLCP: vi.fn() }))
vi.mock('web-vitals', () => observers)
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); vi.resetModules() })

function navigation(path: string) {
  vi.stubGlobal('window', { innerWidth: 390 })
  vi.stubGlobal('performance', { getEntriesByType: () => [{ name: `https://example.test${path}` }] })
}
describe('Web Vitals lifecycle and privacy', () => {
  it('registers official observers only once, preserves document scope across remounts, and strips DOM entries', async () => {
    navigation('/owner/estimator?quality=private')
    const { initWebVitals } = await import('../lib/web-vitals')
    const onReport = vi.fn()
    const dispose = initWebVitals({ route: '/owner/estimator', language: 'hi', onReport })
    dispose()
    initWebVitals({ route: '/owner/estimator', language: 'gu', onReport })
    await vi.waitFor(() => expect(observers.onCLS).toHaveBeenCalledTimes(1))
    observers.onCLS.mock.calls[0][0]({ name: 'CLS', value: 0.000123, id: 'v5-1788134400000-1234567890123', entries: [{ element: 'private DOM' }] })
    expect(onReport).toHaveBeenCalledWith({ name: 'CLS', value: 0.000123, metricId: 'v5-1788134400000-1234567890123', rating: 'good', route: '/owner/estimator', scope: 'document', deviceClass: 'mobile', language: 'hi' })
  })
  it('does not relabel another route’s buffered document metrics as estimator metrics', async () => {
    navigation('/owner/dashboard')
    const { initWebVitals } = await import('../lib/web-vitals')
    initWebVitals({ route: '/owner/estimator' })
    await Promise.resolve()
    expect(observers.onLCP).not.toHaveBeenCalled()
  })
  it('does not claim delivery when the endpoint rejects a metric or event', async () => {
    navigation('/owner/estimator')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const { reportWebVital } = await import('../lib/web-vitals')
    const { trackPlanEvent } = await import('../lib/plan-analytics')
    expect(await reportWebVital({ name: 'INP', value: 123, metricId: 'v5-1788134400000-1234567890123', rating: 'good', route: '/owner/estimator', scope: 'document', deviceClass: 'mobile', language: 'en' })).toBe(false)
    expect(await trackPlanEvent('saved_quality_start')).toBe(false)
  })
})
describe('migration contract', () => {
  it('allows every client event without removing existing events', () => {
    const sql = readFileSync(new URL('../supabase/migrations/20260901110001_lite_telemetry_contract.sql', import.meta.url), 'utf8')
    const constraint = sql.split('CREATE TABLE')[0]
    for (const name of PLAN_ANALYTICS_EVENTS) expect(constraint).toContain(`'${name}'`)
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('REVOKE ALL ON public.web_vital_samples FROM PUBLIC, anon, authenticated')
    expect(sql).toContain('PRIMARY KEY (org_id, metric_id, name)')
  })
})
