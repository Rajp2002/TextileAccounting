import 'server-only'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { requireFounder, adminRecordAudit } from './founder'
import { formalOperationsEnabled } from './formal'
import { AdminError } from './errors'
import { createAdminClient } from '@/lib/supabase/admin'
export const retainedGroupLabels = { legacy_recurring_references: 'Legacy recurring payment references', billing_evidence: 'Payment and invoice evidence', formal_register_records: 'Privacy and security source records', legal_evidence: 'Legal acceptance and agreement evidence', formal_sidecars_and_retention: 'Case history and retention evidence' } as const
const schema = z.object({ foundationReviewRequired: z.boolean(), reviewRequired: z.boolean(), countLimit: z.literal(1000), groups: z.array(z.object({ key: z.enum(Object.keys(retainedGroupLabels) as [keyof typeof retainedGroupLabels, ...(keyof typeof retainedGroupLabels)[]]), count: z.number().int().min(0).max(1000), more: z.boolean() }).strict()).length(5), asOf: z.iso.datetime({ offset: true }), scope: z.literal('retained_record_review'), automaticDeletion: z.literal(false) }).strict()
export type RetainedReview = z.infer<typeof schema>
export async function getRetainedRecordReview(orgId: unknown): Promise<RetainedReview> {
    const who = await requireFounder(), requestId = randomUUID()
    if (!formalOperationsEnabled()) {
        await adminRecordAudit(who, 'data_rights.review_preview', 'organization', 'disabled', requestId, { outcome: 'denied', reasonCode: 'formal_disabled' })
        throw new AdminError('FORMAL_DISABLED', 403, 'Formal case handling is not enabled.')
    }
    const input = z.uuid().safeParse(orgId)
    if (!input.success) throw new AdminError('INVALID_INPUT', 400, 'Choose a valid factory.')
    const { data, error } = await createAdminClient().rpc('admin_retained_record_review_preview', { p_actor_id: who.userId, p_session_id: who.sessionId, p_org_id: input.data, p_request_id: requestId })
    const dto = schema.safeParse(data)
    if (error?.code === 'P0002') throw new AdminError('NOT_FOUND', 404, 'Factory not found.')
    if (error || !dto.success || new Set(dto.data.groups.map(group => group.key)).size !== 5) {
        await adminRecordAudit(who, 'data_rights.review_preview', 'organization', input.data, requestId, { outcome: 'failure', reasonCode: 'source_unavailable' })
        throw new AdminError('UNAVAILABLE', 503, 'Retained records could not be verified. No erasure permission has been assumed.')
    }
    return dto.data
}
