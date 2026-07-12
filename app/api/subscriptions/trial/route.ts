import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** New Premium trials are retired for the paid Estimator launch. */
export async function POST() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    return NextResponse.json(
        { error: 'Free trials are no longer available. Select Estimator or Full Suite on the Billing page.' },
        { status: 410 }
    )
}
