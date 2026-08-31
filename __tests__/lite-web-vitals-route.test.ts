import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ session: vi.fn(), plan: vi.fn(), from: vi.fn(), upsert: vi.fn(), limit: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCachedSession: mocks.session }))
vi.mock('@/lib/subscription', () => ({ getCachedOrgPlanAccess: mocks.plan }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: mocks.from }) }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.limit, getPublicPostLimiter: vi.fn() }))
vi.mock('@/lib/web-vitals', () => import('../lib/web-vitals'))
import { POST } from '../app/api/analytics/web-vitals/route'

const metric = { name: 'CLS', value: 0.001234, rating: 'good', metricId: 'v5-1788134400000-1234567890123', route: '/owner/estimator', scope: 'document', deviceClass: 'mobile', language: 'gu' }
const request = (body: unknown) => new Request('https://example.test/api/analytics/web-vitals', { method: 'POST', body: JSON.stringify(body) })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.session.mockResolvedValue({ user: { id: 'owner' }, profile: { role: 'owner', org_id: 'factory-a' } })
  mocks.plan.mockResolvedValue({ subscriptionTier: 'base' })
  mocks.from.mockReturnValue({ upsert: mocks.upsert })
  mocks.upsert.mockResolvedValue({ error: null })
  mocks.limit.mockResolvedValue({ success: true })
})
describe('authenticated Web Vitals ingestion', () => {
  it('derives factory and real plan on the server, preserves CLS precision and deduplicates metric instances', async () => {
    expect((await POST(request(metric))).status).toBe(202)
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ org_id: 'factory-a', plan_tier: 'base', value: 0.001234 }), { onConflict: 'org_id,metric_id,name' })
    expect(mocks.upsert.mock.calls[0][0]).not.toHaveProperty('actor_id')
  })
  it('rejects tenant spoofing, URLs, identities, invalid ratings and unknown content', async () => {
    for (const body of [{ ...metric, org_id: 'factory-b' }, { ...metric, entitlement: 'lite' }, { ...metric, note: 'secret' }, { ...metric, route: '/owner/estimator?customer=secret' }, { ...metric, rating: 'poor' }]) {
      expect((await POST(request(body))).status).toBe(400)
    }
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
  it('rejects unauthenticated and non-owner writes', async () => {
    mocks.session.mockResolvedValueOnce(null)
    expect((await POST(request(metric))).status).toBe(401)
    mocks.session.mockResolvedValueOnce({ user: { id: 'worker' }, profile: { role: 'supervisor', org_id: 'factory-a' } })
    expect((await POST(request(metric))).status).toBe(403)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
  it('reports unavailable storage instead of claiming receipt', async () => {
    mocks.upsert.mockResolvedValueOnce({ error: { code: '42P01' } })
    expect((await POST(request(metric))).status).toBe(503)
  })
  it('bounds payloads and rate-limits writes', async () => {
    expect((await POST(request({ ...metric, note: 'x'.repeat(2000) }))).status).toBe(413)
    mocks.limit.mockResolvedValueOnce({ success: false })
    expect((await POST(request(metric))).status).toBe(429)
  })
})
