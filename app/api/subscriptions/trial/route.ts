import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** New free trials are retired for the paid Lite/Base launch. */
export async function POST() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    return NextResponse.json(
        { error: 'Free trials are no longer available. Select Weavly Lite or Weavly Base on the Billing page.' },
        { status: 410 }
    )
}
