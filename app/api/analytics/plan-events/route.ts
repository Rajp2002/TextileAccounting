import { NextResponse } from 'next/server'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { getCachedSession } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPlanAnalyticsEvent, type PlanAnalyticsProperties } from '@/lib/plan-analytics'

export const dynamic = 'force-dynamic'

function isProperties(value: unknown): value is PlanAnalyticsProperties {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.entries(value).every(([key, item]) => (
    key.length > 0
    && key.length <= 64
    && (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' || item === null)
  ))
}

export async function POST(request: Request) {
  const session = await getCachedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.profile.role !== 'owner') return NextResponse.json({ error: 'Owner access required' }, { status: 403 })

  const body = await request.json().catch(() => null) as { eventName?: unknown; properties?: unknown } | null
  if (!isPlanAnalyticsEvent(body?.eventName) || !isProperties(body?.properties ?? {})) {
    return NextResponse.json({ error: 'Invalid analytics event.' }, { status: 400 })
  }

  const propertiesJson = JSON.stringify(body.properties ?? {})
  if (propertiesJson.length > 2_000) {
    return NextResponse.json({ error: 'Analytics properties are too large.' }, { status: 413 })
  }

  const planAccess = await getCachedOrgPlanAccess(session.profile.org_id)
  const admin = createAdminClient()
  const { error } = await admin.from('plan_usage_events').insert({
    org_id: session.profile.org_id,
    actor_id: session.user.id,
    event_name: body.eventName,
    plan_tier: planAccess.subscriptionTier,
    properties: body.properties ?? {},
  })

  if (error) return NextResponse.json({ error: 'Analytics event could not be recorded.' }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 202 })
}
