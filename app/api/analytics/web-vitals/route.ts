import { NextResponse } from 'next/server'
import { getCachedSession } from '@/lib/auth'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeWebVitalPayload } from '@/lib/web-vitals'
import { checkRateLimit, getPublicPostLimiter } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await getCachedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.profile.role !== 'owner') return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  const limit = await checkRateLimit(getPublicPostLimiter, `web-vitals:${session.user.id}`)
  if (!limit.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const text = await request.text()
  if (text.length > 1000) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  let body: unknown
  try { body = JSON.parse(text) } catch { return NextResponse.json({ error: 'Invalid metric' }, { status: 400 }) }
  if (!sanitizeWebVitalPayload(body)) return NextResponse.json({ error: 'Invalid metric' }, { status: 400 })
  const plan = await getCachedOrgPlanAccess(session.profile.org_id)
  const { error } = await createAdminClient().from('web_vital_samples').upsert({
    org_id: session.profile.org_id,
    metric_id: body.metricId, name: body.name, value: body.value, rating: body.rating,
    route: body.route, scope: body.scope, device_class: body.deviceClass, language: body.language,
    plan_tier: plan.subscriptionTier,
  }, { onConflict: 'org_id,metric_id,name' })
  if (error) return NextResponse.json({ error: 'Metric could not be recorded' }, { status: 503 })
  return NextResponse.json({ ok: true }, { status: 202 })
}
