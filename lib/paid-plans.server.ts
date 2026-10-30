import 'server-only'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBillingReadiness } from '@/lib/billing-readiness'
import { computeCheckoutOpen, type PaidPlansState } from './paid-plans'

const CLOSED: PaidPlansState = { live: false, goLiveAt: null, checkoutOpen: false }

/** Whether this factory may check out now. Fails closed. The org must come from a verified profile. */
export const getPaidPlansState = cache(async (orgId: string): Promise<PaidPlansState> => {
    const { data, error } = await createAdminClient().rpc('paid_plans_state', { p_org_id: orgId })
    if (error || !data || typeof data !== 'object') return CLOSED
    const state = data as { goLiveAt?: unknown; testAccount?: unknown }
    const goLiveAt = typeof state.goLiveAt === 'string' ? state.goLiveAt : null
    return {
        live: goLiveAt !== null,
        goLiveAt,
        checkoutOpen: computeCheckoutOpen(goLiveAt, state.testAccount === true, getBillingReadiness().mode),
    }
})
