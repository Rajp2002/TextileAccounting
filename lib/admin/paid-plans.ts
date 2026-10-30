import 'server-only'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBillingReadiness } from '@/lib/billing-readiness'
import { requireFounder } from './founder'
import { AdminError } from './errors'

export type PaidPlansAdmin = {
    goLiveAt: string | null; endingIn14Days: number; endingIn30Days: number; alreadyEnded: number
    readiness: { mode: 'test' | 'live' | 'blocked'; missing: string[] }
}

const summarySchema = z.object({
    goLiveAt: z.string().nullable(), endingIn14Days: z.number().int(), endingIn30Days: z.number().int(), alreadyEnded: z.number().int(),
})

/** Paid-plan pilot state for the founder (spec 2026-10-30 section C2). */
export async function getPaidPlansAdmin(): Promise<PaidPlansAdmin> {
    const principal = await requireFounder()
    const { data, error } = await createAdminClient().rpc('admin_paid_plans_summary', { p_actor_id: principal.userId, p_session_id: principal.sessionId })
    const parsed = summarySchema.safeParse(data)
    if (error || !parsed.success) throw new AdminError('SOURCE_UNAVAILABLE', 503, 'Paid plan status is unavailable.')
    const readiness = getBillingReadiness()
    return { ...parsed.data, readiness: { mode: readiness.mode, missing: readiness.missing } }
}

const extendSchema = z.object({
    newEnd: z.string().refine(value => Number.isFinite(Date.parse(value))).transform(value => new Date(value).toISOString()),
    dryRun: z.boolean(),
}).strict()

function controlError(error: { code?: string } | null, requestId: string): never {
    if (error?.code === '55000') throw new AdminError('PAID_PLANS_LIVE', 409, 'Paid plans are already live.', undefined, requestId)
    if (error?.code === '22023') throw new AdminError('INVALID_INPUT', 400, 'Choose a date after today and within a year.', undefined, requestId)
    throw new AdminError('SOURCE_UNAVAILABLE', 503, 'Nothing changed. Try again.', undefined, requestId)
}

/** Before go-live: move every unpaid trial ending before newEnd to newEnd. A dry run only counts. */
export async function extendTrials(input: unknown): Promise<{ total: number; alreadyEnded: number; newEnd: string }> {
    const principal = await requireFounder()
    const requestId = randomUUID()
    const parsed = extendSchema.safeParse(input)
    if (!parsed.success) throw new AdminError('INVALID_INPUT', 400, 'Choose a date after today and within a year.', undefined, requestId)
    const { data, error } = await createAdminClient().rpc('admin_extend_trials', {
        p_actor_id: principal.userId, p_session_id: principal.sessionId,
        p_new_end: parsed.data.newEnd, p_dry_run: parsed.data.dryRun, p_request_id: requestId,
    })
    if (error) controlError(error, requestId)
    return data as { total: number; alreadyEnded: number; newEnd: string }
}

/** Open real payments once. Refused until live keys and company details are configured. */
export async function goLive(): Promise<{ goLiveAt: string; movedTrials: number }> {
    const principal = await requireFounder()
    const requestId = randomUUID()
    if (getBillingReadiness().mode !== 'live') {
        throw new AdminError('CHECKLIST_INCOMPLETE', 409, 'Live payments are not configured yet.', undefined, requestId)
    }
    const { data, error } = await createAdminClient().rpc('admin_go_live', {
        p_actor_id: principal.userId, p_session_id: principal.sessionId, p_request_id: requestId,
    })
    if (error) controlError(error, requestId)
    return data as { goLiveAt: string; movedTrials: number }
}
