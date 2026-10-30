import 'server-only'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireFounder } from './founder'
import { AdminError } from './errors'

/** Cohorts the founder can set. 'unclassified' is never written by the console. */
export const SETTABLE_COHORTS = ['production', 'test', 'demo', 'internal'] as const
export type SettableCohort = typeof SETTABLE_COHORTS[number]

const bodySchema = z.object({
    cohort: z.enum(SETTABLE_COHORTS),
    reason: z.string().trim().min(3).max(500).optional().default('Marked by founder'),
}).strict()

/** Mark a factory as test, demo, internal or a customer (spec 2026-10-30 section B). */
export async function setFactoryCohort(orgId: string, input: unknown): Promise<{ orgId: string; cohort: SettableCohort }> {
    const principal = await requireFounder()
    const requestId = randomUUID()
    if (!z.uuid().safeParse(orgId).success) throw new AdminError('INVALID_INPUT', 400, 'Choose a valid factory.', undefined, requestId)
    const parsed = bodySchema.safeParse(input)
    if (!parsed.success) throw new AdminError('INVALID_INPUT', 400, 'Choose test, demo, internal or customer.', undefined, requestId)
    const { error } = await createAdminClient().rpc('admin_set_org_cohort', {
        p_actor_id: principal.userId, p_session_id: principal.sessionId, p_org_id: orgId,
        p_cohort: parsed.data.cohort, p_reason: parsed.data.reason, p_request_id: requestId,
    })
    if (error?.code === 'P0002') throw new AdminError('NOT_FOUND', 404, 'This factory no longer exists.', undefined, requestId)
    if (error) throw new AdminError('SOURCE_UNAVAILABLE', 503, 'The factory could not be updated. Nothing changed.', undefined, requestId)
    return { orgId, cohort: parsed.data.cohort }
}
