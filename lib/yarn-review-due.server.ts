import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { getRateReviewStatus } from '@/lib/cost-rates'

/** Active yarn rates whose review is due, shown as the sidebar's Rate Book count. */
export async function getYarnReviewDueCount(organizationId: string) {
    const supabase = await createClient()
    const { data } = await supabase
        .from('cost_rate_book')
        .select('last_reviewed_at, review_interval_days')
        .eq('org_id', organizationId)
        .eq('is_active', true)
        .in('category', ['yarn_warp', 'yarn_weft'])
    return (data ?? []).filter(rate => getRateReviewStatus(rate) !== 'current').length
}
