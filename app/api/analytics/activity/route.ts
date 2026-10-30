import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCachedSession } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, getActivityLimiter } from '@/lib/rate-limit'
import { ACTIVITY_AREAS } from '@/lib/activity-tracking'

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 1024
const minutes = z.number().int().min(0).max(10)
const flushSchema = z.object({
    minutes: z.number().int().min(1).max(10),
    areas: z.object(Object.fromEntries(ACTIVITY_AREAS.map(area => [area, minutes.optional()]))).strict(),
    device: z.enum(['phone', 'tablet', 'desktop']),
    installed: z.boolean(),
}).strict()

/** Owner active minutes (spec 2026-10-30 section A). The org always comes from the verified profile. */
export async function POST(request: Request) {
    const session = await getCachedSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.profile.role !== 'owner' || !session.profile.org_id) return NextResponse.json({ error: 'Owner access required' }, { status: 403 })

    const text = await request.text().catch(() => '')
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Activity flush is too large.' }, { status: 413 })
    let body: unknown
    try { body = JSON.parse(text) } catch { return NextResponse.json({ error: 'Invalid activity flush.' }, { status: 400 }) }
    const parsed = flushSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid activity flush.' }, { status: 400 })

    const limit = await checkRateLimit(getActivityLimiter, `activity:${session.user.id}`)
    if (!limit.success) return NextResponse.json({ error: 'Too many activity flushes.' }, { status: 429 })

    const { error } = await createAdminClient().rpc('record_account_activity', {
        p_user_id: session.user.id,
        p_org_id: session.profile.org_id,
        p_minutes: parsed.data.minutes,
        p_area_minutes: parsed.data.areas,
        p_device: parsed.data.device,
        p_installed: parsed.data.installed,
    })
    if (error) return NextResponse.json({ error: 'Activity could not be recorded.' }, { status: 500 })
    return NextResponse.json({ ok: true }, { status: 202 })
}
