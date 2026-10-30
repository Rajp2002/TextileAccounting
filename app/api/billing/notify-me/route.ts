import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCachedSession } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PAID_PLAN_INTEREST_SOURCES } from '@/lib/paid-plans'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({ source: z.enum(PAID_PLAN_INTEREST_SOURCES) }).strict()

/** "Notify me when paid plans open" (spec 2026-10-30 section C2). The org comes from the verified profile. */
export async function POST(request: Request) {
    const session = await getCachedSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.profile.role !== 'owner' || !session.profile.org_id) return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    const { data, error } = await createAdminClient().rpc('record_paid_plan_interest', {
        p_org_id: session.profile.org_id, p_user_id: session.user.id, p_source: parsed.data.source,
    })
    if (error) return NextResponse.json({ error: 'Could not save your request.' }, { status: 500 })
    return NextResponse.json({ taps: data }, { status: 202 })
}
